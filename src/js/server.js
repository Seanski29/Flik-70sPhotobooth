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
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const PORT = 3001;
app.use(cors());
app.use(express.json());

const masterFolder = path.join(__dirname, '..', 'archive');
app.use('/archive', express.static(masterFolder)); 

if (!fs.existsSync(masterFolder)) fs.mkdirSync(masterFolder, { recursive: true });

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

// --- PERSISTENT DATABASE SYSTEM ---
const statsFilePath = path.join(__dirname, 'stats.json');
const configFilePath = path.join(__dirname, 'config.json');
let totalRevenue = 0;
let totalSessions = 0;
let appConfig = { printerName: '' };

function loadConfig() {
    try {
        if (fs.existsSync(configFilePath)) {
            appConfig = { ...appConfig, ...JSON.parse(fs.readFileSync(configFilePath, 'utf8')) };
        } else {
            saveConfig();
        }
    } catch (err) {
        console.error('Failed to read config.json:', err);
        appConfig = { printerName: '' };
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
            totalRevenue = data.totalRevenue || 0;
            totalSessions = data.totalSessions || 0;
            addLog(`>  Loaded historical data: ${totalRevenue} PHP / ${totalSessions} Sessions`);
        }
    } catch (err) {
        addLog(">  Failed to read stats.json. Starting fresh.");
    }
}
function saveStats() {
    try {
        fs.writeFileSync(statsFilePath, JSON.stringify({ totalRevenue, totalSessions }));
    } catch (err) {
        console.error("Failed to save stats:", err);
    }
}
loadStats();

// --- STATE VARIABLES ---
let currentSessionPhotos = [];
let activeFilter = 'NORMAL'; 
let lockedSessionFilter = 'NORMAL'; 
let sessionInProgress = false;

let arduinoConnected = false; 
let isConnecting = false; 
const SESSION_COST = 200; 

let arduinoTotal = 0; 
let availableBalance = 0; 

let countdownTimerStart = 10; 

let sequenceInterval;
let sequenceTimeout;
let normalDebounce; 

let port; 
let parser;
let printJobActive = false;

// --- HARDWARE HELPER FUNCTIONS ---

function listInstalledPrinters() {
    return new Promise((resolve) => {
        const command = 'Get-CimInstance Win32_Printer | Select-Object Name, PrinterStatus, WorkOffline | ConvertTo-Json -Compress';
        execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], (error, stdout) => {
            if (error) {
                addLog('ERROR: Failed to scan installed Windows printers.');
                resolve([]);
                return;
            }

            try {
                const parsed = stdout.trim() ? JSON.parse(stdout) : [];
                resolve((Array.isArray(parsed) ? parsed : [parsed]).filter(printer => printer.Name));
            } catch (parseError) {
                addLog('ERROR: Windows returned an invalid printer list.');
                resolve([]);
            }
        });
    });
}

function evaluateLEDState() {
    if (sessionInProgress) return; 
    
    if (availableBalance >= SESSION_COST) {
        if (port && arduinoConnected) port.write("READY_TO_START\n");
        io.emit('bg_music_command', 'PLAY');
    } else {
        if (port && arduinoConnected) port.write("IDLE\n"); 
        io.emit('bg_music_command', 'STOP');
    }
}

function printWithPowerShell(imagePath, printerName, onComplete) {
    const escapePowerShell = value => String(value).replace(/'/g, "''");
    const command = `
        Add-Type -AssemblyName System.Drawing;
        $printer = '${escapePowerShell(printerName)}';
        $imagePath = '${escapePowerShell(imagePath)}';
        $document = New-Object System.Drawing.Printing.PrintDocument;
        try {
            $document.PrinterSettings.PrinterName = $printer;
            if (-not $document.PrinterSettings.IsValid) { throw "Target printer not available: $printer" }
            $document.PrintController = New-Object System.Drawing.Printing.StandardPrintController;
            $paper = $document.PrinterSettings.PaperSizes | Where-Object {
                $_.PaperName -match '(?i)(4.?x.?6|6.?x.?4|postcard|dnp)' -and $_.Width -gt 350 -and $_.Width -lt 700
            } | Select-Object -First 1;
            if ($paper) {
                $document.DefaultPageSettings.PaperSize = $paper;
            } else {
                $document.DefaultPageSettings.PaperSize = New-Object System.Drawing.Printing.PaperSize('DNP 4x6', 400, 600);
            }
            $document.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0);
            $document.OriginAtMargins = $false;
            $document.add_PrintPage({
                param($sender, $eventArgs)
                $image = [System.Drawing.Image]::FromFile($imagePath);
                try {
                    $eventArgs.Graphics.DrawImage($image, $eventArgs.PageBounds);
                    $eventArgs.HasMorePages = $false;
                } finally {
                    $image.Dispose();
                }
            });
            $document.Print();
        } finally {
            $document.Dispose();
        }
    `;

    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass', '-Command', command], {
        windowsHide: true,
        timeout: 30000,
        killSignal: 'SIGKILL'
    }, (error, stdout, stderr) => {
        onComplete();
        if (error) {
            const reason = error.killed ? 'The fallback print command timed out.' : (stderr.trim() || error.message);
            addLog(`ERROR: Failed to print on [${printerName}]. ${reason}`);
            return;
        }
        addLog(`> Print job sent silently to [${printerName}] using the configured 4x6 driver profile.`);
    });
}

