import { state } from '../app.js';
import { persistTenders } from '../core/data-store.js';

export const tenderState = {
    currentTenderDetailId: null,
    currentRoundIndex: 0
};

export function getLocalTenders() {
    return state.appData.Tenders ? [...state.appData.Tenders] : [];
}

export function saveLocalTenders(tenders) {
    persistTenders(tenders);
}
