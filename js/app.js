import { initApp } from './core/app-init.js';
export { formatCurrency, formatCurrencyVND, formatCurrencyShort, formatCurrencyDetailed, formatDate } from './utils/formatters.js';

export const state = {
    appData: {
        Projects: [],
        Contracts: [],
        Cashflow: [],
        Payments: [],
        Payment_Claims: [],
        Variations: [],
        Documents: [],
        Tenders: []
    },
    currentProjectId: null,
    user: null
};

export const mockActivities = [
    { text: 'Initiate Payment Claims or VO approved', date: new Date().toISOString() }
];

document.addEventListener('componentsLoaded', initApp);
