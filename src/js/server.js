const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { exec, execFile, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { SerialPort, ReadlineParser } = require('serialport');
const sharp = require('sharp');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    maxHttpBufferSize: 100 * 1024 * 1024
});

const PORT = 3001;
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const projectRoot = path.join(__dirname, '..', '..');
const bundledArchiveFolder = path.join(__dirname, '..', 'archive');
const bundledFramesFolder = path.join(projectRoot, 'assets', 'frames');
const dataRoot = process.env.FLIK_DATA_DIR
    ? path.resolve(process.env.FLIK_DATA_DIR)
    : path.join(__dirname, '..');
const masterFolder = path.join(dataRoot, 'archive');
const legacyArchiveFolders = [
    path.join(dataRoot, 'src', 'archive'),
    path.join(dataRoot, 'assets', 'archive')
];
const dataFramesFolder = path.join(dataRoot, 'frames');
const legacyFramesFolder = path.join(dataRoot, 'assets', 'frames');
const framesFolder = process.env.FLIK_DATA_DIR && fs.existsSync(legacyFramesFolder)
    ? legacyFramesFolder
    : dataFramesFolder;
const persistentConfigFolder = process.env.FLIK_DATA_DIR ? dataRoot : __dirname;
app.use('/archive', express.static(masterFolder)); 
legacyArchiveFolders.forEach(folder => app.use('/archive', express.static(folder)));
app.use('/archive', express.static(bundledArchiveFolder));
app.use('/frames', express.static(framesFolder));
app.use('/frames', express.static(legacyFramesFolder));
app.use('/frames', express.static(bundledFramesFolder));

if (!fs.existsSync(masterFolder)) fs.mkdirSync(masterFolder, { recursive: true });
if (!fs.existsSync(framesFolder)) fs.mkdirSync(framesFolder, { recursive: true });

// --- TERMINAL LOGGER ---
const MAX_LOGS = 100;
let terminalHistory = ['> System initialized. Awaiting hardware...'];

function addLog(msg) {
    terminalHistory.push(msg);
    if (terminalHistory.length > MAX_LOGS) {
        terminalHistory.shift(); 
    }
    io.emit('terminal_log', msg);
}

function normalizeSessionPrice(value) {
    const parsed = Number(value);
    const allowedPrices = [50, 100, 150, 200, 250, 300];
    return allowedPrices.includes(parsed) ? parsed : 200;
}

// --- PERSISTENT DATABASE SYSTEM ---
const statsFilePath = path.join(persistentConfigFolder, 'stats.json');
const configFilePath = path.join(persistentConfigFolder, 'config.json');
let totalRevenue = 0;
let totalSessions = 0;
let dailyRecords = [];
const DEFAULT_FILTERS = {
    NORMAL: { name: 'Normal', intensity: 100, grayscale: 0, sepia: 0, contrast: 100, brightness: 100, saturation: 100, hue: 0, invert: 0, blur: 0 },
    NOIR: { name: 'Noir', intensity: 100, grayscale: 100, sepia: 0, contrast: 140, brightness: 95, saturation: 100, hue: 0, invert: 0, blur: 0 },
    FILM_II: { name: 'Film II', intensity: 100, grayscale: 0, sepia: 20, contrast: 110, brightness: 100, saturation: 180, hue: -5, invert: 0, blur: 0 }
};
let appConfig = { targetPrinter: '', printerName: '', activeFrame: '', filters: DEFAULT_FILTERS, sessionPrice: 200 };

function normalizeFilter(filter, fallback) {
    const source = filter && typeof filter === 'object' ? filter : {};
    const number = (value, defaultValue, min, max) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : defaultValue;
    };
    return {
        name: typeof source.name === 'string' && source.name.trim() ? source.name.trim().slice(0, 40) : fallback.name,
        intensity: number(source.intensity, fallback.intensity, 0, 100),
        grayscale: number(source.grayscale, fallback.grayscale, 0, 100),
        sepia: number(source.sepia, fallback.sepia, 0, 100),
        contrast: number(source.contrast, fallback.contrast, 0, 300),
        brightness: number(source.brightness, fallback.brightness, 0, 300),
        saturation: number(source.saturation, fallback.saturation, 0, 300),
        hue: number(source.hue, fallback.hue, -180, 180),
        invert: number(source.invert, fallback.invert, 0, 100),
        blur: number(source.blur, fallback.blur, 0, 20)
    };
}

function normalizeFilters(filters) {
    return Object.keys(DEFAULT_FILTERS).reduce((result, key) => {
        result[key] = normalizeFilter(filters && filters[key], DEFAULT_FILTERS[key]);
        return result;
    }, {});
}

function loadConfig() {
    try {
        if (fs.existsSync(configFilePath)) {
            appConfig = { ...appConfig, ...JSON.parse(fs.readFileSync(configFilePath, 'utf8')) };
            appConfig.targetPrinter = appConfig.targetPrinter || appConfig.printerName || '';
            appConfig.printerName = appConfig.targetPrinter;
            appConfig.filters = normalizeFilters(appConfig.filters);
            appConfig.sessionPrice = normalizeSessionPrice(appConfig.sessionPrice);
        } else {
            saveConfig();
        }
    } catch (err) {
        console.error('Failed to read config.json:', err);
        appConfig = { targetPrinter: '', printerName: '', activeFrame: '', filters: normalizeFilters(), sessionPrice: 200 };
    }
}

