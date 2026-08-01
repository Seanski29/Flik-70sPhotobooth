const { app, BrowserWindow } = require('electron');
const { fork } = require('child_process');
const path = require('path');

let mainWindow;
let serverProcess;

function createWindow() {
    // 1. Start your backend server silently in the background
    // Pointing to your specific path: src/js/server.js
    serverProcess = fork(path.join(__dirname, 'src', 'js', 'server.js'));

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
            contextIsolation: true
        }
    });

    // 3. Load the Login Page FIRST
    // Pointing to your specific path: src/html/login.html
    setTimeout(() => {
        mainWindow.loadFile(path.join(__dirname, 'src', 'html', 'login.html'));
    }, 1500); // 1.5-second delay ensures the server is fully running before the UI loads

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Launch app when ready
app.whenReady().then(createWindow);

// Kill the Node background process cleanly when closing the app
// --- BULLETPROOF SHUTDOWN SEQUENCE ---

// 1. When all windows are closed, quit the app completely
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// 2. Right before the app quits, assassinate the background server
app.on('will-quit', () => {
    if (serverProcess) {
        // Standard polite kill
        serverProcess.kill('SIGINT'); 
        
        // Aggressive Windows force-kill (The programmatic version of what you just did in the terminal)
        const { exec } = require('child_process');
        if (process.platform === 'win32') {
            exec(`taskkill /F /PID ${serverProcess.pid}`, (err) => {
                // We don't care about errors here, we just want it dead.
            });
        }
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});