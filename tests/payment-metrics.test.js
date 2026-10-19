import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paymentTotals, monthlyTrend, expendedByBudget, isApprovedIPC, isPaidIPC } from '../js/modules/payment/payment-metrics.js';
import { buildConstructionIPC, previousIPCsFor } from '../js/modules/payment/ipc-chain.js';

const contract = { contract_id: 'C1', project_id: 'P', budget_id: 'B-MAIN', original_value: 10_000_000_000, retention_percent: 10, advance_payment_percent: 15, ap_recovery_percent: 17.5, vat_percent: 8 };

function chain() {
    const ps = [];
    const add = (input) => ps.push(buildConstructionIPC({ contract, input: { contract_id: 'C1', project_id: 'P', ...input }, previousIPCs: previousIPCsFor(ps, 'C1', input.payment_number) }));
    add({ ipc_id: 'A', payment_number: 0, is_advance: true, advance_this_period: 1_500_000_000, status: 'Paid', submission_date: '2026-01-10' });
    add({ ipc_id: 'I1', payment_number: 1, status: 'Paid', submission_date: '2026-02-10',
        lines: [{ code: '102-02', to_date_amount: 600_000_000 }, { code: '102-03', to_date_amount: 400_000_000 }] });
    add({ ipc_id: 'I2', payment_number: 2, status: 'Approved', submission_date: '2026-03-10',
        lines: [{ code: '102-02', to_date_amount: 900_000_000 }, { code: '102-03', to_date_amount: 1_100_000_000 }] });
    add({ ipc_id: 'I3', payment_number: 3, status: 'Draft', submission_date: '2026-04-10',
        lines: [{ code: '102-02', to_date_amount: 1_000_000_000 }, { code: '102-03', to_date_amount: 2_000_000_000 }] });
    return ps;
}

test('trạng thái không phân biệt hoa thường / tiếng Việt', () => {
    assert.ok(isPaidIPC({ status: 'paid' }) && isPaidIPC({ status: 'Đã thanh toán' }));
    assert.ok(isApprovedIPC({ status: 'APPROVED' }) && isApprovedIPC({ status: 'Paid' }));
    assert.ok(!isApprovedIPC({ status: 'Draft' }));
});

test('tổng đã duyệt = Σ(14), giữ lại & thu hồi TƯ là lũy kế đến IPC cuối được tính', () => {
    const ps = chain();
    const t = paymentTotals(ps, { contractId: 'C1', filter: isApprovedIPC });
    const i2 = ps.find(p => p.ipc_id === 'I2').computed;
    assert.equal(t.certifiedExVat, i2.certifiedToDate);       // Σ(14) đến I2 = (10) của I2
    assert.equal(t.retentionHeld, i2.retentionToDate);
    assert.equal(t.apRecovered, i2.apRecoveryToDate);
    assert.equal(t.advancePaid, 1_500_000_000);
    assert.equal(t.advanceOutstanding, 1_500_000_000 - i2.apRecoveryToDate);
    assert.equal(t.grossThisPeriod, 2_000_000_000);            // không cộng tạm ứng vào KL trình
});

test('tiền đã chi (gồm VAT, gồm tạm ứng) chỉ tính IPC đã thanh toán', () => {
    const ps = chain();
    const t = paymentTotals(ps, { filter: isPaidIPC });
    const i1 = ps.find(p => p.ipc_id === 'I1');
    assert.equal(t.cashIncVat, 1_500_000_000 + i1.net_payable);
});

test('biểu đồ theo tháng: trình = tạm ứng + KL gộp kỳ, xác nhận / đã trả = tạm ứng + (14)', () => {
    const tr = monthlyTrend(chain());
    assert.deepEqual(tr.categories, ['T01/2026', 'T02/2026', 'T03/2026', 'T04/2026']);
    assert.equal(tr.submitted[0], 1_500_000_000);              // tháng 1: tạm ứng
    assert.equal(tr.paid[0], 1_500_000_000);
    assert.equal(tr.submitted[3], 1_000_000_000);
    assert.equal(tr.certified[3], 0);                          // Draft
    assert.ok(tr.paid[1] > 0 && tr.paid[2] === 0);
});

test('đã thực hiện theo mã ngân sách = giá trị đến nay của từng dòng (gộp, trước thuế); mã không khớp về mục của HĐ', () => {
    const ps = chain();
    const budgets = [{ id: 'B-MAIN', project_id: 'P', budgetCode: '102-99' }, { id: 'B-PILE', project_id: 'P', budgetCode: '102-02' }];
    const m = expendedByBudget({ payments: ps, contracts: [contract], budgets, projectId: 'P' });
    const total = paymentTotals(ps, { contractId: 'C1', filter: isApprovedIPC }).grossToDate;
    // I2 là IPC đã duyệt cuối: dòng 102-02 đến nay 900tr → về B-PILE nguyên giá trị
    assert.equal(m.get('B-PILE'), 900_000_000);
    assert.equal((m.get('B-PILE') || 0) + (m.get('B-MAIN') || 0), total);
    assert.equal(total, 2_000_000_000);
});

test('phân bổ cam kết theo giá trị HĐ của dòng Bill', async () => {
    const { committedByBudget } = await import('../js/modules/payment/payment-metrics.js');
    const ps = [{ contract_id: 'C1', engine_version: 2, payment_number: 1, lines: [
        { code: '102-02', contract_amount: 3_000 }, { code: '102-03', contract_amount: 7_000 }] }];
    const budgets = [{ id: 'B2', project_id: 'P', budgetCode: '102-02' }, { id: 'B3', project_id: 'P', budgetCode: '102-03' }];
    const m = committedByBudget({ payments: ps, contracts: [{ contract_id: 'C1', project_id: 'P', budget_id: 'BX' }], budgets, projectId: 'P', valueOf: () => 10_001 });
    assert.equal(m.get('B2'), 3_000);
    assert.equal(m.get('B3'), 7_001);
    assert.equal(m.get('BX'), undefined);
});

import { calcPaymentKPIs } from '../js/modules/payment/payment-calc.js';
test('Dashboard tính cả tạm ứng: chỉ có IPC-00 đã duyệt → Trình = Duyệt = số tạm ứng, Đã trả = 0', () => {
    const adv = { ipc_id: 'A', contract_id: 'C1', project_id: 'P', payment_number: 0, is_advance: true, status: 'Approved', advance_this_period: 13_143_626_246, gross_work_done: 0, engine_version: 0 };
    const k = calcPaymentKPIs([adv], []);
    assert.equal(k.totalSubmitted, 13_143_626_246);
    assert.equal(k.totalApproved, 13_143_626_246);
    assert.equal(k.totalPaid, 0);
});

test('Dashboard với chuỗi đầy đủ: Đã trả = tạm ứng + Σ(14) các IPC đã trả', () => {
    const ps = chain();
    const k = calcPaymentKPIs(ps, []);
    const paid = paymentTotals(ps, { filter: isPaidIPC });
    assert.equal(k.totalPaid, 1_500_000_000 + paid.certifiedExVat);
});
