/**
 * payment-state.js
 * Manages state.appData.Payments — CRUD, sync with localStorage('ccm_payments') & API.
 * RULE: NEVER auto-generate sample/mock data.
 */

import { state } from '../../app.js';
import { persistPayments, loadPaymentsFromLS } from '../../core/data-store.js';
import { newIPCId } from './ipc-chain.js';
import { isV2 } from '../../core/v2-sync.js';

// ─────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────

/** Returns a shallow copy of all IPC records */
export function getPayments() {
    return Array.isArray(state.appData.Payments) ? [...state.appData.Payments] : [];
}

/** Returns a single IPC by id, or null */
export function getIPCById(ipcId) {
    const payments = getPayments();
    return payments.find(p => p.ipc_id === ipcId) || null;
}

/** Returns IPCs filtered by current project */
export function getPaymentsByProject(projectId) {
    return getPayments().filter(p => p.project_id === projectId);
}

// ─────────────────────────────────────────────────────────────
// WRITE
// ─────────────────────────────────────────────────────────────

/** Saves full payments array to state + localStorage + API */
export function savePaymentsState(data) {
    persistPayments(data);
}

/**
 * Creates a new IPC record.
 * @param {Object} ipcData - Partial IPC fields (contract_id, gross_work_done, etc.)
 * @returns {Object} The newly created IPC
 */
export function createIPC(ipcData) {
    const payments = getPayments();
    const now = new Date().toISOString().split('T')[0];

    const newIPC = {
        ipc_id: newIPCId(payments),   // không trùng kể cả sau khi xóa / giữa nhiều máy
        project_id: state.currentProjectId || '',
        contract_id: '',
        contract_name: '',
        contractor_name: '',
        payment_number: 1,
        submission_date: now,
        due_date: '',

        // Financial fields
        gross_work_done: 0,
        ap_recovery_pct: 0,
        retention_pct: 0,
        vat_pct: 10,

        // Computed / stored
        ap_deduction: 0,
        retention_deduction: 0,
        vat_amount: 0,
        net_payable: 0,

        // QS
        qs_deduction: 0,
        certified_value: 0,

        // Actuals
        paid_amount: 0,
        paid_date: null,

        // Status
        status: 'Draft',
        notes: '',
        created_at: now,
        updated_at: now,

        // Override with provided data
        ...ipcData,
    };
    if (ipcData.ipc_id) newIPC.ipc_id = ipcData.ipc_id;

    payments.push(newIPC);
    persistPayments(payments);
    return newIPC;
}

/**
 * Updates an existing IPC by id.
 * @param {string} ipcId
 * @param {Object} updates - Partial fields to merge
 * @returns {Object|null} The updated IPC or null if not found
 */
export function updateIPC(ipcId, updates) {
    const payments = getPayments();
    const idx = payments.findIndex(p => p.ipc_id === ipcId);
    if (idx === -1) {
        console.warn(`[payment-state] updateIPC: IPC ${ipcId} not found.`);
        return null;
    }
    payments[idx] = {
        ...payments[idx],
        ...updates,
        updated_at: new Date().toISOString().split('T')[0],
    };
    persistPayments(payments);
    return payments[idx];
}

/**
 * Deletes an IPC by id.
 * @param {string} ipcId
 * @returns {boolean} true if deleted, false if not found
 */
export function deleteIPC(ipcId) {
    const payments = getPayments();
    const filtered = payments.filter(p => p.ipc_id !== ipcId);
    if (filtered.length === payments.length) return false;
    persistPayments(filtered);
    return true;
}

// ─────────────────────────────────────────────────────────────
// INIT — Recover from localStorage if state is empty
// ─────────────────────────────────────────────────────────────

export function initPaymentsFromLS() {
    if (isV2(state.currentProjectId)) return;   // dự án đã chuyển: nguồn là Firestore, không khôi phục từ bản sao cũ
    if (!state.appData.Payments || state.appData.Payments.length === 0) {
        const ls = loadPaymentsFromLS();
        if (ls && ls.length > 0) {
            state.appData.Payments = ls;
            console.log(`✅ Khôi phục ${ls.length} IPC từ LocalStorage (ccm_payments)`);
        }
    }
}
