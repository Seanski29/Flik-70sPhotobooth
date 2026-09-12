const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { fork } = require('child_process');
const path = require('path');

let mainWindow;
let serverProcess;
let isQuitting = false;

ipcMain.handle('toggle-fullscreen', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return false;
    window.setFullScreen(!window.isFullScreen());
    return window.isFullScreen();
});

function createWindow() {
    // 1. Start your backend server silently in the background
    // Pointing to your specific path: src/js/server.js
    const boothDataFolder = path.join(app.getPath('home'), 'Fik-70sPhotobooth');
    const serverEnv = app.isPackaged
        ? {
            ...process.env,
            // Keep booth media beside the booth installation when it exists.
            // This also makes the same installation portable between PCs.
            FLIK_DATA_DIR: process.env.FLIK_DATA_DIR || (
                require('fs').existsSync(boothDataFolder)
                    ? boothDataFolder
                    : path.join(app.getPath('userData'), 'data')
            )
        }
        : process.env;
    serverProcess = fork(path.join(__dirname, 'src', 'js', 'server.js'), [], { env: serverEnv });
    let loginLoaded = false;

    const loadLoginPage = () => {
        if (loginLoaded || !mainWindow || mainWindow.isDestroyed()) return;
        loginLoaded = true;
        mainWindow.loadFile(path.join(__dirname, 'src', 'html', 'login.html'));
    };

    serverProcess.on('message', (message) => {
        if (message && message.type === 'server-ready') loadLoginPage();
    });

    serverProcess.on('error', (error) => {
        console.error('FLIK backend failed to start:', error);
        if (mainWindow && !mainWindow.isDestroyed()) {
            dialog.showErrorBox('FLIK Backend Error', `The local backend could not start.\n\n${error.message}`);
        }
    });

    serverProcess.on('exit', (code) => {
        if (!isQuitting && code !== 0 && mainWindow && !mainWindow.isDestroyed()) {
            dialog.showErrorBox('FLIK Backend Stopped', 'The local backend stopped unexpectedly. Please restart FLIK.');
        }
    });

    // 2. Create the Desktop Window
    mainWindow = new BrowserWindow({
        width: 1366,
        height: 768,
        minWidth: 1024,
        minHeight: 720,
        title: "FLIK Photo Booth",
        autoHideMenuBar: true, // Hides the standard web browser File/Edit menu
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.on('close', (event) => {
        if (isQuitting) return;

        event.preventDefault();
        dialog.showMessageBox(mainWindow, {
            type: 'question',
            buttons: ['Yes', 'No'],
            defaultId: 1,
            cancelId: 1,
            title: 'Exit FLIK',
            message: 'Do you want to exit the application?',
            detail: 'All saved changes will be kept.'
        }).then(({ response }) => {
            if (response === 0) {
                isQuitting = true;
                mainWindow.close();
            }
        });
    });

    // Load the UI after the backend confirms that its HTTP server is ready.
    setTimeout(loadLoginPage, 5000);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Launch app when ready
app.whenReady().then(createWindow);

// Kill the Node background process cleanly when closing the app
// --- BULLETPROOF SHUTDOWN SEQUENCE ---

// Right before the app quits, stop the background server.
app.on('will-quit', () => {
    if (serverProcess) {
        serverProcess.kill('SIGINT');
        const { exec } = require('child_process');
        if (process.platform === 'win32') {
            exec(`taskkill /F /PID ${serverProcess.pid}`, () => {});
        }
    }
});