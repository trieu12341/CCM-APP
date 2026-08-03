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

export function getContractBudgetValue(contract, appData) {
    if (!contract || !contract.budget_id || !appData || !appData.Budgets) return 0;
    const budget = appData.Budgets.find(b => b.id === contract.budget_id);
    return budget ? (Number(budget.budgeted) || 0) : 0;
}

export function getDynamicContractValue(contract, appData) {
    if (!contract) return 0;
    // Excluded Variations (VO) per user request. Focus on original_value.
    const originalValue = Number(contract.original_value);
    if (!isNaN(originalValue) && originalValue !== 0) {
        return originalValue;
    }
    // Fallback for old data where total_value is directly stored
    return Number(contract.total_value) || Number(contract.contract_value) || 0;
}

document.addEventListener('componentsLoaded', initApp);
