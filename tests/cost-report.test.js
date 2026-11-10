// Bước 3.2 (T3.03, T3.04): engine cost report — khớp cost report tháng 10 làm tay; trường hợp biên không rơi tiền.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { buildCostReport, voOf, certifiedOf, UNASSIGNED } from '../js/modules/report/cost-report.js';
import { computeIPC } from '../js/modules/payment/ipc-engine.js';

const GOLD = new URL('./fixtures/private/cost-report-golden.json', import.meta.url);
const IPC_GOLD = new URL('./fixtures/private/ipc-golden.json', import.meta.url);
const skip = existsSync(GOLD) && existsSync(IPC_GOLD) ? false : 'chưa có file cost report thật (dữ liệu riêng, không đưa lên repo public)';
const COL = { E: 'budget', F: 'award', G: 'apprVO', H: 'subVO', I: 'committed', J: 'nonCommitted', K: 'afc', L: 'certified', M: 'remaining', N: 'balance' };

/** IPC thật của Main Works: tạm ứng + IPC1–2 đã trả, IPC3–4 đã duyệt chưa trả. */
function mainWorksIPCs(contractId) {
    const g = JSON.parse(readFileSync(IPC_GOLD, 'utf8'));
    const contract = { contract_id: contractId, ...g.contract };
    const chain = [{ ipc_id: 'MW-0', contract_id: contractId, is_advance: true, payment_number: 0, status: 'Paid', engine_version: 2,
        computed: computeIPC({ contract, ipc: { advance_this_period: g.contract.advance } }) }];
    let toDate = 0;
    g.periods.forEach((p, i) => {
        toDate += p.grossThisPeriod;
        chain.push({ ipc_id: `MW-${i + 1}`, contract_id: contractId, payment_number: i + 1, status: i < 2 ? 'Paid' : 'Approved', engine_version: 2,
            computed: computeIPC({ contract, ipc: { work_done_to_date: toDate }, previousIPCs: chain }) });
    });
    return chain;
}

/** Dựng hồ sơ app từ các dòng đáp án. Dòng ngân sách 0 có HĐ, trùng mã dòng trước → HĐ thứ 2 của cùng mục ngân sách. */
function entitiesFrom(rows) {
    const budgets = [], contracts = [], variations = [], payments = [], rowKey = new Map();
    const lastByCode = new Map();
    rows.forEach((r, i) => {
        const shared = !r.budget && r.award && r.code && lastByCode.get(r.code);
        const bid = shared || `B${i}`;
        rowKey.set(r.row, bid);
        if (!shared) { budgets.push({ id: bid, project_id: 'P', budgetCode: r.code, packageName: r.name, category: r.group, budgeted: r.budget }); if (r.code) lastByCode.set(r.code, bid); }
        if (!(r.award || r.apprVO || r.subVO || r.certified)) return;
        const cid = `C${i}`; rowKey.set(r.row, cid);
        contracts.push({ contract_id: cid, project_id: 'P', budget_id: bid, package_name: r.name, original_value: r.award });
        if (r.apprVO) variations.push({ id: `V${i}a`, contract_id: cid, status: 'Approved', approved_amount: r.apprVO, claimed_amount: r.apprVO });
        if (r.subVO) variations.push({ id: `V${i}s`, contract_id: cid, status: 'Pending', approved_amount: r.subVO, claimed_amount: 0 });
        if (r.name === 'Main Works') payments.push(...mainWorksIPCs(cid));
        else if (r.certified) payments.push({ ipc_id: `I${i}`, contract_id: cid, project_id: 'P', status: 'Paid', sub_total: r.certified, gross_work_done: r.certified, vat_amount: 0 });
    });
    return { budgets, contracts, variations, payments, rowKey };
}

