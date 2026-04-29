// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ДЛЯ НАСТРОЕК AI ---
let currentApiProvider = 'gemini'; // 'gemini', 'llmost', 'openrouter', 'local'

// Gemini
let geminiApiKeys = [];
let geminiApiKey = ''; // Единый активный ключ
let currentGeminiKeyIndex = 0;
let geminiModelId = 'gemini-1.5-flash-latest';

// user-input
let lastUserPrompt = "";

// LLMost
let llmostApiKey = '';
let llmostModelId = 'openai/gpt-4';

// OpenRouter
let openrouterApiKey = '';
let openrouterModelId = 'anthropic/claude-3-haiku';
let deepseekApiKey = '';
let deepseekModelId = 'deepseek-chat';

// Local (LM Studio)
let localApiUrl = 'http://localhost:1234/v1/chat/completions';
let localModelId = 'local-model'; // Это поле больше не используется, но оставляем для совместимости



// Проверяем, запущены ли мы в Electron
const hasElectronAPI = window.electronAPI && window.electronAPI.isElectron;

// Определяем доступность файловой системы (Electron ИЛИ Браузер)
// ВНИМАНИЕ: Убедись, что ниже в коде НЕТ повторного объявления "let fsaApiAvailable"
let fsaApiAvailable = hasElectronAPI || (typeof window.showDirectoryPicker === 'function');

if (hasElectronAPI) {
    console.log("Режим Electron обнаружен. Используем нативные сохранения.");
}

// --- НОВЫЕ ПЕРЕМЕННЫЕ ДЛЯ ИНТЕРАКТИВНОЙ КАРТЫ ---
const mapCanvas = document.getElementById('visual-map');
const mapTooltipElement = document.getElementById('map-tooltip'); // <-- ДОБАВЬТЕ ЭТУ СТРОКУ
let mapContext = mapCanvas ? mapCanvas.getContext('2d') : null;
let mapState = {
    zoom: 1.2, // Увеличен базовый зум, чтобы локации не слипались
    offsetX: 0,
    offsetY: 0,
    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0
};
let isMapInitialized = false;
let hoveredMapPoint = null;
let mapControlsInitialized = false; // <-- ДОБАВЬТЕ ЭТУ СТРОКУ

// Глобальные переменные для новой системы экипировки
const bodySlots = [
    'head', 'face', 'neck', 'shoulders', 'torso', 
    'right_hand', 'left_hand', 'legs', 'feet'
];
let equipmentElements = {}; // Будет заполнен в DOMContentLoaded
const inventoryTabsContainer = document.querySelector('.inventory-tabs');

// Добавить к остальным глобальным переменным
let currentInventoryFilter = 'all';

// --- Элементы DOM ---

const rollDiceArea = document.querySelector('.dice-roll-area'); // Контейнер для кнопки
const rollDiceButton = document.getElementById('roll-dice-button');

// НОВЫЕ ЭЛЕМЕНТЫ ДЛЯ СИСТЕМЫ НЕКСУС
const traitsList = document.getElementById('traits-list');
const holdingsList = document.getElementById('holdings-list');

const fsaSelectDirectoryButton = document.getElementById('fsa-select-directory-button');
const fsaStatusElement = document.getElementById('fsa-status');

// Экран Выбора Рассказчика
const narratorSelectionScreen = document.getElementById('narrator-selection-screen');
const narratorCard = document.getElementById('narrator-card');
const narratorName = document.getElementById('narrator-name');
const narratorDesc = document.getElementById('narrator-desc');
const narratorPrevButton = document.getElementById('narrator-prev');
const narratorNextButton = document.getElementById('narrator-next');
const confirmNarratorButton = document.getElementById('confirm-narrator-button');

// Элементы Загрузки (НОВОЕ)
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');

// Меню и Экраны
const ttsVoiceSelectorGroup = document.getElementById('tts-voice-selector-group');
const ttsVoiceSelect = document.getElementById('tts-voice-select');
const calculationLog = document.getElementById('calculation-log');
const gmNotesPanel = document.getElementById('gm-notes-panel');
const gmNotesContent = document.getElementById('gm-notes-content');
const screens = document.querySelectorAll('.menu-screen');
const mainMenu = document.getElementById('main-menu');
const settingsMenu = document.getElementById('settings-menu');
const characterCreationScreen = document.getElementById('character-creation-screen');
const loadGameScreen = document.getElementById('load-game-screen');
const helpScreen = document.getElementById('help-screen');
const gameInterface = document.getElementById('game-interface');
const apiKeyStatus = document.getElementById('api-key-status');
const backgroundContainer = document.getElementById('background-container');
const languageSelect = document.getElementById('language-select');

// Кнопки Главного Меню
const newGameButton = document.getElementById('new-game-button');
const loadGameButton = document.getElementById('load-game-button');
const mainSettingsButton = document.getElementById('main-settings-button');
const helpButton = document.getElementById('help-button');
const communityButton = document.getElementById('community-button'); // <-- ДОБАВЛЕНО
const useUserKeyButton = document.getElementById('use-user-key-button');
const useBuiltInKeyButton = document.getElementById('use-builtin-key-button');

// Настройки
const apiKeyInput = document.getElementById('api-key-input');
const saveSettingsButton = document.getElementById('save-settings-button');

// Создание Персонажа
const charNameInput = document.getElementById('char-name-input');
const charRaceSelect = document.getElementById('char-race-select');
const charClassSelect = document.getElementById('char-class-select');
const charEraSelect = document.getElementById('char-era-select'); // <-- ДОБАВЛЕНО
const eraDescriptionBox = document.getElementById('era-description-box'); // <-- ДОБАВЛЕНО
const charDescInput = document.getElementById('char-desc-input');
const statDistributionSection = document.getElementById('stat-distribution');
const creationStatPointsDisplay = document.getElementById('stat-points-available');
const statButtons = document.querySelectorAll('.stat-button');
const createStatDisplays = {
    str: document.getElementById('create-stat-str'),
    dex: document.getElementById('create-stat-dex'),
    int: document.getElementById('create-stat-int'),
    con: document.getElementById('create-stat-con'),
    cha: document.getElementById('create-stat-cha'),
};
const startGameButton = document.getElementById('start-game-button');
const creationError = document.getElementById('creation-error');

// Загрузка Игры
let lastUserMessageForRetry = null;
let cachedLogicState = null; // Кэш расчетов Счетовода для повтора Поэта
const manualSaveSlotsList = document.getElementById('manual-save-slots');
const autoSaveSlotsList = document.getElementById('auto-save-slots');
const maxManualSavesDisplay = document.getElementById('max-manual-saves');
const maxAutoSavesDisplay = document.getElementById('max-auto-saves');

// Кнопки Назад
const backButtons = document.querySelectorAll('.back-button');

// Игровой Интерфейс
const gameLog = document.getElementById('game-log');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const voiceInputButton = document.getElementById('voice-input-button'); // <--- НОВЫЙ ЭЛЕМЕНТ
const gameTitle = document.getElementById('game-title');
const inGameMenuButton = document.getElementById('in-game-menu-button');
const collapsiblePanels = document.querySelectorAll('.collapsible-panel');

// Элементы для отображения состояния игрока
const levelInfoDiv = document.getElementById('level-info');
const characterSheetPanel = document.querySelector('.character-sheet');
const charNameDisplay = document.getElementById('character-name');
const charRaceDisplay = document.getElementById('character-race');
const charClassDisplay = document.getElementById('character-class');
const levelDisplay = document.getElementById('stat-level');
const xpDisplay = document.getElementById('stat-xp');
const xpNextDisplay = document.getElementById('stat-xp-next');
const inGameStatPointsDisplay = document.getElementById('stat-points-available-display');
const turnDisplay = document.getElementById('stat-turn');
const hpDisplay = document.getElementById('stat-hp');
const maxHpDisplay = document.getElementById('stat-max-hp');
const manaDisplay = document.getElementById('stat-mana');
const maxManaDisplay = document.getElementById('stat-max-mana');
const strDisplay = document.getElementById('stat-str');
const dexDisplay = document.getElementById('stat-dex');
const intDisplay = document.getElementById('stat-int');
const conDisplay = document.getElementById('stat-con');
const chaDisplay = document.getElementById('stat-cha');
const goldDisplay = document.getElementById('stat-gold');
const reputationMarker = document.getElementById('reputation-marker');
const reputationValueTextDisplay = document.getElementById('stat-reputation-value-text');
const locationDisplay = document.getElementById('stat-location');
const inventoryList = document.getElementById('inventory-list');
const inventoryCount = document.getElementById('inventory-count');
const inventoryCapacity = document.getElementById('inventory-capacity');
const questList = document.getElementById('quest-list');
const skillsList = document.getElementById('skills-list');
const statusEffectsList = document.getElementById('status-effects-list'); // НОВОЕ
const statIncreaseButtons = document.querySelectorAll('.stat-increase-button');
const reputationDisplayWrapper = document.querySelector('.reputation-display-wrapper');
const reputationModal = document.getElementById('reputation-modal');

// Элементы Карты
const globalLocationsList = document.getElementById('global-locations-list');
const customLocationsList = document.getElementById('custom-locations-list');

// Элементы Панели Окружения (НОВОЕ)
const environmentList = document.getElementById('environment-list');
let entityTooltip = null; // Будет создан динамически

// Элементы Игрового Меню
const menuOverlay = document.getElementById('menu-overlay');
const inGameMenu = document.getElementById('in-game-menu');
const inGameSaveButton = document.getElementById('in-game-save-button');
const inGameSettingsButton = document.getElementById('in-game-settings-button'); // <-- [НОВЫЙ ЭЛЕМЕНТ]
const inGameExitButton = document.getElementById('in-game-exit-button');
const closeInGameMenuButton = document.getElementById('close-in-game-menu-button');
const settingsBackButton = document.getElementById('settings-back-button'); // <-- [НОВЫЙ ЭЛЕМЕНТ]

// Музыка
const audioPlayer = document.getElementById('background-music-player');
const toggleMusicButton = document.getElementById('toggle-music-button');
const toggleMusicIcon = toggleMusicButton?.querySelector('i');

// TTS (Text-to-Speech)
const TTS_VOICE_STORAGE_KEY = 'textRpgTTSVoice_v1';
const toggleTTSButton = document.getElementById('toggle-tts-button');
const toggleTTSIcon = toggleTTSButton?.querySelector('i');


// --- Константы и Настройки ---
const DEBUG_MODE = true;
let PROXY_API_ENDPOINT = '';
const SAVE_FILE_PREFIX = 'meterea_save_';
const SAVE_FILE_EXTENSION = '.json';
let GEMINI_API_KEY = '';
const MAX_HISTORY = 12; // Количество пар (пользователь + модель) в истории для Gemini
const MAX_MANUAL_SAVES = 5;
const MAX_AUTO_SAVES = 20;
const AUTOSAVE_INTERVAL = 5 * 60 * 1000; // 5 минут
const MEMORY_SUMMARY_TURN = 29; // Ход, на котором GM делает выжимку памяти
const MEMORY_PRUNE_TURN = 30; // Ход, на котором история для GM очищается
const INITIAL_STAT_POINTS = 10;
const POINTS_PER_LEVEL = 4;
const SAVE_STORAGE_KEY = 'textRpgSaves_v3';
const DEFAULT_WORLD_ID = 'world_metera';
const LANGUAGE_STORAGE_KEY = 'textRpgLang_v1';
const DEFAULT_LANGUAGE = 'ru';
const SOUND_FOLDER_PATH = "assets/sound/";

const musicFiles = [
    'phone1.mp3', 'phone2.mp3', 'phone3.mp3', 'phone4.mp3'
];
const MUSIC_VOLUME = 0.2;

const backgroundFiles = [
    'Backgrounds_pixel.jpg', '13.jpg', '12.jpg', '14.jpg', '15.jpg'
];
const BACKGROUND_CHANGE_INTERVAL = 3.5 * 60 * 1000; // 3.5 минуты

const BASE_CLASS_STATS = {
    warrior: { str: 13, dex: 10, int: 8, con: 12, cha: 9 },
    mage:    { str: 8,  dex: 11, int: 13, con: 9, cha: 11 },
    rogue:   { str: 10, dex: 13, int: 10, con: 10, cha: 9 },
    bard:    { str: 9,  dex: 12, int: 11, con: 9, cha: 12 },
    default: { str: 10, dex: 10, int: 10, con: 10, cha: 10 }
};

const RACE_MODIFIERS = {
    human: { str: 1, dex: 1, int: 1, con: 1, cha: 1 },
    elf:   { str: 0, dex: 2, int: 1, con: 0, cha: 0 },
    dwarf: { str: 1, dex: 0, int: 0, con: 2, cha: 0 }
};

let predefinedStatusEffects = {
    // --- Негативные эффекты (Дебаффы) ---
    "minor_burn_dot": {
        name: "Слабое горение",
        description: "Вы чувствуете легкий жар. Наносит небольшой урон огнем каждый ход.",
        effectsJSON: `[{"trigger":{"type":"on_turn_start","interval":1},"action":{"type":"modify_stat","stat":"hp","change":-2}}]`
    },
    "weak_poison_dot": {
        name: "Слабый яд",
        description: "Яд медленно действует в ваших жилах. Наносит урон и ослабляет.",
        effectsJSON: `[
            {"trigger":{"type":"on_turn_start","interval":1},"action":{"type":"modify_stat","stat":"hp","change":-1}},
            {"trigger":{"type":"on_apply"},"action":{"type":"modify_stat","stat":"str","change":-1}},
            {"trigger":{"type":"on_remove"},"action":{"type":"modify_stat","stat":"str","change":1}}
        ]`
    },
    "curse_of_clumsiness": {
        name: "Проклятие неуклюжести",
        description: "Ваши движения стали неловкими (-2 к Ловкости).",
        effectsJSON: `[
            {"trigger":{"type":"on_apply"},"action":{"type":"modify_stat","stat":"dex","change":-2}},
            {"trigger":{"type":"on_remove"},"action":{"type":"modify_stat","stat":"dex","change":2}}
        ]`
    },

    // --- Позитивные эффекты (Баффы) ---
    "blessing_of_might": {
        name: "Благословение силы",
        description: "Вы чувствуете прилив сил (+2 к Силе).",
        // --- КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Используем modify_stat, а не set_stat ---
        effectsJSON: `[
            {"trigger":{"type":"on_apply"},"action":{"type":"modify_stat","stat":"str","change":2}},
            {"trigger":{"type":"on_remove"},"action":{"type":"modify_stat","stat":"str","change":-2}}
        ]`
    },
    "blessing_of_luck": {
        name: "Благословение удачи",
        description: "Вы чувствуете прикосновение удачи (+2 к Ловкости).",
        effectsJSON: `[
            {"trigger":{"type":"on_apply"},"action":{"type":"modify_stat","stat":"dex","change":2}},
            {"trigger":{"type":"on_remove"},"action":{"type":"modify_stat","stat":"dex","change":-2}}
        ]`
    },
    "minor_regeneration": {
        name: "Слабая регенерация",
        description: "Ваши раны медленно затягиваются (+1 HP каждый ход).",
        effectsJSON: `[{"trigger":{"type":"on_turn_start","interval":1},"action":{"type":"modify_stat","stat":"hp","change":1}}]`
    }
};

const standardItemDescriptions = {
    'sword_short': () => t('itemDescriptions.shortSword', null, 'Простой, но надежный короткий меч. Базовое оружие ближнего боя.'),
    'shield_wooden': () => t('itemDescriptions.woodenShield', null, 'Круглый деревянный щит. Обеспечивает минимальную защиту.'),
    'potion_heal_small': () => t('itemDescriptions.smallHealthPotion', null, 'Маленькая склянка с красной жидкостью. Восстанавливает немного здоровья.'),
    'staff_simple': () => t('itemDescriptions.simpleStaff', null, 'Гладкий деревянный посох. Помогает фокусировать магическую энергию.'),
    'robe_novice': () => t('itemDescriptions.noviceRobe', null, 'Простая роба, которую носят начинающие маги. Практически не защищает.'),
    'mana_potion_small': () => t('itemDescriptions.smallManaPotion', null, 'Маленькая склянка с синей жидкостью. Восстанавливает немного маны.'),
    'dagger_basic': () => t('itemDescriptions.basicDagger', null, 'Обычный кинжал. Быстрое, но слабое оружие.'),
    'leather_armor_light': () => t('itemDescriptions.lightLeatherArmor', null, 'Легкий доспех из обработанной кожи. Дает небольшую защиту, не стесняя движений.'),
    'lockpicks': () => t('itemDescriptions.lockpicks', null, 'Набор тонких металлических инструментов для вскрытия замков.'),
    'lute_simple': () => t('itemDescriptions.simpleLute', null, 'Простая лютня. Инструмент для бардовских песен и заклинаний.'),
    'colorful_clothes': () => t('itemDescriptions.colorfulClothes', null, 'Яркая и удобная одежда, подходящая для выступлений.'),
    'gold': () => t('itemDescriptions.gold', null, 'Блестящие золотые монеты. Основная валюта.')
};

// --- ДЕТЕКТОР СРЕДЫ (Electron или Браузер) ---
const isElectron = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    return userAgent.indexOf(' electron/') > -1;
};
console.log("Environment:", isElectron() ? "Electron (Desktop)" : "Web Browser");

// --- Глобальные переменные ---
let settingsReturnScreen = 'main-menu'; // Экран для возврата из настроек

let recognition;
let isRecognizing = false;

let narrators = [];
let currentNarratorIndex = 0;
let tempPlayer = null; // Для временного хранения персонажа
let directoryHandle = null;
let lastFSAErrorTime = 0; // Для предотвращения спама alert'ами
const FSA_ERROR_COOLDOWN = 10000; // 10 секунд

let pendingDiceRoll = null;

let itemsReferenceData = null; // Will store the array of item objects
let gmFeedbackMessages = [];
let playerActionQueue = []; // <-- [НОВАЯ ПЕРЕМЕННАЯ] Будет хранить действия игрока
let nextInternalItemId = 1;
let itemTooltipElement = null; // Для кастомных DnD тултипов

function queuePlayerActionForGM(actionDescription) {
    if (!actionDescription) return;
    playerActionQueue.push(`(System Note: The player performed the action: "${actionDescription}")`);
    console.log(`[Action Queued for GM] ${actionDescription}`);
}

let worldLore = "Загрузка лора...";
let globalLocations = {};
let skillsReferenceData = "Загрузка справочника умений...";
let environmentCommandsGuideData = "Загрузка руководства по командам окружения...";
let currentTrackIndex = -1;
let isMusicPlaying = false;
let userInteractedForMusic = false;
let isUsingBuiltInKey = false;
let builtInKeysCache = null;
let currentBuiltInKey = null;

let availableLanguages = {};
let currentLanguage = DEFAULT_LANGUAGE;
let translations = {};

let player = null;
let conversationHistory = [];
let isWaitingForAI = false;
let currentCreationStats = {};
let baseStatsForDistribution = {};
let availableStatPoints = INITIAL_STAT_POINTS;
let autoSaveTimer = null;
let currentSaveSlot = null;
let nextInternalQuestId = 1; // <--- НОВЫЙ СЧЕТЧИК

let backgroundChangeTimer = null;
let currentBackgroundElement = null;
let lastBackgroundIndex = -1;

// TTS
let isTTSEnabled = false;
let speechSynthesis = window.speechSynthesis;
let ttsUtterance = null;
let ttsVoices = [];
let selectedTTSVoice = null;
let ttsLang = 'ru-RU';

/**
 * Настраивает Web Speech API для распознавания речи.
 * Вызывается при переходе на игровой экран.
 */
function setupSpeechRecognition() {
    // Проверяем, не был ли уже инициализирован объект
    if (recognition) {
        recognition.lang = ttsLang; // Просто обновляем язык, если объект уже есть
        console.log(`Язык распознавания речи обновлен на: ${recognition.lang}`);
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.warn("Web Speech API (распознавание речи) не поддерживается этим браузером.");
        if(voiceInputButton) voiceInputButton.style.display = 'none';
        return;
    }
    
    // Если API поддерживается, показываем кнопку
    if(voiceInputButton) voiceInputButton.style.display = 'inline-block';

    recognition = new SpeechRecognition();
    recognition.continuous = false; // Распознаем одну фразу за раз
    recognition.lang = ttsLang;     // Используем язык, установленный для TTS (например, 'ru-RU')
    recognition.interimResults = true; // Показываем промежуточные результаты для лучшего UX

    // Обработчик получения результатов
    recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        
        // Обновляем поле ввода окончательным результатом, если он есть, иначе промежуточным
        userInput.value = finalTranscript || interimTranscript;
        
        if(finalTranscript.trim()){
            console.log("Финальный распознанный текст:", finalTranscript);
        }
    };

    // Обработчик начала записи
    recognition.onstart = () => {
        isRecognizing = true;
        voiceInputButton.classList.add('listening');
        voiceInputButton.title = t('gameInterface.input.voiceInputTooltipStop', 'Остановить запись');
        voiceInputButton.dataset.i18n = "[title]gameInterface.input.voiceInputTooltipStop";
    };

    // Обработчик окончания записи
    recognition.onend = () => {
        isRecognizing = false;
        voiceInputButton.classList.remove('listening');
        voiceInputButton.title = t('gameInterface.input.voiceInputTooltipStart', 'Начать голосовой ввод');
        voiceInputButton.dataset.i18n = "[title]gameInterface.input.voiceInputTooltipStart";
    };

    // Обработчик ошибок
    recognition.onerror = (event) => {
        console.error("Ошибка распознавания речи:", event.error);
        let errorMessage;
        if (event.error === 'no-speech') {
            errorMessage = t('gameInterface.log.voiceRecognitionNoSpeech', 'Речь не распознана. Попробуйте еще раз.');
        } else if (event.error === 'not-allowed') {
            errorMessage = t('gameInterface.log.voiceRecognitionNotAllowed', 'Доступ к микрофону заблокирован. Проверьте разрешения сайта в настройках браузера.');
        } else {
            errorMessage = t('gameInterface.log.voiceRecognitionError', { error: event.error });
        }
        addLogMessage(errorMessage, 'system-message');
    };
}

function openSettingsFromGame() {
    console.log("Открытие настроек из игрового меню.");
    closeInGameMenu();
    settingsReturnScreen = 'game-interface'; // Запоминаем, что мы пришли из игры
    setActiveScreen('settings-menu');
}

/**
 * Включает или выключает распознавание речи по клику на кнопку.
 */
function toggleVoiceRecognition() {
    if (!recognition) {
        console.error("Объект распознавания речи не инициализирован.");
        return;
    }
    if (isRecognizing) {
        recognition.stop();
    } else {
        // Очищаем поле ввода перед началом нового распознавания
        userInput.value = '';
        recognition.start();
    }
}

// Функция для вызова окна подтверждения
function showCustomConfirm(message, onYesCallback) {
    const modal = document.getElementById('custom-confirm-modal');
    const msgEl = document.getElementById('custom-confirm-message');
    const yesBtn = document.getElementById('confirm-yes-btn');
    const noBtn = document.getElementById('confirm-no-btn');

    if (!modal) return;

    msgEl.textContent = message;
    modal.style.display = 'flex';
    
    // Анимация
    requestAnimationFrame(() => {
        modal.classList.add('visible');
    });

    // Очистка событий перед назначением новых (чтобы не стакались)
    const closeModal = () => {
        modal.classList.remove('visible');
        setTimeout(() => modal.style.display = 'none', 300);
        yesBtn.onclick = null;
        noBtn.onclick = null;
        
        // ФИКС ФОКУСА: Возвращаем фокус на body после закрытия
        if (document.activeElement) document.activeElement.blur();
    };

    yesBtn.onclick = () => {
        closeModal();
        if (onYesCallback) onYesCallback();
    };

    noBtn.onclick = () => {
        closeModal();
    };
}

/**
 * Обновляет панель заметок GM.
 * Панель видна только если DEBUG_MODE === true.
 */
function updateGmNotesDisplay() {
    if (!gmNotesPanel || !gmNotesContent) return;
    if (DEBUG_MODE && player) {
        gmNotesPanel.style.display = 'flex';
        let displayHtml = '<strong>АКТИВНАЯ ПАМЯТЬ:</strong>\n';
        for (const [key, value] of Object.entries(player.gmNotes || {})) {
            displayHtml += `<span style="color:#5dade2">[${key}]</span>: ${value}\n`;
        }
        displayHtml += '\n<strong>АРХИВЫ (Сводка):</strong>\n';
        for (const [key, summary] of Object.entries(player.archiveSummaries || {})) {
            displayHtml += `<span style="color:#f39c12">[${key}]</span>: ${summary}\n`;
        }
        gmNotesContent.innerHTML = displayHtml || t('gameInterface.gmNotesPanel.empty', 'Заметок пока нет.');
    } else {
        gmNotesPanel.style.display = 'none';
    }
}

// --- Функции Управления Рассказчиками (НОВОЕ) ---

async function loadNarrators() {
    try {
        const response = await fetch('data/narrators.json');
        if (!response.ok) throw new Error('Не удалось загрузить narrators.json');
        narrators = await response.json();
        console.log("Рассказчики загружены:", narrators);
    } catch (error) {
        console.error("Ошибка загрузки рассказчиков:", error);
        // Fallback, если файл не найден
        narrators = [{
            id: "classic",
            name: "Классический Рассказчик",
            description: "Произошла ошибка загрузки. Доступен только классический режим.",
            image: "assets/narrators/classic.jpg",
            promptFile: "assets/narrators/style_classic.txt"
        }];
    }
}

function showNarrator(index) {
    if (!narrators || narrators.length === 0) return;
    currentNarratorIndex = (index + narrators.length) % narrators.length;
    const narrator = narrators[currentNarratorIndex];
    
    // Находим карточку по ID, который мы добавили в HTML
    // const narratorCard = document.getElementById('narrator-card'); // Уже объявлена глобально

    if (narratorCard) {
        // Меняем фоновое изображение карточки
        narratorCard.style.backgroundImage = `url('${narrator.image}')`;
    } else {
        console.error("Элемент narrator-card не найден!");
    }
    
    // Обновляем текст как и раньше
    narratorName.textContent = narrator.name;
    narratorDesc.textContent = narrator.description;
}

// --- Функции Управления Экраном Загрузки (НОВОЕ) ---

function updateEraDescription() {
    if (!charEraSelect || !eraDescriptionBox) return;

    // Находим выбранный элемент <option>
    const selectedOption = charEraSelect.options[charEraSelect.selectedIndex];
    if (!selectedOption) {
        eraDescriptionBox.classList.remove('visible');
        eraDescriptionBox.innerHTML = '';
        return;
    }

    // Получаем ключ для текста напрямую из data-атрибута
    const descriptionKey = selectedOption.dataset.descriptionKey;
    const descriptionText = t(descriptionKey, null, '');

    // Прячем блок, чтобы сменить текст и запустить анимацию заново
    eraDescriptionBox.classList.remove('visible');

    setTimeout(() => {
        if (descriptionText) {
            eraDescriptionBox.innerHTML = descriptionText;
            eraDescriptionBox.classList.add('visible');
        } else {
            eraDescriptionBox.innerHTML = '';
        }
    }, 200); // Небольшая задержка для плавной анимации
}

// --- Функции File System Access API ---

async function requestDirectoryPermission() {
    if (!fsaApiAvailable) return null;
    try {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        await saveDirectoryHandleToDB(handle); // Сохраняем полученный хэндл в IndexedDB
        directoryHandle = handle;
        console.log("Доступ к директории получен и сохранен:", directoryHandle.name);
        updateFSAStatus(directoryHandle, 'granted_new_selection');
        return directoryHandle;
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log("Пользователь отменил выбор директории.");
        } else {
            console.error("Ошибка при запросе доступа к директории:", error);
        }
        updateFSAStatus(directoryHandle, 'selection_cancelled');
        return null;
    }
}

// 1. Конфигурация кнопок (Типы бросков)
const quickTags = [
    { label: '⚔️ Attack', type: 'combat', stat: 'atk' },
    { label: '🛡️ Defend', type: 'combat', stat: 'def' },
    { label: '🎲 D20', type: 'stat', stat: 'd20' },
    { label: '💪 STR', type: 'stat', stat: 'str' },
    { label: '🤸 DEX', type: 'stat', stat: 'dex' },
    { label: '🧠 INT', type: 'stat', stat: 'int' },
    { label: '❤️ CON', type: 'stat', stat: 'con' },
    { label: '🗣️ CHA', type: 'stat', stat: 'cha' }
];

// 2. Инициализация панели кнопок (Вызывается при старте игры)
function initQuickTags() {
    const container = document.getElementById('quick-tags-bar');
    if (!container) return;
    
    container.innerHTML = ''; // Очистка перед созданием

    quickTags.forEach(tag => {
        const btn = document.createElement('div');
        btn.className = `tag-chip ${tag.type}`;
        btn.textContent = tag.label;
        
        // При клике создаем не текст, а визуальную плашку
        btn.addEventListener('click', (e) => {
            e.preventDefault(); 
            createRollBadge(tag.stat, tag.label);
        });
        
        container.appendChild(btn);
    });
}

// 3. Создание плашки с результатом (Математика происходит здесь)
function createRollBadge(statKey, labelText) {
    if (!player) return;

    const container = document.getElementById('active-rolls-container');
    if (!container) return;
    
    if (container.children.length >= 5) return;

    // --- НОВАЯ ЛОГИКА: "СИСТЕМА ТАРГЕТНОГО ЧИСЛА" ---
    const roll = Math.floor(Math.random() * 20) + 1;
    let modifier = 0;
    let cleanLabel = labelText.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '').trim(); 

    // Рассчитываем полный модификатор, как и раньше, но НЕ прибавляем его к броску
    switch (statKey) {
        case 'str':
        case 'dex':
        case 'int':
        case 'con':
        case 'cha':
            modifier = getStatModifier(statKey);
            cleanLabel = `${statKey.toUpperCase()} Check`;
            break;
        case 'atk':
            if (['rogue', 'bard', 'ranger'].includes(player.class)) {
                modifier = getStatModifier('dex');
            } else {
                modifier = getStatModifier('str');
            }
            cleanLabel = "Attack";
            break;
        case 'def': 
            modifier = getStatModifier('dex');
            cleanLabel = "Defend";
            break;
        case 'd20': 
            modifier = 0;
            cleanLabel = "D20 Roll";
            break;
    }
    
    // Формируем текст для GM. Теперь он содержит всю информацию для расчета.
    const resultText = `[ROLL_RESULT: ${roll} | STAT: ${statKey} | MOD: ${modifier}]`;

    const badge = document.createElement('div');
    badge.className = 'roll-badge';
    
    if (roll === 20) badge.classList.add('crit-success');
    if (roll === 1) badge.classList.add('crit-fail');

    badge.dataset.resultText = resultText; 
    
    // Игрок видит только свой чистый бросок!
    badge.innerHTML = `
        <span>${cleanLabel}: ${roll}</span>
        <span class="roll-badge-close" title="Удалить бросок">✖</span>
    `;

    badge.querySelector('.roll-badge-close').addEventListener('click', () => {
        badge.remove();
    });

    container.appendChild(badge);
}

// 4. Парсер тегов (превращает {d20_str} в результат броска)
function parseInlineRolls(text) {
    if (!player) return text;

    // Регулярка ищет всё в фигурных скобках
    return text.replace(/\{(.*?)\}/g, (match, content) => {
        const tag = content.toLowerCase().trim();
        
        // Если это команда броска (начинается с d20_) или просто d20
        if (tag.startsWith('d20')) {
            let roll = Math.floor(Math.random() * 20) + 1;
            let modifier = 0;
            let label = "D20";

            // Если это специфичный бросок (например d20_str)
            if (tag.includes('_')) {
                const statName = tag.split('_')[1];
                
                switch (statName) {
                    case 'str': 
                        modifier = Math.floor((player.stats.str - 10) / 2);
                        label = "STR Check";
                        break;
                    case 'dex': 
                        modifier = Math.floor((player.stats.dex - 10) / 2);
                        label = "DEX Check";
                        break;
                    case 'int': 
                        modifier = Math.floor((player.stats.int - 10) / 2);
                        label = "INT Check";
                        break;
                    case 'con': 
                        modifier = Math.floor((player.stats.con - 10) / 2);
                        label = "CON Check";
                        break;
                    case 'cha': 
                        modifier = Math.floor((player.stats.cha - 10) / 2);
                        label = "CHA Check";
                        break;
                    case 'atk':
                        // Авто-выбор стата для атаки
                        if (['rogue', 'bard', 'ranger'].includes(player.class)) {
                            modifier = Math.floor((player.stats.dex - 10) / 2);
                            label = "Attack (DEX)";
                        } else {
                            modifier = Math.floor((player.stats.str - 10) / 2);
                            label = "Attack (STR)";
                        }
                        break;
                    case 'def':
                        modifier = Math.floor((player.stats.dex - 10) / 2);
                        label = "Defend";
                        break;
                }
            }

            const total = roll + modifier;
            const sign = modifier >= 0 ? "+" : "";
            
            // Формат вывода: [🎲 STR Check: 15 (roll:12+3)]
            return `[🎲 ${label}: ${total} (roll:${roll}${sign}${modifier})]`;
        }

        // Если тег не распознан, возвращаем как есть
        return match;
    });
}

async function verifyDirectoryHandlePermission(handle) {
    if (!handle || typeof handle.queryPermission !== 'function') {
        console.error("Попытка проверить невалидный хэндл.");
        return false;
    }
    
    // Сначала тихо проверяем, есть ли у нас уже разрешение.
    if (await handle.queryPermission({ mode: 'readwrite' }) === 'granted') {
        return true;
    }
    
    // Если разрешения нет, запрашиваем его. Это вызовет всплывающее окно.
    if (await handle.requestPermission({ mode: 'readwrite' }) === 'granted') {
        return true;
    }
    
    // Пользователь отказал в доступе.
    return false;
}

/**
 * УНИВЕРСАЛЬНЫЙ И ПОЛНЫЙ СЛЕПОК ДАННЫХ (SNAPSHOT)
 * Здесь собраны ВСЕ данные объекта player без исключений.
 */
function buildFullPlayerSnapshot() {
    if (!player) return "КРИТИЧЕСКАЯ ОШИБКА: ДАННЫЕ ИГРОКА ОТСУТСТВУЮТ";

    const inHands = player.equipment.right_hand ? player.equipment.right_hand.name : 'Ничего';
    return `
=== ПОЛНОЕ ТЕХНИЧЕСКОЕ СОСТОЯНИЕ ОБЪЕКТА PLAYER ===
Имя: ${player.name}
В РУКАХ (Оружие): ${inHands}
Раса: ${player.race}
Класс: ${player.class}
Эпоха: ${player.era}
Описание персонажа: ${player.description}
Локация: ${player.location}
Текущий ход: ${player.stats.turnCount}

ХАРАКТЕРИСТИКИ:
Уровень: ${player.stats.level} | XP: ${player.stats.xp}/${player.stats.xpNext}
Золото: ${player.stats.gold} | Очки характеристик: ${player.stats.statPoints}
HP: ${player.stats.hp}/${player.stats.maxHp}
Mana: ${player.stats.mana}/${player.stats.maxMana}
STR (Сила): ${player.stats.str}
DEX (Ловкость): ${player.stats.dex}
INT (Интеллект): ${player.stats.int}
CON (Выносливость): ${player.stats.con}
CHA (Харизма): ${player.stats.cha}

РЕПУТАЦИЯ ПО ФРАКЦИЯМ:
${JSON.stringify(player.stats.reputation, null, 2)}

ИНВЕНТАРЬ (ПОЛНЫЙ):
${JSON.stringify(player.inventory, null, 2)}

ЭКИПИРОВКА (ПО СЛОТАМ):
${JSON.stringify(player.equipment, null, 2)}

КОНСТАНТЫ NEXUS (СЮЖЕТНЫЕ ФЛАГИ):
${JSON.stringify(player.nexusData, null, 2)}

ВИДИМОЕ ОКРУЖЕНИЕ (NPC И СУЩЕСТВА):
${JSON.stringify(player.visibleEntities, null, 2)}

ЖУРНАЛ ЗАДАНИЙ (ВСЕ АКТИВНЫЕ):
${JSON.stringify(Object.values(player.quests || {}).filter(q => q.status === 'active'), null, 2)}

=== ПАМЯТЬ GM (БЛОКИ) ===
АКТИВНЫЕ ЗАМЕТКИ:
${JSON.stringify(player.gmNotes, null, 2)}

СВОДКА АРХИВОВ (Доступно для команды searchArchive):
${JSON.stringify(player.archiveSummaries, null, 2)}
==================================================
`;
}

function processAutomatedNexusEffects() {
    if (!player || !player.nexusData) return;

    // --- СЮДА МОЖНО ДОБАВИТЬ ЛЮБЫЕ АВТОМАТИЧЕСКИЕ ЭФФЕКТЫ ---

    // Пример: Автоматическая выдача золота в режиме отладки
    const goldPerTurnEffect = player.nexusData['debug_gold_per_turn'];
    if (goldPerTurnEffect && goldPerTurnEffect.displayType === 'numeric') {
        const goldToAdd = parseInt(goldPerTurnEffect.value, 10);
        if (!isNaN(goldToAdd) && goldToAdd !== 0) {
            player.stats.gold = (player.stats.gold || 0) + goldToAdd;
            // Выводим сообщение в лог расчетов, чтобы не засорять основной
            const feedback = t('gameInterface.commandFeedback.goldChanged', { change: `+${goldToAdd}`, gold: player.stats.gold });
            addCalculationMessage(`[AUTO] ${feedback}`);
        }
    }
    
    // После обработки всех эффектов, обновляем интерфейс
    updateCharacterSheet();
}

