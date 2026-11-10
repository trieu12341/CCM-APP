// Lập kế hoạch chuyển dữ liệu (thuần): giữ mã cũ, báo lỗi/cảnh báo đúng, tổng kiểm đúng định nghĩa, chia lô an toàn.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planMigration, chunkWrites, stable, safeId } from '../js/data/migrate-plan.js';
import { checksums } from '../js/data/migrate-checks.js';
import { paymentTotals, isApprovedIPC } from '../js/modules/payment/payment-metrics.js';
import { makeLegacyProject } from './data/support/legacy-fixture.js';

const codes = (plan, level) => plan.issues.filter(i => i.level === level).map(i => i.code);

test('dự án sạch: mọi bản ghi giữ mã cũ, không lỗi, không cảnh báo', () => {
    const doc = makeLegacyProject('P1');
    const plan = planMigration(doc, 'P1');
    assert.deepEqual(plan.issues, []);
    assert.equal(plan.blocking, false);
    assert.deepEqual(plan.counts, { budgets: 3, tenders: 3, contracts: 3, payments: 4, variations: 6, cashflows: 8, finals: 1 });
    assert.deepEqual(plan.records.contracts.map(r => r.id), ['C001', 'C002', 'C003']);
    assert.equal(plan.records.contracts[0].data.contract_id, 'C001');   // mã khác "id" vẫn nằm trong nội dung
    assert.equal('id' in plan.records.budgets[0].data, false);           // "id" là tên bản ghi, không lặp trong nội dung
});

test('thiếu mã → gán mã tạm + cảnh báo (không mất dữ liệu)', () => {
    const doc = makeLegacyProject('P1'); delete doc.contracts[1].contract_id;
    const plan = planMigration(doc, 'P1');
    assert.deepEqual(codes(plan, 'warn'), ['thieu-ma']);
    assert.equal(plan.records.contracts[1].id, 'LEG-contracts-2');
    assert.equal(plan.records.contracts[1].data.contract_id, 'LEG-contracts-2');
    assert.equal(plan.counts.contracts, 3);
});

test('trùng mã: giống hệt → gộp + cảnh báo; khác nội dung → lỗi chặn', () => {
    const same = makeLegacyProject('P1'); same.variations.push({ ...same.variations[0] });
    const p1 = planMigration(same, 'P1');
    assert.deepEqual(codes(p1, 'warn'), ['trung-ma-giong']); assert.equal(p1.blocking, false); assert.equal(p1.counts.variations, 6);

    const diff = makeLegacyProject('P1'); diff.variations.push({ ...diff.variations[0], approved_amount: 1 });
    const p2 = planMigration(diff, 'P1');
    assert.deepEqual(codes(p2, 'error'), ['trung-ma-khac']); assert.equal(p2.blocking, true);
});

test('mã có "/" được đổi an toàn; phần tử rỗng bị bỏ; sai dự án và trường hệ thống chỉ cảnh báo', () => {
    const doc = makeLegacyProject('P1');
    doc.payments[0].ipc_id = 'IPC/01'; doc.budgets.push(null);
    doc.tenders[0].project_id = 'P9'; doc.contracts[0].updatedAt = 'x'; doc.contracts[0]._v = 7;
    const plan = planMigration(doc, 'P1');
    assert.deepEqual(codes(plan, 'warn').sort(), ['doi-ma', 'khac-du-an', 'phan-tu-rong', 'truong-he-thong']);
    assert.equal(plan.records.payments[0].id, 'IPC_01');
    assert.equal('_v' in plan.records.contracts[0].data, false);
    assert.equal(safeId('..'), 'id..');
});

test('trường không phải danh sách → lỗi chặn; trường vắng → bỏ qua', () => {
    const doc = makeLegacyProject('P1'); doc.payments = { oops: 1 }; delete doc.finals; delete doc.final_statements;
    const plan = planMigration(doc, 'P1');
    assert.deepEqual(codes(plan, 'error'), ['khong-phai-mang']);
    assert.equal(plan.counts.finals, 0);
});

test('tổng kiểm theo đúng định nghĩa của app: Σ(14) và tạm ứng chỉ IPC đã duyệt, VO chỉ Approved, HĐ đọc cả bí danh giá trị', () => {
    const doc = makeLegacyProject('P1');
    const plan = planMigration(doc, 'P1');
    const t = paymentTotals(doc.payments, { filter: isApprovedIPC });
    assert.equal(plan.checksums.ipcCertifiedExVat, Math.round(t.certifiedExVat));
    assert.equal(plan.checksums.ipcAdvance, Math.round(t.advancePaid));
    assert.ok(plan.checksums.ipcCertifiedExVat > 0 && plan.checksums.payments === 4);
    const expectVO = doc.variations.filter(v => v.status === 'Approved').reduce((s, v) => s + v.approved_amount, 0);
    assert.equal(plan.checksums.voApproved, expectVO);
    assert.equal(checksums({ contracts: [{ total_value: 5 }, { value: '1.000' }] }).contractValue, 1005);   // bí danh cũ + chuỗi kiểu VN
    assert.equal(checksums({ budgets: [{ budgeted: 7 }, { budgeted: 5, deleted: true }] }).budgetTotal, 7);  // bỏ thùng rác
});

test('chunkWrites: mỗi lô ≤ 400 bản ghi và ≤ ngưỡng dung lượng, giữ nguyên thứ tự và không rơi bản ghi nào', () => {
    const items = Array.from({ length: 1234 }, (_, i) => ({ id: `i${i}`, data: { n: i } }));
    const chunks = chunkWrites(items);
    assert.deepEqual(chunks.map(c => c.length), [400, 400, 400, 34]);
    assert.deepEqual(chunks.flat().map(x => x.id), items.map(x => x.id));
    const big = Array.from({ length: 10 }, (_, i) => ({ id: `b${i}`, data: { blob: 'x'.repeat(500_000) } }));
    assert.ok(chunkWrites(big, { maxBytes: 1_200_000 }).every(c => c.length <= 2));
    assert.deepEqual(chunkWrites([]), []);
});

test('stable: không phụ thuộc thứ tự khóa; phân biệt số và chuỗi', () => {
    assert.equal(stable({ a: 1, b: [1, { c: 2, d: 3 }] }), stable({ b: [1, { d: 3, c: 2 }], a: 1 }));
    assert.notEqual(stable({ a: 1 }), stable({ a: '1' }));
});
