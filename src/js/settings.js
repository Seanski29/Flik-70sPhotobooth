document.addEventListener('DOMContentLoaded', () => {
    
    // A. Password Management
    const passwordForm = document.getElementById('password-form');
    const passwordError = document.getElementById('password-error');
    const passwordSuccess = document.getElementById('password-success');

    passwordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const currentPass = document.getElementById('current-password').value;
        const newPass = document.getElementById('new-password').value;

        // Note: In production, send this to server.js via fetch or socket.io to validate
        if (currentPass === "admin123") { // Placeholder validation
            passwordError.style.display = 'none';
            passwordSuccess.style.display = 'block';
            passwordForm.reset();
        } else {
            passwordSuccess.style.display = 'none';
            passwordError.style.display = 'block';
        }
    });

    // B. Volume Slider
    const volumeSlider = document.getElementById('volume-slider');
    const volumeDisplay = document.getElementById('volume-display');

    volumeSlider.addEventListener('input', (e) => {
        const volume = e.target.value;
        volumeDisplay.textContent = `${volume}%`;
        // Send volume command to backend
        // io.emit('update_volume', volume);
    });

    // C. Change File Location
    const browseBtn = document.getElementById('browse-btn');
    const savePathInput = document.getElementById('save-path');

    browseBtn.addEventListener('click', async () => {
        // This requires Electron's dialog module in your main.js
        // Example integration: const newPath = await window.electronAPI.selectFolder();
        // if (newPath) savePathInput.value = newPath;
        alert("Electron IPC required to open native Windows file explorer.");
    });

    // D. Monochrome Dark Mode
    const themeToggle = document.getElementById('theme-toggle');

    themeToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            document.body.classList.add('monochrome-mode');
        } else {
            document.body.classList.remove('monochrome-mode');
        }
    });

    // E. Legal Modals
    const legalModal = document.getElementById('legal-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalText = document.getElementById('modal-text');
    const closeModal = document.getElementById('close-modal');

    document.getElementById('btn-privacy').addEventListener('click', () => {
        modalTitle.textContent = "Privacy Policy";
        modalText.innerHTML = "<p>FLIK System does not connect to the open internet. All photographic data is stored locally on the designated storage drive. Operator data is encrypted locally.</p>";
        legalModal.style.display = 'flex';
    });

    document.getElementById('btn-eula').addEventListener('click', () => {
        modalTitle.textContent = "End User License Agreement";
        modalText.innerHTML = "<p>Proprietary software licensed exclusively to Scratch Solutions Inc. Unauthorized duplication, reverse engineering, or redistribution of the FLIK hardware or software architecture is strictly prohibited.</p>";
        legalModal.style.display = 'flex';
    });

    closeModal.addEventListener('click', () => {
        legalModal.style.display = 'none';
    });
});