import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildConstructionIPC, recomputeChain, previousIPCsFor, nextPaymentNumber, newIPCId, linesFromPrevious, isLockedIPC } from '../js/modules/payment/ipc-chain.js';

const contract = { contract_id: 'C1', original_value: 10_000_000_000, retention_percent: 10, advance_payment_percent: 15, ap_recovery_percent: 17.5, vat_percent: 8 };

function makeChain(statuses = ['Paid', 'Draft', 'Draft']) {
    const payments = [];
    const adv = buildConstructionIPC({ contract, input: { ipc_id: 'A', contract_id: 'C1', payment_number: 0, is_advance: true, advance_this_period: 1_500_000_000, status: 'Paid' }, previousIPCs: [] });
    payments.push(adv);
    [1_000_000_000, 2_000_000_000, 3_000_000_000].forEach((wd, i) => {
        const prev = previousIPCsFor(payments, 'C1', i + 1);
        payments.push(buildConstructionIPC({ contract, input: { ipc_id: `I${i + 1}`, contract_id: 'C1', payment_number: i + 1, work_done_to_date: wd, status: statuses[i] }, previousIPCs: prev }));
    });
    return payments;
}

test('IPC tạm ứng: trường tương thích = số tạm ứng', () => {
    const [adv] = makeChain();
    assert.equal(adv.net_payable, 1_500_000_000);
    assert.equal(adv.gross_work_done, 1_500_000_000);
    assert.equal(adv.sub_total, 0);
});

test('Trường tương thích của IPC xây dựng là số KỲ NÀY', () => {
    const p = makeChain();
    const i2 = p.find(x => x.ipc_id === 'I2');
    assert.equal(i2.gross_work_done, 1_000_000_000);
    assert.equal(i2.retention_deduction, 100_000_000);
    assert.equal(i2.ap_deduction, 175_000_000);
    assert.equal(i2.net_payable, i2.sub_total + i2.vat_amount);
});

test('Sửa kỳ 2 → kỳ 3 (chưa duyệt) tự tính lại (11); kỳ đã duyệt giữ nguyên', () => {
    let p = makeChain(['Paid', 'Draft', 'Draft']);
    const before3 = p.find(x => x.ipc_id === 'I3').computed.thisPeriodExVat;
    p = p.map(x => x.ipc_id === 'I2' ? { ...x, work_done_to_date: 2_500_000_000 } : x);
    p = recomputeChain(p, contract);
    const i2 = p.find(x => x.ipc_id === 'I2'), i3 = p.find(x => x.ipc_id === 'I3');
    assert.equal(i2.computed.workDoneToDate, 2_500_000_000);
    assert.equal(i3.computed.previousCertified, p.find(x => x.ipc_id === 'I1').sub_total + i2.sub_total);
    assert.notEqual(i3.computed.thisPeriodExVat, before3);
    // Tổng (14) vẫn = (10) cuối
    const sum = ['I1', 'I2', 'I3'].reduce((s, id) => s + p.find(x => x.ipc_id === id).sub_total, 0);
    assert.equal(sum, i3.computed.certifiedToDate);
});

test('IPC đã duyệt không bị tính lại', () => {
    let p = makeChain(['Paid', 'Approved', 'Draft']);
    const locked = p.find(x => x.ipc_id === 'I2');
    p = p.map(x => x.ipc_id === 'I2' ? { ...x, work_done_to_date: 9 } : x);
    p = recomputeChain(p, contract);
    assert.equal(p.find(x => x.ipc_id === 'I2').computed.workDoneToDate, locked.computed.workDoneToDate);
    assert.ok(isLockedIPC(locked));
});

test('Số đợt kế tiếp và mã IPC không trùng', () => {
    const p = makeChain();
    assert.equal(nextPaymentNumber(p, 'C1'), 4);
    assert.equal(nextPaymentNumber(p, 'C9'), 1);
    const id = newIPCId([{ ipc_id: 'IPC-07' }, { ipc_id: 'IPC-03' }]);
    assert.match(id, /^IPC-08-/);
    assert.match(newIPCId([{ ipc_id: 'IPC-09-a1b2' }, { ipc_id: 'ipc-02' }]), /^IPC-10-/);
});

test('Lấy dòng Bill từ kỳ trước: đến nay kỳ trước thành "kỳ trước"', () => {
    const lines = linesFromPrevious([{ lines: [{ code: '102-02', description: 'Cọc', contract_amount: 100, to_date_amount: 60 }] }]);
    assert.deepEqual(lines[0], { code: '102-02', description: 'Cọc', contract_amount: 100, previous_amount: 60, to_date_amount: 60 });
});
