// Bước 2.3 bản QS (T2.08, T2.09): khóa số, mở khóa có lý do, IPC sau "cần xem lại", chuỗi không tự sửa IPC đã chốt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildConstructionIPC, recomputeChain, isLockedIPC } from '../js/modules/payment/ipc-chain.js';
import { staleLockedIPCs, unlockPatch } from '../js/modules/payment/ipc-lock.js';

const contract = { contract_id: 'C1', original_value: 10_000_000_000 };
function chain(statuses, toDates) {
    const done = [];
    return statuses.map((status, i) => {
        const rec = { ...buildConstructionIPC({ contract, input: { ipc_id: `I${i + 1}`, contract_id: 'C1', payment_number: i + 1, work_done_to_date: toDates[i] }, previousIPCs: done }), status };
        done.push(rec); return rec;
    });
}

test('T2.08 IPC đã duyệt/đã trả là đã chốt; chuỗi tính lại không đổi số của nó', () => {
    const p = chain(['Approved', 'Approved', 'Paid'], [1e9, 2e9, 3e9]);
    assert.ok(p.every(isLockedIPC));
    const changed = p.map(x => x.ipc_id === 'I1' ? { ...x, work_done_to_date: 1.5e9 } : x);
    const again = recomputeChain(changed, contract);
    assert.deepEqual(again.map(x => x.computed.paymentThisPeriod), p.map(x => x.computed.paymentThisPeriod));
});

test('T2.09 mở khóa IPC-02 và sửa → IPC-03, IPC-04 đã chốt bị đánh dấu cần xem lại; số của chúng KHÔNG tự đổi', () => {
    const p = chain(['Approved', 'Approved', 'Approved', 'Paid'], [1e9, 2e9, 3e9, 4e9]);
    assert.deepEqual(staleLockedIPCs(p, contract), [], 'chuỗi đang khớp');
    const unlocked = p.map(x => x.ipc_id === 'I2' ? { ...x, ...unlockPatch(x, 'Sửa khối lượng cọc theo biên bản', 'QS An'), work_done_to_date: 2.2e9 } : x);
    const after = recomputeChain(unlocked, contract);
    assert.equal(after[1].status, 'Draft');
    assert.notEqual(after[1].computed.paymentThisPeriod, p[1].computed.paymentThisPeriod, 'IPC-02 tính lại');
    assert.equal(after[2].computed.paymentThisPeriod, p[2].computed.paymentThisPeriod, 'IPC-03 giữ nguyên số');
    const stale = staleLockedIPCs(after, contract);
    assert.deepEqual(stale.map(s => s.ipc_id), ['I3', 'I4']);
    assert.ok(stale[0].diff > 0);
});

test('mở khóa bắt buộc lý do, ghi người/lúc/trạng thái cũ; IPC nháp không cần mở khóa', () => {
    const [a] = chain(['Paid'], [1e9]);
    assert.throws(() => unlockPatch(a, '  ', 'QS'), /lý do/);
    const patch = unlockPatch(a, 'Nhập sai VAT', 'QS An', new Date('2026-11-10T03:00:00Z'));
    assert.deepEqual(patch, { status: 'Draft', last_unlock: { at: '2026-11-10T03:00:00.000Z', by: 'QS An', reason: 'Nhập sai VAT', from_status: 'Paid' } });
    assert.throws(() => unlockPatch({ status: 'Draft' }, 'abcdef', 'QS'), /chưa chốt/);
});
