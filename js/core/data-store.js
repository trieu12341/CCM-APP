/**
 * data-store.js
 * Quản lý trung tâm việc lưu trữ và đồng bộ dữ liệu.
 * Dữ liệu được lưu vào:
 *   1. state (in-memory)
 *   2. localStorage (cache offline)
 *   3. Firestore (cloud source of truth) qua db-service.js
 *
 * Đã loại bỏ hoàn toàn dual-save sang Express API.
 */
import { state } from '../app.js';
import { backfillProjectIds } from './project-merge.js';
import { saveBudgetsToCloud, saveTendersToCloud, saveProjectsToCloud, saveContractsToCloud, saveCashflowToCloud, savePaymentsToCloud, saveVariationsToCloud, saveFinalStatementsToCloud } from '../db-service.js';

// Centralize all localStorage keys
export const STORAGE_KEYS = {
    PROJECTS: 'ccm_projects',
    BUDGETS: 'ccm_budgets',
    TENDERS: 'ccm_tenders',
    CONTRACTS: 'ccm_contracts',
    CASHFLOW: 'ccm_cashflow',
    PAYMENTS: 'ccm_payments',
    VARIATIONS: 'ccm_variations',
    FINAL: 'ccm_final',
    PROJECT_ID: 'ccm_current_project_id',
};

// ==========================================
// PERSIST TO LOCAL STORAGE & FIRESTORE
// ==========================================

export function clearResetFlag() {
    localStorage.removeItem('ccm_user_reset_cleared');
}

export function persistProjects(data) {
    clearResetFlag();
    state.appData.Projects = data;
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(data));
    saveProjectsToCloud(data);
    document.dispatchEvent(new Event('projectsChanged'));
}

export function persistBudgets(data) {
    clearResetFlag();
    state.appData.Budgets = data;
    localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(data));
    saveBudgetsToCloud(data);
    document.dispatchEvent(new Event('budgetsChanged'));
}

export function persistTenders(data) {
    clearResetFlag();
    state.appData.Tenders = data;
    localStorage.setItem(STORAGE_KEYS.TENDERS, JSON.stringify(data));
    saveTendersToCloud(data);
    document.dispatchEvent(new Event('tendersChanged'));
}

export function persistContracts(data) {
    clearResetFlag();
    state.appData.Contracts = data;
    localStorage.setItem(STORAGE_KEYS.CONTRACTS, JSON.stringify(data));
    saveContractsToCloud(data);
    document.dispatchEvent(new Event('contractsChanged'));
}

export function persistCashflow(data) {
    // SAFEGUARD: Do not overwrite localStorage with empty array if data exists
    if ((!data || data.length === 0) && state.appData.Cashflow && state.appData.Cashflow.length > 0) {
        console.warn('Blocked attempt to persist empty Cashflow data.');
        return;
    }

    clearResetFlag();
    state.appData.Cashflow = data;
    localStorage.setItem(STORAGE_KEYS.CASHFLOW, JSON.stringify(data));
    saveCashflowToCloud(data);
    document.dispatchEvent(new Event('cashflowChanged'));
}

// ==========================================
// LOAD FROM LOCAL STORAGE (Fallback)
// ==========================================

export function loadBudgetsFromLS() {
    try {
        const lsData = localStorage.getItem(STORAGE_KEYS.BUDGETS);
        return (lsData && lsData !== 'undefined' && lsData !== '[]') ? JSON.parse(lsData) : null;
    } catch (e) { console.error('Error parsing Budgets from LS', e); return null; }
}

export function loadTendersFromLS() {
    try {
        const lsData = localStorage.getItem(STORAGE_KEYS.TENDERS);
        return (lsData && lsData !== 'undefined' && lsData !== '[]') ? JSON.parse(lsData) : null;
    } catch (e) { console.error('Error parsing Tenders from LS', e); return null; }
}

export function loadContractsFromLS() {
    try {
        const lsData = localStorage.getItem(STORAGE_KEYS.CONTRACTS);
        return (lsData && lsData !== 'undefined' && lsData !== '[]') ? JSON.parse(lsData) : null;
    } catch (e) { console.error('Error parsing Contracts from LS', e); return null; }
}

export function loadCashflowFromLS() {
    try {
        const lsData = localStorage.getItem(STORAGE_KEYS.CASHFLOW);
        return (lsData && lsData !== 'undefined' && lsData !== '[]') ? JSON.parse(lsData) : null;
    } catch (e) { console.error('Error parsing Cashflow from LS', e); return null; }
}

export function persistPayments(data) {
    // SAFEGUARD: Do not overwrite localStorage with empty array if data exists
    if ((!data || data.length === 0) && state.appData.Payments && state.appData.Payments.length > 0) {
        console.warn('Blocked attempt to persist empty Payments data.');
        return;
    }

    clearResetFlag();
    state.appData.Payments = data;
    localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(data));
    savePaymentsToCloud(data);
    document.dispatchEvent(new Event('paymentsChanged'));
}

export function persistFinalStatements(data) {
    clearResetFlag();
    state.appData.Final_Statements = data;
    localStorage.setItem(STORAGE_KEYS.FINAL, JSON.stringify(data));
    saveFinalStatementsToCloud(data);
    document.dispatchEvent(new Event('finalChanged'));
}

export function loadPaymentsFromLS() {
    try {
        const lsData = localStorage.getItem(STORAGE_KEYS.PAYMENTS);
        return (lsData && lsData !== 'undefined' && lsData !== '[]') ? JSON.parse(lsData) : null;
    } catch (e) { console.error('Error parsing Payments from LS', e); return null; }
}

export function persistVariations(data) {
    // VO từ bản cũ thiếu project_id → bổ sung theo hợp đồng để lên được cloud
    data = backfillProjectIds(data, state.appData.Contracts).items;
    if ((!data || data.length === 0) && state.appData.Variations && state.appData.Variations.length > 0) {
        console.warn('Blocked attempt to persist empty Variations data.');
        return;
    }
    clearResetFlag();
    state.appData.Variations = data;
    localStorage.setItem(STORAGE_KEYS.VARIATIONS, JSON.stringify(data));
    saveVariationsToCloud(data);
    document.dispatchEvent(new Event('variationsChanged'));
}

export function loadVariationsFromLS() {
    try {
        const lsData = localStorage.getItem(STORAGE_KEYS.VARIATIONS);
        return (lsData && lsData !== 'undefined' && lsData !== '[]') ? JSON.parse(lsData) : null;
    } catch (e) { console.error('Error parsing Variations from LS', e); return null; }
}
