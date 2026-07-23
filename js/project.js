import { state } from './app.js';
import { renderDashboard, renderProjectTabs } from './budget.js';

export function setupProjectSummaryEvents() {
    const modal = document.getElementById('project-summary-modal');
    const closeBtn = document.getElementById('close-summary-modal');
    const projectNameEl = document.getElementById('project-name');
    
    if (projectNameEl) {
        projectNameEl.addEventListener('click', () => {
            openSummaryModal();
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
    }

    const btnEdit = document.getElementById('btn-edit-summary');
    const btnSave = document.getElementById('btn-save-summary');
    
    if (btnEdit) {
        btnEdit.addEventListener('click', () => {
            document.getElementById('summary-view-mode').classList.add('hidden');
            document.getElementById('summary-edit-mode').classList.remove('hidden');
            document.getElementById('summary-img-edit-wrap').classList.remove('hidden');
            btnEdit.classList.add('hidden');
            btnSave.classList.remove('hidden');
        });
    }

    if (btnSave) {
        btnSave.addEventListener('click', () => {
            saveSummaryData();
        });
    }

    const imgUpload = document.getElementById('summary-img-upload');
    const imgInput = document.getElementById('summary-img-input');
    const imgView = document.getElementById('summary-img-view');
    const imgPlaceholder = document.getElementById('summary-img-placeholder');

    if (imgUpload) {
        imgUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            if (file.size > 2 * 1024 * 1024) {
                alert('Vui lòng chọn ảnh có dung lượng nhỏ hơn 2MB để tránh lỗi bộ nhớ!');
                e.target.value = ''; // Reset
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (event) => {
                const dataUrl = event.target.result;
                imgInput.value = dataUrl;
                
                imgView.src = dataUrl;
                imgView.style.display = 'block';
                imgPlaceholder.style.display = 'none';
            };
            reader.readAsDataURL(file);
        });
    }

    if (imgInput) {
        imgInput.addEventListener('input', (e) => {
             if (e.target.value) {
                imgView.src = e.target.value;
                imgView.style.display = 'block';
                imgPlaceholder.style.display = 'none';
             } else {
                imgView.style.display = 'none';
                imgPlaceholder.style.display = 'flex';
             }
        });
    }
}

function getLocalProjects() {
    const data = localStorage.getItem('vcre_projects');
    if (data) {
        try {
            return JSON.parse(data);
        } catch(e) {}
    }
    // If not in localStorage, fallback to state
    return JSON.parse(JSON.stringify(state.appData.Projects));
}

function saveLocalProjects(projects) {
    localStorage.setItem('vcre_projects', JSON.stringify(projects));
}

function openSummaryModal() {
    const projectId = state.currentProjectId;
    if (!projectId) return;

    const projects = getLocalProjects();
    let project = projects.find(p => p.project_id === projectId);
    
    if (!project) {
        // Fallback if somehow not found
        project = state.appData.Projects.find(p => p.project_id === projectId);
        if (!project) return;
    }

    // Populate View Mode
    document.getElementById('summary-name-view').textContent = project.project_name || '-';
    document.getElementById('summary-scale-view').textContent = project.scale || '-';
    document.getElementById('summary-location-view').textContent = project.location || '-';
    document.getElementById('summary-start-date-view').textContent = project.start_date ? new Date(project.start_date).toLocaleDateString('en-GB') : '-';
    document.getElementById('summary-end-date-view').textContent = project.end_date ? new Date(project.end_date).toLocaleDateString('en-GB') : '-';
    document.getElementById('summary-cfa-view').textContent = project.cfa || '-';
    document.getElementById('summary-consultants-view').textContent = project.consultants || '-';
    document.getElementById('summary-contractor-view').textContent = project.main_contractor || '-';
    
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

    // Populate Edit Mode
    document.getElementById('summary-name-input').value = project.project_name || '';
    document.getElementById('summary-scale-input').value = project.scale || '';
    document.getElementById('summary-location-input').value = project.location || '';
    
    // Convert dates for input type="date"
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
    document.getElementById('summary-contractor-input').value = project.main_contractor || '';
    document.getElementById('summary-img-input').value = project.image_url || '';

    // Reset UI state to View Mode
    document.getElementById('summary-view-mode').classList.remove('hidden');
    document.getElementById('summary-edit-mode').classList.add('hidden');
    document.getElementById('summary-img-edit-wrap').classList.add('hidden');
    document.getElementById('btn-edit-summary').classList.remove('hidden');
    document.getElementById('btn-save-summary').classList.add('hidden');

    document.getElementById('project-summary-modal').classList.remove('hidden');
}

function saveSummaryData() {
    const projectId = state.currentProjectId;
    if (!projectId) return;

    let projects = getLocalProjects();
    let projectIndex = projects.findIndex(p => p.project_id === projectId);
    
    let project;
    if (projectIndex === -1) {
        // Find from state and push
        const stateProj = state.appData.Projects.find(p => p.project_id === projectId);
        if (stateProj) {
            projects.push({ ...stateProj });
            projectIndex = projects.length - 1;
        } else {
            return;
        }
    }
    
    project = projects[projectIndex];

    // Update data
    project.project_name = document.getElementById('summary-name-input').value.trim();
    project.scale = document.getElementById('summary-scale-input').value.trim();
    project.location = document.getElementById('summary-location-input').value.trim();
    project.start_date = document.getElementById('summary-start-date-input').value.trim();
    project.end_date = document.getElementById('summary-end-date-input').value.trim();
    project.cfa = document.getElementById('summary-cfa-input').value.trim();
    project.consultants = document.getElementById('summary-consultants-input').value.trim();
    project.main_contractor = document.getElementById('summary-contractor-input').value.trim();
    project.image_url = document.getElementById('summary-img-input').value.trim();

    // Save back
    projects[projectIndex] = project;
    saveLocalProjects(projects);

    // Also update the global state so that other tabs rendering use the new name
    const stateProjIndex = state.appData.Projects.findIndex(p => p.project_id === projectId);
    if (stateProjIndex !== -1) {
        state.appData.Projects[stateProjIndex] = { ...state.appData.Projects[stateProjIndex], ...project };
    }

    // Close modal
    document.getElementById('project-summary-modal').classList.add('hidden');

    // Re-render Project title in UI
    renderProjectTabs();
    renderDashboard();
}
