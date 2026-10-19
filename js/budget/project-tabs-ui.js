/**
 * project-tabs-ui.js — Ô chọn dự án trên topbar và xử lý khi đổi dự án.
 */
import { state } from '../app.js';
import { renderContracts } from '../contract.js';
import { renderCashflow } from '../cashflow.js';
import { renderDashboard } from './budget-ui.js';

export function renderProjectTabs() {
    const selectEl = document.getElementById('project-select');
    if (!selectEl) return;
    
    selectEl.innerHTML = '';
    state.appData.Projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.project_id;
        option.textContent = project.project_name;
        if (project.project_id === state.currentProjectId) {
            option.selected = true;
        }
        selectEl.appendChild(option);
    });

    // Handle project change
    selectEl.onchange = (e) => {
        state.currentProjectId = e.target.value;
        localStorage.setItem('ccm_current_project_id', state.currentProjectId);
        
        // Notify app to change realtime subscription
        document.dispatchEvent(new CustomEvent('projectSwitched', { detail: state.currentProjectId }));
        
        renderDashboard();
        renderContracts();
        
        const menuCashflow = document.getElementById('menu-cashflow');
        if (menuCashflow && menuCashflow.classList.contains('active')) {
            renderCashflow();
        }
        // Also re-render Overview if active
        const menuOverview = document.getElementById('menu-overview');
        if (menuOverview && menuOverview.classList.contains('active')) {
            if (window.renderOverviewDashboard) window.renderOverviewDashboard();
        }
    };

    // Add project button listener
    const addBtn = document.getElementById('btn-add-project');
    if (addBtn) {
        addBtn.onclick = () => {
            document.getElementById('new-project-form').reset();
            document.getElementById('new-project-modal').classList.remove('hidden');
        };
    }

    // Info project button listener
    const infoBtn = document.getElementById('btn-project-info');
    if (infoBtn) {
        infoBtn.onclick = () => {
            if (window.openProjectSummary) window.openProjectSummary();
        };
    }
}
