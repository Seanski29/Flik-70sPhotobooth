const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { SerialPort, ReadlineParser } = require('serialport');
const sharp = require('sharp'); // NEW: The image processor

// 1. Initialize Server & Socket.io
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const PORT = 3001;
app.use(cors());
app.use(express.json());

// Serve the archive folder so the HTML can display the images
app.use('/archive', express.static('D:\\FLIKR_ARCHIVE')); 

// 2. Storage Setup
const masterFolder = 'D:\\FLIKR_ARCHIVE';
if (!fs.existsSync(masterFolder)) fs.mkdirSync(masterFolder, { recursive: true });

// Session Variables
let currentSessionPhotos = [];
let activeFilter = 'COLOR'; // Default

// 3. Arduino Serial Connection
const arduinoPort = 'COM7';
const port = new SerialPort({ path: arduinoPort, baudRate: 9600, autoOpen: false });
const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

port.on('error', (err) => console.log(`⚠️ Arduino Serial Error: ${err.message}`));
port.open((err) => {
    if (err) console.log(`⚠️ Arduino not found on ${arduinoPort}.`);
    else console.log(`🔌 Arduino successfully connected on ${arduinoPort}`);
});

parser.on('data', (data) => {
    const cleanData = data.trim();
    console.log(`[ARDUINO]: ${cleanData}`);
    
    if (cleanData.includes('FILTER')) {
        if (cleanData.includes('COLOR')) activeFilter = 'COLOR';
        if (cleanData.includes('B&W')) activeFilter = 'B&W';
        if (cleanData.includes('VINTAGE')) activeFilter = 'VINTAGE';
        io.emit('hardware_update', { type: 'filter', value: cleanData });
    } else if (cleanData.includes('TRIGGER')) {
        currentSessionPhotos = []; // Reset array for new session
        io.emit('hardware_update', { type: 'trigger', value: 'START' });
    }
});

// 4. Dashboard Connection & Image Processing
io.on('connection', (socket) => {
    console.log('💻 Dashboard successfully connected to server!');
    
    socket.on('fire_camera', () => {
const timestamp = Date.now();
    const savePath = path.join(masterFolder, `raw_${timestamp}.jpg`);
    
    // UPDATE THESE TWO LINES:
    // Use 'RemoteCmd' to talk instantly to the open application
    const digiCamPath = '"C:\\Program Files (x86)\\digiCamControl\\CameraControlRemoteCmd.exe"';
    const command = `${digiCamPath} /c capture "${savePath}"`;
        
        exec(command, async (error) => {
            if (error) {
                console.error(`❌ Camera Error: ${error.message}`);
                // Fallback: If camera fails, we stop so it doesn't break the collage
                return;
            }
            console.log(`📸 Photo captured! Saved raw to: ${savePath}`);
            currentSessionPhotos.push(savePath);

            // If we have 4 photos, generate the collage!
            if (currentSessionPhotos.length === 4) {
                console.log("🎞️ 4 Photos captured. Stitching collage...");
                const collageName = `collage_${Date.now()}.jpg`;
                const collagePath = path.join(masterFolder, collageName);
                
                try {
                    await generateCollage(currentSessionPhotos, collagePath, activeFilter);
                    
                    // Tell dashboard to show the image
                    const imageUrl = `http://localhost:3001/archive/${collageName}`;
                    io.emit('collage_ready', imageUrl);
                    
                    // Reset array for the next user
                    currentSessionPhotos = []; 
                } catch (err) {
                    console.error("❌ Failed to generate collage:", err);
                }
            }
        });
    });
});

// --- SHARP IMAGE PROCESSOR LOGIC ---
async function generateCollage(photos, outputPath, filterType) {
    try {
        // 1. Resize all 4 photos
        const resizedImages = await Promise.all(
            photos.map(async (photoPath) => {
                let img = sharp(photoPath).resize(800, 600, { fit: 'cover' });
                
                if (filterType === 'B&W') img = img.grayscale();
                else if (filterType === 'VINTAGE') img = img.grayscale().tint({ r: 112, g: 66, b: 20 });
                
                return img.toBuffer();
            })
        );

        // 2. Composite (stack) the images onto a 900x2700 canvas
        await sharp({
            create: { width: 900, height: 2700, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
        })
        .composite([
            { input: resizedImages[0], top: 50, left: 50 },
            { input: resizedImages[1], top: 700, left: 50 },
            { input: resizedImages[2], top: 1350, left: 50 },
            { input: resizedImages[3], top: 2000, left: 50 }
        ])
        .jpeg({ quality: 90 })
        .toFile(outputPath);

        console.log(`✅ Collage generated: ${outputPath}`);

        // 3. CLEANUP: Delete the 4 raw photos so only the collage remains
        photos.forEach(photoPath => {
            if (fs.existsSync(photoPath)) {
                fs.unlinkSync(photoPath);
                console.log(`🗑️ Deleted raw file: ${photoPath}`);
            }
        });

    } catch (error) {
        console.error("❌ Sharp Processing Error:", error);
        throw error;
    }
}

// Start Server (Keep your API endpoints above this untouched!)
server.listen(PORT, () => console.log(`🚀 FLIK Master Backend running on port ${PORT}`));