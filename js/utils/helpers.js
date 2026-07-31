window.collapseSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.add('sidebar-collapsed');
};

window.expandSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('sidebar-collapsed');
};

document.addEventListener('componentsLoaded', () => {
    // Scenario 1 & 2: Observe modals
    const observer = new MutationObserver(() => {
        const openModals = document.querySelectorAll('.modal-overlay:not(.hidden)');
        // Ignore small modals if needed, but for now collapse on any open modal
        if (openModals.length > 0) {
            window.collapseSidebar();
        } else {
            window.expandSidebar();
        }
    });

    observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['class'],
        subtree: true
    });

    // Scenario 3: Click on menu-item while collapsed
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            const sidebar = document.getElementById('sidebar');
            if (sidebar && sidebar.classList.contains('sidebar-collapsed')) {
                // Close all modals
                document.querySelectorAll('.modal-overlay').forEach(modal => {
                    modal.classList.add('hidden');
                });
                document.body.classList.remove('modal-open');
                window.expandSidebar();
            }
        });
    });
});
