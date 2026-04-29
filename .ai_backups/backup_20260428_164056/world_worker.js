// ======================================================================
// WORLD SIMULATOR WORKER
// ======================================================================
let player = null;
let globalLocations = {};
let IS_PRE_SIMULATING = false;
let isSimulatingWorld = false;
let TARGET_AGENT_COUNT = 100;

// Вспомогательная функция для логов из воркера
function consoleLog(...args) {
    self.postMessage({ type: 'LOG', message: args.join(' ') });
}
const console = { log: consoleLog, warn: consoleLog, error: consoleLog };

// ======================================================================
// --- ЯДРО СИМУЛЯЦИИ ЖИВОГО МИРА (WORLD SIMULATOR) ---
// ======================================================================
let ECONOMY_ITEMS = {};
let CRAFTING_RECIPES = [];

let FACILITY_NAMES = {};
function getItemName(itemId, eraId) {
    if (!eraId) eraId = 'rebirth';
    return (ECONOMY_ITEMS[itemId] && ECONOMY_ITEMS[itemId].names) ? (ECONOMY_ITEMS[itemId].names[eraId] || ECONOMY_ITEMS[itemId].names['rebirth']) : (ECONOMY_ITEMS[itemId]?.name || itemId);
}
function getFacilityName(facId, eraId) {
    if (!eraId) eraId = 'rebirth';
    return (FACILITY_NAMES[facId] && FACILITY_NAMES[facId][eraId]) ? FACILITY_NAMES[facId][eraId] : facId;
}

let World = null;

const SHELF_LIFE = {
    'meat': 5, 'fish': 5, 'bread': 10, 'wheat': 360, 'smoked_meat': 180, 'herbs': 30,
    'wood': 720, 'iron_ore': 3600, 'gold_ore': 99999, 'weapons': 1800, 'armor': 1800, 'clothes': 1080, 'cotton': 360
};

function addBatch(resources, key, amount, currentDay, initialEvent) {
    if (!resources[key]) resources[key] = { amount: 0, quality: 1.0, batches: [] };
    if (!resources[key].batches) resources[key].batches = [];
    if (amount > 0) {
        resources[key].batches.push({
            amount: amount, 
            day: currentDay, 
            history: [{ day: currentDay, event: initialEvent || "Создано/Добыто" }]
        });
        resources[key].amount += amount;
    }
}

function consumeBatch(resources, key, amount) {
    if (!resources[key] || resources[key].amount <= 0) return 0;
    if (!resources[key].batches) resources[key].batches = [];
    
    let taken = 0;
    let remaining = amount;
    resources[key].batches.sort((a, b) => a.day - b.day); // FIFO: Старые уходят первыми
    
    for (let i = 0; i < resources[key].batches.length && remaining > 0; i++) {
        let b = resources[key].batches[i];
        let take = Math.min(b.amount, remaining);
        b.amount -= take;
        remaining -= take;
        taken += take;
    }
    // Сборщик мусора: пустые партии удаляются из памяти навсегда
    resources[key].batches = resources[key].batches.filter(b => b.amount > 0);
    resources[key].amount = resources[key].batches.reduce((sum, b) => sum + b.amount, 0);
    return taken;
}

function extractBatches(resources, key, amount, extractEvent, currentDay) {
    if (!resources[key] || resources[key].amount <= 0) return [];
    if (!resources[key].batches) resources[key].batches = [];
    
    let extracted = [];
    let remaining = amount;
    resources[key].batches.sort((a, b) => a.day - b.day);
    
    for (let i = 0; i < resources[key].batches.length && remaining > 0; i++) {
        let b = resources[key].batches[i];
        let take = Math.min(b.amount, remaining);
        b.amount -= take;
        remaining -= take;
        if (take > 0) {
            // Клонируем историю, чтобы у отделенной партии был свой независимый путь
            let newHistory = JSON.parse(JSON.stringify(b.history || []));
            if (extractEvent) newHistory.push({ day: currentDay, event: extractEvent });
            extracted.push({ amount: take, day: b.day, history: newHistory });
        }
    }
    resources[key].batches = resources[key].batches.filter(b => b.amount > 0);
    resources[key].amount = resources[key].batches.reduce((sum, b) => sum + b.amount, 0);
    return extracted;
}

function processSpoilage(resources, currentDay, weather) {
    let heatMod = (weather === "Жара") ? 2.0 : 1.0;
    let coldMod = (weather === "Снег" || weather === "Метель") ? 0.3 : 1.0;

    for (let key in resources) {
        let res = resources[key];
        if (!res.batches) res.batches = [{amount: res.amount, day: currentDay}];
        
        let maxLife = SHELF_LIFE[key] || 360;
        let totalQuality = 0;
        let totalAmount = 0;

        for (let i = res.batches.length - 1; i >= 0; i--) {
            let b = res.batches[i];
            let age = currentDay - b.day;
            
            let effectiveAge = age;
            if (['meat', 'fish', 'bread', 'wheat', 'smoked_meat', 'herbs'].includes(key)) {
                effectiveAge = age * heatMod * coldMod;
            }

            if (effectiveAge >= maxLife) {
                b.amount = 0; // Сгнило / Заржавело полностью
            } else {
                let freshness = 1.0 - (effectiveAge / maxLife);
                freshness = Math.max(0.1, freshness);
                
                if (['iron_ore', 'weapons', 'armor'].includes(key) && effectiveAge > maxLife * 0.5) {
                    freshness *= 0.5; // Ржавчина
                }

                totalQuality += freshness * b.amount;
                totalAmount += b.amount;
            }
        }
        
        res.batches = res.batches.filter(b => b.amount > 0);
        res.amount = totalAmount;
        res.quality = totalAmount > 0 ? (totalQuality / totalAmount) : 1.0;
    }
}


async function preSimulateWorldHistory(yearsToSimulate) {
    IS_PRE_SIMULATING = true;
    const totalDays = yearsToSimulate * 12 * 30; // 360 дней в году
    const chunkSize = 60; // Обрабатываем по 2 месяца за кадр, чтобы не вешать UI
    let currentDay = 0;

    if (typeof World.time.internalHour === 'undefined') {
        World.time.internalHour = player && player.gameTime ? player.gameTime.hour : 0;
    }

    

    return new Promise((resolve) => {
        function simulateChunk() {
            for (let i = 0; i < chunkSize && currentDay < totalDays; i++) {
                // Симулируем 24 часа в сутках
                for (let h = 0; h < 24; h++) {
                    simulateOneHour();
                    World.time.internalHour++;
                    if (World.time.internalHour >= 24) {
                        World.time.internalHour = 0;
                        simulateOneDay();
                    }
                }
                
                // Продвигаем время игрока, чтобы оно совпадало с историей
                if (player && player.gameTime) {
                    player.gameTime.day += 1;
                    if (player.gameTime.day > 30) {
                        player.gameTime.day -= 30;
                        player.gameTime.month += 1;
                    }
                    if (player.gameTime.month > 12) {
                        player.gameTime.month -= 12;
                        player.gameTime.year += 1;
                    }
                }
                currentDay++;
            }

            const currentYear = Math.floor(currentDay / 360);
            self.postMessage({ type: 'PROGRESS', message: `Симуляция истории: ${currentYear} / ${yearsToSimulate} лет...` });

            if (currentDay < totalDays) {
                setTimeout(simulateChunk, 0); // Даем браузеру отрисовать кадр
            } else {
                // Завершение симуляции: восстанавливаем популяцию NPC, если они вымерли
                let aliveNpcs = Object.values(World.npcs).filter(n => n.isAlive && n.type === 'npc');
                                if (aliveNpcs.length < TARGET_AGENT_COUNT * 0.75) {
                    const names = ["Боб", "Грег", "Элиза", "Торбин", "Лиара", "Каэль", "Морган", "Сильвия", "Валгар", "Изольда", "Рен", "Талия"];
                    const professions = ["Кузнец", "Фермер", "Стражник", "Торговец", "Маг", "Трактирщик", "Вор", "Наемник"];
                    let rKeys = Object.keys(World.regions);
                    if (rKeys.length > 0) {
                                                for(let i = aliveNpcs.length; i < TARGET_AGENT_COUNT; i++) {
                            let id = "sim_npc_new_" + Date.now() + "_" + i;
                            let home = rKeys[Math.floor(Math.random() * rKeys.length)];
                            let prof = professions[Math.floor(Math.random() * professions.length)];
                            World.npcs[id] = {
                                id: id, name: names[Math.floor(Math.random() * names.length)] + " " + prof, type: "npc", profession: prof,
                                homeLocation: home, currentLocation: home, currentActivity: "Спит",
                                schedule: [
                                    { start: 0, end: 6, activity: "Спит", location: home },
                                    { start: 7, end: 8, activity: "Ест", location: home },
                                    { start: 9, end: 18, activity: "Работает", location: home },
                                    { start: 19, end: 21, activity: "Отдыхает в таверне", location: home },
                                    { start: 22, end: 23, activity: "Спит", location: home }
                                ],
                                needs: { hunger: 100, rest: 100, social: 100, safety: 100 },
                                personality: { aggression: Math.floor(Math.random()*100), sociability: Math.floor(Math.random()*100), greed: Math.floor(Math.random()*100), loyalty: Math.floor(Math.random()*100) },
                                relationships: {}, memory: [], 
                                inventory: { gold: Math.floor(Math.random()*100), items: {} },
                                economy: { skillLevel: Math.floor(Math.random() * 10) + 1, isEmployed: false, workplaceId: null, dailyWage: 0, savings: Math.floor(Math.random() * 500) },
                                isAlive: true, plotArmor: false, travelDestination: null, travelHoursLeft: 0
                            };
                        }
                    }
                }
                World.needsGlobalEvent = false;
                IS_PRE_SIMULATING = false;
                console.log(`[WorldSim] Пред-симуляция завершена. Прошло ${yearsToSimulate} лет.`);
                resolve();
            }
        }
        simulateChunk();
    });
}