function saveConfig() {
    try {
        fs.writeFileSync(configFilePath, JSON.stringify(appConfig, null, 2));
    } catch (err) {
        console.error('Failed to save config:', err);
    }
}

loadConfig();

function loadStats() {
    try {
        if (fs.existsSync(statsFilePath)) {
            const data = JSON.parse(fs.readFileSync(statsFilePath, 'utf8'));
            if (Array.isArray(data.dailyRecords)) {
                dailyRecords = data.dailyRecords
                    .filter(record => record && typeof record.date === 'string')
                    .map(record => ({
                        date: record.date,
                        revenue: Number(record.revenue) || 0,
                        sessions: Number(record.sessions) || 0
                    }));
            } else if (Number(data.totalRevenue) || Number(data.totalSessions)) {
                dailyRecords = [{
                    date: formatDate(new Date()),
                    revenue: Number(data.totalRevenue) || 0,
                    sessions: Number(data.totalSessions) || 0
                }];
            }
            refreshTotals();
            addLog(`>  Loaded historical data: ${totalRevenue} PHP / ${totalSessions} Sessions`);
        }
    } catch (err) {
        addLog(">  Failed to read stats.json. Starting fresh.");
    }
}
function saveStats() {
    try {
        fs.writeFileSync(statsFilePath, JSON.stringify({ dailyRecords }, null, 2));
    } catch (err) {
        console.error("Failed to save stats:", err);
    }
}
loadStats();

// --- STATE VARIABLES ---
let currentSessionPhotos = [];
let activeFilter = 'NORMAL'; 
let lockedSessionFilter = 'NORMAL'; 
let lockedSessionFilterConfig = normalizeFilter(DEFAULT_FILTERS.NORMAL, DEFAULT_FILTERS.NORMAL);
let sessionInProgress = false;
let isFreePlayMode = false;

let arduinoConnected = false; 
let isConnecting = false; 
let arduinoTotal = 0; 
let availableBalance = 0; 

let countdownTimerStart = 10; 

let sequenceInterval;
let sequenceTimeout;
let normalDebounce; 

let port; 
let parser;
let printJobActive = false;
let billSoundCooldownUntil = 0;
let systemRedState = null;
let arcadeRedState = null;
let greenLedState = null;

function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${date.getFullYear()}`;
}

function refreshTotals() {
    totalRevenue = dailyRecords.reduce((sum, record) => sum + record.revenue, 0);
    totalSessions = dailyRecords.reduce((sum, record) => sum + record.sessions, 0);
}

function recordCompletedSession() {
    const date = formatDate(new Date());
    let record = dailyRecords.find(item => item.date === date);
    if (!record) {
        record = { date, revenue: 0, sessions: 0 };
        dailyRecords.push(record);
    }
    record.revenue += appConfig.sessionPrice;
    record.sessions += 1;
    refreshTotals();
    saveStats();
    emitAuditUpdate();
}

function emitAuditUpdate() {
    io.emit('audit_update', {
        revenue: totalRevenue,
        sessions: totalSessions,
        dailyRecords,
        sessionPrice: appConfig.sessionPrice
    });
}

// --- HARDWARE HELPER FUNCTIONS ---

function listInstalledPrinters() {
    return new Promise((resolve) => {
        const command = 'Get-CimInstance Win32_Printer | Where-Object Name | Select-Object Name, PrinterStatus, WorkOffline | ConvertTo-Json -Compress';
        execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command], {
            windowsHide: true,
            timeout: 10000,
            maxBuffer: 1024 * 1024
        }, (error, stdout, stderr) => {
            if (error) {
                addLog(`ERROR: Failed to scan installed Windows printers. ${stderr.trim() || error.message}`);
                resolve([]);
                return;
            }

            try {
                const parsed = stdout.trim() ? JSON.parse(stdout) : [];
                resolve((Array.isArray(parsed) ? parsed : [parsed])
                    .filter(printer => printer && typeof printer.Name === 'string' && printer.Name.trim())
                    .sort((a, b) => a.Name.localeCompare(b.Name)));
            } catch (parseError) {
                addLog('ERROR: Windows returned an invalid printer list.');
                resolve([]);
            }
        });

    });
}

function evaluateLEDState() {
    if (sessionInProgress) return; 

    if (isFreePlayMode) {
        sendHardwareCommand('READY_TO_START');
        io.emit('bg_music_command', 'STOP');
        return;
    }
    
    if (availableBalance >= appConfig.sessionPrice) {
        sendHardwareCommand('READY_TO_START');
        io.emit('bg_music_command', 'PLAY');
    } else {
        sendHardwareCommand('IDLE');
        io.emit('bg_music_command', 'STOP');
    }
}

function emitSoundEffect(name) {
    io.emit('sound_effect', name);
}

function sendHardwareCommand(command) {
    if (port && arduinoConnected) port.write(`${command}\n`);

    if (command === 'IDLE' || command === 'SESSION_START') {
        const nextSystemRedState = command === 'IDLE';
        if (systemRedState !== nextSystemRedState) {
            systemRedState = nextSystemRedState;
            emitSoundEffect('red');
        }
        if (arcadeRedState !== false) arcadeRedState = false;
    } else if (command === 'READY_TO_START') {
        if (arcadeRedState !== true) {
            arcadeRedState = true;
            emitSoundEffect('arcade');
        }
        if (systemRedState !== false) {
            systemRedState = false;
            emitSoundEffect('red');
        }
    } else if (command === 'GREEN_ON' || command === 'GREEN_OFF') {
        const nextGreenState = command === 'GREEN_ON';
        if (greenLedState !== nextGreenState) {
            greenLedState = nextGreenState;
            if (nextGreenState) emitSoundEffect('green');
        }
    }
}

function printCollage(imagePath) {
    addLog(`🖨️ Preparing to print: ${path.basename(imagePath)}`);
    if (!appConfig.targetPrinter) {
        addLog('ERROR: No target printer selected. Open Dashboard Settings to choose one.');
        return;
    }
    if (printJobActive) {
        addLog('ERROR: A print job is already being submitted. The new job was skipped to protect the spooler.');
        return;
    }

    printJobActive = true;
    const finishPrintJob = () => { printJobActive = false; };

    const printCommand = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$image = [System.Drawing.Image]::FromFile($env:FLIK_PRINT_IMAGE)
$document = New-Object System.Drawing.Printing.PrintDocument
$document.PrinterSettings.PrinterName = $env:FLIK_PRINT_PRINTER
if (-not $document.PrinterSettings.IsValid) {
    throw "Configured printer [$env:FLIK_PRINT_PRINTER] is not available."
}
$document.add_PrintPage({
    param($sender, $event)
    $page = $event.PageBounds
    $scale = [Math]::Min($page.Width / $image.Width, $page.Height / $image.Height)
    $width = [int]($image.Width * $scale)
    $height = [int]($image.Height * $scale)
    $x = [int](($page.Width - $width) / 2)
    $y = [int](($page.Height - $height) / 2)
    $event.Graphics.DrawImage($image, $x, $y, $width, $height)
})
$document.Print()
$image.Dispose()
$document.Dispose()
`;

    execFile('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-STA',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        printCommand
    ], {
        windowsHide: true,
        timeout: 30000,
        env: {
            ...process.env,
            FLIK_PRINT_IMAGE: imagePath,
            FLIK_PRINT_PRINTER: appConfig.targetPrinter
        }
    }, (error, stdout, stderr) => {
        finishPrintJob();
        if (error) {
            const reason = error.killed ? 'The print command timed out.' : (stderr.trim() || error.message);
            addLog(`ERROR: Failed to print on [${appConfig.targetPrinter}]. ${reason}`);
            return;
        }
        addLog(`> 🖨️ Print job sent to [${appConfig.targetPrinter}] using the configured Windows printer.`);
        sendHardwareCommand('GREEN_ON');
        setTimeout(() => sendHardwareCommand('GREEN_OFF'), 10000);
    });
}

