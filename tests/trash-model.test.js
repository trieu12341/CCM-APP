// Màn Thùng rác (thuần): chỉ hồ sơ đã xóa, mới xóa nhất lên đầu, số ngày còn lại.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trashRows, summaryOf } from '../js/modules/trash/trash-model.js';

const now = new Date('2026-10-30T00:00:00Z');
test('chỉ lấy hồ sơ đã xóa, sắp mới → cũ, kèm người xóa và số ngày còn lại', () => {
    const rows = trashRows({
        variations: [{ id: 'VO-01', vo_id: 'VO-01', _v: 3, deleted: true, deletedAt: new Date('2026-10-29T00:00:00Z'), updatedByName: 'QS An', approved_amount: -52000000 },
            { id: 'VO-02', vo_id: 'VO-02', deleted: false }],
        payments: [{ id: 'IPC-1', ipc_id: 'IPC-1', _v: 2, deleted: true, deletedAt: new Date('2026-09-01T00:00:00Z'), updatedByName: 'PM Bình' }],
    }, now);
    assert.deepEqual(rows.map(r => [r.type, r.code, r.by, r.daysLeft]), [['VO', 'VO-01', 'QS An', 29], ['IPC', 'IPC-1', 'PM Bình', 0]]);
    assert.equal(rows[0]._v, 3);
});

test('mô tả ngắn có tên gói và số tiền', () => {
    assert.equal(summaryOf('contracts', { package_name: 'Cọc', original_value: 1500000000 }), 'Cọc · 1.500.000.000');
    assert.equal(summaryOf('variations', {}), '');
});
