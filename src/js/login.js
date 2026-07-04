// Wait for the DOM to fully load
document.addEventListener('DOMContentLoaded', () => {
    
    // Grab the login form
    const loginForm = document.getElementById('login-form');

    // Add a submit event listener
    if (loginForm) {
        loginForm.addEventListener('submit', (event) => {
            // Prevent the form from refreshing the page (default browser behavior)
            event.preventDefault();

            // Grab the values the operator typed in
            const usernameInput = document.getElementById('username').value;
            const passwordInput = document.getElementById('password').value;

            // Simple hardcoded authentication for the operator
            // Note: In a production app, we'd hash this or check a database
            if (usernameInput === 'admin' && passwordInput === 'flik1970') {
                
                console.log('Login successful! Redirecting to Dashboard...');
                
                // Redirect the window to the dashboard page
                // Adjust the path if your dashboard.html is named differently!
                window.location.href = 'dashboard.html'; 
                
            } else {
                // If the credentials fail, alert the user and clear the password field
                alert('Access Denied: Incorrect Username or Password.');
                document.getElementById('password').value = '';
            }
        });
    }
});