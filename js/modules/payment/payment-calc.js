import { getContractValue } from '../../core/contract-fields.js';
/**
 * payment-calc.js
 * Pure calculation functions — no side effects, no DOM access.
 * All QS financial computations for IPC breakdown.
 */
import { paymentTotals, monthlyTrend, isApprovedIPC, isPaidIPC } from './payment-metrics.js';

// Công thức IPC nằm ở ipc-engine.js (lũy kế theo mẫu CERT).
// Tổng hợp số liệu thanh toán nằm ở payment-metrics.js — file này chỉ ghép cho Dashboard.

/** 4 thẻ KPI của Dashboard Thanh toán (đều trước thuế). */
export function calcPaymentKPIs(payments = [], contracts = []) {
    const totalActiveContracts = contracts
        .filter(c => ['active', 'đang thực hiện'].includes(String(c.status || '').toLowerCase()))
        .reduce((sum, c) => sum + getContractValue(c), 0);
    return {
        totalActiveContracts,
        // Trước thuế, GỒM tạm ứng: trình = tạm ứng + KL gộp; duyệt / đã trả = tạm ứng + (14)
        totalSubmitted: (t => t.advancePaid + t.grossThisPeriod)(paymentTotals(payments)),
        totalApproved: paymentTotals(payments, { filter: isApprovedIPC }).paymentExVat,
        totalPaid: paymentTotals(payments, { filter: isPaidIPC }).paymentExVat,
    };
}

/** Biểu đồ theo tháng: trình / xác nhận / đã trả (trước thuế). */
export function calcPaymentTrend(payments = []) {
    return monthlyTrend(payments);
}

// ─────────────────────────────────────────────────────────────
// PENDING IPCs (Awaiting Action)
// ─────────────────────────────────────────────────────────────

/**
 * Returns IPCs that are pending action (Draft or Reviewing), sorted by due_date ascending.
 * @param {Array} payments
 * @returns {Array}
 */
export function calcPendingIPCs(payments = []) {
    return payments
        .filter(p => ['draft', 'reviewing', 'submitted'].includes(String(p.status || '').toLowerCase()))
        .sort((a, b) => {
            const da = a.due_date ? new Date(a.due_date) : new Date('9999-12-31');
            const db = b.due_date ? new Date(b.due_date) : new Date('9999-12-31');
            return da - db;
        });
}

// ─────────────────────────────────────────────────────────────
// HELPER: Days Until Due
// ─────────────────────────────────────────────────────────────

/**
 * Returns number of days until due_date (negative = overdue).
 * @param {string} dueDateStr
 * @returns {number|null}
 */
export function daysToDue(dueDateStr) {
    if (!dueDateStr) return null;
    const due = new Date(dueDateStr);
    if (isNaN(due)) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((due - today) / (1000 * 60 * 60 * 24));
}
