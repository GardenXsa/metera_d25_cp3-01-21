// --- ЯДРО СИСТЕМЫ СОХРАНЕНИЙ (Логика, Таймеры, Сборка данных) ---

async function saveGame(slotType, slotId) {
    if (isWaitingForAI || !player) return false;
    showLoadingScreen('loadingScreen.saving', 'Подготовка к сохранению...');
    await yieldThread();

    try {
        const fileName = getSaveFileName(slotType, slotId);
        const isElectron = window.electronAPI && window.electronAPI.isElectron;
        let lines = [];
        let blockCount = 1;

        if (isElectron) await window.electronAPI.initSaveFile(fileName);

        const addBlock = async (name, id, data) => {
            updateLoadingText(`Сохраняем блок ${blockCount++}: ${name}...`);
            await yieldThread();
            const lineStr = JSON.stringify({ block: id, data: data }) + '\n';
            if (isElectron) {
                await window.electronAPI.appendSaveLine(fileName, lineStr);
            } else {
                lines.push(lineStr.trim());
            }
            await yieldThread();
        };

        const metaData = {
            slotType, slotId, timestamp: new Date().toISOString(),
            playerData: { name: player.name, stats: { level: player.stats.level } }
        };
        
        await addBlock("Метаданные", "meta", metaData);
        await addBlock("Данные персонажа", "player", player);
        await addBlock("История диалогов", "history", conversationHistory);

        if (typeof World !== 'undefined' && World) {
            await addBlock("Время и гомеостаз", "world_base", { time: World.time, homeostasis: World.homeostasis, lastDirectInjectionDay: World.lastDirectInjectionDay, needsGlobalEvent: World.needsGlobalEvent });
            await addBlock("Регионы мира", "world_regions", World.regions);
            await addBlock("Фракции", "world_factions", World.factions);
            await addBlock("Население (NPC)", "world_npcs", World.npcs);
            await addBlock("Правители и Интриги", "world_rulers", { rulers: World.rulers, intrigues: World.intrigues });
            await addBlock("Летопись и Погода", "world_misc", { news: World.news, weather: World.weather, animals: World.animals, gmInterventionHistory: World.gmInterventionHistory });
        }

        // Обновляем LocalStorage для метаданных (чтобы меню работало быстро)
        const allSaves = getAllSavesFromLocalStorage();
        let targetArray = allSaves[slotType] || [];
        const maxSlots = (slotType === 'manual') ? MAX_MANUAL_SAVES : MAX_AUTO_SAVES;
        const existingIdx = targetArray.findIndex(s => s.slotId === slotId);
        if (existingIdx !== -1) targetArray[existingIdx] = metaData;
        else {
            if (targetArray.length >= maxSlots && slotType === 'auto') {
                targetArray.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                targetArray.shift();
            }
            targetArray.push(metaData);
        }
        allSaves[slotType] = targetArray;
        storeAllSavesToLocalStorage(allSaves);
        
        if (!isElectron) localStorage.setItem(`${SAVE_FILE_PREFIX}${slotType}_${slotId}_lines`, JSON.stringify(lines));

        hideLoadingScreen();
        return true;
    } catch (e) {
        console.error(e);
        hideLoadingScreen();
        return false;
    }
}

