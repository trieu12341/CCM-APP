// T1.12 sao lưu → khôi phục vào dự án mới khớp tổng kiểm; T1.10 Thùng rác; Reset an toàn.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRepo } from '../../js/data/repo.js';
import { createAuditWriter, listAudit } from '../../js/data/audit.js';
import { createProjectSync } from '../../js/data/project-sync.js';
import { exportProject, exportAll, restoreProject, backupChecksums } from '../../js/data/backup.js';
import { checksums } from '../../js/data/migrate-checks.js';
import { runMigration } from '../../js/data/migrate-run.js';
import { runSafeReset } from '../../js/core/reset-safe.js';
import { trashRows } from '../../js/modules/trash/trash-model.js';
import { openTestDb, newPid } from './support/test-db.js';
import { makeLegacyProject, LARGE } from './support/legacy-fixture.js';

const env = await openTestDb();
after(() => env.close());
const A = { uid: 'uA', name: 'QS An' };
const mk = (user = A) => createRepo({ ...env, user, onWrite: createAuditWriter({ ...env, user }) });
const ready = async (c) => { const end = Date.now() + 8000; while (!c()) { if (Date.now() > end) throw new Error('hết giờ'); await new Promise(r => setTimeout(r, 20)); } };

async function seed(opts) {
    const pid = newPid();
    await env.db.collection('projects').doc(pid).set(makeLegacyProject(pid, opts));
    await runMigration({ db: env.db, fieldValue: env.fieldValue, user: { uid: 'admin', name: 'Admin' }, pid });
    return pid;
}
const liveSums = async (db, pid) => { const r = mk(); const recs = {}; for (const e of ['budgets', 'tenders', 'contracts', 'payments', 'variations', 'cashflows', 'finals']) recs[e] = await r.list(e, pid); return checksums(recs); };

test('T1.12 sao lưu hôm qua → khôi phục vào dự án MỚI: tổng kiểm bằng bản gốc; mã project_id đổi theo; không ghi đè', async () => {
    const pid = await seed(LARGE);
    const file = JSON.parse(JSON.stringify(await exportProject(env.db, pid)));   // đi qua JSON như file thật
    const newPid2 = newPid();
    const r = await restoreProject(env.db, file, newPid2);
    assert.ok(r.written > 700);
    assert.deepEqual(await liveSums(env.db, newPid2), await liveSums(env.db, pid));
    assert.deepEqual(backupChecksums(file), await liveSums(env.db, pid));
    const c = (await mk().list('contracts', newPid2))[0];
    assert.equal(c.project_id, newPid2, 'hồ sơ thuộc dự án mới, app lọc theo project_id mới sẽ thấy');
    assert.equal((await env.db.collection('projects').doc(newPid2).get()).data().projectId, newPid2);
    await assert.rejects(restoreProject(env.db, file, newPid2), /đã tồn tại/);
});

test('sao lưu mọi dự án gồm cả hồ sơ con, nhật ký và danh sách tài khoản', async () => {
    const pid = await seed();
    const all = await exportAll(env.db);
    const p = all.projects.find(x => x.projectId === pid);
    assert.equal(p.collections.payments.length, 4); assert.ok(p.collections.audit.length >= 1);
    assert.ok(Array.isArray(all.users));
});

test('T1.10 Thùng rác: xóa VO-001 (đã duyệt?) → tổng VO bỏ nó → khôi phục → tổng quay lại đúng; nhật ký có 2 dòng', async () => {
    const pid = await seed();
    const lists = {};
    const s = createProjectSync({ repo: mk(), pid, onChange: (e, l) => { lists[e] = l; } });
    s.start(); await ready(() => lists.variations && lists.payments);
    const approved = lists.variations.find(v => v.status === 'Approved');
    const before = (await liveSums(env.db, pid)).voApproved;
    assert.notEqual(approved.approved_amount, 0);
    await s.commit('variations', lists.variations.filter(v => v.vo_id !== approved.vo_id));
    assert.equal((await liveSums(env.db, pid)).voApproved, before - approved.approved_amount, 'tổng VO bỏ hồ sơ đã xóa');
    const all = await mk().list('variations', pid, { includeDeleted: true });
    const rows = trashRows({ variations: all });
    assert.equal(rows.length, 1); assert.equal(rows[0].by, 'QS An'); assert.equal(rows[0].code, approved.vo_id);
    await mk().restore('variations', pid, rows[0].id, rows[0]._v, { reason: 'Khôi phục từ Thùng rác' });
    assert.equal((await liveSums(env.db, pid)).voApproved, before);
    const log = (await listAudit(env.db, pid, { entity: 'variations', entityId: approved.vo_id })).map(e => e.action).sort();
    assert.deepEqual(log, ['delete', 'restore']);
    s.stop();
});

test('Reset an toàn: user thường bị từ chối; gõ sai tên bị từ chối; tải sao lưu lỗi thì KHÔNG xóa gì', async () => {
    const pid = await seed(); const repo = mk(); const base = { db: env.db, repo, pid, projectName: 'Dự án thử', v2: true, scopes: ['payments'], download: async () => {} };
    await assert.rejects(runSafeReset({ ...base, isAdmin: false, typedName: 'Dự án thử' }), /admin/);
    await assert.rejects(runSafeReset({ ...base, isAdmin: true, typedName: 'sai' }), /Tên dự án/);
    await assert.rejects(runSafeReset({ ...base, isAdmin: true, typedName: 'Dự án thử', download: async () => { throw new Error('không tải được'); } }), /không tải được/);
    assert.equal((await repo.list('payments', pid)).length, 4);
});

test('Reset an toàn đúng tên: tải sao lưu TRƯỚC (đủ dữ liệu), rồi xóa mềm đúng phạm vi; khôi phục được; phạm vi khác còn nguyên', async () => {
    const pid = await seed(); const repo = mk(); const downloads = [];
    const r = await runSafeReset({ db: env.db, repo, pid, projectName: 'Dự án thử', typedName: 'Dự án thử', isAdmin: true, v2: true, scopes: ['payments', 'contracts'],
        download: async (b, name) => { downloads.push({ b, name, livePayments: (await repo.list('payments', pid)).length }); } });
    assert.equal(r.deleted, 4 + 3 + 3);   // IPC + HĐ + gói thầu
    assert.equal(downloads.length, 1); assert.equal(downloads[0].livePayments, 4, 'sao lưu được tải khi dữ liệu còn nguyên');
    assert.equal(downloads[0].b.collections.payments.length, 4); assert.match(downloads[0].name, /^CCM_Backup_.*\.json$/);
    assert.equal((await repo.list('payments', pid)).length, 0); assert.equal((await repo.list('variations', pid)).length, 6);
    const trash = trashRows({ payments: await repo.list('payments', pid, { includeDeleted: true }) });
    assert.equal(trash.length, 4);
    for (const t of trash) await repo.restore('payments', pid, t.id, t._v);
    assert.equal((await repo.list('payments', pid)).length, 4);
});
