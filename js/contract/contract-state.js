import { state } from '../app.js';
import { persistContracts } from '../core/data-store.js';

export function getLocalContracts() {
    return state.appData.Contracts ? [...state.appData.Contracts] : [];
}

export function saveLocalContracts(contracts) {
    persistContracts(contracts);
}
