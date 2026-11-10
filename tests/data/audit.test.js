// Nhật ký thay đổi ghi cùng transaction với hồ sơ (js/data/audit.js + repo.js).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRepo, ConflictError } from '../../js/data/repo.js';
import { createAuditWriter, listAudit } from '../../js/data/audit.js';
import { openTestDb, newPid } from './support/test-db.js';

const env = await openTestDb();
after(() => env.close());
const user = { uid: 'uA', name: 'QS An' };
const repo = createRepo({ ...env, user, onWrite: createAuditWriter({ ...env, user }) });

test('T1.07 sửa giá trị HĐ → nhật ký ghi đúng người, hành động, trường, cũ → mới', async () => {
    const pid = newPid();
    await repo.create('contracts', pid, { id: 'C1', package_name: 'Cọc', original_value: 1_500_000_000 });
    await repo.save('contracts', pid, { id: 'C1', package_name: 'Cọc', original_value: 1_450_000_000 }, 1, { reason: 'Giảm trừ theo biên bản' });
    const log = await listAudit(env.db, pid, { entity: 'contracts', entityId: 'C1' });
    const upd = log.find(e => e.action === 'update');
    assert.ok(upd, 'có dòng nhật ký sửa');
    assert.equal(upd.uid, 'uA'); assert.equal(upd.name, 'QS An'); assert.equal(upd.reason, 'Giảm trừ theo biên bản');
    assert.deepEqual(upd.changes, [{ field: 'original_value', from: 1_500_000_000, to: 1_450_000_000 }]);
    assert.ok(upd.at, 'có thời điểm');
    assert.deepEqual(log.map(e => e.action).sort(), ['create', 'update']);
});

test('xóa mềm và khôi phục đều có nhật ký kèm lý do', async () => {
    const pid = newPid();
    await repo.create('variations', pid, { id: 'VO-01', approved_amount: -52_000_000 });
    await repo.softDelete('variations', pid, 'VO-01', 1, { reason: 'nhập nhầm' });
    await repo.restore('variations', pid, 'VO-01', 2);
    const actions = (await listAudit(env.db, pid, { entityId: 'VO-01' })).map(e => `${e.action}:${e.reason ?? ''}`).sort();
    assert.deepEqual(actions, ['create:', 'delete:nhập nhầm', 'restore:']);
});

test('lưu mà không đổi gì → không thêm dòng nhật ký', async () => {
    const pid = newPid();
    await repo.create('budgets', pid, { id: 'B1', budgeted: 1000 });
    await repo.save('budgets', pid, { id: 'B1', budgeted: '1000' }, 1);
    assert.equal((await listAudit(env.db, pid)).length, 1);
});

test('lưu bị chặn vì xung đột → KHÔNG có nhật ký (cùng transaction)', async () => {
    const pid = newPid();
    await repo.create('payments', pid, { id: 'IPC-01', lines: [{ code: '102-08', to_date_amount: 1 }] });
    await repo.save('payments', pid, { id: 'IPC-01', lines: [{ code: '102-08', to_date_amount: 2 }] }, 1);
    await assert.rejects(repo.save('payments', pid, { id: 'IPC-01', lines: [{ code: '102-08', to_date_amount: 3 }] }, 1), ConflictError);
    const ups = (await listAudit(env.db, pid)).filter(e => e.action === 'update');
    assert.equal(ups.length, 1);
    assert.deepEqual(ups[0].changes, [{ field: 'lines[102-08].to_date_amount', from: 1, to: 2 }]);
});