function initWorldSimulator() {
    console.log("[WorldSim] Инициализация лорного мира...");
    let newWorld = {
        time: { accumulatedMinutes: 0, lastEventPulse: 0 },
        homeostasis: { warWeariness: 0, fertility: 1.0 },
        gmInterventionHistory: [], lastDirectInjectionDay: -999,
        regions: {}, factions: {}, npcs: {}, news: [], animals: {}, weather: {}, rulers: {}, intrigues: []
    };

    let currentEra = (typeof player !== 'undefined' && player && player.era) ? player.era : 'rebirth';
    let fConfig = {};
    let locMap = {};

    if (currentEra === 'architects') {
        fConfig = { "orthodoxy": { name: "Ортодоксия Решетки", g: [80000, 120000], f: [20000, 30000], m: [15000, 25000], stab: 90 }, "syndicate": { name: "Синдикат Экспансии", g: [100000, 150000], f: [10000, 15000], m: [10000, 20000], stab: 80 }, "greencode": { name: "Фракция Зеленого Кода", g: [20000, 40000], f: [50000, 80000], m: [5000, 10000], stab: 85 }, "ascendancy": { name: "Культ Перехода", g: [30000, 50000], f: [5000, 10000], m: [8000, 15000], stab: 60 }, "apostates": { name: "Апостаты Пустоты", g: [10000, 20000], f: [2000, 5000], m: [20000, 30000], stab: 40 } };
        locMap = { "nexus_prime": "orthodoxy", "solar_citadel": "orthodoxy", "obsidian_wall": "orthodoxy", "sky_harbor": "syndicate", "silver_conduits": "syndicate", "whispering_gardens": "greencode", "aethel_spires": "greencode", "genesis_craters": "greencode", "arcanum_archive": "ascendancy", "crystal_matrix": "ascendancy", "bio_forge": "ascendancy", "void_bastion": "apostates", "resonance_pits": "syndicate", "deep_sea_obs": "orthodoxy" };
    } else if (currentEra === 'silence') {
        fConfig = { "iron_remnant": { name: "Железный Остаток", g: [5000, 10000], f: [2000, 5000], m: [8000, 12000], stab: 85 }, "flesh_cult": { name: "Культ Плоти", g: [1000, 3000], f: [8000, 15000], m: [10000, 20000], stab: 50 }, "heralds": { name: "Вестники Безмолвия", g: [0, 1000], f: [1000, 2000], m: [15000, 25000], stab: 99 }, "logic_purge": { name: "Орден Логической Чистки", g: [20000, 30000], f: [0, 0], m: [5000, 10000], stab: 100 }, "scavengers": { name: "Падальщики Нексуса", g: [10000, 20000], f: [3000, 6000], m: [4000, 8000], stab: 40 } };
        locMap = { "iron_remnant_base": "iron_remnant", "rusting_spires": "iron_remnant", "flesh_craft_pits": "flesh_cult", "bone_fields": "flesh_cult", "forgotten_obs": "heralds", "muted_valley": "heralds", "deep_vault_7": "logic_purge", "crystal_wastes": "logic_purge", "scrap_canyon": "scavengers", "aquilon_ruins": "scavengers", "sunken_haven": "scavengers", "ash_desert": "scavengers", "silent_forest": "flesh_cult", "dead_lake": "flesh_cult", "whispering_dunes": "scavengers" };
    } else if (currentEra === 'sundering') {
        fConfig = { "survivors": { name: "Выжившие Аквилона", g: [5000, 10000], f: [2000, 4000], m: [3000, 6000], stab: 30 }, "mutants": { name: "Улей Мутантов", g: [0, 0], f: [10000, 20000], m: [20000, 40000], stab: 90 }, "storm_cult": { name: "Культ Эфирного Шторма", g: [2000, 5000], f: [1000, 3000], m: [8000, 15000], stab: 50 }, "mad_constructs": { name: "Безумные Конструкты", g: [10000, 20000], f: [0, 0], m: [10000, 15000], stab: 100 } };
        locMap = { "falling_aquilon": "survivors", "ruined_sky_harbor": "survivors", "ashen_coast": "survivors", "mutant_hive": "mutants", "flesh_labyrinth": "mutants", "burning_forest": "mutants", "expanding_scar": "storm_cult", "storms_eye": "storm_cult", "bleeding_earth": "storm_cult", "glass_desert": "mad_constructs", "sunken_arcanum": "mad_constructs", "chasm_of_screams": "mad_constructs", "shattered_peaks": "survivors", "void_wastes": "storm_cult", "boiling_sea": "mutants" };
    } else {
        fConfig = { "aquilon": { name: "Аквилонская Директория", g: [30000, 50000], f: [20000, 30000], m: [15000, 25000], stab: 80 }, "khazadrim": { name: "Кхазадримский Конклав", g: [40000, 60000], f: [8000, 15000], m: [10000, 15000], stab: 90 }, "sylvanesti": { name: "Сильванестийский Симбиоз", g: [5000, 10000], f: [40000, 60000], m: [5000, 8000], stab: 85 }, "gronnar": { name: "Гроннарская Орда", g: [2000, 5000], f: [10000, 15000], m: [20000, 30000], stab: 50 }, "consortium": { name: "Свободные Торговцы", g: [80000, 150000], f: [15000, 25000], m: [5000, 10000], stab: 70 }, "crimson": { name: "Орден Багрового Пламени", g: [15000, 25000], f: [10000, 15000], m: [8000, 12000], stab: 95 } };
        locMap = { "capital_aquilon": "aquilon", "ruins_arcanum": "aquilon", "thunder_citadel": "khazadrim", "crystal_caves": "khazadrim", "dragon_spine_mountains": "khazadrim", "whispering_woods": "sylvanesti", "floating_islands_of_aethel": "sylvanesti", "nomad_lands_ash_plains": "gronnar", "the_scarred_wastes": "gronnar", "the_shifting_sands_of_khem": "gronnar", "silver_haven": "consortium", "sunken_city_of_aeridor": "consortium", "sanctum_of_whispers": "crimson", "ether_scar_chasm": "crimson", "forgotten_observatory": "crimson" };
    }

    for (let fId in fConfig) {
        let bf = fConfig[fId];
        newWorld.factions[fId] = {
            name: bf.name,
            resources: {
                gold: { amount: bf.g[0] + Math.floor(Math.random() * (bf.g[1] - bf.g[0])), quality: 1.0 },
                manpower: { amount: bf.m[0] + Math.floor(Math.random() * (bf.m[1] - bf.m[0])), quality: 1.0 }
            },
            stability: bf.stab - 10 + Math.floor(Math.random() * 20),
            relations: {}, diplomacy: {}, armies: []
        };
    }

    let fKeys = Object.keys(newWorld.factions);
    for (let f1 of fKeys) {
        for (let f2 of fKeys) {
            if (f1 !== f2) {
                newWorld.factions[f1].relations[f2] = Math.floor(Math.random() * 100) - 50;
                newWorld.factions[f1].diplomacy[f2] = "neutral";
            }
        }
    }

    for (let key in globalLocations) {
        if (key === 'startLocation') continue;
        let loc = globalLocations[key];
        let ownerId = locMap[key] || fKeys[Math.floor(Math.random() * fKeys.length)];
        let isDwarf = ownerId === 'khazadrim';
        let isElf = ownerId === 'sylvanesti' || ownerId === 'greencode';

        let regionResources = {};
        let regionMarkets = {};
        let pop = 5000 + Math.floor(Math.random() * 45000);
        
        // Динамическая инициализация ВСЕХ ресурсов из базы
        for (let resKey in ECONOMY_ITEMS) {
            let baseAmount = Math.floor(Math.random() * 500);
            
            if (['wheat', 'wood', 'iron_ore', 'cotton'].includes(resKey)) {
                baseAmount = Math.floor(pop * 0.5) + Math.floor(Math.random() * 1000);
            }
            if (['bread', 'meat', 'fish'].includes(resKey)) {
                baseAmount = Math.floor(pop * 0.3);
            }
            if (resKey === 'weapons' || resKey === 'armor') {
                baseAmount = Math.floor(pop * 0.05);
            }

            // Региональная специализация
            if (isElf && (resKey === 'wood' || resKey === 'herbs' || resKey === 'wheat')) baseAmount *= 2;
            if (isDwarf && (resKey === 'iron_ore' || resKey === 'gold_ore')) baseAmount *= 2;
            
            regionResources[resKey] = { amount: baseAmount, quality: 1.0 + (Math.random() * 0.4 - 0.2), batches: [{ amount: baseAmount, day: 0 }] };
            regionMarkets[resKey] = ECONOMY_ITEMS[resKey].basePrice;
        }

        newWorld.regions[key] = {
            name: loc.name, owner: ownerId, climate: "temperate",
            population: pop,
            resources: regionResources,
            moneySupply: 50000 + Math.floor(Math.random() * 100000),
            facilities: {
                farms: { level: isElf ? 15 : Math.floor(Math.random() * 8), durability: 100 },
                lumbermills: { level: isElf ? 10 : Math.floor(Math.random() * 5), durability: 100 },
                mines: { level: isDwarf ? 20 : Math.floor(Math.random() * 5), durability: 100 },
                forges: { level: isDwarf ? 15 : Math.floor(Math.random() * 5), durability: 100 },
                weavers: { level: Math.floor(Math.random() * 5) + 1, durability: 100 },
                alchemists: { level: isElf ? 5 : Math.floor(Math.random() * 3), durability: 100 },
                banks: { level: ownerId === 'consortium' ? 3 : (Math.random() > 0.5 ? 1 : 0), durability: 100 },
                mills: { level: Math.floor(Math.random() * 5) + 1, durability: 100 },
                bakeries: { level: Math.floor(Math.random() * 5) + 1, durability: 100 },
                smokehouses: { level: Math.floor(Math.random() * 5), durability: 100 },
                smelters: { level: isDwarf ? 10 : Math.floor(Math.random() * 4), durability: 100 },
                tailors: { level: Math.floor(Math.random() * 4), durability: 100 },
                jewelers: { level: ownerId === 'consortium' ? 5 : Math.floor(Math.random() * 2), durability: 100 }
            },
            markets: regionMarkets,
            caravans: []
        };
        newWorld.weather[key] = "Ясно";
        newWorld.animals[key] = { herbivores: isElf ? 10000 : 500 + Math.floor(Math.random() * 2000), carnivores: isElf ? 1000 : 50 + Math.floor(Math.random() * 200) };
    }

    const names = ["Боб", "Грег", "Элиза", "Торбин", "Лиара", "Каэль", "Морган", "Сильвия", "Валгар", "Изольда", "Рен", "Талия"];
    const professions = ["Кузнец", "Фермер", "Стражник", "Торговец", "Маг", "Трактирщик", "Вор", "Наемник"];
    let rKeys = Object.keys(newWorld.regions);
    if (rKeys.length > 0) {
                for(let i=0; i<TARGET_AGENT_COUNT; i++) {
            let id = "sim_npc_" + i;
            let home = rKeys[Math.floor(Math.random() * rKeys.length)];
            let prof = professions[Math.floor(Math.random() * professions.length)];
            newWorld.npcs[id] = {
                id: id, name: names[Math.floor(Math.random() * names.length)] + " " + prof, type: "npc", profession: prof,
                homeLocation: home, currentLocation: home, currentActivity: "Спит",
                schedule: [
                    { start: 0, end: 6, activity: "Спит", location: home },
                    { start: 7, end: 8, activity: "Ест", location: home },
                    { start: 9, end: 18, activity: "Работает", location: home },
                    { start: 19, end: 21, activity: "Отдыхает в таверне", location: home },
                    { start: 22, end: 23, activity: "Спит", location: home }
                ],
                needs: { hunger: 100, rest: 100, social: 100, safety: 100 },
                personality: { aggression: Math.floor(Math.random()*100), sociability: Math.floor(Math.random()*100), greed: Math.floor(Math.random()*100), loyalty: Math.floor(Math.random()*100) },
                relationships: {}, memory: [], 
                inventory: { gold: Math.floor(Math.random()*100), items: {} },
                economy: { skillLevel: Math.floor(Math.random() * 10) + 1, isEmployed: false, workplaceId: null, dailyWage: 0, savings: Math.floor(Math.random() * 500) },
                isAlive: true, plotArmor: false, travelDestination: null, travelHoursLeft: 0
            };
        }
    }
            World = newWorld; // ФИКС: Делаем мир доступным для функции createRulerForFaction, чтобы они нашли свои столицы

// Инициализация правителей и наследников для фракций
    for (let fId in newWorld.factions) {
        newWorld.factions[fId].id = fId;
        newWorld.rulers[fId] = createRulerForFaction(fId, newWorld.factions[fId], currentEra);
        newWorld.rulers[fId + "_heir"] = createRulerForFaction(fId + "_heir", newWorld.factions[fId], currentEra, true);
        newWorld.factions[fId].rulerId = fId;
        newWorld.factions[fId].heirId = fId + "_heir";
    }

    // Инициализация правителей и наследников для фракций (Интеграция с NPC)
    for (let fId in newWorld.factions) {
        newWorld.factions[fId].id = fId;
        let ruler = createRulerForFaction(fId, newWorld.factions[fId], currentEra);
        let heir = createRulerForFaction(fId + "_heir", newWorld.factions[fId], currentEra, true);
        newWorld.rulers[fId] = ruler;
        newWorld.rulers[fId + "_heir"] = heir;
        newWorld.npcs[fId] = ruler; // Правитель как NPC
        newWorld.npcs[fId + "_heir"] = heir; // Наследник как NPC
        newWorld.factions[fId].rulerId = fId;
        newWorld.factions[fId].heirId = fId + "_heir";
    }

return newWorld;
}