test('T3.03 cost report tháng 10: từng ô khớp file làm tay; lệch duy nhất là lỗi bên Excel đã giải thích', { skip }, () => {
    const g = JSON.parse(readFileSync(GOLD, 'utf8'));
    const e = entitiesFrom(g.rows);
    const rep = buildCostReport({ ...e, projectId: 'P' });
    const rows = rep.groups.flatMap(x => x.rows);
    assert.equal(rows.length, g.rows.length, 'mỗi dòng Excel ↔ 1 dòng báo cáo');
    const lech = [];
    g.rows.forEach((x) => {
        const key = e.rowKey.get(x.row);
        const r = rows.find(y => y.contractId === key) || rows.find(y => !y.contractId && y.budgetId === key);
        for (const [col, key] of Object.entries(COL)) {
            const want = 'EFGHL'.includes(col) ? x[{ E: 'budget', F: 'award', G: 'apprVO', H: 'subVO', L: 'certified' }[col]] : x.expect[col];
            if (r[key] !== want) lech.push(`${col}${x.row} ${x.name}: app ${r[key]} ≠ Excel ${want}`);
        }
    });
    // 1) Excel quên công thức "Còn lại" ở dòng ID - Ong&Ong (M26 trống) → app tính 6.449.000.000 − 4.884.000.000
    // 2) Sales Gallery: Excel giữ số lẻ của Award/Certified rồi mới trừ; app làm tròn từng số tới đồng trước → lệch 1 đồng
    assert.deepEqual(lech, ['M26 ID - Ong&Ong: app 1565000000 ≠ Excel 0', 'M34 SALES GALLERY: app 1769441198 ≠ Excel 1769441197']);
    const tl = [];
    for (const [col, key] of Object.entries(COL)) if (rep.total[key] !== g.totals[col]) tl.push(`${col}: app ${rep.total[key]} ≠ Excel ${g.totals[col]}`);
    // Tổng: L và N lệch 1 đồng vì Excel cộng các số còn phần lẻ (CM 228.076.923,08; MEP 69.753.382.900,77…), app làm tròn
    // từng dòng tới đồng; M = thiếu "Còn lại" của dòng Ong&Ong (1.565.000.000) + 1 đồng làm tròn Sales Gallery.
    assert.deepEqual(tl, [`L: app ${g.totals.L - 1} ≠ Excel ${g.totals.L}`, `M: app ${g.totals.M + 1_565_000_000 + 1} ≠ Excel ${g.totals.M}`,
        `N: app ${g.totals.N + 1} ≠ Excel ${g.totals.N}`]);
    assert.equal(rep.total.afc, g.totals.K, 'AFC tổng dự án khớp tới đồng');
    assert.equal(rep.total.budget, g.totals.E);
});

const B = (id, budgeted, category = 'Construction', code = id) => ({ id, project_id: 'P', budgetCode: code, packageName: `Gói ${id}`, category, budgeted });
const C = (contract_id, budget_id, original_value) => ({ contract_id, project_id: 'P', budget_id, package_name: `HĐ ${contract_id}`, original_value });

test('T3.04 biên: mục chưa có HĐ → Chưa cam kết = ngân sách; HĐ chưa gắn mục → nhóm Chưa phân mã; tổng không rơi tiền', () => {
    const rep = buildCostReport({ projectId: 'P',
        budgets: [B('102-01', 1000), B('103', 500), B('102-99', 200, 'Contingency')],
        contracts: [C('K1', '102-01', 900), C('K2', 'khong-co', 300), { ...C('K3', '103', 1), project_id: 'Q' }] });
    const by = Object.fromEntries(rep.groups.flatMap(g => g.rows).map(r => [r.contractId || r.budgetId, r]));
    assert.equal(by.K1.nonCommitted, 0); assert.equal(by.K1.balance, 100);
    assert.equal(by['103'].nonCommitted, 500); assert.equal(by['103'].afc, 500);
    assert.equal(by.K2.budget, 0); assert.equal(by.K2.afc, 300); assert.equal(by.K2.balance, -300);
    assert.deepEqual(rep.groups.map(g => g.label), ['Nhà thầu', 'Dự phòng', UNASSIGNED]);
    assert.equal(rep.total.afc, 900 + 500 + 200 + 300);
    assert.equal(rep.total.budget, 1700);
    assert.ok(rep.warnings.some(w => w.includes('chưa gắn mục ngân sách')));
});

