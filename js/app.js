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
    
    // Original contract value
    const originalValue = Number(contract.original_value) || Number(contract.total_value) || Number(contract.contract_value) || 0;
    
    // Add approved variations (SSOT logic for VO Layer)
    let approvedVOValue = 0;
    if (appData && appData.Variations) {
        const approvedVOs = appData.Variations.filter(vo => vo.contract_id === contract.contract_id && vo.status === 'Approved');
        approvedVOValue = approvedVOs.reduce((sum, vo) => sum + (Number(vo.approved_amount) || Number(vo.vo_amount) || 0), 0);
    }
    
    return originalValue + approvedVOValue;
}

document.addEventListener('componentsLoaded', initApp);