function updateWorldSimulation(pulses) {
    if (!World) return;
    
    if (typeof World.time.internalHour === 'undefined') {
        World.time.internalHour = player && player.gameTime ? player.gameTime.hour : 0;
    }

    World.time.accumulatedMinutes += pulses * 5;
    
    while (World.time.accumulatedMinutes >= 60) {
        World.time.accumulatedMinutes -= 60;
        simulateOneHour();
        
        World.time.internalHour++;
        if (World.time.internalHour >= 24) {
            World.time.internalHour = 0;
            simulateOneDay();
        }
    }
    syncWorldWithPlayer();
}

function simulateOneHour() {
    let currentHour = player && player.gameTime ? player.gameTime.hour : 12;
    let currentDay = player && player.gameTime ? player.gameTime.day : 1;

        // 1. Глубокая симуляция NPC (Микро-ИИ Агентов)
    for (let id in World.npcs) {
        let npc = World.npcs[id];
        if (!npc.isAlive || npc.type === 'ruler') continue; // Правители обрабатываются в геополитике

        let currentRegion = World.regions[npc.currentLocation];
        if (!currentRegion) continue;

        // Инициализация HP для старых сохранений
        if (typeof npc.hp === 'undefined') npc.hp = 20;

        // Базовые потребности
        npc.needs.hunger -= (1 + Math.floor(Math.random() * 2));
        npc.needs.rest -= (2 + Math.floor(Math.random() * 2));
        npc.needs.social -= 1;

        // ПУТЕШЕСТВИЕ
        if (npc.travelDestination) {
            npc.travelHoursLeft--;
            npc.currentActivity = "В пути в " + (World.regions[npc.travelDestination]?.name || npc.travelDestination);
            npc.needs.rest -= 1;
            if (npc.travelHoursLeft <= 0) {
                npc.currentLocation = npc.travelDestination;
                npc.travelDestination = null;
                npc.currentActivity = "Прибыл";
            }
            continue;
        }

        // МИГРАЦИЯ И БЕЖЕНЦЫ (Реакция на макро-мир)
        let faction = World.factions[currentRegion.owner];
        let isUnderSiege = faction && faction.armies.some(a => a.destination === npc.currentLocation && a.siegeDays > 0);
        
        if ((isUnderSiege || (faction && faction.stability < 20)) && Math.random() < 0.05) {
            // Бегство от войны или анархии
            let safeRegions = Object.keys(World.regions).filter(r => World.regions[r].owner !== currentRegion.owner && World.factions[World.regions[r].owner]?.stability > 50);
            if (safeRegions.length > 0) {
                npc.travelDestination = safeRegions[Math.floor(Math.random() * safeRegions.length)];
                npc.travelHoursLeft = 24 + Math.floor(Math.random() * 48);
                npc.currentActivity = "Беженец (спасается от войны)";
                continue;
            }
        }

        let actionTaken = false;
        let foodPrice = currentRegion.markets.bread || 5;

        // ВЫЖИВАНИЕ: ГОЛОД И ПРЕСТУПНОСТЬ
        if (npc.needs.hunger < 25) {
            npc.currentActivity = "Ищет еду";
            if (npc.economy.savings >= foodPrice) {
                npc.economy.savings -= foodPrice;
                npc.needs.hunger = 100;
                npc.currentActivity = "Ест";
                currentRegion.moneySupply += foodPrice;
            } else {
                // Попытка попросить помощи у друзей (Взаимовыручка)
                let helped = false;
                for (let friendId in npc.relationships) {
                    let friend = World.npcs[friendId];
                    if (npc.relationships[friendId].trust > 60 && friend && friend.currentLocation === npc.currentLocation && friend.economy.savings > foodPrice * 2) {
                        friend.economy.savings -= foodPrice;
                        npc.needs.hunger = 100;
                        npc.currentActivity = "Ест (помог друг)";
                        helped = true;
                        break;
                    }
                }
                // Если никто не помог
                if (!helped) {
                    if (npc.personality.greed > 60 || npc.personality.aggression > 50) {
                        npc.currentActivity = "Ворует еду";
                        npc.needs.hunger += 40;
                        npc.personality.aggression += 2;
                        // Правосудие: Шанс быть пойманным стражей
                        let guards = Object.values(World.npcs).filter(n => n.currentLocation === npc.currentLocation && n.profession === "Стражник");
                        if (guards.length > 0 && Math.random() < 0.3) {
                            npc.hp -= 10; // Избит стражей
                            npc.currentActivity = "Избит стражей за кражу";
                        }
                    } else {
                        npc.currentActivity = "Голодает";
                    }
                }
            }
            actionTaken = true;
        } else if (npc.needs.rest < 20) {
            npc.currentActivity = "Спит";
            npc.needs.rest += 50;
            actionTaken = true;
        }

        // РАСПИСАНИЕ И ПРОФЕССИИ
        if (!actionTaken) {
            let currentSchedule = npc.schedule.find(s => currentHour >= s.start && currentHour <= s.end);
            if (currentSchedule) {
                npc.currentActivity = currentSchedule.activity;
                
                if (npc.currentActivity === "Работает") {
                    npc.needs.rest -= 2;
                    // Уникальная логика профессий
                    if (npc.profession === "Торговец") {
                        npc.economy.savings += Math.floor(Math.random() * 15) + 5;
                        if (Math.random() < 0.05) { // Торговцы путешествуют между городами
                            let dests = Object.keys(World.regions).filter(r => r !== npc.currentLocation);
                            if (dests.length > 0) {
                                npc.travelDestination = dests[Math.floor(Math.random() * dests.length)];
                                npc.travelHoursLeft = 24;
                                npc.currentActivity = "Везет товары";
                            }
                        }
                    } else if (npc.profession === "Вор") {
                        let victims = Object.values(World.npcs).filter(n => n.currentLocation === npc.currentLocation && n.id !== npc.id && n.economy.savings > 10);
                        if (victims.length > 0 && Math.random() < 0.4) {
                            let victim = victims[Math.floor(Math.random() * victims.length)];
                            let stolen = Math.floor(Math.random() * 10) + 1;
                            victim.economy.savings -= stolen;
                            npc.economy.savings += stolen;
                            npc.currentActivity = "Обокрал " + victim.name;
                        }
                    } else if (npc.profession === "Стражник") {
                        npc.economy.savings += 5;
                        if (faction && faction.stability < 40 && Math.random() < 0.05) {
                            npc.hp -= 5; // Ранен в стычке с бунтовщиками на улицах
                        }
                    } else {
                        // Обычные рабочие (Кузнец, Фермер и т.д.)
                        let wage = Math.max(1, Math.floor((currentRegion.moneySupply / (currentRegion.population || 1)) * npc.economy.skillLevel * 0.5));
                        npc.economy.savings += wage;
                    }
                }
                else if (npc.currentActivity === "Отдыхает в таверне") {
                    npc.needs.social += 20;
                    if (npc.economy.savings > 2) npc.economy.savings -= 2; // Тратит на выпивку
                    
                    let potentialFriends = Object.values(World.npcs).filter(n => n.id !== npc.id && n.currentLocation === npc.currentLocation && n.currentActivity.includes("таверне"));
                    if (potentialFriends.length > 0) {
                        let friend = potentialFriends[Math.floor(Math.random() * potentialFriends.length)];
                        if (!npc.relationships[friend.id]) npc.relationships[friend.id] = { trust: 50, fear: 0, affection: 0 };
                        
                        if (npc.personality.sociability > 50) {
                            npc.relationships[friend.id].trust += 2;
                        } else if (npc.personality.aggression > 70) {
                            npc.relationships[friend.id].trust -= 5;
                            npc.currentActivity = "Ссорится с " + friend.name;
                            if (Math.random() < 0.1) npc.hp -= 5; // Драка в таверне
                        }
                    }
                }
            }
        }

        // ЛИМИТЫ И СМЕРТЬ
        npc.needs.hunger = Math.max(0, Math.min(100, npc.needs.hunger));
        npc.needs.rest = Math.max(0, Math.min(100, npc.needs.rest));
        npc.needs.social = Math.max(0, Math.min(100, npc.needs.social));
        
        if (npc.needs.hunger === 0 || npc.hp <= 0) {
            npc.isAlive = false;
            npc.currentActivity = npc.needs.hunger === 0 ? "Мертв (Голод)" : "Мертв (Убит)";
            if (!IS_PRE_SIMULATING && Math.random() < 0.1) {
                generateWorldNews(`Трагедия в ${currentRegion.name}: ${npc.name} (${npc.profession}) найден мертвым.`, npc.currentLocation, 2);
            }
        }
    }

    // 2. Движение караванов 2.0

    // 2. Движение караванов 2.0
    for (let rId in World.regions) {
        let region = World.regions[rId];
        for (let i = region.caravans.length - 1; i >= 0; i--) {
            let caravan = region.caravans[i];
            caravan.hoursLeft--;
            
            let destRegion = World.regions[caravan.destination];
            
            if (destRegion && Math.random() < 0.02) { // Повышен базовый шанс проверки на ограбление
                let faction = World.factions[destRegion.owner];
                let stability = faction ? faction.stability : 50;
                // Чем ниже стабильность, тем выше шанс ограбления (анархия на дорогах)
                if (Math.random() * 100 > stability + 20) {
                    generateWorldNews(`Караван из ${region.name}, направлявшийся в ${destRegion.name}, был разграблен бандитами!`, caravan.destination, 3, 'trade');
                    region.caravans.splice(i, 1);
                    continue;
                }
            }

            if (caravan.hoursLeft <= 0) {
                if (destRegion) {
                    let deliveredItems = []; // Массив для красивого лога
                    
                    for (let good in caravan.goods) {
                        let amount = caravan.goods[good];
                        let currentDayAbs = player && player.gameTime ? (player.gameTime.year * 360 + player.gameTime.month * 30 + player.gameTime.day) : 0;
                        let batches = caravan.goodsBatches ? caravan.goodsBatches[good] : [{amount: amount, day: currentDayAbs, history: []}];
                        
                        if (!destRegion.resources[good]) destRegion.resources[good] = { amount: 0, quality: 1.0, batches: [] };
                        
                        batches.forEach(b => {
                            if (!b.history) b.history = [];
                            b.history.push({ day: currentDayAbs, event: `Разгружено на склад (${destRegion.name})` });
                            destRegion.resources[good].batches.push(b);
                            destRegion.resources[good].amount += b.amount;
                        });
                        
                        let basePrice = ECONOMY_ITEMS[good] ? ECONOMY_ITEMS[good].basePrice : 1;
                        let sellPrice = destRegion.markets[good] || basePrice;
                        let revenue = amount * sellPrice;
                        
                        destRegion.moneySupply = Math.max(0, destRegion.moneySupply - revenue);
                        
                        let faction = World.factions[destRegion.owner];
                        if (faction) {
                            faction.resources.gold.amount += Math.floor(revenue * 0.1);
                        }

                        // Собираем названия для лога
                        let currentEra = (typeof player !== 'undefined' && player && player.era) ? player.era : 'rebirth';
                        let itemName = getItemName(good, currentEra);
                        deliveredItems.push(`${itemName} (${amount} шт)`);
                    }
                    
                    if (Math.random() < 0.2) {
                        let goodsString = deliveredItems.join(', ');
                        generateWorldNews(`Караван из ${region.name} благополучно прибыл в ${destRegion.name}. Доставлено: ${goodsString}.`, caravan.destination, 2, 'trade');
                    }
                }
                region.caravans.splice(i, 1);
            }
        }
    }
}

