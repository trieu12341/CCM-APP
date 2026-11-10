// Bước 1.6 dưới rules THẬT: ghi nhiều IPC/VO trong một giao dịch (kèm nhật ký từng hồ sơ) được phép với user; manager bị chặn; sai _v thì cả lô hỏng.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { skip, openRules, closeRules, repoOf, newPid } from './support/env.js';
import { listAudit } from '../../js/data/audit.js';

let env;
before(async () => { env = await openRules(); });
after(closeRules);

test('user ghi 3 hồ sơ thuộc 2 loại trong một giao dịch: được; mỗi hồ sơ có nhật ký riêng', { skip }, async () => {
    const pid = newPid();
    const { repo, db } = repoOf(env, 'qs1');
    await repo.saveMany(pid, [
        { entity: 'payments', kind: 'create', id: 'IPC-01', record: { ipc_id: 'IPC-01', a: 1 } },
        { entity: 'payments', kind: 'create', id: 'IPC-02', record: { ipc_id: 'IPC-02', a: 2 } },
        { entity: 'variations', kind: 'create', id: 'VO-01', record: { vo_id: 'VO-01', a: 3 } },
    ]);
    await repo.saveMany(pid, [
        { entity: 'payments', kind: 'save', id: 'IPC-01', expectedV: 1, record: { ipc_id: 'IPC-01', a: 10 } },
        { entity: 'payments', kind: 'delete', id: 'IPC-02', expectedV: 1 },
    ]);
    const log = await listAudit(db, pid);
    assert.deepEqual(log.map(e => `${e.action}:${e.entityId}`).sort(), ['create:IPC-01', 'create:IPC-02', 'create:VO-01', 'delete:IPC-02', 'update:IPC-01']);
    assert.equal((await repo.get('payments', pid, 'IPC-01'))._v, 2);
});

test('sai _v ở một hồ sơ → cả lô không ghi (kể cả hồ sơ đúng _v)', { skip }, async () => {
    const pid = newPid();
    const { repo } = repoOf(env, 'qs1');
    await repo.saveMany(pid, [
        { entity: 'payments', kind: 'create', id: 'IPC-01', record: { ipc_id: 'IPC-01', a: 1 } },
        { entity: 'payments', kind: 'create', id: 'IPC-02', record: { ipc_id: 'IPC-02', a: 2 } },
    ]);
    await assert.rejects(repo.saveMany(pid, [
        { entity: 'payments', kind: 'save', id: 'IPC-01', expectedV: 1, record: { ipc_id: 'IPC-01', a: 99 } },
        { entity: 'payments', kind: 'save', id: 'IPC-02', expectedV: 7, record: { ipc_id: 'IPC-02', a: 99 } },
    ]), (e) => e.name === 'ConflictError');
    assert.equal((await repo.get('payments', pid, 'IPC-01')).a, 1);
});

test('manager không ghi được lô nào', { skip }, async () => {
    const pid = newPid();
    const { repo } = repoOf(env, 'mgr1');
    await assert.rejects(repo.saveMany(pid, [{ entity: 'payments', kind: 'create', id: 'IPC-01', record: { ipc_id: 'IPC-01' } }]), (e) => e.code === 'permission-denied');
});

test('ghi theo LÔ (đường mất mạng) dưới rules thật: tạo/sửa/xóa mềm kèm nhật ký được; bản cũ bị server từ chối (T1.14)', { skip }, async () => {
    const pid = newPid();
    const { repo, db } = repoOf(env, 'qs1');
    await repo.writeBatch(pid, [
        { entity: 'payments', kind: 'create', id: 'IPC-01', record: { ipc_id: 'IPC-01', a: 1 } },
        { entity: 'payments', kind: 'create', id: 'IPC-02', record: { ipc_id: 'IPC-02', a: 2 } },
    ]).committed;
    const cur = await repo.get('payments', pid, 'IPC-01');
    await repo.writeBatch(pid, [
        { entity: 'payments', kind: 'save', id: 'IPC-01', expectedV: 1, before: cur, record: { ipc_id: 'IPC-01', a: 10 } },
        { entity: 'payments', kind: 'delete', id: 'IPC-02', expectedV: 1, before: await repo.get('payments', pid, 'IPC-02') },
    ]).committed;
    const log = await listAudit(db, pid);
    assert.deepEqual(log.map(e => `${e.action}:${e.entityId}`).sort(), ['create:IPC-01', 'create:IPC-02', 'delete:IPC-02', 'update:IPC-01']);
    // người khác đã lưu IPC-01 (đang _v 2); lô cũ mang _v 1 → bị từ chối, giá trị giữ nguyên
    await assert.rejects(repo.writeBatch(pid, [{ entity: 'payments', kind: 'save', id: 'IPC-01', expectedV: 1, before: cur, record: { ipc_id: 'IPC-01', a: 99 } }]).committed,
        (e) => e.code === 'permission-denied');
    assert.equal((await repo.get('payments', pid, 'IPC-01')).a, 10);
    assert.equal((await repo.get('payments', pid, 'IPC-01')).updatedByName, 'qs1');
});

test('lô gồm cả hồ sơ đúng và sai _v → cả lô bị từ chối', { skip }, async () => {
    const pid = newPid();
    const { repo } = repoOf(env, 'qs1');
    await repo.writeBatch(pid, ['A', 'B'].map(i => ({ entity: 'payments', kind: 'create', id: i, record: { ipc_id: i, a: 1 } }))).committed;
    const [a, b] = [await repo.get('payments', pid, 'A'), await repo.get('payments', pid, 'B')];
    await assert.rejects(repo.writeBatch(pid, [
        { entity: 'payments', kind: 'save', id: 'A', expectedV: 1, before: a, record: { ipc_id: 'A', a: 2 } },
        { entity: 'payments', kind: 'save', id: 'B', expectedV: 5, before: b, record: { ipc_id: 'B', a: 2 } },
    ]).committed, (e) => e.code === 'permission-denied');
    assert.equal((await repo.get('payments', pid, 'A')).a, 1);
});