async function loadGame(slotType, slotId) {
    showLoadingScreen('loadingScreen.loading', 'Открытие потока данных...');
    await yieldThread();

    const fileName = getSaveFileName(slotType, slotId);
    const isElectron = window.electronAPI && window.electronAPI.isElectron;
    let rawPlayer = null, rawHistory = [], rawWorld = {};
    let loadedSuccessfully = false;

    try {
        if (isElectron) {
            const fileSize = await window.electronAPI.getFileSize(fileName);
            if (fileSize > 0) {
                const CHUNK_SIZE = 512 * 1024; // Читаем по 512 КБ
                let position = 0;
                let leftover = "";
                let blockCount = 1;

                while (position < fileSize) {
                    const chunk = await window.electronAPI.readSaveChunk(fileName, position, CHUNK_SIZE);
                    position += CHUNK_SIZE;
                    
                    // Склеиваем остаток с прошлых 512КБ и бьем по переносам строк
                    const lines = (leftover + chunk).split('\n');
                    leftover = lines.pop(); // Последняя строка может быть разорвана, оставляем на следующий цикл

                    for (const line of lines) {
                        if (!line.trim()) continue;
                        
                        // Если это старое сохранение (не JSONL), прерываем потоковое чтение
                        if (!line.startsWith('{"block":')) {
                            throw new Error("LEGACY_SAVE");
                        }

                        const parsed = JSON.parse(line);
                        updateLoadingText(`Читаем блок ${blockCount++}: ${parsed.block}...`);
                        await yieldThread();

                        switch(parsed.block) {
                            case 'player': rawPlayer = parsed.data; break;
                            case 'history': rawHistory = parsed.data; break;
                            case 'world_base': Object.assign(rawWorld, parsed.data); break;
                            case 'world_regions': rawWorld.regions = parsed.data; break;
                            case 'world_factions': rawWorld.factions = parsed.data; break;
                            case 'world_npcs': rawWorld.npcs = parsed.data; break;
                            case 'world_rulers': rawWorld.rulers = parsed.data.rulers; rawWorld.intrigues = parsed.data.intrigues; break;
                            case 'world_misc': Object.assign(rawWorld, parsed.data); break;
                        }
                    }
                }
                loadedSuccessfully = true;
            }
        } else {
            // Логика для браузера (LocalStorage)
            const lsData = localStorage.getItem(`${SAVE_FILE_PREFIX}${slotType}_${slotId}_lines`);
            if (lsData) {
                const lines = JSON.parse(lsData);
                let blockCount = 1;
                for (const line of lines) {
                    const parsed = JSON.parse(line);
                    updateLoadingText(`Читаем блок ${blockCount++}: ${parsed.block}...`);
                    await yieldThread();
                    switch(parsed.block) {
                        case 'player': rawPlayer = parsed.data; break;
                        case 'history': rawHistory = parsed.data; break;
                        case 'world_base': Object.assign(rawWorld, parsed.data); break;
                        case 'world_regions': rawWorld.regions = parsed.data; break;
                        case 'world_factions': rawWorld.factions = parsed.data; break;
                        case 'world_npcs': rawWorld.npcs = parsed.data; break;
                        case 'world_rulers': rawWorld.rulers = parsed.data.rulers; rawWorld.intrigues = parsed.data.intrigues; break;
                        case 'world_misc': Object.assign(rawWorld, parsed.data); break;
                    }
                }
                loadedSuccessfully = true;
            }
        }
    } catch (e) {
        if (e.message === "LEGACY_SAVE") {
            updateLoadingText('Конвертация старого сохранения...');
            await yieldThread();
            const oldData = await window.electronAPI.loadGame(fileName);
            rawPlayer = oldData.playerData;
            rawHistory = oldData.historyData;
            rawWorld = oldData.worldData;
            loadedSuccessfully = true;
        } else {
            console.error(e);
        }
    }

    if (!loadedSuccessfully || !rawPlayer) {
        hideLoadingScreen();
        alert(t('loadGame.errorSaveNotFound', { slotId: slotId }));
        return;
    }

    try {
        player = structuredClone(rawPlayer);

        updateLoadingText('Инициализация симуляции мира...');
        await yieldThread();
        if (rawWorld && Object.keys(rawWorld).length > 0) { 
            World = structuredClone(rawWorld); 
            worldWorker.postMessage({ action: 'init', ECONOMY_ITEMS, CRAFTING_RECIPES, FACILITY_NAMES });
        } else { 
            World = await initWorldSimulator(); 
        }

        updateLoadingText('Чтение лора и истории...');
        await yieldThread();
        await loadActiveEraLore(player.era);
        await loadGlobalLocations(DEFAULT_WORLD_ID, currentLanguage, player.era);
        conversationHistory = structuredClone(rawHistory || []);

        updateLoadingText('Восстановление интерфейса...');
        await yieldThread();

        player.stats = player.stats || {};
        player.inventory = player.inventory || {};
        player.equipment = player.equipment || {};
        player.holdings = player.holdings || {};
        player.bankAccount = player.bankAccount || { deposit: 0, loan: 0, loanDays: 0 };
        player.quests = player.quests || {};
        player.skills = player.skills || {};
        player.mapMarkers = player.mapMarkers || {};
        player.subLocations = player.subLocations || {};
        player.statusEffects = player.statusEffects || {};
        player.visibleEntities = player.visibleEntities || {};
        player.allKnownEntities = player.allKnownEntities || {};
        player.visitedLocations = player.visitedLocations || [];
        player.localMap = player.localMap || null;
        player.gameLogHistory = player.gameLogHistory || [];
        player.calcLogHistory = player.calcLogHistory || [];
        player.gmErrors = player.gmErrors || [];
        player.echoMemory = player.echoMemory || { items: [], maxItems: ECHO_MEMORY_MAX_ITEMS, version: 1 };
        player.gmNotes = player.gmNotes || {};
        player.memoryArchives = player.memoryArchives || {};
        player.archiveSummaries = player.archiveSummaries || {};
        player.factionData = player.factionData || { global: t('factions.global', null, 'Общая') };
        player.nexusData = player.nexusData || {};

        if (typeof player.stats.reputation === 'number' || player.stats.reputation === undefined) {
            player.stats.reputation = { global: player.stats.reputation || 0 };
        }

        currentSaveSlot = { type: slotType, id: slotId };
        isMapInitialized = false;

        stopMenuMusic();
        initializeGameInterface();
        setActiveScreen('game-interface');
        displaySavedChatHistory();

        addLogMessage(t('gameInterface.log.gameLoaded', { slotType: slotType, slotId: slotId }), "system-message");
        hideLoadingScreen();
    } catch (e) {
        console.error(`Ошибка загрузки:`, e);
        hideLoadingScreen();
        alert(t('loadGame.errorLoad', { slotId: slotId, message: e.message }));
        setActiveScreen('main-menu');
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