async function ensureDirectoryHandleAndPermission() {
    if (window.electronAPI && window.electronAPI.isElectron) {
        return true; 
    }
    // Для веба возвращаем false (или старую логику, если она там осталась)
    return false;
}

async function getFileHandleFromDir(dirHandle, fileName, options = {}) {
    if (!dirHandle) {
        console.warn(`getFileHandleFromDir: dirHandle отсутствует для файла "${fileName}".`);
        return null;
    }
    try {
        // 1. Проверяем разрешение перед каждой операцией
        const permission = await dirHandle.queryPermission({ mode: 'readwrite' });
        if (permission !== 'granted') {
            console.warn(`getFileHandleFromDir: Нет разрешения 'granted' для директории при попытке получить handle для ${fileName}. Статус: ${permission}. Попытка запроса...`);
            // 2. Если разрешение не 'granted', пытаемся запросить его снова
            if (await dirHandle.requestPermission({ mode: 'readwrite' }) !== 'granted') {
                // 3. Если запрос не помог, сбрасываем handle и обновляем статус
                const now = Date.now();
                if (now - lastFSAErrorTime > FSA_ERROR_COOLDOWN) {
                    alert(t('fsa.permissionRequiredOperation', 'Для выполнения операции требуется разрешение на доступ к папке.'));
                    lastFSAErrorTime = now;
                }
                directoryHandle = null; // Важно: сбрасываем handle
                updateFSAStatus(null, 'permission_revoked_on_operation');
                return null;
            }
            console.log("getFileHandleFromDir: Разрешение получено после повторного запроса.");
        }
        // 4. Если разрешение есть, получаем fileHandle
        return await dirHandle.getFileHandle(fileName, options);
    } catch (e) {
        if (e.name === 'NotFoundError' && !options.create) {
            return null; // Файл не найден (и не должен создаваться) - это не ошибка для некоторых операций
        }
        console.error(`getFileHandleFromDir: Ошибка получения fileHandle для "${fileName}":`, e);
        // 5. При других ошибках, особенно связанных с разрешениями, сбрасываем handle
        if (e.name === 'NotAllowedError' || e.name === 'SecurityError' || e.name === 'InvalidStateError') {
            directoryHandle = null;
            updateFSAStatus(null, 'permission_error_on_file_op');
            const now = Date.now();
            if (now - lastFSAErrorTime > FSA_ERROR_COOLDOWN) {
                alert(t('fsa.permissionRevokedError', 'Разрешение на доступ к папке было отозвано или утеряно. Пожалуйста, выберите папку заново.'));
                lastFSAErrorTime = now;
            }
        }
        return null;
    }
}

async function readFileFromFSA(fileName) {
    if (window.electronAPI && window.electronAPI.isElectron) {
        try {
            const data = await window.electronAPI.loadGame(fileName);
            if (data) {
                console.log(`[Electron] Файл "${fileName}" загружен.`);
                return data;
            } else {
                console.warn(`[Electron] Файл "${fileName}" не найден.`);
                return null;
            }
        } catch (error) {
            console.error(`[Electron] Ошибка чтения:`, error);
            return null;
        }
    }
    return null;
}

async function writeFileToFSA(fileName, data) {
    // Если мы в Electron
    if (window.electronAPI && window.electronAPI.isElectron) {
        try {
            // Вызываем метод из main.js через preload
            const result = await window.electronAPI.saveGame(fileName, data);
            
            if (result.success) {
                console.log(`[Electron] Файл "${fileName}" успешно сохранен.`);
                return true;
            } else {
                console.error(`[Electron] Ошибка сохранения:`, result.error);
                // Показываем твое красивое окно ошибки, если есть, или alert
                if (typeof showCustomAlert === 'function') {
                    showCustomAlert(`Ошибка сохранения файла: ${result.error}`);
                } else {
                    alert(`Ошибка сохранения: ${result.error}`);
                }
                return false;
            }
        } catch (error) {
            console.error(`[Electron] Критическая ошибка записи:`, error);
            return false;
        }
    }
    
    // Если это веб - функция просто не сработает (вернет false)
    return false;
}

function updateReputationModal() {
    if (!player || !reputationModal) return;

    const reputations = player.stats.reputation;
    const contentDiv = document.getElementById('reputation-modal-content');
    if (!contentDiv) return;

    contentDiv.innerHTML = ''; // Очищаем старое содержимое
    let htmlContent = '';

    const factionKeys = Object.keys(reputations).sort((a, b) => {
        if (a === 'global') return -1; // global всегда первая
        if (b === 'global') return 1;
        return a.localeCompare(b);
    });

    for (const factionKey of factionKeys) {
        const value = reputations[factionKey];
        const factionName = player.factionData?.[factionKey] || factionKey;

        const minRep = -100;
        const maxRep = 100;
        const totalRange = maxRep - minRep;
        let markerPositionPercent = ((value - minRep) / totalRange) * 100;
        markerPositionPercent = Math.max(0, Math.min(100, markerPositionPercent));

        htmlContent += `
            <div class="faction-rep-row">
                <div class="faction-rep-label">${factionName}: <span>${value}</span></div>
                <div class="faction-rep-bar-container">
                    <div class="reputation-marker" style="left: ${markerPositionPercent}%;"></div>
                </div>
            </div>
        `;
    }

    contentDiv.innerHTML = htmlContent;
    reputationModal.classList.add('visible');
}

function positionReputationModal(event) {
    if (!reputationModal || !reputationModal.classList.contains('visible')) return;

    const xOffset = 15;
    const yOffset = -10; // Появляется чуть выше курсора
    
    let newX = event.clientX + xOffset;
    let newY = event.clientY + yOffset;

    const modalRect = reputationModal.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Предотвращаем выход за правый край экрана
    if (newX + modalRect.width > viewportWidth - 10) {
        newX = event.clientX - modalRect.width - xOffset;
    }
    // Предотвращаем выход за нижний край, сдвигая вверх
    if (newY + modalRect.height > viewportHeight - 10) {
        newY = viewportHeight - modalRect.height - 10;
    }
    // Предотвращаем выход за левый и верхний края
    if (newX < 10) newX = 10;
    if (newY < 10) newY = 10;

    reputationModal.style.left = `${newX}px`;
    reputationModal.style.top = `${newY}px`;
}

function pruneGameLog() {
    const MAX_LOG_MESSAGES = 100; // Храним в DOM только последние 100 сообщений
    if (gameLog && gameLog.children.length > MAX_LOG_MESSAGES) {
        // Удаляем старые сообщения, пока их не останется нужное количество
        while (gameLog.children.length > MAX_LOG_MESSAGES) {
            gameLog.removeChild(gameLog.firstChild);
        }
    }
}

function updateFSAStatus(currentHandle, reasonCode = '') {
    if (!fsaStatusElement) return;

    // ВЕТКА ELECTRON
    if (window.electronAPI && window.electronAPI.isElectron) {
        fsaStatusElement.textContent = t('fsa.directorySelected', { dirName: 'Локальное хранилище игры' });
        fsaStatusElement.style.color = '#2ecc71'; // Зеленый
        
        // Скрываем кнопку выбора папки (она не нужна в десктопе)
        if (fsaSelectDirectoryButton) {
            fsaSelectDirectoryButton.style.display = 'none';
        }
        return;
    }

    // ВЕТКА ВЕБ (Если вдруг запустили в браузере)
    // Тут просто пишем что API недоступен, так как FSA мы "выпилили" заменой функций
    fsaStatusElement.textContent = "Сохранения работают через LocalStorage (Браузер)";
    fsaStatusElement.style.color = '#f1c40f'; // Желтый
    if (fsaSelectDirectoryButton) fsaSelectDirectoryButton.style.display = 'none';
}

async function deleteFileFromFSA(fileName) {
    if (window.electronAPI && window.electronAPI.isElectron) {
        try {
            const success = await window.electronAPI.deleteSave(fileName);
            console.log(`[Electron] Удаление "${fileName}": ${success}`);
            return success;
        } catch (error) {
            console.error(`[Electron] Ошибка удаления:`, error);
            return false;
        }
    }
    return false;
}


async function listSaveFilesFromFSA() {
    // Эта функция теперь ТОЛЬКО для Electron, так как веб-версия не использует FSA.
    if (window.electronAPI && window.electronAPI.isElectron) {
        try {
            // Получаем "сырой" список файлов из main.js
            const rawSaves = await window.electronAPI.listSaves();
            console.log(`[Electron listSaves] Получено ${rawSaves.length} записей из main.js.`);
            
            // Преобразуем в формат, который ожидает остальная часть приложения
            return rawSaves.map(save => {
                const nameParts = save.filename.substring(SAVE_FILE_PREFIX.length, save.filename.length - SAVE_FILE_EXTENSION.length).split('_');
                const type = nameParts[0];
                const id = parseInt(nameParts[1], 10);
                return {
                    slotType: type,
                    slotId: id,
                    timestamp: save.timestamp,
                    playerData: save.playerData,
                    historyData: save.historyData,
                    fileName: save.filename // Важно сохранить имя файла!
                };
            }).filter(s => s.slotType && !isNaN(s.slotId)); // Отфильтровываем некорректные имена

        } catch (error) {
            console.error("[Electron] Ошибка получения списка сохранений из main.js:", error);
            return [];
        }
    }
    // Для веб-версии возвращаем пустой массив, так как она не использует эту функцию.
    return [];
}

function getSaveFileName(slotType, slotId) {
    const fileName = `${SAVE_FILE_PREFIX}${slotType}_${slotId}${SAVE_FILE_EXTENSION}`;
    console.log(`[getSaveFileName] Сгенерировано имя файла: ${fileName} для слота ${slotType} #${slotId}`);
    return fileName;
}

function updateFSAStatus(grantedAndHandleExists) {
    if (!fsaStatusElement || !fsaApiAvailable) return;

    if (grantedAndHandleExists && directoryHandle) {
        fsaStatusElement.textContent = t('fsa.directorySelected', { dirName: directoryHandle.name });
        fsaStatusElement.style.color = '#2ecc71';
        if (fsaSelectDirectoryButton) fsaSelectDirectoryButton.textContent = t('settingsMenu.fsaChangeDirectory', 'Сменить папку');
    } else if (localStorage.getItem('fsaDirSelected') === 'true' && !directoryHandle) {
        // Пользователь ранее выбирал папку, но хэндл не активен (например, после перезагрузки страницы)
        fsaStatusElement.textContent = t('fsa.permissionGrantedPreviouslyNeedsAction', 'Папка была выбрана. Нажмите "Выбрать папку", чтобы подтвердить.');
        fsaStatusElement.style.color = '#f1c40f';
        if (fsaSelectDirectoryButton) fsaSelectDirectoryButton.textContent = t('settingsMenu.fsaSelectDirectory', 'Выбрать папку для сохранений');
    } else {
        fsaStatusElement.textContent = t('fsa.directoryNotSelected', 'Папка для сохранений не выбрана. Используется localStorage.');
        fsaStatusElement.style.color = '#e74c3c';
        if (fsaSelectDirectoryButton) fsaSelectDirectoryButton.textContent = t('settingsMenu.fsaSelectDirectory', 'Выбрать папку для сохранений');
    }
}

// --- Функции для localStorage (Fallback) ---
function getAllSavesFromLocalStorage() {
    // --- ЖЕСТКАЯ БЛОКИРОВКА ---
    // Если мы в Electron, эта функция НИЧЕГО не делает и возвращает пустой результат.
    if (window.electronAPI && window.electronAPI.isElectron) {
        return { manual: [], auto: [] };
    }
    // --- Конец блокировки ---

    // Этот код выполнится только в веб-версии
    const savesJson = localStorage.getItem(SAVE_STORAGE_KEY);
    try {
        let saves = JSON.parse(savesJson);
        if (!saves || typeof saves !== 'object') {
            saves = { manual: [], auto: [] };
        }
        saves.manual = (saves.manual || []).filter(s => s && s.playerData && s.timestamp);
        saves.auto = (saves.auto || []).filter(s => s && s.playerData && s.timestamp);
        return saves;
    } catch (e) {
        console.error("Ошибка разбора сохранений из localStorage:", e);
        return { manual: [], auto: [] };
    }
}

function storeAllSavesToLocalStorage(saves) {
    // --- ЖЕСТКАЯ БЛОКИРОВКА ---
    // Если мы в Electron, эта функция НИЧЕГО не делает.
    if (window.electronAPI && window.electronAPI.isElectron) {
        return;
    }
    // --- Конец блокировки ---

    // Этот код выполнится только в веб-версии
    try {
        saves.manual = (saves.manual || []).filter(s => s && s.playerData && s.timestamp);
        saves.auto = (saves.auto || []).filter(s => s && s.playerData && s.timestamp);
        localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(saves));
    } catch (e) {
        console.error("Ошибка сохранения в localStorage:", e);
        const errorMsg = t("loadGame.errorStorageFull");
        addLogMessage(errorMsg, "system-message");
        alert(errorMsg);
    }
}

// --- Отображение сохраненной истории чата ---
function displaySavedChatHistory() {
    if (!gameLog || !conversationHistory || conversationHistory.length === 0) return;
    
    console.log(`Отрисовка истории: ${conversationHistory.length} сообщений.`);
    gameLog.innerHTML = '';

    conversationHistory.forEach(messageEntry => {
        if (!messageEntry.parts || !messageEntry.parts[0].text) return;

        const type = messageEntry.role === 'user' ? 'user-message' : 'gm-message';
        let rawText = messageEntry.parts[0].text;
        let textToShow = rawText;

        if (type === 'gm-message') {
            try {
                const start = rawText.indexOf('{');
                const end = rawText.lastIndexOf('}');
                if (start !== -1 && end !== -1) {
                    const jsonPart = rawText.substring(start, end + 1);
                    const parsed = JSON.parse(jsonPart);
                    textToShow = parsed.narrative || rawText.replace(jsonPart, '').trim();
                }
            } catch (e) {
                textToShow = rawText.replace(/\[COMMAND:.+?\]/g, '').trim();
            }
            
            if (textToShow.includes(t('error.gmBlockedMarker'))) return;
        }

        if (textToShow.trim()) {
            addLogMessage(textToShow, type);
        }
    });

    gameLog.scrollTo({ top: gameLog.scrollHeight, behavior: 'auto' });
}


// --- НОВАЯ СИСТЕМА ОБРАБОТКИ СТАТУС-ЭФФЕКТОВ ---

/**
 * Главная функция, обрабатывающая все активные статус-эффекты для сущности (игрока).
 * Вызывается в начале каждого хода.
 * @returns {Array<string>} Массив сообщений для игрового лога.
 */
function processStatusEffects() {
    if (!player || !player.statusEffects) {
        return [];
    }

    const logMessages = [];
    const effectsToRemove = [];
    const expiredEffectNames = [];

    for (const effectId in player.statusEffects) {
        const effect = player.statusEffects[effectId];

        // --- НОВАЯ ЛОГИКА ПРОВЕРКИ ДЛИТЕЛЬНОСТИ ---
        // Сначала проверяем, не истек ли эффект в НАЧАЛЕ этого хода.
        if (effect.duration <= 0) {
            effectsToRemove.push(effectId);
            expiredEffectNames.push(effect.name);
            continue; // Переходим к следующему эффекту, не обрабатывая его триггеры в этом ходу
        }

        // 1. Обработка триггеров для АКТИВНЫХ эффектов
        if (effect.effects && Array.isArray(effect.effects)) {
            effect.effects.forEach(subEffect => {
                if (subEffect.trigger && subEffect.action) {
                    if (checkEffectTrigger(effect, subEffect.trigger)) {
                        const message = applyEffectAction(player, effect, subEffect.action);
                        if (message) {
                            logMessages.push(message);
                        }
                    }
                }
            });
        }

        // 2. Уменьшение длительности В КОНЦЕ обработки хода.
        // Теперь эффект с duration: 1 будет действовать этот ход и истечет к началу следующего.
        effect.duration--;
    }

    // 4. Удаление истекших эффектов и запуск их on_remove действий
    if (effectsToRemove.length > 0) {
        effectsToRemove.forEach(idToRemove => {
            const removedEffect = player.statusEffects[idToRemove];
            if (removedEffect) {
                let specificActionOccurred = false;

                // Запускаем on_remove действия
                if (removedEffect.effects && Array.isArray(removedEffect.effects)) {
                    removedEffect.effects.forEach(subEffect => {
                        if (subEffect.trigger?.type === 'on_remove') {
                            const message = applyEffectAction(player, removedEffect, subEffect.action);
                            if (message) {
                                logMessages.push(message);
                                specificActionOccurred = true;
                            }
                        }
                    });
                }

                // Принудительное восстановление статов
                if (removedEffect.originalValues && typeof removedEffect.originalValues === 'object') {
                    for (const statToRestore in removedEffect.originalValues) {
                        const restoreAction = { type: 'restore_stat', stat: statToRestore };
                        const message = applyEffectAction(player, removedEffect, restoreAction);
                        if (message) {
                            logMessages.push(message);
                            specificActionOccurred = true;
                            console.warn(`Принудительное восстановление стата '${statToRestore}' для эффекта '${removedEffect.name}', т.к. GM не предоставил триггер on_remove.`);
                        }
                    }
                }

                delete player.statusEffects[idToRemove];

                if (!specificActionOccurred) {
                    logMessages.push(t('gameInterface.commandFeedback.statusEffectRemoved', { effectName: removedEffect.name }));
                }
            }
        });
    }

    // 5. Обновляем UI, если что-то изменилось
    if (logMessages.length > 0) {
        updateStatusEffectsDisplay();
        updateCharacterSheet();
    }

    // Возвращаем имена истекших эффектов для передачи GM
    player.expiredEffectsForGM = expiredEffectNames;
    return logMessages;
}

/**
 * Проверяет, должен ли сработать триггер эффекта в текущем ходу.
 * @param {object} effect - Полный объект статус-эффекта.
 * @param {object} trigger - Объект триггера.
 * @returns {boolean} - true, если триггер сработал.
 */
function checkEffectTrigger(effect, trigger) {
    if (trigger.type === 'on_turn_start') {
        const interval = trigger.interval || 1;
        const turnsPassed = player.stats.turnCount - effect.appliedTurn;
        // Срабатывает в 0-й ход (сразу при применении) и каждый 'interval' ход после
        return turnsPassed >= 0 && turnsPassed % interval === 0;
    }
    // Здесь можно добавить другие типы триггеров: on_damage_taken, on_attack, и т.д.
    return false;
}

/**
 * Применяет конкретное действие эффекта к сущности.
 * @param {object} entity - Сущность, на которую действует эффект (пока только player).
 * @param {object} effect - Родительский статус-эффект (для хранения originalValues).
 * @param {object} action - Объект действия.
 * @returns {string|null} Сообщение для лога или null.
 */
function applyEffectAction(entity, effect, action) {
    let message = null;
    try {
        switch (action.type) {
            case 'modify_stat': {
                const { stat, change } = action;
                const changeValue = parseInt(change, 10);
                if (!entity.stats || isNaN(changeValue)) break;

                const oldValue = entity.stats[stat] || 0;
                entity.stats[stat] = oldValue + changeValue;

                // Ограничения
                if (stat === 'hp') {
                    entity.stats.hp = Math.max(0, Math.min(entity.stats.hp, entity.stats.maxHp));
                }
                if (stat === 'mana' && entity.class === 'mage') {
                    entity.stats.mana = Math.max(0, Math.min(entity.stats.mana, entity.stats.maxMana));
                }
                
                const statName = t(`gameInterface.characterPanel.${stat}`, null, stat);
                const changeText = changeValue > 0 ? `+${changeValue}` : changeValue;
                message = t('gameInterface.log.effectModifyStat', { effectName: effect.name, statName: statName, change: changeText });
                break;
            }
            case 'set_stat': {
                const { stat, value } = action;
                const setValue = parseInt(value, 10);
                if (!entity.stats || isNaN(setValue)) break;

                // Сохраняем оригинальное значение, если оно еще не сохранено
                if (!effect.originalValues) {
                    effect.originalValues = {};
                }
                if (effect.originalValues[stat] === undefined) {
                    effect.originalValues[stat] = entity.stats[stat] || 0;
                }

                entity.stats[stat] = setValue;
                const statName = t(`gameInterface.characterPanel.${stat}`, null, stat);
                message = t('gameInterface.log.effectSetStat', { effectName: effect.name, statName: statName, value: setValue });
                break;
            }
            case 'restore_stat': {
                const { stat } = action;
                if (effect.originalValues && effect.originalValues[stat] !== undefined) {
                    entity.stats[stat] = effect.originalValues[stat];
                    const statName = t(`gameInterface.characterPanel.${stat}`, null, stat);
                    message = t('gameInterface.log.effectRestoreStat', { effectName: effect.name, statName: statName, value: entity.stats[stat] });
                    delete effect.originalValues[stat]; // Очищаем сохраненное значение
                }
                break;
            }
        }
    } catch (e) {
        console.error("Ошибка применения действия эффекта:", e, action);
    }
    return message;
}

// --- Система Сохранений / Загрузки (Основные функции) ---
async function saveGame(slotType, slotId) {
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
        historyData: structuredClone(conversationHistory)
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

/**
 * Загружает игру из указанного слота.
 * Приоритет отдается File System Access API, если доступно, иначе используется localStorage.
 * Обеспечивает обратную совместимость со старыми сохранениями.
 * @param {string} slotType - 'manual' или 'auto'.
 * @param {number} slotId - ID слота.
 */
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

            isMapInitialized = false; // Сброс карты для перецентрирования
            conversationHistory = structuredClone(saveData.historyData || []);
            
            // --- ОБЯЗАТЕЛЬНАЯ ПРОВЕРКА И ИНИЦИАЛИЗАЦИЯ ПОЛЕЙ ---
            player.stats = player.stats || {};
            player.inventory = player.inventory || {};
            player.equipment = player.equipment || {};

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
            player.statusEffects = player.statusEffects || {};
            player.visibleEntities = player.visibleEntities || {};
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
            
            const maxQuestId = Object.keys(player.quests).map(id => parseInt(id,10)).filter(id => !isNaN(id)).reduce((m, c) => Math.max(m, c), 0);
            nextInternalQuestId = (maxQuestId || 0) + 1;
            const maxItemId = Object.keys(player.inventory).map(id => parseInt(id,10)).filter(id => !isNaN(id)).reduce((m, c) => Math.max(m, c), 0);
            nextInternalItemId = (maxItemId || 0) + 1;
            const maxEntityId = Object.keys(player.visibleEntities).map(id => parseInt(id,10)).filter(id => !isNaN(id)).reduce((m, c) => Math.max(m, c), 0);
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

async function showLoadGameScreen() {
    await populateLoadGameScreen();
    setActiveScreen('load-game-screen');
}

async function populateLoadGameScreen() {
    manualSaveSlotsList.innerHTML = '';
    autoSaveSlotsList.innerHTML = '';

    const allSavesMap = new Map();
    let primarySourceMessage = (window.electronAPI && window.electronAPI.isElectron) ? t('loadGame.sourceFileSystem') : t('loadGame.sourceLocalStorage');

    if (window.electronAPI && window.electronAPI.isElectron) {
        try {
            const fsSaves = await listSaveFilesFromFSA();
            for (const save of fsSaves) {
                const key = `${save.slotType}_${save.slotId}`;
                allSavesMap.set(key, save);
            }
        } catch (e) { console.error(e); }
    }

    try {
        const lsSavesContainer = getAllSavesFromLocalStorage();
        const allLsSaves = [...(lsSavesContainer.manual || []), ...(lsSavesContainer.auto || [])];
        for (const save of allLsSaves) {
            const key = `${save.slotType}_${save.slotId}`;
            if (!allSavesMap.has(key)) allSavesMap.set(key, save);
        }
    } catch (e) { console.error(e); }
    
    const finalSavesList = Array.from(allSavesMap.values());

    if (finalSavesList.length === 0) {
        manualSaveSlotsList.innerHTML = `<li>${t('loadGame.noManualSaves')}</li>`;
        autoSaveSlotsList.innerHTML = `<li>${t('loadGame.noAutoSaves')}</li>`;
        return;
    }

    const manualSaves = finalSavesList.filter(s => s.slotType === 'manual');
    const autoSaves = finalSavesList.filter(s => s.slotType === 'auto');

    manualSaves.sort((a, b) => a.slotId - b.slotId).forEach(save => manualSaveSlotsList.appendChild(createSaveListItem(save)));
    
    for (let i = 1; i <= MAX_MANUAL_SAVES; i++) {
        if (!manualSaves.some(s => s.slotId === i)) {
            const li = document.createElement('li');
            li.classList.add('empty-slot');
            li.innerHTML = `<div class="save-info"><span class="slot-name">${t('loadGame.manualSlot', {id: i})} - ${t('loadGame.emptySlot')}</span></div>`;
            manualSaveSlotsList.appendChild(li);
        }
    }

    if (autoSaves.length > 0) {
        autoSaves.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).forEach(save => autoSaveSlotsList.appendChild(createSaveListItem(save)));
    } else {
        autoSaveSlotsList.innerHTML = `<li>${t('loadGame.noAutoSaves')}</li>`;
    }
    updateDynamicUIText();
}

function createSaveListItem(saveData) {
    const li = document.createElement('li');
    const date = new Date(saveData.timestamp);
    const formattedDate = date.toLocaleString(currentLanguage, { dateStyle: 'short', timeStyle: 'short' });
    const playerName = saveData.playerData?.name || '???';
    const slotDesc = t(saveData.slotType === 'manual' ? 'loadGame.manualSlot' : 'loadGame.autoSlot', { id: saveData.slotId });
    const sourceInfo = saveData.fileName ? '(ФС)' : '(LS)';

    li.innerHTML = `
        <div class="save-info">
            <span class="slot-name">${slotDesc} - ${playerName} ${sourceInfo}</span>
            <span class="save-time">${formattedDate}</span>
        </div>
        <div class="save-actions">
            <button class="load-button" data-type="${saveData.slotType}" data-id="${saveData.slotId}">${t('loadGame.loadButton')}</button>
            <button class="delete-button" data-type="${saveData.slotType}" data-id="${saveData.slotId}">${t('loadGame.deleteButton')}</button>
        </div>
    `;

    li.querySelector('.load-button').addEventListener('click', () => loadGame(saveData.slotType, saveData.slotId));
    li.querySelector('.delete-button').addEventListener('click', () => deleteSave(saveData.slotType, saveData.slotId));
    return li;
}

// --- Функции Управления Экранами ---
function setActiveScreen(screenId) {
    // 1. Принудительно закрываем все модальные окна и оверлеи
    const overlays = [
        document.getElementById('custom-alert-modal'),
        document.getElementById('save-slot-modal'),
        document.getElementById('custom-confirm-modal'),
        document.getElementById('menu-overlay'),
        document.getElementById('loading-overlay')
    ];
    overlays.forEach(el => {
        if (el) {
            el.classList.remove('visible');
            el.style.display = 'none';
        }
    });

    // --- [ИСПРАВЛЕНИЕ ЗДЕСЬ!] ---
    // Создаем полный список ВСЕХ переключаемых экранов, включая игровой.
    const allScreens = [
        mainMenu, 
        settingsMenu, 
        characterCreationScreen, 
        loadGameScreen, 
        helpScreen, 
        narratorSelectionScreen,
        gameInterface // <-- Вот тот, кого мы забыли!
    ];
    // -----------------------------

    // 2. Скрываем все экраны, кроме нужного
    allScreens.forEach(screen => {
        if (screen) { // Проверяем, что элемент существует
            screen.classList.remove('active-screen');
            if (screen.id !== screenId) {
                screen.style.display = 'none';
            }
        }
    });

    // 3. Активируем нужный экран
    const activeScreen = document.getElementById(screenId);
    if (activeScreen) {
        // Для меню используем flex, для игры block
        activeScreen.style.display = activeScreen.classList.contains('menu-screen') ? 'flex' : 'block';
        
        requestAnimationFrame(() => {
            activeScreen.classList.add('active-screen');
            
            if (screenId === 'character-creation-screen') {
                const nameInput = document.getElementById('char-name-input');
                if (nameInput) {
                    nameInput.focus();
                }
            }
        });
        
        console.log(`Активирован экран: ${screenId}`);
    } else {
        console.error(`Экран с id ${screenId} не найден!`);
    }

    // Настройка распознавания речи (если это игра)
    if (screenId === 'game-interface') {
        setupSpeechRecognition();
    }
}

// --- Custom Alert Modal ---
function showCustomAlert(message) {
    const modal = document.getElementById('custom-alert-modal');
    const messageP = document.getElementById('custom-alert-message');
    const closeBtn = document.getElementById('custom-alert-close');

    if (!modal || !messageP || !closeBtn) {
        // Fallback to default alert if elements don't exist
        alert(message);
        return;
    }

    messageP.textContent = message;
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('visible'), 10);

    const closeAlert = () => {
        modal.classList.remove('visible');
        setTimeout(() => modal.style.display = 'none', 300); // Match CSS transition time
    };

    closeBtn.onclick = closeAlert;
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeAlert();
        }
    });
}

// --- функции расчета действия ---
function addCalculationMessage(message, type = "calc-info") {
    if (!calculationLog) return;
    const emptyMessage = calculationLog.querySelector('p[data-i18n="gameInterface.calcLogPanel.empty"]');
    if (emptyMessage && calculationLog.children.length === 1 && calculationLog.firstElementChild === emptyMessage) {
        calculationLog.innerHTML = '';
    }
    const messageElement = document.createElement('p');
    messageElement.textContent = message;
    calculationLog.appendChild(messageElement);
    calculationLog.scrollTo({ top: calculationLog.scrollHeight, behavior: 'smooth' });
}

function rollDice(diceString) {
    const sederhanaMatch = diceString.match(/^d(\d+)$/i); // dN
    const denganModMatch = diceString.match(/^d(\d+)\s*([+-])\s*(\d+)$/i); // dN+M или dN-M
    // Можно добавить поддержку XdY, если нужно, но пока оставим так для простоты ROLL_DICE_REQUEST

    let numSides = 0;
    let modifier = 0;
    let baseDiceStr = diceString; // Для логирования, если не распознан формат

    if (denganModMatch) {
        numSides = parseInt(denganModMatch[1], 10);
        const sign = denganModMatch[2];
        const modValue = parseInt(denganModMatch[3], 10);
        modifier = (sign === '+') ? modValue : -modValue;
        baseDiceStr = `d${numSides}`; // Для чистого броска
    } else if (sederhanaMatch) {
        numSides = parseInt(sederhanaMatch[1], 10);
        baseDiceStr = `d${numSides}`;
    } else {
        console.error(`Неверный формат кубика для броска: ${diceString}. Используется d20 по умолчанию.`);
        numSides = 20;
        baseDiceStr = 'd20';
    }

    if (isNaN(numSides) || numSides <= 0) {
        console.error(`Неверное количество граней: ${numSides}. Используется d20 по умолчанию.`);
        numSides = 20;
        baseDiceStr = 'd20';
    }

    const roll = Math.floor(Math.random() * numSides) + 1;
    const total = roll + modifier;

    console.log(`Бросок ${diceString}: кость=${roll}, модификатор=${modifier}, итог=${total}`);
    return { roll, modifier, total, diceString, cleanDiceRoll: roll, baseDiceStr: baseDiceStr }; // Добавили cleanDiceRoll и baseDiceStr
}

function handleRollDiceButtonClick() {
    if (!pendingDiceRoll || pendingDiceRoll.forGM) { // Не должно срабатывать для GM бросков, т.к. кнопка скрыта
        addLogMessage(t('gameInterface.log.noActiveRoll'), "system-message");
        if (rollDiceButton) {
            rollDiceButton.disabled = true;
            rollDiceButton.style.display = 'none';
        }
        if (rollDiceArea) rollDiceArea.style.display = 'none';
        // Разблокируем ввод, если вдруг что-то пошло не так
        if (userInput) userInput.disabled = false;
        if (sendButton) sendButton.disabled = false;
        return;
    }

    const rollResult = rollDice(pendingDiceRoll.dice); // pendingDiceRoll.dice содержит строку типа "d20+3"
    pendingDiceRoll.result = rollResult; // Сохраняем полный результат, включая cleanDiceRoll

    let modifierString = "";
    if (rollResult.modifier > 0) {
        modifierString = ` + ${rollResult.modifier}`;
    } else if (rollResult.modifier < 0) {
        modifierString = ` - ${Math.abs(rollResult.modifier)}`;
    }

    // Используем rollResult.baseDiceStr для отображения типа кубика (напр. d20)
    // и rollResult.cleanDiceRoll для чистого значения на кости
    addLogMessage(t('gameInterface.log.youRolled', {
        dice: rollResult.baseDiceStr,       // d20, d10 и т.д.
        roll: rollResult.cleanDiceRoll,    // Чистый бросок 1-20 (для d20)
        modifierString: modifierString,    // "+ 3", "- 1" или ""
        total: rollResult.total,
        reason: pendingDiceRoll.reason
    }), "user-message");

    if (rollDiceButton) {
        rollDiceButton.disabled = true;
        rollDiceButton.style.display = 'none';
    }
    if (rollDiceArea) rollDiceArea.style.display = 'none';

    // userInput и sendButton уже должны быть disabled из executeCommand
    // Отправляем результат GM
    sendApiRequest("", false, true); // true - это ответ на запрос броска
}

async function fetchAndSelectBuiltInKey() {
    const keys = await loadAndDecryptBuiltInKeys();
    if (!keys || keys.length === 0) {
        currentBuiltInKey = null;
        GEMINI_API_KEY = '';
        isUsingBuiltInKey = false;
        localStorage.removeItem(BUILT_IN_KEY_STORAGE_FLAG);
        if (apiKeyInput) apiKeyInput.disabled = false;
        updateApiKeyStatus();
        return false;
    }

    const randomIndex = Math.floor(Math.random() * keys.length);
    currentBuiltInKey = keys[randomIndex];
    GEMINI_API_KEY = currentBuiltInKey;
    isUsingBuiltInKey = true;
    localStorage.setItem(BUILT_IN_KEY_STORAGE_FLAG, 'true');
    localStorage.removeItem('geminiApiKey');
    if (apiKeyInput) {
        apiKeyInput.value = '';
        apiKeyInput.disabled = true;
    }
    console.log("Выбран встроенный API ключ.");
    updateApiKeyStatus();
    return true;
}

function updateApiKeyStatus() {
    let statusKey;
    let statusClass;
    let keyIsMissing = false;

    if (currentApiProvider === 'local') {
        statusKey = 'mainMenu.apiKeyStatusNotRequired';
        statusClass = 'status-ok';
    } else if (isUsingBuiltInKey) {
        statusKey = 'mainMenu.apiKeyStatusFound';
        statusClass = 'status-ok';
    } else {
        let keyToCheck = geminiApiKey;
        switch (currentApiProvider) {
            case 'gemini':
                keyToCheck = geminiApiKeys[currentGeminiKeyIndex] || geminiApiKey;
                break;
            case 'llmost':
                keyToCheck = llmostApiKey;
                break;
            case 'openrouter':
                keyToCheck = openrouterApiKey;
                break;
            case 'deepseek':
                keyToCheck = deepseekApiKey;
                break;
        }

        if (keyToCheck && keyToCheck.trim() !== '') {
            statusKey = 'mainMenu.apiKeyStatusFound';
            statusClass = 'status-ok';
        } else {
            statusKey = 'mainMenu.apiKeyStatusMissing';
            statusClass = 'status-error';
            keyIsMissing = true;
        }
    }

    if (apiKeyStatus) {
        apiKeyStatus.textContent = t(statusKey, {
            provider: currentApiProvider.charAt(0).toUpperCase() + currentApiProvider.slice(1)
        });
        apiKeyStatus.className = `api-key-status ${statusClass}`;
    }
    
    if(newGameButton) {
        newGameButton.disabled = keyIsMissing;
        newGameButton.title = keyIsMissing ? t('mainMenu.tooltips.newGameDisabled', 'Введите API ключ в настройках, чтобы начать') : t('mainMenu.tooltips.newGame', 'Начать новое приключение');
    }
}

function saveApiKey() {
    const newKey = document.getElementById('api-key-input').value.trim();
    if (newKey) {
        localStorage.setItem('geminiApiKey', newKey);
        GEMINI_API_KEY = newKey;
        isUsingBuiltInKey = false;
        localStorage.setItem('useBuiltInApiKey_v1', 'false');
        // ЗАМЕНА ALERT
        showCustomAlert(t('settingsMenu.apiKeySaved', null, 'API ключ сохранен!'));
    } else {
        localStorage.removeItem('geminiApiKey');
        GEMINI_API_KEY = '';
        // ЗАМЕНА ALERT
        showCustomAlert(t('settingsMenu.apiKeyRemovedOrEmpty', null, 'API ключ удален.'));
    }
    updateApiKeyStatus();
}

// --- Функции Музыки ---
// --- ЛОГИКА МУЗЫКИ В МЕНЮ ---
const menuMusicPlayer = document.getElementById('menu-music-player');
const MENU_THEME_PATH = 'assets/sound/menu_theme.mp3'; // Путь к твоему новому треку
const MENU_VOLUME = 0.15; // Громкость меню (чуть тише основной игры)

