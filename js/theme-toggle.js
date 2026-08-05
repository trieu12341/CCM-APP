// theme-toggle.js

function applyTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
    }
    
    // Dispatch custom event for charts (ApexCharts/Chart.js) to re-render
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: theme } }));
}

function toggleTheme() {
    let currentTheme = localStorage.getItem('ccm_theme') || 'light';
    let newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    localStorage.setItem('ccm_theme', newTheme);
    applyTheme(newTheme);
    updateToggleIcon(newTheme);
}

function updateToggleIcon(theme) {
    const toggleBtn = document.getElementById('theme-toggle-btn');
    if (!toggleBtn) return;
    
    if (theme === 'dark') {
        toggleBtn.innerHTML = '<i class="fa-solid fa-sun" style="font-size: 20px;"></i>';
    } else {
        toggleBtn.innerHTML = '<i class="fa-solid fa-moon" style="font-size: 20px;"></i>';
    }
}

// Initialize theme on load (must be called immediately to avoid flash of wrong theme)
(function initTheme() {
    let savedTheme = localStorage.getItem('ccm_theme');
    if (!savedTheme) {
        // Fallback to light theme if no preference
        savedTheme = 'light';
    }
    applyTheme(savedTheme);
    
    // Wait for DOM to load to attach events
    document.addEventListener('DOMContentLoaded', () => {
        // Find and attach event listener if the button is loaded asynchronously
        // Since topbar is loaded dynamically via loadComponent, we use event delegation
        document.body.addEventListener('click', function(e) {
            const btn = e.target.closest('#theme-toggle-btn');
            if (btn) {
                toggleTheme();
            }
        });
        
        // Polling to update icon once topbar is loaded dynamically
        const observer = new MutationObserver((mutations) => {
            if (document.getElementById('theme-toggle-btn')) {
                updateToggleIcon(localStorage.getItem('ccm_theme') || 'light');
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    });
})();
