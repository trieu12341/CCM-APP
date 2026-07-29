import { state } from '../app.js';
import { saveContracts } from '../api.js';

export function getLocalContracts() {
    return [...state.appData.Contracts];
}

export function saveLocalContracts(contracts) {
    state.appData.Contracts = contracts;
    saveContracts(contracts).catch(err => console.error('Failed to save contracts', err));
}