function playMenuMusic() {
    if (!menuMusicPlayer) return;
    
    // Если музыка уже играет, не запускаем заново
    if (!menuMusicPlayer.paused) return;

    menuMusicPlayer.src = MENU_THEME_PATH;
    menuMusicPlayer.volume = MENU_VOLUME;
    
    const playPromise = menuMusicPlayer.play();

    if (playPromise !== undefined) {
        playPromise.then(() => {
            console.log("Музыка в меню запущена успешно.");
        }).catch(error => {
            console.log("Автоплей заблокирован. Ждем клика пользователя...");
            // Если автоплей заблокирован, вешаем одноразовый слушатель на первый клик
            document.addEventListener('click', () => {
                playMenuMusic();
            }, { once: true });
        });
    }
}

// Остановить музыку меню, когда начинается игра
function stopMenuMusic() {
    if (menuMusicPlayer) {
        // Плавное затухание (опционально)
        let fadeOut = setInterval(() => {
            if (menuMusicPlayer.volume > 0.02) {
                menuMusicPlayer.volume -= 0.02;
            } else {
                menuMusicPlayer.pause();
                menuMusicPlayer.currentTime = 0;
                clearInterval(fadeOut);
            }
        }, 50);
    }
}

// Запускаем при загрузке страницы
window.addEventListener('DOMContentLoaded', () => {
    playMenuMusic();
});

function playMusic(index) {
    if (!audioPlayer || musicFiles.length === 0 || index < 0 || index >= musicFiles.length) {
        console.warn("Не удается воспроизвести музыку: нет плеера, нет файлов или неверный индекс.", index);
        return;
    }
    if (!userInteractedForMusic && currentTrackIndex !== -1) {
         console.log("Музыка заблокирована до первого взаимодействия пользователя с кнопкой переключения.");
         return;
    }

    const trackSrc = SOUND_FOLDER_PATH + musicFiles[index];
    if (audioPlayer.currentSrc.endsWith(trackSrc) && !audioPlayer.paused) {
         console.log(`Трек ${musicFiles[index]} уже играет.`);
         return;
    }

    console.log(`Попытка воспроизвести музыку: ${musicFiles[index]}`);
    audioPlayer.src = trackSrc;
    audioPlayer.volume = MUSIC_VOLUME;

    const playPromise = audioPlayer.play();

    if (playPromise !== undefined) {
        playPromise.then(_ => {
            console.log(`Играет: ${musicFiles[index]}`);
            isMusicPlaying = true;
            currentTrackIndex = index;
            updateMusicToggleButton(true);
        }).catch(error => {
            console.warn(`Воспроизведение музыки не удалось для ${musicFiles[index]}:`, error);
            isMusicPlaying = false;
            updateMusicToggleButton(false);
        });
    } else {
        isMusicPlaying = !audioPlayer.paused;
        currentTrackIndex = index;
        updateMusicToggleButton(isMusicPlaying);
    }
}

function pauseMusic() {
    if (!audioPlayer || audioPlayer.paused) return;
    audioPlayer.pause();
    isMusicPlaying = false;
    updateMusicToggleButton(false);
    console.log("Музыка на паузе.");
}

function toggleMusic() {
    if (!toggleMusicButton) return;

    if (!userInteractedForMusic) {
        userInteractedForMusic = true;
        console.log("Обнаружено взаимодействие пользователя, включение воспроизведения музыки.");
        if (!isMusicPlaying) {
            const indexToPlay = currentTrackIndex >= 0 ? currentTrackIndex : 0;
            playMusic(indexToPlay);
        }
        return;
    }

    if (isMusicPlaying) {
        pauseMusic();
    } else {
        if (audioPlayer.readyState >= 2 && audioPlayer.currentSrc) {
             const playPromise = audioPlayer.play();
             if (playPromise !== undefined) {
                 playPromise.then(() => {
                     isMusicPlaying = true;
                     updateMusicToggleButton(true);
                 }).catch(e => console.error("Ошибка возобновления музыки:", e));
             } else {
                 isMusicPlaying = true;
                 updateMusicToggleButton(true);
             }
        } else {
            playMusic(0);
        }
    }
}

function updateMusicToggleButton(isPlaying) {
    if (!toggleMusicIcon || !toggleMusicButton) return;
    if (isPlaying) {
        toggleMusicIcon.classList.remove('fa-volume-off', 'fa-play');
        toggleMusicIcon.classList.add('fa-volume-high');
        toggleMusicButton.title = t('gameInterface.toggleMusicButtonTitlePause', "Пауза");
    } else {
        toggleMusicIcon.classList.remove('fa-volume-high', 'fa-pause');
        toggleMusicIcon.classList.add('fa-volume-off');
        toggleMusicButton.title = t('gameInterface.toggleMusicButtonTitlePlay', "Включить музыку");
    }
     toggleMusicButton.dataset.i18n = isPlaying
         ? "[title]gameInterface.toggleMusicButtonTitlePause"
         : "[title]gameInterface.toggleMusicButtonTitlePlay";
}

function playNextTrack() {
    if (musicFiles.length === 0) return;
    let nextIndex = (currentTrackIndex + 1) % musicFiles.length;
    playMusic(nextIndex);
}

function setupMusicPlayer() {
     if (!audioPlayer || !toggleMusicButton) {
         console.warn("Музыкальный плеер или кнопка переключения не найдены.");
         return;
     }
     audioPlayer.addEventListener('ended', playNextTrack);
     toggleMusicButton.addEventListener('click', toggleMusic);
     updateMusicToggleButton(false);
}

// --- Функции TTS (Text-to-Speech) ---
function setupTTS() {
    // --- НАЧАЛО ИСПРАВЛЕНИЯ: ПРОВЕРКА НА ELECTRON ---
    // Если мы в Electron, где speechSynthesis не имеет голосов, просто скрываем все связанное с TTS.
    if (isElectron()) {
        console.warn("TTS (озвучка) не поддерживается в стандартной сборке Electron. Функция отключена.");
        if (toggleTTSButton) toggleTTSButton.style.display = 'none';
        if (ttsVoiceSelectorGroup) ttsVoiceSelectorGroup.style.display = 'none';
        return; // Прекращаем дальнейшую настройку TTS
    }
    // --- КОНЕЦ ИСПРАВЛЕНИЯ ---

    // Этот код выполнится только в браузерной версии
    if (!speechSynthesis) {
        console.warn("Web Speech API (синтез речи) не поддерживается этим браузером.");
        if (toggleTTSButton) toggleTTSButton.style.display = 'none';
        if (ttsVoiceSelectorGroup) ttsVoiceSelectorGroup.style.display = 'none';
        return;
    }

    if (ttsVoiceSelectorGroup) ttsVoiceSelectorGroup.style.display = 'block';

    loadTTSVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = loadTTSVoices;
    }

    if (toggleTTSButton) {
        toggleTTSButton.addEventListener('click', toggleTTS);
    }
    if (ttsVoiceSelect) {
        ttsVoiceSelect.addEventListener('change', handleTTSVoiceChange);
    }
    updateTTSToggleButton(isTTSEnabled);
}

function loadTTSVoices() {
    ttsVoices = speechSynthesis.getVoices();
    if (!ttsVoiceSelect) return;

    if (ttsVoices.length > 0) {
        console.log("Доступные голоса TTS:", ttsVoices.map(v => `${v.name} (${v.lang})`));
        ttsVoiceSelect.innerHTML = ''; // Очищаем предыдущие опции

        // Фильтруем голоса, чтобы показывать только для текущего языка игры или близкие
        const currentLangPrefix = currentLanguage; // 'ru' или 'en'
        const filteredVoices = ttsVoices.filter(voice => voice.lang.startsWith(currentLangPrefix));

        if (filteredVoices.length === 0) { // Если для текущего языка нет, показываем все
            console.warn(`TTS: Нет голосов для языка '${currentLangPrefix}'. Показываю все доступные.`);
            ttsVoices.forEach(voice => {
                const option = document.createElement('option');
                option.value = voice.name; // Используем имя голоса как value, т.к. оно уникально
                option.textContent = `${voice.name} (${voice.lang})`;
                ttsVoiceSelect.appendChild(option);
            });
        } else {
            filteredVoices.forEach(voice => {
                const option = document.createElement('option');
                option.value = voice.name;
                option.textContent = `${voice.name} (${voice.lang})`;
                ttsVoiceSelect.appendChild(option);
            });
        }

        // Пытаемся восстановить сохраненный голос
        const savedVoiceName = localStorage.getItem(TTS_VOICE_STORAGE_KEY);
        if (savedVoiceName) {
            const voiceExists = Array.from(ttsVoiceSelect.options).some(opt => opt.value === savedVoiceName);
            if (voiceExists) {
                ttsVoiceSelect.value = savedVoiceName;
            } else {
                localStorage.removeItem(TTS_VOICE_STORAGE_KEY); // Удаляем, если сохраненный голос больше не доступен
                selectTTSVoice(); // Выбираем лучший из доступных
            }
        } else {
            selectTTSVoice(); // Если ничего не сохранено, выбираем лучший
        }
        // Обновляем selectedTTSVoice на основе текущего значения в select
        const currentSelectedVoiceInList = ttsVoices.find(v => v.name === ttsVoiceSelect.value);
        if (currentSelectedVoiceInList) {
            selectedTTSVoice = currentSelectedVoiceInList;
            ttsLang = selectedTTSVoice.lang;
            console.log(`TTS: Актуальный выбранный голос: ${selectedTTSVoice.name} (${selectedTTSVoice.lang})`);
        }


    } else {
        console.warn("TTS: Голоса еще не загружены или отсутствуют.");
        ttsVoiceSelect.innerHTML = `<option value="" data-i18n="settingsMenu.ttsVoiceUnavailable">${t('settingsMenu.ttsVoiceUnavailable', 'Голоса недоступны')}</option>`;
    }
}

function selectTTSVoice() {
    if (ttsVoices.length === 0) {
        console.warn("TTS: Нет доступных голосов для выбора.");
        if (ttsVoiceSelect) {
             ttsVoiceSelect.innerHTML = `<option value="" data-i18n="settingsMenu.ttsVoiceUnavailable">${t('settingsMenu.ttsVoiceUnavailable', 'Голоса недоступны')}</option>`;
        }
        return;
    }

    const targetLangPrefix = currentLanguage;
    const targetLangFull = currentLanguage === 'ru' ? 'ru-RU' : 'en-US';

    let preferredVoice =
        ttsVoices.find(voice => voice.lang === targetLangFull && voice.localService) ||
        ttsVoices.find(voice => voice.lang === targetLangFull) ||
        ttsVoices.find(voice => voice.lang.startsWith(targetLangPrefix) && voice.localService) ||
        ttsVoices.find(voice => voice.lang.startsWith(targetLangPrefix)) ||
        ttsVoices.find(voice => voice.default && voice.lang.startsWith(targetLangPrefix));

    if (!preferredVoice && ttsVoices.length > 0) { // Если не нашли идеальный, берем первый из отфильтрованных или вообще первый
        preferredVoice = ttsVoices.find(voice => voice.lang.startsWith(targetLangPrefix)) || ttsVoices.find(v => v.default) || ttsVoices[0];
    }

    if (preferredVoice) {
        selectedTTSVoice = preferredVoice;
        ttsLang = selectedTTSVoice.lang;
        console.log(`TTS: Автоматически выбран голос: ${selectedTTSVoice.name} (${selectedTTSVoice.lang})`);
        if (ttsVoiceSelect) {
            // Убедимся, что такой голос есть в списке перед установкой
            const voiceExistsInSelect = Array.from(ttsVoiceSelect.options).some(opt => opt.value === selectedTTSVoice.name);
            if (voiceExistsInSelect) {
                ttsVoiceSelect.value = selectedTTSVoice.name;
            } else {
                // Если автоматически выбранного голоса нет в отфильтрованном списке (маловероятно, но возможно),
                // то просто оставляем первый элемент списка выбранным.
                // loadTTSVoices должен был уже заполнить список.
                if (ttsVoiceSelect.options.length > 0) {
                    const firstVoiceNameInList = ttsVoiceSelect.options[0].value;
                    selectedTTSVoice = ttsVoices.find(v => v.name === firstVoiceNameInList);
                    if (selectedTTSVoice) ttsLang = selectedTTSVoice.lang;
                }
            }
        }
    } else {
        console.error("TTS: Не удалось выбрать ни один голос.");
        if (ttsVoiceSelect) {
            ttsVoiceSelect.innerHTML = `<option value="" data-i18n="settingsMenu.ttsVoiceUnavailable">${t('settingsMenu.ttsVoiceUnavailable', 'Голоса недоступны')}</option>`;
        }
    }
}

function handleTTSVoiceChange(event) {
    const selectedName = event.target.value;
    const voice = ttsVoices.find(v => v.name === selectedName);
    if (voice) {
        selectedTTSVoice = voice;
        ttsLang = selectedTTSVoice.lang; // Обновляем язык на язык выбранного голоса
        localStorage.setItem(TTS_VOICE_STORAGE_KEY, selectedTTSVoice.name);
        console.log(`TTS: Пользователь выбрал голос: ${selectedTTSVoice.name} (${selectedTTSVoice.lang})`);

        // Тестовое озвучивание для проверки голоса
        if (isTTSEnabled) {
            speakText(t('tts.voiceTest', 'Тест голоса'));
        }
    }
}

/**
 * Рассчитывает ПОЛНЫЙ модификатор для характеристики, учитывая статы, эффекты и умения.
 * @param {string} statKey - Ключ характеристики ('str', 'dex', 'int', 'con', 'cha').
 * @returns {number} - Итоговый модификатор.
 */
function getStatModifier(statKey) {
    if (!player || !player.stats[statKey]) {
        return 0;
    }

    // Шаг 1: Базовый модификатор от характеристики
    let baseModifier = Math.floor((player.stats[statKey] - 10) / 2);
    let totalBonus = 0;
    let logMessages = [];

    // Шаг 2: Учет баффов и дебаффов от статус-эффектов
    if (player.statusEffects) {
        for (const effectId in player.statusEffects) {
            const effect = player.statusEffects[effectId];
            if (effect.effects && Array.isArray(effect.effects)) {
                for (const subEffect of effect.effects) {
                    if (subEffect.action && subEffect.action.stat === statKey && subEffect.action.type === 'modify_stat') {
                        const change = parseInt(subEffect.action.change, 10);
                        if (!isNaN(change)) {
                            totalBonus += change;
                            logMessages.push(`Эффект '${effect.name}': ${change > 0 ? '+' : ''}${change} к ${statKey.toUpperCase()}`);
                        }
                    }
                }
            }
        }
    }

    // Шаг 3: Учет бонусов от пассивных умений (ПРИМЕР)
    // В будущем, у умений может быть более структурированное поле 'effects' для автоматического парсинга.
    if (player.skills) {
        // Пример: если есть умение "Мастерство оружия (Мечи)", дающее +1 к атаке (которая зависит от Силы)
        if ((statKey === 'str' || statKey === 'dex') && player.skills['weapon_spec_swords_passive']) {
            totalBonus += 1;
            logMessages.push(`Умение 'Мастерство оружия (Мечи)': +1`);
        }
        // Пример для расового умения
        if (statKey === 'dex' && player.skills['elf_elven_grace_passive']) {
            // Этот бонус уже должен быть в базовом стате, но для примера можно добавить и так
            // totalBonus += 1; 
        }
    }
    
    // Шаг 4: (Задел на будущее) Учет бонусов от экипированных предметов
    // for (const itemId in player.equipment) { ... }

    const finalModifier = baseModifier + totalBonus;

    if (logMessages.length > 0) {
        console.log(`[getStatModifier] Расчет для ${statKey.toUpperCase()}: База ${baseModifier}, Бонусы ${totalBonus} -> Итог ${finalModifier}. Причины:`, logMessages.join('; '));
    }

    return finalModifier;
}

function toggleTTS() {
    if (!speechSynthesis) return;
    isTTSEnabled = !isTTSEnabled;
    updateTTSToggleButton(isTTSEnabled);
    if (!isTTSEnabled && speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }
    const statusMessage = isTTSEnabled ? t('tts.enabled', 'Озвучка включена.') : t('tts.disabled', 'Озвучка выключена.');
    console.log(statusMessage);
}

function updateTTSToggleButton(isEnabled) {
    if (!toggleTTSIcon || !toggleTTSButton) return;
    if (isEnabled) {
        toggleTTSIcon.classList.remove('fa-comment-dots');
        toggleTTSIcon.classList.add('fa-comment-slash');
        toggleTTSButton.title = t('gameInterface.toggleTTSButtonTitlePause', "Выключить озвучку");
    } else {
        toggleTTSIcon.classList.remove('fa-comment-slash');
        toggleTTSIcon.classList.add('fa-comment-dots');
        toggleTTSButton.title = t('gameInterface.toggleTTSButtonTitlePlay', "Включить озвучку");
    }
    toggleTTSButton.dataset.i18n = isEnabled
        ? "[title]gameInterface.toggleTTSButtonTitlePause"
        : "[title]gameInterface.toggleTTSButtonTitlePlay";
}

function speakText(text) {
    if (!isTTSEnabled || !speechSynthesis || !text || text.trim() === '') {
        return;
    }

    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }

    ttsUtterance = new SpeechSynthesisUtterance(text);
    ttsUtterance.lang = ttsLang;

    if (selectedTTSVoice) {
        ttsUtterance.voice = selectedTTSVoice;
    }

    ttsUtterance.pitch = 1;
    ttsUtterance.rate = 1;
    ttsUtterance.volume = 0.8;

    ttsUtterance.onend = () => { /* console.log("TTS: Озвучивание завершено."); */ };
    ttsUtterance.onerror = (event) => {
        console.error("TTS: Ошибка озвучивания:", event.error);
        if (event.error === 'language-unavailable' || event.error === 'voice-unavailable' || event.error === 'synthesis-failed') {
            console.warn("TTS: Проблема с языком/голосом или синтезом. Попытка сбросить голос.");
            selectedTTSVoice = null;
            loadTTSVoices(); // Перезагрузить и перевыбрать голоса
        }
    };
    speechSynthesis.speak(ttsUtterance);
}

async function generateItemImage(item) {
    if (item.imageUrl || item.aiIdentifier === 'gold') return;
    item.isGenerating = true;
    try {
        console.log(`[Puter AI] Генерирую изображение для: ${item.name}`);
        const prompt = `fantasy game item icon: ${item.name}, ${item.description}, clean white background, digital art, highly detailed`;
        const imageURL = await puter.ai.txt2img(prompt, { model: 'flux-1.1-pro' });
        item.imageUrl = imageURL;
    } catch (e) {
        console.error("[Puter AI] Ошибка генерации:", e);
        item.imageUrl = 'assets/items/default.jpg';
    } finally {
        item.isGenerating = false;
        updateInventoryDisplay();
        updateEquipmentDisplay();
    }
}

async function generateItemImage(item) {
    if (item.imageUrl || item.aiIdentifier === 'gold' || typeof puter === 'undefined') return;
    item.isGenerating = true;
    try {
        const prompt = `fantasy game item icon: ${item.name}, ${item.description}, clean white background, digital art, highly detailed`;
        const imageURL = await puter.ai.txt2img(prompt, { model: 'flux-1.1-pro' });
        item.imageUrl = imageURL;
    } catch (e) {
        console.error("[Puter AI] Error:", e);
        item.imageUrl = 'assets/fone/Backgrounds_pixel.jpg'; // Заглушка
    } finally {
        item.isGenerating = false;
        updateInventoryDisplay();
        updateEquipmentDisplay();
    }
}

async function loadItemsReference() {
async function generateItemImage(item) {
    if (item.imageUrl || item.aiIdentifier === 'gold' || typeof puter === 'undefined') return;
    item.isGenerating = true;
    try {
        console.log(`[Puter AI] Generating for: ${item.name}`);
        const prompt = `fantasy RPG item icon: ${item.name}, ${item.description}, clean white background, digital art style, high quality`;
        item.imageUrl = await puter.ai.txt2img(prompt, { model: 'flux-1.1-pro' });
        console.log("[Puter AI] Success!");
    } catch (e) {
        console.error("[Puter AI] Error:", e);
    }
    item.isGenerating = false;
    updateInventoryDisplay();
    updateEquipmentDisplay();
}

// Генерация изображений отключена

    const filePath = `assets/promts/items_reference.json`;
    console.log(`Попытка загрузить справочник предметов из: ${filePath}`);
    try {
        const response = await fetch(`${filePath}?t=${Date.now()}`); // ИСПРАВЛЕНИЕ: Добавлен cache-buster
        if (!response.ok) {
            throw new Error(`HTTP ошибка! статус: ${response.status}. Не удалось загрузить ${response.url}`);
        }
        itemsReferenceData = await response.json();
        console.log(`Справочник предметов (${itemsReferenceData.length} шт.) успешно загружен и разобран.`);
    } catch (error) {
        console.error(`Не удалось загрузить или разобрать справочник предметов:`, error);
        itemsReferenceData = [];
    }
}

// --- Функции Локализации ---
async function loadLanguagesConfig() {
    try {
        const response = await fetch('assets/localizations/languages.json');
        if (!response.ok) throw new Error(`HTTP ошибка! статус: ${response.status}`);
        availableLanguages = await response.json();
        console.log("Доступные языки загружены:", availableLanguages);
        populateLanguageSelector();
    } catch (error) {
        console.error("Не удалось загрузить конфигурацию языков:", error);
        availableLanguages = {
            [DEFAULT_LANGUAGE]: { name: (DEFAULT_LANGUAGE === 'ru' ? 'Русский' : 'Default'), file: `assets/localizations/${DEFAULT_LANGUAGE}.json` }
        };
        populateLanguageSelector();
    }
}

function populateLanguageSelector() {
    if (!languageSelect) return;
    languageSelect.innerHTML = '';

    for (const langCode in availableLanguages) {
        const option = document.createElement('option');
        option.value = langCode;
        option.textContent = availableLanguages[langCode].name;
        if (langCode === currentLanguage) {
            option.selected = true;
        }
        languageSelect.appendChild(option);
    }

    languageSelect.removeEventListener('change', handleLanguageChange);
    languageSelect.addEventListener('change', handleLanguageChange);
}

function handleLanguageChange(event) {
    const newLang = event.target.value;
    setLanguage(newLang);
}

async function loadTranslations(langCode) {
    const langConfig = availableLanguages[langCode];
    if (!langConfig || !langConfig.file) {
        console.error(`Конфигурация файла перевода не найдена для языка: ${langCode}`);
        translations = {};
        return;
    }

    const fileUrl = `${langConfig.file}?t=${Date.now()}`;
    console.log(`Попытка загрузить переводы из: ${fileUrl}`);

    try {
        const response = await fetch(fileUrl, {
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });

        if (!response.ok) throw new Error(`HTTP ошибка! статус: ${response.status}, Не удалось загрузить ${response.url}`);
        const responseText = await response.text();

        try {
            translations = JSON.parse(responseText);
            console.log(`Переводы для '${langCode}' успешно разобраны.`);
        } catch (parseError) {
            console.error(`Не удалось РАЗОБРАТЬ переводы для ${langCode} после загрузки. Ошибка:`, parseError);
            console.error("--- Проблемный JSON текст, полученный браузером: ---");
            const errorPosition = parseError.message.match(/position (\d+)/);
            if (errorPosition && errorPosition[1]) {
                const pos = parseInt(errorPosition[1], 10);
                const contextLength = 50;
                console.error(responseText.substring(Math.max(0, pos - contextLength), Math.min(responseText.length, pos + contextLength)));
                console.error(`^^^ Ошибка, вероятно, около позиции ${pos} ^^^`);
            } else {
                 console.error(responseText.substring(0, 500) + '...');
            }
            console.error("---------------------------------------------");
            translations = {};
        }

    } catch (fetchError) {
        console.error(`Не удалось ЗАГРУЗИТЬ переводы для ${langCode}:`, fetchError);
        translations = {};
    }
}

async function setLanguage(langCode) {
    if (!availableLanguages[langCode]) {
        console.warn(`Попытка установить неподдерживаемый язык: ${langCode}. Возврат к языку по умолчанию.`);
        langCode = DEFAULT_LANGUAGE;
    }

    const previousLanguage = currentLanguage;
    currentLanguage = langCode;
    localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
    console.log(`Установка языка на: ${currentLanguage}`);

    document.documentElement.lang = currentLanguage;

    if (languageSelect) {
        languageSelect.value = currentLanguage;
    }

    await loadTranslations(currentLanguage);
    applyTranslations();

    // Обновляем язык и голос для TTS
    if (speechSynthesis) {
        // ttsLang будет обновлен внутри loadTTSVoices -> selectTTSVoice
        loadTTSVoices(); // Перезагружаем и пере-фильтруем голоса для нового языка
        if (isTTSEnabled && speechSynthesis.speaking) {
            speechSynthesis.cancel();
        }
    }
    
    // ИЗМЕНЕНИЕ: Обновляем язык для распознавания речи
    if (recognition) {
        recognition.lang = ttsLang; // ttsLang уже обновлен после вызова loadTTSVoices()
        console.log(`Язык распознавания речи установлен на: ${recognition.lang}`);
    }

    const isGameActive = gameInterface.classList.contains('active-screen');

    if (currentLanguage !== previousLanguage && !isGameActive) {
        console.log("Язык изменен вне игры, перезагрузка данных мира...");
        try {
            await loadLore(DEFAULT_WORLD_ID, currentLanguage);
            await loadGlobalLocations(DEFAULT_WORLD_ID, currentLanguage);
            console.log(`Данные мира перезагружены для языка: ${currentLanguage}`);
            updateMapDisplay();
        } catch (error) {
            console.error(`Не удалось перезагрузить данные мира для языка ${currentLanguage}:`, error);
        }
    } else if (currentLanguage !== previousLanguage && isGameActive) {
        console.warn("Язык изменен во время активной игры. Лор мира и локации НЕ были перезагружены для предотвращения несоответствий. Перезапустите игру, чтобы изменения полностью применились к описанию мира и локациям.");
        addLogMessage(t('warning.languageChangedInGame', "Язык изменен. Детали мира (лор, локации) полностью обновятся при перезапуске игры."), 'system-message');
    }
    updateDynamicUIText();
    updateApiKeyStatus();
}

function applyTranslations() {
    const elements = document.querySelectorAll('[data-i18n]');

    elements.forEach(el => {
        if (el.id === 'level-info') { // level-info обновляется отдельно через updateCharacterSheet
            return;
        }

        const keyWithOptions = el.dataset.i18n;
        let key = keyWithOptions;
        let attribute = 'textContent'; // По умолчанию обновляем текстовое содержимое

        // Проверяем, указан ли атрибут в data-i18n (например, [placeholder]key.name)
        if (key.startsWith('[')) {
            const match = key.match(/^\[(.*?)\](.*)/);
            if (match) {
                attribute = match[1];
                key = match[2];
            }
        }

        let variables = null;
        if (el.dataset.i18nVariables) {
             try {
                // Заменяем одинарные кавычки на двойные для корректного JSON.parse
                const jsonString = el.dataset.i18nVariables.replace(/'/g, '"');
                variables = JSON.parse(jsonString);
             } catch (e) {
                console.error(`Ошибка разбора переменных i18n для ключа "${key}":`, e, el.dataset.i18nVariables);
             }
        }

        let translation = t(key, variables); // Получаем перевод

         if (translation !== key) { // Если перевод найден и он не равен самому ключу
             if (attribute === 'textContent') {
                 el.innerHTML = translation; // Используем innerHTML для поддержки тегов в переводе
             } else if (attribute === 'innerHTML') {
                 el.innerHTML = translation;
             } else if (el.hasAttribute(attribute)) {
                 el.setAttribute(attribute, translation);
             } else {
                 // Если это специальный атрибут, который не является стандартным HTML атрибутом
                 // (например, data-custom-attr), то el.setAttribute сработает.
                 // Если это свойство объекта (например, el.value), то нужно обрабатывать отдельно или убедиться,
                 // что такие случаи покрыты в updateDynamicUIText или других функциях.
                 // Для большинства случаев (title, placeholder) setAttribute сработает.
                 el.setAttribute(attribute, translation);
                 // console.warn(`Целевой атрибут "${attribute}" не найден или не является стандартным на элементе для ключа: ${key}. Попытка установить через setAttribute.`);
             }
         } else if (!el.innerHTML && (attribute === 'textContent' || attribute === 'innerHTML')) {
             // Если перевод не найден и элемент пуст, показываем ключ для отладки
             el.innerHTML = `[${key}]`;
         }
    });
    // updateApiKeyStatus(); // Уже вызывается в setLanguage
 }

function t(key, variables = null, fallback = null) {
    let translation = key.split('.').reduce((obj, i) => obj?.[i], translations);

    if (typeof translation !== 'string') {
        translation = fallback !== null ? fallback : key;
    }

    if (variables && typeof translation === 'string') {
        for (const varKey in variables) {
            const regex = new RegExp(`\\{${varKey}\\}`, 'g');
            translation = translation.replace(regex, variables[varKey]);
        }
    }
    return translation || (fallback !== null ? fallback : key);
}

 function updateDynamicUIText() {
    document.title = t('appName');

    const inventoryPanelTitle = document.querySelector('.inventory .panel-toggle > span:first-child');
    if (inventoryPanelTitle) {
         inventoryPanelTitle.innerHTML = t('gameInterface.inventoryPanel.title', {
             count: `<span id="inventory-count">${player ? Object.keys(player.inventory).length : 0}</span>`,
             capacity: `<span id="inventory-capacity">${player ? player.inventoryCapacity : 10}</span>`
         });
    }
    const charPanelTitle = document.querySelector('.character-sheet .panel-toggle > span:first-child');
    if (charPanelTitle) {
        charPanelTitle.textContent = t('gameInterface.characterPanel.title');
    }
    const questPanelTitle = document.querySelector('.quests .panel-toggle > span:first-child');
    if (questPanelTitle) {
        questPanelTitle.textContent = t('gameInterface.questPanel.title');
    }
    const skillsPanelTitle = document.querySelector('.skills-panel .panel-toggle > span:first-child');
    if (skillsPanelTitle) {
        skillsPanelTitle.textContent = t('gameInterface.skillsPanel.title');
    }
    const mapPanelTitle = document.querySelector('.map-panel .panel-toggle > span:first-child');
    if (mapPanelTitle) {
        mapPanelTitle.textContent = t('gameInterface.mapPanel.title');
    }
    const environmentPanelTitle = document.querySelector('.environment-panel .panel-toggle > span:first-child'); // НОВОЕ
    if (environmentPanelTitle) {
        environmentPanelTitle.textContent = t('gameInterface.environmentPanel.title');
    }
	const calcLogPanelTitle = document.querySelector('.calculation-log-panel .panel-toggle > span:first-child');
    if (calcLogPanelTitle) {
       calcLogPanelTitle.textContent = t('gameInterface.calcLogPanel.title');
    }
    const calcLogEmpty = calculationLog ? calculationLog.querySelector('p[data-i18n="gameInterface.calcLogPanel.empty"]') : null;
    if (calcLogEmpty && calculationLog.children.length === 1 && calculationLog.firstElementChild === calcLogEmpty) {
       calcLogEmpty.textContent = t('gameInterface.calcLogPanel.empty');
    }

    statIncreaseButtons.forEach(button => {
        const stat = button.getAttribute('data-stat');
        if (stat) {
             button.title = t('gameInterface.characterPanel.increaseStatTooltip', { statName: stat.toUpperCase() });
        }
    });

    const maxManual = document.getElementById('max-manual-saves');
    const maxAuto = document.getElementById('max-auto-saves');
    const manualTitleSpan = document.querySelector('#load-game-screen h2:nth-of-type(1) span[data-i18n]');
    const autoTitleSpan = document.querySelector('#load-game-screen h2:nth-of-type(2) span[data-i18n]');

    if (maxManual) maxManual.textContent = MAX_MANUAL_SAVES;
    if (maxAuto) maxAuto.textContent = MAX_AUTO_SAVES;
    if (manualTitleSpan) manualTitleSpan.innerHTML = t('loadGame.manualSavesTitle', { max: `<span id="max-manual-saves">${MAX_MANUAL_SAVES}</span>` });
    if (autoTitleSpan) autoTitleSpan.innerHTML = t('loadGame.autoSavesTitle', { max: `<span id="max-auto-saves">${MAX_AUTO_SAVES}</span>` });

    const racePlaceholder = document.querySelector('#char-race-select option[value=""]');
    if (racePlaceholder) racePlaceholder.textContent = t('characterCreation.racePlaceholder');
    document.querySelectorAll('#char-race-select option[value]').forEach(opt => {
        if (opt.value) {
            const key = `characterCreation.race${opt.value.charAt(0).toUpperCase() + opt.value.slice(1)}`;
            opt.textContent = t(key, null, opt.value);
        }
    });

    const classPlaceholder = document.querySelector('#char-class-select option[value=""]');
    if (classPlaceholder) classPlaceholder.textContent = t('characterCreation.classPlaceholder');
    document.querySelectorAll('#char-class-select option[value]').forEach(opt => {
        if (opt.value) {
            const key = `characterCreation.class${opt.value.charAt(0).toUpperCase() + opt.value.slice(1)}`;
            opt.textContent = t(key, null, opt.value);
        }
    });

    if (player && gameInterface.classList.contains('active-screen')) {
         gameTitle.textContent = t('appName') + ` | ${player.name}`;
    } else if (mainMenu.classList.contains('active-screen')) {
         const mainMenuTitle = mainMenu.querySelector('h1');
         if (mainMenuTitle) mainMenuTitle.textContent = t('mainMenu.title');
         gameTitle.textContent = t('appName');
    } else {
         gameTitle.textContent = t('appName');
    }

     if (inventoryList && inventoryList.children.length === 1 && inventoryList.firstElementChild.tagName === 'LI') {
         const li = inventoryList.firstElementChild;
         if (Object.keys(player?.inventory || {}).length === 0) {
             li.textContent = t('gameInterface.inventoryPanel.empty');
             li.removeAttribute('title');
             li.style.cursor = 'default';
         }
     }
     if (questList && questList.children.length === 1 && questList.firstElementChild.tagName === 'LI') {
         const li = questList.firstElementChild;
         if (Object.keys(player?.quests || {}).filter(q => player.quests[q].status === 'active').length === 0) {
             li.textContent = t('gameInterface.questPanel.empty');
         }
     }
      if (skillsList && skillsList.children.length === 1 && skillsList.firstElementChild.tagName === 'LI') {
         const li = skillsList.firstElementChild;
         if (Object.keys(player?.skills || {}).length === 0) {
             li.textContent = t('gameInterface.skillsPanel.empty');
             li.style.cursor = 'default';
         }
     }
     if (customLocationsList && customLocationsList.children.length === 1 && customLocationsList.firstElementChild.tagName === 'LI') {
         const li = customLocationsList.firstElementChild;
         if (Object.keys(player?.mapMarkers || {}).length === 0) {
             li.textContent = t('gameInterface.mapPanel.noCustom');
         }
     }
    if (environmentList && environmentList.children.length === 1 && environmentList.firstElementChild.tagName === 'LI') { // НОВОЕ
        const li = environmentList.firstElementChild;
        if (Object.keys(player?.visibleEntities || {}).length === 0) {
            li.textContent = t('gameInterface.environmentPanel.empty');
            li.style.cursor = 'default';
        }
    }
     if (toggleMusicButton) {
          const currentTitleKey = toggleMusicButton.dataset.i18n || "[title]gameInterface.toggleMusicButtonTitlePlay";
          let key = currentTitleKey;
          let attribute = 'title';
           const match = key.match(/^\[(.*?)\](.*)/);
           if (match) {
               attribute = match[1];
               key = match[2];
           }
          toggleMusicButton.setAttribute(attribute, t(key));
     }
     if (toggleTTSButton) { // Обновление для кнопки TTS
        const currentTTSTitleKey = toggleTTSButton.dataset.i18n || "[title]gameInterface.toggleTTSButtonTitlePlay";
        let ttsKey = currentTTSTitleKey;
        let ttsAttribute = 'title';
        const ttsMatch = ttsKey.match(/^\[(.*?)\](.*)/);
        if (ttsMatch) {
            ttsAttribute = ttsMatch[1];
            ttsKey = ttsMatch[2];
        }
        toggleTTSButton.setAttribute(ttsAttribute, t(ttsKey));
    }
      if (globalLocationsList && globalLocationsList.children.length === 1 && globalLocationsList.firstElementChild.tagName === 'LI') {
          const li = globalLocationsList.firstElementChild;
          if (Object.keys(globalLocations || {}).filter(key => key !== 'startLocation').length === 0) {
              if (worldLore.startsWith(t('error.prefix', 'Ошибка:')) || worldLore === "Загрузка лора...") {
                   li.textContent = t('gameInterface.mapPanel.errorWorldData');
              } else {
                   li.textContent = t('gameInterface.mapPanel.noGlobal');
              }
          }
      }
 }

// --- Инициализация Приложения ---
async function initializeApp() {
    console.log("Инициализация приложения...");

    try {
        const configResponse = await fetch('config.json?t=' + Date.now());
        if (!configResponse.ok) {
            throw new Error(`Файл config.json не найден или не может быть загружен (статус: ${configResponse.status})`);
        }
        const config = await configResponse.json();
        if (!config.apiUrl || typeof config.apiUrl !== 'string' || config.apiUrl.trim() === '') {
            throw new Error('Ключ "apiUrl" отсутствует, пуст или имеет неверный формат в config.json.');
        }
        PROXY_API_ENDPOINT = config.apiUrl;
        console.log(`Адрес сервера успешно загружен из config.json: ${PROXY_API_ENDPOINT}`);
    } catch (error) {
        console.error('КРИТИЧЕСКАЯ ОШИБКА при загрузке конфигурации:', error);
        alert(`Критическая ошибка: не удалось загрузить конфигурацию сервера из config.json. Игра не может быть запущена.\n\nДетали: ${error.message}`);
        return; 
    }

    currentApiProvider = localStorage.getItem('apiProvider') || 'gemini';
    try { geminiApiKeys = JSON.parse(localStorage.getItem('geminiApiKeys')) || []; } catch(e) { geminiApiKeys = []; }
    geminiApiKey = geminiApiKeys.length > 0 ? geminiApiKeys[0] : '';
    geminiModelId = localStorage.getItem('geminiModelId') || 'gemini-1.5-flash-latest';
    llmostApiKey = localStorage.getItem('llmostApiKey') || '';
    llmostModelId = localStorage.getItem('llmostModelId') || 'openai/gpt-4';
    openrouterApiKey = localStorage.getItem('openrouterApiKey') || '';
    openrouterModelId = localStorage.getItem('openrouterModelId') || 'anthropic/claude-3-haiku';
    localApiUrl = localStorage.getItem('localApiUrl') || 'http://localhost:1234/v1/chat/completions';
    localModelId = localStorage.getItem('localModelId') || 'local-model';




    initSettingsUI();
    
    await loadLanguagesConfig();
    currentLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY) || DEFAULT_LANGUAGE;
    if (!availableLanguages[currentLanguage]) {
        currentLanguage = DEFAULT_LANGUAGE;
    }
    document.documentElement.lang = currentLanguage;
    if (languageSelect) {
        languageSelect.value = currentLanguage;
    }
    await loadTranslations(currentLanguage);
    applyTranslations();

    const results = await Promise.allSettled([
        loadLore(DEFAULT_WORLD_ID, currentLanguage),
        loadGlobalLocations(DEFAULT_WORLD_ID, currentLanguage),
        loadSkillsReference(DEFAULT_WORLD_ID, currentLanguage),
        loadEnvironmentCommandsGuide(DEFAULT_WORLD_ID, currentLanguage),
        loadItemsReference(),
        loadCombatSystemRules(),
        loadPredefinedEffects()
    ]);

    const failedLoads = results.filter(result => result.status === 'rejected');

    if (failedLoads.length > 0) {
        console.error("КРИТИЧЕСКАЯ ОШИБКА: Не удалось загрузить следующие основные файлы игры:");
        failedLoads.forEach(result => {
            console.error(result.reason);
        });
        
        if (worldLore.startsWith('Ошибка:') || Object.keys(globalLocations).length === 0) {
             alert(t('error.worldLoadFailed', { worldId: DEFAULT_WORLD_ID }));
             return; 
        } else {
             showCustomAlert("Не удалось загрузить некоторые вспомогательные данные. Игра может работать некорректно. Проверьте консоль (F12).");
        }
    } else {
        console.log(`Все начальные данные мира ('${DEFAULT_WORLD_ID}', язык: ${currentLanguage}) успешно загружены.`);
    }
    
    updateMapDisplay();

    if (hasElectronAPI) {
        console.log("Окружение Electron. Используется нативная файловая система.");
        updateFSAStatus(); 
    } else if (fsaApiAvailable) {
        console.log("Окружение Веб. Проверка доступа к File System Access API.");
        const handleFromDB = await getDirectoryHandleFromDB();
        
        if (handleFromDB && typeof handleFromDB.queryPermission === 'function') {
            directoryHandle = handleFromDB;
            if (await verifyDirectoryHandlePermission(directoryHandle)) {
                console.log("Доступ к ранее выбранной папке подтвержден.");
                updateFSAStatus(directoryHandle, 'granted_from_db');
            } else {
                console.warn("Разрешение на доступ к папке было отозвано. Нужно выбрать заново.");
                directoryHandle = null;
                await saveDirectoryHandleToDB(null);
                updateFSAStatus(null, 'permission_revoked_on_load');
            }
        } else {
             if (handleFromDB) {
                 console.warn("В IndexedDB найден невалидный хэндл. Очистка...");
                 await saveDirectoryHandleToDB(null);
             }
             updateFSAStatus(null, 'not_selected_on_load');
        }
    } else {
        console.log("File System Access API не поддерживается. Используется localStorage.");
        updateFSAStatus();
    }

    updateApiKeyStatus();

    setupTTS();
    setupMusicPlayer();
    
    setActiveScreen('main-menu');
    setupEventListeners();

    bodySlots.forEach(slot => {
        equipmentElements[slot] = document.getElementById(`equipment-slot-${slot}`);
    });

    startBackgroundChanger();
    updateDynamicUIText();
    
    console.log("Инициализация приложения завершена.");
}

