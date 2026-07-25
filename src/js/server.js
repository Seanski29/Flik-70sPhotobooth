const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { exec, spawn } = require('child_process');
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

// --- NEW: PERSISTENT DATABASE SYSTEM ---
const statsFilePath = path.join(__dirname, 'stats.json');

let totalRevenue = 0;
let totalSessions = 0;

// Loads saved data when the server boots
function loadStats() {
    try {
        if (fs.existsSync(statsFilePath)) {
            const data = JSON.parse(fs.readFileSync(statsFilePath, 'utf8'));
            totalRevenue = data.totalRevenue || 0;
            totalSessions = data.totalSessions || 0;
            addLog(`> 💾 Loaded historical data: ${totalRevenue} PHP / ${totalSessions} Sessions`);
        }
    } catch (err) {
        addLog("> ⚠️ Failed to read stats.json. Starting fresh.");
    }
}

// Saves data to the hard drive instantly
function saveStats() {
    try {
        fs.writeFileSync(statsFilePath, JSON.stringify({ totalRevenue, totalSessions }));
    } catch (err) {
        console.error("Failed to save stats:", err);
    }
}

// Initialize the database on startup
loadStats();


app.get('/api/gallery', (req, res) => {
    try {
        const files = fs.readdirSync(masterFolder)
            .filter(file => file.startsWith('collage_') && file.endsWith('.jpg'))
            .map(file => {
                const filePath = path.join(masterFolder, file);
                const stats = fs.statSync(filePath);
                return {
                    name: file,
                    url: `http://localhost:3001/archive/${file}`,
                    timestamp: stats.mtime.getTime()
                };
            })
            .sort((a, b) => b.timestamp - a.timestamp); 

        res.json(files);
    } catch (error) {
        res.status(500).json({ error: "Failed to load gallery" });
    }
});

app.delete('/api/gallery/:filename', (req, res) => {
    const filename = req.params.filename;
    
    if (!filename.startsWith('collage_') || !filename.endsWith('.jpg')) {
        return res.status(403).json({ error: "Invalid file type" });
    }

    const filePath = path.join(masterFolder, filename);

    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath); 
            addLog(`🗑️ Permanently deleted archive: ${filename}`);
            res.json({ success: true, message: "File deleted successfully" });
        } else {
            res.status(404).json({ error: "File not found" });
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to delete file" });
    }
});

let currentSessionPhotos = [];
let activeFilter = 'NORMAL'; 
let sessionInProgress = false;

// --- HARDWARE & FINANCIAL STATE ---
let arduinoConnected = false; 
const SESSION_COST = 200; 

let arduinoTotal = 0; 
let availableBalance = 0; 

let sequenceInterval;
let sequenceTimeout;

function printCollage(imagePath) {
    addLog(`🖨️ Preparing to print: ${imagePath}`);
    const command = `powershell -command "Start-Process -FilePath '${imagePath}' -Verb Print"`;
}

function checkCameraConnection() {
    return new Promise((resolve) => {
        http.get('http://127.0.0.1:5513/liveview.jpg', (res) => {
            if (res.statusCode === 200) {
                resolve(true);
            } else {
                resolve(false);
            }
        }).on('error', (e) => {
            resolve(false); 
        });
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
                    await generateCollage(currentSessionPhotos, collagePath, activeFilter);
                    const imageUrl = `http://localhost:3001/archive/${collageName}`;
                    
                    io.emit('collage_ready', imageUrl);
                    addLog(`SUCCESS: Collage generated and sent to frontend.`);
                    
                    printCollage(collagePath);
                    
                } catch (err) {
                    addLog(`ERROR: Sharp failed to stitch collage.`);
                } finally {
                    currentSessionPhotos = []; 
                    sessionInProgress = false; 
                }
            }, 3000); 
        }
    });
}