function checkCameraConnection() {
    return new Promise((resolve) => {
        http.get('http://127.0.0.1:5513/liveview.jpg', (res) => {
            if (res.statusCode === 200) resolve(true);
            else resolve(false);
        }).on('error', () => resolve(false));
    });
}

function capturePhoto() {
    const timestamp = Date.now();
    const savePath = path.join(masterFolder, `raw_${timestamp}.jpg`);
    const digiCamPath = '"C:\\Program Files (x86)\\digiCamControl\\CameraControlRemoteCmd.exe"';
    const command = `${digiCamPath} /c capture "${savePath}"`;
        
    exec(command, async (error) => {
        if (error) {
            addLog(`ERROR: Camera failed to capture mid-session. Aborting.`);
            clearInterval(sequenceInterval);
            clearTimeout(sequenceTimeout);
            sessionInProgress = false;
            currentSessionPhotos = [];
            io.emit('hardware_update', { type: 'status', value: 'IDLE' });
            evaluateLEDState(); 
            return;
        }
        
        addLog(`PHOTO CAPTURED: ${timestamp}.jpg`);
        currentSessionPhotos.push(savePath);

        if (currentSessionPhotos.length === 4) {
            addLog(`ALL 4 PHOTOS TAKEN. Processing collage...`);
            io.emit('hardware_update', { type: 'status', value: 'PROCESSING' });
            
            setTimeout(async () => {
                const collageName = `collage_${Date.now()}.jpg`;
                const collagePath = path.join(masterFolder, collageName);
                                
                try {
                    await createCollage(currentSessionPhotos, collagePath, lockedSessionFilterConfig);
                    const imageUrl = `http://127.0.0.1:${PORT}/archive/${encodeURIComponent(collageName)}`;
                    recordCompletedSession();
                    
                    io.emit('collage_ready', imageUrl);
                    addLog(`SUCCESS: Collage generated and sent to frontend.`);
                    
                    // Stop BG Music right as printer fires
                    io.emit('bg_music_command', 'STOP');
                    printCollage(collagePath);
                    
                } catch (err) {
                    addLog(`ERROR: Sharp failed to stitch collage.`);
                    console.error(err);
                } finally {
                    currentSessionPhotos = []; 
                    sessionInProgress = false; 
                    evaluateLEDState(); 
                }
            }, 0);
        }
    });
}

