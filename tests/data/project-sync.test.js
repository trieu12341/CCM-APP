// Đồng bộ IPC/VO của dự án v2 (js/data/project-sync.js) trên Firestore giả / Emulator.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRepo } from '../../js/data/repo.js';
import { createAuditWriter, listAudit } from '../../js/data/audit.js';
import { createProjectSync } from '../../js/data/project-sync.js';
import { openTestDb, newPid } from './support/test-db.js';
import { makeLegacyProject } from './support/legacy-fixture.js';
import { runMigration } from '../../js/data/migrate-run.js';

const env = await openTestDb();
after(() => env.close());
const A = { uid: 'uA', name: 'QS An' }, B = { uid: 'uB', name: 'PM Bình' };
const mk = (user) => createRepo({ ...env, user, onWrite: createAuditWriter({ ...env, user }) });

async function seed() {
    const pid = newPid();
    await env.db.collection('projects').doc(pid).set(makeLegacyProject(pid));
    await runMigration({ db: env.db, fieldValue: env.fieldValue, user: { uid: 'admin', name: 'Admin' }, pid });
    return pid;
}
/** Chờ tới khi điều kiện đúng (Emulator thật trả snapshot đầu chậm hơn bản giả). */
async function ready(cond, ms = 8000) {
    const end = Date.now() + ms;
    while (!cond()) { if (Date.now() > end) throw new Error('Hết giờ chờ dữ liệu đầu tiên'); await new Promise(r => setTimeout(r, 20)); }
}
async function open(pid, user, errors = []) {
    const lists = {};
    const s = createProjectSync({ repo: mk(user), pid, onChange: (e, l) => { lists[e] = l; }, onError: (e, i) => errors.push({ e, ...i }) });
    s.start();
    await ready(() => lists.payments && lists.variations);
    return { s, lists, errors, repo: mk(user) };
}
const edit = (list, id, patch) => list.map(x => (x.ipc_id === id ? { ...x, ...patch } : x));

test('mở dự án đã chuyển: đọc đủ IPC/VO từ subcollection (kèm _v)', async () => {
    const pid = await seed(); const a = await open(pid, A);
    assert.equal(a.lists.payments.length, 4); assert.equal(a.lists.variations.length, 6);
    assert.ok(a.lists.payments.every(p => p._v === 1 && p.id === p.ipc_id));
    a.s.stop();
});

test('T1.01 hai người sửa CÙNG IPC: người lưu sau bị chặn, số người trước còn nguyên, bản mới được tải lại', async () => {
    const pid = await seed(); const a = await open(pid, A); const b = await open(pid, B);
    const nextA = edit(a.lists.payments, 'IPC-003', { notes: 'A sửa' });
    const nextB = edit(b.lists.payments, 'IPC-003', { notes: 'B sửa' });
    assert.equal((await a.s.commit('payments', nextA)).ok, true);
    const rb = await b.s.commit('payments', nextB);
    assert.equal(rb.ok, false); assert.equal(b.errors[0].conflict, true);
    const now = await a.repo.get('payments', pid, 'IPC-003');
    assert.equal(now.notes, 'A sửa'); assert.equal(now._v, 2);
    assert.equal(b.s.baseline('payments').find(p => p.ipc_id === 'IPC-003').notes, 'A sửa', 'B đã nhận bản của A');
    a.s.stop(); b.s.stop();
});

test('T1.02 hai người sửa hai hồ sơ KHÁC nhau (IPC và VO): cả hai lưu được, không xung đột', async () => {
    const pid = await seed(); const a = await open(pid, A); const b = await open(pid, B);
    const [ra, rb] = await Promise.all([
        a.s.commit('payments', edit(a.lists.payments, 'IPC-002', { notes: 'A' })),
        b.s.commit('variations', b.lists.variations.map(v => (v.vo_id === 'VO-001' ? { ...v, notes: 'B' } : v))),
    ]);
    assert.ok(ra.ok && rb.ok); assert.deepEqual([...a.errors, ...b.errors], []);
    a.s.stop(); b.s.stop();
});

