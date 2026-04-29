const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Проверка, что мы в Electron
    isElectron: true,
    
    // Методы для работы с файлами (вызывают функции из main.js)
    saveGame: (filename, data) => ipcRenderer.invoke('save-game', filename, data),
    loadGame: (filename) => ipcRenderer.invoke('load-game', filename),
    listSaves: () => ipcRenderer.invoke('list-saves'),
    deleteSave: (filename) => ipcRenderer.invoke('delete-save', filename),

    // Метод для прямого запроса к Gemini API через main процесс
    sendGeminiRequest: (model, apiKey, contents) => ipcRenderer.invoke('gemini-request', model, apiKey, contents)
,
    getSavePath: () => ipcRenderer.invoke('get-save-path')
});