async function startSessionLoop(isFreePlay = false) {
    if (sessionInProgress || printJobActive) {
        addLog(">  Session already processing. Ignoring duplicate command.");
        return; 
    }
    
    sessionInProgress = true; 
    addLog(">  Running  Diagnostics...");

    if (!arduinoConnected) {
        addLog("ERROR: ❌ SYSTEM HALTED. Master Controller (Arduino) offline.");
        sessionInProgress = false; 
        return; 
    }

    const cameraReady = await checkCameraConnection();
    if (!cameraReady) {
        addLog("ERROR: ❌ SYSTEM HALTED. DSLR Camera offline.");
        sessionInProgress = false; 
        return; 
    }

    lockedSessionFilter = activeFilter;
    lockedSessionFilterConfig = normalizeFilter(appConfig.filters[activeFilter], DEFAULT_FILTERS[activeFilter] || DEFAULT_FILTERS.NORMAL);
    addLog(`>  Diagnostics passed. System Secured. Filter locked to: ${lockedSessionFilter}`);
    
    if (!isFreePlay) {
    availableBalance -= appConfig.sessionPrice;
        io.emit('hardware_update', { type: 'balance', value: availableBalance });
    addLog(`>  Payment Accepted: ${appConfig.sessionPrice} PHP deducted. Remaining Balance: ${availableBalance} PHP.`);
    } else {
        addLog(`>  Free Play Enabled: No balance deducted.`);
    }
    
    currentSessionPhotos = [];
    io.emit('hardware_update', { type: 'trigger', value: 'START' });
    
    sendHardwareCommand('SESSION_START');
    // BG Music intentionally NOT stopped here so it plays during the session!

    let photoCount = 0;

    function runPhotoCycle() {
        let prepTime = countdownTimerStart;
        addLog(`> ⏳ GETTING READY FOR PHOTO ${photoCount + 1}...`);
        
        io.emit('countdown_tick', prepTime); 
        addLog(`> ⏱️ ${prepTime}...`);

        sequenceInterval = setInterval(() => {
            prepTime--; 
            io.emit('countdown_tick', prepTime);
            addLog(`> ⏱️ ${prepTime}...`);
            
            if (prepTime === 0) {
                clearInterval(sequenceInterval);
                addLog(`>  TAKING PHOTO ${photoCount + 1}...`);
                capturePhoto();
                photoCount++;
                
                if (photoCount < 4) {
                    sequenceTimeout = setTimeout(runPhotoCycle, 1500); 
                }
            }
        }, 1000);
    }
    runPhotoCycle();
}

async function connectToHardware() {
    isConnecting = true;
    try {
        const ports = await SerialPort.list();
        
        const targetPort = ports.find(p => 
            (p.manufacturer && p.manufacturer.toLowerCase().includes('arduino')) ||
            (p.vendorId && (p.vendorId.toUpperCase() === '2341' || p.vendorId.toUpperCase() === '1A86'))
        );

        if (!targetPort) {
            addLog('> Arduino not found. Retrying serial scan...');
            isConnecting = false;
            return; 
        }

        port = new SerialPort({ path: targetPort.path, baudRate: 115200, autoOpen: false });
        parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

        const currentPort = port;
        const handleDisconnect = (message) => {
            if (port !== currentPort) return;
            if (arduinoConnected) addLog(`ERROR: Arduino connection lost!`);
            arduinoConnected = false;
            isConnecting = false;
            if (message) addLog(`> ${message}`);
            port = undefined;
            parser = undefined;
        };

        port.on('error', (error) => {
            addLog(`ERROR: Arduino serial error on ${targetPort.path}: ${error.message}`);
            handleDisconnect('Arduino will be rediscovered automatically.');
        });

        port.on('close', () => {
            handleDisconnect('Arduino unplugged. Waiting for reconnection.');
        });

        port.open((err) => {
            isConnecting = false;
            if (err) {
                handleDisconnect(`Arduino connection failed on ${targetPort.path}.`);
            } else {
                arduinoConnected = true;
                addLog(`>  System linked to Arduino on ${targetPort.path}`);
                
                port.set({ dtr: false }, () => {
                    setTimeout(() => port.set({ dtr: true }), 50);
                });
                setTimeout(evaluateLEDState, 1500); 
            }
        });

        parser.on('data', (data) => {
            let cleanData = data.trim();

            if (cleanData.includes('FILTER_1')) cleanData = 'FILTER: NOIR';
            else if (cleanData.includes('FILTER_2')) cleanData = 'FILTER: FILM_II';

            if (cleanData.startsWith('FILTER:')) {
                const incomingFilter = cleanData.replace('FILTER:', '').trim();
                emitSoundEffect('switch');
                if (!sessionInProgress) {
                    if (incomingFilter !== 'NORMAL') {
                        clearTimeout(normalDebounce);
                        if (activeFilter !== incomingFilter) {
                            activeFilter = incomingFilter;
                            io.emit('hardware_update', { type: 'filter', value: cleanData });
                            addLog(`>  Hardware Filter Set: ${activeFilter}`);
                        }
                    } else {
                        clearTimeout(normalDebounce);
                        normalDebounce = setTimeout(() => {
                            if (activeFilter !== 'NORMAL') {
                                activeFilter = 'NORMAL';
                                io.emit('hardware_update', { type: 'filter', value: 'FILTER: NORMAL' });
                                addLog(`>  Hardware Filter Set: NORMAL`);
                            }
                        }, 250);
                    }
                }
            } else if (cleanData.includes('TRIGGER: START') || cleanData.includes('BUTTON_CLICKED')) {
                addLog(`> DEBUG: Button Trigger Received.`);
                if (sessionInProgress || printJobActive) {
                    addLog(`>  Session already processing or printing. Ignoring duplicate button press.`);
                } else if (isFreePlayMode) {
                    startSessionLoop(true);
                } else if (availableBalance >= appConfig.sessionPrice) {
                    startSessionLoop(false); 
                } else {
                    addLog(`ERROR: ❌ INSUFFICIENT FUNDS. Balance: ${availableBalance} PHP (Requires ${appConfig.sessionPrice} PHP).`);
                }
            } else if (cleanData.includes('BALANCE:')) {
                const currentArduinoVal = parseInt(cleanData.split(':')[1]);
                if (!Number.isFinite(currentArduinoVal)) return;
                if (isFreePlayMode) {
                    arduinoTotal = currentArduinoVal;
                    return;
                }

                if (currentArduinoVal < arduinoTotal) arduinoTotal = 0;

                if (currentArduinoVal > arduinoTotal) {
                    const newlyInserted = currentArduinoVal - arduinoTotal;
                    availableBalance += newlyInserted;
                    arduinoTotal = currentArduinoVal;
                    
                    io.emit('pulse_received');
                    if (Date.now() >= billSoundCooldownUntil) {
                        billSoundCooldownUntil = Date.now() + 2000;
                        emitSoundEffect('bill');
                    }
                    io.emit('hardware_update', { type: 'balance', value: availableBalance });
                    addLog(`>  Bill Detected: Added ${newlyInserted} PHP.`);
                }
                evaluateLEDState();
            }
        });
    } catch (err) {
        isConnecting = false;
        addLog(`ERROR: Unable to scan serial ports: ${err.message}`);
    }
}

