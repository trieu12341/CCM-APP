// Công cụ chuyển dữ liệu chạy dưới rules THẬT: admin chạy được trọn vẹn; user/manager không đổi được schemaVersion.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { skip, openRules, closeRules, dbOf, newPid, FieldValue } from './support/env.js';
import { runMigration } from '../../js/data/migrate-run.js';
import { makeLegacyProject } from '../data/support/legacy-fixture.js';

let env;
before(async () => { env = await openRules(); });
after(closeRules);

const seed = async () => {
    const pid = newPid();
    await env.withSecurityRulesDisabled(ctx => ctx.firestore().doc(`projects/${pid}`).set(makeLegacyProject(pid)));
    return pid;
};
const runAs = (uid, pid) => runMigration({ db: dbOf(env, uid), fieldValue: FieldValue, user: { uid, name: uid }, pid });

test('admin chạy thật dưới rules: ghi theo lô, kiểm lại KHỚP, ghi nhật ký "migrate", đặt schemaVersion = 2', async () => {
    const pid = await seed();
    const r = await runAs('admin1', pid);
    assert.equal(r.written, 28);
    assert.ok(r.verify.ok, JSON.stringify(r.verify.rows.filter(x => !x.ok)));
    assert.equal(r.flipped, true);
    const doc = (await dbOf(env, 'admin1').doc(`projects/${pid}`).get()).data();
    assert.equal(doc.schemaVersion, 2);
    const audit = await dbOf(env, 'admin1').collection(`projects/${pid}/audit`).get();
    assert.deepEqual(audit.docs.map(d => d.data().action), ['migrate']);
    assert.equal((await runAs('admin1', pid)).written, 0, 'chạy lại không ghi thêm gì');
});

test('user thường không hoàn tất được: bị chặn ở dòng nhật ký "migrate", schemaVersion không đổi', async () => {
    const pid = await seed();
    await assert.rejects(runAs('qs1', pid), (e) => e.code === 'permission-denied');
    const doc = (await dbOf(env, 'admin1').doc(`projects/${pid}`).get()).data();
    assert.equal(doc.schemaVersion, undefined);
});

test('manager không ghi được gì', async () => {
    const pid = await seed();
    await assert.rejects(runAs('mgr1', pid), (e) => e.code === 'permission-denied');
    const qs = await dbOf(env, 'admin1').collection(`projects/${pid}/contracts`).get();
    assert.equal(qs.docs.length, 0);
});
