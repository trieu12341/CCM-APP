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

    // Widget Click-through navigation
    const navMap = {
        'widget-budget': 'menu-budget',
        'widget-committed': 'menu-contract',
        'widget-expended': 'menu-payment',
        'widget-uncommitted': 'menu-budget',
        'widget-tender': 'menu-tender',
        'widget-contract': 'menu-contract',
        'widget-payment': 'menu-payment',
        'widget-cashflow': 'menu-cashflow'
    };

    Object.keys(navMap).forEach(widgetId => {
        const widget = document.getElementById(widgetId);
        if (widget) {
            widget.addEventListener('click', (e) => {
                // Trigger the corresponding menu item click
                const menuBtn = document.getElementById(navMap[widgetId]);
                if (menuBtn) {
                    menuBtn.click();
                }
            });
        }
    });
}
