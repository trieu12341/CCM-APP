import { renderOverviewDashboard } from './overview-ui.js';

export function initializeOverviewModule() {
    // When the Overview tab is opened, render the dashboard
    document.getElementById('menu-overview')?.addEventListener('click', () => {
        // Hide all modules
        document.querySelectorAll('.app-main > div[id^="module-"]').forEach(el => el.classList.add('hidden'));
        // Show Overview
        document.getElementById('module-overview').classList.remove('hidden');
        
        // Render
        renderOverviewDashboard();
    });
}