function simulateOneDay() {
    if (!IS_PRE_SIMULATING) console.log("[WorldSim] Симуляция нового дня (Глубокая причинно-следственная связь)...");
    if (World) World.needsGlobalEvent = true;

    // --- ГОМЕОСТАЗ МИРА (Адаптивные переменные) ---
    if (World && !World.homeostasis) World.homeostasis = { warWeariness: 0, fertility: 1.0 };
    if (World && World.homeostasis) {
        let activeWarsCount = 0;
        let totalPopulation = 0;
        let rKeysStat = Object.keys(World.regions);
        let initialPopEst = rKeysStat.length > 0 ? rKeysStat.length * 20000 : 100000;

        for (let fId in World.factions) {
            for (let t in World.factions[fId].diplomacy) {
                if (World.factions[fId].diplomacy[t] === "war") activeWarsCount++;
            }
        }
        activeWarsCount = activeWarsCount / 2; // Каждая война считается дважды
        
        // Индекс Военной Усталости Мира
        if (activeWarsCount >= 2) World.homeostasis.warWeariness = Math.min(100, World.homeostasis.warWeariness + 4);
        else if (activeWarsCount === 0) World.homeostasis.warWeariness = Math.max(0, World.homeostasis.warWeariness - 2);

        // Индекс Глобального Изобилия
        for (let rId of rKeysStat) totalPopulation += World.regions[rId].population;
        
        if (totalPopulation < initialPopEst * 0.75) World.homeostasis.fertility = Math.min(2.0, World.homeostasis.fertility + 0.05);
        else if (totalPopulation > initialPopEst * 1.25) World.homeostasis.fertility = Math.max(0.5, World.homeostasis.fertility - 0.05);
        else {
            if (World.homeostasis.fertility > 1.05) World.homeostasis.fertility -= 0.02;
            else if (World.homeostasis.fertility < 0.95) World.homeostasis.fertility += 0.02;
            else World.homeostasis.fertility = 1.0;
        }
    }

    let currentMonth = player && player.gameTime ? player.gameTime.month : 1;
    let currentDay = player && player.gameTime ? (player.gameTime.year * 360 + player.gameTime.month * 30 + player.gameTime.day) : 0;
    let season = "winter";
    if (currentMonth >= 3 && currentMonth <= 5) season = "spring";
    else if (currentMonth >= 6 && currentMonth <= 8) season = "summer";
    else if (currentMonth >= 9 && currentMonth <= 11) season = "autumn";

    let rKeys = Object.keys(World.regions);

    // === 1. ЭКОЛОГИЯ, ПОГОДА И ЛОГИЧНЫЕ КАТАКЛИЗМЫ ===
    for (let rId of rKeys) {
        let r = World.regions[rId];
        
        // Погода
        let weathers = ["Ясно", "Облачно"];
        if (r.climate === "tropical") weathers.push("Тропический ливень", "Жара");
        else if (r.climate === "cold") weathers.push("Снегопад", "Метель");
        else {
            if (season === "winter") weathers.push("Снег", "Метель");
            else if (season === "spring" || season === "autumn") weathers.push("Дождь", "Туман");
            else weathers.push("Дождь", "Жара");
        }
        if (Math.random() < 0.4) World.weather[rId] = weathers[Math.floor(Math.random() * weathers.length)];

        // ПРИЧИННО-СЛЕДСТВЕННЫЕ БЕДСТВИЯ
        let totalFood = (r.resources.bread?.amount || 0) + (r.resources.meat?.amount || 0) + (r.resources.fish?.amount || 0) + (r.resources.smoked_meat?.amount || 0);
        let foodPerCapita = totalFood / (r.population || 1);
        
        // Эпидемия: Высокий шанс, если много людей и мало еды (антисанитария и голод)
        if (r.population > 20000 && foodPerCapita < 0.5 && Math.random() < 0.05) {
            let deaths = Math.floor(r.population * (0.1 + Math.random() * 0.1));
            r.population -= deaths;
            generateWorldNews(`Вспышка чумы в ${r.name}! Голод и скученность привели к эпидемии. Погибло ${deaths} человек.`, rId, 5, 'disaster');
        }
        
        // Засуха/Пожар: Только летом или в жару
        if ((season === "summer" || World.weather[rId] === "Жара") && Math.random() < 0.02) {
            if(r.resources.wheat) r.resources.wheat.amount = Math.floor(r.resources.wheat.amount * 0.2);
            if(r.resources.wood) r.resources.wood.amount = Math.floor(r.resources.wood.amount * 0.3);
            generateWorldNews(`Ужасающая засуха поразила ${r.name}. Урожай пшеницы погиб, леса горят.`, rId, 4, 'disaster');
        }
    }

    // === 2. ЭКОНОМИКА И ПРОИЗВОДСТВО ===
    for (let rId of rKeys) {
        let r = World.regions[rId];
        
        let totalWorkforce = Math.floor(r.population * 0.6);
        let totalJobs = 0;
        for(let f in r.facilities) { totalJobs += r.facilities[f].level * 200; }
        
        let employmentRate = Math.min(1.0, totalJobs / totalWorkforce);
        let activeWorkers = Math.floor(totalWorkforce * employmentRate);
        let unemployed = totalWorkforce - activeWorkers;

        // Налоги
        let faction = World.factions[r.owner];
        if (faction) {
            let taxRevenue = Math.floor(r.moneySupply * 0.02);
            r.moneySupply -= taxRevenue;
            faction.resources.gold.amount += taxRevenue;
        }
        
        let weatherMod = (World.weather[rId] === "Ясно") ? 1.2 : (World.weather[rId] === "Гроза" || World.weather[rId] === "Снег" || World.weather[rId] === "Метель") ? 0.5 : 1.0;
        let workersPerSector = activeWorkers / Object.keys(r.facilities).length;

        // Добыча сырья (с учетом партий и свежести)
        
        let fert = (World && World.homeostasis) ? World.homeostasis.fertility : 1.0;
        let currentEra = (typeof player !== 'undefined' && player && player.era) ? player.era : 'rebirth';
        let facFarms = getFacilityName('farms', currentEra);
        let facLumb = getFacilityName('lumbermills', currentEra);
        let facMines = getFacilityName('mines', currentEra);

        if(r.facilities.farms) {
            addBatch(r.resources, 'wheat', Math.floor(workersPerSector * (r.facilities.farms.level / 5) * 5 * weatherMod * fert), currentDay, `Производство: ${facFarms} (${r.name})`);
            addBatch(r.resources, 'cotton', Math.floor(workersPerSector * (r.facilities.farms.level / 15) * weatherMod * fert), currentDay, `Сбор сырья: ${facFarms} (${r.name})`);
            addBatch(r.resources, 'herbs', Math.floor(workersPerSector * (r.facilities.farms.level / 20) * weatherMod * fert), currentDay, `Культивация: ${facFarms} (${r.name})`);
        }
        if(r.facilities.lumbermills) addBatch(r.resources, 'wood', Math.floor(workersPerSector * (r.facilities.lumbermills.level / 10) * weatherMod), currentDay, `Производство: ${facLumb} (${r.name})`);
        if(r.facilities.mines) {
            addBatch(r.resources, 'iron_ore', Math.floor(workersPerSector * (r.facilities.mines.level / 10)), currentDay, `Добыча: ${facMines} (${r.name})`);
            addBatch(r.resources, 'gold_ore', Math.floor(workersPerSector * (r.facilities.mines.level / 30)), currentDay, `Глубинная добыча: ${facMines} (${r.name})`);
        }

        // Износ и ремонт
        for (let fId in r.facilities) {
            let fac = r.facilities[fId];
            if (fac.level > 0) {
                fac.durability -= 1;
                if (fac.durability < 0) fac.durability = 0;
                if (fac.durability < 20) fac.level = Math.floor(fac.level * 0.5);
                
                if (fac.durability < 50 && r.resources.wood.amount > 5) {
                    fac.durability += 20;
                    r.resources.wood.amount -= 5;
                }
            }
        }

        // Крафт по рецептам
        for (let recipe of CRAFTING_RECIPES) {
            let fac = r.facilities[recipe.facility];
            if (!fac || fac.level <= 0) continue;

            let capacity = Math.floor(workersPerSector * (fac.level / 5));
            if (capacity <= 0) continue;

            let maxCrafts = capacity;
            let totalInputQuality = 0;
            let inputCount = 0;

            for (let inRes in recipe.inputs) {
                let available = r.resources[inRes] ? r.resources[inRes].amount : 0;
                let requiredPerCraft = recipe.inputs[inRes];
                let possibleCrafts = Math.floor(available / requiredPerCraft);
                if (possibleCrafts < maxCrafts) maxCrafts = possibleCrafts;

                if (r.resources[inRes]) {
                    totalInputQuality += r.resources[inRes].quality;
                    inputCount++;
                }
            }

            if (maxCrafts > 0) {
                let avgInputQuality = inputCount > 0 ? (totalInputQuality / inputCount) : 1.0;
                let outputQuality = (avgInputQuality * 0.7) + ((fac.durability / 100) * 0.3);

                for (let inRes in recipe.inputs) {
                    consumeBatch(r.resources, inRes, maxCrafts * recipe.inputs[inRes]);
                }

                for (let outRes in recipe.outputs) {
                    let produced = maxCrafts * recipe.outputs[outRes];
                    let currentEra = (typeof player !== 'undefined' && player && player.era) ? player.era : 'rebirth';
                    let facName = getFacilityName(recipe.facility, currentEra);
                    addBatch(r.resources, outRes, produced, currentDay, `Производство: ${facName} (${r.name}, Ур.${fac.level})`);
                }
            }
        }

        // Потребление и Бунты
        let fertCons = (World && World.homeostasis) ? World.homeostasis.fertility : 1.0;
        let foodConsumed = Math.floor((r.population * 0.02) / fertCons);
        let clothConsumed = Math.floor(r.population * 0.002);
        
        let foodTypes = ['bread', 'meat', 'fish', 'smoked_meat'];
        for(let fType of foodTypes) {
            if(foodConsumed <= 0) break;
            if(r.resources[fType] && r.resources[fType].amount > 0) {
                let eaten = consumeBatch(r.resources, fType, foodConsumed);
                foodConsumed -= eaten;
            }
        }

        if(r.resources.clothes && r.resources.clothes.amount > 0) {
            consumeBatch(r.resources, 'clothes', clothConsumed);
        }

        // --- ПРИМЕНЕНИЕ ПОРЧИ И ГНИЕНИЯ (В КОНЦЕ ДНЯ) ---
        processSpoilage(r.resources, currentDay, World.weather[rId]);

                // ДЕМОГРАФИЯ И ВОССТАНОВЛЕНИЕ (Анти-WW2 логика)
        let foodPerCapitaAfter = (r.resources.bread?.amount || 0) / (r.population || 1);
        if (foodPerCapitaAfter > 0.5 && employmentRate > 0.6) {
            // В мирное и сытое время население растет, а стабильность восстанавливается
            let growth = Math.floor(r.population * 0.0005); // Небольшой ежедневный прирост
            r.population += growth;
            if (faction && faction.stability < 90) faction.stability += 0.2;
        }


// Голод и Бунты (Причина: нет еды или работы)
        if (foodConsumed > 0) {
            let deaths = Math.floor(foodConsumed * 2); // Чем больше нехватка, тем больше смертей
            r.population -= deaths;
            if (faction) faction.stability -= 2; // Голод бьет по стабильности фракции
            if (Math.random() < 0.3) generateWorldNews(`Голод в ${r.name}! Нехватка продовольствия унесла ${deaths} жизней. Власть теряет авторитет.`, rId, 4, 'disaster');
        }

        if (employmentRate < 0.4 && Math.random() < 0.1) {
            generateWorldNews(`Голодные бунты в ${r.name}! Безработные громят склады и кузницы.`, rId, 4, 'disaster');
            if(r.resources.weapons) consumeBatch(r.resources, 'weapons', 100);
            if(r.facilities.forges) r.facilities.forges.durability -= 30; // Бунтовщики ломают здания
            if (faction) faction.stability -= 5;
        }

        // Ценообразование
        for (let good in ECONOMY_ITEMS) {
            let supply = r.resources[good] ? r.resources[good].amount : 0;
            if (supply < 1) supply = 1;
            let demand = r.population * 0.001;
            for(let recipe of CRAFTING_RECIPES) {
                if(recipe.inputs[good]) demand += (r.facilities[recipe.facility]?.level || 0) * 50;
            }
            if(good === 'bread' || good === 'meat') demand += r.population * 0.02;
            if (demand < 1) demand = 1;
            
            let priceMod = Math.max(0.2, Math.min(5.0, demand / supply));
            let qualityMod = r.resources[good] ? r.resources[good].quality : 1.0;
            r.markets[good] = Math.max(1, Math.floor(ECONOMY_ITEMS[good].basePrice * priceMod * qualityMod));
        }
    }

    // === 3. МИКРО-ЭКОНОМИКА NPC ===
    for (let id in World.npcs) {
        let npc = World.npcs[id];
        if (!npc.isAlive) continue;
        let locId = Object.keys(World.regions).find(k => World.regions[k].name === npc.currentLocation);
        if (locId) {
            let r = World.regions[locId];
            if (!npc.economy.isEmployed && Math.random() < 0.1) npc.economy.isEmployed = true;
            else if (npc.economy.isEmployed && Math.random() < 0.02) npc.economy.isEmployed = false;

            if (npc.economy.isEmployed) {
                let wage = Math.max(1, Math.floor((r.moneySupply / r.population) * npc.economy.skillLevel * 0.1));
                npc.economy.savings += wage;
            }
            
            let foodPrice = r.markets.bread || 5;
            if (npc.economy.savings >= foodPrice && r.resources.bread && r.resources.bread.amount > 0) {
                npc.economy.savings -= foodPrice;
                consumeBatch(r.resources, 'bread', 1);
                r.moneySupply += foodPrice;
                npc.needs.hunger = 100;
            }
        }
    }

    // === 4. ЛОГИСТИКА И КАРАВАНЫ ===
    for (let rId of rKeys) {
        let r = World.regions[rId];
        for (let good in ECONOMY_ITEMS) {
            let localPrice = r.markets[good];
            let bestDest = null;
            let maxProfit = 0;

            for (let destId of rKeys) {
                if (destId === rId) continue;
                let dest = World.regions[destId];
                
                // Если в стране анархия (стабильность < 30), купцы боятся собирать караваны
                let originFaction = World.factions[r.owner];
                if (originFaction && originFaction.stability < 30) continue;

                // Караваны не едут во вражеские города (Эмбарго)
                if (originFaction && originFaction.diplomacy[dest.owner] === 'war') continue;

                // Запрет на экспорт стратегических ресурсов при их нехватке
                if (['bread', 'meat', 'wheat'].includes(good)) {
                    let dailyConsumption = r.population * 0.02;
                    if (r.resources[good].amount < dailyConsumption * 5) continue;
                }
                if (good === 'weapons' && r.resources[good].amount < 300) continue;

                let profitMargin = dest.markets[good] - localPrice;
                if (profitMargin > localPrice * 0.3 && r.resources[good] && r.resources[good].amount > 50) {
                    if (profitMargin > maxProfit) {
                        maxProfit = profitMargin;
                        bestDest = destId;
                    }
                }
            }

            if (bestDest) {
                let destRegion = World.regions[bestDest];
                let amount = Math.floor(r.resources[good].amount * 0.2);
                let cost = amount * localPrice;

                if (amount > 0) {
                    let extractedBatches = extractBatches(r.resources, good, amount, `Погружено в караван (Цель: ${World.regions[bestDest].name})`, currentDay);
                    r.moneySupply += cost;
                    r.caravans.push({
                        id: "caravan_" + Date.now() + Math.floor(Math.random()*1000),
                        origin: rId, destination: bestDest, 
                        goods: { [good]: amount },
                        goodsBatches: { [good]: extractedBatches },
                        buyPrice: localPrice, investment: cost, hoursLeft: 24 + Math.floor(Math.random() * 48)
                    });
                }
            }
        }
    }

    // === 5. ГЕОПОЛИТИКА: ПРИЧИННО-СЛЕДСТВЕННАЯ ДИПЛОМАТИЯ ===
    let fKeys = Object.keys(World.factions);
    
    // Подсчет глобальных ресурсов фракций для логики
    for (let fId of fKeys) {
        let f = World.factions[fId];
        f.globalFood = 0; f.globalWeapons = 0; f.totalPopulation = 0;
        let regionCount = 0;
        for (let rId of rKeys) {
            if (World.regions[rId].owner === fId) {
                let r = World.regions[rId];
                // Считаем ВСЮ еду, а не только хлеб
                f.globalFood += (r.resources.bread?.amount || 0) + (r.resources.meat?.amount || 0) + (r.resources.fish?.amount || 0) + (r.resources.wheat?.amount || 0);
                f.globalWeapons += r.resources.weapons?.amount || 0;
                f.totalPopulation += r.population || 0;
                regionCount++;
            }
        }
        f.regionCount = regionCount;
    }

    for (let fId of fKeys) {
        let f = World.factions[fId];
        if (!f.diplomacy) f.diplomacy = {};
        
        // 1. ЭКОНОМИКА: Зарплаты армии и содержание государства
                // ФИКС ЭКОНОМИКИ: Базовый пассивный доход и рекрутинг, чтобы фракции не вымирали
        f.resources.gold.amount += f.regionCount * 500;
        f.resources.manpower.amount += Math.floor(f.totalPopulation * 0.005);

        let armyUpkeep = Math.floor(f.resources.manpower.amount * 0.01); // ФИКС: Содержание армии снижено
        let stateUpkeep = f.regionCount * 100; // Минимальные гос. расходы
        let totalExpenses = armyUpkeep + stateUpkeep;

        if (f.resources.gold.amount >= totalExpenses) {
            f.resources.gold.amount -= totalExpenses;
        } else {
            // ДЕФОЛТ: Денег нет
            f.resources.gold.amount = 0;
                        if (f.stability > 20) f.stability -= 0.5; // ФИКС: Штраф за банкротство снижен
                        f.resources.manpower.amount = Math.floor(f.resources.manpower.amount * 0.98); // ФИКС: Дезертирство замедлено
        }

        // 2. ЛИМИТ АРМИИ: Нельзя бесконечно копить войска
        let maxManpower = Math.floor(f.totalPopulation * 0.15); // Максимум 15% населения могут быть солдатами
        if (f.resources.manpower.amount < maxManpower && f.globalFood > f.resources.manpower.amount) {
            f.resources.manpower.amount += Math.floor(f.totalPopulation * 0.001); // Призыв зависит от населения
        }
        
        // 3. СТАБИЛЬНОСТЬ: Зависит от еды на душу населения
        let foodPerCapita = f.globalFood / (f.totalPopulation || 1);
                if (foodPerCapita < 0.2) f.stability -= 1; // ФИКС: Штраф за голод снижен
                        else if (f.resources.gold.amount > 1000 && !Object.values(f.diplomacy).includes("war")) f.stability += 1.5; // ФИКС: В мирное время стабильность уверенно растет
        
        f.stability = Math.max(0, Math.min(100, f.stability));

        if (f.stability < 20 && Math.random() < 0.1 && (currentDay - (f.lastCoupDay || -999) > 360)) {
            f.lastCoupDay = currentDay; // Кульдаун: 1 революция в год максимум
            generateWorldNews(`Государственный переворот! В землях фракции ${f.name} власть рушится из-за нищеты и голода.`, "global", 5, 'war');
            f.stability = 75; // Новая власть получает высокий кредит доверия
            f.resources.gold.amount += 50000; // Тотальная экспроприация имущества старой элиты для спасения экономики
            f.resources.manpower.amount = Math.floor(f.resources.manpower.amount * 0.3); // Значительная часть армии распускается, чтобы убрать дефицит бюджета
            // Отменяем все текущие войны (новая власть мирится со всеми)
            for (let target in f.diplomacy) {
                if (f.diplomacy[target] === "war") {
                    f.diplomacy[target] = "neutral";
                    if (World.factions[target]) World.factions[target].diplomacy[fId] = "neutral";
                }
            }
        }

        for (let targetF of fKeys) {
            if (targetF === fId) continue;
            let targetFaction = World.factions[targetF];
            let rel = f.relations[targetF] || 0;
            let currentStatus = f.diplomacy[targetF] || "neutral";

            // ЛОГИКА ОТНОШЕНИЙ (Casus Belli)
            let change = 0;
            // Зависть: Если мы голодаем, а они богаты едой -> ненависть
            if (f.globalFood < 500 && targetFaction.globalFood > 3000) change -= 5;
            // Угроза: Если у них огромная армия, а у нас маленькая -> страх и ухудшение отношений
            if (targetFaction.resources.manpower.amount > f.resources.manpower.amount * 3) change -= 2;
            // Торговля сближает: Если стабильность обеих высока -> отношения теплеют
            if (f.stability > 70 && targetFaction.stability > 70) change += 2;
            
            if (currentStatus === "war") change -= 5;
            
            f.relations[targetF] = Math.max(-100, Math.min(100, rel + change));
            rel = f.relations[targetF];

                        // ОБЪЯВЛЕНИЕ ВОЙНЫ (С УЧЕТОМ ВОЕННОЙ УСТАЛОСТИ МИРА)
                        let canFight = f.globalWeapons > 100 && f.resources.manpower.amount > 2000; // ФИКС: Снижен порог для начала войны
            let warWeariness = (World && World.homeostasis) ? World.homeostasis.warWeariness : 0;
            let warThreshold = Math.random() * 100;
            if (rel < -80 && currentStatus !== "war" && canFight && f.stability > 40 && warWeariness < warThreshold) {
                f.diplomacy[targetF] = "war";
                targetFaction.diplomacy[fId] = "war";
                let reason = f.globalFood < 2000 ? "из-за острой нехватки продовольствия (война за выживание)" : "из-за давней кровной вражды";
                generateWorldNews(`Фракция ${f.name} объявляет войну ${targetFaction.name} ${reason}!`, "global", 5, 'war');
            }
            // ЗАКЛЮЧЕНИЕ МИРА (С УЧЕТОМ ВОЕННОЙ УСТАЛОСТИ МИРА)
            else if (currentStatus === "war") {
                // Мир заключается, если армия истощена, стабильность падает, или война идет слишком долго (включая мировую усталость)
                let peaceChance = 0.03 + (((World && World.homeostasis) ? World.homeostasis.warWeariness : 0) / 1000);
                                // ФИКС: Войны длятся дольше. Мир заключается только при полном истощении или критической нестабильности (<15)
                if ((f.resources.manpower.amount < 500 && targetFaction.resources.manpower.amount < 500) || f.stability < 15 || Math.random() < (peaceChance * 0.1)) {
                    f.diplomacy[targetF] = "neutral";
                    targetFaction.diplomacy[fId] = "neutral";
                    // Принудительный сброс отношений в нейтралитет, чтобы не начать войну завтра же
                    f.relations[targetF] = 0;
                    targetFaction.relations[fId] = 0;
                    generateWorldNews(`Истощенные затяжным конфликтом, ${f.name} и ${targetFaction.name} подписали мирный договор.`, "global", 5, 'war');
                }
            }
            // ЗАКЛЮЧЕНИЕ МИРА (Если истощены)
            else if (rel > -20 && currentStatus === "war" && (f.globalWeapons < 100 || f.resources.manpower.amount < 100)) {
                f.diplomacy[targetF] = "neutral";
                targetFaction.diplomacy[fId] = "neutral";
                generateWorldNews(`Истощенные войной, ${f.name} и ${targetFaction.name} подписали мирный договор.`, "global", 5, 'war');
            }
        }

        // === 6. ВОЕННАЯ ЛОГИСТИКА И ОСАДЫ ===
        let atWarWith = Object.keys(f.diplomacy).find(k => f.diplomacy[k] === "war");
        
                if (atWarWith) {
            // Ищем регион, где есть хотя бы базовое количество оружия (снижено со 100 до 50 для мелких стычек)
                        let homeRegionId = Object.keys(World.regions).find(r => World.regions[r].owner === fId && World.regions[r].resources.weapons?.amount > 10);
            
            // Армия собирается, если есть хотя бы 100 рекрутов (убрана жесткая заглушка 500)
                        if (homeRegionId && f.resources.manpower.amount > 500) { // ФИКС: Армии собираются реже, но крупнее
                let homeRegion = World.regions[homeRegionId];
                let targetRegionId = Object.keys(World.regions).find(r => World.regions[r].owner === atWarWith);
                
                let alreadyAttacking = f.armies.some(a => a.destination === targetRegionId);
                
                if (targetRegionId && !alreadyAttacking) {
                    // Динамический размер армии: от 15% до 35% доступных рекрутов
                    let armySize = Math.floor(f.resources.manpower.amount * (0.15 + Math.random() * 0.20));
                    if (armySize < 100) armySize = f.resources.manpower.amount; // Если людей мало, идут все

                    // Логистика: 1 оружие на солдата, 2 ед. еды на солдата
                    let weaponsToTake = Math.min(armySize, homeRegion.resources.weapons.amount);
                    let foodToTake = Math.min(armySize * 2, homeRegion.resources.bread?.amount || 0);
                    
                    consumeBatch(homeRegion.resources, 'weapons', weaponsToTake);
                    if(homeRegion.resources.bread) consumeBatch(homeRegion.resources, 'bread', foodToTake);
                    f.resources.manpower.amount -= armySize;
                    
                    // Расчет морали в зависимости от обеспечения
                    let armyMorale = 100;
                    if (weaponsToTake < armySize * 0.5) armyMorale -= 25; // Плохо вооружены
                    if (foodToTake < armySize) armyMorale -= 25; // Голодные
                    
                    let armyId = "army_" + Date.now() + Math.floor(Math.random()*1000);
                    f.armies.push({ id: armyId, size: armySize, morale: armyMorale, location: homeRegionId, destination: targetRegionId, daysToMove: 3, siegeDays: -1 });
                    generateWorldNews(`Снаряженная армия ${f.name} (${armySize} воинов) выступила из ${homeRegion.name} в поход на ${World.regions[targetRegionId].name}.`, homeRegionId, 4, 'war');
                }
            }
        }

        // ДВИЖЕНИЕ И БОИ
        for (let i = f.armies.length - 1; i >= 0; i--) {
            let army = f.armies[i];
            if (army.daysToMove > 0) {
                army.daysToMove--;
                continue;
            }

            let targetLoc = army.destination;
            let regionOwner = World.regions[targetLoc].owner;
            let armySurvived = true;
            let isCombatActive = false;

            // Полевая битва (встреча двух армий)
            let enemyFactionId = Object.keys(World.factions).find(eId => 
                eId !== fId && f.diplomacy[eId] === "war" && World.factions[eId].armies.some(a => a.destination === targetLoc && a.daysToMove <= 0)
            );

            if (enemyFactionId) {
                isCombatActive = true;
                let defender = World.factions[enemyFactionId];
                let defArmyIndex = defender.armies.findIndex(a => a.destination === targetLoc && a.daysToMove <= 0);
                let defArmy = defender.armies[defArmyIndex];
                
                let atkPower = army.size * (army.morale / 100) * (Math.random() * 0.5 + 0.8);
                let defPower = defArmy.size * (defArmy.morale / 100) * (Math.random() * 0.5 + 1.0);
                
                if (atkPower > defPower) {
                    let casualties = Math.floor(defArmy.size * 0.8);
                    army.size -= Math.floor(army.size * 0.2);
                    generateWorldNews(`Кровавая битва у ${World.regions[targetLoc].name}: Армия ${f.name} разбила войска ${defender.name}! Потери врага: ${casualties}.`, targetLoc, 5, 'war');
                    defender.armies.splice(defArmyIndex, 1);
                    isCombatActive = false;
                } else {
                    let casualties = Math.floor(army.size * 0.8);
                    defArmy.size -= Math.floor(defArmy.size * 0.2);
                    generateWorldNews(`Битва у ${World.regions[targetLoc].name}: Войска ${defender.name} уничтожили армию ${f.name}! Потери нападавших: ${casualties}.`, targetLoc, 5, 'war');
                    f.armies.splice(i, 1);
                    armySurvived = false;
                }
            } 
            // Осада города
            else if (regionOwner && f.diplomacy[regionOwner] === "war") {
                isCombatActive = true;
                let targetRegion = World.regions[targetLoc];

                if (army.siegeDays === -1) {
                    army.siegeDays = Math.floor(Math.random() * 4) + 3;
                    generateWorldNews(`Армия ${f.name} взяла в осаду ${targetRegion.name}! Город отрезан от поставок.`, targetLoc, 4, 'war');
                } else if (army.siegeDays > 0) {
                    army.siegeDays--;
                    // РАЗРУШЕНИЯ ОТ ОСАДЫ
                    targetRegion.population -= Math.floor(Math.random() * 200);
                    if(targetRegion.resources.bread) consumeBatch(targetRegion.resources, 'bread', Math.floor(targetRegion.resources.bread.amount * 0.2)); // Сжигают амбары
                    if(targetRegion.facilities.farms) targetRegion.facilities.farms.durability -= 10;
                } else if (army.siegeDays === 0) {
                    let garrisonPower = (targetRegion.population / 100) + (targetRegion.facilities.farms?.level || 0 * 10);
                    let atkPower = army.size * (Math.random() * 0.5 + 0.8);
                    
                    if (atkPower > garrisonPower) {
                        targetRegion.owner = fId;
                        // ГРАБЕЖ ПРИ ЗАХВАТЕ
                        f.resources.gold.amount += targetRegion.moneySupply * 0.5;
                        targetRegion.moneySupply *= 0.5;
                        generateWorldNews(`ШТУРМ УСПЕШЕН! После жестокой осады ${targetRegion.name} пал под натиском ${f.name}! Город разграблен.`, targetLoc, 5, 'war');
                        isCombatActive = false;
                    } else {
                        generateWorldNews(`ОСАДА СНЯТА! Ополчение ${targetRegion.name} отбило штурм ${f.name}. Нападающие бежали.`, targetLoc, 5, 'war');
                        f.armies.splice(i, 1);
                        armySurvived = false;
                    }
                }
            }
            
            if (armySurvived && f.armies[i] && !isCombatActive) {
                f.resources.manpower.amount += f.armies[i].size;
                f.armies.splice(i, 1);
            }
        }
    }

        // === 7. ДИПЛОМАТИЯ, ПРАВИТЕЛИ И ИНТРИГИ ===
    if (World.rulers) {
        processRulerDiplomacy();
        processIntrigues();
        checkRulerDeaths();
    }

    // === 7. ДИПЛОМАТИЯ, ПРАВИТЕЛИ И ИНТРИГИ ===
    if (World.rulers) {
        processRulerDiplomacy();
        processIntrigues();
        checkRulerDeaths();
    }

    // Очистка старых новостей отключена (сохраняем ВСЮ историю)
    for (let i = World.news.length - 1; i >= 0; i--) {
        World.news[i].daysOld++;
    }
}

