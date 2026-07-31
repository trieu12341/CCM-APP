import { state } from '../app.js';
import { persistCashflow } from '../core/data-store.js';

export function getLocalCashflow() {
    return [...(state.appData.Cashflow || [])];
}

export function saveLocalCashflow(data) {
    persistCashflow(data);
}