setInterval(() => {
    if (!arduinoConnected && !isConnecting) connectToHardware();
}, 3000);

io.on('connection', (socket) => {
    socket.on('request_sync', () => {
        socket.emit('audit_update', {
            revenue: totalRevenue,
            sessions: totalSessions,
            dailyRecords,
            sessionPrice: appConfig.sessionPrice
        });
        socket.emit('hardware_update', { type: 'balance', value: availableBalance }); 
        socket.emit('hardware_update', { type: 'filter', value: `FILTER: ${activeFilter}` }); 
        socket.emit('terminal_history', terminalHistory);
        socket.emit('sync_timer', countdownTimerStart); 
        socket.emit('printer_config', { target: appConfig.printerName });
        socket.emit('frame_config', { active: appConfig.activeFrame });
        socket.emit('filter_config', appConfig.filters);
        socket.emit('free_play_state', isFreePlayMode);
        socket.emit(
            'bg_music_command',
            !isFreePlayMode && availableBalance >= appConfig.sessionPrice ? 'PLAY' : 'STOP'
        );
        socket.emit('frame_list', listFrames());
        listInstalledPrinters().then(printers => socket.emit('printer_list', printers));
    });

    socket.on('toggle_free_play', (enabled) => {
        if (typeof enabled !== 'boolean') {
            socket.emit('free_play_error', 'Invalid Free Play mode value.');
            return;
        }

        isFreePlayMode = enabled;
        if (isFreePlayMode) {
            sendHardwareCommand('READY_TO_START');
            io.emit('bg_music_command', 'STOP');
            addLog('> Free Play mode enabled. Bill acceptance is ignored.');
        } else {
            evaluateLEDState();
            addLog('> Free Play mode disabled. Bill acceptance restored.');
        }
        io.emit('free_play_state', isFreePlayMode);
    });

    socket.on('update_price', (value) => {
        const nextPrice = normalizeSessionPrice(value);
        if (Number(value) !== nextPrice) {
            socket.emit('price_error', 'Select a valid session price.');
            return;
        }
        appConfig.sessionPrice = nextPrice;
        saveConfig();
        emitAuditUpdate();
        io.emit('price_update', nextPrice);
        evaluateLEDState();
        addLog(`> Session price updated to ${nextPrice} PHP.`);
    });

    socket.on('request_printers', async () => {
        socket.emit('printer_list', await listInstalledPrinters());
    });

    socket.on('save_printer', (printerName) => {
        if (typeof printerName !== 'string') return;
        appConfig.targetPrinter = printerName.trim();
        appConfig.printerName = appConfig.targetPrinter;
        saveConfig();
        io.emit('printer_config', { target: appConfig.printerName });
        addLog(`> 🖨️ Target printer set to [${appConfig.printerName || 'None'}].`);
    });

    socket.on('save_filters', (filters) => {
        if (!filters || typeof filters !== 'object') {
            socket.emit('filter_error', 'Invalid filter settings.');
            return;
        }
        appConfig.filters = normalizeFilters(filters);
        saveConfig();
        io.emit('filter_config', appConfig.filters);
        addLog('> Filter presets saved. Hardware toggle remains the session priority.');
    });

    socket.on('request_frames', () => {
        socket.emit('frame_config', { active: appConfig.activeFrame });
        socket.emit('frame_list', listFrames());
    });

    socket.on('upload_frame', async (payload) => {
        try {
            if (!payload || typeof payload.name !== 'string' || typeof payload.data !== 'string') {
                throw new Error('Invalid frame upload payload.');
            }
            const extension = path.extname(payload.name).toLowerCase();
            if (!['.jpg', '.jpeg', '.png', '.webp'].includes(extension)) {
                throw new Error('Only JPG, PNG, and WebP frames are supported.');
            }
            const safeBaseName = path.basename(payload.name).replace(/[^a-zA-Z0-9._-]/g, '_');
            const buffer = await decodeImagePayload(payload.data, 50 * 1024 * 1024);
            await fs.promises.writeFile(path.join(framesFolder, safeBaseName), buffer, { flag: 'wx' });
            addLog(`> Frame uploaded: ${safeBaseName}`);
            io.emit('frame_list', listFrames());
        } catch (error) {
            socket.emit('frame_error', error.message);
        }
    });

    socket.on('set_active_frame', (filename) => {
        if (typeof filename !== 'string' || filename !== path.basename(filename)) {
            socket.emit('frame_error', 'Invalid frame filename.');
            return;
        }
        if (!listFrames().some(frame => frame.name === filename)) {
            socket.emit('frame_error', 'Frame not found.');
            return;
        }
        appConfig.activeFrame = filename;
        saveConfig();
        io.emit('frame_config', { active: appConfig.activeFrame });
        addLog(`> Active frame set to [${filename}].`);
    });

    socket.on('delete_frame', async (filename) => {
        if (typeof filename !== 'string' || filename !== path.basename(filename)) {
            socket.emit('frame_error', 'Invalid frame filename.');
            return;
        }

        const framePath = path.join(framesFolder, filename);
        if (!fs.existsSync(framePath) || !/\.(jpe?g|png|webp)$/i.test(filename)) {
            socket.emit('frame_error', 'Frame not found.');
            return;
        }

        try {
            await fs.promises.unlink(framePath);
            if (appConfig.activeFrame === filename) {
                appConfig.activeFrame = '';
                saveConfig();
                io.emit('frame_config', { active: '' });
            }
            io.emit('frame_list', listFrames());
            addLog(`> Frame deleted: ${filename}`);
        } catch (error) {
            socket.emit('frame_error', 'Unable to delete the selected frame.');
        }
    });

    socket.on('print_photo', (filename) => {
        if (typeof filename !== 'string' || !/^collage_[^\\/]+\.jpg$/i.test(filename)) return;
        const imagePath = resolveArchivePath(filename);
        if (imagePath) printCollage(imagePath);
    });

    socket.on('upload_archive_photo', async (payload) => {
        try {
            const buffer = await decodeImagePayload(payload);
            const filename = `collage_upload_${Date.now()}.jpg`;
            await sharp(buffer).jpeg({ quality: 90 }).toFile(path.join(masterFolder, filename));
            addLog(`> Archive photo uploaded: ${filename}`);
            socket.emit('archive_photo_saved', { filename });
        } catch (error) {
            socket.emit('archive_error', error.message);
        }
    });

    socket.on('create_custom_strip', async (payload) => {
        try {
            if (!payload || !Array.isArray(payload.photos) || payload.photos.length < 4 || payload.photos.length > 8) {
                throw new Error('Custom Strip requires between 4 and 8 pictures.');
            }
            const frameName = typeof payload.frame === 'string' ? payload.frame : appConfig.activeFrame;
            if (!frameName || frameName !== path.basename(frameName) || !listFrames().some(frame => frame.name === frameName)) {
                throw new Error('Select a valid frame before creating the strip.');
            }

            const photos = await Promise.all(payload.photos.map(decodeImagePayload));
            const filename = `collage_custom_${Date.now()}.jpg`;
            await createCustomCollage(photos, path.join(masterFolder, filename), resolveFramePath(frameName));
            addLog(`> Custom Strip saved: ${filename}`);
            socket.emit('custom_strip_saved', { filename });
        } catch (error) {
            socket.emit('archive_error', error.message);
        }
    });

    socket.on('session_complete', () => { evaluateLEDState(); });
    socket.on('clear_terminal', () => {
        terminalHistory = ['> Terminal cleared by operator.'];
        io.emit('terminal_history', terminalHistory); 
    });

    socket.on('set_filter', (filterName) => {
        if (!sessionInProgress && Object.prototype.hasOwnProperty.call(DEFAULT_FILTERS, filterName)) {
            activeFilter = filterName;
            io.emit('hardware_update', { type: 'filter', value: `FILTER: ${filterName}` });
            addLog(`>  OVERRIDE: Filter set to ${filterName}`);
        }
    });

    socket.on('update_countdown', (val) => {
        countdownTimerStart = parseInt(val);
        addLog(`>  TIMER UPDATED: Countdown set to ${countdownTimerStart} seconds.`);
        io.emit('sync_timer', countdownTimerStart);
    });

    socket.on('test_led', (cmd) => {
        if (port && arduinoConnected) {
            sendHardwareCommand(cmd);
            addLog(`>  HARDWARE TEST: Sent ${cmd} to Arduino.`);
        } else {
            addLog(`ERROR: Cannot test LED. Arduino not connected.`);
        }
    });
    
    socket.on('force_start', () => {
        addLog(`>  FORCE START INITIALIZED`);
        startSessionLoop(true); 
    });
    
    socket.on('abort_session', () => {
        addLog(`>  OPERATOR OVERRIDE: SESSION ABORTED`);
        clearInterval(sequenceInterval);
        clearTimeout(sequenceTimeout);
        sessionInProgress = false;
        currentSessionPhotos = [];
        evaluateLEDState(); 
        io.emit('hardware_update', { type: 'status', value: 'IDLE' });
    });

    socket.on('reset_balance', () => {
        availableBalance = 0;
        io.emit('hardware_update', { type: 'balance', value: availableBalance });
        evaluateLEDState(); 
        addLog(">  Operator reset customer balance to 0.");
    });
    
    socket.on('reset_revenue', () => {
        dailyRecords = [];
        refreshTotals();
        saveStats();
        emitAuditUpdate();
        addLog(">  Vault stats permanently reset by operator.");
    });
    
    socket.on('restart_system', () => {
        addLog(`>  OPERATOR COMMAND: SYSTEM REBOOTING IN 3 SECONDS...`);
        setTimeout(() => {
            const child = spawn(process.argv[0], process.argv.slice(1), { detached: true, stdio: 'inherit' });
            child.unref(); 
            process.exit(); 
        }, 3000);
    });
});