function generateWorldNews(text, location, importance, category = 'misc') {
    World.news.push({
        id: "news_" + Date.now() + Math.floor(Math.random()*1000),
        text: text,
        location: location,
        importance: importance,
        category: category,
        daysOld: 0
    });
    if (!IS_PRE_SIMULATING) console.log(`[WorldSim NEWS | ${category}]: ` + text);
}

function syncWorldWithPlayer() {
    if (!player || !World) return;
    let playerRegion = null;
    for (let rId in World.regions) {
        if (player.location.toLowerCase().includes(World.regions[rId].name.toLowerCase())) {
            playerRegion = rId;
            break;
        }
    }

    if (playerRegion) {
        for (let id in World.npcs) {
            let npc = World.npcs[id];
            if (npc.currentLocation === playerRegion && npc.isAlive) {
                let memStr = npc.memory.length > 0 ? ` Память: ${npc.memory[npc.memory.length-1].text}` : "";
                                let hpStatus = npc.hp < 10 ? 'Изранен' : 'Здоров';
                let desc = `Профессия: ${npc.profession}. Сейчас: ${npc.currentActivity}. Состояние: ${hpStatus}, ${npc.needs.hunger < 30 ? 'Голоден' : 'Сыт'}.${memStr}`;
                
                if (!player.visibleEntities[id]) {
                    player.visibleEntities[id] = {
                        aiIdentifier: id,
                        name: npc.name,
                        type: "npc",
                        description: desc,
                        stats: { hp: 20, maxHp: 20, str: 10, dex: 10, con: 10, int: 10 },
                        isHostile: npc.personality.aggression > 80,
                        xpReward: 10,
                        boundTo: player.location,
                        traits: [npc.profession]
                    };
                } else {
                    player.visibleEntities[id].description = desc;
                    player.visibleEntities[id].isHostile = npc.personality.aggression > 80;
                }
            } else if (npc.currentLocation !== playerRegion && player.visibleEntities[id]) {
                delete player.visibleEntities[id];
            }
        }
        if(typeof updateEnvironmentPanel === 'function') updateEnvironmentPanel();
    }
}


