// --- ЯДРО СИСТЕМЫ СОХРАНЕНИЙ (Логика, Таймеры, Сборка данных) ---

async function saveGame(slotType, slotId) {
    if (isWaitingForAI) {
        console.warn("[saveGame] Сохранение заблокировано: ожидается ответ от ИИ.");
        return false;
    }
    if (window.electronAPI && window.electronAPI.isElectron) console.log(`[Save] Сохранение в файл JSON: ${slotType} #${slotId}`);
    if (!player) {
        console.error("[saveGame] Не удается сохранить игру: данные игрока отсутствуют.");
        return false;
    }

    const saveData = {
        slotType: slotType,
        slotId: slotId,
        timestamp: new Date().toISOString(),
        playerData: structuredClone(player),
        historyData: structuredClone(conversationHistory),
        worldData: typeof World !== 'undefined' ? structuredClone(World) : null
    };

    // --- ПЛАН АБАНГ: СНАЧАЛА ПЫТАЕМСЯ ЗАПИСАТЬ В ФАЙЛ ---
    if (window.electronAPI && window.electronAPI.isElectron) {
        const fileName = getSaveFileName(slotType, slotId);
        const success = await writeFileToFSA(fileName, saveData);
        if (success) {
            console.log(`[saveGame] УСПЕХ: Игра сохранена в файл: ${fileName}`);
            return true; // Если получилось, выходим из функции
        }
        // Если success === false, значит, произошла ошибка, и мы перейдем к запасному варианту ниже.
        console.warn(`[saveGame] ПРЕДУПРЕЖДЕНИЕ: Не удалось сохранить в файл. Попытка сохранения в Local Storage...`);
    }

    // --- ЗАПАСНОЙ ВАРИАНТ: LOCAL STORAGE ---
    // Этот код выполнится, только если мы не в Electron, или если запись в файл не удалась.
    console.log("[saveGame] Выполняется сохранение в Local Storage.");
    try {
        const allSaves = getAllSavesFromLocalStorage();
        let targetArray = allSaves[slotType];
        const maxSlots = (slotType === 'manual') ? MAX_MANUAL_SAVES : MAX_AUTO_SAVES;

        if (!Array.isArray(targetArray)) {
            allSaves[slotType] = [];
            targetArray = allSaves[slotType];
        }
        const existingSlotIndex = targetArray.findIndex(save => save.slotId === slotId);

        if (existingSlotIndex !== -1) {
            targetArray[existingSlotIndex] = saveData;
        } else {
            if (targetArray.length >= maxSlots && slotType === 'auto') {
                targetArray.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                targetArray.shift();
                targetArray.push(saveData);
            } else if (targetArray.length >= maxSlots && slotType === 'manual') {
                alert(t('loadGame.errorSlotFullLS', { slotId: slotId, max: maxSlots }));
                return false;
            } else {
                targetArray.push(saveData);
            }
        }
        storeAllSavesToLocalStorage(allSaves);
        console.log(`[saveGame] УСПЕХ: Игра сохранена в localStorage (слот ${slotType} #${slotId})`);
        return true;
    } catch (e) {
        console.error("[saveGame] КРИТИЧЕСКАЯ ОШИБКА: Не удалось сохранить ни в файл, ни в Local Storage.", e);
        return false;
    }
}

