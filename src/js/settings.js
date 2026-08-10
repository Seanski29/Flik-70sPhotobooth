document.addEventListener('DOMContentLoaded', () => {
    
    // A. Password Management
    const passwordForm = document.getElementById('password-form');
    const passwordError = document.getElementById('password-error');
    const passwordSuccess = document.getElementById('password-success');

    passwordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const currentPass = document.getElementById('current-password').value;
        const newPass = document.getElementById('new-password').value;

        // Fetch current active password for validation
        const savedPassword = localStorage.getItem('operator_password') || "admin123";

        if (currentPass === savedPassword) { 
            // SAVE THE NEW PASSWORD GLOBALLY
            localStorage.setItem('operator_password', newPass);

            passwordError.style.display = 'none';
            passwordSuccess.style.display = 'block';
            passwordForm.reset();

            // Hide success message after 3 seconds for clean UI
            setTimeout(() => { passwordSuccess.style.display = 'none'; }, 3000);
        } else {
            passwordSuccess.style.display = 'none';
            passwordError.style.display = 'block';
        }
    });

    // B. Legal Modals
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