async function runWorldSimulationTick() {
    if (isSimulatingWorld) return;
    isSimulatingWorld = true;
    addCalculationMessage("[СИСТЕМА: СИМУЛЯЦИЯ] Мир приходит в движение...");

    const loaderDiv = document.createElement('div');
    loaderDiv.id = 'world-sim-loader';
    loaderDiv.className = 'ether-loader-container';
    loaderDiv.innerHTML = `
        <div class="astrolabe" style="filter: hue-rotate(120deg) brightness(0.8);">
            <div class="astrolabe-ring"></div><div class="astrolabe-ring"></div><div class="astrolabe-ring"></div><div class="astrolabe-core"></div>
        </div>
        <div class="ether-text-container">
            <span class="ether-text-title" style="color: #e74c3c; text-shadow: 0 0 10px #e74c3c;">ПЕРЕСТРОЙКА РЕАЛЬНОСТИ...</span>
            <span class="ether-text-subtitle">Движок Мира анализирует события</span>
        </div>
    `;
    gameLog.appendChild(loaderDiv);
    gameLog.scrollTo({ top: gameLog.scrollHeight, behavior: 'smooth' });

    try {
        let daysPassed = World.time.daysSinceLastEvent || 1;
        World.time.daysSinceLastEvent = 0;

        let worldSummary = "=== ТЕКУЩЕЕ СОСТОЯНИЕ МИРА (СЫРЫЕ ДАННЫЕ) ===\n";
        for (let rId in World.regions) {
            let r = World.regions[rId];
            let ownerName = World.factions[r.owner] ? World.factions[r.owner].name : "Нет владельца";
            
            // ДИНАМИЧЕСКИЙ СБОР РЕСУРСОВ (БЕЗ ОШИБОК UNDEFINED)
            let resArr = [];
            for(let k in r.resources) {
                if(r.resources[k].amount > 0) {
                    let currentEra = (typeof player !== 'undefined' && player && player.era) ? player.era : 'rebirth';
                    let name = getItemName(k, currentEra);
                    resArr.push(`${name}: ${Math.floor(r.resources[k].amount)}`);
                }
            }
            let resStr = resArr.slice(0, 6).join(', '); // Берем топ 6 ресурсов для сводки

            worldSummary += `Регион: ${r.name} (Владелец: ${ownerName}). Население: ${r.population}. Погода: ${World.weather[rId]}. Ресурсы: ${resStr}.\n`;
        }
        
        let activeWars = [];
        for (let fId in World.factions) {
            let f = World.factions[fId];
            let gold = f.resources.gold ? Math.floor(f.resources.gold.amount) : 0;
            worldSummary += `Фракция: ${f.name}. Стабильность: ${f.stability}/100. Золото: ${gold}. Армий в походе СЕЙЧАС: ${f.armies.length}.\n`;
            for (let target in f.diplomacy) {
                if (f.diplomacy[target] === "war") activeWars.push(`${f.name} воюет с ${World.factions[target].name}`);
            }
        }
        if (activeWars.length > 0) worldSummary += `\nВойны: ${[...new Set(activeWars)].join(", ")}\n`;

        let recentNews = World.news.filter(n => n.daysOld <= daysPassed).map(n => `[${n.daysOld} дн. назад]: ${n.text}`).join("\n");
        worldSummary += `\nХронология системных событий за этот период:\n${recentNews || "Нет свежих данных"}\n`;

        const fantasyMonths = ["Утренней Звезды", "Ледолома", "Ветровея", "Цветеня", "Солнцеворота", "Знойника", "Жатвеня", "Листопада", "Хладника", "Мертвой Луны", "Темного Рубежа", "Конца Года"];
        let currentDateStr = `${player.gameTime.day} ${fantasyMonths[player.gameTime.month - 1]}, ${player.gameTime.year} года`;
        
        const prompt = `### ДИРЕКТИВА: ДВИЖОК МИРА (WORLD SIMULATOR) v5.0\nТы — аналитический модуль. Твоя задача: написать историческую сводку ("Вести из Эфира") на основе СЫРЫХ ДАННЫХ.\n\n[СИСТЕМНОЕ ВРЕМЯ]:\n- Текущая дата: ${currentDateStr}\n- Времени прошло с прошлой сводки: ровно ${daysPassed} дней.\n\n${worldSummary}\n\nПРИКАЗЫ (ЛОГИКА И ФАКТЫ):\n1. Внимательно изучи "Хронологию системных событий". Обращай внимание на пометку "[X дн. назад]". Если осада началась 14 дней назад и длилась 4 дня, значит ОНА УЖЕ ЗАВЕРШИЛАСЬ. Не смей писать, что город "продержится еще 4 дня"!\n2. Сверься с "ТЕКУЩИМ СОСТОЯНИЕМ МИРА". Если в списке "Армий в походе СЕЙЧАС" у фракции 0 армий, значит в ДАННЫЙ МОМЕНТ она никого не осаждает и никуда не идет. Все её походы из Хронологии уже завершены, описывай их как прошлые события.\n3. Опиши события в прошедшем времени, как историк, подводящий итоги за ${daysPassed} дней. Оперируй только фактами из сводки, НЕ ВЫДУМЫВАЙ действия армий, если их нет в логах.\n4. Начни текст с четкого обозначения прошедшего времени (Например: "За минувшие ${daysPassed} дней...", "К ${currentDateStr} ситуация...").\n5. Твой ответ ДОЛЖЕН БЫТЬ СТРОГО ВАЛИДНЫМ JSON ОБЪЕКТОМ. Массив actions оставляй ПУСТЫМ [].\nФормат:\n{\n  "narrative": "Твоя точная и логичная хроника событий...",\n  "actions": []\n}`;
        
        const modelId = currentApiProvider === 'gemini' ? geminiModelId : (currentApiProvider === 'llmost' ? llmostModelId : openrouterModelId);
        const raw = await performAiFetch(prompt, [], modelId, `Анализ данных за ${daysPassed} дней.`);
        const res = parseAIResponse(raw);
        
        if (loaderDiv) loaderDiv.remove();

        if (res.actions) {
            res.actions.forEach(a => executeCommand(a.command, a.args));
        }

        if (res.narrative) {
            const container = document.querySelector('.game-container');
            if (container) {
                container.classList.remove('heavy-shake');
                void container.offsetWidth; 
                container.classList.add('heavy-shake');
            }
            
            addLogMessage(res.narrative, "world-event");
        }

    } catch (e) { 
        console.error("World Sim Error:", e);
        if (loaderDiv) loaderDiv.remove();
        isSimulatingWorld = false;
        showAiErrorModal(
            e.message || String(e),
            false,
            () => { runWorldSimulationTick(); },
            "Сбой Эфирной Сети",
            "Произошел сбой при генерации Вестей из Эфира (Симуляция Мира). Повторить попытку?"
        );
    } finally { 
        if (isSimulatingWorld) {
            isSimulatingWorld = false;
        }
        updateWorldChroniclesDisplay();
        updateTradeJournalDisplay();
    }
}

