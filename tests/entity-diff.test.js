// entity-diff.js: chỉ ghi hồ sơ thực sự đổi; _v lấy từ bản gốc, không từ state.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planOps, applyResult } from '../js/data/entity-diff.js';

const base = [
    { id: 'IPC-01', _v: 3, ipc_id: 'IPC-01', gross: 100, updatedAt: 'x' },
    { id: 'IPC-02', _v: 1, ipc_id: 'IPC-02', gross: 200 },
];

test('không đổi gì → không thao tác (bỏ qua trường hệ thống)', () => {
    const next = [{ ...base[0], _v: 99 }, { ipc_id: 'IPC-02', gross: 200, deleted: false }];
    assert.deepEqual(planOps('payments', 'ipc_id', base, next).ops, []);
});

test('chỉ IPC đổi mới được save, dùng _v của bản gốc; IPC mới → create; IPC biến mất → delete mềm', () => {
    const next = [{ ...base[0], gross: 150, _v: 99 }, { ipc_id: 'IPC/03', gross: 5 }];
    const { ops } = planOps('payments', 'ipc_id', base, next);
    assert.deepEqual(ops.map(o => [o.kind, o.id, o.expectedV]), [['save', 'IPC-01', 3], ['create', 'IPC_03', undefined], ['delete', 'IPC-02', 1]]);
});

test('hồ sơ thiếu mã bị bỏ qua và báo lại; trùng mã trong mảng chỉ ghi một lần', () => {
    const { ops, skipped } = planOps('variations', 'vo_id', [], [{ vo_id: 'V1' }, { vo_id: 'V1', x: 1 }, { x: 2 }]);
    assert.equal(ops.length, 1); assert.equal(skipped.length, 1);
});

test('applyResult: cập nhật _v, thêm bản mới, bỏ bản đã xóa', () => {
    const { ops } = planOps('payments', 'ipc_id', base, [{ ...base[0], gross: 1 }, { ipc_id: 'N', a: 1 }]);
    const out = applyResult('payments', 'ipc_id', base, ops, ops.map((o, i) => ({ _v: o.kind === 'create' ? 1 : o.expectedV + 1 })));
    assert.deepEqual(out.map(r => [r.id, r._v]).sort(), [['IPC-01', 4], ['N', 1]]);
});
