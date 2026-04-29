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
// --- УТИЛИТЫ ДЛЯ РАБОТЫ С ФИЗИЧЕСКИМИ ПРЕДМЕТАМИ ---
// ======================================================================

// Возвращает общее количество предметов с данным prototype_id в контейнере
function countRealItems(containerId, prototypeId) {
    const cont = ContainerRegistry.get(containerId);
    if (!cont) return 0;
    return cont.items.reduce((sum, itemId) => {
        const item = ItemRegistry.get(itemId);
        return (item && item.prototype_id === prototypeId)
            ? sum + item.stack_size
            : sum;
    }, 0);
}

// Потребляет указанное количество предметов из контейнера,
// физически уменьшая stack_size или удаляя предметы.
// Возвращает фактически взятое количество.
function consumeRealItems(containerId, prototypeId, quantity) {
    const cont = ContainerRegistry.get(containerId);
    if (!cont) return 0;
    let remaining = quantity;
    let taken = 0;
    for (const itemId of [...cont.items]) {
        const item = ItemRegistry.get(itemId);
        if (!item || item.prototype_id !== prototypeId) continue;
        const take = Math.min(item.stack_size, remaining);
        if (take > 0) {
            WorkerInventorySystem.removeItem(itemId, take);
            remaining -= take;
            taken += take;
        }
        if (remaining <= 0) break;
    }
    return taken;
}

// Создаёт предметы в контейнере. Возвращает массив созданных ID.
function addRealItems(containerId, prototypeId, quantity, customProps = {}) {
    if (quantity <= 0) return [];
    const cont = ContainerRegistry.get(containerId);
    if (!cont) return [];
    
    let existingItemId = cont.items.find(id => {
        let it = ItemRegistry.get(id);
        return it && it.prototype_id === prototypeId;
    });
    
    if (existingItemId) {
        ItemRegistry.get(existingItemId).stack_size += quantity;
        return [existingItemId];
    } else {
        const id = WorkerInventorySystem.createItem(prototypeId, quantity, containerId, {
            ...customProps,
            name: getItemName(prototypeId, player?.era)
        });
        return [id];
    }
}

// Оценивает доступную живую силу фракции на основе оружия и еды
function availableManpower(faction) {
    let total = 0;
    for (let rid of faction.regions || []) {
        const region = World.regions[rid];
        if (!region || !region.vault_id) continue;
        // солдаты = люди, имеющие оружие и не голодающие
        const weapons = countRealItems(region.vault_id, 'weapons');
        const food = countRealItems(region.vault_id, 'bread') + countRealItems(region.vault_id, 'meat') + countRealItems(region.vault_id, 'smoked_meat');
        const population = region.population || 0;
        const possibleSoldiers = Math.min(Math.floor(population * 0.1), weapons);
        if (food < possibleSoldiers * 0.5) continue; // не хватает еды
        total += possibleSoldiers;
    }
    return Math.floor(total);
}

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
function getGoodName(good) {
    // Простая функция для получения названия товара в новостях
    const goodNames = {
        'bread': 'хлеб',
        'meat': 'мясо',
        'wheat': 'пшеница',
        'fish': 'рыба',
        'wood': 'древесина',
        'stone': 'камень',
        'iron_ore': 'железная руда',
        'gold_ore': 'золотая руда',
        'iron': 'железо',
        'weapons': 'оружие',
        'armor': 'броня',
        'herbs': 'травы',
        'potion': 'зелья',
        'clothes': 'одежда',
        'cotton': 'хлопок',
        'smoked_meat': 'копчености',
        'ale': 'эль',
        'tools': 'инструменты'
    };
    return goodNames[good] || good;
}
function getFacilityName(facId, eraId) {
    if (!eraId) eraId = 'rebirth';
    return (FACILITY_NAMES[facId] && FACILITY_NAMES[facId][eraId]) ? FACILITY_NAMES[facId][eraId] : facId;
}

let World = null;

const ItemRegistry = new Map();
const ContainerRegistry = new Map();

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function normalizeWorkerLocation(locationData = null) {
    if (typeof locationData === 'string') {
        return { world_coords: null, parent_entity: null, parent_container: null, region_id: locationData };
    }
    return {
        world_coords: Array.isArray(locationData?.world_coords) ? [...locationData.world_coords] : null,
        parent_entity: locationData?.parent_entity || null,
        parent_container: locationData?.parent_container || null,
        region_id: locationData?.region_id ?? null
    };
}

const WorkerInventorySystem = {
    createContainer: function(type, ownerId, maxWeight, maxSlots, locationData = null, extraData = {}) {
        const id = "cont_" + generateUUID();
        const container = {
            id: id,
            type: type,
            max_weight_kg: maxWeight,
            max_slots: maxSlots,
            owner_id: ownerId,
            location: normalizeWorkerLocation(locationData),
            lock_data: { is_locked: false, difficulty: 10, trap: null, ...(extraData.lock_data || {}) },
            physical_props: { health: 200, flammable: type !== 'faction_vault', ...(extraData.physical_props || {}) },
            custom_props: { ...(extraData.custom_props || {}) },
            items: []
        };
        ContainerRegistry.set(id, container);
        return id;
    },
    createItem: function(prototypeId, quantity, containerId, customProps = {}) {
        const baseWeight = prototypeId === 'gold' ? 0.01 : (customProps.weight_per_unit || 1);
        const id = "item_" + generateUUID();
        const reservedKeys = new Set(['flags', 'durability', 'slot_index', 'slot', 'state', 'created_at', 'last_moved_at']);
        const mergedCustomProps = {};
        Object.keys(customProps || {}).forEach(key => {
            if (!reservedKeys.has(key)) mergedCustomProps[key] = customProps[key];
        });
        const item = {
            id: id,
            prototype_id: prototypeId,
            stack_size: quantity,
            container_id: containerId,
            slot_index: customProps.slot_index ?? customProps.slot ?? null,
            state: customProps.state || "idle",
            flags: { quest_item: false, bound_to_owner: null, stolen: false, magical: false, fragile: false, ...(customProps.flags || {}) },
            durability: Number.isFinite(customProps.durability) ? customProps.durability : 100,
            custom_props: { weight_per_unit: baseWeight, ...mergedCustomProps },
            created_at: customProps.created_at ?? 0,
            last_moved_at: customProps.last_moved_at ?? 0
        };
        ItemRegistry.set(id, item);
        if (containerId && ContainerRegistry.has(containerId)) ContainerRegistry.get(containerId).items.push(id);
        return id;
    },
    removeItem: function(itemId, quantity) {
        if (!ItemRegistry.has(itemId)) return false;
        const item = ItemRegistry.get(itemId);
        if (item.stack_size <= quantity) {
            if (item.container_id && ContainerRegistry.has(item.container_id)) {
                const cont = ContainerRegistry.get(item.container_id);
                if (cont) cont.items = cont.items.filter(id => id !== itemId);
            }
            ItemRegistry.delete(itemId);
        } else {
            item.stack_size -= quantity;
        }
        return true;
    },
    moveItem: function(itemId, targetContainerId) {
        const item = ItemRegistry.get(itemId);
        const targetCont = ContainerRegistry.get(targetContainerId);
        if (!item || !targetCont) return false;
        if (item.container_id && ContainerRegistry.has(item.container_id)) {
            const sourceCont = ContainerRegistry.get(item.container_id);
            if (sourceCont) sourceCont.items = sourceCont.items.filter(id => id !== itemId);
        }
        targetCont.items.push(itemId);
        item.container_id = targetContainerId;
        return true;
    },
    getItemsByContainerId: function(containerId) {
        const cont = ContainerRegistry.get(containerId);
        if (!cont) return [];
        return cont.items.map(id => ItemRegistry.get(id)).filter(Boolean).map(item => ({
            id: item.id,
            item_id: item.prototype_id,
            quantity: item.stack_size,
            meta: item.custom_props
        }));
    }
};;

