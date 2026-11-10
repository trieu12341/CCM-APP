// Báo cáo chi phí tháng (bước 3.2) — hàm thuần, không DOM. Cột theo mẫu cost report của phòng QS:
//  (3) Ngân sách  (4) Award  (5) VO đã duyệt  (6) VO chờ duyệt  (7) Cam kết = (4)+(5)
//  (8) Chưa cam kết = (7) > 0 ? 0 : (3)   (9) Dự kiến đến khi xong (AFC) = (6)+(7)+(8)
//  (10) Đã thanh toán (trước thuế, gồm tạm ứng)  (11) Còn lại = (7)−(10)  (12) Chênh lệch ngân sách = (3)−(9)
// Mỗi mục ngân sách = 1 dòng; mục có nhiều HĐ = mỗi HĐ 1 dòng (ngân sách nằm ở dòng đầu).
// HĐ chưa gắn mục ngân sách → nhóm "Chưa phân mã" (không rơi tiền). VO KHÔNG cộng vào Award (giá trị HĐ).
import { paymentTotals, isPaidIPC } from '../payment/payment-metrics.js';

export const COLS = ['budget', 'award', 'apprVO', 'subVO', 'committed', 'nonCommitted', 'afc', 'certified', 'remaining', 'balance'];
export const COL_LABEL = {
    budget: 'Ngân sách', award: 'Giá trị HĐ (Award)', apprVO: 'VO đã duyệt', subVO: 'VO chờ duyệt', committed: 'Tổng cam kết',
    nonCommitted: 'Chưa cam kết', afc: 'Dự kiến đến khi hoàn thành', certified: 'Đã thanh toán', remaining: 'Còn phải trả', balance: 'Chênh lệch ngân sách',
};
const GROUP_LABEL = { Consultancy: 'Chi phí tư vấn', Construction: 'Nhà thầu', Contingency: 'Dự phòng' };
export const UNASSIGNED = 'Chưa phân mã';

const R = (v) => Math.round(Number(v) || 0);
const day = (d) => { if (!d) return null; const x = d?.toDate ? d.toDate() : new Date(d); return isNaN(x) ? null : x.toISOString().slice(0, 10); };
const upTo = (asOf) => (d) => !asOf || !day(d) || day(d) <= asOf;

/** VO của một HĐ tính tới ngày asOf: { approved, submitted, missingQS: [vo] }. */
export function voOf(variations, contractId, asOf) {
    const ok = upTo(asOf);
    let approved = 0, submitted = 0; const missingQS = [];
    for (const v of variations) {
        if (v.contract_id !== contractId || v.deleted) continue;
        const st = String(v.status || '').toLowerCase();
        const qs = Number(v.approved_amount) || 0, claim = Number(v.claimed_amount) || Number(v.vo_amount) || 0;
        if (!ok(v.submission_date)) continue;                                    // trình sau ngày báo cáo → chưa có
        if (st === 'approved' && ok(v.assessment_date || v.submission_date)) approved += qs || claim;
        else if (st === 'approved' || st === 'pending' || st === 'submitted') {  // duyệt sau ngày báo cáo = lúc đó còn chờ
            if (qs) submitted += qs; else { submitted += claim; missingQS.push(v); }
        }
    }
    return { approved: R(approved), submitted: R(submitted), missingQS };
}

/** Đã thanh toán tới ngày asOf: IPC đã trả, trước thuế, gồm tạm ứng. */
export function certifiedOf(payments, contractId, asOf) {
    const ok = upTo(asOf);
    return R(paymentTotals(payments, { contractId, filter: (p) => isPaidIPC(p) && !p.deleted && ok(p.paid_date || p.submission_date) }).paymentExVat);
}

function row(base, { budget = 0, award = 0, apprVO = 0, subVO = 0, certified = 0 }) {
    const committed = award + apprVO;
    const nonCommitted = committed > 0 ? 0 : budget;
    const afc = subVO + committed + nonCommitted;
    return { ...base, budget, award, apprVO, subVO, committed, nonCommitted, afc, certified, remaining: committed - certified, balance: budget - afc };
}
const sum = (rows) => Object.fromEntries(COLS.map(k => [k, rows.reduce((s, r) => s + r[k], 0)]));

/**
 * @returns {{ asOf, groups: [{ key, label, rows, total }], total, warnings: string[] }}
 */
export function buildCostReport({ budgets = [], contracts = [], variations = [], payments = [], projectId, asOf = null }) {
    const mine = (x) => !projectId || x.project_id === projectId;
    const bs = budgets.filter(b => mine(b) && !b.deleted);
    const cs = contracts.filter(c => mine(c) && !c.deleted);
    const budgetIds = new Set(bs.map(b => b.id));
    const warnings = [];
    const groups = new Map();
    const push = (key, r) => {
        if (!groups.has(key)) groups.set(key, { key, label: GROUP_LABEL[key] || key, rows: [] });
        groups.get(key).rows.push(r);
    };
    const contractRow = (c, base, budget) => {
        const vo = voOf(variations, c.contract_id, asOf);
        vo.missingQS.forEach(v => warnings.push(`VO "${v.vo_name || v.id || ''}" (${c.package_name || c.contract_id}) đang chờ duyệt nhưng chưa có số QS đánh giá — tạm lấy số nhà thầu đề xuất.`));
        return row({ ...base, contractId: c.contract_id, contractor: c.contractor_name || c.contractor || '' },
            { budget, award: R(c.original_value), apprVO: vo.approved, subVO: vo.submitted, certified: certifiedOf(payments, c.contract_id, asOf) });
    };

    for (const b of bs) {
        const base = { budgetId: b.id, code: b.budgetCode || '', name: b.packageName || b.package_name || '' };
        const linked = cs.filter(c => c.budget_id === b.id);
        if (!linked.length) { push(b.category || 'Khác', row(base, { budget: R(b.budgeted) })); continue; }
        linked.forEach((c, i) => push(b.category || 'Khác', contractRow(c,
            i === 0 ? base : { ...base, name: c.package_name || c.contract_name || base.name, extra: true }, i === 0 ? R(b.budgeted) : 0)));
    }
    for (const c of cs.filter(x => !budgetIds.has(x.budget_id))) {
        warnings.push(`HĐ "${c.package_name || c.contract_id}" chưa gắn mục ngân sách — đưa vào nhóm "${UNASSIGNED}".`);
        push(UNASSIGNED, contractRow(c, { budgetId: null, code: '', name: c.package_name || c.contract_name || c.contract_id }, 0));
    }
    const list = [...groups.values()].map(g => ({ ...g, total: sum(g.rows) }));
    return { asOf, groups: list, total: sum(list.flatMap(g => g.rows)), warnings };
}