test('recomputeChain: nhiều IPC đổi cùng lúc ghi trong MỘT giao dịch, IPC không đổi không bị ghi, mỗi IPC có nhật ký', async () => {
    const pid = await seed(); const a = await open(pid, A);
    const next = a.lists.payments.map(p => (p.ipc_id <= 'IPC-002' ? { ...p, notes: 'tính lại' } : p));
    const r = await a.s.commit('payments', next);
    assert.equal(r.written, 2);
    const v = (await a.repo.list('payments', pid)).map(p => [p.ipc_id, p._v]).sort();
    assert.deepEqual(v, [['IPC-001', 2], ['IPC-002', 2], ['IPC-003', 1], ['IPC-004', 1]]);
    const log = (await listAudit(env.db, pid, { entity: 'payments' })).filter(e => e.action === 'update');
    assert.equal(log.length, 2);
    a.s.stop();
});

test('một IPC trong lô bị người khác sửa trước → CẢ LÔ không ghi (không để chuỗi IPC nửa cũ nửa mới)', async () => {
    const pid = await seed(); const a = await open(pid, A); const b = await open(pid, B);
    await b.s.commit('payments', edit(b.lists.payments, 'IPC-002', { notes: 'B xen vào' }));
    const r = await a.s.commit('payments', a.lists.payments.map(p => ({ ...p, notes: 'A tính lại' })));
    assert.equal(r.ok, false);
    const notes = (await a.repo.list('payments', pid)).map(p => p.notes ?? null).sort();
    assert.deepEqual(notes, ['B xen vào', null, null, null]);
    a.s.stop(); b.s.stop();
});

test('lưu liên tiếp (sửa IPC rồi tính lại chuỗi) không tự xung đột với chính mình', async () => {
    const pid = await seed(); const a = await open(pid, A);
    const n1 = edit(a.lists.payments, 'IPC-001', { notes: '1' });
    const n2 = edit(n1, 'IPC-001', { notes: '2' });
    const [r1, r2] = await Promise.all([a.s.commit('payments', n1), a.s.commit('payments', n2)]);
    assert.ok(r1.ok && r2.ok);
    assert.equal((await a.repo.get('payments', pid, 'IPC-001')).notes, '2');
    a.s.stop();
});

test('xóa IPC/VO → xóa mềm (còn trong thùng rác, không hiện trong danh sách); tạo mới giữ mã nghiệp vụ', async () => {
    const pid = await seed(); const a = await open(pid, A);
    await a.s.commit('payments', a.lists.payments.filter(p => p.ipc_id !== 'IPC-004'));
    await a.s.commit('variations', [...a.lists.variations, { vo_id: 'VO-099', project_id: pid, status: 'Pending' }]);
    assert.equal((await a.repo.list('payments', pid)).length, 3);
    assert.equal((await a.repo.list('payments', pid, { includeDeleted: true })).length, 4);
    assert.ok(await a.repo.get('variations', pid, 'VO-099'));
    a.s.stop();
});

test('chặn lưu danh sách trống khi đang có nhiều hồ sơ (nghi mất dữ liệu)', async () => {
    const pid = await seed(); const a = await open(pid, A);
    const r = await a.s.commit('payments', []);
    assert.equal(r.ok, false); assert.equal((await a.repo.list('payments', pid)).length, 4);
    a.s.stop();
});

test('T1.06 (phần dữ liệu) lưu thất bại giữa chừng (lỗi mạng/quyền): không ghi gì, báo lỗi, bản gốc không đổi', async () => {
    const pid = await seed(); const a = await open(pid, A);
    const real = a.s; const errors = [];
    const broken = createProjectSync({ repo: { ...mk(A), saveMany: async () => { throw Object.assign(new Error('denied'), { code: 'permission-denied' }); } }, pid, onError: (e) => errors.push(e) });
    broken.start(); await ready(() => broken.baseline('payments').length === 4);
    const r = await broken.commit('payments', edit(broken.baseline('payments'), 'IPC-001', { notes: 'x' }));
    assert.equal(r.ok, false); assert.equal(errors.length, 1);
    assert.equal((await a.repo.get('payments', pid, 'IPC-001'))._v, 1);
    broken.stop(); real.stop();
});