app.get('/api/gallery', (req, res) => {
    try {
        const files = listArchiveFiles()
            .map(file => {
                const filePath = file.path;
                return { name: file.name, url: `http://127.0.0.1:${PORT}/archive/${encodeURIComponent(file.name)}`, timestamp: file.mtime };
            })
            .sort((a, b) => b.timestamp - a.timestamp); 
        res.json(files);
    } catch (error) { res.status(500).json({ error: "Failed to load gallery" }); }
});

app.delete('/api/gallery/:filename', (req, res) => {
    const filename = req.params.filename;
    if (!filename.startsWith('collage_') || !filename.endsWith('.jpg')) return res.status(403).json({ error: "Invalid file type" });
    const filePath = resolveArchivePath(filename);
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath); 
            addLog(` Permanently deleted archive: ${filename}`);
            res.json({ success: true, message: "File deleted successfully" });
        } else res.status(404).json({ error: "File not found" });
    } catch (error) { res.status(500).json({ error: "Failed to delete file" }); }
});

function waitForFile(filePath, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        const checkInterval = 200; 
        let elapsed = 0;
        const timer = setInterval(() => {
            if (fs.existsSync(filePath)) {
                clearInterval(timer);
                setTimeout(() => resolve(true), 200); 
            }

            elapsed += checkInterval;
            if (elapsed >= timeoutMs) {
                clearInterval(timer);
                reject(new Error(`Timeout waiting for file: ${filePath}`));
            }
        }, checkInterval);
    });
}

