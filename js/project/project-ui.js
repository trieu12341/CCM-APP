import { state } from '../app.js';
import { renderDashboard, renderProjectTabs } from '../budget.js';
import { getLocalProjects } from './project-state.js';


export function openSummaryModal() {
    const projectId = state.currentProjectId;
    if (!projectId) return;

    const projects = getLocalProjects();
    let project = projects.find(p => p.project_id === projectId);
    
    if (!project) {
        project = state.appData.Projects.find(p => p.project_id === projectId);
        if (!project) return;
    }

    document.getElementById('summary-name-view').textContent = project.project_name || '-';
    document.getElementById('summary-scale-view').textContent = project.scale || '-';
    document.getElementById('summary-location-view').textContent = project.location || '-';
    document.getElementById('summary-start-date-view').textContent = project.start_date ? new Date(project.start_date).toLocaleDateString('en-GB') : '-';
    document.getElementById('summary-end-date-view').textContent = project.end_date ? new Date(project.end_date).toLocaleDateString('en-GB') : '-';
    document.getElementById('summary-cfa-view').textContent = project.cfa || '-';
    document.getElementById('summary-consultants-view').textContent = project.consultants || '-';
    
    // Format budget if needed. Assume it's stored as number or string.
    const budgetValue = project.total_budget || 0;
    document.getElementById('summary-budget-view').textContent = budgetValue ? Number(budgetValue).toLocaleString('vi-VN') + ' VNĐ' : '-';
    document.getElementById('summary-status-view').textContent = project.status || '-';
    
    const imgView = document.getElementById('summary-img-view');
    const imgPlaceholder = document.getElementById('summary-img-placeholder');
    if (project.image_url) {
        imgView.src = project.image_url;
        imgView.style.display = 'block';
        imgPlaceholder.style.display = 'none';
    } else {
        imgView.style.display = 'none';
        imgPlaceholder.style.display = 'flex';
    }

    document.getElementById('summary-name-input').value = project.project_name || '';
    document.getElementById('summary-scale-input').value = project.scale || '';
    document.getElementById('summary-location-input').value = project.location || '';
    
    const formatForInput = (d) => {
        if (!d) return '';
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return '';
        return dt.toISOString().split('T')[0];
    };
    document.getElementById('summary-start-date-input').value = formatForInput(project.start_date);
    document.getElementById('summary-end-date-input').value = formatForInput(project.end_date);
    
    document.getElementById('summary-cfa-input').value = project.cfa || '';
    document.getElementById('summary-consultants-input').value = project.consultants || '';
    document.getElementById('summary-budget-input').value = project.total_budget ? Number(project.total_budget).toLocaleString('en-US') : '';
    document.getElementById('summary-status-input').value = project.status || 'Planning';
    document.getElementById('summary-img-input').value = project.image_url || '';

    document.getElementById('summary-view-mode').classList.remove('hidden');
    document.getElementById('summary-edit-mode').classList.add('hidden');
    document.getElementById('summary-img-edit-wrap').classList.add('hidden');
    document.getElementById('btn-edit-summary').classList.remove('hidden');
    document.getElementById('btn-save-summary').classList.add('hidden');

    document.getElementById('projectInfoModal').classList.remove('hidden');
}

export async function saveSummaryData() {
    const projectId = state.currentProjectId;
    if (!projectId) return;

    // Find project in state
    const stateProjIndex = state.appData.Projects.findIndex(p => p.project_id === projectId);
    if (stateProjIndex === -1) return;

    // Read form values into the project object
    const project = { ...state.appData.Projects[stateProjIndex] };
    project.project_name     = document.getElementById('summary-name-input').value.trim();
    project.scale            = document.getElementById('summary-scale-input').value.trim();
    project.location         = document.getElementById('summary-location-input').value.trim();
    project.start_date       = document.getElementById('summary-start-date-input').value.trim();
    project.end_date         = document.getElementById('summary-end-date-input').value.trim();
    project.cfa              = document.getElementById('summary-cfa-input').value.trim();
    project.consultants      = document.getElementById('summary-consultants-input').value.trim();
    
    // Parse budget input
    const rawBudget = document.getElementById('summary-budget-input').value;
    project.total_budget     = rawBudget ? Number(rawBudget.replace(/,/g, '')) : 0;
    project.status           = document.getElementById('summary-status-input').value;
    project.image_url        = document.getElementById('summary-img-input').value.trim();

    // 1. Update state in memory
    state.appData.Projects[stateProjIndex] = project;

    // 2. Persist to Firestore and localStorage via data-store
    try {
        const { persistProjects } = await import('../core/data-store.js');
        persistProjects(state.appData.Projects);
    } catch (e) {
        console.error('[saveSummaryData] Failed to save to Firestore:', e);
    }

    localStorage.setItem('ccm_current_project_id', projectId);

    document.getElementById('projectInfoModal').classList.add('hidden');
    document.body.classList.remove('modal-open');

    // 4. Re-render header & dashboard with updated data
    renderProjectTabs();
    renderDashboard();
}