async function loadGame(slotType, slotId) {
    let saveData = null;
    let source = "";

    if (window.electronAPI && window.electronAPI.isElectron) {
        const fileName = getSaveFileName(slotType, slotId);
        saveData = await readFileFromFSA(fileName);
        if (saveData) source = "Electron File System";
    }

    if (!saveData) {
        console.log(`[loadGame] Сохранение не найдено в файлах, проверка Local Storage...`);
        const allSaves = getAllSavesFromLocalStorage();
        const targetArray = allSaves[slotType];
        if (Array.isArray(targetArray)) {
            saveData = targetArray.find(save => save.slotId === slotId);
            if (saveData) source = "localStorage";
        }
    }

    if (saveData) {
        try {
            if (!saveData.playerData || !saveData.timestamp) {
                throw new Error(t("loadGame.errorSaveCorrupted"));
            }

            player = structuredClone(saveData.playerData);
            if (saveData.worldData) { 
                World = structuredClone(saveData.worldData); 
                worldWorker.postMessage({ action: 'init', ECONOMY_ITEMS, CRAFTING_RECIPES, FACILITY_NAMES });
            } else { 
                World = await initWorldSimulator(); 
            }
            await loadActiveEraLore(player.era);
            await loadGlobalLocations(DEFAULT_WORLD_ID, currentLanguage, player.era);

            isMapInitialized = false; // Сброс карты для перецентрирования
            conversationHistory = structuredClone(saveData.historyData || []);

            // --- ОБЯЗАТЕЛЬНАЯ ПРОВЕРКА И ИНИЦИАЛИЗАЦИЯ ПОЛЕЙ ---
            player.stats = player.stats || {};
            player.inventory = player.inventory || {};
            player.equipment = player.equipment || {};
            player.holdings = player.holdings || {};
            player.bankAccount = player.bankAccount || { deposit: 0, loan: 0, loanDays: 0 };

            // --- МИГРАЦИЯ СТАРОЙ СИСТЕМЫ ЭКИПИРОВКИ ---
            if (player.equipment.weapon || player.equipment.armor || player.equipment.amulet) {
                console.log("Обнаружена старая система экипировки, производится миграция...");
                const migratedEquipment = {};
                if (player.equipment.weapon) migratedEquipment.right_hand = player.equipment.weapon;
                if (player.equipment.armor) migratedEquipment.torso = player.equipment.armor;
                if (player.equipment.amulet) migratedEquipment.neck = player.equipment.amulet;
                player.equipment = migratedEquipment;
            }

            player.quests = player.quests || {};
            player.skills = player.skills || {};
            player.mapMarkers = player.mapMarkers || {};
            player.subLocations = player.subLocations || {};
            player.statusEffects = player.statusEffects || {};
            player.visibleEntities = player.visibleEntities || {};
            player.allKnownEntities = player.allKnownEntities || {};
            player.visitedLocations = player.visitedLocations || [];
            player.localMap = player.localMap || null;
            player.allKnownEntities = player.allKnownEntities || {};
            player.visitedLocations = player.visitedLocations || [];
            player.localMap = player.localMap || null;

            player.gameLogHistory = player.gameLogHistory || [];
            player.calcLogHistory = player.calcLogHistory || [];
            player.gmErrors = player.gmErrors || [];
                        player.echoMemory = player.echoMemory || { items: [], maxItems: ECHO_MEMORY_MAX_ITEMS, version: 1 };
            if (!player.echoMemory.items) player.echoMemory.items = [];
player.gmNotes = player.gmNotes || {};
            player.memoryArchives = player.memoryArchives || {};
            player.archiveSummaries = player.archiveSummaries || {};
            player.factionData = player.factionData || { global: t('factions.global', null, 'Общая') };
            player.nexusData = player.nexusData || {};

            if (typeof player.stats.reputation === 'number' || player.stats.reputation === undefined) {
                player.stats.reputation = { global: player.stats.reputation || 0 };
            }

            player.stats.level = player.stats.level || 1;
            player.stats.xp = player.stats.xp || 0;
            player.stats.statPoints = player.stats.statPoints || 0;
            player.stats.turnCount = player.stats.turnCount || 0;
            player.gameTime = player.gameTime || { year: 1, month: 1, day: 1, hour: 8, minute: 0, totalPulses: 0 };
            player.timeOfDay = player.timeOfDay || "Утро";

            player.stats.res = player.stats.res || 10; // Инициализация для старых сейвов

            player.stats.traumaCooldown = player.stats.traumaCooldown || 0;
            player.currentCombat = player.currentCombat || { isActive: false, participants: [] };
            player.stats.xpNext = calculateXpForNextLevel(player.stats.level);
            player.stats.con = player.stats.con || 10;
            player.stats.maxHp = calculateMaxHp(player.stats.con);
            player.stats.hp = Math.min(player.stats.hp || player.stats.maxHp, player.stats.maxHp);
            player.stats.str = player.stats.str || 10;
            player.inventoryCapacity = 10 + Math.floor((player.stats.str - 10) / 2);

            if (player.class === 'mage') {
                player.stats.int = player.stats.int || 10;
                player.stats.maxMana = calculateMaxMana(player.stats.int, player.stats.level);
                player.stats.mana = Math.min(player.stats.mana ?? player.stats.maxMana, player.stats.maxMana);
            } else {
                player.stats.mana = 0;
                player.stats.maxMana = 0;
            }

            const maxQuestId = Object.keys(player.quests).map(id => parseInt(id, 10)).filter(id => !isNaN(id)).reduce((m, c) => Math.max(m, c), 0);
            nextInternalQuestId = (maxQuestId || 0) + 1;
            const maxItemId = Object.keys(player.inventory).map(id => parseInt(id, 10)).filter(id => !isNaN(id)).reduce((m, c) => Math.max(m, c), 0);
            nextInternalItemId = (maxItemId || 0) + 1;
            const maxEntityId = Object.keys(player.visibleEntities).map(id => parseInt(id, 10)).filter(id => !isNaN(id)).reduce((m, c) => Math.max(m, c), 0);
            nextInternalEntityId = (maxEntityId || 0) + 1;

            currentSaveSlot = { type: slotType, id: slotId };
            isMapInitialized = false; // Сбрасываем флаг, чтобы карта перецентрировалась
            console.log(`Игра загружена из ${source}: ${slotType} слот ${slotId}`);

            stopMenuMusic();
            initializeGameInterface();
            setActiveScreen('game-interface');
            displaySavedChatHistory();

            const slotTypeLocalized = t(slotType === 'manual' ? 'loadGame.manualSlotType' : 'loadGame.autoSlotType');
            addLogMessage(t('gameInterface.log.gameLoaded', { slotType: slotTypeLocalized, slotId: slotId }), "system-message");
            addLogMessage(t('gameInterface.log.continueAdventure'), "gm-message");

        } catch (e) {
            console.error(`Ошибка загрузки игры из ${slotType} слота ${slotId} (Источник: ${source}):`, e);
            alert(t('loadGame.errorLoad', { slotId: slotId, message: e.message }));
            player = null;
            conversationHistory = [];
            setActiveScreen('main-menu');
        }
    } else {
        console.error(`Слот сохранения ${slotType} #${slotId} не найден.`);
        alert(t('loadGame.errorSaveNotFound', { slotId: slotId }));
    }
}

