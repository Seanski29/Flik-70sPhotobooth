const sidebarHTML = `
    <style>
        /* Scales up the sidebar elements */
        .sidebar-nav ul li a { font-size: 18px; padding: 18px 20px; display: flex; align-items: center; gap: 15px;}
        .sidebar-nav ul li a svg { width: 28px; height: 28px; }
        .btn-logout { font-size: 18px; padding: 18px 20px; display: flex; align-items: center; gap: 15px; }

        /* Brand/logo fit adjustments */
        .sidebar-brand { padding: 12px; display:flex; align-items:center; justify-content:center; }
        .sidebar-brand img { max-width: 100%; max-height: 64px; width: auto; height: auto; display: block; }

        /* Logout modal styles */
        .logout-modal-overlay { position: fixed; inset: 0; display: none; align-items: center; justify-content: center; background: rgba(0,0,0,0.45); z-index: 9999; }
        .logout-modal { background: #fff; padding: 20px; border-radius: 8px; width: 320px; box-shadow: 0 6px 18px rgba(0,0,0,0.15); text-align: left; }
        .logout-modal h2 { margin: 0 0 8px 0; font-size: 18px; }
        .logout-modal p { margin: 0 0 16px 0; color: #333; }
        .logout-modal-actions { display:flex; justify-content:flex-end; gap:10px; }
        .logout-modal-actions button { padding: 8px 12px; border-radius: 6px; border: none; cursor: pointer; }
        .logout-cancel { background: #f0f0f0; }
        .logout-confirm { background: #d9534f; color: #fff; }
    </style>
    <aside class="sys-sidebar">
        <div class="sidebar-brand" size="small">
            <img src="../../assets/Logo.png" alt="FLIK Logo">
        </div>
        
        <nav class="sidebar-nav">
            <ul>
                <li><a href="dashboard.html">
                    <svg class="nav-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                    Dashboard
                </a></li>
                <li><a href="archive.html">
                    <svg class="nav-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                    Archive
                </a></li>
                <li><a href="revenue.html">
                    <svg class="nav-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                    Revenue
                </a></li>
                <li><a href="settings.html">
                    <svg class="nav-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    Settings
                </a></li>
            </ul>
        </nav>

        <div class="sidebar-footer">
            <a href="login.html" class="btn-logout">
                <svg class="nav-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                Exit
            </a>
        </div>
    </aside>

    <!-- Logout modal injected into the sidebar HTML so it stays local to the component -->
    <div class="logout-modal-overlay" aria-hidden="true">
        <div class="logout-modal" role="dialog" aria-modal="true" aria-labelledby="logout-title">
            <h2 id="logout-title">Confirm Logout</h2>
            <p>Are you sure you want to log out?</p>
            <div class="logout-modal-actions">
                <button class="logout-cancel" type="button">Cancel</button>
                <button class="logout-confirm" type="button">Log out</button>
            </div>
        </div>
    </div>
`;

document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("sidebar-container");
    if (container) {
        container.innerHTML = sidebarHTML;
        const currentPage = window.location.pathname.split("/").pop();
        const navLinks = container.querySelectorAll(".sidebar-nav a");
        navLinks.forEach(link => {
            if (link.getAttribute("href") === currentPage) {
                link.parentElement.classList.add("active");
            }
        });
            
            // Replace browser confirm with custom modal UI
            const logoutLink = container.querySelector('.btn-logout');
            const overlay = container.querySelector('.logout-modal-overlay');
            const confirmBtn = container.querySelector('.logout-confirm');
            const cancelBtn = container.querySelector('.logout-cancel');
            let targetHref = null;

            function showModal(href) {
                targetHref = href;
                overlay.style.display = 'flex';
                overlay.setAttribute('aria-hidden', 'false');
                // focus the cancel button for a safe default
                cancelBtn && cancelBtn.focus();
            }

            function hideModal() {
                overlay.style.display = 'none';
                overlay.setAttribute('aria-hidden', 'true');
                targetHref = null;
            }

            if (logoutLink) {
                logoutLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    const href = logoutLink.getAttribute('href') || 'login.html';
                    showModal(href);
                });
            }

            if (confirmBtn) {
                confirmBtn.addEventListener('click', () => {
                    if (targetHref) window.location.href = targetHref;
                });
            }

            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => hideModal());
            }

            // Close when clicking outside the modal
            if (overlay) {
                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) hideModal();
                });
            }

            // Close on Escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && overlay && overlay.style.display === 'flex') hideModal();
            });
    }
});