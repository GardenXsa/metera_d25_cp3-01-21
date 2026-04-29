const { app, BrowserWindow, ipcMain, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

// Настройка путей
const USER_DATA = app.getPath('userData');
const SAVES_DIR = path.join(USER_DATA, 'saves');
const SETTINGS_FILE = path.join(USER_DATA, 'settings.json');

if (!fs.existsSync(SAVES_DIR)) fs.mkdirSync(SAVES_DIR, { recursive: true });

// ФИКСИРОВАННЫЙ ПОРТ (чтобы настройки LocalStorage не слетали)
const PORT = 30007; 

function isSafeFileName(filename) {
    return /^[a-zA-Z0-9_-]+\.json$/.test(filename);
}

// Встроенный сервер (теперь на фиксированном порту)
const server = http.createServer((req, res) => {
    let urlPath = decodeURI(req.url.split('?')[0]);
    let filePath = path.join(__dirname, urlPath === '/' ? 'index.html' : urlPath);

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.statusCode = 404;
            res.end('Not Found');
            return;
        }
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
            '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpg',
            '.jpeg': 'image/jpeg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav'
        };
        res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(data);
    });
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`[SERVER] Static origin: http://127.0.0.1:${PORT}`);
});

function createWindow () {
  const win = new BrowserWindow({
    width: 1280, height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Для работы Puter.js
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadURL(`http://127.0.0.1:${PORT}`);
}

app.whenReady().then(createWindow);

// --- СИСТЕМА СОХРАНЕНИЙ И НАСТРОЕК (СТРОГО В ФАЙЛЫ) ---

// Настройки (API ключи и т.д.)
ipcMain.handle('save-settings', async (event, data) => {
    try {
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (e) { return false; }
});

ipcMain.handle('load-settings', async () => {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
        }
    } catch (e) { return null; }
    return null;
});

// Игровые сохранения
ipcMain.handle('save-game', async (event, filename, data) => {
    if (!isSafeFileName(filename)) return { success: false };
    try {
        fs.writeFileSync(path.join(SAVES_DIR, filename), JSON.stringify(data, null, 2));
        return { success: true };
    } catch (error) { return { success: false }; }
});

ipcMain.handle('load-game', async (event, filename) => {
    if (!isSafeFileName(filename)) return null;
    try {
        const filePath = path.join(SAVES_DIR, filename);
        if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (e) { return null; }
});

ipcMain.handle('list-saves', async () => {
    try {
        const files = fs.readdirSync(SAVES_DIR).filter(f => f.endsWith('.json'));
        return files.map(file => {
            const data = JSON.parse(fs.readFileSync(path.join(SAVES_DIR, file), 'utf-8'));
            return { filename: file, timestamp: data.timestamp, playerData: data.playerData };
        });
    } catch (e) { return []; }
});

ipcMain.handle('delete-save', async (event, filename) => {
    if (!isSafeFileName(filename)) return false;
    try {
        const filePath = path.join(SAVES_DIR, filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return true;
        }
    } catch (e) { return false; }
    return false;
});

ipcMain.handle('speak-text', async (event, text, voiceModel) => {
    const { spawn } = require('child_process');
    const path = require('path');
    const fs = require('fs');

    return new Promise((resolve) => {
        let ttsDir;
        if (app.isPackaged) {
            ttsDir = path.join(process.resourcesPath, 'app.asar.unpacked', 'assets', 'tts');
        } else {
            ttsDir = path.join(__dirname, 'assets', 'tts');
        }
        
        const piperExe = path.join(ttsDir, process.platform === 'win32' ? 'piper.exe' : 'piper');
        const modelPath = path.join(ttsDir, voiceModel);
        const outputPath = path.join(app.getPath('temp'), `tts_${Date.now()}.wav`);

        if (!fs.existsSync(piperExe)) {
            resolve({ success: false, error: `Piper не найден: ${piperExe}` });
            return;
        }
        
        if (!fs.existsSync(modelPath)) {
            resolve({ success: false, error: `Модель не найдена: ${modelPath}` });
            return;
        }

        let errorOutput = '';

        const env = {
            ...process.env,
            ESPEAK_DATA_PATH: ttsDir
        };
        if (process.platform === 'win32') {
            env.PATH = `${ttsDir};${process.env.PATH || ''}`;
        } else {
            env.LD_LIBRARY_PATH = `${ttsDir}:${process.env.LD_LIBRARY_PATH || ''}`;
        }

        const piper = spawn(piperExe, [
            '--model', modelPath, 
            '--output_file', outputPath
        ], { 
            cwd: ttsDir, 
            env: env,
            windowsHide: true 
        });

        piper.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        piper.stdin.setDefaultEncoding('utf-8');
        piper.stdin.write(text);
        piper.stdin.end();

        piper.on('close', (code) => {
            if (code === 0) {
                resolve({ success: true, audioPath: `file://${outputPath}` });
            } else {
                console.error(`[Piper Error] Code: ${code}, Details: ${errorOutput}`);
                resolve({ success: false, error: `Piper exit code: ${code}. Details: ${errorOutput}` });
            }
        });
        
        piper.on('error', (err) => resolve({ success: false, error: err.message }));
    });
});



ipcMain.handle('gemini-request', async (event, model, apiKey, contents) => {
    const { net } = require('electron');
    return new Promise((resolve, reject) => {
        const requestBody = JSON.stringify({ contents, generationConfig: { maxOutputTokens: 8192, temperature: 0.8, topP: 0.95 }, safetySettings: [ { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" } ] });
        const request = net.request({
            method: 'POST', protocol: 'https:', hostname: 'generativelanguage.googleapis.com',
            path: `/v1beta/models/${model}:generateContent?key=${apiKey}`,
            headers: { 'Content-Type': 'application/json' }
        });
        request.on('response', (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve(JSON.parse(body)));
        });
        request.on('error', e => reject(e));
        request.write(requestBody);
        request.end();
    });
});