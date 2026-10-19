/**
 * ipc-chain.js — Ghép bộ máy IPC với dữ liệu thật của một hợp đồng:
 * tìm các IPC kỳ trước, dựng bản ghi IPC (số đã tính + trường tương thích
 * cho các module cũ), tính lại chuỗi IPC phía sau khi một kỳ thay đổi.
 *
 * Thuần (nhận dữ liệu qua tham số) → unit test được.
 */
import { computeIPC } from './ipc-engine.js';

const LOCKED = ['approved', 'paid', 'đã duyệt', 'đã thanh toán'];
export const isLockedIPC = (ipc) => LOCKED.includes(String(ipc?.status || '').toLowerCase());

const orderKey = (ipc) => [Number(ipc.payment_number) || 0, ipc.created_at || '', ipc.ipc_id || ''];
const byOrder = (a, b) => {
    const ka = orderKey(a), kb = orderKey(b);
    for (let i = 0; i < ka.length; i++) { if (ka[i] < kb[i]) return -1; if (ka[i] > kb[i]) return 1; }
    return 0;
};

/** Các IPC của một hợp đồng, theo thứ tự đợt. */
export function contractIPCs(payments = [], contractId) {
    return payments.filter(p => p.contract_id === contractId).sort(byOrder);
}

/** Các IPC đứng trước một đợt (không tính chính nó). */
export function previousIPCsFor(payments, contractId, paymentNumber, excludeId = null) {
    return contractIPCs(payments, contractId)
        .filter(p => p.ipc_id !== excludeId && (Number(p.payment_number) || 0) < Number(paymentNumber));
}

/** Số đợt kế tiếp của hợp đồng (IPC 0 = tạm ứng). */
export function nextPaymentNumber(payments, contractId) {
    const list = contractIPCs(payments, contractId);
    if (!list.length) return 1;
    return Math.max(...list.map(p => Number(p.payment_number) || 0)) + 1;
}

/** Mã IPC không trùng (kể cả sau khi xóa, kể cả giữa nhiều máy). */
export function newIPCId(payments = []) {
    // Lấy số thứ tự ngay sau 'IPC-' (bỏ hậu tố chống trùng), vd IPC-07-ab12 → 7
    const nums = payments.map(p => parseInt((String(p.ipc_id || '').match(/^ipc-?(\d+)/i) || [])[1], 10) || 0);
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return `IPC-${String(next).padStart(2, '0')}-${Date.now().toString(36).slice(-4)}`;
}

/**
 * Dựng bản ghi IPC xây dựng (engine v2) từ dữ liệu nhập.
 * Trường cũ (gross_work_done, sub_total, vat_amount, net_payable…) được điền
 * theo số KỲ NÀY để các màn hình cũ (KPI, cashflow, biểu đồ) hiển thị đúng.
 */
export function buildConstructionIPC({ contract, input, previousIPCs, approvedVariations = 0 }) {
    const computed = computeIPC({ contract, ipc: input, previousIPCs, approvedVariations });
    const isAdvance = !!input.is_advance;
    return {
        ...input,
        contract_type: 'Construction',
        engine_version: 2,
        is_advance: isAdvance,
        computed,
        // ── tương thích module cũ (số của kỳ này) ──
        gross_work_done: isAdvance ? computed.advanceThisPeriod : computed.grossThisPeriod,
        submitted_amount: isAdvance ? computed.advanceThisPeriod : computed.grossThisPeriod,
        ap_deduction: computed.apRecoveryThisPeriod,
        retention_deduction: computed.retentionThisPeriod,
        retention_pct: Number(contract.retention_percent ?? 10),
        ap_recovery_pct: Number(contract.ap_recovery_percent || 0),
        vat_pct: computed.vatPct,
        sub_total: computed.thisPeriodExVat,
        certified_value: computed.thisPeriodExVat,
        certified_amount: computed.thisPeriodExVat,
        vat_amount: computed.vat,
        net_payable: computed.paymentThisPeriod,
    };
}

/**
 * Tính lại các IPC xây dựng (v2) CHƯA duyệt của một hợp đồng theo đúng thứ tự,
 * để (11) "đã xác nhận kỳ trước" luôn khớp khi một kỳ trước được sửa.
 * IPC đã duyệt/đã thanh toán giữ nguyên số (chứng chỉ đã phát hành).
 * @returns {Array} danh sách payments mới (không sửa mảng gốc)
 */
export function recomputeChain(payments, contract, approvedVariations = 0) {
    const ordered = contractIPCs(payments, contract.contract_id);
    const updated = new Map();
    const done = [];
    for (const ipc of ordered) {
        let rec = ipc;
        if (ipc.engine_version >= 2 && !isLockedIPC(ipc)) {
            rec = { ...ipc, ...buildConstructionIPC({ contract, input: ipc, previousIPCs: done, approvedVariations }) };
            updated.set(ipc.ipc_id, rec);
        }
        done.push(rec);
    }
    return payments.map(p => updated.get(p.ipc_id) || p);
}

/** Dòng Bill / mã ngân sách của IPC gần nhất trước đó (để làm sẵn dòng cho kỳ mới). */
export function linesFromPrevious(previousIPCs = []) {
    for (let i = previousIPCs.length - 1; i >= 0; i--) {
        const l = previousIPCs[i].lines;
        if (Array.isArray(l) && l.length) {
            return l.map(x => ({ code: x.code || '', description: x.description || '', contract_amount: Number(x.contract_amount) || 0,
                previous_amount: Number(x.to_date_amount) || 0, to_date_amount: Number(x.to_date_amount) || 0 }));
        }
    }
    return [];
}

/** Khóa ghép dòng giữa các kỳ. */
export const lineKey = (l) => `${String(l.code || '').trim()}|${String(l.description || '').trim().toLowerCase()}`;

/** Mã IPC ngắn để hiển thị (bỏ hậu tố chống trùng): IPC-07-ab12 → IPC-07. */
export const shortIPCCode = (id) => String(id || '').replace(/^ipc-/i, 'IPC-').replace(/-[a-z0-9]{4}$/i, '');

/** Nhãn đợt: "Tạm ứng" cho IPC 0, còn lại "Đợt n". */
export const periodLabel = (ipc) => (ipc?.is_advance ? 'Tạm ứng' : `Đợt ${ipc?.payment_number ?? '—'}`);