function printCollage(imagePath) {
    addLog(`🖨️ Preparing to print: ${path.basename(imagePath)}`);
    if (!appConfig.printerName) {
        addLog('ERROR: No target printer selected. Open Dashboard Settings to choose one.');
        return;
    }
    if (printJobActive) {
        addLog('ERROR: A print job is already being submitted. The new job was skipped to protect the spooler.');
        return;
    }

    printJobActive = true;
    const finishPrintJob = () => { printJobActive = false; };

    const paintPath = path.join(process.env.WINDIR || 'C:\\Windows', 'System32', 'mspaint.exe');
    if (!fs.existsSync(paintPath)) {
        addLog('> mspaint.exe is unavailable; using the silent targeted printer fallback.');
        printWithPowerShell(imagePath, appConfig.printerName, finishPrintJob);
        return;
    }

    execFile(paintPath, ['/pt', imagePath, appConfig.printerName], {
        windowsHide: true,
        timeout: 15000,
        killSignal: 'SIGKILL'
    }, (error, stdout, stderr) => {
        finishPrintJob();
        if (error) {
            const reason = error.killed ? 'The print command timed out.' : (stderr.trim() || error.message);
            addLog(`ERROR: Failed to print on [${appConfig.printerName}]. ${reason}`);
            return;
        }
        addLog(`> 🖨️ Print job sent silently to [${appConfig.printerName}] using the configured 4x6 driver profile.`);
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
                    await generateCollage(currentSessionPhotos, collagePath, lockedSessionFilter);
                    const imageUrl = `http://localhost:3001/archive/${collageName}`;
                    
                    io.emit('collage_ready', imageUrl);
                    addLog(`SUCCESS: Collage generated and sent to frontend.`);
                    
                    // Stop BG Music right as printer fires
                    io.emit('bg_music_command', 'STOP');
                    printCollage(collagePath);
                    
                    if (port && arduinoConnected) port.write("GREEN_ON\n");
                    
                    setTimeout(() => {
                        if (port && arduinoConnected) port.write("GREEN_OFF\n");
                    }, 10000); 
                    
                } catch (err) {
                    addLog(`ERROR: Sharp failed to stitch collage.`);
                    console.error(err);
                } finally {
                    currentSessionPhotos = []; 
                    sessionInProgress = false; 
                    evaluateLEDState(); 
                }
            }, 3000); 
        }
    });
}

async function startSessionLoop(isFreePlay = false) {
    if (sessionInProgress) {
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
    addLog(`>  Diagnostics passed. System Secured. Filter locked to: ${lockedSessionFilter}`);
    
    if (!isFreePlay) {
        availableBalance -= SESSION_COST;
        io.emit('hardware_update', { type: 'balance', value: availableBalance });
        addLog(`>  Payment Accepted: ${SESSION_COST} PHP deducted. Remaining Balance: ${availableBalance} PHP.`);
    } else {
        addLog(`>  Free Play Enabled: No balance deducted.`);
    }
    
    currentSessionPhotos = [];
    totalSessions++;
    saveStats();
    
    io.emit('audit_update', { revenue: totalRevenue, sessions: totalSessions });
    io.emit('hardware_update', { type: 'trigger', value: 'START' });
    
    if (port && arduinoConnected) port.write("SESSION_START\n");
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
            isConnecting = false;
            return; 
        }

        port = new SerialPort({ path: targetPort.path, baudRate: 115200, autoOpen: false });
        parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

        port.on('error', (err) => {
            if (arduinoConnected) addLog(`ERROR: Arduino connection lost!`);
            arduinoConnected = false;
            isConnecting = false;
        });

        port.on('close', () => {
            if (arduinoConnected) addLog(`ERROR: Arduino unplugged!`);
            arduinoConnected = false;
            isConnecting = false;
        });

        port.open((err) => {
            isConnecting = false;
            if (err) {
                arduinoConnected = false;
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

            if (cleanData.includes('FILTER')) {
                const incomingFilter = cleanData.replace('FILTER:', '').trim();
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
                if (availableBalance >= SESSION_COST) {
                    startSessionLoop(false); 
                } else {
                    addLog(`ERROR: ❌ INSUFFICIENT FUNDS. Balance: ${availableBalance} PHP (Requires ${SESSION_COST} PHP).`);
                }
            } else if (cleanData.includes('BALANCE:')) {
                const currentArduinoVal = parseInt(cleanData.split(':')[1]);
                
                if (currentArduinoVal < arduinoTotal) arduinoTotal = 0;

                if (currentArduinoVal > arduinoTotal) {
                    const newlyInserted = currentArduinoVal - arduinoTotal;
                    availableBalance += newlyInserted;
                    totalRevenue += newlyInserted;
                    saveStats();
                    arduinoTotal = currentArduinoVal;
                    
                    io.emit('audit_update', { revenue: totalRevenue, sessions: totalSessions });
                    io.emit('pulse_received'); 
                    io.emit('hardware_update', { type: 'balance', value: availableBalance });
                    addLog(`>  Bill Detected: Added ${newlyInserted} PHP.`);
                    
                    evaluateLEDState(); 
                }
            }
        });
    } catch (err) {
        isConnecting = false;
    }
}