// --- УПРАВЛЕНИЕ UI НАСТРОЕК ---
function initSettingsUI() {
    const providerSelect = document.getElementById('api-provider-select');
    const modelIdInput = document.getElementById('model-id-input');

    // Находим все группы настроек
    const settingsGroups = {
        gemini: document.getElementById('gemini-settings-group'),
        llmost: document.getElementById('llmost-settings-group'),
        openrouter: document.getElementById('openrouter-settings-group'),
        deepseek: document.getElementById('deepseek-settings-group'),
        local: document.getElementById('local-settings-group')
    };
    
    // Находим все поля для API ключей
    const keyInputs = {
        gemini: document.getElementById('gemini-api-key-input'),
        llmost: document.getElementById('llmost-api-key-input'),
        openrouter: document.getElementById('openrouter-api-key-input'),
        deepseek: document.getElementById('deepseek-api-key-input')
    };

    const localUrlInput = document.getElementById('local-url-input');

    // Функция для переключения видимости и загрузки данных
    const switchProviderView = (provider) => {
        // 1. Скрываем все группы
        Object.values(settingsGroups).forEach(group => {
            if (group) group.style.display = 'none';
        });

        // 2. Показываем нужную группу
        if (settingsGroups[provider]) {
            settingsGroups[provider].style.display = 'block';
        }

        // 3. Загружаем и устанавливаем ID модели для выбранного провайдера
        let modelId = '';
        switch (provider) {
            case 'gemini':     modelId = geminiModelId; break;
            case 'llmost':     modelId = llmostModelId; break;
            case 'openrouter': modelId = openrouterModelId; break;
            case 'deepseek':   modelId = deepseekModelId; break;
            case 'local':      modelId = localModelId; break; // Для LM Studio это тоже ID
        }
        if (modelIdInput) modelIdInput.value = modelId;
        
        // Обновляем заголовок для поля ввода модели
        const modelLabel = document.querySelector('#model-id-input-group label');
        if(modelLabel) modelLabel.textContent = t('settingsMenu.modelIdLabelFor', { provider: provider.charAt(0).toUpperCase() + provider.slice(1) });
    };

    // Устанавливаем начальные значения из глобальных переменных
    if (providerSelect) providerSelect.value = currentApiProvider;
    if (keyInputs.gemini) keyInputs.gemini.value = geminiApiKeys.join('\n');
    if (keyInputs.llmost) keyInputs.llmost.value = llmostApiKey;
    if (keyInputs.openrouter) keyInputs.openrouter.value = openrouterApiKey;
    if (keyInputs.deepseek) keyInputs.deepseek.value = deepseekApiKey;
    if (localUrlInput) localUrlInput.value = localApiUrl;

    // Устанавливаем первоначальное отображение
    switchProviderView(currentApiProvider);

    // Вешаем обработчик события
    if (providerSelect) {
        providerSelect.addEventListener('change', () => {
            currentApiProvider = providerSelect.value;
            switchProviderView(currentApiProvider);
        });
    }
}

// --- СОХРАНЕНИЕ НАСТРОЕК ---
// Замени старую функцию saveApiKey на эту (или обнови слушатель события)
function saveSettings() {
    const provider = document.getElementById('api-provider-select')?.value || 'gemini';
    const modelId = document.getElementById('model-id-input')?.value.trim() || '';

    // Сохраняем ID модели для ТЕКУЩЕГО провайдера
    switch (provider) {
        case 'gemini':
            geminiModelId = modelId;
            localStorage.setItem('geminiModelId', geminiModelId);
            break;
        case 'llmost':
            llmostModelId = modelId;
            localStorage.setItem('llmostModelId', llmostModelId);
            break;
        case 'openrouter':
            openrouterModelId = modelId;
            localStorage.setItem('openrouterModelId', openrouterModelId);
            break;
        case 'deepseek':
            deepseekModelId = modelId;
            localStorage.setItem('deepseekModelId', deepseekModelId);
            break;
        case 'local':
            localModelId = modelId;
            localStorage.setItem('localModelId', localModelId);
            break;
    }

    // Сохраняем ключи и URL
    const geminiKeyInput = document.getElementById('gemini-api-key-input')?.value.trim() || '';
    geminiApiKeys = geminiKeyInput.split(/[\n,]+/).map(k => k.trim()).filter(k => k.length > 10);
    geminiApiKey = geminiApiKeys.length > 0 ? geminiApiKeys[0] : '';
    localStorage.setItem('geminiApiKeys', JSON.stringify(geminiApiKeys));
    currentGeminiKeyIndex = 0;

    const llmostKey = document.getElementById('llmost-api-key-input')?.value.trim() || '';
    llmostApiKey = llmostKey;
    localStorage.setItem('llmostApiKey', llmostKey);

    const openrouterKey = document.getElementById('openrouter-api-key-input')?.value.trim() || '';
    openrouterApiKey = openrouterKey;
    localStorage.setItem('openrouterApiKey', openrouterKey);

    const deepseekKey = document.getElementById('deepseek-api-key-input')?.value.trim() || '';
    deepseekApiKey = deepseekKey;
    localStorage.setItem('deepseekApiKey', deepseekKey);

    const localUrl = document.getElementById('local-url-input')?.value.trim() || '';
    localApiUrl = localUrl;
    localStorage.setItem('localApiUrl', localUrl);
    
    // Обновляем глобальную переменную текущего провайдера
    currentApiProvider = provider;
    localStorage.setItem('apiProvider', currentApiProvider);



    updateApiKeyStatus();
    showCustomAlert(t('settingsMenu.apiKeySaved', 'Настройки успешно сохранены!'));
    
    if (document.activeElement) document.activeElement.blur();
}

async function loadEnvironmentCommandsGuide(worldId, langCode) {
    const filePath = `assets/promts/environment_commands_guide.txt`;
    console.log(`Попытка загрузить руководство по командам окружения из: ${filePath}`);
    try {
        const response = await fetch(`${filePath}?t=${Date.now()}`); // ИСПРАВЛЕНИЕ: Добавлен cache-buster
        if (!response.ok) {
             throw new Error(`HTTP ошибка! статус: ${response.status}. Не удалось загрузить ${response.url}`);
        }
        environmentCommandsGuideData = await response.text();
        console.log(`Руководство по командам окружения для '${worldId}' (язык: ${langCode}) успешно загружено.`);
    } catch (error) {
        console.error(`Не удалось загрузить руководство по командам окружения для '${worldId}' (язык: ${langCode}):`, error);
        environmentCommandsGuideData = t('error.envGuideNotLoadedLang', { worldId: worldId, lang: langCode, error: error.message }, `// Ошибка: Не удалось загрузить руководство по командам окружения для мира '${worldId}' (Язык: ${langCode}). ${error.message}`);
    }
}


async function loadSkillsReference() {
    const filePath = `assets/promts/skills_reference_prompt.txt`; // Путь к файлу
    console.log(`Попытка загрузить справочник умений из: ${filePath}`);
    try {
        const response = await fetch(filePath);
        if (!response.ok) {
             throw new Error(`HTTP ошибка! статус: ${response.status}. Не удалось загрузить ${response.url}`);
        }
        skillsReferenceData = await response.text();
        console.log(`Справочник умений успешно загружен.`);
    } catch (error) {
        console.error(`Не удалось загрузить справочник умений:`, error);
        skillsReferenceData = t('error.skillsRefNotLoaded', '// Ошибка: Не удалось загрузить справочник умений.');
    }
}

// --- Загрузка Данных Мира ---
async function loadLore(worldId, langCode) {
    if (!worldId) {
        console.error("Не удается загрузить лор: worldId не предоставлен.");
        worldLore = t('error.worldNotSpecified', 'Ошибка: Мир не указан.');
        return;
    }
    const filePath = `assets/lor/${worldId}/${langCode}/lor.txt`;
    console.log(`Попытка загрузить лор из: ${filePath}`);

    try {
        const response = await fetch(`${filePath}?t=${Date.now()}`); // ИСПРАВЛЕНИЕ: Добавлен cache-buster
        if (!response.ok) {
             throw new Error(`HTTP ошибка! статус: ${response.status}. Не удалось загрузить ${response.url}`);
        }
        worldLore = await response.text();
        console.log(`Лор мира для '${worldId}' (язык: ${langCode}) успешно загружен.`);
    } catch (error) {
        console.error(`Не удалось загрузить лор мира для '${worldId}' (язык: ${langCode}):`, error);
        worldLore = t('error.loadLoreFailedLang', { worldId: worldId, lang: langCode, error: error.message }, `Ошибка: Не удалось загрузить лор для мира '${worldId}' (Язык: ${langCode}).`);
        globalLocations = {};
        updateMapDisplay();
    }
}

async function loadGlobalLocations(worldId, langCode) {
     if (!worldId) {
        console.error("Не удается загрузить локации: worldId не предоставлен.");
        globalLocations = {};
        return;
     }
     const filePath = `assets/lor/${worldId}/${langCode}/locations_expanded.json`;
     console.log(`Попытка загрузить локации из: ${filePath}`);

    try {
        const response = await fetch(`${filePath}?t=${Date.now()}`); // ИСПРАВЛЕНИЕ: Добавлен cache-buster
        if (!response.ok) {
             throw new Error(`HTTP ошибка! статус: ${response.status}. Не удалось загрузить ${response.url}`);
        }
        globalLocations = await response.json();
        console.log(`Глобальные локации для '${worldId}' (язык: ${langCode}) успешно загружены:`, globalLocations);
    } catch (error) {
        console.error(`Не удалось загрузить глобальные локации для '${worldId}' (язык: ${langCode}):`, error);
        globalLocations = {};
        if(globalLocationsList) globalLocationsList.innerHTML = `<li>${t('gameInterface.mapPanel.errorLoadingWorldDataLang', { worldId: worldId, lang: langCode })}</li>`;
    }
    updateMapDisplay();
}

// --- Настройка Слушателей Событий ---
function setupEventListeners() {
    // --- Главное меню ---
    newGameButton.addEventListener('click', startNewGameSetup);
    loadGameButton.addEventListener('click', () => showLoadGameScreen());
    mainSettingsButton.addEventListener('click', () => {
        settingsReturnScreen = 'main-menu'; // Устанавливаем экран возврата
        setActiveScreen('settings-menu');
    });
    if (helpButton) {
        helpButton.addEventListener('click', () => setActiveScreen('help-screen'));
    }
    if (communityButton) {
        communityButton.addEventListener('click', () => {
            window.open('https://discord.com/invite/kDnTx2HAvT', '_blank');
        });
    }

    // --- Меню настроек ---
    if (saveSettingsButton) saveSettingsButton.addEventListener('click', saveSettings);
    
    const localSaveBtn = document.querySelector('#local-settings-group button');
    if (localSaveBtn && localSaveBtn !== saveSettingsButton) {
        localSaveBtn.addEventListener('click', saveSettings);
    }

    // --- Бросок кубика ---
    if (rollDiceButton) {
        rollDiceButton.addEventListener('click', handleRollDiceButtonClick);
    }

    // --- Создание персонажа ---
    if (charEraSelect) {
        charEraSelect.addEventListener('change', updateEraDescription);
    }
    charRaceSelect.addEventListener('change', handleRaceOrClassChange);
    charClassSelect.addEventListener('change', handleRaceOrClassChange);
    statButtons.forEach(button => button.addEventListener('click', handleStatChange));
    charNameInput.addEventListener('input', checkCreationFormValidity);
    charDescInput.addEventListener('input', checkCreationFormValidity);
    startGameButton.addEventListener('click', finalizeCharacterCreation);

    // --- Выбор Рассказчика ---
    narratorPrevButton.addEventListener('click', () => showNarrator(currentNarratorIndex - 1));
    narratorNextButton.addEventListener('click', () => showNarrator(currentNarratorIndex + 1));
    confirmNarratorButton.addEventListener('click', startGameWithNarrator);

    // --- Кнопки "Назад" ---
    if (settingsBackButton) {
        settingsBackButton.addEventListener('click', () => {
            setActiveScreen(settingsReturnScreen);
        });
    }
    
    backButtons.forEach(button => {
        if (button.id === 'settings-back-button') return;
        button.addEventListener('click', () => {
            const targetMenu = button.getAttribute('data-target');
            if (targetMenu) {
                setActiveScreen(targetMenu);
                if (creationError) creationError.textContent = '';
            }
        });
    });

    // --- Сворачиваемые панели ---
    collapsiblePanels.forEach(panel => {
        const toggle = panel.querySelector('.panel-toggle');
        if (toggle) {
            toggle.addEventListener('click', () => {
                const content = panel.querySelector('.panel-content');
                const icon = toggle.querySelector('.toggle-icon');
                const isExpanded = panel.classList.toggle('expanded');
                
                if(icon) icon.textContent = isExpanded ? '▼' : '▶';
                
                if (content) {
                    if (isExpanded) {
                        content.style.maxHeight = content.scrollHeight + "px";
                        setTimeout(() => { if (panel.classList.contains('expanded')) content.style.maxHeight = 'none'; }, 400);
                    } else {
                        content.style.maxHeight = content.scrollHeight + "px";
                        requestAnimationFrame(() => { content.style.maxHeight = '0'; });
                    }
                }
            });
        }
    });

    // --- Внутриигровое меню ---
    inGameMenuButton.addEventListener('click', openInGameMenu);
    closeInGameMenuButton.addEventListener('click', closeInGameMenu);
    menuOverlay.addEventListener('click', closeInGameMenu);
    inGameSaveButton.addEventListener('click', async () => {
        await promptManualSave();
        closeInGameMenu();
    });
    if (inGameSettingsButton) {
        inGameSettingsButton.addEventListener('click', openSettingsFromGame);
    }
    inGameExitButton.addEventListener('click', () => exitToMainMenu());

    // --- Увеличение характеристик ---
    statIncreaseButtons.forEach(button => {
        button.addEventListener('click', handleStatIncrease);
    });

    // --- Ввод пользователя (Текст и Голос) ---
    sendButton.addEventListener('click', handleUserInput);
    userInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && !isWaitingForAI) {
            event.preventDefault();
            handleUserInput();
        }
    });
    if (voiceInputButton) {
        voiceInputButton.addEventListener('click', toggleVoiceRecognition);
    }
    
    // --- Модальное окно репутации ---
    if (reputationDisplayWrapper && reputationModal) {
        reputationDisplayWrapper.addEventListener('mouseenter', (event) => {
            updateReputationModal();
            positionReputationModal(event);
        });
        reputationDisplayWrapper.addEventListener('mousemove', positionReputationModal);
        reputationDisplayWrapper.addEventListener('mouseleave', () => {
            reputationModal.classList.remove('visible');
        });
    }

    // --- [ИСПРАВЛЕНИЕ] Обработчик кликов по OOC-маркерам ---
    const oocTooltip = document.getElementById('ooc-tooltip');
    const oocTooltipContent = document.getElementById('ooc-tooltip-content');
    if (gameLog && oocTooltip && oocTooltipContent) {
        gameLog.addEventListener('click', (event) => {
            const marker = event.target.closest('.ooc-marker');
            if (marker) {
                event.stopPropagation(); // Останавливаем всплытие, чтобы body не закрыл окно сразу
                
                const text = marker.dataset.oocText;
                oocTooltipContent.textContent = text;
                
                // Позиционируем и показываем
                const rect = marker.getBoundingClientRect();
                oocTooltip.style.left = `${rect.left}px`;
                oocTooltip.style.top = `${rect.bottom + 5}px`; // Чуть ниже маркера
                oocTooltip.classList.add('visible');
            }
        });
        
        // Клик в любом другом месте закрывает подсказку
        document.body.addEventListener('click', () => {
            if (oocTooltip.classList.contains('visible')) {
                oocTooltip.classList.remove('visible');
            }
        });
    }
    // --- [КОНЕЦ ИСПРАВЛЕНИЯ] ---

    // --- Событие закрытия окна/вкладки ---
    window.addEventListener('beforeunload', handleBeforeUnload);

    // --- Обработка вкладок инвентаря ---
    if (inventoryTabsContainer) {
        inventoryTabsContainer.addEventListener('click', (event) => {
            const target = event.target;
            if (target.classList.contains('tab-button')) {
                inventoryTabsContainer.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
                target.classList.add('active');
                currentInventoryFilter = target.dataset.category;
                updateInventoryDisplay();
            }
        });
    }
    
    // --- Обработка клика по слоту экипировки для снятия предмета (V2) ---
    bodySlots.forEach(slot => {
        const slotElement = document.getElementById(`equipment-slot-${slot}`);
        if (slotElement) {
            slotElement.addEventListener('click', (event) => {
                if (event.currentTarget.classList.contains('equipped')) {
                    const slotName = event.currentTarget.dataset.slot;
                    const feedback = unequipItem(slotName);
                    if (feedback) {
                        addLogMessage(feedback, 'command-feedback');
                    }
                }
            });
            // Добавляем обработчики для Drag-and-Drop
            slotElement.addEventListener('dragenter', handleDragEnter);
            slotElement.addEventListener('dragover', handleDragOver);
            slotElement.addEventListener('dragleave', handleDragLeave);
            slotElement.addEventListener('drop', handleDrop);
        }
    });
}

function handleDragStart(event, itemData) {
    // Сохраняем ID предмета для события drop
    event.dataTransfer.setData('text/plain', itemData.id);
    // Сохраняем полные данные о предмете в глобальную переменную для проверок в dragover
    draggedItemData = itemData;
    // Добавляем класс к перетаскиваемому элементу для стилизации
    event.currentTarget.classList.add('dragging');
}

function handleDragEnd(event) {
    // Очищаем данные и убираем классы стилизации
    draggedItemData = null;
    event.currentTarget.classList.remove('dragging');
    // Убираем всю подсветку со слотов на всякий случай
    document.querySelectorAll('.equipment-slot-v2').forEach(slot => {
        slot.classList.remove('drag-over', 'drag-over-valid', 'drag-over-invalid');
    });
}

function handleDragEnter(event) {
    event.preventDefault();
    const targetSlot = event.currentTarget;
    if (!draggedItemData || !targetSlot) return;

    targetSlot.classList.add('drag-over');
    const slotName = targetSlot.dataset.slot;

    // Проверяем, подходит ли предмет для этого слота
    let isValid = true;
    if (draggedItemData.slot && draggedItemData.slot !== slotName) {
        if (!(['right_hand', 'left_hand'].includes(slotName) &&['right_hand', 'left_hand'].includes(draggedItemData.slot))) {
            isValid = false;
        }
    }
    if (!isValid) {
        targetSlot.classList.add('drag-over-invalid');
    } else {
        targetSlot.classList.add('drag-over-valid');
    }
}

function handleDragOver(event) {
    // Обязательно вызываем preventDefault, чтобы разрешить drop
    event.preventDefault();
}

function handleDragLeave(event) {
    // Убираем подсветку, когда курсор уходит со слота
    event.currentTarget.classList.remove('drag-over', 'drag-over-valid', 'drag-over-invalid');
}

// --- Логика Старта Новой Игры ---
function startNewGameSetup() {
    // --- [ИСПРАВЛЕНИЕ] Универсальная проверка API ключа ---
    let keyIsMissing = false;
    let requiredKey = '';

    // Проверяем ключ только если провайдер не 'local'
    if (currentApiProvider !== 'local') {
        switch (currentApiProvider) {
            case 'gemini':
                requiredKey = geminiApiKey || (geminiApiKeys.length > 0 ? geminiApiKeys[0] : '');
                break;
            case 'llmost':
                requiredKey = llmostApiKey;
                break;
            case 'openrouter':
                requiredKey = openrouterApiKey;
                break;
            case 'deepseek':
                requiredKey = deepseekApiKey;
                break;
        }

        if (!requiredKey || requiredKey.trim() === '') {
            keyIsMissing = true;
        }
    }

    if (keyIsMissing) {
        // Используем кастомный alert вместо стандартного
        const providerName = currentApiProvider.charAt(0).toUpperCase() + currentApiProvider.slice(1);
        showCustomAlert(t('error.apiKeyNeededForProvider', { provider: providerName }, `Для начала игры требуется API ключ для провайдера ${providerName}. Пожалуйста, введите его в настройках.`));
        settingsReturnScreen = 'main-menu'; // Убедимся, что вернемся в главное меню
        setActiveScreen('settings-menu');
        return;
    }
    // --- [КОНЕЦ ИСПРАВЛЕНИЯ] ---

    // Если проверка прошла, остальная часть функции выполняется как и раньше
    if (worldLore.startsWith(t('error.prefix', "Ошибка:")) || Object.keys(globalLocations).length === 0) {
         alert(t('error.worldLoadFailed', { worldId: DEFAULT_WORLD_ID }, `Не удалось загрузить данные для мира по умолчанию (${DEFAULT_WORLD_ID}). Проверьте консоль (F12) и файлы лора.`));
         return;
    }

    console.log(`Начало настройки новой игры для мира по умолчанию: ${DEFAULT_WORLD_ID}`);
    
    player = null;
    conversationHistory = [];
    currentSaveSlot = null;
    nextInternalQuestId = 1;
    nextInternalItemId = 1;
    nextInternalEntityId = 1;
    nextInternalSkillId = 1;
    nextInternalMapMarkerId = 1;

    resetCharacterCreation(); 
    setActiveScreen('character-creation-screen');
    updateDynamicUIText(); 
}


/**
 * Обновляет и анимирует блок с описанием выбранной эпохи.
 */
function updateEraDescription() {
    if (!charEraSelect || !eraDescriptionBox) return;

    // Находим выбранный элемент <option>
    const selectedOption = charEraSelect.options[charEraSelect.selectedIndex];
    if (!selectedOption) {
        eraDescriptionBox.classList.remove('visible');
        eraDescriptionBox.innerHTML = '';
        return;
    }

    // Получаем ключ для текста напрямую из data-атрибута
    const descriptionKey = selectedOption.dataset.descriptionKey;
    const descriptionText = t(descriptionKey, null, '');

    // Прячем блок, чтобы сменить текст и запустить анимацию заново
    eraDescriptionBox.classList.remove('visible');

    setTimeout(() => {
        if (descriptionText) {
            eraDescriptionBox.innerHTML = descriptionText;
            eraDescriptionBox.classList.add('visible');
        } else {
            eraDescriptionBox.innerHTML = '';
        }
    }, 200); // Небольшая задержка для плавной анимации
}

function resetCharacterCreation() {
    charNameInput.value = '';
    charRaceSelect.value = '';
    charClassSelect.value = '';
    if (charEraSelect) charEraSelect.value = 'rebirth';
    charDescInput.value = '';
    statDistributionSection.style.display = 'none';
    availableStatPoints = INITIAL_STAT_POINTS;
    currentCreationStats = {};
    baseStatsForDistribution = {};
    creationStatPointsDisplay.textContent = availableStatPoints;
    Object.keys(createStatDisplays).forEach(stat => {
        createStatDisplays[stat].textContent = '0';
    });
    creationError.textContent = '';
    startGameButton.disabled = true;
    updateDynamicUIText();
    
    // Вызываем обновление описания при сбросе
    setTimeout(updateEraDescription, 50);
}

function handleRaceOrClassChange() {
    const selectedRace = charRaceSelect.value;
    const selectedClass = charClassSelect.value;

    if (selectedRace && selectedClass && RACE_MODIFIERS[selectedRace] && BASE_CLASS_STATS[selectedClass]) {
        statDistributionSection.style.display = 'block';
        currentCreationStats = {};
        baseStatsForDistribution = {};

        Object.keys(BASE_CLASS_STATS.default).forEach(stat => {
            const classStat = BASE_CLASS_STATS[selectedClass][stat] || BASE_CLASS_STATS.default[stat];
            const raceMod = RACE_MODIFIERS[selectedRace][stat] || 0;
            baseStatsForDistribution[stat] = classStat + raceMod;
            currentCreationStats[stat] = baseStatsForDistribution[stat];
        });

        availableStatPoints = INITIAL_STAT_POINTS;
        updateStatCreationDisplay();
    } else {
        statDistributionSection.style.display = 'none';
        currentCreationStats = {};
        baseStatsForDistribution = {};
    }
    checkCreationFormValidity();
}

function handleStatChange(event) {
    const button = event.target;
    const stat = button.getAttribute('data-stat');
    const change = button.classList.contains('plus') ? 1 : -1;

    if (!charRaceSelect.value || !charClassSelect.value || baseStatsForDistribution[stat] === undefined) return;

    const baseStatValueForDistribution = baseStatsForDistribution[stat];

    if (change > 0 && availableStatPoints > 0) {
        currentCreationStats[stat]++;
        availableStatPoints--;
    } else if (change < 0 && currentCreationStats[stat] > baseStatValueForDistribution) {
        currentCreationStats[stat]--;
        availableStatPoints++;
    }
    updateStatCreationDisplay();
}

function updateStatCreationDisplay() {
    creationStatPointsDisplay.textContent = availableStatPoints;

    Object.keys(createStatDisplays).forEach(stat => {
        createStatDisplays[stat].textContent = currentCreationStats[stat] !== undefined ? currentCreationStats[stat] : (baseStatsForDistribution[stat] || '0');
    });

    statButtons.forEach(button => {
        const stat = button.getAttribute('data-stat');
        const isPlus = button.classList.contains('plus');
        const baseValue = baseStatsForDistribution[stat];
        const currentValue = currentCreationStats[stat];

        if (isPlus) {
            button.disabled = availableStatPoints <= 0;
        } else {
            button.disabled = currentValue === undefined || currentValue <= baseValue;
        }
    });
     checkCreationFormValidity();
}

function checkCreationFormValidity() {
    const nameValid = charNameInput.value.trim().length > 0 && charNameInput.value.length <= 50;
    const raceValid = charRaceSelect.value !== '' && RACE_MODIFIERS[charRaceSelect.value] !== undefined;
    const classValid = charClassSelect.value !== '' && BASE_CLASS_STATS[charClassSelect.value] !== undefined;
    const descValid = charDescInput.value.trim().length > 0 && charDescInput.value.length <= 120;
    const statsSectionVisible = statDistributionSection.style.display === 'block';
    startGameButton.disabled = !(nameValid && raceValid && classValid && descValid && (statsSectionVisible || (!raceValid || !classValid)));
}

async function finalizeCharacterCreation() {
    if (startGameButton.disabled) {
        creationError.textContent = t("characterCreation.errorFillFields");
        return;
    }

    const proceedToNarrator = async () => {
        const playerRace = charRaceSelect.value;
        const playerClass = charClassSelect.value;
        const selectedEra = charEraSelect.value;

        tempPlayer = {
            name: charNameInput.value.trim(),
            race: playerRace,
            class: playerClass,
            era: selectedEra,
            description: charDescInput.value.trim(),
            stats: {
                ...currentCreationStats,
                level: 1,
                xp: 0,
                xpNext: calculateXpForNextLevel(1),
                statPoints: 0,
                gold: 0, // [ИЗМЕНЕНИЕ] Стартовое золото теперь 0. GM выдаст его сам.
                reputation: { global: 0 },
                turnCount: 0,
            },
            equipment: {},
            // --- [ГЛАВНОЕ ИЗМЕНЕНИЕ] ---
            // Было: inventory: { ...getStartingInventory(playerClass) },
            inventory: {}, // Стало: инвентарь теперь по умолчанию пуст.
            // --- [КОНЕЦ ИЗМЕНЕНИЯ] ---
            gmNotes: { "Main_Plot": "Начало пути. Игрок появляется в стартовой локации." },
            memoryArchives: {},
            archiveSummaries: {},
            factionData: { global: t('factions.global', null, 'Общая') },
            location: t('world.generatingStartLocation', "Генерация стартовой точки..."),
            nexusData: {},
            quests: {},
            skills: {},
            mapMarkers: {},
            statusEffects: {},
            visibleEntities: {}
        };
        
        tempPlayer.stats.maxHp = calculateMaxHp(tempPlayer.stats.con);
        tempPlayer.stats.hp = tempPlayer.stats.maxHp;
        tempPlayer.inventoryCapacity = 10 + Math.floor((tempPlayer.stats.str - 10) / 2);

        if (tempPlayer.class === 'mage') {
            tempPlayer.stats.maxMana = calculateMaxMana(tempPlayer.stats.int, tempPlayer.stats.level);
            tempPlayer.stats.mana = tempPlayer.stats.maxMana;
        } else {
            tempPlayer.stats.mana = 0;
            tempPlayer.stats.maxMana = 0;
        }

        console.log("Персонаж временно создан для эпохи '" + selectedEra + "', переход к выбору рассказчика:", tempPlayer);

        if (narrators.length === 0) {
            await loadNarrators();
        }
        showNarrator(0);
        setActiveScreen('narrator-selection-screen');
        if (document.activeElement) document.activeElement.blur();
    };

    if (availableStatPoints > 0 && statDistributionSection.style.display === 'block') {
        showCustomConfirm(
            t('characterCreation.confirmPointsLeft', { points: availableStatPoints }),
            proceedToNarrator
        );
    } else {
        await proceedToNarrator();
    }
}

/**
 * Сохраняет текущие данные из формы создания персонажа в объект.
 * Используется для восстановления формы в случае ошибки API.
 * @returns {object|null} Объект с данными формы или null, если экран создания не активен.
 */
function backupCreationForm() {
    // Убеждаемся, что мы на экране создания персонажа
    if (!characterCreationScreen || !characterCreationScreen.classList.contains('active-screen')) {
        return null;
    }
    
    return {
        name: charNameInput.value,
        race: charRaceSelect.value,
        class: charClassSelect.value,
        era: charEraSelect.value,
        description: charDescInput.value,
        // Сохраняем распределенные статы и оставшиеся очки
        stats: { ...currentCreationStats },
        availablePoints: availableStatPoints
    };
}

async function startGameWithNarrator() {
    if (!tempPlayer) {
        console.error("Ошибка: Временные данные игрока отсутствуют. Возврат к созданию персонажа.");
        setActiveScreen('character-creation-screen');
        return;
    }

    // 1. Копируем данные, но ПОКА НЕ ОЧИЩАЕМ tempPlayer
    player = tempPlayer;

    conversationHistory = [];
    currentSaveSlot = null;
    nextInternalQuestId = 1;
    nextInternalItemId = 1;
    nextInternalEntityId = 1;

    console.log("Игра начинается с персонажем:", player);
    
    initializeGameInterface();
    setActiveScreen('game-interface');
    showLoadingScreen('loadingScreen.generatingWorld', 'Генерация мира...');

    const selectedNarrator = narrators[currentNarratorIndex];
    let narratorStyleGuide = "Стиль повествования - нейтральный и сбалансированный.";
    try {
        const response = await fetch(selectedNarrator.promptFile);
        if (response.ok) {
            narratorStyleGuide = await response.text();
        } else {
            console.warn(`Не удалось загрузить файл стиля рассказчика: ${selectedNarrator.promptFile}`);
        }
    } catch (e) {
        console.error(`Ошибка загрузки файла стиля рассказчика:`, e);
    }

    const currentWorldLore = worldLore;
    const inventoryString = Object.keys(player.inventory).length > 0
        ? Object.values(player.inventory).map(i => `${i.name} x${i.quantity}`).join(', ')
        : t('gameInterface.inventoryPanel.empty');

    let initialPromptFile = 'assets/promts/initial_prompt_rebirth.txt'; // Файл по умолчанию
    switch (player.era) {
        case 'architects':
            initialPromptFile = 'assets/promts/initial_prompt_architects.txt';
            break;
        case 'sundering':
            initialPromptFile = 'assets/promts/initial_prompt_sundering.txt';
            break;
        case 'silence':
            initialPromptFile = 'assets/promts/initial_prompt_silence.txt';
            break;
    }
    console.log(`Загрузка стартового промпта для эпохи '${player.era}': ${initialPromptFile}`);
    const initialPromptTemplate = await loadPromptFromFile(initialPromptFile);

    if (initialPromptTemplate.startsWith('Ошибка:')) {
        addLogMessage(t('error.loadPromptFailed', { filePath: initialPromptFile }), 'system-message');
        hideLoadingScreen();
        isWaitingForAI = false;
        if (userInput) userInput.disabled = false;
        if (sendButton) sendButton.disabled = false;
        return;
    }
    
    let itemsRefStringInitial = "Справочник предметов не загружен или пуст.";
    if (Array.isArray(itemsReferenceData) && itemsReferenceData.length > 0) {
        try {
            const itemsForPrompt = itemsReferenceData.slice(0, 50).map(item => ({id: item.id, name: item.name, type: item.type, rarity: item.rarity, description: item.description.substring(0,100) + "..."}));
            itemsRefStringInitial = JSON.stringify(itemsForPrompt, null, 2);
            if (itemsReferenceData.length > 50) itemsRefStringInitial += "\n... (и другие предметы)";
        } catch (e) { console.error("Ошибка сериализации itemsReferenceData для начального промпта:", e); }
    }

    const startPrompt = initialPromptTemplate
        .replace(/{worldId}/g, DEFAULT_WORLD_ID)
        .replace(/{name}/g, player.name)
        .replace(/{race}/g, t(`characterCreation.race${player.race.charAt(0).toUpperCase() + player.race.slice(1)}`, null, player.race))
        .replace(/{class}/g, t(`characterCreation.class${player.class.charAt(0).toUpperCase() + player.class.slice(1)}`, null, player.class))
        .replace(/{level}/g, player.stats.level)
        .replace(/{description}/g, player.description)
        .replace(/{str}/g, player.stats.str)
        .replace(/{dex}/g, player.stats.dex)
        .replace(/{int}/g, player.stats.int)
        .replace(/{con}/g, player.stats.con)
        .replace(/{cha}/g, player.stats.cha)
        .replace(/{inventory}/g, inventoryString)
        .replace(/{lore}/g, currentWorldLore)
        .replace(/{itemsReference}/g, itemsRefStringInitial)
        .replace(/{language}/g, currentLanguage === 'ru' ? 'Russian' : 'English')
        .replace(/{narrator_style_guide}/g, narratorStyleGuide);

    sendApiRequest(startPrompt, true);

    // 2. Очищаем tempPlayer только В САМОМ КОНЦЕ, после того как все запущено
    tempPlayer = null;
	stopMenuMusic();
}