// Функции синхронизации удалены - теперь используются только физические предметы
// Все ресурсы хранятся исключительно в контейнерах как физические items

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

    // Синхронизация удалена - используются только физические предметы
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
                // Синхронизация удалена - используются только физические предметы
                resolve();
            }
        }
        simulateChunk();
    });
}


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

    return {
        id: id,
        name: name,
        factionId: faction.id || id.replace("_heir", ""),
        type: "ruler",
        stats: { hp: 80, maxHp: 80, str: 10, dex: 10, int: 14, con: 12, cha: 16, res: 10 },
        personality: {
            ambition: Math.floor(Math.random() * 40) + 40,
            paranoia: Math.floor(Math.random() * 40) + 30,
            wisdom: baseWisdom + Math.floor(Math.random() * 20) - 10,
            cruelty: baseCruelty + Math.floor(Math.random() * 20) - 10,
            diplomacy: baseDiplomacy + Math.floor(Math.random() * 20) - 10,
            military: baseMilitary + Math.floor(Math.random() * 20) - 10,
            stewardship: 50 + Math.floor(Math.random() * 40)
        },
        traits: ["Амбициозный", "Хитрый"],
        health: 100,
        alive: true,
        heir: isHeir ? null : id + "_heir",
        currentGoal: null,
        gmOverride: null,
        lastTickDay: 0
    };
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
        fConfig = { "orthodoxy": { name: "Ортодоксия Решетки", g: [80000, 120000], f: [20000, 30000], m: [15000, 25000] }, "syndicate": { name: "Синдикат Экспансии", g: [100000, 150000], f: [10000, 15000], m: [10000, 20000] }, "greencode": { name: "Фракция Зеленого Кода", g: [20000, 40000], f: [50000, 80000], m: [5000, 10000] }, "ascendancy": { name: "Культ Перехода", g: [30000, 50000], f: [5000, 10000], m: [8000, 15000] }, "apostates": { name: "Апостаты Пустоты", g: [10000, 20000], f: [2000, 5000], m: [20000, 30000] } };
        locMap = { "nexus_prime": "orthodoxy", "solar_citadel": "orthodoxy", "obsidian_wall": "orthodoxy", "sky_harbor": "syndicate", "silver_conduits": "syndicate", "whispering_gardens": "greencode", "aethel_spires": "greencode", "genesis_craters": "greencode", "arcanum_archive": "ascendancy", "crystal_matrix": "ascendancy", "bio_forge": "ascendancy", "void_bastion": "apostates", "resonance_pits": "syndicate", "deep_sea_obs": "orthodoxy" };
    } else if (currentEra === 'silence') {
        fConfig = { "iron_remnant": { name: "Железный Остаток", g: [5000, 10000], f: [2000, 5000], m: [8000, 12000] }, "flesh_cult": { name: "Культ Плоти", g: [1000, 3000], f: [8000, 15000], m: [10000, 20000] }, "heralds": { name: "Вестники Безмолвия", g: [0, 1000], f: [1000, 2000], m: [15000, 25000] }, "logic_purge": { name: "Орден Логической Чистки", g: [20000, 30000], f: [0, 0], m: [5000, 10000] }, "scavengers": { name: "Падальщики Нексуса", g: [10000, 20000], f: [3000, 6000], m: [4000, 8000] } };
        locMap = { "iron_remnant_base": "iron_remnant", "rusting_spires": "iron_remnant", "flesh_craft_pits": "flesh_cult", "bone_fields": "flesh_cult", "forgotten_obs": "heralds", "muted_valley": "heralds", "deep_vault_7": "logic_purge", "crystal_wastes": "logic_purge", "scrap_canyon": "scavengers", "aquilon_ruins": "scavengers", "sunken_haven": "scavengers", "ash_desert": "scavengers", "silent_forest": "flesh_cult", "dead_lake": "flesh_cult", "whispering_dunes": "scavengers" };
    } else if (currentEra === 'sundering') {
        fConfig = { "survivors": { name: "Выжившие Аквилона", g: [5000, 10000], f: [2000, 4000], m: [3000, 6000] }, "mutants": { name: "Улей Мутантов", g: [0, 0], f: [10000, 20000], m: [20000, 40000] }, "storm_cult": { name: "Культ Эфирного Шторма", g: [2000, 5000], f: [1000, 3000], m: [8000, 15000] }, "mad_constructs": { name: "Безумные Конструкты", g: [10000, 20000], f: [0, 0], m: [10000, 15000] } };
        locMap = { "falling_aquilon": "survivors", "ruined_sky_harbor": "survivors", "ashen_coast": "survivors", "mutant_hive": "mutants", "flesh_labyrinth": "mutants", "burning_forest": "mutants", "expanding_scar": "storm_cult", "storms_eye": "storm_cult", "bleeding_earth": "storm_cult", "glass_desert": "mad_constructs", "sunken_arcanum": "mad_constructs", "chasm_of_screams": "mad_constructs", "shattered_peaks": "survivors", "void_wastes": "storm_cult", "boiling_sea": "mutants" };
    } else {
        fConfig = { "aquilon": { name: "Аквилонская Директория", g: [30000, 50000], f: [20000, 30000], m: [15000, 25000] }, "khazadrim": { name: "Кхазадримский Конклав", g: [40000, 60000], f: [8000, 15000], m: [10000, 15000] }, "sylvanesti": { name: "Сильванестийский Симбиоз", g: [5000, 10000], f: [40000, 60000], m: [5000, 8000] }, "gronnar": { name: "Гроннарская Орда", g: [2000, 5000], f: [10000, 15000], m: [20000, 30000] }, "consortium": { name: "Свободные Торговцы", g: [80000, 150000], f: [15000, 25000], m: [5000, 10000] }, "crimson": { name: "Орден Багрового Пламени", g: [15000, 25000], f: [10000, 15000], m: [8000, 12000] } };
        locMap = { "capital_aquilon": "aquilon", "ruins_arcanum": "aquilon", "thunder_citadel": "khazadrim", "crystal_caves": "khazadrim", "dragon_spine_mountains": "khazadrim", "whispering_woods": "sylvanesti", "floating_islands_of_aethel": "sylvanesti", "nomad_lands_ash_plains": "gronnar", "the_scarred_wastes": "gronnar", "the_shifting_sands_of_khem": "gronnar", "silver_haven": "consortium", "sunken_city_of_aeridor": "consortium", "sanctum_of_whispers": "crimson", "ether_scar_chasm": "crimson", "forgotten_observatory": "crimson" };
    }

    for (let fId in fConfig) {
        let bf = fConfig[fId];
        newWorld.factions[fId] = {
            name: bf.name,
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

        let pop = 5000 + Math.floor(Math.random() * 45000);
        let regionMarkets = {};
        
        // Сначала создаем склад региона
        const vaultId = WorkerInventorySystem.createContainer("faction_vault", ownerId, 999999, 1000, { region_id: key }, {
            lock_data: { is_locked: true, difficulty: 16, trap: null },
            physical_props: { health: 400, flammable: false },
            custom_props: { required_rank: 1 }
        });
        
        // Динамическая инициализация ВСЕХ ресурсов из базы как физические предметы
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
            
            // Создаем физические предметы на складе
            addRealItems(vaultId, resKey, baseAmount);
            
            regionMarkets[resKey] = ECONOMY_ITEMS[resKey].basePrice;
        }

        newWorld.regions[key] = {
            name: loc.name, owner: ownerId, climate: "temperate",
            vault_id: vaultId,
            population: pop,
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
                inventory_id: WorkerInventorySystem.createContainer("npc_inventory", id, 100, 30, { parent_entity: id }),
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
    // Синхронизация удалена - используются только физические предметы
    
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
    // Синхронизация удалена - используются только физические предметы
}

function simulateOneHour() {
    let currentHour = player && player.gameTime ? player.gameTime.hour : 12;
    let currentDay = player && player.gameTime ? player.gameTime.day : 1;

    for (let id in World.npcs) {
        let npc = World.npcs[id];
        if (!npc.isAlive || npc.type === 'ruler') continue;

        let currentRegion = World.regions[npc.currentLocation];
        if (!currentRegion) continue;

        if (typeof npc.hp === 'undefined') npc.hp = 20;

        npc.needs.hunger -= (1 + Math.floor(Math.random() * 2));
        npc.needs.rest -= (2 + Math.floor(Math.random() * 2));
        npc.needs.social -= 1;

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

        let actionTaken = false;
        let foodPrice = currentRegion.markets.bread || 5;

        if (npc.needs.hunger < 25) {
            npc.currentActivity = "Ищет еду";
            // Фоновая торговля NPC: Покупка еды из физических запасов региона
            const breadAvailable = countRealItems(currentRegion.vault_id, 'bread');
            if (npc.inventory.gold >= foodPrice && breadAvailable > 0) {
                npc.inventory.gold -= foodPrice;
                consumeRealItems(currentRegion.vault_id, 'bread', 1);
                currentRegion.moneySupply += foodPrice;
                npc.needs.hunger = 100;
                npc.currentActivity = "Ест";
                
                // Физическое перемещение предмета в инвентарь NPC (если он есть)
                if (npc.inventory_id) {
                    WorkerInventorySystem.createItem('bread', 1, npc.inventory_id, { name: "Хлеб" });
                }
            } else {
                if (npc.personality.greed > 60 || npc.personality.aggression > 50) {
                    npc.currentActivity = "Ворует еду";
                    npc.needs.hunger += 40;
                } else {
                    npc.currentActivity = "Голодает";
                }
            }
            actionTaken = true;
        } else if (npc.needs.rest < 20) {
            npc.currentActivity = "Спит";
            npc.needs.rest += 50;
            actionTaken = true;
        }

        if (!actionTaken) {
            let currentSchedule = npc.schedule.find(s => currentHour >= s.start && currentHour <= s.end);
            if (currentSchedule) {
                npc.currentActivity = currentSchedule.activity;
                if (npc.currentActivity === "Работает") {
                    npc.needs.rest -= 2;
                    if (npc.profession === "Торговец") {
                        npc.inventory.gold += Math.floor(Math.random() * 15) + 5;
                        // Фоновая торговля NPC: Закупка товаров на рынке
                        if (Math.random() < 0.1 && npc.inventory_id) {
                            let good = Object.keys(currentRegion.markets)[Math.floor(Math.random() * Object.keys(currentRegion.markets).length)];
                            let price = currentRegion.markets[good];
                            const available = countRealItems(currentRegion.vault_id, good);
                            if (npc.inventory.gold >= price && available > 0) {
                                npc.inventory.gold -= price;
                                consumeRealItems(currentRegion.vault_id, good, 1);
                                WorkerInventorySystem.createItem(good, 1, npc.inventory_id, { name: getItemName(good, player?.era) });
                            }
                        }
                    } else {
                        let wage = Math.max(1, Math.floor((currentRegion.moneySupply / (currentRegion.population || 1)) * npc.economy.skillLevel * 0.5));
                        npc.inventory.gold += wage;
                    }
                }
            }
        }

        npc.needs.hunger = Math.max(0, Math.min(100, npc.needs.hunger));
        npc.needs.rest = Math.max(0, Math.min(100, npc.needs.rest));
        npc.needs.social = Math.max(0, Math.min(100, npc.needs.social));
        
        if (npc.needs.hunger === 0 || npc.hp <= 0) {
            npc.isAlive = false;
            npc.currentActivity = npc.needs.hunger === 0 ? "Мертв (Голод)" : "Мертв (Убит)";
        }
    }

    for (let rId in World.regions) {
        let region = World.regions[rId];
        for (let i = region.caravans.length - 1; i >= 0; i--) {
            let caravan = region.caravans[i];
            caravan.hoursLeft--;
            if (caravan.hoursLeft <= 0) {
                let destRegion = World.regions[caravan.destination];
                if (destRegion && caravan.chest_id) {
                    // Перемещаем предметы из контейнера каравана в склад получателя
                    const chest = ContainerRegistry.get(caravan.chest_id);
                    if (chest) {
                        let totalRevenue = 0;
                        for (const itemId of [...chest.items]) {
                            const item = ItemRegistry.get(itemId);
                            if (!item) continue;
                            // Перемещаем предмет в новый контейнер
                            WorkerInventorySystem.moveItem(itemId, destRegion.vault_id);
                            const revenue = item.stack_size * (destRegion.markets[item.prototype_id] || 1);
                            totalRevenue += revenue;
                        }
                        // Удаляем контейнер каравана
                        ContainerRegistry.delete(caravan.chest_id);
                        
                        let goodsList = Object.entries(caravan.goods).map(([g, a]) => `${a} ${getGoodName(g)}`).join(', ');
                        generateWorldNews(
                            `ЭКОНОМИКА: Караван из ${region.name} прибыл в ${destRegion.name}! Доставлено: ${goodsList}. Выручка: ${Math.floor(totalRevenue)} золотых.`,
                            destRegion.name, 2, 'trade'
                        );
                    }
                }
                region.caravans.splice(i, 1);
            }
        }
    }
}

function simulateOneDay() {
    if (!IS_PRE_SIMULATING) console.log("[WorldSim] Симуляция нового дня (Глубокая причинно-следственная связь)...");
    if (World && !IS_PRE_SIMULATING) World.needsGlobalEvent = true;

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
        let totalFood = countRealItems(r.vault_id, 'bread') + countRealItems(r.vault_id, 'meat') + countRealItems(r.vault_id, 'fish') + countRealItems(r.vault_id, 'smoked_meat');
        let foodPerCapita = totalFood / (r.population || 1);
        
        // Эпидемия: Высокий шанс, если много людей и мало еды (антисанитария и голод)
        if (r.population > 20000 && foodPerCapita < 0.5 && Math.random() < 0.05) {
            let deaths = Math.floor(r.population * (0.1 + Math.random() * 0.1));
            r.population -= deaths;
            generateWorldNews(`Вспышка чумы в ${r.name}! Голод и скученность привели к эпидемии. Погибло ${deaths} человек.`, rId, 5, 'disaster');
        }
        
        // Засуха/Пожар: Только летом или в жару
        if ((season === "summer" || World.weather[rId] === "Жара") && Math.random() < 0.02) {
            // Уничтожаем физические предметы пшеницы и древесины (80% и 70% соответственно)
            const wheatAmount = countRealItems(r.vault_id, 'wheat');
            const woodAmount = countRealItems(r.vault_id, 'wood');
            consumeRealItems(r.vault_id, 'wheat', Math.floor(wheatAmount * 0.8));
            consumeRealItems(r.vault_id, 'wood', Math.floor(woodAmount * 0.7));
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

        // Налоги (золото теперь физический предмет)
        let faction = World.factions[r.owner];
        if (faction) {
            let taxRevenue = Math.floor(r.moneySupply * 0.02);
            r.moneySupply -= taxRevenue;
            addRealItems(r.vault_id, 'gold', taxRevenue);
        }
        
        let weatherMod = (World.weather[rId] === "Ясно") ? 1.2 : (World.weather[rId] === "Гроза" || World.weather[rId] === "Снег" || World.weather[rId] === "Метель") ? 0.5 : 1.0;
        let workersPerSector = activeWorkers / Object.keys(r.facilities).length;

        // Добыча сырья (создание физических предметов)
        let fert = (World && World.homeostasis) ? World.homeostasis.fertility : 1.0;
        let currentEra = (typeof player !== 'undefined' && player && player.era) ? player.era : 'rebirth';
        let facFarms = getFacilityName('farms', currentEra);
        let facLumb = getFacilityName('lumbermills', currentEra);
        let facMines = getFacilityName('mines', currentEra);

        if(r.facilities.farms) {
            addRealItems(r.vault_id, 'wheat', Math.floor(workersPerSector * (r.facilities.farms.level / 5) * 5 * weatherMod * fert));
            addRealItems(r.vault_id, 'cotton', Math.floor(workersPerSector * (r.facilities.farms.level / 15) * weatherMod * fert));
            addRealItems(r.vault_id, 'herbs', Math.floor(workersPerSector * (r.facilities.farms.level / 20) * weatherMod * fert));
        }
        if(r.facilities.lumbermills) {
            addRealItems(r.vault_id, 'wood', Math.floor(workersPerSector * (r.facilities.lumbermills.level / 10) * weatherMod));
        }
        if(r.facilities.mines) {
            addRealItems(r.vault_id, 'iron_ore', Math.floor(workersPerSector * (r.facilities.mines.level / 10)));
            addRealItems(r.vault_id, 'gold_ore', Math.floor(workersPerSector * (r.facilities.mines.level / 30)));
        }

        // Износ и ремонт
        for (let fId in r.facilities) {
            let fac = r.facilities[fId];
            if (fac.level > 0) {
                fac.durability -= 1;
                if (fac.durability < 0) fac.durability = 0;
                if (fac.durability < 20) fac.level = Math.floor(fac.level * 0.5);
                
                if (fac.durability < 50) {
                    const woodAvailable = countRealItems(r.vault_id, 'wood');
                    if (woodAvailable >= 5) {
                        fac.durability += 20;
                        consumeRealItems(r.vault_id, 'wood', 5);
                    }
                }
            }
        }

        // Крафт по рецептам (физические предметы)
        for (let recipe of CRAFTING_RECIPES) {
            let fac = r.facilities[recipe.facility];
            if (!fac || fac.level <= 0) continue;

            let capacity = Math.floor(workersPerSector * (fac.level / 5));
            if (capacity <= 0) continue;

            let maxCrafts = capacity;

            // Проверяем доступность физических ингредиентов
            for (let inRes in recipe.inputs) {
                let available = countRealItems(r.vault_id, inRes);
                let requiredPerCraft = recipe.inputs[inRes];
                let possibleCrafts = Math.floor(available / requiredPerCraft);
                if (possibleCrafts < maxCrafts) maxCrafts = possibleCrafts;
            }

            if (maxCrafts > 0) {
                // Потребляем физические ингредиенты
                for (let inRes in recipe.inputs) {
                    consumeRealItems(r.vault_id, inRes, maxCrafts * recipe.inputs[inRes]);
                }

                // Создаем физические продукты
                for (let outRes in recipe.outputs) {
                    let produced = maxCrafts * recipe.outputs[outRes];
                    addRealItems(r.vault_id, outRes, produced);
                }
            }
        }

        // Потребление населением (физические предметы)
        let fertCons = (World && World.homeostasis) ? World.homeostasis.fertility : 1.0;
        let foodConsumed = Math.floor((r.population * 0.02) / fertCons);
        let clothConsumed = Math.floor(r.population * 0.002);
        
        let foodTypes = ['bread', 'meat', 'fish', 'smoked_meat'];
        for(let fType of foodTypes) {
            if(foodConsumed <= 0) break;
            const available = countRealItems(r.vault_id, fType);
            if (available > 0) {
                const eaten = consumeRealItems(r.vault_id, fType, foodConsumed);
                foodConsumed -= eaten;
            }
        }

        const clothesAvailable = countRealItems(r.vault_id, 'clothes');
        if (clothesAvailable > 0) {
            consumeRealItems(r.vault_id, 'clothes', clothConsumed);
        }

        // --- ПРИМЕНЕНИЕ ПОРЧИ И ГНИЕНИЯ (В КОНЦЕ ДНЯ) ---
        // processSpoilage(r.resources, currentDay, World.weather[rId]); // Отключаем для физической модели

                // ДЕМОГРАФИЯ И ВОССТАНОВЛЕНИЕ
        const breadAvailable = countRealItems(r.vault_id, 'bread');
        let foodPerCapitaAfter = breadAvailable / (r.population || 1);
        if (foodPerCapitaAfter > 0.5 && employmentRate > 0.6) {
            // В мирное и сытое время население растет
            let growth = Math.floor(r.population * 0.0005);
            r.population += growth;
        }


// Голод и Бунты (Причина: нет еды или работы)
        if (foodConsumed > 0) {
            let deaths = Math.floor(foodConsumed * 2);
            r.population -= deaths;
            // Вместо штрафа стабильности - физическое последствие: бунт может уничтожить ресурсы
            if (Math.random() < 0.3) generateWorldNews(`Голод в ${r.name}! Нехватка продовольствия унесла ${deaths} жизней.`, rId, 4, 'disaster');
        }

        if (employmentRate < 0.4 && Math.random() < 0.1) {
            generateWorldNews(`Голодные бунты в ${r.name}! Безработные громят склады и кузницы.`, rId, 4, 'disaster');
            const weaponsAvailable = countRealItems(r.vault_id, 'weapons');
            consumeRealItems(r.vault_id, 'weapons', Math.min(100, weaponsAvailable));
            if(r.facilities.forges) r.facilities.forges.durability -= 30;
        }

        // Ценообразование на основе физических запасов
        for (let good in ECONOMY_ITEMS) {
            let supply = countRealItems(r.vault_id, good);
            if (supply < 1) supply = 1;
            let demand = r.population * 0.001;
            for(let recipe of CRAFTING_RECIPES) {
                if(recipe.inputs[good]) demand += (r.facilities[recipe.facility]?.level || 0) * 50;
            }
            if(good === 'bread' || good === 'meat') demand += r.population * 0.02;
            if (demand < 1) demand = 1;
            
            let priceMod = Math.max(0.2, Math.min(5.0, demand / supply));
            r.markets[good] = Math.max(1, Math.floor(ECONOMY_ITEMS[good].basePrice * priceMod));
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
            // NPC покупают еду только если есть физические запасы на складе региона
            const breadAvailable = countRealItems(r.vault_id, 'bread');
            if (npc.economy.savings >= foodPrice && breadAvailable > 0) {
                npc.economy.savings -= foodPrice;
                consumeRealItems(r.vault_id, 'bread', 1);
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
                
                // Если в стране хаос (мало оружия и еды), купцы боятся собирать караваны
                let originFaction = World.factions[r.owner];
                const originVault = r.vault_id;
                const originWeapons = originVault ? countRealItems(originVault, 'weapons') : 0;
                const originFood = originVault ? (countRealItems(originVault, 'bread') + countRealItems(originVault, 'meat')) : 0;
                if (originFaction && (originWeapons < 50 || originFood < 100)) continue;

                // Караваны не едут во вражеские города (Эмбарго)
                if (originFaction && originFaction.diplomacy[dest.owner] === 'war') continue;

                // Запрет на экспорт стратегических ресурсов при их нехватке
                if (['bread', 'meat', 'wheat'].includes(good)) {
                    let dailyConsumption = r.population * 0.02;
                    const available = countRealItems(r.vault_id, good);
                    if (available < dailyConsumption * 5) continue;
                }
                if (good === 'weapons') {
                    const available = countRealItems(r.vault_id, 'weapons');
                    if (available < 300) continue;
                }

                let profitMargin = dest.markets[good] - localPrice;
                const supply = countRealItems(r.vault_id, good);
                if (profitMargin > localPrice * 0.3 && supply > 50) {
                    if (profitMargin > maxProfit) {
                        maxProfit = profitMargin;
                        bestDest = destId;
                    }
                }
            }

            if (bestDest) {
                let destRegion = World.regions[bestDest];
                const supply = countRealItems(r.vault_id, good);
                let amount = Math.floor(supply * 0.2);
                let cost = amount * localPrice;

                if (amount > 0) {
                    // Создаем контейнер каравана и помещаем в него физические предметы
                    const caravanChestId = WorkerInventorySystem.createContainer(
                        "caravan_chest",
                        r.owner,
                        999999,
                        1000,
                        { region_id: rId },
                        {
                            lock_data: { is_locked: false, difficulty: 10 },
                            physical_props: { health: 100, flammable: true }
                        }
                    );
                    
                    // Потребляем физические предметы из склада региона и создаем их в контейнере каравана
                    const taken = consumeRealItems(r.vault_id, good, amount);
                    addRealItems(caravanChestId, good, taken);
                    
                    r.moneySupply += cost;
                    r.caravans.push({
                        id: "caravan_" + Date.now() + Math.floor(Math.random()*1000),
                        origin: rId, destination: bestDest, 
                        goods: { [good]: taken },
                        chest_id: caravanChestId,
                        buyPrice: localPrice, investment: cost, hoursLeft: 24 + Math.floor(Math.random() * 48)
                    });
                    
                    // НОВОСТЬ: Отправка каравана (только для значимых партий)
                    if (taken >= 100 && Math.random() < 0.4) {
                        generateWorldNews(
                            `ЭКОНОМИКА: Из ${r.name} в ${destRegion.name} отправлен караван с ${taken} ед. ${getGoodName(good)}. Ожидаемая прибыль: ${Math.floor(taken * (destRegion.markets[good] - localPrice))} золотых.`,
                            rId, 2, 'trade'
                        );
                    }
                }
            }
        }
    }

    // === 5. ГЕОПОЛИТИКА: ПРИЧИННО-СЛЕДСТВЕННАЯ ДИПЛОМАТИЯ ===
    let fKeys = Object.keys(World.factions);
    
    // === НОВОСТИ: Изменения цен на рынках (значимые скачки) ===
    for (let rId of rKeys) {
        let r = World.regions[rId];
        if (!r.prevMarketPrices) r.prevMarketPrices = {};
        
        for (let good in ECONOMY_ITEMS) {
            let currentPrice = r.markets[good] || 1;
            let prevPrice = r.prevMarketPrices[good] || currentPrice;
            
            // Если цена изменилась более чем на 30% - это новость
            if (prevPrice > 0 && Math.abs(currentPrice - prevPrice) / prevPrice > 0.3) {
                let trend = currentPrice > prevPrice ? 'выросли' : 'упали';
                let changePercent = Math.floor(Math.abs(currentPrice - prevPrice) / prevPrice * 100);
                
                if (Math.random() < 0.25) { // Шанс новости 25% чтобы не спамить
                    generateWorldNews(
                        `ЭКОНОМИКА: Цены на ${getGoodName(good)} в ${r.name} ${trend} на ${changePercent}% (${prevPrice}→${currentPrice}).`,
                        rId, 1, 'trade'
                    );
                }
            }
            r.prevMarketPrices[good] = currentPrice;
        }
    }
    
    // Подсчет глобальных ресурсов фракций для логики
    for (let fId of fKeys) {
        let f = World.factions[fId];
        f.globalFood = 0; f.globalWeapons = 0; f.totalPopulation = 0;
        let regionCount = 0;
        for (let rId of rKeys) {
            if (World.regions[rId].owner === fId) {
                let r = World.regions[rId];
                // Считаем ВСЮ еду через физические предметы на складе региона
                f.globalFood += countRealItems(r.vault_id, 'bread') + countRealItems(r.vault_id, 'meat') 
                              + countRealItems(r.vault_id, 'fish') + countRealItems(r.vault_id, 'wheat');
                f.globalWeapons += countRealItems(r.vault_id, 'weapons');
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
        // В физической модели золото лежит на складах, а не в абстрактном поле
        
        // Считаем общее золото фракции (сумма по всем регионам)
        let totalGold = 0;
        for (let rId of f.regions || []) {
            const region = World.regions[rId];
            if (region && region.vault_id) {
                totalGold += countRealItems(region.vault_id, 'gold');
            }
        }
        
        // Пассивный доход - добавляем физическое золото в столичный регион
        const capitalRegionId = Object.keys(World.regions).find(rid => World.regions[rid].owner === fId);
        if (capitalRegionId) {
            const passiveIncome = f.regionCount * 500;
            addRealItems(World.regions[capitalRegionId].vault_id, 'gold', passiveIncome);
        }

        // Расходы на армию и государство (уничтожаем золото пропорционально расходам)
        let armyUpkeep = Math.floor(f.globalWeapons * 0.5); // Содержание зависит от количества оружия
        let stateUpkeep = f.regionCount * 100;
        let totalExpenses = armyUpkeep + stateUpkeep;

        // Уничтожаем золото на сумму расходов (пропорционально распределенное по регионам)
        let goldToRemove = totalExpenses;
        for (let rId of f.regions || []) {
            if (goldToRemove <= 0) break;
            const region = World.regions[rId];
            if (region && region.vault_id) {
                const regionGold = countRealItems(region.vault_id, 'gold');
                const toRemove = Math.min(regionGold, goldToRemove);
                if (toRemove > 0) {
                    consumeRealItems(region.vault_id, 'gold', toRemove);
                    goldToRemove -= toRemove;
                }
            }
        }
        
        // Если золота не хватило на расходы - дезертирство (потеря оружия)
        if (goldToRemove > 0) {
            for (let rId of f.regions || []) {
                if (goldToRemove <= 0) break;
                const region = World.regions[rId];
                if (region && region.vault_id) {
                    const weaponsAvailable = countRealItems(region.vault_id, 'weapons');
                    const toRemove = Math.min(weaponsAvailable, Math.floor(goldToRemove / 10)); // 1 оружие = 10 золота
                    if (toRemove > 0) {
                        consumeRealItems(region.vault_id, 'weapons', toRemove);
                        goldToRemove -= toRemove * 10;
                    }
                }
            }
        }

        // 2. ЛИМИТ АРМИИ: Нельзя бесконечно копить войска
        // Живая сила вычисляется динамически через availableManpower()
        
        // 3. Проверка на голод (физические последствия)
        let foodPerCapita = f.globalFood / (f.totalPopulation || 1);
        if (foodPerCapita < 0.2) {
            // Голод приводит к смертям населения в регионах
            for (let rId of f.regions || []) {
                const region = World.regions[rId];
                if (region && region.population) {
                    const deaths = Math.floor(region.population * 0.001);
                    region.population -= deaths;
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
            const targetManpower = availableManpower(targetFaction);
            const myManpower = availableManpower(f);
            if (targetManpower > myManpower * 3) change -= 2;
            // Торговля сближает: Если у обеих фракций много ресурсов -> отношения теплеют
            const myGold = countRealItems(Object.keys(World.regions).find(rid => World.regions[rid].owner === fId)?.vault_id || null, 'gold');
            const targetGold = countRealItems(Object.keys(World.regions).find(rid => World.regions[rid].owner === targetF)?.vault_id || null, 'gold');
            if (myGold > 5000 && targetGold > 5000) change += 2;
            
            if (currentStatus === "war") change -= 5;
            
            f.relations[targetF] = Math.max(-100, Math.min(100, rel + change));
            rel = f.relations[targetF];

                        // ОБЪЯВЛЕНИЕ ВОЙНЫ (С УЧЕТОМ ВОЕННОЙ УСТАЛОСТИ МИРА)
                        let canFight = f.globalWeapons > 100 && myManpower > 2000; // ФИКС: Снижен порог для начала войны
            let warWeariness = (World && World.homeostasis) ? World.homeostasis.warWeariness : 0;
            let warThreshold = Math.random() * 100;
            if (rel < -80 && currentStatus !== "war" && canFight && f.globalFood > 1000 && warWeariness < warThreshold) {
                f.diplomacy[targetF] = "war";
                targetFaction.diplomacy[fId] = "war";
                let reason = f.globalFood < 2000 ? "из-за острой нехватки продовольствия (война за выживание)" : "из-за давней кровной вражды";
                generateWorldNews(`Фракция ${f.name} объявляет войну ${targetFaction.name} ${reason}!`, "global", 5, 'war');
            }
            // ЗАКЛЮЧЕНИЕ МИРА (С УЧЕТОМ ВОЕННОЙ УСТАЛОСТИ МИРА)
            else if (currentStatus === "war") {
                // Мир заключается, если армия истощена, или война идет слишком долго (включая мировую усталость)
                let peaceChance = 0.03 + (((World && World.homeostasis) ? World.homeostasis.warWeariness : 0) / 1000);
                                // ФИКС: Войны длятся дольше. Мир заключается только при полном истощении
                if ((myManpower < 500 && targetManpower < 500) || Math.random() < (peaceChance * 0.1)) {
                    f.diplomacy[targetF] = "neutral";
                    targetFaction.diplomacy[fId] = "neutral";
                    // Принудительный сброс отношений в нейтралитет, чтобы не начать войну завтра же
                    f.relations[targetF] = 0;
                    targetFaction.relations[fId] = 0;
                    generateWorldNews(`Истощенные затяжным конфликтом, ${f.name} и ${targetFaction.name} подписали мирный договор.`, "global", 5, 'war');
                }
            }
            // ЗАКЛЮЧЕНИЕ МИРА (Если истощены)
            else if (rel > -20 && currentStatus === "war" && (f.globalWeapons < 100 || myManpower < 100)) {
                f.diplomacy[targetF] = "neutral";
                targetFaction.diplomacy[fId] = "neutral";
                generateWorldNews(`Истощенные войной, ${f.name} и ${targetFaction.name} подписали мирный договор.`, "global", 5, 'war');
            }
        }

        // === 6. ВОЕННАЯ ЛОГИСТИКА И ОСАДЫ ===
        let atWarWith = Object.keys(f.diplomacy).find(k => f.diplomacy[k] === "war");
        
                if (atWarWith) {
            // Ищем регион, где есть хотя бы базовое количество оружия
                        let homeRegionId = Object.keys(World.regions).find(r => {
                            const region = World.regions[r];
                            if (region.owner !== fId || !region.vault_id) return false;
                            const weapons = countRealItems(region.vault_id, 'weapons');
                            return weapons > 10;
                        });
            
            // Армия собирается, если есть доступная живая сила
            const availableMP = availableManpower(f);
                        if (homeRegionId && availableMP > 500) {
                let homeRegion = World.regions[homeRegionId];
                let targetRegionId = Object.keys(World.regions).find(r => World.regions[r].owner === atWarWith);
                
                let alreadyAttacking = f.armies.some(a => a.destination === targetRegionId);
                
                if (targetRegionId && !alreadyAttacking) {
                    // Динамический размер армии: от 15% до 35% доступной живой силы
                    let armySize = Math.floor(availableMP * (0.15 + Math.random() * 0.20));
                    if (armySize < 100) armySize = availableMP;

                    // Логистика: берем оружие и еду из склада региона
                    const weaponsAvailable = countRealItems(homeRegion.vault_id, 'weapons');
                    const foodAvailable = countRealItems(homeRegion.vault_id, 'bread') + countRealItems(homeRegion.vault_id, 'meat');
                    
                    let weaponsToTake = Math.min(armySize, weaponsAvailable);
                    let foodToTake = Math.min(armySize * 2, foodAvailable);
                    
                    consumeRealItems(homeRegion.vault_id, 'weapons', weaponsToTake);
                    consumeRealItems(homeRegion.vault_id, 'bread', Math.floor(foodToTake * 0.7));
                    consumeRealItems(homeRegion.vault_id, 'meat', Math.floor(foodToTake * 0.3));
                    
                    // Создаем контейнер армии для припасов
                    const armyChestId = WorkerInventorySystem.createContainer(
                        "army_supply_chest",
                        fId,
                        999999,
                        1000,
                        { region_id: homeRegionId },
                        {
                            lock_data: { is_locked: false, difficulty: 10 },
                            physical_props: { health: 200, flammable: true }
                        }
                    );
                    
                    // Перемещаем еду в контейнер армии
                    const breadTaken = consumeRealItems(homeRegion.vault_id, 'bread', Math.floor(foodToTake * 0.7));
                    const meatTaken = consumeRealItems(homeRegion.vault_id, 'meat', Math.floor(foodToTake * 0.3));
                    addRealItems(armyChestId, 'bread', breadTaken);
                    addRealItems(armyChestId, 'meat', meatTaken);
                    
                    // Расчет морали в зависимости от обеспечения
                    let armyMorale = 100;
                    if (weaponsToTake < armySize * 0.5) armyMorale -= 25; // Плохо вооружены
                    if (foodToTake < armySize) armyMorale -= 25; // Голодные
                    
                    let armyId = "army_" + Date.now() + Math.floor(Math.random()*1000);
                    f.armies.push({ 
                        id: armyId, 
                        size: armySize, 
                        morale: armyMorale, 
                        location: homeRegionId, 
                        destination: targetRegionId, 
                        daysToMove: 3, 
                        siegeDays: -1,
                        supply_chest_id: armyChestId,
                        weapons_count: weaponsToTake
                    });
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
                    // Потребление еды армией осаждающих из контейнера припасов
                    if (army.supply_chest_id) {
                        const supplyChest = ContainerRegistry.get(army.supply_chest_id);
                        if (supplyChest) {
                            const armyBread = countRealItems(army.supply_chest_id, 'bread');
                            const armyMeat = countRealItems(army.supply_chest_id, 'meat');
                            const dailyNeed = Math.floor(army.size * 0.5);
                            let consumed = 0;
                            if (armyBread > 0) {
                                consumed += consumeRealItems(army.supply_chest_id, 'bread', Math.min(dailyNeed, armyBread));
                            }
                            if (consumed < dailyNeed && armyMeat > 0) {
                                consumed += consumeRealItems(army.supply_chest_id, 'meat', Math.min(dailyNeed - consumed, armyMeat));
                            }
                            // Если у армии кончилась еда – она распадается
                            if (consumed < dailyNeed) {
                                armyMorale -= 20;
                                if (armyMorale <= 0) {
                                    generateWorldNews(`Армия ${f.name} распалась от голода при осаде ${targetRegion.name}!`, targetLoc, 4, 'war');
                                    f.armies.splice(i, 1);
                                    armySurvived = false;
                                    continue;
                                }
                            }
                        }
                    }
                    // РАЗРУШЕНИЯ ОТ ОСАДЫ: потребление еды из склада города
                    targetRegion.population -= Math.floor(Math.random() * 200);
                    const cityBread = countRealItems(targetRegion.vault_id, 'bread');
                    if (cityBread > 0) {
                        consumeRealItems(targetRegion.vault_id, 'bread', Math.floor(cityBread * 0.2)); // Сжигают амбары
                    }
                    if(targetRegion.facilities.farms) targetRegion.facilities.farms.durability -= 10;
                } else if (army.siegeDays === 0) {
                    let garrisonPower = (targetRegion.population / 100) + (targetRegion.facilities.farms?.level || 0 * 10);
                    let atkPower = army.size * (Math.random() * 0.5 + 0.8);
                    
                    if (atkPower > garrisonPower) {
                        targetRegion.owner = fId;
                        // ГРАБЕЖ ПРИ ЗАХВАТЕ: перемещаем все предметы из склада захваченного региона в столицу победителя
                        const targetVault = targetRegion.vault_id;
                        const capitalRegionId = Object.keys(World.regions).find(rid => World.regions[rid].owner === fId);
                        if (capitalRegionId && targetVault) {
                            const targetChest = ContainerRegistry.get(targetVault);
                            const capitalChest = ContainerRegistry.get(World.regions[capitalRegionId].vault_id);
                            if (targetChest && capitalChest) {
                                // Перемещаем каждый предмет
                                for (const itemId of [...targetChest.items]) {
                                    WorkerInventorySystem.moveItem(itemId, capitalChest.id);
                                }
                            }
                        }
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
                // Возвращаем оружие обратно в регион при возвращении армии
                const homeRegionId = army.location;
                if (homeRegionId && World.regions[homeRegionId]) {
                    // Возвращаем оставшееся оружие (упрощенно: считаем что вернулось 80% оружия)
                    const returnedWeapons = Math.floor(army.size * 0.8);
                    if (returnedWeapons > 0) {
                        addRealItems(World.regions[homeRegionId].vault_id, 'weapons', returnedWeapons);
                    }
                }
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

    // === ГЕНЕРАЦИЯ РЫНОЧНЫХ ПРЕДЛОЖЕНИЙ ОТ NPC ДЛЯ ИГРОКА ===
    if (playerRegion && World.regions[playerRegion]) {
        let region = World.regions[playerRegion];
        
        // Очищаем старые предложения и генерируем новые каждый день
        player.marketOffers = [];
        
        // Находим NPC-торговцев в регионе
        let tradersInRegion = Object.values(World.npcs).filter(npc => 
            npc.currentLocation === playerRegion && 
            npc.isAlive && 
            ['merchant', 'trader', 'peddler', 'торговец', 'купец'].includes(npc.profession?.toLowerCase())
        );
        
        // Если нет торговцев, создаем виртуальные предложения от "местных торговцев"
        if (tradersInRegion.length === 0) {
            // Генерируем 3-5 случайных предложений на основе ресурсов региона
            let numOffers = 3 + Math.floor(Math.random() * 3);
            let availableGoods = Object.keys(region.markets).filter(g => ECONOMY_ITEMS[g]);
            
            for (let i = 0; i < numOffers && availableGoods.length > 0; i++) {
                let good = availableGoods[Math.floor(Math.random() * availableGoods.length)];
                let basePrice = region.markets[good] || 1;
                
                // Цена для игрока: немного выше базовой (торговая наценка)
                let sellPrice = Math.floor(basePrice * (1.1 + Math.random() * 0.3)); // +10-40%
                let buyPrice = Math.floor(basePrice * (0.7 + Math.random() * 0.2)); // -30-10%
                
                // Количество товара зависит от физических запасов на складе региона
                let maxAvailable = countRealItems(region.vault_id, good);
                let quantity = Math.min(10 + Math.floor(Math.random() * 20), Math.floor(maxAvailable * 0.1) || 10);
                if (quantity < 1) quantity = 1;
                
                player.marketOffers.push({
                    id: `offer_${good}_${Date.now()}_${i}`,
                    type: Math.random() > 0.5 ? 'sell' : 'buy',
                    good: good,
                    goodName: getItemName(good, player.era),
                    quantity: quantity,
                    price: sellPrice,
                    seller: `Торговец из ${region.name}`,
                    expiresAt: (player.gameTime?.day || 0) + 1 // Действует до конца дня
                });
            }
        } else {
            // Генерируем предложения от реальных NPC-торговцев
            for (let trader of tradersInRegion.slice(0, 5)) { // Максимум 5 торговцев
                // Проверяем инвентарь торговца
                let traderItems = WorkerInventorySystem.getItemsByContainerId(trader.inventory_id);
                
                if (traderItems && traderItems.length > 0) {
                    for (let item of traderItems.slice(0, 3)) { // До 3 товаров от каждого
                        let basePrice = region.markets[item.item_id] || 5;
                        let sellPrice = Math.floor(basePrice * (1.1 + Math.random() * 0.3));
                        
                        player.marketOffers.push({
                            id: `offer_${item.id}_${Date.now()}`,
                            type: 'sell',
                            good: item.item_id,
                            goodName: item.meta?.name || getItemName(item.item_id, player.era),
                            quantity: item.quantity,
                            price: sellPrice,
                            seller: trader.name,
                            sellerNpcId: trader.aiIdentifier,
                            expiresAt: (player.gameTime?.day || 0) + 1
                        });
                    }
                }
            }
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
            // Считаем золото физически из столичного региона
            const capitalRegionId = Object.keys(World.regions).find(rid => World.regions[rid].owner === fId);
            const gold = capitalRegionId ? countRealItems(World.regions[capitalRegionId].vault_id, 'gold') : 0;
            const manpower = availableManpower(f);
            worldSummary += `Фракция: ${f.name}. Доступная живая сила: ${manpower}. Золото в столице: ${gold}. Армий в походе СЕЙЧАС: ${f.armies.length}.\n`;
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
    if (data.items) {
        data.items.forEach(([k, v]) => ItemRegistry.set(k, v));
    }
    if (data.containers) {
        data.containers.forEach(([k, v]) => ContainerRegistry.set(k, v));
    }
    
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
            playerUpdates: { visibleEntities: player.visibleEntities },
            items: Array.from(ItemRegistry.entries()),
            containers: Array.from(ContainerRegistry.entries())
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
            playerUpdates: { visibleEntities: player.visibleEntities },
            items: Array.from(ItemRegistry.entries()),
            containers: Array.from(ContainerRegistry.entries())
        });
    }
};;


/* DUPLICATE BLOCK REMOVED */


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

        // Оценка состояния фракции на основе физических ресурсов
        // "Безопасность" теперь зависит от наличия оружия и еды в регионах
        let totalWeapons = 0;
        let totalFood = 0;
        for (let rid of faction.regions || []) {
            const region = World.regions[rid];
            if (region && region.vault_id) {
                totalWeapons += countRealItems(region.vault_id, 'weapons');
                totalFood += countRealItems(region.vault_id, 'bread');
            }
        }
        let security = (totalWeapons > 100 ? 50 : totalWeapons) + (faction.armies.length * 10);
        
        // Богатство = золото в столичном складе
        const capitalRegionId = Object.keys(World.regions).find(rid => World.regions[rid].owner === ruler.factionId);
        const capitalVault = capitalRegionId ? World.regions[capitalRegionId].vault_id : null;
        let wealth = capitalVault ? countRealItems(capitalVault, 'gold') : 0;
        
        // Живая сила = доступное население с оружием
        let power = availableManpower(faction);

        // УМНЫЙ ИИ ФРАКЦИЙ: Принимают решения чаще (15% шанс в день вместо 2%)
        if (Math.random() < 0.15) { 
            let targetF = fKeys[Math.floor(Math.random() * fKeys.length)];
            if (targetF === ruler.factionId) continue;
            let targetFaction = World.factions[targetF];
            let targetPower = availableManpower(targetFaction);

            // 1. ОЦЕНКА УГРОЗЫ И КОАЛИЦИИ
            if (targetPower > power * 2 && targetFaction.diplomacy[ruler.factionId] === "war") {
                // Враг слишком силен. Ищем союзников или сдаемся.
                if (security < 30 || power < 1000) {
                    ruler.currentGoal = { type: "surrender", targetFactionId: targetF };
                    faction.diplomacy[targetF] = "neutral";
                    targetFaction.diplomacy[ruler.factionId] = "neutral";
                    // Выплата контрибуции физическим золотом
                    if (capitalVault) {
                        const goldAmount = countRealItems(capitalVault, 'gold');
                        const tribute = Math.floor(goldAmount * 0.5);
                        consumeRealItems(capitalVault, 'gold', tribute);
                        // Добавляем золото победителю (в его столицу)
                        const targetCapitalId = Object.keys(World.regions).find(rid => World.regions[rid].owner === targetF);
                        if (targetCapitalId) {
                            addRealItems(World.regions[targetCapitalId].vault_id, 'gold', tribute);
                        }
                    }
                    generateWorldNews(`КАПИТУЛЯЦИЯ: Осознав неизбежность краха, ${ruler.name} подписал унизительный мир с ${targetFaction.name}, выплатив огромную контрибуцию.`, "global", 5, 'war');
                    continue;
                }
            }

            // 2. АГРЕССИЯ (Только если мы сильнее или очень амбициозны)
            if (ruler.personality.cruelty > 60 && power > targetPower * 1.2 && ruler.personality.ambition > 50) {
                let warWeary = (typeof World !== 'undefined' && World.homeostasis) ? World.homeostasis.warWeariness : 0;
                if (warWeary < 50 && security > 50) {
                    ruler.currentGoal = { type: "declare_war", targetFactionId: targetF };
                    if (faction.diplomacy[targetF] !== "war") {
                        faction.diplomacy[targetF] = "war";
                        targetFaction.diplomacy[ruler.factionId] = "war";
                        generateWorldNews(`ВОЙНА: Уверенный в своем превосходстве, ${ruler.name} бросает легионы ${faction.name} на земли ${targetFaction.name}!`, "global", 5, 'war');
                    }
                }
            } 
            // 3. ИНТРИГИ (Только против равных или более сильных) - УВЕЛИЧЕН ШАНС
            else if (ruler.personality.paranoia > 55 && targetPower >= power * 0.8) {
                let intrigueTypes = ["sabotage", "bribery"];
                if (ruler.personality.cruelty > 70) intrigueTypes.push("assassination");
                if (ruler.personality.ambition > 60) intrigueTypes.push("rebellion");
                let selectedType = intrigueTypes[Math.floor(Math.random() * intrigueTypes.length)];
                ruler.currentGoal = { type: "start_intrigue", targetFactionId: targetF };
                World.intrigues.push({
                    id: "intr_" + Date.now() + Math.floor(Math.random()*1000),
                    type: selectedType, initiatorFactionId: ruler.factionId, targetFactionId: targetF,
                    targetRulerId: targetFaction.rulerId,
                    progress: 0, requiredProgress: selectedType === 'rebellion' ? 120 : 60, 
                    progressPerDay: Math.max(1, Math.floor(ruler.personality.paranoia / 15)),
                    discoveryChance: 3, isDiscovered: false, actors: [], gmInitiated: false, startDay: player?.stats?.turnCount || 0
                });
                generateWorldNews(`ИНТРИГА: ${ruler.name} запускает тайную операцию (${selectedType}) против ${targetFaction.name}!`, "global", 3, 'war');
            } 
            // 4. ЭКОНОМИКА И СОЮЗЫ
            else if (ruler.personality.stewardship > 50 && wealth < 10000) {
                ruler.currentGoal = { type: "trade_pact", targetFactionId: targetF };
                faction.relations[targetF] += 10;
                // Торговое соглашение приносит физическое золото
                if (capitalVault) {
                    addRealItems(capitalVault, 'gold', 2000);
                }
                generateWorldNews(`ЭКОНОМИКА: ${ruler.name} заключает выгодное торговое соглашение с ${targetFaction.name}.`, "global", 2, 'misc');
            }
            // 5. ДИПЛОМАТИЯ И БРАКИ
            else if (ruler.personality.diplomacy > 55 && faction.relations[targetF] > 50) {
                if (ruler.heir && World.rulers[targetFaction.rulerId]?.heir && Math.random() < 0.4) {
                    ruler.currentGoal = { type: "marriage_alliance", targetFactionId: targetF };
                    faction.relations[targetF] = 100;
                    targetFaction.relations[ruler.factionId] = 100;
                    generateWorldNews(`ДИНАСТИЧЕСКИЙ БРАК: Дома ${faction.name} и ${targetFaction.name} объединились узами брака!`, "global", 5, 'misc');
                } else {
                    ruler.currentGoal = { type: "offer_alliance", targetFactionId: targetF };
                    faction.relations[targetF] = Math.min(100, faction.relations[targetF] + 20);
                    generateWorldNews(`ДИПЛОМАТИЯ: ${ruler.name} укрепляет союз с ${targetFaction.name}.`, "global", 2, 'misc');
                }
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
                // Убийство правителя через покушение - физическое последствие
                const targetRuler = World.rulers[intr.targetRulerId];
                targetRuler.alive = false;
                if (World.npcs[intr.targetRulerId]) World.npcs[intr.targetRulerId].isAlive = false;
                generateWorldNews(`ТЕМНЫЕ ДЕЛА: Правитель ${targetRuler.name} убит в результате успешного покушения!`, "global", 5, 'war');
                checkRulerDeaths();
            } else if (intr.type === "sabotage") {
                // Саботаж уничтожает физические ресурсы на складе столицы
                const targetFaction = World.factions[intr.targetFactionId];
                const capitalRegionId = Object.keys(World.regions).find(rid => World.regions[rid].owner === intr.targetFactionId);
                if (capitalRegionId) {
                    const capitalVault = World.regions[capitalRegionId].vault_id;
                    const weaponsDestroyed = Math.floor(countRealItems(capitalVault, 'weapons') * 0.3);
                    const goldStolen = Math.floor(countRealItems(capitalVault, 'gold') * 0.2);
                    consumeRealItems(capitalVault, 'weapons', weaponsDestroyed);
                    consumeRealItems(capitalVault, 'gold', goldStolen);
                    generateWorldNews(`ДИВЕРСИЯ: Экономика ${targetFaction?.name} пострадала от саботажников. Уничтожено ${weaponsDestroyed} ед. оружия, украдено ${goldStolen} золота.`, "global", 3, 'disaster');
                }
            } else if (intr.type === "rebellion") {
                // Мятеж приводит к потере населения и ресурсов
                const targetFaction = World.factions[intr.targetFactionId];
                const rebelRegions = targetFaction.regions || [];
                for (const rid of rebelRegions.slice(0, 2)) {
                    const region = World.regions[rid];
                    if (region) {
                        region.population = Math.floor(region.population * 0.7);
                        const weaponsLost = Math.floor(countRealItems(region.vault_id, 'weapons') * 0.4);
                        consumeRealItems(region.vault_id, 'weapons', weaponsLost);
                    }
                }
                generateWorldNews(`МЯТЕЖ: В землях ${targetFaction?.name} вспыхнуло восстание, спонсированное извне! Потеряно население и ресурсы.`, "global", 5, 'war');
            } else if (intr.type === "bribery") {
                // Подкуп генералов приводит к краже оружия и еды
                const targetFaction = World.factions[intr.targetFactionId];
                const capitalRegionId = Object.keys(World.regions).find(rid => World.regions[rid].owner === intr.targetFactionId);
                if (capitalRegionId) {
                    const capitalVault = World.regions[capitalRegionId].vault_id;
                    const weaponsStolen = Math.floor(countRealItems(capitalVault, 'weapons') * 0.25);
                    const foodStolen = Math.floor(countRealItems(capitalVault, 'bread') * 0.3);
                    consumeRealItems(capitalVault, 'weapons', weaponsStolen);
                    consumeRealItems(capitalVault, 'bread', foodStolen);
                    generateWorldNews(`КОРРУПЦИЯ: Генералы ${targetFaction?.name} были подкуплены. Украдено ${weaponsStolen} ед. оружия и ${foodStolen} ед. продовольствия. Армия деморализована.`, "global", 4, 'misc');
                }
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
        // Правитель умирает только от покушения, голода или болезни (при отсутствии медикаментов)
        if (r.alive && !r.heir && !World.npcs[rId]?.isAlive) {
            // Правитель уже мертв от внешнего воздействия
            r.alive = false;
            
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
                // Вместо стабильности - физическое последствие: бунт уничтожает ресурсы столицы
                const capitalRegionId = Object.keys(World.regions).find(rid => World.regions[rid].owner === r.factionId);
                if (capitalRegionId) {
                    const capitalVault = World.regions[capitalRegionId].vault_id;
                    const weaponsLost = Math.floor(countRealItems(capitalVault, 'weapons') * 0.5);
                    const goldLost = Math.floor(countRealItems(capitalVault, 'gold') * 0.3);
                    consumeRealItems(capitalVault, 'weapons', weaponsLost);
                    consumeRealItems(capitalVault, 'gold', goldLost);
                }
            }
        } else if (r.alive) {
            // Правитель может умереть от голода если в столице нет еды
            const capitalRegionId = Object.keys(World.regions).find(rid => World.regions[rid].owner === r.factionId);
            if (capitalRegionId) {
                const capitalVault = World.regions[capitalRegionId].vault_id;
                const foodAvailable = countRealItems(capitalVault, 'bread') + countRealItems(capitalVault, 'meat');
                const herbsAvailable = countRealItems(capitalVault, 'herbs');
                // Если нет еды и медикаментов, правитель может заболеть и умереть
                if (foodAvailable < 10 && herbsAvailable < 5 && Math.random() < 0.01) {
                    r.alive = false;
                    if (World.npcs[rId]) World.npcs[rId].isAlive = false;
                    generateWorldNews(`Правитель ${r.name} умер от голода и болезней в столице!`, "global", 5, 'disaster');
                }
            }
        }
    }
}