async function deleteSave(slotType, slotId) {
    const slotTypeLocalized = t(slotType === 'manual' ? 'loadGame.manualSlotType' : 'loadGame.autoSlotType', null, slotType);

    showCustomConfirm(
        t('loadGame.confirmDelete', { slotType: slotTypeLocalized, slotId: slotId }),
        async () => {
            let success = false;

            if (window.electronAPI && window.electronAPI.isElectron) {
                const fileName = getSaveFileName(slotType, slotId);
                success = await deleteFileFromFSA(fileName);
            }

            const allSavesLS = getAllSavesFromLocalStorage();
            let targetArrayLS = allSavesLS[slotType];
            if (Array.isArray(targetArrayLS)) {
                const initialLengthLS = targetArrayLS.length;
                allSavesLS[slotType] = targetArrayLS.filter(save => save.slotId !== slotId);
                if (allSavesLS[slotType].length < initialLengthLS) {
                    storeAllSavesToLocalStorage(allSavesLS);
                    success = true;
                }
            }

            if (success) {
                await populateLoadGameScreen();
            } else {
                showCustomAlert("Не удалось удалить сохранение.");
            }
        }
    );
}

async function autoSaveGame() {
    if (!player || !gameInterface.classList.contains('active-screen') || isWaitingForAI || IS_PRE_SIMULATING || tempPlayer !== null) return;

    let nextAutoSaveId = 1;

    // --- ЖЕСТКАЯ ЛОГИКА ---
    if (window.electronAPI && window.electronAPI.isElectron) {
        const autoSaves = (await listSaveFilesFromFSA()).filter(s => s.slotType === 'auto');
        if (autoSaves.length > 0) {
            if (autoSaves.length < MAX_AUTO_SAVES) {
                const usedIds = new Set(autoSaves.map(s => s.slotId));
                for (let i = 1; i <= MAX_AUTO_SAVES + 1; i++) { if (!usedIds.has(i)) { nextAutoSaveId = i; break; } }
            } else {
                autoSaves.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                nextAutoSaveId = autoSaves[0].slotId;
            }
        }
    } else {
        const allSavesForAuto = getAllSavesFromLocalStorage();
        const autoSaves = allSavesForAuto.auto || [];
        if (autoSaves.length > 0) {
            if (autoSaves.length < MAX_AUTO_SAVES) {
                const usedIds = new Set(autoSaves.map(s => s.slotId));
                for (let i = 1; i <= MAX_AUTO_SAVES + 1; i++) { if (!usedIds.has(i)) { nextAutoSaveId = i; break; } }
            } else {
                autoSaves.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                nextAutoSaveId = autoSaves[0].slotId;
            }
        }
    }

    console.log(`Попытка автосохранения в слот ${nextAutoSaveId}...`);
    const savedSuccessfully = await saveGame('auto', nextAutoSaveId);

    if (savedSuccessfully) {
        const finalSource = (window.electronAPI && window.electronAPI.isElectron) ? t('loadGame.sourceFileSystem') : t('loadGame.sourceLocalStorage');
        addLogMessage(t('gameInterface.log.autoSaveSuccess', { slotId: nextAutoSaveId, source: finalSource }), "command-feedback");
    } else {
        addLogMessage(t('gameInterface.log.autoSaveFailed', { slotId: nextAutoSaveId }), "system-message");
    }
}

function startAutoSaveTimer() {
    stopAutoSaveTimer(); // Остановить предыдущий, если есть
    if (AUTOSAVE_INTERVAL > 0) {
        autoSaveTimer = setInterval(autoSaveGame, AUTOSAVE_INTERVAL);
        console.log(`Таймер автосохранения запущен с интервалом ${AUTOSAVE_INTERVAL / 1000}с`);
    }
}

function stopAutoSaveTimer() {
    if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
        autoSaveTimer = null;
        console.log("Таймер автосохранения остановлен.");
    }
}