async function startSessionLoop(isFreePlay = false) {
    if (sessionInProgress) {
        addLog("> ⚠️ Session already processing. Ignoring duplicate command.");
        return; 
    }
    
    sessionInProgress = true; 

    addLog("> 🔍 Running Pre-Flight Hardware Diagnostics...");

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

    addLog("> ✅ Diagnostics passed. System Secured.");
    
    if (!isFreePlay) {
        availableBalance -= SESSION_COST;
        io.emit('hardware_update', { type: 'balance', value: availableBalance });
        addLog(`> 💸 Payment Accepted: ${SESSION_COST} PHP deducted. Remaining Balance: ${availableBalance} PHP.`);
    } else {
        addLog(`> 🆓 Free Play Enabled: No balance deducted.`);
    }
    
    currentSessionPhotos = [];
    
    // NEW: Save total sessions directly to the drive
    totalSessions++;
    saveStats();
    
    io.emit('audit_update', { revenue: totalRevenue, sessions: totalSessions });
    io.emit('hardware_update', { type: 'trigger', value: 'START' });

    let photoCount = 0;

    function runPhotoCycle() {
        let prepTime = 10;
        addLog(`> ⏳ GETTING READY FOR PHOTO ${photoCount + 1}...`);
        
        io.emit('countdown_tick', prepTime); 
        addLog(`> ⏱️ ${prepTime}...`);

        sequenceInterval = setInterval(() => {
            prepTime--; 
            io.emit('countdown_tick', prepTime);
            addLog(`> ⏱️ ${prepTime}...`);
            
            if (prepTime === 0) {
                clearInterval(sequenceInterval);
                addLog(`> 📸 TAKING PHOTO ${photoCount + 1}...`);
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

const arduinoPort = 'COM9'; 
const port = new SerialPort({ path: arduinoPort, baudRate: 115200, autoOpen: false });
const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

port.on('error', (err) => {
    arduinoConnected = false;
    addLog(`ERROR: 🔌 Arduino connection lost!`);
});

port.on('close', () => {
    arduinoConnected = false;
    addLog(`ERROR: 🔌 Arduino unplugged!`);
});

port.open((err) => {
    if (err) {
        arduinoConnected = false;
        addLog(`ERROR: 🔌 Could not find Arduino on ${arduinoPort}.`);
    } else {
        arduinoConnected = true;
        addLog(`> 🔌 System linked to Arduino on ${arduinoPort}`);
    }
});

parser.on('data', (data) => {
    const cleanData = data.trim();
    addLog(cleanData); 

    if (cleanData.includes('FILTER')) {
        io.emit('hardware_update', { type: 'filter', value: cleanData });
        activeFilter = cleanData.replace('FILTER:', '').trim();
        
    } else if (cleanData.includes('TRIGGER: START') || cleanData.includes('BUTTON_CLICKED')) {
        
        if (availableBalance >= SESSION_COST) {
            startSessionLoop(false); 
        } else {
            addLog(`ERROR: ❌ INSUFFICIENT FUNDS. Balance: ${availableBalance} PHP (Requires ${SESSION_COST} PHP).`);
        }
        
    } else if (cleanData.includes('BALANCE:')) {
        const currentArduinoVal = parseInt(cleanData.split(':')[1]);
        
        if (currentArduinoVal > arduinoTotal) {
            const newlyInserted = currentArduinoVal - arduinoTotal;
            availableBalance += newlyInserted;
            
            // NEW: Save revenue directly to the drive
            totalRevenue += newlyInserted;
            saveStats();
            
            arduinoTotal = currentArduinoVal;
            
            io.emit('audit_update', { revenue: totalRevenue, sessions: totalSessions });
            io.emit('pulse_received'); 
            io.emit('hardware_update', { type: 'balance', value: availableBalance });
        }
    }
});

io.on('connection', (socket) => {
    
    socket.on('request_sync', () => {
        socket.emit('audit_update', { revenue: totalRevenue, sessions: totalSessions });
        socket.emit('hardware_update', { type: 'balance', value: availableBalance }); 
        socket.emit('terminal_history', terminalHistory);
    });

    socket.on('session_complete', () => { port.write("SESSION_COMPLETE\n"); });
    
    socket.on('clear_terminal', () => {
        terminalHistory = ['> Terminal cleared by operator.'];
        io.emit('terminal_history', terminalHistory); 
    });

    socket.on('set_filter', (filterName) => {
        activeFilter = filterName;
        io.emit('hardware_update', { type: 'filter', value: `FILTER: ${filterName}` });
        addLog(`> 🎨 OPERATOR OVERRIDE: Filter set to ${filterName}`);
    });
    
    socket.on('force_start', () => {
        addLog(`> ⚠️ OPERATOR OVERRIDE: FORCE START INITIALIZED`);
        startSessionLoop(true); 
    });
    
    socket.on('abort_session', () => {
        addLog(`> 🛑 OPERATOR OVERRIDE: SESSION ABORTED`);
        clearInterval(sequenceInterval);
        clearTimeout(sequenceTimeout);
        sessionInProgress = false;
        currentSessionPhotos = [];
        port.write("SESSION_COMPLETE\n");
        io.emit('hardware_update', { type: 'status', value: 'IDLE' });
    });

    // --- NEW: RESTART SYSTEM LISTENER ---
    socket.on('restart_system', () => {
        addLog(`> 🔄 OPERATOR COMMAND: SYSTEM REBOOTING IN 3 SECONDS...`);
        
        // Give the UI time to show the log message before cutting power
        setTimeout(() => {
            // Spawn a cloned, detached process of the exact command that started this one
            const child = spawn(process.argv[0], process.argv.slice(1), {
                detached: true,
                stdio: 'inherit'
            });
            child.unref(); // Detach the new process from the old one
            process.exit(); // Kill the current running script
        }, 3000);
    });
});

async function generateCollage(photos, outputPath, filterType) {
    try {
        const resizedImages = await Promise.all(
            photos.map(async (photoPath) => {
                let img = sharp(photoPath).resize(800, 600, { fit: 'cover' });
                
                if (filterType === 'NOIR') {
                    img = img.grayscale().linear(1.25, -10);
                } 
                else if (filterType === 'FILM_II') {
                    img = img.modulate({ saturation: 1.3, brightness: 1.05 })
                             .recomb([
                                 [1.1, 0.0, 0.0],  
                                 [0.0, 1.05, 0.0], 
                                 [0.0, 0.0, 0.9]   
                             ]);
                }
                
                return img.toBuffer();
            })
        );
        await sharp({
            create: { width: 900, height: 2700, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
        }).composite([
            { input: resizedImages[0], top: 50, left: 50 },
            { input: resizedImages[1], top: 700, left: 50 },
            { input: resizedImages[2], top: 1350, left: 50 },
            { input: resizedImages[3], top: 2000, left: 50 }
        ]).jpeg({ quality: 90 }).toFile(outputPath);

        photos.forEach(photoPath => { if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath); });
    } catch (error) { throw error; }
}

server.listen(PORT, () => console.log(`🚀 FLIK Master Backend running on port ${PORT}`));