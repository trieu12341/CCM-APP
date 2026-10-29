// Chuyển dữ liệu kiểu cũ → cấu trúc mới: T1.03 (dự án lớn), T1.04 (khớp số), T1.05 (chạy 2 lần), chạy dở rồi chạy tiếp.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { dryRun, runMigration, verifyMigration } from '../../js/data/migrate-run.js';
import { planMigration } from '../../js/data/migrate-plan.js';
import { ENTITIES } from '../../js/data/repo.js';
import { listAudit } from '../../js/data/audit.js';
import { openTestDb, newPid } from './support/test-db.js';
import { makeLegacyProject, LARGE } from './support/legacy-fixture.js';

const env = await openTestDb();
after(() => env.close());
const user = { uid: 'admin1', name: 'Admin' };
const seed = async (opts) => {
    const pid = newPid();
    await env.db.collection('projects').doc(pid).set(makeLegacyProject(pid, opts));
    return pid;
};
const run = (pid, extra = {}) => runMigration({ db: env.db, fieldValue: env.fieldValue, user, pid, ...extra });
const countNew = async (pid) => Object.fromEntries(await Promise.all(ENTITIES.map(async e =>
    [e, (await env.db.collection('projects').doc(pid).collection(e).get()).docs.length])));

test('T1.04 chạy thử → chạy thật → kiểm lại: mọi tổng kiểm KHỚP, số bản ghi bằng nhau, schemaVersion = 2', async () => {
    const pid = await seed();
    const dry = await dryRun(env.db, pid);
    assert.equal(dry.plan.blocking, false);
    assert.deepEqual(await countNew(pid), { budgets: 0, tenders: 0, contracts: 0, payments: 0, variations: 0, cashflows: 0, finals: 0 }, 'chạy thử không ghi gì');
    assert.equal((await env.db.collection('projects').doc(pid).get()).data().schemaVersion, undefined);

    const r = await run(pid);
    assert.equal(r.written, 28); assert.equal(r.flipped, true);
    assert.ok(r.verify.ok && r.verify.rows.every(x => x.ok), JSON.stringify(r.verify.rows.filter(x => !x.ok)));
    assert.deepEqual(await countNew(pid), dry.plan.counts);
    const doc = (await env.db.collection('projects').doc(pid).get()).data();
    assert.equal(doc.schemaVersion, 2);
    assert.equal(doc.contracts.length, 3, 'mảng cũ vẫn còn nguyên, không bị xóa');
    const log = await listAudit(env.db, pid);
    assert.deepEqual(log.map(e => e.action), ['migrate']);
    assert.equal(log[0].uid, 'admin1');
});

test('T1.05 chạy thật lần hai: không thêm bản ghi, tổng kiểm không đổi, không thêm dòng nhật ký', async () => {
    const pid = await seed();
    const first = await run(pid);
    const before = await countNew(pid);
    const second = await run(pid);
    assert.equal(second.written, 0); assert.equal(second.skipped, 28);
    assert.deepEqual(await countNew(pid), before);
    assert.deepEqual(second.verify.rows.map(x => x.after), first.verify.rows.map(x => x.after));
    assert.equal((await listAudit(env.db, pid)).length, 1);
});

test('chạy dở (mất mạng giữa chừng) rồi chạy tiếp: đủ bản ghi, không trùng, chưa đổi schemaVersion cho tới khi xong', async () => {
    const pid = await seed({ cashflows: 900 });   // 900 dòng dòng tiền → 3 lô; ngắt sau lô đầu của dòng tiền
    let batches = 0;
    await assert.rejects(run(pid, { onProgress: () => { if (++batches === 6) throw new Error('mất mạng'); } }), /mất mạng/);
    const partial = await countNew(pid);
    assert.ok(partial.cashflows > 0 && partial.cashflows < 900);
    assert.equal((await env.db.collection('projects').doc(pid).get()).data().schemaVersion, undefined);

    const r = await run(pid);
    assert.equal((await countNew(pid)).cashflows, 900);
    assert.equal(r.skipped, partial.cashflows + partial.budgets + partial.tenders + partial.contracts + partial.payments + partial.variations + partial.finals);
    assert.ok(r.flipped);
});

test('kiểm lại bắt được sai lệch: sửa một bản ghi sau khi chuyển → LỆCH, và chạy lại không âm thầm đè', async () => {
    const pid = await seed();
    await run(pid);
    const plan = planMigration((await env.db.collection('projects').doc(pid).get()).data(), pid);
    const ref = env.db.collection('projects').doc(pid).collection('contracts').doc('C001');
    await ref.update({ original_value: 1 });
    const v = await verifyMigration(env.db, pid, plan);
    assert.equal(v.ok, false);
    assert.deepEqual(v.different, ['contracts/C001']);
    assert.equal(v.rows.find(x => x.key === 'contractValue').ok, false);
    const again = await run(pid);
    assert.equal(again.written, 0); assert.equal(again.flipped, false, 'không đổi schemaVersion khi kiểm lại LỆCH');
});

test('còn lỗi chặn (trùng mã khác nội dung) → không ghi gì', async () => {
    const pid = newPid(); const doc = makeLegacyProject(pid);
    doc.variations.push({ ...doc.variations[0], approved_amount: 5 });
    await env.db.collection('projects').doc(pid).set(doc);
    await assert.rejects(run(pid), /lỗi chặn/);
    assert.equal((await countNew(pid)).variations, 0);
});

test('T1.03 dự án lớn (60 IPC × 30 dòng Bill, 200 VO, 500 dòng dòng tiền): chuyển và khớp số, lô ≤ 400 thao tác', async () => {
    const pid = await seed(LARGE);
    const t0 = Date.now();
    const r = await run(pid);
    assert.ok(r.verify.ok, JSON.stringify(r.verify.rows.filter(x => !x.ok)));
    assert.equal(r.written, 6 + 6 + 6 + 60 + 200 + 500 + 1);
    assert.deepEqual(await countNew(pid), r.plan.counts);
    if (env.batchCommits) assert.ok(env.batchCommits.every(n => n <= 400), `lô quá lớn: ${env.batchCommits}`);
    assert.ok(Date.now() - t0 < 30_000, 'chuyển dự án lớn không quá 30 giây');
});
