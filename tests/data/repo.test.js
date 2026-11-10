// Lớp dữ liệu mới js/data/repo.js — chạy trên Firestore giả (mặc định) và Emulator thật (CI).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRepo, ConflictError, ENTITIES } from '../../js/data/repo.js';
import { openTestDb, newPid } from './support/test-db.js';

const env = await openTestDb();
after(() => env.close());
const A = { uid: 'uA', name: 'QS An' }, B = { uid: 'uB', name: 'PM Bình' };
const repoA = createRepo({ ...env, user: A });
const repoB = createRepo({ ...env, user: B });
const IPC = { id: 'IPC-03', contract_id: 'C1', payment_number: 3, lines: [{ code: '102-08', to_date_amount: 1000 }] };

test('tạo hồ sơ: _v = 1, ghi người tạo, chưa xóa', async () => {
    const pid = newPid();
    const r = await repoA.create('payments', pid, IPC);
    assert.deepEqual(r, { id: 'IPC-03', _v: 1 });
    const got = await repoA.get('payments', pid, 'IPC-03');
    assert.equal(got._v, 1); assert.equal(got.createdBy, 'uA'); assert.equal(got.updatedBy, 'uA');
    assert.equal(got.deleted, false); assert.equal(got.lines[0].to_date_amount, 1000);
});

test('tạo trùng mã → ConflictError, bản cũ giữ nguyên', async () => {
    const pid = newPid();
    await repoA.create('payments', pid, IPC);
    await assert.rejects(repoB.create('payments', pid, { ...IPC, payment_number: 99 }), ConflictError);
    assert.equal((await repoA.get('payments', pid, 'IPC-03')).payment_number, 3);
});

test('T1.01 hai người sửa CÙNG hồ sơ: người lưu sau nhận ConflictError nêu tên người trước, số của người trước còn nguyên', async () => {
    const pid = newPid();
    await repoA.create('payments', pid, IPC);
    const openedA = await repoA.get('payments', pid, 'IPC-03');
    const openedB = await repoB.get('payments', pid, 'IPC-03');
    await repoA.save('payments', pid, { ...openedA, lines: [{ code: '102-08', to_date_amount: 1500 }] }, openedA._v);
    const err = await repoB.save('payments', pid, { ...openedB, lines: [{ code: '102-08', to_date_amount: 9999 }] }, openedB._v)
        .then(() => null, e => e);
    assert.ok(err instanceof ConflictError, 'B phải bị chặn');
    assert.equal(err.current.updatedBy, 'uA'); assert.equal(err.current._v, 2);
    const now = await repoA.get('payments', pid, 'IPC-03');
    assert.equal(now.lines[0].to_date_amount, 1500); assert.equal(now._v, 2);
});

test('T1.01 hai người bấm Lưu đúng cùng lúc: đúng một người thành công', async () => {
    const pid = newPid();
    await repoA.create('payments', pid, IPC);
    const res = await Promise.allSettled([
        repoA.save('payments', pid, { ...IPC, note: 'A' }, 1),
        repoB.save('payments', pid, { ...IPC, note: 'B' }, 1),
    ]);
    assert.equal(res.filter(r => r.status === 'fulfilled').length, 1);
    assert.ok(res.find(r => r.status === 'rejected').reason instanceof ConflictError);
    const now = await repoA.get('payments', pid, 'IPC-03');
    assert.equal(now._v, 2); assert.ok(['A', 'B'].includes(now.note));
});

test('T1.02 hai người sửa hai hồ sơ KHÁC nhau cùng lúc: cả hai lưu được', async () => {
    const pid = newPid();
    await repoA.create('payments', pid, IPC);
    await repoA.create('variations', pid, { id: 'VO-01', approved_amount: -52_000_000 });
    await Promise.all([
        repoA.save('payments', pid, { ...IPC, note: 'A sửa IPC' }, 1),
        repoB.save('variations', pid, { id: 'VO-01', approved_amount: -50_000_000 }, 1),
    ]);
    assert.equal((await repoA.get('payments', pid, 'IPC-03')).note, 'A sửa IPC');
    assert.equal((await repoA.get('variations', pid, 'VO-01')).approved_amount, -50_000_000);
});

