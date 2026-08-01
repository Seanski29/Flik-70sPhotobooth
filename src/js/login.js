const loginForm = document.getElementById('login-form');
const errorMessage = document.getElementById('error-message'); // Grab the new error text

loginForm.addEventListener('submit', function(event) {
    event.preventDefault(); 

    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;

    // --- YOUR SECURE CREDENTIALS ---
    const correctUser = "admin";
    const correctPass = "admin123";

    if (user === correctUser && pass === correctPass) {
        // SUCCESS: Hide any previous errors, show the pre-flight modal.
        errorMessage.style.display = 'none';
        document.getElementById('digicamModal').style.display = 'flex';
    } else {
        // FAILURE: Show the custom red error text on the screen
        errorMessage.style.display = 'block';
        
        // Clear the password field
        const passInput = document.getElementById('password');
        passInput.value = '';
        
        // Force the cursor back into the password box for immediate re-typing!
        passInput.focus();
        
        // Ensure the modal absolutely stays hidden
        document.getElementById('digicamModal').style.display = 'none';
    }
});