// --- СВЯЗЬ С ГЛАВНЫМ ПОТОКОМ ---
self.onmessage = async function(e) {
    const data = e.data;
    
    if (data.action === 'init') {
        ECONOMY_ITEMS = data.ECONOMY_ITEMS;
        CRAFTING_RECIPES = data.CRAFTING_RECIPES;
        FACILITY_NAMES = data.FACILITY_NAMES;
        self.postMessage({ type: 'INIT_DONE' });
    } 
        else if (data.action === 'buildWorld') {
        player = data.player;
        globalLocations = data.globalLocations;
        TARGET_AGENT_COUNT = data.initialAgents || 100;
        World = initWorldSimulator();
        self.postMessage({ type: 'WORLD_BUILT', World: World });
    }
    else if (data.action === 'preSimulate') {
        World = data.World;
        player = data.player;
        globalLocations = data.globalLocations;
        
        await preSimulateWorldHistory(data.years);
        
        self.postMessage({ 
            type: 'PRE_SIMULATE_DONE', 
            World: World, 
            playerUpdates: { visibleEntities: player.visibleEntities } 
        });
    }
    else if (data.action === 'updateTime') {
        World = data.World;
        player = data.player;
        globalLocations = data.globalLocations;
        
        updateWorldSimulation(data.pulses);
        
        self.postMessage({ 
            type: 'WORLD_UPDATED', 
            World: World, 
            playerUpdates: { visibleEntities: player.visibleEntities } 
        });
    }
    
};


// ======================================================================
// --- СИСТЕМА ПРАВИТЕЛЕЙ, ДИПЛОМАТИИ И ИНТРИГ (FULL V2) ---
// ======================================================================

function createRulerForFaction(id, faction, era, isHeir = false) {
    const names = ["Кассий", "Эларион", "Гром", "Морган", "Сильвана", "Торбин", "Валгар", "Изольда", "Рен", "Талия"];
    let name = (isHeir ? "Наследник " : "Правитель ") + names[Math.floor(Math.random() * names.length)];
    
    if (faction.name.includes("Аквилон")) name = isHeir ? "Принц Кассий IV" : "Император Кассий III";
    if (faction.name.includes("Сильванести")) name = isHeir ? "Принцесса Лираэль" : "Король-Жрец Эларион";
    if (faction.name.includes("Кхазадрим")) name = isHeir ? "Тан Борин" : "Король Магнар";
    if (faction.name.includes("Гроннар")) name = isHeir ? "Кровавый Клык" : "Вождь Грошнак";

    let baseWisdom = 50, baseCruelty = 50, baseDiplomacy = 50, baseMilitary = 50;
    if (faction.name.includes("Эльф") || faction.name.includes("Сильванести")) { baseWisdom = 70; baseDiplomacy = 70; baseCruelty = 20; }
    if (faction.name.includes("Орк") || faction.name.includes("Гроннар")) { baseMilitary = 80; baseCruelty = 75; baseDiplomacy = 20; }
    if (faction.name.includes("Аквилон")) { baseMilitary = 70; baseDiplomacy = 60; baseCruelty = 50; }
    if (faction.name.includes("Торговцы")) { baseDiplomacy = 80; baseWisdom = 60; baseCruelty = 40; }

    // Ищем самую богатую/населенную локацию фракции, чтобы сделать ее столицей для правителя
    let capitalId = null;
        if (typeof World !== 'undefined' && World !== null && World.regions) {
        let ownedRegions = Object.keys(World.regions).filter(r => World.regions[r].owner === faction.id);
        if (ownedRegions.length > 0) {
            capitalId = ownedRegions.reduce((a, b) => World.regions[a].population > World.regions[b].population ? a : b);
        }
    }
    if (!capitalId) capitalId = "Неизвестно";

    return {
        id: id,
        name: name,
        factionId: faction.id || id.replace("_heir", ""),
        type: "ruler",
        stats: { hp: 150, maxHp: 150, str: 14, dex: 12, int: 18, con: 14, cha: 18, res: 15 },
        personality: {
            ambition: Math.floor(Math.random() * 40) + 40,
            paranoia: Math.floor(Math.random() * 40) + 30,
            wisdom: baseWisdom + Math.floor(Math.random() * 20) - 10,
            cruelty: baseCruelty + Math.floor(Math.random() * 20) - 10,
            diplomacy: baseDiplomacy + Math.floor(Math.random() * 20) - 10,
            military: baseMilitary + Math.floor(Math.random() * 20) - 10,
            stewardship: 50 + Math.floor(Math.random() * 40),
            aggression: baseMilitary, sociability: baseDiplomacy, greed: 50, loyalty: 100
        },
        traits: ["Властный", "Окружен охраной"],
        health: 100,
        alive: true,
        heir: isHeir ? null : id + "_heir",
        currentGoal: null,
        gmOverride: null,
        lastTickDay: 0,
        // ПОЛНАЯ ИНТЕГРАЦИЯ С СИСТЕМОЙ NPC
        aiIdentifier: id,
        profession: isHeir ? "Наследник" : "Правитель",
        homeLocation: capitalId,
        currentLocation: capitalId,
        currentActivity: "Управляет государством в тронном зале",
        schedule: [
            { start: 0, end: 6, activity: "Спит в покоях", location: capitalId },
            { start: 7, end: 12, activity: "Слушает доклады советников", location: capitalId },
            { start: 13, end: 18, activity: "Управляет государством в тронном зале", location: capitalId },
            { start: 19, end: 23, activity: "Плетет интриги в кабинете", location: capitalId }
        ],
        needs: { hunger: 100, rest: 100, social: 100, safety: 100 },
        relationships: {}, 
        memory: [{ day: 0, text: "Я правлю этими землями." }], 
        inventory: { gold: 100000, items: {} },
        economy: { skillLevel: 20, isEmployed: true, workplaceId: "Дворец", dailyWage: 1000, savings: 500000 },
        plotArmor: true, travelDestination: null, travelHoursLeft: 0, isHostile: false, xpReward: 5000
    };
}

