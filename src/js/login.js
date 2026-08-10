const loginForm = document.getElementById('login-form');
const errorMessage = document.getElementById('error-message'); 

// Track failed login attempts
let failedAttempts = 0;
const MASTER_KEY = "56119028";

loginForm.addEventListener('submit', function(event) {
    event.preventDefault(); 

    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;

    const correctUser = "admin";
    // Fetch saved password: Defaults to admin123 if they haven't changed it yet
    const savedPassword = localStorage.getItem('operator_password') || "admin123";

    // Determine if the masterkey is active and being used
    const isMasterKeyOverride = (failedAttempts >= 3 && pass === MASTER_KEY);

    if (user === correctUser && (pass === savedPassword || isMasterKeyOverride)) {
        // SUCCESS: Hide errors, show modal, reset failed attempts
        errorMessage.style.display = 'none';
        document.getElementById('digicamModal').style.display = 'flex';
        failedAttempts = 0; 
        
        // If they used the master key, optionally reset the stored password back to default
        if (isMasterKeyOverride) {
            localStorage.setItem('operator_password', 'admin123');
            console.log("System unlocked via Masterkey. Operator password reset to default.");
        }
    } else {
        // FAILURE: Increment attempts and show errors
        failedAttempts++;
        
        // Update the error text dynamically based on attempt count
        if (failedAttempts >= 3) {
            errorMessage.textContent = "Maximum attempts reached. System locked. Masterkey required.";
            errorMessage.style.color = "#ef4444"; // Ensure it stays red
        } else {
            errorMessage.textContent = `Incorrect password. Attempts remaining: ${3 - failedAttempts}`;
        }
        
        errorMessage.style.display = 'block';
        
        // Clear the password field and refocus
        const passInput = document.getElementById('password');
        passInput.value = '';
        passInput.focus();
        
        // Ensure the modal absolutely stays hidden
        document.getElementById('digicamModal').style.display = 'none';
    }
});