// --- Вспомогательные функции для персонажа ---
function calculateMaxMana(intelligence, level) {
    const baseMana = 50;
    const intModifier = Math.floor((intelligence - 10)); // Каждый пункт INT выше 10 дает 1 маны
    return Math.max(10, baseMana + (intModifier * level) + (level * 5)); // И еще 5 за уровень
}

function calculateMaxHp(constitution) {
    const baseHp = 80;
    const conModifier = Math.floor((constitution - 10) / 2); // +1 HP за каждые 2 CON выше 10
    const currentLevel = player ? player.stats.level : 1;
    return Math.max(10, baseHp + (conModifier * currentLevel) + (currentLevel * 10)); // +10 HP за уровень
}

function getStartingInventory(playerClass) {
    let startingItemConfig = {}; // itemAiIdentifier: quantity
    switch (playerClass) {
        case 'warrior':
            startingItemConfig = {
                'sword_short_common': 1,
                'shield_wooden_common': 1,
                'potion_heal_small_common': 1
            };
            break;
        case 'mage':
            startingItemConfig = {
                'staff_simple_common': 1,
                'robe_novice_common': 1,
                'mana_potion_small_common': 2
            };
            break;
        case 'rogue':
            startingItemConfig = {
                'dagger_rusty_common': 2, // Changed from dagger_basic
                'leather_armor_light_common': 1,
                'lockpicks_common': 1 // Quantity 1 for a set
            };
            break;
        case 'bard':
            startingItemConfig = {
                'lute_simple_common': 1,
                'dagger_rusty_common': 1, // Changed from dagger_basic
                // 'colorful_clothes' is not in items_reference.json yet, let's skip or add it
            };
            break;
        default:
            return {};
    }

    const inventory = {};
    if (!Array.isArray(itemsReferenceData)) {
        console.error("Справочник предметов не загружен или имеет неверный формат. Невозможно выдать стартовый инвентарь.");
        return {};
    }

    for (const itemAiId in startingItemConfig) {
        const quantity = startingItemConfig[itemAiId];
        const itemRef = itemsReferenceData.find(ref => ref.id === itemAiId);

        if (itemRef) {
            const internalId = nextInternalItemId++; // Ensure nextInternalItemId is initialized globally
            inventory[internalId] = {
                id: internalId,
                aiIdentifier: itemAiId,
                name: itemRef.name,
                quantity: quantity,
                description: itemRef.description || t('itemDescriptions.noDescription'),
                rarity: itemRef.rarity,
                itemType: itemRef.type,
                effects: itemRef.effects || [],
                value: itemRef.value || 0
            };
        } else {
            console.warn(`[getStartingInventory] Ссылка на предмет не найдена для ID: ${itemAiId}. Предмет не добавлен.`);
        }
    }
    return inventory;
}

function calculateXpForNextLevel(level) {
     return Math.floor(100 * Math.pow(level, 1.5));
}

function levelUp() {
    if (!player) return;

    let levelsGainedThisCycle = 0;
    let totalHpGainThisCycle = 0;
    let totalStatPointsGainedThisCycle = 0;

    while (player.stats.xp >= player.stats.xpNext) {
        const excessXp = player.stats.xp - player.stats.xpNext;
        player.stats.level++;
        levelsGainedThisCycle++;
        player.stats.statPoints += POINTS_PER_LEVEL;
        totalStatPointsGainedThisCycle += POINTS_PER_LEVEL;
        player.stats.xp = Math.max(0, excessXp); // Опыт переносится
        player.stats.xpNext = calculateXpForNextLevel(player.stats.level);

        const oldMaxHp = player.stats.maxHp;
        player.stats.maxHp = calculateMaxHp(player.stats.con);
        const hpGainThisLevel = player.stats.maxHp - oldMaxHp;
        totalHpGainThisCycle += hpGainThisLevel;
        player.stats.hp = player.stats.maxHp; // Полное восстановление HP при уровне

        if (player.class === 'mage') {
            player.stats.maxMana = calculateMaxMana(player.stats.int, player.stats.level);
            player.stats.mana = player.stats.maxMana; // Полное восстановление маны
        }
        player.justLeveledUp = true;
    }

    if (levelsGainedThisCycle > 0) {
        addLogMessage(t('gameInterface.log.levelUpSummary', {
            finalLevel: player.stats.level
        }), "system-message level-up");

        if (totalHpGainThisCycle > 0) {
            addLogMessage(t('gameInterface.log.levelUpHPSummary', {
                totalHpGain: totalHpGainThisCycle
            }), "system-message level-up");
        }
        addLogMessage(t('gameInterface.log.levelUpPointsSummary', {
            totalStatPoints: totalStatPointsGainedThisCycle
        }), "system-message level-up");
        updateCharacterSheet(); // Обновит отображение, включая кнопки "+"
    }
}

function handleStatIncrease(event) {
    if (!player || player.stats.statPoints <= 0) return;
    const statToIncrease = event.target.getAttribute('data-stat');
    const validStats = ['str', 'dex', 'int', 'con', 'cha'];
    if (!statToIncrease || !validStats.includes(statToIncrease)) return;

    player.stats.statPoints--;
    player.stats[statToIncrease]++;

    if (statToIncrease === 'con') {
        const oldMaxHp = player.stats.maxHp;
        player.stats.maxHp = calculateMaxHp(player.stats.con);
        const hpDiff = player.stats.maxHp - oldMaxHp;
        player.stats.hp = Math.min((player.stats.hp || 0) + hpDiff, player.stats.maxHp);
    }
    if (statToIncrease === 'str') {
        player.inventoryCapacity = 10 + Math.floor((player.stats.str - 10) / 2);
    }
    if (statToIncrease === 'int' && player.class === 'mage') {
        const oldMaxMana = player.stats.maxMana;
        player.stats.maxMana = calculateMaxMana(player.stats.int, player.stats.level);
        player.stats.mana = Math.min((player.stats.mana || 0) + (player.stats.maxMana - oldMaxMana), player.stats.maxMana);
    }

    const statNameLocalized = t(`characterCreation.stat${statToIncrease.toUpperCase()}`);
    addLogMessage(t('gameInterface.log.statIncreased', { statName: statNameLocalized, points: player.stats.statPoints }), "command-feedback");
    
    // Сообщаем GM о действии
    queuePlayerActionForGM(`Player increased attribute '${statToIncrease.toUpperCase()}' to ${player.stats[statToIncrease]}.`);

    updateCharacterSheet();
}

function updateNexusDisplay() {
    const nexusList = document.getElementById('nexus-list');
    if (!player || !nexusList) return;

    nexusList.innerHTML = '';
    const nexusData = Object.values(player.nexusData || {});

    // Фильтруем служебные элементы, которые используются только для определения категории
    const actualItems = nexusData.filter(item => item && typeof item.name === 'string' && item.name !== item.category);

    if (actualItems.length === 0) {
        nexusList.innerHTML = `<li data-i18n="gameInterface.nexusPanel.empty">${t('gameInterface.nexusPanel.empty', 'Нет данных')}</li>`;
        return;
    }

    // Группируем отфильтрованные элементы по категориям
    const groupedData = actualItems.reduce((acc, item) => {
        const category = item.category || t('gameInterface.nexusPanel.defaultCategory', 'Прочее');
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(item);
        return acc;
    }, {});
    
    const sortedCategories = Object.keys(groupedData).sort((a, b) => a.localeCompare(b, currentLanguage));

    for (const category of sortedCategories) {
        const categoryHeader = document.createElement('li');
        categoryHeader.className = 'category-header';
        categoryHeader.textContent = category;
        nexusList.appendChild(categoryHeader);
        
        groupedData[category].sort((a,b) => a.name.localeCompare(b.name, currentLanguage)).forEach(item => {
            // *** ЗАЩИТА: Дополнительная проверка на корректность объекта ***
            if (!item || typeof item.name !== 'string' || typeof item.value === 'undefined') {
                console.error("Пропущен некорректный элемент Nexus:", item);
                return; // Пропускаем рендеринг сломанного элемента
            }

            const li = document.createElement('li');
            li.className = 'nexus-item';
            li.title = item.description || '';
            
            let valueDisplay = '';
            switch (item.displayType) {
                case 'boolean':
                    valueDisplay = item.value === 'true' 
                        ? t('gameInterface.nexusPanel.boolTrue', 'Да') 
                        : t('gameInterface.nexusPanel.boolFalse', 'Нет');
                    break;
                case 'numeric':
                    valueDisplay = `${item.value}`;
                    break;
                case 'text':
                default:
                    valueDisplay = `${item.value}`;
            }

            li.innerHTML = `<span class="nexus-name">${item.name}</span><span class="nexus-value">${valueDisplay}</span>`;
            nexusList.appendChild(li);
        });
    }
}

async function loadPredefinedEffects() {
    const filePath = 'assets/res/predefined_effects.json';
    console.log(`Попытка загрузить предопределенные эффекты из: ${filePath}`);
    try {
        const response = await fetch(`${filePath}?t=${Date.now()}`); // Cache busting
        if (!response.ok) {
            throw new Error(`HTTP ошибка! статус: ${response.status}. Не удалось загрузить ${response.url}`);
        }
        const effectsArray = await response.json();
        
        // Преобразуем массив в объект для быстрого доступа по ID
        predefinedStatusEffects = effectsArray.reduce((acc, effect) => {
            acc[effect.id] = effect;
            return acc;
        }, {});

        console.log(`Предопределенные эффекты (${Object.keys(predefinedStatusEffects).length} шт.) успешно загружены.`);
    } catch (error) {
        console.error(`Критическая ошибка: не удалось загрузить или разобрать предопределенные эффекты:`, error);
        predefinedStatusEffects = {}; // В случае ошибки оставляем объект пустым
        showCustomAlert(`Ошибка загрузки базовых игровых данных (эффекты). Игра может работать некорректно. Детали: ${error.message}`);
    }
}

function processAutomatedNexusEffects() {
    if (!player || !player.nexusData) return;

    // --- СЮДА МОЖНО ДОБАВИТЬ ЛЮБЫЕ АВТОМАТИЧЕСКИЕ ЭФФЕКТЫ ---

    // Пример: Благословение Древних на Силу
    // GM создает константу с ID 'blessing_ancients_str', а этот код применяет эффект.
    const blessingStr = player.nexusData['blessing_ancients_str'];
    if (blessingStr && !blessingStr.effectApplied) { // Проверяем, не применялся ли эффект ранее
        const strengthGain = parseInt(blessingStr.value, 10) || 1;
        player.stats.str += strengthGain;
        player.nexusData['blessing_ancients_str'].effectApplied = true; // Ставим флаг, что эффект применен
        const feedback = `Благословение Древних наполняет вас силой! (Сила +${strengthGain})`;
        addLogMessage(feedback, 'level-up'); // Используем яркий стиль для заметности
        addCalculationMessage(`[NEXUS_AUTO] Эффект 'blessing_ancients_str' применен. STR +${strengthGain}.`);
    }
    
    // Пример: Дар Прозрения на Интеллект
    const insightInt = player.nexusData['insight_ancients_int'];
    if (insightInt && !insightInt.effectApplied) {
        const intellectGain = parseInt(insightInt.value, 10) || 1;
        player.stats.int += intellectGain;
        player.nexusData['insight_ancients_int'].effectApplied = true;
        const feedback = `Дар Прозрения обостряет ваш разум! (Интеллект +${intellectGain})`;
        addLogMessage(feedback, 'level-up');
        addCalculationMessage(`[NEXUS_AUTO] Эффект 'insight_ancients_int' применен. INT +${intellectGain}.`);
    }


    // После обработки всех эффектов, обновляем интерфейс
    updateCharacterSheet();
}

// --- Обновление Интерфейса ---
function initializeGameInterface() {
    if (!player) return;

    // --- АКТИВИРУЕМ УПРАВЛЕНИЕ КАРТОЙ ЗДЕСЬ! ---
    setupMapControls();

    gameTitle.textContent = t('appName') + ` | ${player.name}`;
    gameLog.innerHTML = ''; 
    if (calculationLog) { 
        calculationLog.innerHTML = `<p class="system-message" data-i18n="gameInterface.calcLogPanel.empty">${t('gameInterface.calcLogPanel.empty')}</p>`;
    }
    
    initQuickTags();

    updateCharacterSheet();
    updateNexusDisplay();
    updateEquipmentDisplay(); // <--- ДОБАВЛЕН ВЫЗОВ
    updateInventoryDisplay();
    updateStatusEffectsDisplay();
    updateQuestList();
    updateSkillsDisplay();
    updateMapDisplay(); // Эта функция вызовет renderVisualMap
    updateEnvironmentPanel();
    toggleStatIncreaseButtons();
    userInput.disabled = false;
    sendButton.disabled = false;
    userInput.focus();

    collapsiblePanels.forEach(panel => {
        const content = panel.querySelector('.panel-content');
        const icon = panel.querySelector('.toggle-icon');
        const shouldBeExpanded = panel.classList.contains('character-sheet');

        panel.classList.toggle('expanded', shouldBeExpanded);
        if(icon) icon.textContent = shouldBeExpanded ? '▼' : '▶';

        if(content) {
            if (shouldBeExpanded) {
                setTimeout(() => {
                    content.style.maxHeight = content.scrollHeight + "px";
                    setTimeout(() => {
                        if (panel.classList.contains('expanded')) content.style.maxHeight = 'none';
                    }, 400); 
                }, 50);
            } else {
                content.style.maxHeight = '0';
            }
        }
    });

    startAutoSaveTimer();
}

/**
 * Полностью обновляет панель персонажа в игровом интерфейсе,
 * отображая актуальные данные из объекта player.
 * Включает логику для визуального выделения характеристик,
 * на которые действуют баффы или дебаффы.
 */
function updateCharacterSheet() {
    if (!player) return;

    const { effectiveStats, bonuses } = getEffectiveStats();

    // Обновление Имени, Расы, Класса
    charNameDisplay.querySelector('span:first-child').textContent = t('gameInterface.characterPanel.nameLabel');
    charRaceDisplay.querySelector('span:first-child').textContent = t('gameInterface.characterPanel.raceLabel');
    charClassDisplay.querySelector('span:first-child').textContent = t('gameInterface.characterPanel.classLabel');
    charNameDisplay.querySelector('span:last-child').textContent = player.name || t('gameInterface.characterPanel.unknownHero');
    const raceKey = player.race ? `characterCreation.race${player.race.charAt(0).toUpperCase() + player.race.slice(1)}` : 'gameInterface.characterPanel.raceNotSelected';
    charRaceDisplay.querySelector('span:last-child').textContent = t(raceKey, null, player.race || t('gameInterface.characterPanel.raceNotSelected'));
    const classKey = player.class ? `characterCreation.class${player.class.charAt(0).toUpperCase() + player.class.slice(1)}` : 'gameInterface.characterPanel.classNotSelected';
    charClassDisplay.querySelector('span:last-child').textContent = t(classKey, null, player.class || t('gameInterface.characterPanel.classNotSelected'));

    // Обновление Здоровья (HP)
    document.querySelector('#character-stats .stat-line [data-i18n="gameInterface.characterPanel.hp"]').textContent = t('gameInterface.characterPanel.hp');
    if (hpDisplay) hpDisplay.textContent = player.stats.hp; // Текущее HP не меняется от бонусов, только максимальное
    if (maxHpDisplay) maxHpDisplay.textContent = effectiveStats.maxHp;

    // Обновление Маны (Mana)
    const manaLine = document.getElementById('mana-stat-line');
    if (player.class === 'mage') {
        if (manaLine) manaLine.style.display = 'flex';
        if (manaDisplay) manaDisplay.textContent = player.stats.mana;
        if (maxManaDisplay) maxManaDisplay.textContent = effectiveStats.maxMana;
    } else {
        if (manaLine) manaLine.style.display = 'none';
    }

    // Обновление основных характеристик (STR, DEX, INT, CON, CHA)
    const statsToUpdate = ['str', 'dex', 'int', 'con', 'cha'];
    statsToUpdate.forEach(statKey => {
        const statLabelElement = document.querySelector(`.stat-line[data-stat="${statKey}"] [data-i18n]`);
        if (statLabelElement) statLabelElement.textContent = t(`gameInterface.characterPanel.${statKey}`);
        
        const statValueElement = document.getElementById(`stat-${statKey}`);
        const bonus = bonuses[statKey] || 0;
        let htmlContent = `${effectiveStats[statKey]}`;

        if (bonus > 0) {
            htmlContent += ` <span class="stat-bonus">(+${bonus})</span>`;
        } else if (bonus < 0) {
            htmlContent += ` <span class="stat-bonus negative">(${bonus})</span>`;
        }
        if (statValueElement) statValueElement.innerHTML = htmlContent;
    });

    // Обновление Золота
    if (goldDisplay) goldDisplay.textContent = player.stats.gold;

    // Обновление Репутации
    if (reputationMarker && reputationValueTextDisplay) {
        const reputationValue = player.stats.reputation?.global ?? 0;
        reputationValueTextDisplay.textContent = reputationValue;
        const markerPositionPercent = Math.max(0, Math.min(100, ((reputationValue + 100) / 200) * 100));
        reputationMarker.style.left = `${markerPositionPercent}%`;
    }

    // Обновление Локации
    if (locationDisplay) locationDisplay.textContent = player.location || '???';

    // Обновление информации об уровне, опыте и т.д.
    if (levelInfoDiv) {
         levelInfoDiv.innerHTML = t('gameInterface.characterPanel.levelInfo', {
            level: `<span id="stat-level">${player.stats.level}</span>`,
            xp: `<span id="stat-xp">${player.stats.xp}</span>`,
            xpNext: `<span id="stat-xp-next">${player.stats.xpNext}</span>`,
            points: `<span id="stat-points-available-display">${player.stats.statPoints}</span>`,
            turn: `<span id="stat-turn">${player.stats.turnCount}</span>`
        });
    }
    
    // Обновление вместимости инвентаря с учетом бонуса к силе
    player.inventoryCapacity = 10 + Math.floor((effectiveStats.str - 10) / 2);
    const inventoryPanelTitleSpan = document.querySelector('.inventory .panel-toggle > span:first-child');
    if (inventoryPanelTitleSpan) {
        inventoryPanelTitleSpan.innerHTML = t('gameInterface.inventoryPanel.title', {
            count: `<span id="inventory-count">${Object.keys(player.inventory).length}</span>`,
            capacity: `<span id="inventory-capacity">${player.inventoryCapacity}</span>`
        });
    }

    toggleStatIncreaseButtons();

    if (player.justLeveledUp) {
        delete player.justLeveledUp;
    }
}

function updateInventoryDisplay() {
    if (!player || !inventoryList) return;
    inventoryList.innerHTML = '';

    const allItems = Object.values(player.inventory);
    
    const filteredItems = allItems.filter(item => {
        if (currentInventoryFilter === 'all') return true;
        if (currentInventoryFilter === 'quest') return item.isQuestItem === true;
        return item.itemType === currentInventoryFilter;
    });

    if (filteredItems.length === 0) {
        inventoryList.innerHTML = `<li data-i18n="gameInterface.inventoryPanel.empty">${t('gameInterface.inventoryPanel.empty')}</li>`;
    } else {
        filteredItems.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        filteredItems.forEach(item => {
            const li = document.createElement('li');
            li.dataset.itemId = item.id;
            li.addEventListener('mouseenter', (e) => createItemTooltip(e, item));
            li.addEventListener('mousemove', moveItemTooltip);
            li.addEventListener('mouseleave', () => { if(itemTooltipElement) itemTooltipElement.style.display = 'none'; });
            li.addEventListener('mouseenter', (e) => createItemTooltip(e, item));
            li.addEventListener('mousemove', moveItemTooltip);
            li.addEventListener('mouseleave', () => itemTooltipElement.style.display = 'none');
            
            // --- [ИЗМЕНЕНИЕ] Делаем предмет перетаскиваемым ---
            li.draggable = true;
            li.addEventListener('dragstart', (e) => handleDragStart(e, item));
            li.addEventListener('dragend', handleDragEnd);
            // --- [КОНЕЦ ИЗМЕНЕНИЯ] ---

            const itemName = item.name || item.aiIdentifier || 'Неизвестный предмет';
            let description = item.description || t('itemDescriptions.noDescription');
            
            if (item.effects && item.effects.length > 0) {
                let bonusText = (item.effects || [])
                    .filter(e => e.type === 'modify_stat' && e.stat)
                    .map(e => `${e.stat.toUpperCase()}: ${e.change > 0 ? '+' : ''}${e.change}`)
                    .join(', ');

                if (bonusText) {
                    description += `\n\n${t('gameInterface.inventoryPanel.effectsLabel')}: ${bonusText}`;
                }
            }

            if (item.value) {
                description += `\n${t('gameInterface.inventoryPanel.valueLabel')}: ${item.value}`;
            }
            // li.title удален, чтобы не было двойного тултипа

            // Убираем старый класс equipable, так как логика теперь другая
            let rarityClass = item.rarity ? item.rarity.toLowerCase().replace(/[^a-zа-яё0-9]/g, '-') : '';

            li.innerHTML = `
                <span class="item-name ${rarityClass}">${itemName}</span>
                <span class="item-quantity">(x${item.quantity})</span>
            `;
            inventoryList.appendChild(li);
        });
    }
}

// НОВАЯ ФУНКЦИЯ: Обновление панели статус-эффектов
function updateStatusEffectsDisplay() {
    if (!player || !statusEffectsList) return;
    statusEffectsList.innerHTML = '';
    const effects = Object.values(player.statusEffects || {});

    if (effects.length === 0) {
        statusEffectsList.innerHTML = `<li data-i18n="gameInterface.statusEffectsPanel.empty">${t('gameInterface.statusEffectsPanel.empty', 'Нет активных эффектов')}</li>`;
    } else {
        effects.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        effects.forEach(effect => {
            const li = document.createElement('li');
            li.classList.add('status-effect-item');
            li.title = effect.description || t('gameInterface.statusEffectsPanel.noDescription', 'Нет подробного описания.');

            const durationText = t('gameInterface.statusEffectsPanel.duration', { turns: effect.duration });

            li.innerHTML = `
                <div>
                    <span class="effect-name">${effect.name}</span>
                    <span class="effect-duration">${durationText}</span>
                </div>
                <div class="effect-description">${effect.description}</div>
            `;
            statusEffectsList.appendChild(li);
        });
    }
}


function updateQuestList() {
    if (!player || !questList) return;
    questList.innerHTML = '';
    const activeQuests = Object.values(player.quests).filter(q => q.status === 'active');

    if (activeQuests.length === 0) {
        questList.innerHTML = `<li data-i18n="gameInterface.questPanel.empty">${t('gameInterface.questPanel.empty')}</li>`;
    } else {
        activeQuests.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        activeQuests.forEach(quest => {
            const li = document.createElement('li');
            li.classList.add('quest-item');
            const title = quest.title || t('quests.defaultTitle', null, 'Без названия');
            const objective = quest.objective || '?';
            const description = quest.description || t('quests.noDescription', null, 'Нет описания');
            let rawReward = quest.reward;
            let rawIssuer = quest.issuer;
            let rewardValue = t('quests.unknown', null, 'Неизвестно');
            const trimmedLowerReward = String(rawReward || '').trim().toLowerCase();
            if (rawReward !== undefined && rawReward !== null && trimmedLowerReward !== '' && trimmedLowerReward !== '?' && !trimmedLowerReward.startsWith('?,')) {
                rewardValue = rawReward;
            }
            let issuerValue = t('quests.unknown', null, 'Неизвестно');
            const trimmedLowerIssuer = String(rawIssuer || '').trim().toLowerCase();
            const rewardPatternMatch = String(rawReward || '').match(/^\s*\?\s*,\s*(.+?)\s*$/);
            if (rewardPatternMatch && rewardPatternMatch[1]) {
                const potentialIssuerFromReward = rewardPatternMatch[1].trim();
                if (rawIssuer === undefined || rawIssuer === null || trimmedLowerIssuer === '' || trimmedLowerIssuer === '?') {
                    if (potentialIssuerFromReward.toLowerCase() !== '?') {
                         issuerValue = potentialIssuerFromReward;
                    }
                } else {
                    issuerValue = rawIssuer;
                }
            } else {
                if (rawIssuer !== undefined && rawIssuer !== null && trimmedLowerIssuer !== '' && trimmedLowerIssuer !== '?') {
                    issuerValue = rawIssuer;
                }
            }
            li.innerHTML = `
                <span class="quest-title">${title}</span>
                <div class="quest-detail"><strong>${t('quests.objectiveLabel')}:</strong> ${objective}</div>
                <div class="quest-detail quest-description"><strong>${t('quests.descriptionLabel')}:</strong> ${description}</div>
                <div class="quest-detail"><strong>${t('quests.rewardLabel')}:</strong> ${rewardValue}</div>
                <div class="quest-detail"><strong>${t('quests.issuerLabel')}:</strong> ${issuerValue}</div>
            `;
            questList.appendChild(li);
        });
    }
}

function updateSkillsDisplay() {
    if (!player || !skillsList) return;
    skillsList.innerHTML = '';
    const learnedSkills = Object.values(player.skills);

    if (learnedSkills.length === 0) {
        skillsList.innerHTML = `<li data-i18n="gameInterface.skillsPanel.empty">${t('gameInterface.skillsPanel.empty')}</li>`;
    } else {
        learnedSkills.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        learnedSkills.forEach(skill => {
            const li = document.createElement('li');
            li.classList.add('skill-item');
            li.title = skill.description || t('skills.noDescription', null, 'Нет описания');

            let detailsHTML = '';
            if (skill.damage && String(skill.damage).toLowerCase() !== 'нет') {
                detailsHTML += `<span><strong>${t('skills.damageLabel', 'Урон')}:</strong> ${skill.damage}</span>`;
            }
            if (skill.cost && skill.costType && String(skill.costType).toLowerCase() !== 'нет') {
                detailsHTML += `<span><strong>${t('skills.costLabel', 'Стоимость')}:</strong> ${skill.cost} ${skill.costType}</span>`;
            } else if (skill.cost && String(skill.cost).toLowerCase() !== '0' && String(skill.cost).toLowerCase() !== 'нет') {
                 detailsHTML += `<span><strong>${t('skills.costLabel', 'Стоимость')}:</strong> ${skill.cost}</span>`;
            }
            if (skill.duration && String(skill.duration).toLowerCase() !== 'нет') {
                detailsHTML += `<span><strong>${t('skills.durationLabel', 'Длит.')}:</strong> ${skill.duration}</span>`;
            }
            if (skill.cooldown && String(skill.cooldown).toLowerCase() !== 'нет') {
                detailsHTML += `<span><strong>${t('skills.cooldownLabel', 'Перезар.')}:</strong> ${skill.cooldown}</span>`;
            }
            if (skill.skillType && String(skill.skillType).toLowerCase() !== 'нет') {
                detailsHTML += `<span><strong>${t('skills.typeLabel', 'Тип')}:</strong> ${skill.skillType}</span>`;
            }

            let effectDisplay = skill.effect || '';
            if (effectDisplay.toLowerCase() === 'нет') effectDisplay = '';

            li.innerHTML = `
                <span class="skill-name">${skill.name || skill.id || 'Безымянное умение'}</span>
                <span class="skill-description">${skill.description || ''}</span>
                ${detailsHTML ? `<div class="skill-details">${detailsHTML}</div>` : ''}
                ${effectDisplay ? `<div class="skill-effect"><strong>${t('skills.effectLabel', 'Эффект')}:</strong> ${effectDisplay}</div>` : ''}
            `;
            skillsList.appendChild(li);
        });
    }
}


function updateMapDisplay() {
    if (!globalLocationsList || !customLocationsList) return;

    // --- ОБНОВЛЕНИЕ ВИЗУАЛЬНОЙ КАРТЫ ---
    renderVisualMap(); 
    
    // --- ОБНОВЛЕНИЕ ТЕКСТОВЫХ СПИСКОВ (логика остается прежней) ---
    const mapPanelTitle = document.querySelector('.map-panel .panel-toggle > span:first-child');
    if (mapPanelTitle) mapPanelTitle.textContent = t('gameInterface.mapPanel.title');
    const globalTitle = document.querySelector('.map-panel h3[data-i18n="gameInterface.mapPanel.globalTitle"]');
    const customTitle = document.querySelector('.map-panel h3[data-i18n="gameInterface.mapPanel.customTitle"]');
    if(globalTitle) globalTitle.textContent = t('gameInterface.mapPanel.globalTitle');
    if(customTitle) customTitle.textContent = t('gameInterface.mapPanel.customTitle');

    globalLocationsList.innerHTML = '';
    const locationsData = (typeof globalLocations === 'object' && globalLocations !== null) ? globalLocations : {};
    const globalKeys = Object.keys(locationsData);
    const displayableGlobalKeys = globalKeys.filter(key => key !== 'startLocation' && locationsData[key]?.name);

    if (displayableGlobalKeys.length > 0) {
        displayableGlobalKeys.sort((a, b) => (locationsData[a]?.name || '').localeCompare(locationsData[b]?.name || '', currentLanguage));
        displayableGlobalKeys.forEach(key => {
            const loc = locationsData[key];
            const li = document.createElement('li');
            li.innerHTML = `<span class="location-name">${loc.name}</span>`;
            if (loc.description) {
                li.innerHTML += `<span class="location-desc" title="${loc.description}">${loc.description}</span>`;
            }
            globalLocationsList.appendChild(li);
        });
    } else {
        let fallbackKey = 'gameInterface.mapPanel.noGlobal';
        if (worldLore.startsWith(t('error.prefix', 'Ошибка:'))) {
             fallbackKey = 'gameInterface.mapPanel.errorLoadingWorld';
        }
        globalLocationsList.innerHTML = `<li>${t(fallbackKey)}</li>`;
    }

    customLocationsList.innerHTML = '';
    if (player && player.mapMarkers) {
        const markerEntries = Object.entries(player.mapMarkers);
        if (markerEntries.length > 0) {
            markerEntries.sort(([, a], [, b]) => (a.name || '').localeCompare(b.name || '', currentLanguage));
            markerEntries.forEach(([, marker]) => {
                const li = document.createElement('li');
                li.innerHTML = `<span class="location-name">${marker.name}</span>`;
                customLocationsList.appendChild(li);
            });
        } else {
            customLocationsList.innerHTML = `<li data-i18n="gameInterface.mapPanel.noCustom">${t('gameInterface.mapPanel.noCustom')}</li>`;
        }
    } else {
         customLocationsList.innerHTML = `<li data-i18n="gameInterface.mapPanel.noCustom">${t('gameInterface.mapPanel.noCustom')}</li>`;
    }
}

// НОВАЯ ФУНКЦИЯ для обновления панели окружения
function updateEnvironmentPanel() {
    if (!player || !environmentList) return;
    environmentList.innerHTML = '';
    const entities = Object.values(player.visibleEntities || {});

    if (entities.length === 0) {
        environmentList.innerHTML = `<li data-i18n="gameInterface.environmentPanel.empty">${t('gameInterface.environmentPanel.empty')}</li>`;
    } else {
        entities.sort((a, b) => (a.name || '').localeCompare(b.name || '', currentLanguage));
        entities.forEach(entity => {
            const li = document.createElement('li');
            li.classList.add('entity-item');
            li.dataset.entityId = entity.id;

            const iconEl = document.createElement('span');
            iconEl.classList.add('entity-icon');
            let iconClass = 'fa-question-circle'; // Default icon
            let entityTypeClass = 'npc'; // Default color class

            const typeKey = `gameInterface.environmentPanel.entityType${entity.type.charAt(0).toUpperCase() + entity.type.slice(1)}`;
            const entityTypeLocalized = t(typeKey, null, entity.type);

            switch (entity.type.toLowerCase()) {
                case 'npc':
                    iconClass = entity.isHostile ? 'fa-user-ninja' : 'fa-user';
                    entityTypeClass = entity.isHostile ? 'enemy' : 'npc';
                    break;
                case 'creature':
                    iconClass = entity.isHostile ? 'fa-dragon' : 'fa-paw';
                    entityTypeClass = entity.isHostile ? 'enemy' : 'creature';
                    break;
                case 'enemy':
                    iconClass = 'fa-skull-crossbones';
                    entityTypeClass = 'enemy';
                    break;
            }
            iconEl.classList.add('fas', iconClass, entityTypeClass);

            const nameSpan = document.createElement('span');
            nameSpan.classList.add('entity-name');
            nameSpan.textContent = entity.name || entity.id || t('gameInterface.environmentPanel.unknownEntity', 'Неизвестное существо');

            li.appendChild(iconEl);
            li.appendChild(nameSpan);

            // Store data for tooltip
            li.dataset.tooltipData = JSON.stringify({
                name: entity.name,
                type: entityTypeLocalized,
                description: entity.description || t('gameInterface.environmentPanel.noDescription', 'Нет подробного описания.'),
                hp: entity.stats?.hp,
                maxHp: entity.stats?.maxHp,
                str: entity.stats?.str,
                dex: entity.stats?.dex,
                con: entity.stats?.con,
                int: entity.stats?.int,
                isHostile: entity.isHostile
            });

            li.addEventListener('mouseover', showEntityTooltip);
            li.addEventListener('mouseout', hideEntityTooltip);
            li.addEventListener('mousemove', moveEntityTooltip);

            environmentList.appendChild(li);
        });
    }
}

// НОВЫЕ ФУНКЦИИ для всплывающей подсказки
function createItemTooltip(event, item) {
    if (!itemTooltipElement) {
        itemTooltipElement = document.createElement('div');
        itemTooltipElement.className = 'item-tooltip';
        document.body.appendChild(itemTooltipElement);
    }
    
    let imgHtml = item.isGenerating ? '<div class="item-card-loading">Рисуем артефакт...</div>' : 
                 (item.imageUrl ? `<img src="${item.imageUrl}">` : '<div class="item-card-loading">Нет изображения</div>');

    itemTooltipElement.innerHTML = `
        <div class="item-card-header">${item.name}</div>
        <div class="item-card-image-frame">${imgHtml}</div>
        <div class="item-card-body">
            <span class="item-card-rarity" style="color: ${getRarityColor(item.rarity)}">${item.rarity}</span>
            ${item.description}
        </div>
    `;
    
    itemTooltipElement.style.display = 'block';
    moveItemTooltip(event);
}

function getRarityColor(rarity) {
    const r = String(rarity).toLowerCase();
    if (r.includes('необыч')) return '#1eff00';
    if (r.includes('редк')) return '#0070dd';
    if (r.includes('эпич')) return '#a335ee';
    if (r.includes('легенд')) return '#ff8000';
    return '#2c1e14';
}

function moveItemTooltip(e) {
    if (!itemTooltipElement) return;
    let x = e.pageX + 15;
    let y = e.pageY + 15;
    if (x + 220 > window.innerWidth) x = e.pageX - 235;
    itemTooltipElement.style.left = x + 'px';
    itemTooltipElement.style.top = y + 'px';
}

function createItemTooltip(event, item) {
    if (!itemTooltipElement) {
        itemTooltipElement = document.createElement('div');
        itemTooltipElement.className = 'item-tooltip';
        document.body.appendChild(itemTooltipElement);
    }
    let imgHtml = item.isGenerating ? '<div class="item-card-loading">Рисуем артефакт...</div>' : 
                 (item.imageUrl ? `<img src="${item.imageUrl}">` : '<div class="item-card-loading">Загрузка...</div>');
    itemTooltipElement.innerHTML = `
        <div class="item-card-header">${item.name}</div>
        <div class="item-card-image-frame">${imgHtml}</div>
        <div class="item-card-body">
            <span class="item-card-rarity" style="color: #b8860b">${item.rarity || 'Обычный'}</span>
            ${item.description}
        </div>
    `;
    itemTooltipElement.style.display = 'block';
    moveItemTooltip(event);
}

function moveItemTooltip(e) {
    if (!itemTooltipElement) return;
    let x = e.pageX + 15; let y = e.pageY + 15;
    if (x + 220 > window.innerWidth) x = e.pageX - 235;
    itemTooltipElement.style.left = x + 'px';
    itemTooltipElement.style.top = y + 'px';
}