test('bước 1.7: đủ 7 loại hồ sơ được đọc; hồ sơ cũ thiếu project_id không bị xóa nhầm; trùng mã ở dự án khác không bị nhận nhầm', async () => {
    const pid = await seed();
    const lists = {};
    const s = createProjectSync({ repo: mk(A), pid, onChange: (e, l) => { lists[e] = l; } });
    s.start();
    await ready(() => ['budgets', 'tenders', 'contracts', 'payments', 'variations', 'cashflows', 'finals'].every(e => lists[e]));
    assert.deepEqual([lists.budgets.length, lists.tenders.length, lists.contracts.length, lists.cashflows.length, lists.finals.length], [3, 3, 3, 8, 1]);
    // hồ sơ thiếu project_id (dữ liệu rất cũ): vẫn thuộc dự án này, lưu lại KHÔNG bị xóa mềm
    const noPid = lists.contracts.map(({ project_id, ...c }) => c);
    assert.equal((await s.commit('contracts', noPid.filter(c => s.owns('contracts', c)))).ok, true);
    assert.equal((await mk(A).list('contracts', pid)).length, 3);
    // hồ sơ cùng mã nhưng thuộc dự án khác: không phải của dự án này
    assert.equal(s.owns('contracts', { contract_id: 'C001', project_id: 'KHAC' }), false);
    // sửa ngân sách và dòng tiền: mỗi cái một bản ghi, có nhật ký
    await s.commit('budgets', lists.budgets.map(b => (b.id === 'BG-1' ? { ...b, budgeted: b.budgeted + 1 } : b)));
    await s.commit('cashflows', lists.cashflows.filter(c => c.id !== 'cf-1'));
    assert.equal((await mk(A).get('budgets', pid, 'BG-1'))._v, 2);
    assert.equal((await mk(A).list('cashflows', pid)).length, 7);
    s.stop();
});


const hold = () => { let release, fail; const p = new Promise((res, rej) => { release = res; fail = rej; }); p.catch(() => {}); return { p, release, fail }; };
async function openOffline(pid, user, { online }) {
    const lists = {}, errors = [], statuses = [];
    const repo = mk(user); const gates = []; const seen = new Set();
    // mất mạng: không nhận snapshot mới (máy A không thấy thay đổi của người khác)
    const wrapped = { ...repo, subscribe: (e, p, cb) => repo.subscribe(e, p, (l) => { if (online.v || !seen.has(e)) { seen.add(e); cb(l); } }), // Ghi theo lô lúc offline: áp dụng trong máy ngay; chỉ lên server khi "có mạng" (release), hoặc bị từ chối (fail)
        writeBatch: (pid2, ops) => { const g = hold(); gates.push(g); return { results: ops.map(o => ({ entity: o.entity, id: o.id, kind: o.kind, _v: o.kind === 'create' ? 1 : o.expectedV + 1 })), committed: g.p.then(() => repo.writeBatch(pid2, ops).committed) }; } };
    const s = createProjectSync({ repo: wrapped, pid, isOnline: () => online.v, onChange: (e, l) => { lists[e] = l; }, onError: (e, i) => errors.push(i), onStatus: (x) => statuses.push(x) });
    s.start(); await ready(() => lists.payments && lists.variations);
    return { s, lists, errors, statuses, gates, repo };
}