function decodeImagePayload(payload, maxBytes = 50 * 1024 * 1024) {
    return new Promise((resolve, reject) => {
        setImmediate(() => {
            try {
                if (typeof payload !== 'string' || !/^data:image\/(?:jpeg|jpg|png|webp);base64,/i.test(payload)) {
                    throw new Error('Only JPG, PNG, and WebP images are supported.');
                }
                const buffer = Buffer.from(payload.replace(/^data:image\/(?:jpeg|jpg|png|webp);base64,/i, ''), 'base64');
                if (!buffer.length || buffer.length > maxBytes) {
                    throw new Error(`Image must be between 1 byte and ${Math.round(maxBytes / (1024 * 1024))} MB.`);
                }
                resolve(buffer);
            } catch (error) {
                reject(error);
            }
        });
    });
}

async function createCustomCollage(photos, outputPath, framePath) {
    const photoWidth = 513;
    const photoHeight = 389;
    const slotPositions = [
        [57, 144], [628, 144], [57, 545], [628, 545],
        [57, 947], [628, 947], [57, 1349], [628, 1349]
    ];
    const slotPhotos = photos.length === 4
        ? [photos[0], photos[0], photos[1], photos[1], photos[2], photos[2], photos[3], photos[3]]
        : photos;
    const photoLayers = await Promise.all(slotPhotos.map(async (photo, index) => ({
        input: await sharp(photo).resize(photoWidth, photoHeight, { fit: 'fill' }).jpeg().toBuffer(),
        left: slotPositions[index][0],
        top: slotPositions[index][1]
    })));
    const background = await sharp(framePath).resize(1200, 1800, { fit: 'fill' }).png().toBuffer();
    await sharp(background).composite(photoLayers).jpeg({ quality: 90 }).toFile(outputPath);
}