function createItemTooltip(event, item) {
    if (!itemTooltipElement) {
        itemTooltipElement = document.createElement('div');
        itemTooltipElement.className = 'item-tooltip';
        document.body.appendChild(itemTooltipElement);
    }
    const rarityColor = getRarityColor(item.rarity);
    
    // Сборка эффектов для отображения
    let effectsHtml = '';
    if (item.effects && item.effects.length > 0) {
        effectsHtml = `<div style="margin-top:8px; border-top:1px dashed #2c1e14; padding-top:5px; font-weight:bold;">
            Эффекты: ${item.effects.map(e => `${e.stat.toUpperCase()} ${e.change > 0 ? '+' : ''}${e.change}`).join(', ')}
        </div>`;
    }

    itemTooltipElement.innerHTML = `
        <div class="item-card-header">${item.name}</div>
        <div class="item-card-body">
            <span class="item-card-rarity" style="color: ${rarityColor}">${item.rarity || 'Обычный'}</span>
            <div style="font-style:italic;">${item.description}</div>
            ${effectsHtml}
            <div style="margin-top:8px; font-size:0.85em; text-align:right; opacity:0.8;">💰 Ценность: ${item.value || 0}</div>
        </div>`;
    
    itemTooltipElement.style.display = 'block';
    moveItemTooltip(event);
}

function getRarityColor(r) {
    const s = String(r).toLowerCase();
    if (s.includes('необыч')) return '#1eff00';
    if (s.includes('редк')) return '#0070dd';
    if (s.includes('эпич')) return '#a335ee';
    if (s.includes('легенд')) return '#ff8000';
    return '#5d4a36';
}

function moveItemTooltip(e) {
    if (!itemTooltipElement) return;
    let x = e.pageX + 15; let y = e.pageY + 15;
    if (x + 240 > window.innerWidth) x = e.pageX - 245;
    itemTooltipElement.style.left = x + 'px'; itemTooltipElement.style.top = y + 'px';
}

function createItemTooltip(event, item) {
    if (!itemTooltipElement) {
        itemTooltipElement = document.createElement('div');
        itemTooltipElement.className = 'item-tooltip';
        document.body.appendChild(itemTooltipElement);
    }
    let imgHtml = item.isGenerating ? '<div class="item-card-loading">Духи Flux рисуют облик...</div>' : 
                 (item.imageUrl ? `<img src="${item.imageUrl}">` : '<div class="item-card-loading">Образ не проявлен</div>');

    itemTooltipElement.innerHTML = `
        <div class="item-card-header">${item.name}</div>
        <div class="item-card-img-frame">${imgHtml}</div>
        <div class="item-card-body">
            <div style="font-weight:bold; color:#b8860b; font-size:0.8em; margin-bottom:5px;">${item.rarity || 'Обычный'}</div>
            ${item.description}
        </div>
    `;
    itemTooltipElement.style.display = 'block';
    moveItemTooltip(event);
}

function moveItemTooltip(e) {
    if (!itemTooltipElement) return;
    let x = e.pageX + 20; 
    let y = e.pageY - 150; // Поднимаем выше курсора
    if (x + 230 > window.innerWidth) x = e.pageX - 250;
    if (y < 10) y = e.pageY + 20; // Если сверху мало места, кидаем вниз
    itemTooltipElement.style.left = x + 'px';
    itemTooltipElement.style.top = y + 'px';
}

function createEntityTooltipElement() {
    if (!entityTooltip) {
        entityTooltip = document.createElement('div');
        entityTooltip.classList.add('entity-tooltip');
        document.body.appendChild(entityTooltip);
    }
}

function showEntityTooltip(event) {
    createEntityTooltipElement();
    const li = event.currentTarget;
    const data = JSON.parse(li.dataset.tooltipData);

    let statsHtml = '';
    if (data.str !== undefined) statsHtml += `<p><span class="stat-label">${t('gameInterface.characterPanel.str', '⚔️ Сила')}:</span> <span class="stat-value">${data.str}</span></p>`;
    if (data.dex !== undefined) statsHtml += `<p><span class="stat-label">${t('gameInterface.characterPanel.dex', '🤸 Ловкость')}:</span> <span class="stat-value">${data.dex}</span></p>`;
    if (data.con !== undefined) statsHtml += `<p><span class="stat-label">${t('gameInterface.characterPanel.con', '맷 Выносливость')}:</span> <span class="stat-value">${data.con}</span></p>`;
    if (data.int !== undefined) statsHtml += `<p><span class="stat-label">${t('gameInterface.characterPanel.int', '💡 Интеллект')}:</span> <span class="stat-value">${data.int}</span></p>`;

    let healthBarHtml = '';
    let healthText = '';
    if (data.hp !== undefined && data.maxHp !== undefined && data.maxHp > 0) {
        const healthPercentage = Math.max(0, Math.min(100, (data.hp / data.maxHp) * 100));
        let barClass = 'enemy'; // Default red
        if (!data.isHostile) {
            if (data.type.toLowerCase() === t('gameInterface.environmentPanel.entityTypeNPC', 'НПС').toLowerCase()) {
                barClass = 'friendly'; // Green for friendly NPC
            } else {
                barClass = 'neutral'; // Yellow for neutral creature
            }
        }
        healthText = `${data.hp}/${data.maxHp}`;
        healthBarHtml = `
            <div class="health-bar-container">
                <div class="health-bar ${barClass}" style="width: ${healthPercentage}%;">${healthText}</div>
            </div>
        `;
        healthText = `<p><strong>${t('gameInterface.environmentPanel.tooltip.health', 'Здоровье')}:</strong> <span class="stat-value">${data.hp} / ${data.maxHp}</span></p>`;
    }


    entityTooltip.innerHTML = `
        <h4>${data.name}</h4>
        <p><strong>${t('gameInterface.environmentPanel.tooltip.type', 'Тип')}:</strong> ${data.type}</p>
        ${healthText}
        ${healthBarHtml}
        ${statsHtml}
        <p class="description-text">${data.description}</p>
    `;
    entityTooltip.style.display = 'block';
    moveEntityTooltip(event); // Initial position
}

function hideEntityTooltip() {
    if (entityTooltip) {
        entityTooltip.style.display = 'none';
    }
}

function moveEntityTooltip(event) {
    if (entityTooltip && entityTooltip.style.display === 'block') {
        const xOffset = 20; // Смещение от курсора
        const yOffset = 10;
        let newX = event.pageX + xOffset;
        let newY = event.pageY + yOffset;

        const tooltipRect = entityTooltip.getBoundingClientRect();
        const bodyRect = document.body.getBoundingClientRect();

        // Предотвращение выхода за пределы экрана
        if (newX + tooltipRect.width > window.innerWidth - 10) { // 10px отступ от края
            newX = event.pageX - tooltipRect.width - xOffset;
        }
        if (newY + tooltipRect.height > window.innerHeight - 10) {
            newY = event.pageY - tooltipRect.height - yOffset;
        }
         if (newX < 10) {
            newX = 10;
        }
        if (newY < 10) {
            newY = 10;
        }


        entityTooltip.style.left = `${newX}px`;
        entityTooltip.style.top = `${newY}px`;
    }
}


function toggleStatIncreaseButtons() {
    if (!player || !characterSheetPanel) return;
    const hasPoints = player.stats.statPoints > 0;
    characterSheetPanel.classList.toggle('has-stat-points', hasPoints);
}

async function loadPromptFromFile(filePath) {
    try {
        const response = await fetch(`${filePath}?t=${Date.now()}`); // Cache busting
        if (!response.ok) {
            throw new Error(`HTTP ошибка! статус: ${response.status}, Не удалось загрузить ${response.url}`);
        }
        const promptText = await response.text();
        console.log(`Промпт успешно загружен из: ${filePath}`);
        return promptText;
    } catch (error) {
        console.error(`Не удалось загрузить промпт из ${filePath}:`, error);
        return `Ошибка: Не удалось загрузить промпт из ${filePath}. ${error.message}`;
    }
}

// --- Игровое Меню ---
function openInGameMenu() {
    menuOverlay.style.display = 'block';
    inGameMenu.style.display = 'flex';
    requestAnimationFrame(() => {
        menuOverlay.style.opacity = '1';
        inGameMenu.style.opacity = '1';
        inGameMenu.style.transform = 'translate(-50%, -50%) scale(1)';
    });
}

function closeInGameMenu() {
     menuOverlay.style.opacity = '0';
     inGameMenu.style.opacity = '0';
     inGameMenu.style.transform = 'translate(-50%, -50%) scale(0.9)';
     setTimeout(() => {
        menuOverlay.style.display = 'none';
        inGameMenu.style.display = 'none';
     }, 300); // Время анимации
}

// --- Лог и Ввод ---
function addLogMessage(message, type = "gm-message") {
    if (!gameLog) return;

    const messageElement = document.createElement('p');
    messageElement.className = type;
    let textToSpeak = message; // Текст для озвучки

    try {
        if (type === 'gm-message') {
            // 1. Убираем технические команды [COMMAND:...] из текста
            let cleanMessage = message.replace(/\[COMMAND:.+?\]/g, '').trim();

            // 2. Предварительная обработка RP-элементов (диалоги, действия, OOC)
            // Используем временный div для экранирования базовых HTML-символов перед парсингом
            const tempDiv = document.createElement('div');
            tempDiv.textContent = cleanMessage;
            let rawHtml = tempDiv.innerHTML;

            const rpRegex = /(\(\(.*?\)\))|("(.*?)")|(\*(.*?)\*)/g;
            
            let processedHtml = rawHtml.replace(rpRegex, (match, ooc, dialogue, dialogueContent, action, actionContent) => {
                if (ooc) {
                    // Очищаем текст внутри OOC для безопасности атрибута
                    const oocText = ooc.slice(2, -2).replace(/"/g, '&quot;').trim();
                    return `<span class="ooc-marker" data-ooc-text="${oocText}" title="${t('gameInterface.log.oocTooltip', 'OOC Сообщение')}">OOC</span>`;
                }
                if (dialogue) {
                    return `<span class="dialogue-text">${dialogue}</span>`;
                }
                if (action) {
                    return `<span class="action-text">${action}</span>`;
                }
                return match;
            });

            // 3. Превращаем Markdown в HTML
            let markdownHtml = marked.parse(processedHtml);

            // 4. КРИТИЧЕСКИЙ ШАГ: Очистка (Sanitization)
            // DOMPurify удалит все <script>, onmouseover, onerror и т.д.
            // Мы разрешаем атрибут data-ooc-text, так как он нужен для наших подсказок.
            const cleanHtml = DOMPurify.sanitize(markdownHtml, {
                ADD_ATTR: ['data-ooc-text'], // Разрешаем наш кастомный атрибут
                USE_PROFILES: { html: true }
            });

            messageElement.innerHTML = cleanHtml;

            // 5. Подготовка текста для TTS (без HTML тегов)
            const speechTempDiv = document.createElement('div');
            speechTempDiv.innerHTML = cleanHtml;
            // Убираем слово "OOC" из озвучки, чтобы оно не резало слух
            const oocMarkers = speechTempDiv.querySelectorAll('.ooc-marker');
            oocMarkers.forEach(m => m.remove());
            textToSpeak = speechTempDiv.textContent || speechTempDiv.innerText || "";

        } else {
            // Для сообщений пользователя используем textContent (100% защита)
            messageElement.textContent = message;
            textToSpeak = message;
        }
    } catch (e) {
        console.error("Ошибка при рендеринге сообщения:", e);
        messageElement.textContent = ">>> [Ошибка отображения сообщения]";
        textToSpeak = "";
    }
    
    // Добавление в DOM
    gameLog.appendChild(messageElement);
    
    // Очистка старых сообщений, чтобы браузер не тормозил
    pruneGameLog();
    
    // Плавный скролл вниз
    gameLog.scrollTo({ top: gameLog.scrollHeight, behavior: 'smooth' });

    // Озвучка, если включена
    if (type === 'gm-message' && isTTSEnabled) {
        const speakableText = textToSpeak.replace(/\s+/g, ' ').trim();
        if (speakableText) speakText(speakableText);
    }
}

function handleUserInput() {
    let text = userInput.value.trim();
    const rollsContainer = document.getElementById('active-rolls-container');
    
    let rollsText = "";
    if (rollsContainer) {
        const badges = rollsContainer.querySelectorAll('.roll-badge');
        badges.forEach(badge => {
            rollsText += " " + badge.dataset.resultText;
        });
    }

    if ((!text && !rollsText) || isWaitingForAI || !player) {
        if (!player && !isWaitingForAI) addLogMessage(t("gameInterface.log.gameNotActive"), "system-message");
        return;
    }

    const finalMessage = (text + rollsText).trim();

    // --- НАЧАЛО ИЗМЕНЕНИЙ: МЕХАНИЗМ ПАМЯТИ ---
    player.stats.turnCount++;
    const turn = player.stats.turnCount;

    // Шаг 1: На 29-м (и 59, 89 и т.д.) ходу запускаем процесс создания сводки.
    if (turn > 0 && turn % MEMORY_SUMMARY_TURN === 0) {
        addLogMessage(t('optimization.summarizing', "Мастер Игры систематизирует воспоминания о прошедших событиях..."), "system-message");
        // Отправляем специальный запрос на суммаризацию
        sendApiRequest(finalMessage, false, false, [], true);
        
        userInput.value = '';
        if (rollsContainer) rollsContainer.innerHTML = ''; 
        return; // Прерываем обычный ход
    }

    // Шаг 2: На 30-м (и 60, 90 и т.д.) ходу очищаем историю, так как сводка уже сохранена.
    if (turn > 0 && turn % MEMORY_PRUNE_TURN === 0) {
        addLogMessage(t('optimization.clearing', "Контекст диалогов был очищен для оптимизации. Ключевые события сохранены в памяти GM."), "command-feedback");
        conversationHistory = [];
    }
    // --- КОНЕЦ ИЗМЕНЕНИЙ ---
    
    processAutomatedNexusEffects();
    const effectLogMessages = processStatusEffects();
    updateCharacterSheet();
    effectLogMessages.forEach(msg => addLogMessage(msg, "command-feedback"));

    addLogMessage(finalMessage, "user-message");

    const expiredEffectsForGM = player.expiredEffectsForGM || [];
    player.expiredEffectsForGM = [];
    sendApiRequest(finalMessage, false, false, expiredEffectsForGM, false);

    userInput.value = '';
    if (rollsContainer) rollsContainer.innerHTML = '';
}

function processTurnEffects() {
    if (!player || !player.statusEffects) {
        return []; // Возвращаем пустой массив, если нечего обрабатывать
    }

    const effectsToRemove = [];
    const expiredEffectNames = []; // >>>>> НОВОЕ: Собираем имена истекших эффектов
    
    for (const effectId in player.statusEffects) {
        const effect = player.statusEffects[effectId];
        
        if (effect.duration > 0) {
            effect.duration--;
        }

        if (effect.duration <= 0) {
            effectsToRemove.push(effectId);
            expiredEffectNames.push(effect.name); // >>>>> НОВОЕ: Добавляем имя в список
            addLogMessage(t('gameInterface.commandFeedback.statusEffectRemoved', { effectName: effect.name }), "command-feedback");
        }
    }

    if (effectsToRemove.length > 0) {
        effectsToRemove.forEach(id => {
            delete player.statusEffects[id];
        });
    }

    updateStatusEffectsDisplay();
    
    return expiredEffectNames; // >>>>> НОВОЕ: Возвращаем список имен
}

async function loadCombatSystemRules() {
    const filePath = `assets/promts/combat_system_rules.txt`;
    console.log(`Попытка загрузить правила боевой системы из: ${filePath}`);
    try {
        const response = await fetch(`${filePath}?t=${Date.now()}`); // ИСПРАВЛЕНИЕ: Добавлен cache-buster
        if (!response.ok) {
            throw new Error(`HTTP ошибка! статус: ${response.status}. Не удалось загрузить ${response.url}`);
        }
        combatSystemRulesData = await response.text();
        console.log(`Правила боевой системы успешно загружены.`);
    } catch (error) {
        console.error(`Не удалось загрузить правила боевой системы:`, error);
        combatSystemRulesData = "// Ошибка: Не удалось загрузить правила боевой системы. Бой может быть непредсказуемым.";
    }
}

// --- Функции Управления Экраном Загрузки (НОВОЕ) ---

function showLoadingScreen(textKey = 'loadingScreen.generatingWorld', fallbackText = 'Генерация мира...') {
    if (!loadingOverlay || !loadingText) return;
    
    loadingText.textContent = t(textKey, null, fallbackText);
    loadingOverlay.style.display = 'flex';
    
    // Небольшая задержка перед добавлением класса для срабатывания transition
    setTimeout(() => {
        loadingOverlay.classList.add('visible');
    }, 10);
}

function hideLoadingScreen() {
    if (!loadingOverlay) return;
    
    loadingOverlay.classList.remove('visible');
    
    // Скрываем элемент после завершения анимации
    setTimeout(() => {
        loadingOverlay.style.display = 'none';
    }, 500); // Должно совпадать со временем transition в CSS
}

// --- Взаимодействие с Gemini ---
/**
 * Основная функция для взаимодействия с Gemini API.
 * Собирает все состояние игры, формирует промпт, отправляет запрос и обрабатывает ответ.
 * @param {string} promptTextForAI - Текст от пользователя или системный промпт для инициализации.
 * @param {boolean} [isInitialPrompt=false] - Флаг, указывающий, что это первый запрос для начала новой игры.
 * @param {boolean} [isDiceRollResponse=false] - Флаг, указывающий, что это внутренний ответ на запрос броска кубика.
 * @param {Array<string>} [expiredEffects=[]] - Массив имен статус-эффектов, которые истекли в этом ходу.
 */
function showRetryButton(retryCallback) {
    const btn = document.createElement('button');
    btn.id = 'retry-request-btn';
    btn.className = 'action-text';
    btn.style.marginTop = '10px';
    btn.style.backgroundColor = '#e67e22';
    btn.innerHTML = '<i class="fas fa-redo"></i> Повторить генерацию текста';
    btn.onclick = () => {
        btn.remove();
        retryCallback();
    };
    gameLog.appendChild(btn);
    gameLog.scrollTo({ top: gameLog.scrollHeight, behavior: 'smooth' });
}

/**
 * (ПОЛНАЯ ОБНОВЛЕННАЯ ВЕРСИЯ v3.0 - АГЕНТСКИЙ ЦИКЛ И ПОВТОРЫ)
 */
function handleUserInput() {
    let text = userInput.value.trim();
    const rollsContainer = document.getElementById('active-rolls-container');
    
    let rollsText = "";
    if (rollsContainer) {
        const badges = rollsContainer.querySelectorAll('.roll-badge');
        badges.forEach(badge => {
            rollsText += " " + badge.dataset.resultText;
        });
    }

    if ((!text && !rollsText) || isWaitingForAI || !player) {
        if (!player && !isWaitingForAI) addLogMessage(t("gameInterface.log.gameNotActive"), "system-message");
        return;
    }

    const finalMessage = (text + rollsText).trim();

    // --- НАЧАЛО ЛОГИКИ МЕХАНИЗМА ПАМЯТИ ---
    player.stats.turnCount++;
    const turn = player.stats.turnCount;

    // Шаг 1: На 29-м (и 59, 89 и т.д.) ходу запускаем процесс создания сводки.
    if (turn > 0 && turn % MEMORY_SUMMARY_TURN === 0) {
        addLogMessage(t('optimization.summarizing', "Мастер Игры систематизирует воспоминания о прошедших событиях..."), "system-message");
        // Отправляем специальный запрос на суммаризацию
        sendApiRequest(finalMessage, false, false, [], true);
        
        userInput.value = '';
        if (rollsContainer) rollsContainer.innerHTML = ''; 
        return; // Прерываем обычный ход
    }

    // Шаг 2: На 30-м (и 60, 90 и т.д.) ходу очищаем историю, так как сводка уже сохранена.
    if (turn > 0 && turn % MEMORY_PRUNE_TURN === 0) {
        addLogMessage(t('optimization.clearing', "Контекст диалогов был очищен для оптимизации. Ключевые события сохранены в памяти GM."), "command-feedback");
        conversationHistory = [];
    }
    // --- КОНЕЦ ЛОГИКИ МЕХАНИЗМА ПАМЯТИ ---
    
    processAutomatedNexusEffects();
    const effectLogMessages = processStatusEffects();
    updateCharacterSheet();
    effectLogMessages.forEach(msg => addLogMessage(msg, "command-feedback"));

    addLogMessage(finalMessage, "user-message");

    const expiredEffectsForGM = player.expiredEffectsForGM || [];
    player.expiredEffectsForGM = [];
    sendApiRequest(finalMessage, false, false, expiredEffectsForGM, false);

    userInput.value = '';
    if (rollsContainer) rollsContainer.innerHTML = '';
}



/**
 * Вспомогательная функция для выполнения запроса к API.
 * Инкапсулирует логику провайдеров, заголовков и ключей.
 */
async function performAiFetch(systemInstruction, history, providerModel, currentInput = "") {
    let attempts = 0;
    const maxAttempts = (currentApiProvider === 'gemini' && geminiApiKeys.length > 0) ? geminiApiKeys.length : 1;

    while (attempts < maxAttempts) {
        let targetUrl = "";
        let headers = { 'Content-Type': 'application/json' };
        let requestBody = {};
        let isGeminiFormat = false;

        // 1. Подготовка стандартного массива сообщений (OpenAI формат)
        let messages = [];
        messages.push({ role: "system", content: systemInstruction });
        if (history && history.length > 0) {
            history.forEach(item => {
                messages.push({
                    role: item.role === 'model' ? 'assistant' : 'user',
                    content: item.parts[0].text
                });
            });
        }
        if (currentInput) {
            messages.push({ role: "user", content: currentInput });
        }

        // --- ВСЕ ЗАПРОСЫ ИДУТ НАПРЯМУЮ ПРОВАЙДЕРУ ---
        if (currentApiProvider === 'local') {
            targetUrl = localApiUrl;
            requestBody = {
                model: providerModel || "local-model",
                messages: messages,
                temperature: 0.7,
                max_tokens: 4096
            };
        } else if (currentApiProvider === 'deepseek') {
            targetUrl = "https://api.deepseek.com/v1/chat/completions";
            headers['Authorization'] = 'Bearer ' + deepseekApiKey;
            requestBody = {
                model: providerModel,
                messages: messages,
                temperature: 0.7,
                max_tokens: 4096
            };
        } else if (currentApiProvider === 'openrouter') {
            targetUrl = "https://openrouter.ai/api/v1/chat/completions";
            headers['Authorization'] = 'Bearer ' + openrouterApiKey;
            headers['HTTP-Referer'] = "https://github.com/MrKins/Chronicles-of-Meterea";
            headers['X-Title'] = "Chronicles of Meterea";
            requestBody = {
                model: providerModel,
                messages: messages,
                temperature: 0.7,
                max_tokens: 4096
            };
        } else if (currentApiProvider === 'llmost') {
            targetUrl = "https://llmost.ru/api/v1/chat/completions";
            headers['Authorization'] = 'Bearer ' + llmostApiKey;
            requestBody = {
                model: providerModel,
                messages: messages,
                temperature: 0.7,
                max_tokens: 4096
            };
        } else if (currentApiProvider === 'gemini') {
            const activeKey = geminiApiKeys[currentGeminiKeyIndex] || geminiApiKey;
            targetUrl = 'https://generativelanguage.googleapis.com/v1beta/models/' + providerModel + ':generateContent?key=' + activeKey;
            
            // Gemini API требует специфичный формат напрямую
            const contents = [];
            if (history && history.length > 0) {
                history.forEach(item => {
                    contents.push({
                        role: item.role === 'model' ? 'model' : 'user',
                        parts: [{ text: item.parts[0].text }]
                    });
                });
            }
            if (currentInput) {
                contents.push({ role: "user", parts: [{ text: currentInput }] });
            }

            requestBody = {
                systemInstruction: { parts: [{ text: systemInstruction }] },
                contents: contents,
                generationConfig: { maxOutputTokens: 8192, temperature: 0.75 }
            };
            isGeminiFormat = true;
        }

        console.log('Отправка ПРЯМОГО запроса (' + currentApiProvider + ') на: ' + targetUrl);

        // 3. Отправка запроса
        let response;
        try {
            response = await fetch(targetUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });

            if (response.status === 429 && currentApiProvider === 'gemini' && geminiApiKeys.length > 1) {
                console.warn('[KeyRotation] Ключ #' + currentGeminiKeyIndex + ' исчерпан (429). Пробую следующий...');
                currentGeminiKeyIndex = (currentGeminiKeyIndex + 1) % geminiApiKeys.length;
                geminiApiKey = geminiApiKeys[currentGeminiKeyIndex];
                attempts++;
                continue; // Пробуем следующий ключ в цикле
            }
        } catch (err) {
            console.error("Fetch error:", err);
            throw err;
        }

        if (!response.ok) {
            const errText = await response.text();
            throw new Error('Ошибка API (' + response.status + '): ' + errText);
        }

        const data = await response.json();
        
        // 4. Обработка ответа
        if (isGeminiFormat) {
            if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
                return data.candidates[0].content.parts[0].text;
            }
        } else {
            if (data.choices && data.choices[0] && data.choices[0].message) {
                return data.choices[0].message.content;
            }
        }

        throw new Error("Не удалось получить текст из ответа модели.");
    }
}

/**
 * ОСНОВНАЯ ФУНКЦИЯ (ОРКЕСТРАТОР): Счетовод -> Поэт
 */
async function sendApiRequest(promptTextForAI, isInitialPrompt = false, isDiceRollResponse = false, expiredEffects = [], isSummarizationRequest = false, skipLogic = false) {
    if (!isInitialPrompt && !isDiceRollResponse && !isSummarizationRequest && promptTextForAI) {
        lastUserMessageForRetry = promptTextForAI;
    }

    isWaitingForAI = true;
    if (userInput) userInput.disabled = true;
    if (sendButton) sendButton.disabled = true;
    
    const oldRetryBtn = document.getElementById('retry-request-btn');
    if (oldRetryBtn) oldRetryBtn.remove();

    const thinkingMsg = skipLogic ? "Поэт переписывает историю..." : (isInitialPrompt ? "Пробуждение мира..." : "Мастер Игры обдумывает ход...");
    addLogMessage(thinkingMsg, "system-message");

    try {
        const modelIdForRequest = currentApiProvider === 'gemini' ? geminiModelId : 
                                 currentApiProvider === 'llmost' ? llmostModelId :
                                 currentApiProvider === 'openrouter' ? openrouterModelId : localModelId;

        let allPendingActions = [];
        let logicSummaryForPoet = "";

        // --- ЭТАП 1: СЧЕТОВОД (LOGIC) И АГЕНТСКИЙ ПОИСК ---
        if (!isSummarizationRequest && !skipLogic) {
            console.log(">>> Запуск Счетовода...");
            let logicSystemPrompt = await prepareLogicPrompt(expiredEffects, promptTextForAI, isInitialPrompt);
            let logicInput = isInitialPrompt ? "[INITIAL_GAME_SETUP_START_OF_STORY]" : promptTextForAI;
            
            let rawLogicResponse = await performAiFetch(logicSystemPrompt, [], modelIdForRequest, logicInput);
            let logicResult = parseAIResponse(rawLogicResponse);
            
            // ПРОВЕРКА НА ПОИСК В АРХИВЕ
            let searchAction = logicResult.actions.find(a => a.command === 'searchArchive');
            if (searchAction && searchAction.args && searchAction.args.query) {
                console.log("[Agent Loop] Счетовод запросил поиск в архиве:", searchAction.args.query);
                addCalculationMessage(`[ПОИСК] Запрос к архивам: ${searchAction.args.query}`);
                
                // Простой поиск по ключам и значениям в архиве
                let foundData = "";
                const query = searchAction.args.query.toLowerCase();
                for (const [key, text] of Object.entries(player.memoryArchives || {})) {
                    if (key.toLowerCase().includes(query) || text.toLowerCase().includes(query)) {
                        foundData += `Блок [${key}]: ${text}\n`;
                    }
                }
                if (!foundData) foundData = "Информация не найдена.";
                
                // ПОВТОРНЫЙ ЗАПУСК СЧЕТОВОДА С НАЙДЕННЫМИ ДАННЫМИ
                logicInput += `\n\n[SYSTEM: РЕЗУЛЬТАТ ПОИСКА ПО АРХИВУ]\n${foundData}\nПродолжай расчеты с учетом этой информации.`;
                rawLogicResponse = await performAiFetch(logicSystemPrompt, [], modelIdForRequest, logicInput);
                logicResult = parseAIResponse(rawLogicResponse);
            }

            if (!logicResult || (!logicResult.logic_summary && !logicResult.actions)) {
                throw new Error("Счетовод вернул пустой или некорректный ответ.");
            }

            allPendingActions = logicResult.actions || [];
            logicSummaryForPoet = logicResult.logic_summary || logicResult.narrative || "Механика подтверждена.";
            
            // Кэшируем успешный результат Счетовода
            cachedLogicState = { actions: allPendingActions, summary: logicSummaryForPoet };
            console.log("Счетовод закончил. Команд:", allPendingActions.length);
        } else if (skipLogic && cachedLogicState) {
            console.log(">>> Пропуск Счетовода. Используем кэш.");
            allPendingActions = cachedLogicState.actions;
            logicSummaryForPoet = cachedLogicState.summary;
        }

        // --- ЭТАП 2: ПОЭТ ---
        if (!isSummarizationRequest) {
            console.log(">>> Запуск Поэта...");
            const narrativeSystemPrompt = await prepareNarrativePrompt(logicSummaryForPoet, promptTextForAI);
            const rawNarrativeResponse = await performAiFetch(narrativeSystemPrompt, conversationHistory, modelIdForRequest, "[SYSTEM: GENERATE ARTISTIC DESCRIPTION]");
            
            const narrativeResult = parseAIResponse(rawNarrativeResponse);
            
            if (!narrativeResult || !narrativeResult.narrative) {
                 throw new Error("Поэт не смог описать ситуацию.");
            }

            // УСПЕХ: Выводим текст
            addLogMessage(narrativeResult.narrative, "gm-message");
            
            if (isInitialPrompt) {
                // Для первого хода записываем только ответ ИИ
                conversationHistory.push({ role: "model", parts: [{ text: narrativeResult.narrative }] });
            } else {
                conversationHistory.push({ role: "user", parts: [{ text: promptTextForAI }] });
                conversationHistory.push({ role: "model", parts: [{ text: narrativeResult.narrative }] });
            }

            // Выполняем команды ТОЛЬКО если это не повтор (чтобы не выдать предметы дважды)
            if (!skipLogic) {
                allPendingActions.forEach(action => {
                    const feedback = executeCommand(action.command, action.args);
                    if (feedback) {
                        addLogMessage(feedback, "command-feedback");
                        addCalculationMessage(feedback);
                    }
                });
            }

            updateCharacterSheet();
            updateMapDisplay();
            updateInventoryDisplay();
            updateEnvironmentPanel();

            if (isInitialPrompt) hideLoadingScreen();
        }

    } catch (error) {
        console.error("Ошибка API:", error);
        const errorText = "Произошла ошибка генерации. Сервер не ответил или вернул неверный формат.";
        
        if (isInitialPrompt) {
            showCustomAlert(`${errorText}\nВозврат к созданию персонажа.`);
            hideLoadingScreen();
            setActiveScreen('character-creation-screen');
        } else {
            addLogMessage(errorText, "system-message");
            // Показываем кнопку повтора ТОЛЬКО ДЛЯ ПОЭТА
            showRetryButton(() => sendApiRequest(lastUserMessageForRetry, false, false, [], false, true));
        }
    } finally {
        isWaitingForAI = false;
        if (userInput) userInput.disabled = false;
        if (sendButton) sendButton.disabled = false;
        if (userInput) userInput.focus();
    }
}

/**
 * УНИВЕРСАЛЬНЫЙ ПАРСЕР
 * Гарантирует извлечение данных из JSON даже если модель прислала лишний текст.
 */
function parseAIResponse(rawResponse) {
    let narrative = "";
    let actions = [];
    let logic_summary = "";

    // 1. Ищем границы JSON
    const startIdx = rawResponse.indexOf('{');
    const endIdx = rawResponse.lastIndexOf('}');

    if (startIdx !== -1 && endIdx !== -1) {
        const jsonString = rawResponse.substring(startIdx, endIdx + 1);
        
        try {
            const parsed = JSON.parse(jsonString);
            
            // Сначала берем данные из полей самого JSON
            actions = parsed.actions || [];
            logic_summary = parsed.logic_summary || "";
            narrative = parsed.narrative || ""; // Если ИИ положил текст внутрь JSON
            
        } catch (jsonErr) {
            console.warn("JSON найден, но он поврежден. Пытаемся спасти данные.");
        }

        // 2. Если поле narrative в JSON было пустым, берем текст СНАРУЖИ JSON
        if (!narrative.trim()) {
            narrative = rawResponse.replace(jsonString, "").trim();
        }
    } else {
        // Если JSON вообще не обнаружен, весь ответ — это текст
        narrative = rawResponse.trim();
    }

    // Финальная чистка от технических артефактов
    narrative = narrative.replace(/```json|```/g, "").trim();

    return { narrative, actions, logic_summary };
}

function animateGoldChange(amount) {
    const goldDisplay = document.getElementById('stat-gold');
    if (!goldDisplay) return;

    // Создаем элемент частицы
    const particle = document.createElement('span');
    particle.className = 'coin-particle';
    const isPositive = amount > 0;
    particle.textContent = (isPositive ? '+$' : '$') + Math.abs(amount);
    if (!isPositive) particle.style.color = '#e74c3c'; // Красный для убытка

    // Добавляем иконку монетки
    const coinIcon = document.createElement('i');
    coinIcon.className = 'fas fa-coins';
    coinIcon.style.marginLeft = '5px';
    particle.appendChild(coinIcon);

    // Позиционируем возле счетчика золота
    const rect = goldDisplay.getBoundingClientRect();
    particle.style.left = `20px`; 
    particle.style.top = `-10px`;

    goldDisplay.parentElement.style.position = 'relative';
    goldDisplay.parentElement.appendChild(particle);

    // Эффект тряски для родителя при трате
    if (!isPositive) {
        goldDisplay.parentElement.classList.add('shake');
        setTimeout(() => goldDisplay.parentElement.classList.remove('shake'), 300);
    }

    // Удаляем после анимации
    setTimeout(() => particle.remove(), 1000);
}

/**
 * ПОЛНАЯ СБОРКА ДЛЯ СЧЕТОВОДА (LOGIC)
 * Включает: logic_rules + rules_and_instructions + combat_rules + env_guide + items_ref + snapshot
 */
async function prepareLogicPrompt(expiredEffects, promptTextForAI, isInitial = false) {
    try {
        // 1. Загружаем базовые правила логики и список команд
        const logicRules = await loadPromptFromFile('assets/promts/logic_rules.txt');
        const masterInstructions = await loadPromptFromFile('assets/promts/1.txt');
        const rulesAndInstructions = await loadPromptFromFile('assets/promts/rules_and_instructions.txt');
        
        // 2. Загружаем правила боя и гайд по NPC/Окружению
        const combatRules = await loadPromptFromFile('assets/promts/combat_system_rules.txt');
        const envGuide = await loadPromptFromFile('assets/promts/environment_commands_guide.txt');
        
        // 3. Загружаем базу предметов (из глобальной переменной или файла)
        // Если itemsReferenceData у тебя уже загружен как объект, превращаем в строку
        const itemsRefString = Array.isArray(itemsReferenceData) 
            ? JSON.stringify(itemsReferenceData) 
            : "DATABASE ERROR: Items not loaded";

        // 4. Специфические инструкции для СТАРТА ИГРЫ
        let setupInstructions = "";
        if (isInitial) {
            setupInstructions = await loadPromptFromFile('assets/promts/initial_game_setup_prompt.txt');
            console.log(">>> Добавлены инструкции стартовой инициализации мира.");
        }

        // 5. Получаем ПОЛНЫЙ слепок данных игрока
        // Мы используем ту самую функцию buildFullPlayerSnapshot, которую обсуждали ранее
        const snapshot = buildFullPlayerSnapshot();

        // 6. Формируем список истекших эффектов для обработки
        const expiredText = expiredEffects && expiredEffects.length > 0 
            ? `ВНИМАНИЕ: В этом ходу истекли следующие эффекты: ${expiredEffects.join(', ')}. Удали их из состояния и опиши последствия.` 
            : "";

        // СБОРКА ФИНАЛЬНОЙ СТРОКИ
        return `
${logicRules}
${masterInstructions}
${rulesAndInstructions}
${combatRules}
${envGuide}

### СПРАВОЧНИК ПРЕДМЕТОВ (ITEMS DATABASE):
${itemsRefString}

${snapshot}

${expiredText}

${setupInstructions}

### ИНСТРУКЦИЯ ПО ВВОДУ:
${isInitial 
    ? "ЭТО ПЕРВЫЙ ХОД. Инициализируй мир: выдай стартовый набор предметов, экипируй их, выдай золото, установи локацию и создай первый сюжетный квест." 
    : "Проанализируй ввод игрока и snapshot. Выполни расчеты и верни JSON команды."}

ЯЗЫК ЛОГИЧЕСКОГО РЕЗЮМЕ (logic_summary): СТРОГО ${currentLanguage === 'ru' ? 'Русский' : 'English'}.
`;

    } catch (error) {
        console.error("Ошибка при сборке Logic Prompt:", error);
        return "КРИТИЧЕСКАЯ ОШИБКА СБОРКИ ПРОМПТА. Проверьте наличие файлов в assets/promts/";
    }
}

/**
 * ПОЛНАЯ СБОРКА ДЛЯ ПОЭТА (NARRATIVE)
 * Включает: narrative_rules + rules_and_instructions + skills_ref + lore + snapshot + logic_summary
 */