test('T1.06 mất mạng: lưu xếp hàng (Chờ đồng bộ), lưu tiếp không tự xung đột, có mạng lại thì lên server, huy hiệu về Đã lưu', async () => {
    const pid = await seed(); const online = { v: false };
    const a = await openOffline(pid, A, { online });
    const n1 = edit(a.lists.payments, 'IPC-001', { notes: 'offline 1' });
    const r1 = await a.s.commit('payments', n1);
    assert.ok(r1.ok); assert.equal(a.s.status(), 'pending');
    const r2 = await a.s.commit('payments', edit(n1, 'IPC-001', { notes: 'offline 2' }));   // sửa tiếp khi vẫn chưa gửi
    assert.ok(r2.ok); assert.equal(a.s.baseline('payments').find(p => p.ipc_id === 'IPC-001')._v, 3);
    online.v = true; a.gates.forEach(g => g.release()); await ready(() => a.s.status() === 'saved');
    const got = await mk(B).get('payments', pid, 'IPC-001');
    assert.equal(got.notes, 'offline 2'); assert.equal(got._v, 3); assert.equal(got.updatedByName, 'QS An');
    assert.deepEqual(a.errors, []);
    const log = (await listAudit(env.db, pid, { entity: 'payments', entityId: 'IPC-001' })).filter(e => e.action === 'update');
    assert.equal(log.length, 2, 'mỗi lần lưu có dòng nhật ký');
    a.s.stop();
});

test('T1.01+T1.06: lưu offline nhưng người khác đã sửa trước → server từ chối, báo xung đột nêu TÊN người kia và trường khác nhau, tải lại bản server', async () => {
    const pid = await seed(); const online = { v: false };
    const a = await openOffline(pid, A, { online }); const b = await open(pid, B);
    await b.s.commit('payments', edit(b.lists.payments, 'IPC-002', { notes: 'B sửa trước', gross_note: 1 }));
    await new Promise(r => setTimeout(r, 100));   // máy A vẫn mất mạng nên không thấy thay đổi của B
    await a.s.commit('payments', edit(a.lists.payments, 'IPC-002', { notes: 'A sửa offline' }));
    assert.equal(a.s.status(), 'pending');
    online.v = true; a.gates.forEach(g => g.fail(Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' })));
    await ready(() => a.errors.length === 1);
    const c = a.errors[0].conflicts[0];
    assert.equal(a.errors[0].conflict, true); assert.equal(c.by, 'PM Bình'); assert.equal(c.id, 'IPC-002');
    assert.ok(c.changes.some(x => x.field === 'notes' && x.from === 'B sửa trước' && x.to === 'A sửa offline'));
    assert.equal(a.s.baseline('payments').find(p => p.ipc_id === 'IPC-002').notes, 'B sửa trước');
    assert.equal(a.s.status(), 'error');
    a.s.stop(); b.s.stop();
});

test('xung đột khi có mạng cũng kèm tên người sửa và trường khác nhau', async () => {
    const pid = await seed(); const a = await open(pid, A); const b = await open(pid, B);
    const nextA = edit(a.lists.payments, 'IPC-003', { notes: 'A' }), nextB = edit(b.lists.payments, 'IPC-003', { notes: 'B' });
    b.s.markOpened('payments', 'IPC-003');   // B mở form sửa IPC-003 ở _v 1
    await a.s.commit('payments', nextA);
    await new Promise(r => setTimeout(r, 100));   // bản của A về máy B (realtime) TRƯỚC khi B bấm Lưu
    assert.equal(b.s.baseline('payments').find(p => p.ipc_id === 'IPC-003')._v, 2);
    await b.s.commit('payments', nextB);
    const c = b.errors[0].conflicts[0];
    assert.equal(c.by, 'QS An'); assert.deepEqual(c.changes.map(x => [x.field, x.from, x.to]), [['notes', 'A', 'B']]);
    assert.ok(c.at, 'có giờ người kia lưu');
    a.s.stop(); b.s.stop();
});

test('xóa mềm cũng có tên người xóa trên hồ sơ (cho Thùng rác)', async () => {
    const pid = await seed(); const a = await open(pid, A);
    await a.s.commit('variations', a.lists.variations.filter(v => v.vo_id !== 'VO-002'));
    const gone = (await a.repo.list('variations', pid, { includeDeleted: true })).find(v => v.vo_id === 'VO-002');
    assert.equal(gone.deleted, true); assert.equal(gone.deletedBy, 'uA'); assert.equal(gone.updatedByName, 'QS An');
    a.s.stop();
});
