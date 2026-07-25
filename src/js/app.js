// src/js/app.js

// 1. Initialize Socket Connection to Backend
// (Make sure socket.io is linked in your HTML files for this to work)
const socket = io('http://localhost:3001');

// 2. Pre-load the single 10-second countdown track (Option A)
// Make sure you place your downloaded mp3 in this exact folder path!
const countdownAudio = new Audio('../../assets/10_sec_countdown.mp3');

// 3. Listen for the countdown from the server
socket.on('countdown_tick', (second) => {
    // Only play it when the timer hits exactly 10
    if (second === 10) {
        countdownAudio.currentTime = 0; // Reset to start
        
        // The .catch prevents the console from throwing an error 
        // if the browser's autoplay policy blocks it.
        countdownAudio.play().catch(err => {
            console.log("Audio waiting for user interaction:", err);
        });
    }
});

// 4. Handle Dashboard Login
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