test('T3.04 VO: đã duyệt vào Cam kết, chờ duyệt chỉ vào AFC, ưu tiên số QS; thiếu số QS thì cảnh báo; VO không cộng vào Award', () => {
    const variations = [
        { contract_id: 'K1', status: 'Approved', approved_amount: 120, claimed_amount: 150 },
        { contract_id: 'K1', status: 'Pending', approved_amount: -52, claimed_amount: -40 },
        { contract_id: 'K1', status: 'Pending', approved_amount: 0, claimed_amount: 30, vo_name: 'VO-09' },
        { contract_id: 'K1', status: 'Rejected', approved_amount: 999 },
    ];
    const rep = buildCostReport({ projectId: 'P', budgets: [B('102-01', 1000)], contracts: [C('K1', '102-01', 900)], variations });
    const r = rep.groups[0].rows[0];
    assert.deepEqual([r.award, r.apprVO, r.subVO, r.committed, r.afc, r.balance], [900, 120, -22, 1020, 998, 2]);
    assert.ok(rep.warnings.some(w => w.includes('VO-09') && w.includes('chưa có số QS')));
});

test('ngày báo cáo: VO trình sau ngày → bỏ; VO duyệt sau ngày → còn là chờ duyệt; IPC trả sau ngày → chưa tính', () => {
    const v = [{ contract_id: 'K', status: 'Approved', approved_amount: 100, submission_date: '2026-09-20', assessment_date: '2026-11-02' },
        { contract_id: 'K', status: 'Approved', approved_amount: 7, submission_date: '2026-11-03' }];
    assert.deepEqual([voOf(v, 'K', '2026-10-31').approved, voOf(v, 'K', '2026-10-31').submitted], [0, 100]);
    assert.deepEqual([voOf(v, 'K', '2026-11-30').approved, voOf(v, 'K', '2026-11-30').submitted], [107, 0]);
    const p = [{ contract_id: 'K', status: 'Paid', sub_total: 50, paid_date: '2026-10-10' }, { contract_id: 'K', status: 'Paid', sub_total: 70, paid_date: '2026-11-05' },
        { contract_id: 'K', status: 'Approved', sub_total: 1000 }];
    assert.equal(certifiedOf(p, 'K', '2026-10-31'), 50);
    assert.equal(certifiedOf(p, 'K', null), 120);
});

test('xuất Excel: 1 sheet Report đúng bố cục (nhóm A/B…, dòng tổng), số là số, chênh lệch âm hiện đỏ', async () => {
    const { default: ExcelJS } = await import('exceljs');
    const { writeCostReport } = await import('../js/modules/report/cost-report-xlsx.js');
    const rep = buildCostReport({ projectId: 'P', budgets: [B('102-01', 1000), B('104', 50, 'Consultancy')], contracts: [C('K1', '102-01', 900), C('K2', '104', 80)] });
    const wb = new ExcelJS.Workbook();
    assert.equal(writeCostReport(wb, rep, { projectName: 'Dự án thử', asOf: '2026-10-31' }), 2);
    const back = new ExcelJS.Workbook(); await back.xlsx.load(await wb.xlsx.writeBuffer());
    const ws = back.getWorksheet('Report');
    assert.equal(ws.getCell('A1').value, 'DỰ ÁN THỬ');
    assert.equal(ws.getCell('D4').value, 'Budget');
    assert.deepEqual([ws.getCell('A7').value, ws.getCell('C7').value, ws.getCell('D7').value], ['A', 'NHÀ THẦU', 1000]);
    assert.deepEqual([ws.getCell('A8').value, ws.getCell('B8').value, ws.getCell('E8').value, ws.getCell('M8').value], [1, '102-01', 900, 100]);
    assert.equal(ws.getCell('M10').value, -30);
    assert.match(ws.getCell('M10').numFmt, /\[Red\]/);
    assert.equal(ws.getCell('C11').value, 'TOTAL (EXCL. VAT) — TỔNG TRƯỚC THUẾ');
    assert.equal(ws.getCell('J11').value, 980);
});