function processRulerDiplomacy() {
    let fKeys = Object.keys(World.factions);
    for (let rId in World.rulers) {
        let ruler = World.rulers[rId];
        if (!ruler.alive || ruler.id.includes("_heir")) continue;
        
        let faction = World.factions[ruler.factionId];
        if (!faction) continue;

        if (player && player.nexusData) {
            let nexusGoal = player.nexusData[`${ruler.factionId}_goal`];
            if (nexusGoal) ruler.gmOverride = nexusGoal.value;
        }

        if (ruler.gmOverride) {
            ruler.currentGoal = { type: "gm_override", targetFactionId: ruler.gmOverride };
            continue;
        }

        let security = faction.stability + (faction.armies.length * 10);
        let wealth = faction.resources.gold.amount;
        let power = faction.resources.manpower.amount;

        // УМНЫЙ ИИ ФРАКЦИЙ: Принимают решения редко, но метко (2% шанс в день)
        if (Math.random() < 0.02) { 
            let targetF = fKeys[Math.floor(Math.random() * fKeys.length)];
            if (targetF === ruler.factionId) continue;
            let targetFaction = World.factions[targetF];
            let targetPower = targetFaction.resources.manpower.amount;

            // 1. ОЦЕНКА УГРОЗЫ И КОАЛИЦИИ
            if (targetPower > power * 2 && targetFaction.diplomacy[ruler.factionId] === "war") {
                // Враг слишком силен. Ищем союзников или сдаемся.
                if (faction.stability < 30 || power < 1000) {
                    ruler.currentGoal = { type: "surrender", targetFactionId: targetF };
                    faction.diplomacy[targetF] = "neutral";
                    targetFaction.diplomacy[ruler.factionId] = "neutral";
                    faction.resources.gold.amount = Math.floor(faction.resources.gold.amount * 0.5); // Выплата контрибуции
                    targetFaction.resources.gold.amount += faction.resources.gold.amount;
                    generateWorldNews(`КАПИТУЛЯЦИЯ: Осознав неизбежность краха, ${ruler.name} подписал унизительный мир с ${targetFaction.name}, выплатив огромную контрибуцию.`, "global", 5, 'war');
                    continue;
                }
            }

            // 2. АГРЕССИЯ (Только если мы сильнее или очень амбициозны)
            if (ruler.personality.cruelty > 60 && power > targetPower * 1.2 && ruler.personality.ambition > 50) {
                let warWeary = (typeof World !== 'undefined' && World.homeostasis) ? World.homeostasis.warWeariness : 0;
                if (warWeary < 50 && faction.stability > 50) {
                    ruler.currentGoal = { type: "declare_war", targetFactionId: targetF };
                    if (faction.diplomacy[targetF] !== "war") {
                        faction.diplomacy[targetF] = "war";
                        targetFaction.diplomacy[ruler.factionId] = "war";
                        generateWorldNews(`ВОЙНА: Уверенный в своем превосходстве, ${ruler.name} бросает легионы ${faction.name} на земли ${targetFaction.name}!`, "global", 5, 'war');
                    }
                }
            } 
            // 3. ИНТРИГИ (Только против равных или более сильных)
            else if (ruler.personality.paranoia > 60 && targetPower >= power) {
                let intrigueTypes = ["sabotage", "bribery"];
                if (ruler.personality.cruelty > 70) intrigueTypes.push("assassination");
                let selectedType = intrigueTypes[Math.floor(Math.random() * intrigueTypes.length)];
                ruler.currentGoal = { type: "start_intrigue", targetFactionId: targetF };
                World.intrigues.push({
                    id: "intr_" + Date.now() + Math.floor(Math.random()*1000),
                    type: selectedType, initiatorFactionId: ruler.factionId, targetFactionId: targetF,
                    targetRulerId: targetFaction.rulerId,
                    progress: 0, requiredProgress: 150, 
                    progressPerDay: Math.max(1, Math.floor(ruler.personality.paranoia / 20)),
                    discoveryChance: 3, isDiscovered: false, actors: [], gmInitiated: false, startDay: player?.stats?.turnCount || 0
                });
            } 
            // 4. ЭКОНОМИКА И СОЮЗЫ
            else if (ruler.personality.stewardship > 50 && wealth < 10000) {
                ruler.currentGoal = { type: "trade_pact", targetFactionId: targetF };
                faction.relations[targetF] += 10;
            }
        }
    }
}

function processIntrigues() {
    if (!World.intrigues) return;
    for (let i = World.intrigues.length - 1; i >= 0; i--) {
        let intr = World.intrigues[i];
        intr.progress += intr.progressPerDay;
        
        if (!intr.isDiscovered && Math.random() * 100 < intr.discoveryChance) {
            intr.isDiscovered = true;
            generateWorldNews(`СКАНДАЛ! Раскрыт заговор (${intr.type}) фракции ${World.factions[intr.initiatorFactionId]?.name} против ${World.factions[intr.targetFactionId]?.name}!`, "global", 4, 'war');
            World.factions[intr.targetFactionId].relations[intr.initiatorFactionId] -= 60;
            if(World.factions[intr.targetFactionId].relations[intr.initiatorFactionId] < -50) {
                 World.factions[intr.targetFactionId].diplomacy[intr.initiatorFactionId] = "war";
                 World.factions[intr.initiatorFactionId].diplomacy[intr.targetFactionId] = "war";
                 generateWorldNews(`ВОЙНА ИЗ-ЗА ИНТРИГ: Оскорбленная фракция ${World.factions[intr.targetFactionId].name} объявляет войну!`, "global", 5, 'war');
            }
        }

        if (intr.progress >= intr.requiredProgress) {
            if (intr.type === "assassination" && intr.targetRulerId && World.rulers[intr.targetRulerId]) {
                World.rulers[intr.targetRulerId].health = 0;
                World.rulers[intr.targetRulerId].stats.hp = 0;
                generateWorldNews(`ТЕМНЫЕ ДЕЛА: Правитель ${World.rulers[intr.targetRulerId].name} убит в результате успешного покушения!`, "global", 5, 'war');
                checkRulerDeaths();
            } else if (intr.type === "sabotage") {
                                World.factions[intr.targetFactionId].stability -= 10; // ФИКС: Снижен урон стабильности от саботажа
                generateWorldNews(`ДИВЕРСИЯ: Экономика ${World.factions[intr.targetFactionId]?.name} пострадала от саботажников.`, "global", 3, 'disaster');
            } else if (intr.type === "rebellion") {
                                World.factions[intr.targetFactionId].stability -= 20; // ФИКС: Снижен урон стабильности от мятежа
                generateWorldNews(`МЯТЕЖ: В землях ${World.factions[intr.targetFactionId]?.name} вспыхнуло восстание, спонсированное извне!`, "global", 5, 'war');
            } else if (intr.type === "bribery") {
                                World.factions[intr.targetFactionId].stability -= 5; // ФИКС: Снижен урон стабильности от подкупа
                World.factions[intr.targetFactionId].resources.manpower.amount *= 0.9;
                generateWorldNews(`КОРРУПЦИЯ: Генералы ${World.factions[intr.targetFactionId]?.name} были подкуплены. Армия деморализована.`, "global", 4, 'misc');
            } else if (intr.type === "marriage") {
                World.factions[intr.targetFactionId].relations[intr.initiatorFactionId] = 100;
                generateWorldNews(`СОЮЗ: Успешно организован династический брак между ${intr.initiatorFactionId} и ${intr.targetFactionId}!`, "global", 4, 'misc');
            }
            World.intrigues.splice(i, 1);
        }
    }
}

function checkRulerDeaths() {
    for (let rId in World.rulers) {
        let r = World.rulers[rId];
        if (r.alive && (r.health <= 0 || r.stats.hp <= 0)) {
            r.alive = false;
            if (World.npcs[rId]) World.npcs[rId].isAlive = false;
            
            if (r.heir && World.rulers[r.heir]) {
                let heir = World.rulers[r.heir];
                World.factions[r.factionId].rulerId = heir.id;
                generateWorldNews(`СМЕНА ВЛАСТИ: ${r.name} мертв. Трон занимает ${heir.name}.`, "global", 5, 'misc');
                
                let newRulerId = r.factionId + "_ruler_" + Date.now();
                heir.id = newRulerId;
                heir.aiIdentifier = newRulerId;
                heir.profession = "Правитель";
                World.rulers[newRulerId] = heir;
                World.npcs[newRulerId] = heir;
                World.factions[r.factionId].rulerId = newRulerId;
                
                let newHeirId = r.factionId + "_heir_" + Date.now();
                let newHeir = createRulerForFaction(newHeirId, World.factions[r.factionId], player?.era || 'rebirth', true);
                World.rulers[newHeirId] = newHeir;
                World.npcs[newHeirId] = newHeir;
                heir.heir = newHeirId;
                
                delete World.rulers[r.heir]; 
                delete World.npcs[r.heir];
            } else {
                generateWorldNews(`КРИЗИС: ${r.name} мертв, и наследников нет! Фракция погружается в хаос.`, "global", 5, 'disaster');
                World.factions[r.factionId].stability -= 40;
            }
        } else if (r.alive) {
            if (Math.random() < 0.02) {
                r.health -= 1;
                r.stats.hp -= 1;
            }
        }
    }
}
