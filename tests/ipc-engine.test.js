import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeIPC, computeConsultancyIPC, previousCumulative, sumLines, summarizeIPC } from '../js/modules/payment/ipc-engine.js';

// Số liệu giả lập (repo public — không dùng số dự án thật)
const contract = {
    original_value: 10_000_000_000, retention_percent: 10, advance_payment_percent: 15,
    ap_recovery_percent: 17.5, vat_percent: 8,
};
const asPrev = (computed) => ({ engine_version: 2, computed });

function run(toDates, extra = []) {
    const prev = [asPrev(computeIPC({ contract, ipc: { advance_this_period: 1_500_000_000 } }))];
    return toDates.map((wd, i) => {
        const c = computeIPC({ contract, ipc: { work_done_to_date: wd, ...(extra[i] || {}) }, previousIPCs: prev });
        prev.push(asPrev(c));
        return c;
    });
}

test('IPC 0 tạm ứng: (16) = (4b), không VAT, không xác nhận KL', () => {
    const c = computeIPC({ contract, ipc: { advance_this_period: 1_500_000_000 } });
    assert.equal(c.advanceToDate, 1_500_000_000);
    assert.equal(c.thisPeriodExVat, 0);
    assert.equal(c.vat, 0);
    assert.equal(c.paymentThisPeriod, 1_500_000_000);
});

test('IPC 1: giữ lại 10%×(7), thu hồi 17,5%×(5), VAT 8%×KL gộp kỳ này', () => {
    const [c] = run([1_234_567_891]);
    assert.equal(c.retentionToDate, 123_456_789);          // ROUND(123.456.789,1)
    assert.equal(c.apRecoveryToDate, 216_049_381);         // ROUND(216.049.380,925)
    assert.equal(c.certifiedToDate, 1_234_567_891 - 123_456_789 - 216_049_381);
    assert.equal(c.thisPeriodExVat, c.certifiedToDate);
    assert.equal(c.vat, 98_765_431);                       // ROUND(98.765.431,28)
    assert.equal(c.paymentThisPeriod, c.thisPeriodExVat + c.vat);
});

test('Lũy kế: (11) = Σ(14) kỳ trước, tổng (14) các kỳ = (10) cuối, không lệch 1 đồng', () => {
    const res = run([1_234_567_891, 2_345_678_917, 3_456_789_123]);
    const sum14 = res.reduce((s, c) => s + c.thisPeriodExVat, 0);
    assert.equal(sum14, res.at(-1).certifiedToDate);
    assert.equal(res[2].previousCertified, res[0].thisPeriodExVat + res[1].thisPeriodExVat);
    // VAT luôn tính trên phần KL gộp tăng thêm của kỳ
    assert.equal(res[1].grossThisPeriod, 2_345_678_917 - 1_234_567_891);
});

test('Thu hồi tạm ứng dừng khi đã thu đủ', () => {
    const res = run([8_000_000_000, 9_500_000_000]);
    assert.equal(res[0].apRecoveryToDate, 1_400_000_000);  // 17,5% × 8 tỷ
    assert.equal(res[1].apRecoveryToDate, 1_500_000_000);  // trần = tạm ứng
    assert.equal(res[1].apRecoveryThisPeriod, 100_000_000);
    assert.equal(res[1].apOutstanding, 0);
});

test('Trần giữ lại (max_retention_percent) và để trống = không giới hạn', () => {
    const capped = computeIPC({ contract: { ...contract, max_retention_percent: 5 }, ipc: { work_done_to_date: 8_000_000_000 } });
    assert.equal(capped.retentionToDate, 500_000_000);      // 5% × 10 tỷ
    const nocap = computeIPC({ contract, ipc: { work_done_to_date: 8_000_000_000 } });
    assert.equal(nocap.retentionToDate, 800_000_000);
});

test('Phát sinh (6) vào (7) và giữ lại, nhưng không vào cơ sở thu hồi tạm ứng', () => {
    const prev = [asPrev(computeIPC({ contract, ipc: { advance_this_period: 1_500_000_000 } }))];
    const c = computeIPC({ contract, ipc: { work_done_to_date: 1_000_000_000, variations_to_date: 200_000_000 }, previousIPCs: prev });
    assert.equal(c.grossToDate, 1_200_000_000);
    assert.equal(c.retentionToDate, 120_000_000);
    assert.equal(c.apRecoveryToDate, 175_000_000);
});

test('Phạt trừ một lần (lũy kế); tạm giữ tự hoàn ở kỳ sau', () => {
    const base = run([1_000_000_000, 2_000_000_000, 3_000_000_000]);
    const withAdj = run([1_000_000_000, 2_000_000_000, 3_000_000_000],
        [{ penalty_this_period: 10_000_000, withhold_this_period: 50_000_000 }, {}, {}]);
    assert.equal(withAdj[0].thisPeriodExVat, base[0].thisPeriodExVat - 60_000_000);
    assert.equal(withAdj[1].thisPeriodExVat, base[1].thisPeriodExVat + 50_000_000); // hoàn tạm giữ
    assert.equal(withAdj[2].thisPeriodExVat, base[2].thisPeriodExVat);              // phạt không trừ lại
    assert.equal(withAdj[2].penaltiesToDate, 10_000_000);
});

test('VAT sửa theo từng IPC (vd 10%)', () => {
    const c = computeIPC({ contract, ipc: { work_done_to_date: 1_000_000_000, vat_pct: 10 } });
    assert.equal(c.vat, 100_000_000);
});

test('Tổng các dòng Bill / mã ngân sách, gồm dòng VE âm', () => {
    assert.equal(sumLines([{ to_date_amount: 1_000.4 }, { to_date_amount: 2_000 }, { to_date_amount: -500.2 }]), 2_500);
    const c = computeIPC({ contract, ipc: { lines: [{ to_date_amount: 600 }, { to_date_amount: 400 }] } });
    assert.equal(c.workDoneToDate, 1_000);
});

test('Quy đổi IPC kiểu cũ (tính rời từng kỳ) sang lũy kế', () => {
    const legacy = [
        { gross_work_done: 1_000, retention_deduction: 100, ap_deduction: 50, sub_total: 850 },
        { gross_work_done: 2_000, retention_deduction: 200, ap_deduction: 100, sub_total: 1_700 },
    ];
    const cum = previousCumulative(legacy);
    assert.deepEqual([cum.workDone, cum.retention, cum.apRecovery, cum.certifiedSum], [3_000, 300, 150, 2_550]);
});

test('summarizeIPC đọc được cả IPC mới và cũ', () => {
    const [c] = run([1_000_000_000]);
    assert.equal(summarizeIPC(asPrev(c)).certifiedExVat, c.thisPeriodExVat);
    assert.equal(summarizeIPC({ gross_work_done: 100, sub_total: 80, vat_amount: 8, net_payable: 88 }).payment, 88);
});

test('Gói tư vấn: làm tròn VAT rồi cộng', () => {
    assert.deepEqual(computeConsultancyIPC({ gross: 1_000_001, qsDeduction: 1, vatPct: 8 }),
        { afterQS: 1_000_000, vat: 80_000, netPayable: 1_080_000 });
});