setInterval(() => {
    if (!arduinoConnected && !isConnecting) connectToHardware();
}, 3000);

io.on('connection', (socket) => {
    socket.on('request_sync', () => {
        socket.emit('audit_update', { revenue: totalRevenue, sessions: totalSessions });
        socket.emit('hardware_update', { type: 'balance', value: availableBalance }); 
        socket.emit('hardware_update', { type: 'filter', value: `FILTER: ${activeFilter}` }); 
        socket.emit('terminal_history', terminalHistory);
        socket.emit('sync_timer', countdownTimerStart); 
        socket.emit('printer_config', { target: appConfig.printerName });
        listInstalledPrinters().then(printers => socket.emit('printer_list', printers));
    });

    socket.on('request_printers', async () => {
        socket.emit('printer_list', await listInstalledPrinters());
    });

    socket.on('save_printer', (printerName) => {
        if (typeof printerName !== 'string') return;
        appConfig.printerName = printerName.trim();
        saveConfig();
        io.emit('printer_config', { target: appConfig.printerName });
        addLog(`> 🖨️ Target printer set to [${appConfig.printerName || 'None'}].`);
    });

    socket.on('print_photo', (filename) => {
        if (typeof filename !== 'string' || !/^collage_[^\\/]+\.jpg$/i.test(filename)) return;
        const imagePath = path.join(masterFolder, filename);
        if (fs.existsSync(imagePath)) printCollage(imagePath);
    });

    socket.on('session_complete', () => { evaluateLEDState(); });
    socket.on('clear_terminal', () => {
        terminalHistory = ['> Terminal cleared by operator.'];
        io.emit('terminal_history', terminalHistory); 
    });

    socket.on('set_filter', (filterName) => {
        if (!sessionInProgress) {
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
            port.write(cmd + "\n");
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
        totalRevenue = 0;
        totalSessions = 0;
        saveStats();
        io.emit('audit_update', { revenue: totalRevenue, sessions: totalSessions });
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
        const files = fs.readdirSync(masterFolder)
            .filter(file => file.startsWith('collage_') && file.endsWith('.jpg'))
            .map(file => {
                const filePath = path.join(masterFolder, file);
                const stats = fs.statSync(filePath);
                return { name: file, url: `http://localhost:3001/archive/${file}`, timestamp: stats.mtime.getTime() };
            })
            .sort((a, b) => b.timestamp - a.timestamp); 
        res.json(files);
    } catch (error) { res.status(500).json({ error: "Failed to load gallery" }); }
});

app.delete('/api/gallery/:filename', (req, res) => {
    const filename = req.params.filename;
    if (!filename.startsWith('collage_') || !filename.endsWith('.jpg')) return res.status(403).json({ error: "Invalid file type" });
    const filePath = path.join(masterFolder, filename);
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

async function generateCollage(photos, outputPath, filterType) {
    try {
        const resizedImages = await Promise.all(
            photos.map(async (photoPath) => {
                await waitForFile(photoPath);
                let img = sharp(photoPath).resize(500, 375, { fit: 'cover' });
                
                if (filterType === 'NOIR' || filterType === 'FILTER_1') {
                    img = img.grayscale().linear(1.25, -10);
                } 
                else if (filterType === 'FILM_II' || filterType === 'FILTER_2') {
                    img = img.modulate({ saturation: 1.8, brightness: 1.05 })
                            .recomb([ [1.1, 0.0, 0.0], [0.0, 1.05, 0.0], [0.0, 0.0, 0.9] ]);
                }
                return img.toBuffer();
            })
        );
        
        await sharp({
            create: { width: 1200, height: 1800, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } }
        }).composite([
            { input: resizedImages[0], top: 100, left: 50 }, { input: resizedImages[1], top: 525, left: 50 },
            { input: resizedImages[2], top: 950, left: 50 }, { input: resizedImages[3], top: 1375, left: 50 },
            { input: resizedImages[0], top: 100, left: 650 }, { input: resizedImages[1], top: 525, left: 650 },
            { input: resizedImages[2], top: 950, left: 650 }, { input: resizedImages[3], top: 1375, left: 650 }
        ]).jpeg({ quality: 90 }).toFile(outputPath);

        photos.forEach(photoPath => { 
            if (fs.existsSync(photoPath)) { try { fs.unlinkSync(photoPath); } catch(e) {} }
        });
    } catch (error) { throw error; }
}

server.listen(PORT, () => console.log(` FLIK Master Backend running on port ${PORT}`));