test('lưu: bỏ trường hệ thống gửi lên, làm sạch undefined/NaN, giữ người tạo', async () => {
    const pid = newPid();
    await repoA.create('contracts', pid, { id: 'C1', original_value: 1_500_000_000 });
    await repoB.save('contracts', pid, { id: 'C1', original_value: NaN, note: undefined, _v: 99, createdBy: 'hacker' }, 1);
    const c = await repoA.get('contracts', pid, 'C1');
    assert.equal(c._v, 2); assert.equal(c.original_value, 0); assert.equal('note' in c, false);
    assert.equal(c.createdBy, 'uA'); assert.equal(c.updatedBy, 'uB');
});

test('xóa mềm → khỏi danh sách, vào thùng rác; khôi phục → quay lại; phiên bản tăng', async () => {
    const pid = newPid();
    await repoA.create('variations', pid, { id: 'VO-01', approved_amount: -52_000_000 });
    await repoA.create('variations', pid, { id: 'VO-02', approved_amount: 120_000_000 });
    await repoA.softDelete('variations', pid, 'VO-01', 1, { reason: 'nhập nhầm' });
    assert.deepEqual((await repoA.list('variations', pid)).map(v => v.id), ['VO-02']);
    const trash = (await repoA.list('variations', pid, { includeDeleted: true })).find(v => v.id === 'VO-01');
    assert.equal(trash.deleted, true); assert.equal(trash.deletedBy, 'uA'); assert.equal(trash._v, 2);
    await repoB.restore('variations', pid, 'VO-01', 2);
    const back = await repoA.get('variations', pid, 'VO-01');
    assert.equal(back.deleted, false); assert.equal(back._v, 3); assert.equal(back.deletedBy, null);
    await assert.rejects(repoA.softDelete('variations', pid, 'VO-01', 2), ConflictError);
});

test('theo dõi realtime: nhận bản mới, không nhận bản đã xóa', async () => {
    const pid = newPid();
    const seen = [];
    const stop = repoA.subscribe('budgets', pid, list => seen.push(list.map(b => b.id).join(',')));
    await repoA.create('budgets', pid, { id: 'B1', budgeted: 1 });
    await repoA.create('budgets', pid, { id: 'B2', budgeted: 2 });
    await repoA.softDelete('budgets', pid, 'B1', 1);
    await new Promise(r => setTimeout(r, 300));
    stop();
    assert.equal(seen.at(-1), 'B2');
});

test('onWrite được gọi trong transaction với trước/sau (cho nhật ký bước 1.3)', async () => {
    const pid = newPid(); const calls = [];
    const repo = createRepo({ ...env, user: A, onWrite: (tx, info) => calls.push({ hasTx: !!tx, ...info }) });
    await repo.create('tenders', pid, { id: 'T1', name: 'Gói 1' });
    await repo.save('tenders', pid, { id: 'T1', name: 'Gói 1 (sửa)' }, 1, { reason: 'đổi tên' });
    assert.deepEqual(calls.map(c => c.action), ['create', 'update']);
    assert.ok(calls.every(c => c.hasTx));
    assert.equal(calls[1].before.name, 'Gói 1'); assert.equal(calls[1].after.name, 'Gói 1 (sửa)'); assert.equal(calls[1].reason, 'đổi tên');
});

test('chặn loại hồ sơ lạ, thiếu dự án, thiếu người dùng', async () => {
    assert.ok(ENTITIES.includes('payments'));
    await assert.rejects(repoA.list('users', 'P1'), /không hợp lệ/);
    await assert.rejects(repoA.list('payments', ''), /Thiếu mã dự án/);
    assert.throws(() => createRepo({ ...env, user: {} }), /user.uid/);
});
