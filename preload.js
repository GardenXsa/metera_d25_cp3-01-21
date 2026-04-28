const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,
    saveGame: (filename, data) => ipcRenderer.invoke('save-game', filename, data),
    loadGame: (filename) => ipcRenderer.invoke('load-game', filename),
    listSaves: () => ipcRenderer.invoke('list-saves'),
    deleteSave: (filename) => ipcRenderer.invoke('delete-save', filename),

    initSaveFile: (filename) => ipcRenderer.invoke('init-save-file', filename),
    appendSaveLine: (filename, line) => ipcRenderer.invoke('append-save-line', filename, line),
    getFileSize: (filename) => ipcRenderer.invoke('get-file-size', filename),
    readSaveChunk: (filename, position, size) => ipcRenderer.invoke('read-save-chunk', filename, position, size),

    speakText: (text, voiceModel) => ipcRenderer.invoke('speak-text', text, voiceModel),
    sendGeminiRequest: (model, apiKey, contents) => ipcRenderer.invoke('gemini-request', model, apiKey, contents),
    getSavePath: () => ipcRenderer.invoke('get-save-path')
});