import { state } from '../app.js';

export function getLocalProjects() {
    const data = localStorage.getItem('ccm_projects');
    if (data) {
        try {
            return JSON.parse(data);
        } catch(e) {}
    }
    return JSON.parse(JSON.stringify(state.appData.Projects));
}

export function saveLocalProjects(projects) {
    localStorage.setItem('ccm_projects', JSON.stringify(projects));
}
