// src/js/app.js
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const user = document.getElementById('username').value;
            const pass = document.getElementById('password').value;
            if (user === 'admin' && pass === 'flik1970') {
                window.location.href = 'dashboard.html'; 
            } else {
                alert('Access Denied');
            }
        });
    }
});