async function createCollage(photos, outputPath, filterConfig) {
    try {
        // These coordinates match the eight photo slots in the 1200x1800 frames.
        const photoWidth = 513;
        const photoHeight = 389;
        const leftX = 57;
        const rightX = 628;
        const rowY = [144, 545, 947, 1349];
        const resizedImages = await Promise.all(
            photos.map(async (photoPath) => {
                await waitForFile(photoPath);
                // The frame slots are fixed-size rectangles; fill them instead of
                // cropping the camera image and leaving the slot geometry ambiguous.
                let img = sharp(photoPath).resize(photoWidth, photoHeight, { fit: 'fill' });
                
                const filter = filterConfig || appConfig.filters.NORMAL;
                const amount = filter.intensity / 100;
                const grayscale = filter.grayscale * amount;
                const brightness = 1 + ((filter.brightness / 100) - 1) * amount;
                const saturation = 1 + ((filter.saturation / 100) - 1) * amount;
                const contrast = 1 + ((filter.contrast / 100) - 1) * amount;
                const invert = (filter.invert * amount) / 100;
                const gray = grayscale / 100;
                img = img.recomb([
                    [1 - gray + 0.299 * gray, 0.587 * gray, 0.114 * gray],
                    [0.299 * gray, 1 - gray + 0.587 * gray, 0.114 * gray],
                    [0.299 * gray, 0.587 * gray, 1 - gray + 0.114 * gray]
                ]).modulate({ saturation: Math.max(0, saturation), brightness: Math.max(0, brightness) })
                    .linear(Math.max(0, contrast), 128 * (1 - Math.max(0, contrast)));
                if (invert > 0) {
                img = img.recomb([
                    [1 - 2 * invert, 0, 0],
                    [0, 1 - 2 * invert, 0],
                    [0, 0, 1 - 2 * invert]
                ]).linear(1, 255 * invert);
                }
                if (filter.blur > 0) img = img.blur(filter.blur * amount);
                if (filter.sepia > 0) {
                    const sepia = (filter.sepia * amount) / 100;
                    img = img.recomb([
                        [1 - 0.607 * sepia, 0.769 * sepia, 0.189 * sepia],
                        [0.349 * sepia, 1 - 0.314 * sepia, 0.168 * sepia],
                        [0.272 * sepia, 0.534 * sepia, 1 - 0.869 * sepia]
                    ]);
                }
                return img.toBuffer();
            })
        );
        
        const activeFramePath = appConfig.activeFrame ? resolveFramePath(appConfig.activeFrame) : '';
        const backgroundInput = activeFramePath
            ? await sharp(activeFramePath)
                .resize(1200, 1800, { fit: 'fill' }).png().toBuffer()
            : { create: { width: 1200, height: 1800, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } };
        const photoLayers = [];
        rowY.forEach((top, index) => {
            photoLayers.push({ input: resizedImages[index], top, left: leftX });
            photoLayers.push({ input: resizedImages[index], top, left: rightX });
        });
        await sharp(backgroundInput).composite(photoLayers).jpeg({ quality: 90 }).toFile(outputPath);

        photos.forEach(photoPath => { 
            if (fs.existsSync(photoPath)) { try { fs.unlinkSync(photoPath); } catch(e) {} }
        });
    } catch (error) { throw error; }
}

function listFrames() {
    const names = new Set();
    [framesFolder, legacyFramesFolder, bundledFramesFolder].forEach(folder => {
        if (!fs.existsSync(folder)) return;
        fs.readdirSync(folder)
            .filter(name => /\.(jpe?g|png|webp)$/i.test(name))
            .forEach(name => names.add(name));
    });
    return [...names].sort((a, b) => a.localeCompare(b))
        .map(name => ({ name, url: `http://127.0.0.1:${PORT}/frames/${encodeURIComponent(name)}` }));
}

function resolveFramePath(filename) {
    if (typeof filename !== 'string' || filename !== path.basename(filename)) return '';
    for (const folder of [framesFolder, legacyFramesFolder, bundledFramesFolder]) {
        const candidate = path.join(folder, filename);
        if (fs.existsSync(candidate)) return candidate;
    }
    return '';
}

function listArchiveFiles() {
    const files = new Map();
    [masterFolder, ...legacyArchiveFolders, bundledArchiveFolder].forEach(folder => {
        if (!fs.existsSync(folder)) return;
        fs.readdirSync(folder)
            .filter(name => /^collage_.*\.jpg$/i.test(name))
            .forEach(name => {
                const filePath = path.join(folder, name);
                const stats = fs.statSync(filePath);
                files.set(name, { name, path: filePath, mtime: stats.mtime.getTime() });
            });
    });
    return [...files.values()];
}

function resolveArchivePath(filename) {
    if (typeof filename !== 'string' || filename !== path.basename(filename)) return '';
    for (const folder of [masterFolder, ...legacyArchiveFolders, bundledArchiveFolder]) {
        const candidate = path.join(folder, filename);
        if (fs.existsSync(candidate)) return candidate;
    }
    return '';
}

function listImageNames(folders, pattern) {
    const names = new Set();
    folders.forEach(folder => {
        if (!fs.existsSync(folder)) return;
        fs.readdirSync(folder)
            .filter(name => pattern.test(name))
            .forEach(name => names.add(name));
    });
    return [...names].sort((a, b) => a.localeCompare(b));
}

app.get('/api/frames', (req, res) => {
    try {
        res.json(listImageNames(
            [framesFolder, legacyFramesFolder, bundledFramesFolder],
            /\.(jpe?g|png|webp)$/i
        ));
    } catch (error) {
        res.status(500).json({ error: 'Failed to load frames.' });
    }
});

app.get('/api/archive', (req, res) => {
    try {
        res.json(listImageNames(
            [masterFolder, ...legacyArchiveFolders, bundledArchiveFolder],
            /^collage_.*\.jpg$/i
        ));
    } catch (error) {
        res.status(500).json({ error: 'Failed to load archive.' });
    }
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(` FLIK Master Backend running on port ${PORT}`);
    if (process.send) process.send({ type: 'server-ready' });
});