async function prepareNarrativePrompt(logicSummary, promptTextForAI) {
    const narrativeRules = await loadPromptFromFile('assets/promts/narrative_rules.txt');
    const masterInstructions = await loadPromptFromFile('assets/promts/1.txt'); // Чтобы Поэт понимал контекст команд
    const skillRef = await loadPromptFromFile('assets/promts/skills_reference_prompt.txt');
    
    const snapshot = buildFullPlayerSnapshot();
    const responseLanguage = (currentLanguage === 'ru') ? 'Russian' : 'English';
    const style = narrators[currentNarratorIndex] ? await (await fetch(narrators[currentNarratorIndex].promptFile)).text() : "";
    
    // Собираем мега-промпт
    return `
${narrativeRules}
${masterInstructions}
${skillRef}

### ЛОР МИРА:
${worldLore}

${snapshot}

### СТИЛЬ ПОВЕСТВОВАНИЯ:
${style}

### ФАКТЫ ОТ ИГРОВОГО ДВИЖКА (ОБЯЗАТЕЛЬНО К ОПИСАНИЮ):
${logicSummary}

ЯЗЫК ОТВЕТА: ${responseLanguage}

### ТЕКУЩИЙ ХОД:
Игрок ввел: "${promptTextForAI}"
### ФАКТЫ ОТ ИГРОВОГО ДВИЖКА (ОБЯЗАТЕЛЬНО К ОПИСАНИЮ)
Результат этого действия от игрового движка: "${logicSummary}"
`;
}

// --- Обработка Команд от Gemini ---
/**
 * Извлекает команды из текста GM и разделяет их на команду и аргументы.
 * Использует специальную логику для команд, у которых последний аргумент может содержать разделители.
 * @param {string} text - Текст ответа от Gemini.
 * @returns {{narrative: string, commands: Array<object>}} - Объект с нарративом и массивом команд.
 */
function processCommands(text) {
    if (!text) return { narrative: "", commands: [] };

    let narrativeText = text;
    const commandsToExecute = [];
    const commandStartTag = '[COMMAND:';
    const commandEndTag = ']';
    const delimiter = '|:|'; 

    let startIndex = narrativeText.indexOf(commandStartTag);

    while (startIndex !== -1) {
        const endIndex = narrativeText.indexOf(commandEndTag, startIndex + commandStartTag.length);
        if (endIndex === -1) break;

        const fullMatch = narrativeText.substring(startIndex, endIndex + commandEndTag.length);
        const commandContent = fullMatch.substring(commandStartTag.length, fullMatch.length - commandEndTag.length);
        
        const firstColonIndex = commandContent.indexOf(':');
        if (firstColonIndex !== -1) {
            const command = commandContent.substring(0, firstColonIndex).trim();
            const argsString = commandContent.substring(firstColonIndex + 1);

            // *** НОВЫЙ СУПЕР-НАДЕЖНЫЙ ПАРСЕР ***
            // 1. Разделяем строку по нашему разделителю
            // 2. Обрезаем пробелы у каждого аргумента
            // 3. Фильтруем пустые элементы, которые могли появиться из-за ошибок GM (например, `|:||:|`)
            const args = argsString.split(delimiter)
                               .map(arg => arg.trim())
                               .filter(arg => arg.length > 0); 
            
            commandsToExecute.push({ command, args });
        }

        narrativeText = narrativeText.replace(fullMatch, '');
        startIndex = narrativeText.indexOf(commandStartTag);
    }

    return {
        narrative: narrativeText.trim(),
        commands: commandsToExecute
    };
}

/**
 * Обновляет панель "Константы" (Nexus), корректно отображая иерархию
 * категорий и элементов.
 * Эта версия фильтрует служебные элементы, которые используются для определения
 * категории (например, элемент с name: "Владения" и category: "Владения"),
 * и не отображает их как отдельные пункты.
 */
/**
 * (ПОЛНАЯ ОБНОВЛЕННАЯ ВЕРСИЯ v2.0)
 * Выполняет команду, полученную от GM в виде структурированного объекта.
 * Сохраняет 100% функционала оригинальной версии, работавшей на строках.
 * @param {string} command - Имя команды в формате camelCase (например, "addItem").
 * @param {object} args - Объект с именованными аргументами для команды.
 * @returns {string|null} - Сообщение для лога обратной связи или null, если обратная связь не требуется.
 */
function executeCommand(command, args) {
    if (!player) return t('gameInterface.commandFeedback.errorPlayerMissing');
    console.log("Выполнение команды:", command, args);
    let feedback = null;

    try {
        switch (command) {

            // --- ОБЩИЕ КОМАНДЫ И СОСТОЯНИЕ ---

            case 'setMemory':
                if (args.key && args.text) {
                    if (!player.gmNotes) player.gmNotes = {};
                    player.gmNotes[args.key] = args.text;
                    console.log(`[Memory] Блок '${args.key}' обновлен.`);
                    updateGmNotesDisplay();
                }
                break;
            case 'deleteMemory':
                if (args.key && player.gmNotes && player.gmNotes[args.key]) {
                    delete player.gmNotes[args.key];
                    console.log(`[Memory] Блок '${args.key}' удален.`);
                    updateGmNotesDisplay();
                }
                break;
            case 'archiveMemory':
                if (args.key && args.summary) {
                    if (player.gmNotes && player.gmNotes[args.key]) {
                        if (!player.memoryArchives) player.memoryArchives = {};
                        if (!player.archiveSummaries) player.archiveSummaries = {};
                        
                        player.memoryArchives[args.key] = player.gmNotes[args.key];
                        player.archiveSummaries[args.key] = args.summary;
                        delete player.gmNotes[args.key];
                        console.log(`[Memory] Блок '${args.key}' заархивирован.`);
                        updateGmNotesDisplay();
                    }
                }
                break;

            case 'setLocation':
                if (args.locationName) {
                    const newLocationName = String(args.locationName).trim().replace(/_/g, ' ');
                    player.location = newLocationName;
                    feedback = t('gameInterface.commandFeedback.locationChanged', { location: player.location });
                    const markerId = newLocationName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_а-яё]/g, '').substring(0, 50);
                    if (!player.mapMarkers) player.mapMarkers = {};
                    if (!player.mapMarkers[markerId]) {
                         player.mapMarkers[markerId] = { id: markerId, name: newLocationName, description: '' };
                    }
                    updateCharacterSheet();
                    updateMapDisplay();
                } else {
                    feedback = `[ERROR] 'setLocation' требует аргумент 'locationName'.`;
                }
                break;

            case 'calculationLog':
                if (args.message) {
                    addCalculationMessage(String(args.message));
                }
                break;

            case 'defineFaction':
                if (args.key && args.name) {
                    if (!player.factionData) player.factionData = {};
                    player.factionData[String(args.key)] = String(args.name);
                    feedback = `[DEBUG] Фракция '${args.key}' определена как '${args.name}'.`;
                    addCalculationMessage(feedback);
                } else {
                    feedback = `[ERROR] 'defineFaction' требует 'key' и 'name'.`;
                }
                break;

            // --- ПЕРСОНАЖ ---

            case 'updateStat':
                if (args.stat && typeof args.change === 'number') {
                    const { stat, change } = args;
                    const pathParts = stat.toLowerCase().split('.');
                    let currentStatObject = player.stats;
                    let finalStatName = pathParts[pathParts.length - 1];

                    for (let i = 0; i < pathParts.length - 1; i++) {
                        const part = pathParts[i];
                        if (currentStatObject[part] === undefined || typeof currentStatObject[part] !== 'object') {
                            currentStatObject[part] = {};
                        }
                        currentStatObject = currentStatObject[part];
                    }

                    const oldValue = currentStatObject[finalStatName] || 0;
                    currentStatObject[finalStatName] = oldValue + change;

                    if (stat === 'hp') {
                        player.stats.hp = Math.max(0, Math.min(player.stats.hp, player.stats.maxHp || 0));
                        feedback = t('gameInterface.commandFeedback.hpChanged', { change: change > 0 ? `+${change}` : change, hp: player.stats.hp, maxHp: player.stats.maxHp || 0 });
                    } else if (stat.startsWith('reputation.')) {
                        feedback = t('gameInterface.commandFeedback.reputationChanged', { change: change > 0 ? `+${change}` : change, reputation: currentStatObject[finalStatName] });
                    } else if (stat === 'xp') {
                        player.stats.xp = Math.max(0, player.stats.xp);
                        feedback = t('gameInterface.commandFeedback.xpGained', { change: change, xp: player.stats.xp, xpNext: player.stats.xpNext });
                        levelUp();
                    } else {
                        feedback = `${finalStatName.toUpperCase()} changed by ${change > 0 ? `+${change}` : change}. New value: ${currentStatObject[finalStatName]}`;
                    }

                    if (stat !== 'xp') {
                        updateCharacterSheet();
                    }
                } else {
                    feedback = `[ERROR] 'updateStat' требует 'stat' (string) и 'change' (number).`;
                }
                break;

            case 'setStat':
                if (args.stat && typeof args.value === 'number') {
                    const { stat, value } = args;
                    const pathParts = stat.toLowerCase().split('.');
                    let currentStatObject = player.stats;
                    let finalStatName = pathParts[pathParts.length - 1];

                    for (let i = 0; i < pathParts.length - 1; i++) {
                         const part = pathParts[i];
                        if (currentStatObject[part] === undefined || typeof currentStatObject[part] !== 'object') {
                            currentStatObject[part] = {};
                        }
                        currentStatObject = currentStatObject[part];
                    }

                    currentStatObject[finalStatName] = value;

                    if (stat.startsWith('reputation.')) {
                        feedback = t('gameInterface.commandFeedback.reputationSet', { value: value });
                    } else {
                        feedback = `${finalStatName.toUpperCase()} set to ${value}.`;
                    }
                    updateCharacterSheet();
                } else {
                    feedback = `[ERROR] 'setStat' требует 'stat' (string) и 'value' (number).`;
                }
                break;

// --- ИНВЕНТАРЬ ---
            case 'addItem':
                if (args.aiIdentifier && args.name) {
                    const aiId = String(args.aiIdentifier);
                    const name = String(args.name);
                    const quantity = (args.quantity !== undefined && !isNaN(parseInt(args.quantity))) 
                                     ? parseInt(args.quantity) : 1;
                    const description = args.description || t('itemDescriptions.noDescription');
                    const slot = args.slot || null;
                    const rarity = args.rarity || 'Обычный';
                    const itemType = args.itemType || 'misc';

                    // ЛОГИКА ДЛЯ ЗОЛОТА
                    if (aiId.toLowerCase() === 'gold') {
                        const oldGold = player.stats.gold || 0;
                        player.stats.gold = Math.max(0, oldGold + quantity);
                        
                        // Запускаем нашу новую анимацию
                        animateGoldChange(quantity);
                        
                        feedback = t('gameInterface.commandFeedback.goldChanged', { change: quantity > 0 ? `+${quantity}` : quantity, gold: player.stats.gold });
                        updateCharacterSheet();
                    } 
                    // ЛОГИКА ДЛЯ ПРЕДМЕТОВ
                    else {
                        let existingItemKey = Object.keys(player.inventory).find(id => player.inventory[id].aiIdentifier?.toLowerCase() === aiId.toLowerCase());

                        if (existingItemKey) {
                            player.inventory[existingItemKey].quantity += quantity;
                            feedback = t('gameInterface.commandFeedback.itemQuantityIncreased', { itemName: name, quantity: quantity });
                        } else {
                            if (Object.keys(player.inventory).length >= player.inventoryCapacity) {
                                feedback = t('gameInterface.commandFeedback.inventoryFull', { itemName: name });
                            } else {
                                const newItemInternalId = nextInternalItemId++;
                                player.inventory[newItemInternalId] = {  
                                    imageUrl: null,
                                    isGenerating: false,
                                    id: newItemInternalId,
                                    aiIdentifier: aiId,
                                    name: name,
                                    quantity: quantity,
                                    description: description,
                                    rarity: rarity,
                                    itemType: itemType,
                                    slot: slot,
                                    effects: args.effects || [],
                                    value: args.value ?? 0
                                };
                                feedback = t('gameInterface.commandFeedback.itemAdded', { itemName: name, quantity: quantity });
                                
                            }
                        }
                        updateInventoryDisplay();
                    }
                } else {
                    feedback = `[ERROR] 'addItem' требует 'aiIdentifier' и 'name'.`;
                }
                break;

            case 'removeItem':
                if (args.aiIdentifier) {
                    const searchTerm = String(args.aiIdentifier).toLowerCase();
                    const quantity = (args.quantity !== undefined && args.quantity !== null && !isNaN(parseInt(args.quantity))) 
                                     ? parseInt(args.quantity) : 1;

                    let itemKey = Object.keys(player.inventory).find(id => player.inventory[id].aiIdentifier?.toLowerCase() === searchTerm);
                    if (!itemKey) {
                        itemKey = Object.keys(player.inventory).find(id => player.inventory[id].name?.toLowerCase() === searchTerm);
                    }

                    if (itemKey) {
                        const item = player.inventory[itemKey];
                        if (item.quantity >= quantity) {
                            item.quantity -= quantity;
                            const removedName = item.name;
                            if (item.quantity <= 0) {
                                delete player.inventory[itemKey];
                            }
                            feedback = t('gameInterface.commandFeedback.itemRemoved', { itemName: removedName, quantityToRemove: quantity });
                            updateInventoryDisplay();
                        } else {
                            feedback = t('gameInterface.commandFeedback.notEnoughItem', { itemName: item.name, itemId: args.aiIdentifier, quantityToRemove: quantity });
                        }
                    } else {
                        feedback = t('gameInterface.commandFeedback.itemNotFound', { itemId: args.aiIdentifier });
                    }
                } else {
                    feedback = `[ERROR] 'removeItem' требует 'aiIdentifier'.`;
                }
                break;
            
            // --- КВЕСТЫ ---

            case 'addQuest':
                if (args.aiIdentifier && args.title) {
                    const existingQuest = Object.values(player.quests).find(q => q.aiIdentifier?.toLowerCase() === args.aiIdentifier.toLowerCase() && q.status === 'active');
                    if (!existingQuest) {
                        const newId = nextInternalQuestId++;
                        player.quests[newId] = {
                            id: newId,
                            aiIdentifier: args.aiIdentifier,
                            title: args.title,
                            objective: args.objective || '?',
                            description: args.description || t('quests.noDescription'),
                            reward: args.reward || t('quests.unknown'),
                            issuer: args.issuer || t('quests.unknown'),
                            status: 'active'
                        };
                        feedback = t('gameInterface.commandFeedback.questAdded', { description: args.title });
                        updateQuestList();
                    } else {
                        feedback = t('gameInterface.commandFeedback.questAlreadyActive', { description: existingQuest.title });
                    }
                } else {
                    feedback = `[ERROR] 'addQuest' требует 'aiIdentifier' и 'title'.`;
                }
                break;
            
            case 'updateQuest':
                if (args.aiIdentifier && args.status) {
                    const searchTerm = args.aiIdentifier.toLowerCase().trim();
                    let questKey = Object.keys(player.quests).find(id => player.quests[id].aiIdentifier?.toLowerCase().trim() === searchTerm);
                    if (!questKey) {
                        questKey = Object.keys(player.quests).find(id => player.quests[id].title?.toLowerCase().trim() === searchTerm);
                    }

                    if (questKey) {
                        const quest = player.quests[questKey];
                        const newStatus = args.status.toLowerCase();
                        if (['active', 'completed', 'failed'].includes(newStatus)) {
                            if (quest.status !== newStatus) {
                                quest.status = newStatus;
                                const statusLocalized = t(`quests.status${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`);
                                feedback = t('gameInterface.commandFeedback.questStatusUpdated', { description: quest.title, status: statusLocalized });
                            } else {
                                feedback = t('gameInterface.commandFeedback.questSameStatus', { description: quest.title });
                            }
                            updateQuestList();
                        } else {
                            feedback = `[ERROR] Неверный статус для 'updateQuest': ${args.status}.`;
                        }
                    } else {
                        feedback = t('gameInterface.commandFeedback.questNotFound', { questId: args.aiIdentifier });
                    }
                } else {
                    feedback = `[ERROR] 'updateQuest' требует 'aiIdentifier' и 'status'.`;
                }
                break;
            
            case 'removeQuest':
                if(args.aiIdentifier) {
                    const searchTerm = args.aiIdentifier.toLowerCase().trim();
                    let questKey = Object.keys(player.quests).find(id => player.quests[id].aiIdentifier?.toLowerCase().trim() === searchTerm);
                    if (!questKey) {
                        questKey = Object.keys(player.quests).find(id => player.quests[id].title?.toLowerCase().trim() === searchTerm);
                    }

                    if (questKey) {
                        const quest = player.quests[questKey];
                        const title = quest.title;

                        // --- ИСПРАВЛЕНИЕ ---
                        // Вместо полного удаления, мы меняем статус на "failed".
                        // Это гарантированно уберет его из списка, так как эта логика уже работает.
                        quest.status = 'failed';
                        // -------------------

                        feedback = t('gameInterface.commandFeedback.questRemoved', { description: title });
                        updateQuestList(); // Эта функция теперь корректно отработает изменение статуса
                    } else {
                        feedback = t('gameInterface.commandFeedback.questNotFoundForRemoval', { questId: args.aiIdentifier });
                    }
                } else {
                    feedback = `[ERROR] 'removeQuest' требует 'aiIdentifier'.`;
                }
                break;

            case 'editQuest':
                if (args.aiIdentifier && args.field && args.value !== undefined) {
                     const searchTerm = args.aiIdentifier.toLowerCase().trim();
                     let questKey = Object.keys(player.quests).find(id => player.quests[id].aiIdentifier?.toLowerCase().trim() === searchTerm);
                     if (!questKey) {
                         questKey = Object.keys(player.quests).find(id => player.quests[id].title?.toLowerCase().trim() === searchTerm);
                     }

                    if (questKey) {
                        const quest = player.quests[questKey];
                        const field = args.field.toLowerCase();
                        if (['title', 'objective', 'description', 'reward', 'issuer'].includes(field)) {
                            quest[field] = args.value;
                            const fieldLocalized = t(`quests.${field}Label`);
                            feedback = t('gameInterface.commandFeedback.questEdited', { questId: quest.title, field: fieldLocalized, newValue: args.value });
                            updateQuestList();
                        } else {
                            feedback = `[ERROR] Неверное поле для 'editQuest': ${args.field}.`;
                        }
                    } else {
                        feedback = t('gameInterface.commandFeedback.questNotFound', { questId: args.aiIdentifier });
                    }
                } else {
                    feedback = `[ERROR] 'editQuest' требует 'aiIdentifier', 'field', и 'value'.`;
                }
                break;

            // --- УМЕНИЯ ---

            case 'addSkill':
                if (args.id && args.name) {
                    const existingSkill = player.skills[args.id];
                    player.skills[args.id] = {
                        id: args.id, name: args.name,
                        description: args.description || t('skills.noDescription'),
                        damage: args.damage || null,
                        cost: args.cost ?? null,
                        costType: args.costType || null,
                        duration: args.duration || null,
                        cooldown: args.cooldown || null,
                        skillType: args.skillType || null,
                        effect: args.effect || null
                    };
                    if (existingSkill) {
                        feedback = t('gameInterface.commandFeedback.skillAlreadyKnown', { skillName: args.name }) + " " + t('gameInterface.commandFeedback.skillUpdated');
                    } else {
                        feedback = t('gameInterface.commandFeedback.skillLearned', { skillName: args.name });
                    }
                    updateSkillsDisplay();
                } else {
                    feedback = `[ERROR] 'addSkill' требует 'id' и 'name'.`;
                }
                break;

            case 'removeSkill':
                if (args.id) {
                    if (player.skills[args.id]) {
                        const skillName = player.skills[args.id].name;
                        delete player.skills[args.id];
                        feedback = t('gameInterface.commandFeedback.skillForgotten', { skillName: skillName });
                        updateSkillsDisplay();
                    } else {
                        feedback = t('gameInterface.commandFeedback.skillNotFoundForRemoval', { skillId: args.id });
                    }
                } else {
                    feedback = `[ERROR] 'removeSkill' требует 'id'.`;
                }
                break;
            
            // --- КАРТА ---

            case 'addDiscoveredLocation': // Старое название, сохраняем для совместимости промпта
            case 'addMapMarker':
                if (args.id && args.name && typeof args.x === 'number' && typeof args.y === 'number') {
                    if (!player.mapMarkers) player.mapMarkers = {};
                    
                    let newX = args.x;
                    let newY = args.y;
                    const MIN_DISTANCE = 45; // Увеличено расстояние отталкивания меток друг от друга

                    // --- [НАЧАЛО НОВОЙ ЛОГИКИ] - Проверка коллизий ---
                    let collisionDetected = false;
                    let attempts = 0;
                    const MAX_ATTEMPTS = 50; // Чтобы избежать бесконечного цикла

                    // Собираем все существующие точки на карте
                    const allPoints = [
                        ...Object.values(globalLocations || {}),
                        ...Object.values(player.mapMarkers || {})
                    ].filter(p => p.id !== args.id); // Исключаем саму себя, если это обновление

                    do {
                        collisionDetected = false;
                        for (const point of allPoints) {
                            if (typeof point.x === 'number' && typeof point.y === 'number') {
                                // Рассчитываем расстояние между новой точкой и существующей
                                const distance = Math.hypot(newX - point.x, newY - point.y);
                                
                                if (distance < MIN_DISTANCE) {
                                    collisionDetected = true;
                                    // Если нашли коллизию, сдвигаем новую точку в случайном направлении по спирали
                                    const angle = Math.random() * 2 * Math.PI;
                                    newX += Math.cos(angle) * (MIN_DISTANCE * 0.75);
                                    newY += Math.sin(angle) * (MIN_DISTANCE * 0.75);
                                    attempts++;
                                    break; // Начинаем проверку заново с новыми координатами
                                }
                            }
                        }
                    } while (collisionDetected && attempts < MAX_ATTEMPTS);
                    
                    if (attempts > 0) {
                        console.log(`[Map Collision] Обнаружено наложение меток. Новая метка '${args.name}' была сдвинута из (${args.x},${args.y}) в (${Math.round(newX)},${Math.round(newY)}).`);
                    }
                    // --- [КОНЕЦ НОВОЙ ЛОГИКИ] ---

                    const isUpdate = !!player.mapMarkers[args.id];
                    player.mapMarkers[args.id] = {
                        id: args.id,
                        name: args.name,
                        description: args.description || '',
                        x: newX, // Используем новые, скорректированные координаты
                        y: newY  // Используем новые, скорректированные координаты
                    };

                    feedback = isUpdate
                        ? t('gameInterface.commandFeedback.mapMarkerUpdated', { markerName: args.name })
                        : t('gameInterface.commandFeedback.mapMarkerAdded', { markerName: args.name });
                    updateMapDisplay();
                } else {
                    feedback = `[ERROR] 'addMapMarker' требует 'id', 'name', 'x' (number), и 'y' (number).`;
                }
                break;

            case 'removeMapMarker':
                if (args.id) {
                    if (player.mapMarkers && player.mapMarkers[args.id]) {
                        const markerName = player.mapMarkers[args.id].name;
                        delete player.mapMarkers[args.id];
                        feedback = t('gameInterface.commandFeedback.mapMarkerRemoved', { markerName: markerName });
                        updateMapDisplay();
                    } else {
                         feedback = t('gameInterface.commandFeedback.mapMarkerNotFound', { markerId: args.id });
                    }
                } else {
                    feedback = `[ERROR] 'removeMapMarker' требует 'id'.`;
                }
                break;
            
            // --- КОНСТАНТЫ (NEXUS) ---

            case 'nexusDefine':
                if (args.id && args.name && args.category && args.displayType && args.value !== undefined) {
                    if (!player.nexusData) player.nexusData = {};
                    if (!player.nexusData[args.id]) {
                        player.nexusData[args.id] = {
                            id: args.id, name: args.name, description: args.description || '',
                            category: args.category, displayType: args.displayType, value: args.value,
                            effects: []
                        };
                        feedback = t('gameInterface.commandFeedback.nexusDefined', { name: args.name });
                        updateNexusDisplay();
                    }
                } else {
                     feedback = `[ERROR] 'nexusDefine' требует 'id', 'name', 'category', 'displayType', 'value'.`;
                }
                break;

            case 'nexusUpdate':
                if (args.id && args.value !== undefined) {
                    if (player.nexusData && player.nexusData[args.id]) {
                        const nexusItem = player.nexusData[args.id];
                        if (args.isModification === true && nexusItem.displayType === 'numeric') {
                            const change = parseInt(args.value, 10);
                            if (!isNaN(change)) {
                                nexusItem.value = (parseInt(nexusItem.value, 10) || 0) + change;
                                feedback = t('gameInterface.commandFeedback.nexusModified', { name: nexusItem.name, change: args.value, newValue: nexusItem.value });
                            }
                        } else {
                            nexusItem.value = args.value;
                            feedback = t('gameInterface.commandFeedback.nexusSet', { name: nexusItem.name, newValue: nexusItem.value });
                        }
                        updateNexusDisplay();
                    } else {
                        feedback = `[ERROR] Константа Nexus '${args.id}' не найдена.`;
                    }
                } else {
                    feedback = `[ERROR] 'nexusUpdate' требует 'id' и 'value'.`;
                }
                break;

            case 'nexusRemove':
                if (args.id) {
                    if (player.nexusData && player.nexusData[args.id]) {
                        const name = player.nexusData[args.id].name;
                        delete player.nexusData[args.id];
                        feedback = t('gameInterface.commandFeedback.nexusRemoved', { name: name });
                        updateNexusDisplay();
                    } else {
                         feedback = `[ERROR] Константа Nexus '${args.id}' не найдена для удаления.`;
                    }
                } else {
                     feedback = `[ERROR] 'nexusRemove' требует 'id'.`;
                }
                break;

            // --- СТАТУС-ЭФФЕКТЫ ---

            case 'applyPredefinedEffect':
                if (args.target === 'player' && args.effectId && typeof args.duration === 'number') {
                    const predefinedEffect = predefinedStatusEffects[args.effectId.toLowerCase()]; // Ищем в нижнем регистре для надежности

                    if (predefinedEffect) {
                        // Если эффект НАЙДЕН в нашем списке, создаем его клон
                        const newEffectInstance = structuredClone(predefinedEffect);
                        // И вызываем основную команду addStatusEffect, передавая все данные из нашего шаблона
                        // Это централизует логику создания эффектов
                        executeCommand('addStatusEffect', {
                            target: 'player',
                            id: args.effectId, // Используем оригинальный ID, который прислал GM
                            name: newEffectInstance.name,
                            duration: args.duration,
                            description: newEffectInstance.description,
                            effectsJSON: newEffectInstance.effectsJSON
                        });
                        // Явный фидбэк не нужен, т.к. его даст вложенная команда addStatusEffect
                    } else {
                        // --- [КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ] ---
                        // Если эффект НЕ НАЙДЕН, мы больше не выдаем ошибку.
                        // Мы логируем это для отладки и даем GM подсказку.
                        feedback = `[INFO] GM попытался применить неопределенный эффект '${args.effectId}'. Для создания уникальных эффектов следует использовать команду 'addStatusEffect' со всеми параметрами.`;
                        console.warn(feedback);
                    }
                } else {
                    feedback = `[ERROR] 'applyPredefinedEffect' требует 'target', 'effectId', и 'duration'.`;
                }
                break;

            case 'addStatusEffect':
                if (args.target === 'player' && args.id && args.name && typeof args.duration === 'number' && args.description) {
                    if (!player.statusEffects) player.statusEffects = {};

                    let parsedEffects = [];
                    try {
                        if(typeof args.effectsJSON === 'string' && args.effectsJSON.length > 2) {
                            parsedEffects = JSON.parse(args.effectsJSON);
                        } else if (Array.isArray(args.effectsJSON)) {
                            parsedEffects = args.effectsJSON;
                        }
                    } catch (e) {
                        console.error(`Ошибка разбора effectsJSON для эффекта '${args.id}':`, e, args.effectsJSON);
                    }

                    const newEffectData = {
                        id: args.id, name: args.name, duration: args.duration,
                        description: args.description, effects: parsedEffects,
                        appliedTurn: player.stats.turnCount, originalValues: {}
                    };

                    parsedEffects.forEach(subEffect => {
                        if (subEffect.trigger?.type === 'on_apply') {
                            const message = applyEffectAction(player, newEffectData, subEffect.action);
                            if (message) addLogMessage(message, "command-feedback");
                        }
                    });

                    player.statusEffects[args.id] = newEffectData;
                    feedback = t('gameInterface.commandFeedback.statusEffectAdded', { effectName: args.name, duration: args.duration });
                    updateStatusEffectsDisplay();
                    updateCharacterSheet();
                } else {
                    feedback = `[ERROR] 'addStatusEffect' требует 'target', 'id', 'name', 'duration', 'description'.`;
                }
                break;

            case 'removeStatusEffect':
                if (args.target === 'player' && args.id) {
                    if (player.statusEffects && player.statusEffects[args.id]) {
                        const effectName = player.statusEffects[args.id].name;
                        delete player.statusEffects[args.id];
                        feedback = t('gameInterface.commandFeedback.statusEffectRemoved', { effectName: effectName });
                        updateStatusEffectsDisplay();
                        updateCharacterSheet();
                    } else {
                        feedback = t('gameInterface.commandFeedback.statusEffectNotFound', { effectId: args.id });
                    }
                } else {
                    feedback = `[ERROR] 'removeStatusEffect' требует 'target' и 'id'.`;
                }
                break;
            
            // --- ОКРУЖЕНИЕ ---

            case 'addEnvironment':
                if (args.aiIdentifier && args.name && args.type) {
                    const existingKey = Object.keys(player.visibleEntities).find(id => player.visibleEntities[id].aiIdentifier?.toLowerCase() === args.aiIdentifier.toLowerCase());
                    if (existingKey) {
                         feedback = t('gameInterface.commandFeedback.entityAlreadyInEnv', { name: player.visibleEntities[existingKey].name, id: args.aiIdentifier });
                    } else {
                        const newId = nextInternalEntityId++;
                        player.visibleEntities[newId] = {
                            id: newId,
                            aiIdentifier: args.aiIdentifier,
                            name: args.name, type: args.type,
                            description: args.description || '',
                            stats: {
                                hp: args.hp ?? 10, maxHp: args.maxHp ?? 10,
                                str: args.str ?? 10, dex: args.dex ?? 10,
                                con: args.con ?? 10, int: args.int ?? 10,
                            },
                            isHostile: args.isHostile === true,
                            xpReward: args.xpReward ?? 0
                        };
                        feedback = t('gameInterface.commandFeedback.entityAddedToEnv', { name: args.name });
                        updateEnvironmentPanel();
                    }
                } else {
                    feedback = `[ERROR] 'addEnvironment' требует 'aiIdentifier', 'name', и 'type'.`;
                }
                break;

            case 'removeEnvironment':
                // --- АВТОМАТИЧЕСКОЕ НАЧИСЛЕНИЕ ОПЫТА (XP SYSTEM) ---
                if (args.aiIdentifier && args.isDeath === true) {
                    const entKey = Object.keys(player.visibleEntities).find(id => player.visibleEntities[id].aiIdentifier === args.aiIdentifier);
                    if (entKey) {
                        const xpReward = parseInt(player.visibleEntities[entKey].xpReward) || 0;
                        if (xpReward > 0) {
                            player.stats.xp += xpReward;
                            addCalculationMessage(`[XP] Получено ${xpReward} опыта за уничтожение ${player.visibleEntities[entKey].name}`);
                            levelUp();
                        }
                    }
                }
                if (args.aiIdentifier) {
                     const entityKey = Object.keys(player.visibleEntities).find(id => player.visibleEntities[id].aiIdentifier?.toLowerCase() === args.aiIdentifier.toLowerCase());
                     if (entityKey) {
                         const entity = player.visibleEntities[entityKey];
                         const name = entity.name;
                         const xp = entity.xpReward || 0;
                         
                         if (args.isDeath === true && xp > 0) {
                             player.stats.xp += xp;
                             feedback = t('gameInterface.commandFeedback.entityRemovedFromEnv', { name: name }) + ` (Получено ${xp} опыта)`;
                             levelUp();
                         } else {
                             feedback = t('gameInterface.commandFeedback.entityRemovedFromEnv', { name: name });
                         }
                         
                         delete player.visibleEntities[entityKey];
                         updateEnvironmentPanel();
                         updateCharacterSheet();
                     } else {
                         feedback = t('gameInterface.commandFeedback.entityNotFoundInEnv', { id: args.aiIdentifier });
                     }
                } else {
                    feedback = `[ERROR] 'removeEnvironment' требует 'aiIdentifier'.`;
                }
                break;

            case 'updateEntityStat':
                if (args.aiIdentifier && args.stat && typeof args.value === 'number') {
                    const entityKey = Object.keys(player.visibleEntities).find(id => player.visibleEntities[id].aiIdentifier?.toLowerCase() === args.aiIdentifier.toLowerCase());
                    if (entityKey) {
                        const entity = player.visibleEntities[entityKey];
                        const statName = args.stat.toLowerCase();
                        if (entity.stats && ['hp', 'maxhp', 'str', 'dex', 'con', 'int'].includes(statName)) {
                            let systemStatName = statName === 'maxhp' ? 'maxHp' : statName;
                            entity.stats[systemStatName] = args.value;
                            feedback = t('gameInterface.commandFeedback.entityStatUpdated', { name: entity.name, stat: systemStatName.toUpperCase(), value: args.value });

                            // --- АВТОМАТИКА СМЕРТИ ---
                            if (systemStatName === 'hp' && args.value <= 0) {
                                const xp = entity.xpReward || 0;
                                if (xp > 0) {
                                    player.stats.xp += xp;
                                    feedback += ` (Убит! +${xp} XP)`;
                                    levelUp();
                                } else {
                                    feedback += ` (Убит!)`;
                                }
                                delete player.visibleEntities[entityKey];
                                updateCharacterSheet();
                            }
                            updateEnvironmentPanel();
                        } else {
                             feedback = `[ERROR] Неверный стат '${args.stat}' для 'updateEntityStat'.`;
                        }
                    } else {
                        feedback = t('gameInterface.commandFeedback.entityNotFoundInEnv', { id: args.aiIdentifier });
                    }
                } else {
                    feedback = `[ERROR] 'updateEntityStat' требует 'aiIdentifier', 'stat', и 'value' (number).`;
                }
                break;
            
            case 'setEntityState':
                if (args.aiIdentifier && args.property && typeof args.value === 'boolean') {
                    const entityKey = Object.keys(player.visibleEntities).find(id => player.visibleEntities[id].aiIdentifier?.toLowerCase() === args.aiIdentifier.toLowerCase());
                    if(entityKey) {
                        const entity = player.visibleEntities[entityKey];
                        if (args.property.toLowerCase() === 'ishostile') {
                            entity.isHostile = args.value;
                            feedback = `[DEBUG] Статус враждебности для ${entity.name} установлен в ${args.value}.`;
                            updateEnvironmentPanel();
                        } else {
                            feedback = `[ERROR] Неверное свойство '${args.property}' для 'setEntityState'.`;
                        }
                    } else {
                        feedback = t('gameInterface.commandFeedback.entityNotFoundInEnv', { id: args.aiIdentifier });
                    }
                } else {
                    feedback = `[ERROR] 'setEntityState' требует 'aiIdentifier', 'property', и 'value' (boolean).`;
                }
                break;

            // --- БОЙ И ПРОВЕРКИ ---

            case 'rollDiceRequest':
                if (args.dice && args.reason) {
                    pendingDiceRoll = {
                        dice: args.dice,
                        reason: args.reason,
                        forGM: args.isGmOnly === true,
                        result: null
                    };

                    if (!pendingDiceRoll.forGM) {
                        addLogMessage(t('gameInterface.log.diceRollRequested', { reason: args.reason, dice: args.dice }), "system-message");
                        if (userInput) userInput.disabled = true;
                        if (sendButton) sendButton.disabled = true;
                        if (rollDiceButton) {
                            rollDiceButton.textContent = t('gameInterface.input.rollDiceButton', { dice: args.dice.split(/([+-])/)[0].trim() });
                            rollDiceButton.style.display = 'inline-block';
                            rollDiceButton.disabled = false;
                        }
                        if (rollDiceArea) rollDiceArea.style.display = 'block';
                        isWaitingForAI = false;
                    } else {
                        const rollResult = rollDice(pendingDiceRoll.dice);
                        pendingDiceRoll.result = rollResult;
                        addLogMessage(t('gameInterface.log.gmInternalAction'), "system-message");
                        sendApiRequest(`[INTERNAL_GM_ROLL_PROCESSING_FOR:${pendingDiceRoll.reason}]`, false, true);
                    }
                    feedback = null;
                } else {
                     feedback = `[ERROR] 'rollDiceRequest' требует 'dice' и 'reason'.`;
                }
                break;
			
            case 'equipItem':
                if (args.aiIdentifier) {
                    // Ищем внутренний ID предмета по его aiIdentifier, который прислал GM
                    const itemKey = Object.keys(player.inventory).find(id => player.inventory[id].aiIdentifier === args.aiIdentifier);
                    
                    if (itemKey) {
                        // Вызываем equipItem, передавая внутренний ID и слот (который может быть undefined, и это нормально)
                        feedback = equipItem(itemKey, args.slot);
                    } else {
                        // Если предмет еще не в инвентаре (из-за "гонки состояний")
                        console.warn(`[executeCommand] Команда equipItem для '${args.aiIdentifier}' не нашла предмет. Повторная попытка через 15мс.`);
                        setTimeout(() => executeCommand(command, args), 15);
                        return null; // Важно, чтобы не показывать фидбэк об ошибке сразу
                    }
                } else {
                    feedback = `[ERROR] 'equipItem' требует аргумент 'aiIdentifier'.`;
                }
                break;

            case 'unequipItem':
                if (args.slot) {
                    const slot = args.slot.toLowerCase();
                    if (player.equipment && player.equipment[slot]) {
                        feedback = unequipItem(slot);
                    } else {
                        feedback = t('gameInterface.commandFeedback.slotIsEmpty', { slot: slot });
                    }
                } else {
                    feedback = `[ERROR] 'unequipItem' требует 'slot'.`;
                }
                break;
                
            default:
                const oldCommands = ['ADD_TRAIT', 'UPDATE_TRAIT_VALUE', 'REMOVE_TRAIT', 'DEFINE_HOLDING', 'UPDATE_HOLDING', 'REMOVE_HOLDING'];
                if (oldCommands.includes(command)) {
                     feedback = `[DEBUG] Получена устаревшая команда '${command}'. Пожалуйста, используйте систему NEXUS.`;
                } else {
                    feedback = t('gameInterface.commandFeedback.errorUnknownCommand', { command: command });
                }
                console.warn(feedback, args);
        }
    } catch (error) {
        feedback = t('gameInterface.commandFeedback.errorCommandGeneric', { command: command, args: error.message });
        console.error(`Критическая ошибка при выполнении команды ${command}:`, error, args);
    }
    return feedback;
}

