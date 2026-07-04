# FLIK - Vintage Analog Photobooth

FLIK is a fully automated, 70s-inspired photobooth system designed to deliver a nostalgic, mechanical user experience. 

## Overview
Unlike modern digital photobooths, FLIK provides a headless, tactile experience for the consumer. The system uses a one-way mirror, physical arcade buttons, and toggle switches to simulate a vintage booth. The back-end automation manages payment processing, filter selection, and photo triggering, while a custom desktop application provides the operator with full diagnostic and configuration control.

## System Architecture
FLIK is built on a modular, two-tier architecture:
- [cite_start]**Hardware Layer (C++/Arduino):** An Arduino Mega 2560 handles real-time polling of bill acceptors, coin slots, arcade buttons, and toggle switches. [cite: 55, 167]
- **Software Layer (Node.js/Electron):** A custom desktop application providing the operator dashboard for system monitoring, timer configuration, and diagnostic logging.

## Technical Stack
- [cite_start]**Hardware:** Arduino Mega 2560, NV9/ICT A7 Bill Acceptor, WS2812B LEDs, Relay Modules. [cite: 55, 136, 137, 187]
- **Front-End:** Electron.js, HTML5, CSS3, JavaScript.
- **Backend:** Node.js (serialport library).
- **Communication:** USB Serial Protocol.

## Key Features
- [cite_start]**Analog User Experience:** Start button, multi-position filter toggle, and physical bill/coin validation. [cite: 56]
- [cite_start]**Automated Workflow:** From payment insertion to automatic print spooling and filter application. [cite: 53]
- **Operator Control:** Password-protected dashboard for adjusting countdown timers, viewing system status, and testing hardware components.
- **Diagnostic Mode:** Real-time serial monitoring and manual test-fire triggers for camera/printer calibration.

## Deployment
1. **Hardware:** Flash the `arduino_firmware.ino` to the Mega 2560.
2. **Software:** Install dependencies using `npm install`.
3. **Execution:** Launch the application via `npm start` or build the executable using `npm run build`.

## Project Status
Currently in the development phase:
- [x] [cite_start]Hardware component selection. [cite: 55]
- [x] Operator dashboard UI design.
- [ ] Serial communication protocol implementation.
- [ ] Final assembly and calibration.

---
*Est. 2026 | Developed for Information Assurance and Security academic project.*
