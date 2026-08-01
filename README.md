# ⚡ FLIK Photobooth Event System

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)
![Electron](https://img.shields.io/badge/built%20with-Electron-47848f.svg)

**FLIK** is a robust, hardware-integrated desktop application designed to power professional live-event photobooths. Built with Electron and Node.js, it acts as a central command center that bridges physical hardware (Arduino, coin slots, arcade buttons) with high-end photography equipment (DSLR cameras) to deliver automated, instant photo prints.

---

## ✨ Key Features

*   **📸 Automated Capture Sequence:** Seamless 4-photo burst triggered by physical arcade buttons, complete with audio countdowns and live dashboard feedback.
*   **🪙 Hardware Integration:** Real-time serial communication with an Arduino master controller to process coin drops and physical filter toggles.
*   **🎨 Dynamic Image Processing:** On-the-fly photo stitching and color grading (Noir and Film II vintage filters) utilizing the `sharp` image processing matrix.
*   **🖨️ Instant Printing:** Automated 4x6 photo strip generation dispatched directly to the default Windows printer.
*   **💻 Operator Command Center:** A fully responsive UI featuring a live DSLR camera preview, manual overrides, hardware status indicators, and session logs.
*   **💰 The Vault & Archive:** Persistent local database tracking lifetime revenue, session counts, and an archive grid to reprint or manage past sessions.

---

## 🛠️ Tech Stack

**Frontend (UI/UX)**
*   HTML5 / CSS3 (Custom responsive grid & flexbox architecture)
*   Vanilla JavaScript
*   Custom SVG Iconography 

**Backend & Desktop Wrapper**
*   **Electron & Electron-Builder:** Desktop application packaging and window management.
*   **Node.js & Express:** Local background server handling file routing and APIs.
*   **Socket.io:** Bi-directional real-time communication between the UI and hardware backend.
*   **SerialPort:** Direct USB communication with the Arduino controller.
*   **Sharp:** High-performance Node.js module for image resizing, filtering, and collage stitching.

**Third-Party Dependencies**
*   **digiCamControl:** Command-line tethering software for DSLR camera triggering.

---

## 📋 Hardware Requirements

To run the FLIK system at full capacity, the following hardware is required:
1.  **Windows PC/Laptop** running the FLIK `.exe` application.
2.  **DSLR Camera** connected via USB.
3.  **Arduino Microcontroller** (e.g., Uno/Mega) connected via USB (defaulted to `COM9`).
4.  **Coin Acceptor & Arcade Buttons** wired to the Arduino.
5.  **Photo Printer** set as the default Windows printer.

---

## 🚀 Installation & Setup (Developer Environment)

### 1. Prerequisites
*   Install [Node.js](https://nodejs.org/) (LTS version).
*   Install [Visual Studio Community](https://visualstudio.microsoft.com/vs/community/) (Ensure **Desktop development with C++** is checked to compile `serialport` bindings).
*   Install [digiCamControl](https://digicamcontrol.com/) and ensure your camera is recognized.

### 2. Clone and Install
```bash
# Clone the repository
git clone [https://github.com/yourusername/flik-photobooth.git](https://github.com/yourusername/flik-photobooth.git)

# Navigate into the directory
cd flik-photobooth

# Install dependencies (this will compile C++ binaries via node-gyp)
npm install

```

### 3. Run in Developer Mode

Ensure your Arduino is plugged in and digiCamControl is open, then start the application:

```bash
npm start

```

### 4. Build for Production

To package the software into a standalone `.exe` installer for deployment on event machines:

```bash
npm run build

```

The compiled installer will be located in the newly generated `dist` folder.

---

## 📂 Project Structure

```text
FLIK_SOFTWARE/
├── build/                  # Contains application icons (icon.png)
├── assets/                 # Static assets (Logos, background UI, audio)
├── src/
│   ├── archive/            # Local storage for raw captures and final prints
│   ├── arduino/            # .ino files for the master controller
│   ├── css/                # style.css (Master stylesheet)
│   ├── html/               # UI Views (login, dashboard, archive, revenue)
│   └── js/
│       ├── app.js          # Core frontend logic
│       ├── server.js       # Background Node.js hardware/API server
│       └── sidebar.js      # Dynamic navigation component
├── stats.json              # Persistent revenue/session database
├── main.js                 # Electron entry point and process manager
└── package.json            # Build scripts and dependencies

```

---

## 🔒 License

This project is proprietary software built for the FLIK Photobooth system. All rights reserved.

```

```
