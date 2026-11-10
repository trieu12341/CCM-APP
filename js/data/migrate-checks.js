/**
 * migrate-checks.js — Các TỔNG KIỂM dùng để chứng minh chuyển dữ liệu không lệch số.
 * Tính trên danh sách "phẳng" (như bản ghi cũ) nên dùng được cho cả bản cũ lẫn bản đọc lại từ cloud.
 * Dùng đúng hàm tổng hợp của app (getContractValue, paymentTotals) → cùng định nghĩa số liệu như màn hình.
 */
import { getContractValue } from '../core/contract-fields.js';
import { paymentTotals, isApprovedIPC } from '../modules/payment/payment-metrics.js';

const N = (x) => Number(x) || 0;
const sum = (list, f) => list.reduce((s, x) => s + f(x), 0);

export const CHECK_LABELS = {
    budgets: 'Số mục ngân sách', tenders: 'Số gói thầu', contracts: 'Số hợp đồng', payments: 'Số IPC',
    variations: 'Số VO', cashflows: 'Số dòng dòng tiền', finals: 'Số hồ sơ quyết toán',
    budgetTotal: 'Σ Ngân sách', contractValue: 'Σ Giá trị hợp đồng', ipcCertifiedExVat: 'Σ (14) IPC đã duyệt (trước thuế)',
    ipcAdvance: 'Σ Tạm ứng IPC đã duyệt', voApproved: 'Σ VO đã duyệt', cashflowTotal: 'Σ Kế hoạch dòng tiền',
};

/** @param {{[entity]: object[]}} recs  danh sách phẳng theo loại hồ sơ (bỏ qua bản ghi đã vào thùng rác) */
export function checksums(recs) {
    const live = (e) => (recs[e] || []).filter(r => !r.deleted);
    const approvedIPC = paymentTotals(live('payments'), { filter: isApprovedIPC });
    return {
        budgets: live('budgets').length, tenders: live('tenders').length, contracts: live('contracts').length,
        payments: live('payments').length, variations: live('variations').length,
        cashflows: live('cashflows').length, finals: live('finals').length,
        budgetTotal: Math.round(sum(live('budgets'), b => N(b.budgeted))),
        contractValue: Math.round(sum(live('contracts'), getContractValue)),
        ipcCertifiedExVat: Math.round(approvedIPC.certifiedExVat),
        ipcAdvance: Math.round(approvedIPC.advancePaid),
        voApproved: Math.round(sum(live('variations').filter(v => v.status === 'Approved'), v => N(v.approved_amount))),
        cashflowTotal: Math.round(sum(live('cashflows'), c => N(c.value))),
    };
}

/** So hai bộ tổng kiểm → từng dòng KHỚP / LỆCH (để hiện bảng trước/sau). */
export function compareChecksums(before, after) {
    return Object.keys(CHECK_LABELS).map(key => ({
        key, label: CHECK_LABELS[key], before: before[key], after: after[key], ok: before[key] === after[key],
    }));
}
