import { initApp } from './core/app-init.js';
import './utils/helpers.js';
export { formatCurrency, formatCurrencyVND, formatCurrencyShort, formatCurrencyDetailed, formatDate, parseBudget } from './utils/formatters.js';

export const state = {
    appData: {
        Projects: [],
        Budgets: [],
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
