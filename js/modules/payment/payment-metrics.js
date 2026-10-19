/**
 * payment-metrics.js — MỘT cách tổng hợp số thanh toán cho mọi màn hình
 * (Payment, Budget, Overview, Cashflow, Quyết toán). Trước đây mỗi màn hình
 * tự cộng theo kiểu riêng (net − VAT, trạng thái phân biệt hoa thường…).
 *
 * Định nghĩa (đều TRƯỚC THUẾ, trừ cashIncVat):
 *  - certifiedExVat : Σ (14) các IPC — tiền xác nhận cho công việc
 *  - grossThisPeriod: Σ giá trị KL gộp từng kỳ (không gồm tạm ứng)
 *  - grossToDate    : giá trị công việc gộp LŨY KẾ đến IPC cuối được tính
 *                     = "đã thực hiện" (Expended) theo nghĩa báo cáo chi phí
 *  - advancePaid    : Σ tạm ứng đã chi
 *  - apRecovered    : hoàn trả tạm ứng LŨY KẾ đến IPC cuối được tính
 *  - retentionHeld  : giữ lại LŨY KẾ đến IPC cuối được tính
 *  - cashIncVat     : Σ số thanh toán (gồm VAT, gồm tạm ứng)
 *  - paymentExVat   : Σ tiền thanh toán trước thuế GỒM tạm ứng = advancePaid + certifiedExVat
 *                     (dùng cho thẻ Trình / Duyệt / Đã trả và dòng tiền)
 * Thuần → unit test được.
 */
import { summarizeIPC } from './ipc-engine.js';

const st = (p) => String(p?.status || '').toLowerCase();
export const isPaidIPC = (p) => ['paid', 'đã thanh toán'].includes(st(p));
export const isApprovedIPC = (p) => isPaidIPC(p) || ['approved', 'đã duyệt'].includes(st(p));

const ORDER = (a, b) => (Number(a.payment_number) || 0) - (Number(b.payment_number) || 0);

/**
 * @param {Array} payments
 * @param {object} opt { contractId?, projectId?, filter?: (ipc)=>bool }
 */
export function paymentTotals(payments = [], { contractId, projectId, filter = () => true } = {}) {
    const list = payments.filter(p => (!contractId || p.contract_id === contractId)
        && (!projectId || p.project_id === projectId) && filter(p));
    const byContract = new Map();
    list.forEach(p => { if (!byContract.has(p.contract_id)) byContract.set(p.contract_id, []); byContract.get(p.contract_id).push(p); });

    const t = { certifiedExVat: 0, vat: 0, cashIncVat: 0, grossThisPeriod: 0, grossToDate: 0, advancePaid: 0, apRecovered: 0, retentionHeld: 0, count: list.length };
    for (const ipcs of byContract.values()) {
        ipcs.sort(ORDER);
        let legacyAp = 0, legacyRet = 0, legacyGross = 0, lastV2 = null;
        for (const p of ipcs) {
            const s = summarizeIPC(p);
            t.certifiedExVat += s.certifiedExVat;
            t.vat += s.vat;
            t.cashIncVat += s.payment;
            t.grossThisPeriod += s.grossThisPeriod;
            t.advancePaid += s.advance;
            if (p.engine_version >= 2 && p.computed) lastV2 = p.computed;
            else { legacyAp += Number(p.ap_deduction) || 0; legacyRet += Number(p.retention_deduction) || 0; legacyGross += s.grossThisPeriod; }
        }
        t.apRecovered += lastV2 ? lastV2.apRecoveryToDate : legacyAp;
        t.retentionHeld += lastV2 ? lastV2.retentionToDate : legacyRet;
        t.grossToDate += (lastV2 ? lastV2.grossToDate : 0) + legacyGross;
    }
    t.advanceOutstanding = Math.max(0, t.advancePaid - t.apRecovered);
    t.paymentExVat = t.advancePaid + t.certifiedExVat;
    return t;
}

