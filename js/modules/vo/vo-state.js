import { state } from '../../app.js';
import { persistVariations } from '../../core/data-store.js';

let voState = {
    currentFilter: 'all',
    activeVOId: null
};

export function getVOState() {
    return voState;
}

export function updateVOState(newState) {
    voState = { ...voState, ...newState };
}

export function getVOById(id) {
    return state.appData.Variations.find(v => v.vo_id === id);
}

export function filterVOs() {
    let list = state.appData.Variations || [];
    
    // Filter by project
    list = list.filter(vo => {
        const contract = state.appData.Contracts.find(c => c.contract_id === vo.contract_id);
        return contract && contract.project_id === state.currentProjectId;
    });

    if (voState.currentFilter !== 'all') {
        list = list.filter(v => v.status === voState.currentFilter);
    }
    
    // Sort by submission date desc, then by vo_id
    list.sort((a, b) => {
        const dA = new Date(a.submission_date || 0);
        const dB = new Date(b.submission_date || 0);
        if (dB - dA !== 0) return dB - dA;
        return a.vo_id.localeCompare(b.vo_id);
    });

    return list;
}

export function createVO(voData) {
    const newVO = {
        ...voData,
        vo_id: 'VO-' + (state.appData.Variations ? state.appData.Variations.length + 1 : 1).toString().padStart(2, '0'),
    };
    if (!state.appData.Variations) state.appData.Variations = [];
    state.appData.Variations.push(newVO);
    persistVariations(state.appData.Variations);
    return newVO;
}

export function updateVO(id, updates) {
    const index = state.appData.Variations.findIndex(v => v.vo_id === id);
    if (index !== -1) {
        state.appData.Variations[index] = { ...state.appData.Variations[index], ...updates };
        persistVariations(state.appData.Variations);
        return true;
    }
    return false;
}
