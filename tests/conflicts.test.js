// conflicts.js: nhận diện xung đột và nêu người sửa / trường khác nhau.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findConflicts } from '../js/data/conflicts.js';

const fresh = [{ id: 'A', _v: 3, ipc_id: 'A', notes: 'server', updatedByName: 'PM Bình', updatedAt: new Date('2026-10-30T10:00:00Z') }];

test('đúng phiên bản → không xung đột; lệch phiên bản → nêu tên và trường khác nhau (từ server → của tôi)', () => {
    assert.deepEqual(findConflicts([{ entity: 'payments', kind: 'save', id: 'A', expectedV: 3, record: { ipc_id: 'A' } }], fresh, 'ipc_id'), []);
    const [c] = findConflicts([{ entity: 'payments', kind: 'save', id: 'A', expectedV: 2, record: { ipc_id: 'A', notes: 'mine' } }], fresh, 'ipc_id');
    assert.equal(c.by, 'PM Bình'); assert.equal(c.label, 'IPC A'); assert.deepEqual(c.changes, [{ field: 'notes', from: 'server', to: 'mine' }]);
    assert.equal(c.at.getTime(), new Date('2026-10-30T10:00:00Z').getTime());
});

test('hồ sơ đã bị người khác xóa hẳn, và tạo mới trùng mã đều là xung đột', () => {
    const [gone] = findConflicts([{ entity: 'payments', kind: 'save', id: 'Z', expectedV: 1, record: { ipc_id: 'Z' } }], fresh, 'ipc_id');
    assert.equal(gone.gone, true);
    const [dup] = findConflicts([{ entity: 'payments', kind: 'create', id: 'A', record: { ipc_id: 'A' } }], fresh, 'ipc_id');
    assert.equal(dup.by, 'PM Bình');
    assert.deepEqual(findConflicts([{ entity: 'payments', kind: 'create', id: 'N', record: { ipc_id: 'N' } }], fresh, 'ipc_id'), []);
});