/** Gom theo tháng (ngày nộp) cho biểu đồ: trình (KL gộp), xác nhận, đã trả — trước thuế. */
export function monthlyTrend(payments = []) {
    const m = {};
    payments.forEach(p => {
        const d = new Date(p.submission_date || p.created_at || '');
        if (isNaN(d)) return;
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        m[k] = m[k] || { submitted: 0, certified: 0, paid: 0 };
        const s = summarizeIPC(p);
        // Tiền thanh toán trước thuế, gồm tạm ứng (tạm ứng là một lần thanh toán)
        const amt = s.advance + s.certifiedExVat;
        m[k].submitted += s.advance + s.grossThisPeriod;
        if (isApprovedIPC(p)) m[k].certified += amt;
        if (isPaidIPC(p)) m[k].paid += amt;
    });
    const keys = Object.keys(m).sort();
    return {
        categories: keys.map(k => { const [y, mo] = k.split('-'); return `T${mo}/${y}`; }),
        submitted: keys.map(k => Math.round(m[k].submitted)),
        certified: keys.map(k => Math.round(m[k].certified)),
        paid: keys.map(k => Math.round(m[k].paid)),
    };
}

/**
 * Phân bổ "đã thực hiện" (giá trị công việc GỘP đến nay của IPC đã duyệt,
 * trước thuế — khớp cột "Đến nay" của sheet Budget code) về từng mục NGÂN SÁCH.
 * - IPC xây dựng có dòng Bill: mỗi dòng về mục ngân sách trùng mã; phát sinh
 *   đến nay (6) và dòng không khớp mã → về mục ngân sách gắn với HĐ.
 * - HĐ không có dòng mã (tư vấn, IPC kiểu cũ) → toàn bộ về mục của HĐ.
 * Tổng phân bổ luôn bằng tổng đã thực hiện.
 * @returns {Map<budgetId, number>}
 */
export function expendedByBudget({ payments = [], contracts = [], budgets = [], projectId }) {
    const res = new Map();
    const add = (id, v) => { if (id && v) res.set(id, (res.get(id) || 0) + v); };
    const byCode = new Map();
    budgets.filter(b => b.project_id === projectId && b.budgetCode)
        .forEach(b => { const k = String(b.budgetCode).trim(); if (!byCode.has(k)) byCode.set(k, b.id); });

    for (const c of contracts.filter(x => x.project_id === projectId)) {
        const total = paymentTotals(payments, { contractId: c.contract_id, filter: isApprovedIPC }).grossToDate;
        if (!total) continue;
        const last = payments.filter(p => p.contract_id === c.contract_id && isApprovedIPC(p)
            && p.engine_version >= 2 && Array.isArray(p.lines) && p.lines.length).sort(ORDER).at(-1);
        if (!last) { add(c.budget_id, total); continue; }
        let allocated = 0;
        last.lines.forEach(l => {
            const v = Math.round(Number(l.to_date_amount) || 0);
            add(byCode.get(String(l.code || '').trim()) || c.budget_id, v);
            allocated += v;
        });
        add(c.budget_id, total - allocated);   // phát sinh đến nay + phần IPC kiểu cũ (nếu có)
    }
    return res;
}

/**
 * Phân bổ giá trị CAM KẾT của hợp đồng về mục ngân sách theo giá trị HĐ của
 * từng dòng Bill (lấy từ IPC gần nhất có dòng mang mã). HĐ chưa có dòng mã →
 * toàn bộ về mục ngân sách gắn với HĐ. Tổng không đổi.
 * @param {Function} valueOf (contract) => giá trị cam kết (gồm VO)
 */
export function committedByBudget({ payments = [], contracts = [], budgets = [], projectId, valueOf }) {
    const res = new Map();
    const add = (id, v) => { if (id) res.set(id, (res.get(id) || 0) + v); };
    const byCode = new Map();
    budgets.filter(b => b.project_id === projectId && b.budgetCode)
        .forEach(b => { const k = String(b.budgetCode).trim(); if (!byCode.has(k)) byCode.set(k, b.id); });
    for (const c of contracts.filter(x => x.project_id === projectId)) {
        const total = Math.round(Number(valueOf(c)) || 0);
        if (!total) continue;
        const withLines = payments.filter(p => p.contract_id === c.contract_id && p.engine_version >= 2
            && Array.isArray(p.lines) && p.lines.some(l => String(l.code || '').trim())).sort(ORDER);
        const last = withLines.at(-1);
        const sumCA = last ? last.lines.reduce((s, l) => s + (Number(l.contract_amount) || 0), 0) : 0;
        if (!last || !sumCA) { add(c.budget_id, total); continue; }
        let allocated = 0;
        last.lines.forEach(l => {
            const share = Math.round(total * (Number(l.contract_amount) || 0) / sumCA);
            add(byCode.get(String(l.code || '').trim()) || c.budget_id, share);
            allocated += share;
        });
        if (total - allocated) add(c.budget_id, total - allocated);
    }
    return res;
}
