window.bindEvent = function(id, event, handler) {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener(event, handler);
    }
};

window.isConsultancyContract = function(contractOrTender) {
    if (!contractOrTender) return false;
    if (contractOrTender.type) return contractOrTender.type === 'Consultancy';
    const name = (contractOrTender.contract_name || contractOrTender.package_name || contractOrTender.tender_name || '').toLowerCase();
    return name.includes('tư vấn') || name.includes('tv');
};

window.collapseSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.add('sidebar-collapsed');
};

window.expandSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('sidebar-collapsed');
};

window.openInlineWorkspace = function(workspaceId) {
    // 1. Hide Dashboard / Layer 1
    const m1 = document.getElementById('modules-1-container');
    const header = document.getElementById('project-header-container');
    const tabs = document.getElementById('project-tabs-container');
    if (m1) m1.classList.add('hidden');
    if (header) header.classList.add('hidden');
    if (tabs) tabs.classList.add('hidden');
    
    // 2. Hide all other Layer 2/3
    document.querySelectorAll('.modal-overlay.layer-2, .modal-overlay.layer-3').forEach(el => {
        el.classList.add('hidden');
    });

    // 3. Show target workspace
    const workspace = document.getElementById(workspaceId);
    if (workspace) {
        workspace.classList.remove('hidden');
    }

    // 4. Collapse Sidebar
    window.collapseSidebar();
    
    // Scroll top
    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.scrollTop = 0;
};

window.closeInlineWorkspace = function() {
    // 1. Hide all Layer 2/3
    document.querySelectorAll('.modal-overlay.layer-2, .modal-overlay.layer-3').forEach(el => {
        el.classList.add('hidden');
    });
    
    // 2. Show Dashboard / Layer 1
    const m1 = document.getElementById('modules-1-container');
    const header = document.getElementById('project-header-container');
    const tabs = document.getElementById('project-tabs-container');
    if (m1) m1.classList.remove('hidden');
    if (header) header.classList.remove('hidden');
    if (tabs) tabs.classList.remove('hidden');
    
    // 3. Expand Sidebar
    window.expandSidebar();

    // 4. Khôi phục cuộn
    document.body.classList.remove('overflow-hidden', 'modal-open');
    document.body.style.overflow = '';
    
    const mainContent = document.getElementById('main-content') || document.querySelector('.main-content') || document.querySelector('.content-wrapper');
    if (mainContent) {
        mainContent.classList.remove('overflow-hidden');
        mainContent.style.overflowY = 'auto';
    }
};

document.addEventListener('componentsLoaded', () => {
    // Scenario 3: Click on menu-item while collapsed
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            const sidebar = document.getElementById('sidebar');
            if (sidebar && sidebar.classList.contains('sidebar-collapsed')) {
                // Close all Layer 1 popups
                document.querySelectorAll('.modal-overlay:not(.layer-2):not(.layer-3)').forEach(modal => {
                    modal.classList.add('hidden');
                });
                document.body.classList.remove('modal-open');
                
                // Return to Dashboard Layer 1
                window.closeInlineWorkspace();
            }
        });
    });
});
