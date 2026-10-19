import { getContractValue } from './core/contract-fields.js';
import { initApp } from './core/app-init.js';
import './utils/helpers.js';
import { formatCurrency as __fmtCur } from './utils/formatters.js';
// Dùng trong thuộc tính oninput của HTML (form VO) → cần hàm toàn cục
window.formatCurrency = __fmtCur;
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

/**
 * Giá trị HỢP ĐỒNG = giá trị ký gốc. Phát sinh (VO) đã duyệt KHÔNG cộng vào đây:
 * VO chỉ đi vào giá trị QUYẾT TOÁN (module Quyết toán: [C] = [A] gốc + [B] VO)
 * và dòng (2)/(3) của chứng chỉ IPC. Giữ tên hàm cũ để không phải sửa các nơi gọi.
 */
export function getDynamicContractValue(contract) {
    if (!contract) return 0;
    return getContractValue(contract);
}

/** Giá trị quyết toán dự kiến = gốc + VO đã duyệt (chỉ dùng khi cần hiển thị riêng). */
export function getFinalContractValue(contract, appData) {
    if (!contract) return 0;
    const vo = (appData?.Variations || [])
        .filter(v => v.contract_id === contract.contract_id && v.status === 'Approved')
        .reduce((sum, v) => sum + (Number(v.approved_amount) || Number(v.vo_amount) || 0), 0);
    return getContractValue(contract) + vo;
}

document.addEventListener('componentsLoaded', initApp);