/**
 * Экипирует предмет из инвентаря.
 * @param {string} itemInternalId - Внутренний ID предмета в инвентаре.
 * @returns {string|null} Сообщение для лога или null.
 */
function equipItem(itemInternalId, targetSlot = null) {
    if (!player || !player.inventory || !player.equipment) return null;
    
    const itemToEquip = player.inventory[itemInternalId];
    if (!itemToEquip) {
        console.warn(`[equipItem] Попытка экипировать предмет ID ${itemInternalId}, который еще не в инвентаре. Повторная попытка через 10мс.`);
        setTimeout(() => {
            const feedback = equipItem(itemInternalId, targetSlot);
            if(feedback) addLogMessage(feedback, 'command-feedback');
        }, 10);
        return null;
    }

    if (!targetSlot) {
        console.log(`[equipItem AUTO] Слот не указан для '${itemToEquip.name}'. Запущен автоматический подбор.`);
        const allPossibleSlots = bodySlots.filter(s => !itemToEquip.slot || itemToEquip.slot === s || (['right_hand', 'left_hand'].includes(s) && ['right_hand', 'left_hand'].includes(itemToEquip.slot)));
        
        if (allPossibleSlots.length === 0) {
            return t('gameInterface.commandFeedback.itemNotEquipable', { itemName: itemToEquip.name });
        }
        
        targetSlot = allPossibleSlots.find(s => !player.equipment[s]);

        if (!targetSlot) {
            targetSlot = allPossibleSlots[0];
        }
        console.log(`[equipItem AUTO] Автоматически выбран слот '${targetSlot}'.`);
    }

    if (!bodySlots.includes(targetSlot)) {
        return `[ERROR] Попытка экипировать в несуществующий слот: '${targetSlot}'`;
    }

    if (itemToEquip.restrictedSlots && itemToEquip.restrictedSlots.includes(targetSlot)) {
        return `[ERROR] Предмет '${itemToEquip.name}' не может быть экипирован в слот '${targetSlot}'.`;
    }

    if (player.equipment[targetSlot]) {
        const unequipFeedback = unequipItem(targetSlot);
        if (unequipFeedback && unequipFeedback.includes(t('gameInterface.commandFeedback.inventoryFullOnUnequip', 'Инвентарь полон'))) {
             return unequipFeedback;
        }
    }

    player.equipment[targetSlot] = itemToEquip;
    delete player.inventory[itemInternalId];

    updateInventoryDisplay();
    updateEquipmentDisplay();
    updateCharacterSheet(); 

    const feedback = t('gameInterface.commandFeedback.itemEquipped', { itemName: itemToEquip.name, slot: t(`gameInterface.equipmentPanel.slots.${targetSlot}`, null, targetSlot) });
    
    // Сообщаем GM о действии, совершенном через UI (drag-and-drop)
    // Команды от GM не вызовут эту функцию, так как они идут через executeCommand
    queuePlayerActionForGM(`Player equipped item '${itemToEquip.name}' to slot '${targetSlot}'.`);

    return feedback;
}

function handleDrop(event) {
    event.preventDefault();
    const targetSlotElement = event.currentTarget;
    const slotName = targetSlotElement.dataset.slot;
    const itemId = event.dataTransfer.getData('text/plain');

    targetSlotElement.classList.remove('drag-over', 'drag-over-valid', 'drag-over-invalid');

    if (!itemId || !draggedItemData) return;

    let isValid = true;
    if (draggedItemData.slot && draggedItemData.slot !== slotName) {
        if (!(['right_hand', 'left_hand'].includes(slotName) &&['right_hand', 'left_hand'].includes(draggedItemData.slot))) {
            isValid = false;
        }
    }
    if (!isValid) {
        console.warn(`Попытка экипировать предмет '${draggedItemData.name}' в неверный слот '${slotName}'.`);
        return;
    }
    
    // Вызываем нашу универсальную функцию equipItem
    const feedback = equipItem(itemId, slotName);
    
    if (feedback) {
        addLogMessage(feedback, 'command-feedback');
    }
}

/**
 * Снимает предмет из указанного слота.
 * @param {string} slot - Название слота (например, 'head', 'right_hand').
 * @returns {string|null} Сообщение для лога или null.
 */
function unequipItem(slot) {
    if (!player || !player.equipment || !player.inventory) return null;
    
    const itemToUnequip = player.equipment[slot];
    if (!itemToUnequip) {
        return t('gameInterface.commandFeedback.slotIsEmpty', { slot: t(`gameInterface.equipmentPanel.slots.${slot}`, null, slot) });
    }

    if (Object.keys(player.inventory).length >= player.inventoryCapacity) {
        return t('gameInterface.commandFeedback.inventoryFullOnUnequip', { itemName: itemToUnequip.name });
    }

    player.inventory[itemToUnequip.id] = itemToUnequip;
    player.equipment[slot] = null;

    updateInventoryDisplay();
    updateEquipmentDisplay();
    updateCharacterSheet();

    const feedback = t('gameInterface.commandFeedback.itemUnequipped', { itemName: itemToUnequip.name, slot: t(`gameInterface.equipmentPanel.slots.${slot}`, null, slot) });
    
    // --- [НОВОЕ] Сообщаем GM о действии ---
    queuePlayerActionForGM(`Player unequipped item '${itemToUnequip.name}' from slot '${slot}'.`);
    
    return feedback;
}

/**
 * Обновляет визуальное отображение всех слотов экипировки.
 */
function updateEquipmentDisplay() {
    if (!player || !player.equipment) return;

    bodySlots.forEach(slot => {
        const item = player.equipment[slot];
        const slotElement = equipmentElements[slot];
        if (!slotElement) return;

        // Удаляем старое название предмета, если оно было
        const oldItemNameEl = slotElement.querySelector('.item-name-v2');
        if (oldItemNameEl) oldItemNameEl.remove();

        if (item) {
            slotElement.classList.add('equipped');

            const itemNameEl = document.createElement('span');
            itemNameEl.className = 'item-name-v2';
            itemNameEl.textContent = item.name;
            slotElement.appendChild(itemNameEl);
            
            // --- [ИСПРАВЛЕНИЕ ЗДЕСЬ!] ---
            // Теперь мы корректно определяем переменную bonusText ПЕРЕД ее использованием.
            let bonusText = (item.effects || [])
                .filter(e => e.type === 'modify_stat' && e.stat)
                .map(e => `${e.stat.toUpperCase()}: ${e.change > 0 ? '+' : ''}${e.change}`)
                .join(', ');
            // -----------------------------
            
            let titleText = item.description || '';
            if (bonusText) {
                titleText += `\n\n${t('gameInterface.inventoryPanel.effectsLabel')}: ${bonusText}`;
            }
            slotElement.title = titleText;

        } else {
            slotElement.classList.remove('equipped');
            slotElement.title = t(`gameInterface.equipmentPanel.slots.${slot}`, null, slot);
        }
    });
}

/**
 * Рассчитывает эффективные характеристики персонажа, учитывая базовые статы,
 * бонусы от экипировки и временные эффекты.
 * @returns {{effectiveStats: object, bonuses: object}} Объект с итоговыми характеристиками и бонусами.
 */
function getEffectiveStats() {
    if (!player) return { effectiveStats: {}, bonuses: {} };

    const baseStats = structuredClone(player.stats);
    const effectiveStats = structuredClone(player.stats);
    const bonuses = {};

    // 1. Применяем эффекты от экипированных предметов
    // Новая логика: итерируемся по слотам в player.equipment
    for (const slot in player.equipment) {
        const item = player.equipment[slot];
        if (item && Array.isArray(item.effects)) {
            item.effects.forEach(effect => {
                if (effect.type === 'modify_stat' && typeof effectiveStats[effect.stat] === 'number') {
                    const change = Number(effect.change) || 0;
                    effectiveStats[effect.stat] += change;
                    bonuses[effect.stat] = (bonuses[effect.stat] || 0) + change;
                }
            });
        }
    }
    
    // 2. (Задел на будущее) Здесь можно применить эффекты от баффов/дебаффов.
    // Это гарантирует правильный порядок применения: сначала постоянные бонусы, потом временные.

    // Пересчет зависимых характеристик
    effectiveStats.maxHp = calculateMaxHp(effectiveStats.con);
    if (effectiveStats.class === 'mage') {
        effectiveStats.maxMana = calculateMaxMana(effectiveStats.int, effectiveStats.level);
    }

    return { effectiveStats, bonuses };
}

function updateTraitsDisplay() {
    if (!player || !traitsList) return;
    traitsList.innerHTML = '';
    const playerTraits = Object.values(player.traits || {});

    if (playerTraits.length === 0) {
        traitsList.innerHTML = `<li data-i18n="gameInterface.traitsPanel.empty">Нет особых черт</li>`;
        return;
    }

    // Группировка по категориям
    const groupedTraits = playerTraits.reduce((acc, trait) => {
        const category = trait.category || 'Прочее';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(trait);
        return acc;
    }, {});

    for (const category in groupedTraits) {
        const categoryHeader = document.createElement('li');
        categoryHeader.className = 'category-header'; // Можно добавить стили для заголовков
        categoryHeader.textContent = category;
        traitsList.appendChild(categoryHeader);

        groupedTraits[category].forEach(trait => {
            const li = document.createElement('li');
            li.title = trait.description;
            let valueDisplay = '';
            if (trait.type === 'numeric') {
                valueDisplay = ` (Ранг: ${trait.value})`;
            } else if (trait.type === 'text') {
                valueDisplay = `: ${trait.value}`;
            }
            li.innerHTML = `<span class="trait-name">${trait.name}</span><span class="trait-value">${valueDisplay}</span>`;
            traitsList.appendChild(li);
        });
    }
}

function updateHoldingsDisplay() {
    if (!player || !holdingsList) return;
    holdingsList.innerHTML = '';
    const playerHoldings = Object.values(player.holdings || {});

    if (playerHoldings.length === 0) {
        holdingsList.innerHTML = `<li data-i18n="gameInterface.holdingsPanel.empty">Нет владений</li>`;
        return;
    }
    
    // Группировка по категориям
    const groupedHoldings = playerHoldings.reduce((acc, holding) => {
        const category = holding.category || 'Прочее';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(holding);
        return acc;
    }, {});

    for (const category in groupedHoldings) {
        const categoryHeader = document.createElement('li');
        categoryHeader.className = 'category-header';
        categoryHeader.textContent = category;
        holdingsList.appendChild(categoryHeader);

        groupedHoldings[category].forEach(holding => {
            const li = document.createElement('li');
            li.title = holding.description;
            li.innerHTML = `<span class="holding-name">${holding.name}</span><span class="holding-value">${holding.value}</span>`;
            holdingsList.appendChild(li);
        });
    }
}

// --- Система Сохранений / Загрузки ---












async function promptManualSave() {
    if (!player) return;

    const modal = document.getElementById('save-slot-modal');
    const container = document.getElementById('save-slots-container');
    const closeBtn = document.getElementById('close-save-modal-button');

    if (!modal || !container) {
        console.error("Модальное окно сохранения не найдено в HTML!");
        return;
    }

    // Очищаем контейнер
    container.innerHTML = '';

    // Получаем список сохранений (Electron или LocalStorage)
    let currentSaves = [];
    if (window.electronAPI && window.electronAPI.isElectron) {
        try {
            const allFiles = await window.electronAPI.listSaves();
            currentSaves = allFiles.filter(f => f.filename.includes('_manual_'));
        } catch (e) { console.error(e); }
    } else {
        const ls = getAllSavesFromLocalStorage();
        currentSaves = ls.manual || [];
    }

    // Генерируем 5 кнопок для слотов
    for (let i = 1; i <= MAX_MANUAL_SAVES; i++) {
        const btn = document.createElement('button');
        btn.className = 'save-slot-btn';
        
        // Ищем сохранение для этого слота
        // Для Electron парсим имя файла, для LS смотрим объект
        let existingInfo = null;
        
        if (window.electronAPI && window.electronAPI.isElectron) {
            const file = currentSaves.find(f => f.filename.includes(`_manual_${i}.json`));
            if (file) {
                // Если данные пришли из listSaves, там могут быть timestamp и playerData
                // Если нет, придется полагаться на дату изменения файла или просто писать "Занято"
                const dateStr = file.timestamp ? new Date(file.timestamp).toLocaleString() : "Занято";
                const name = file.playerData?.name || "Герой";
                const lvl = file.playerData?.stats?.level || "?";
                existingInfo = `${name} (Ур.${lvl}) - ${dateStr}`;
            }
        } else {
            const save = currentSaves.find(s => s.slotId === i);
            if (save) {
                const dateStr = new Date(save.timestamp).toLocaleString();
                existingInfo = `${save.playerData.name} (Ур.${save.playerData.stats.level}) - ${dateStr}`;
            }
        }

        const infoText = existingInfo || "Пустой слот";
        
        btn.innerHTML = `
            <span class="save-slot-id">Слот ${i}</span>
            <span class="save-slot-info">${infoText}</span>
        `;

        // Обработка клика по слоту
        btn.onclick = async () => {
            if (existingInfo) {
                if (!confirm(`Перезаписать слот ${i}?\n(${infoText})`)) return;
            }
            
            // Сохраняем
            const success = await saveGame('manual', i);
            
            if (success) {
                showCustomAlert(`Игра успешно сохранена в слот ${i}!`);
                modal.style.display = 'none'; // Закрываем окно
                modal.classList.remove('visible');
            }
        };

        container.appendChild(btn);
    }

    // Показываем окно
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('visible'), 10);

    // Логика закрытия
    const closeModal = () => {
        modal.classList.remove('visible');
        setTimeout(() => modal.style.display = 'none', 300);
    };
    
    // Удаляем старые слушатели, чтобы не дублировались
    const newCloseBtn = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
    
    newCloseBtn.addEventListener('click', closeModal);
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };
}

/**
 * (НОВАЯ ФУНКЦИЯ) Сохраняет хэндл директории в IndexedDB для постоянного хранения.
 * @param {FileSystemDirectoryHandle} dirHandle Хэндл для сохранения.
 */
async function saveDirectoryHandleToDB(dirHandle) {
    if (!window.indexedDB) {
        console.warn("IndexedDB не поддерживается. Хэндл не будет сохранен.");
        return;
    }
    const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("FileSystemDB", 1);
        request.onupgradeneeded = () => request.result.createObjectStore("handles");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    const tx = db.transaction("handles", "readwrite");
    await tx.objectStore("handles").put(dirHandle, "saveDirectory");
    await tx.done;
    console.log("Хэндл директории сохранен в IndexedDB.");
}

/**
 * Настраивает управление интерактивной картой (панорамирование и зум).
 */
function setupMapControls() {
    if (mapControlsInitialized || !mapCanvas || !mapTooltipElement) return;

    console.log("Инициализация управления картой...");

    const handleMouseDown = (e) => {
        mapState.isDragging = true;
        mapState.lastMouseX = e.offsetX;
        mapState.lastMouseY = e.offsetY;
        mapCanvas.style.cursor = 'grabbing';
    };

    const handleMouseUp = () => {
        mapState.isDragging = false;
        mapCanvas.style.cursor = 'grab';
    };

    const handleMouseLeave = () => {
        mapState.isDragging = false;
        hoveredMapPoint = null;
        mapCanvas.style.cursor = 'default';
        mapTooltipElement.style.display = 'none';
        mapTooltipElement.style.opacity = '0';
        renderVisualMap();
    };

    const handleMouseMove = (e) => {
        if (mapState.isDragging) {
            const dx = e.offsetX - mapState.lastMouseX;
            const dy = e.offsetY - mapState.lastMouseY;
            mapState.offsetX += dx;
            mapState.offsetY += dy;
            
            // Ограничение при перетаскивании
            const maxOffset = 3000 * mapState.zoom;
            mapState.offsetX = Math.max(Math.min(mapState.offsetX, maxOffset), -maxOffset + mapCanvas.width);
            mapState.offsetY = Math.max(Math.min(mapState.offsetY, maxOffset), -maxOffset + mapCanvas.height);

            mapState.lastMouseX = e.offsetX;
            mapState.lastMouseY = e.offsetY;
            mapTooltipElement.style.display = 'none';
            mapTooltipElement.style.opacity = '0';
        } else {
            const worldCoords = screenToWorld(e.offsetX, e.offsetY);
            let pointFound = null;
            let closestDist = 15 / mapState.zoom;
            let allPoints = [...Object.values(globalLocations || {}), ...Object.values(player?.mapMarkers || {})]
                .filter(loc => loc && typeof loc.x === 'number' && typeof loc.y === 'number');

            for (const point of allPoints) {
                const dist = Math.hypot(point.x - worldCoords.x, point.y - worldCoords.y);
                if (dist < closestDist) {
                    pointFound = point;
                    closestDist = dist;
                }
            }
            
            hoveredMapPoint = pointFound;

            if (pointFound) {
                mapCanvas.style.cursor = 'pointer';
                mapTooltipElement.innerHTML = `<h4>${pointFound.name}</h4><p>${pointFound.description || ''}</p>`;
                mapTooltipElement.style.display = 'block';
                mapTooltipElement.style.opacity = '1';
                
                let newX = e.clientX + 15;
                let newY = e.clientY + 15;
                
                if (newX + mapTooltipElement.offsetWidth > window.innerWidth) newX = e.clientX - mapTooltipElement.offsetWidth - 15;
                if (newY + mapTooltipElement.offsetHeight > window.innerHeight) newY = e.clientY - mapTooltipElement.offsetHeight - 15;

                mapTooltipElement.style.left = `${newX}px`;
                mapTooltipElement.style.top = `${newY}px`;
            } else {
                mapCanvas.style.cursor = 'grab';
                mapTooltipElement.style.display = 'none';
                mapTooltipElement.style.opacity = '0';
            }
        }
        renderVisualMap();
    };

    const handleWheel = (e) => {
        e.preventDefault();
        const zoomIntensity = 0.1;
        const scroll = e.deltaY < 0 ? 1 : -1;
        const zoomFactor = Math.exp(scroll * zoomIntensity);
        const newZoom = Math.max(0.1, Math.min(5, mapState.zoom * zoomFactor));
        const mouseX = e.offsetX;
        const mouseY = e.offsetY;
        const worldX = (mouseX - mapState.offsetX) / mapState.zoom;
        const worldY = (mouseY - mapState.offsetY) / mapState.zoom;
        mapState.offsetX = mouseX - worldX * newZoom;
        mapState.offsetY = mouseY - worldY * newZoom;
        mapState.zoom = newZoom;
        renderVisualMap();
    };

    // Привязываем события
    mapCanvas.addEventListener('mousedown', handleMouseDown);
    mapCanvas.addEventListener('mouseup', handleMouseUp);
    mapCanvas.addEventListener('mouseleave', handleMouseLeave);
    mapCanvas.addEventListener('mousemove', handleMouseMove);
    mapCanvas.addEventListener('wheel', handleWheel);

    // Устанавливаем флаг, что все готово
    mapControlsInitialized = true;
    console.log("Управление картой успешно инициализировано ОДИН РАЗ.");
}

/**
 * Преобразует экранные координаты в мировые.
 */


/**
 * Определяет тип локации по ее названию для выбора иконки.
 */


/**
 * Рисует маркер на карте в зависимости от его типа.
 */
// --- ЗАГЛУШКИ ДЛЯ ОТКЛЮЧЕННЫХ ДЕКОРАЦИЙ (ЧИСТЫЙ ТАЙЛОВЫЙ ТИРРЕЙН) ---
function drawMountain() {}
function drawTree() {}

function drawMapMarker(ctx, pos, type, isPlayer, isHovered = false) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#2c3e50'; 
    ctx.fillStyle = '#ecf0f1'; 

    if (isPlayer) {
        ctx.fillStyle = '#e74c3c'; // Красный маркер игрока
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.stroke();
        
        // Пульсирующее кольцо
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 12, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(231, 76, 60, 0.5)';
        ctx.stroke();
    } else {
        ctx.beginPath();
        if (type === 'city') {
            ctx.fillStyle = '#bdc3c7';
            ctx.rect(pos.x - 8, pos.y - 6, 16, 12);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#c0392b'; // Красная крыша
            ctx.beginPath();
            ctx.moveTo(pos.x - 10, pos.y - 6);
            ctx.lineTo(pos.x, pos.y - 14);
            ctx.lineTo(pos.x + 10, pos.y - 6);
            ctx.fill();
            ctx.stroke();
        } else if (type === 'mountain') {
            ctx.fillStyle = '#7f8c8d';
            ctx.beginPath();
            ctx.moveTo(pos.x - 8, pos.y + 6);
            ctx.lineTo(pos.x, pos.y - 8);
            ctx.lineTo(pos.x + 8, pos.y + 6);
            ctx.fill();
            ctx.stroke();
        } else {
            ctx.fillStyle = '#27ae60';
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 6, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
        }
    }
}

/**
 * Рисует компас в углу карты.
 */


/**
 * (НОВАЯ ФУНКЦИЯ) Загружает хэндл директории из IndexedDB.
 * @returns {Promise<FileSystemDirectoryHandle|null>}
 */
async function getDirectoryHandleFromDB() {
    if (!window.indexedDB) return null;
    try {
        const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open("FileSystemDB", 1);
            request.onupgradeneeded = () => request.result.createObjectStore("handles");
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        const tx = db.transaction("handles", "readonly");
        const handle = await tx.objectStore("handles").get("saveDirectory");
        await tx.done;
        if (handle) {
            console.log("Хэндл директории успешно загружен из IndexedDB.");
        }
        return handle;
    } catch (error) {
        console.error("Ошибка при загрузке хэндла из IndexedDB:", error);
        return null;
    }
}

async function autoSaveGame() {
    if (!player || !gameInterface.classList.contains('active-screen')) return;

    let nextAutoSaveId = 1;

    // --- ЖЕСТКАЯ ЛОГИКА ---
    if (window.electronAPI && window.electronAPI.isElectron) {
        const autoSaves = (await listSaveFilesFromFSA()).filter(s => s.slotType === 'auto');
        if (autoSaves.length > 0) {
            if (autoSaves.length < MAX_AUTO_SAVES) {
                const usedIds = new Set(autoSaves.map(s => s.slotId));
                for(let i = 1; i <= MAX_AUTO_SAVES + 1; i++) { if (!usedIds.has(i)) { nextAutoSaveId = i; break; } }
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
                for(let i = 1; i <= MAX_AUTO_SAVES + 1; i++) { if (!usedIds.has(i)) { nextAutoSaveId = i; break; } }
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

function handleBeforeUnload(event) {
    if (player && gameInterface.classList.contains('active-screen')) {
        console.log("Beforeunload: Попытка финального автосохранения...");
        // Не ждем await, т.к. beforeunload синхронен
        // Сохранение произойдет в ФС, если handle есть, иначе в LS.
        autoSaveGame().catch(err => console.error("Ошибка автосохранения в beforeunload:", err));
    }
    stopAutoSaveTimer();
    stopBackgroundChanger();
    pauseMusic();
    if (speechSynthesis && speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }
}

// --- Выход из игры ---
async function exitToMainMenu() {
    console.log("Запрос выхода в меню.");
    closeInGameMenu();
    playMenuMusic(); 

    const performExit = () => {
        stopAutoSaveTimer();
        pauseMusic();
        if (speechSynthesis && speechSynthesis.speaking) {
            speechSynthesis.cancel();
        }
        player = null;
        conversationHistory = [];
        currentSaveSlot = null;
        if(gameLog) gameLog.innerHTML = `<p class="system-message" data-i18n="gameInterface.log.loading">${t('gameInterface.log.loading')}</p>`;

        if (gameInterface) {
             gameInterface.style.display = 'none';
             gameInterface.classList.remove('active-screen');
        }
        
        // --- СБРОС ФЛАГОВ КАРТЫ ПРИ ВЫХОДЕ ---
        isMapInitialized = false; 
        // mapControlsInitialized = false; // ЭТО УДАЛИТЬ, ТАК КАК КОНТРОЛЫ УСТАНАВЛИВАЮТСЯ РАЗ И НАВСЕГДА

        setActiveScreen('main-menu');
        updateDynamicUIText();
        
        if (document.activeElement) document.activeElement.blur();
    };

    if (player) {
        showCustomConfirm(
            t("gameInterface.log.exitConfirm"),
            async () => {
                await autoSaveGame(); 
                performExit();
            }
        );
    } else {
        performExit();
    }
}

// --- Функции Управления Фоном ---
function changeBackground() {
    if (!backgroundContainer || backgroundFiles.length === 0) {
        console.warn("Контейнер фона или список файлов отсутствует/пуст.");
        return;
    }

    let randomIndex;
    if (backgroundFiles.length > 1) {
        do { randomIndex = Math.floor(Math.random() * backgroundFiles.length); }
        while (randomIndex === lastBackgroundIndex);
    } else { randomIndex = 0; }
    lastBackgroundIndex = randomIndex;

    const fileName = backgroundFiles[randomIndex];
    const filePath = `assets/fone/${fileName}`;
    const fileExtension = fileName.split('.').pop().toLowerCase();
    const isVideo = ['mp4', 'webm', 'ogv'].includes(fileExtension);

    console.log(`Смена фона на: ${filePath}`);

    const newElement = document.createElement(isVideo ? 'video' : 'img');
    newElement.src = filePath;
    newElement.dataset.fileName = fileName; // Для отладки

    newElement.addEventListener('error', (e) => {
         console.error(`Ошибка загрузки медиа фона: ${fileName}`, e);
         if (newElement.parentNode === backgroundContainer) backgroundContainer.removeChild(newElement);
         if (currentBackgroundElement === newElement) {
             currentBackgroundElement = null;
             // Удаляем битый файл из списка, чтобы не пытаться загрузить его снова
             const failedIndex = backgroundFiles.indexOf(fileName);
             if (failedIndex > -1) backgroundFiles.splice(failedIndex, 1);
             setTimeout(changeBackground, 1000); // Попробовать другой фон через секунду
         }
     });

    if (isVideo) {
        newElement.autoplay = true;
        newElement.muted = true;
        newElement.loop = true;
        newElement.playsInline = true; // Для iOS
        newElement.setAttribute('preload', 'auto');
        newElement.addEventListener('loadeddata', () => showNewBackground(newElement), { once: true });
    } else { // img
        newElement.onload = () => showNewBackground(newElement);
    }

    backgroundContainer.appendChild(newElement); // Добавляем новый элемент в контейнер
}

function showNewBackground(elementToShow) {
     if (!elementToShow || elementToShow.parentNode !== backgroundContainer) {
         // Элемент мог быть удален из-за ошибки загрузки до вызова этой функции
         console.warn("showNewBackground: элемент не найден в контейнере или отсутствует.");
         return;
     }

     const oldElement = currentBackgroundElement;
     currentBackgroundElement = elementToShow; // Новый элемент становится текущим

     requestAnimationFrame(() => { // Плавное появление
         elementToShow.classList.add('visible');
     });

     if (oldElement && oldElement !== elementToShow) { // Если был старый фон и он не тот же самый
         oldElement.classList.remove('visible'); // Плавное исчезновение старого
         const removeOldElement = () => {
             if (oldElement && oldElement.parentNode === backgroundContainer) {
                 backgroundContainer.removeChild(oldElement);
                 // console.log("Удален старый фон:", oldElement.dataset.fileName);
             }
         };
         // Удаляем старый элемент после завершения анимации исчезновения
         oldElement.addEventListener('transitionend', removeOldElement, { once: true });
         // Fallback, если transitionend не сработает (например, если элемент был скрыт display:none)
         setTimeout(removeOldElement, 2000); // 2 секунды
     }
}

function startBackgroundChanger() {
    stopBackgroundChanger();
    if (backgroundFiles.length > 0) {
        changeBackground(); // Показать первый фон сразу
        if (backgroundFiles.length > 1 && BACKGROUND_CHANGE_INTERVAL > 0) {
            backgroundChangeTimer = setInterval(changeBackground, BACKGROUND_CHANGE_INTERVAL);
            console.log(`Смена фона запущена с ${backgroundFiles.length} файлами.`);
        }
    } else {
        console.warn("Не удается запустить смену фона: массив backgroundFiles пуст.");
        if(backgroundContainer) backgroundContainer.style.backgroundColor = '#1a2530'; // Fallback цвет
    }
}

function stopBackgroundChanger() {
    if (backgroundChangeTimer) {
        clearInterval(backgroundChangeTimer);
        backgroundChangeTimer = null;
        console.log("Смена фона остановлена.");
    }
}

// ЭФФЕКТ ПАРАЛЛАКСА ДЛЯ ФОНА
document.addEventListener('mousemove', (e) => {
    // Убрали проверку if (!player), теперь работает всегда
    const moveX = (e.clientX - window.innerWidth / 2) * 0.01; // Смещение 1%
    const moveY = (e.clientY - window.innerHeight / 2) * 0.01;

    // Устанавливаем CSS переменные
    document.documentElement.style.setProperty('--parallax-x', `${-moveX}px`);
    document.documentElement.style.setProperty('--parallax-y', `${-moveY}px`);
});

// Дополнительно: Тряска экрана при получении урона (вызывай эту функцию в executeCommand)
function shakeScreen() {
    const container = document.querySelector('.game-container');
    if (container) {
        container.style.animation = 'none';
        container.offsetHeight; // триггер перерисовки
        container.style.animation = 'goldShakeAnim 0.4s ease-in-out';
    }
}

// --- СИСТЕМА ЗВУКОВ ИНТЕРФЕЙСА ---
const hoverSfx = new Audio('assets/sound/ui_hover.mp3');
const clickSfx = new Audio('assets/sound/ui_click.mp3');

// Настройка громкости (чтобы не пугать игрока)
hoverSfx.volume = 0.1; 
clickSfx.volume = 0.2;

// Функция для проигрывания без задержек
function playSfx(audioObj) {
    audioObj.currentTime = 0; // Сброс в начало, чтобы можно было спамить звуком
    audioObj.play().catch(() => {}); // Игнорируем ошибки автоплея
}

// Глобальный слушатель наведения
document.addEventListener('mouseover', (e) => {
    // Проверяем, является ли элемент кнопкой или находится ли он внутри кнопки/слота/вкладки
    const target = e.target.closest('button, .equipment-slot-v2, .tab-button, .save-slot-btn, .tag-chip, li.quest-item, li[data-item-id]');
    
    if (target) {
        playSfx(hoverSfx);
    }
}, true);

// Глобальный слушатель клика
document.addEventListener('mousedown', (e) => {
    const target = e.target.closest('button, .equipment-slot-v2, .tab-button, .save-slot-btn, .tag-chip, li.quest-item, li[data-item-id]');
    
    if (target) {
        playSfx(clickSfx);
    }
}, true);

// --- Запуск приложения ---

function renderVisualMap() {
    if (!mapContext || !mapCanvas) return;

    const ctx = mapContext;
    const width = mapCanvas.width;
    const height = mapCanvas.height;

    // Центрируем карту при первой отрисовке
    if (!isMapInitialized && player) {
        const playerLocName = player.location;
        const allPoints = [...Object.values(globalLocations || {}), ...Object.values(player.mapMarkers || {})];
        const playerPoint = allPoints.find(p => p.name === playerLocName);

        if (playerPoint) {
            mapState.offsetX = (width / 2) - (playerPoint.x * mapState.zoom);
            mapState.offsetY = (height / 2) - (playerPoint.y * mapState.zoom);
        } else {
            mapState.offsetX = width / 2;
            mapState.offsetY = height / 2;
        }
        isMapInitialized = true;
    }

    // Очистка и фон "пергамента"
    ctx.fillStyle = '#f3e5ab';
    ctx.fillRect(0, 0, width, height);

    const transform = (worldX, worldY) => ({
        x: (worldX * mapState.zoom) + mapState.offsetX,
        y: (worldY * mapState.zoom) + mapState.offsetY
    });
    
    // Сетка
    ctx.strokeStyle = 'rgba(93, 74, 54, 0.15)';
    ctx.lineWidth = 1;
    const gridSize = 50 * mapState.zoom;
    for (let x = mapState.offsetX % gridSize; x < width; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = mapState.offsetY % gridSize; y < height; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
    
    // Отрисовка всех точек
    let allPoints = [
        ...Object.values(globalLocations || {}),
        ...Object.values(player?.mapMarkers || {})
    ].filter(loc => loc && typeof loc.x === 'number' && typeof loc.y === 'number');

    // Пунктирные дороги (простые)
    ctx.strokeStyle = 'rgba(93, 74, 54, 0.4)';
    ctx.setLineDash([5, 5]);
    allPoints.forEach(p1 => {
        let distances = allPoints.map(p2 => ({ point: p2, dist: Math.hypot(p1.x - p2.x, p1.y - p2.y) }))
                                 .filter(d => d.dist > 0).sort((a, b) => a.dist - b.dist);
        const pos1 = transform(p1.x, p1.y);
        distances.slice(0, 2).forEach(d => {
            const pos2 = transform(d.point.x, d.point.y);
            ctx.beginPath(); ctx.moveTo(pos1.x, pos1.y); ctx.lineTo(pos2.x, pos2.y); ctx.stroke();
        });
    });
    ctx.setLineDash([]);

    allPoints.forEach(point => {
        const pos = transform(point.x, point.y);
        if (pos.x < -20 || pos.x > width + 20 || pos.y < -20 || pos.y > height + 20) return;

        const isPlayerLocation = player && player.location === point.name;
        const isHovered = hoveredMapPoint && hoveredMapPoint.name === point.name;
        const type = getLocationType(point.name);

        drawMapMarker(ctx, pos, type, isPlayerLocation);

        if (isHovered && !isPlayerLocation) {
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        const fontSize = Math.max(8, Math.min(22, 12 * mapState.zoom));
        ctx.font = (isPlayerLocation || isHovered ? 'bold' : '') + ' ' + fontSize + "px 'Georgia', serif";
        ctx.fillStyle = isHovered ? '#000000' : '#5D4A36';
        ctx.textAlign = 'center';
        ctx.fillText(point.name.split('(')[0].trim(), pos.x, pos.y + 12 + fontSize * 0.5);
    });

    drawCompassRose(ctx, width - 30, 30, 15);
}

function screenToWorld(screenX, screenY) {
    return {
        x: (screenX - mapState.offsetX) / mapState.zoom,
        y: (screenY - mapState.offsetY) / mapState.zoom
    };
}

function getLocationType(name) {
    const lowerName = name.toLowerCase();
    if (['город', 'столица', 'цитадель', 'гавань', 'поселение', 'city', 'citadel', 'haven'].some(s => lowerName.includes(s))) return 'city';
    if (['горы', 'хребет', 'пик', 'mountains', 'ridge', 'peak'].some(s => lowerName.includes(s))) return 'mountain';
    if (['лес', 'роща', 'woods', 'forest'].some(s => lowerName.includes(s))) return 'natural';
    return 'default';
}



function drawCompassRose(ctx, x, y, radius) {
    ctx.strokeStyle = 'rgba(93, 74, 54, 0.7)';
    ctx.fillStyle = 'rgba(93, 74, 54, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y - radius); ctx.lineTo(x, y + radius);
    ctx.moveTo(x - radius, y); ctx.lineTo(x + radius, y);
    ctx.stroke();
    ctx.font = 'bold ' + (radius * 0.7) + "px Georgia, serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', x, y - radius - 8);
    ctx.fillText('S', x, y + radius + 8);
    ctx.fillText('W', x - radius - 8, y);
    ctx.fillText('E', x + radius + 8, y);
}


// --- ЭФФЕКТ ПАРАЛЛАКСА И АТМОСФЕРА ---
document.addEventListener('mousemove', (e) => {
    const moveX = (e.clientX - window.innerWidth / 2) * 0.01;
    const moveY = (e.clientY - window.innerHeight / 2) * 0.01;
    document.documentElement.style.setProperty('--parallax-x', `${-moveX}px`);
    document.documentElement.style.setProperty('--parallax-y', `${-moveY}px`);
});
document.addEventListener('DOMContentLoaded', initializeApp);