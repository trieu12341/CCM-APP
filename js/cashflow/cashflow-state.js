import { state } from '../app.js';
import { saveCashflow } from '../api.js';

export function getLocalCashflow() {
    return [...(state.appData.Cashflow || [])];
}

export function saveLocalCashflow(data) {
    state.appData.Cashflow = data;
    saveCashflow(data).catch(err => console.error('Failed to save cashflow', err));
}
