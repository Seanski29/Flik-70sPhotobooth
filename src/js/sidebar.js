const sidebarHTML = `
    <style>
        /* Scales up the sidebar elements */
        .sidebar-nav ul li a { font-size: 18px; padding: 18px 20px; display: flex; align-items: center; gap: 15px;}
        .sidebar-nav ul li a svg { width: 28px; height: 28px; }
        .btn-logout { font-size: 18px; padding: 18px 20px; display: flex; align-items: center; gap: 15px; }
    </style>
    <aside class="sys-sidebar">
        <div class="sidebar-brand">
            <h1 class="brand-text">FLIK</h1>
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
                    The Vault
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
    }
});