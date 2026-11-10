// scripts/restore.mjs chế độ xem trước (không cần firebase-admin): đọc file sao lưu, in tổng kiểm, KHÔNG ghi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createFakeFirestore } from './data/support/fake-firestore.js';
import { exportAll } from '../js/data/backup.js';
import { planMigration } from '../js/data/migrate-plan.js';
import { makeLegacyProject } from './data/support/legacy-fixture.js';

async function makeFile() {
    const { db } = createFakeFirestore();
    const doc = makeLegacyProject('P1');
    await db.collection('projects').doc('P1').set({ ...doc, schemaVersion: 2 });
    for (const [entity, recs] of Object.entries(planMigration(doc, 'P1').records)) for (const r of recs) await db.collection('projects').doc('P1').collection(entity).doc(r.id).set({ ...r.data, _v: 1, deleted: false });
    const dir = mkdtempSync(join(tmpdir(), 'ccm-bk-')); const file = join(dir, 'b.json');
    writeFileSync(file, JSON.stringify(await exportAll(db)));
    return file;
}
const run = (...a) => spawnSync(process.execPath, ['scripts/restore.mjs', ...a], { encoding: 'utf8', env: { ...process.env, FIREBASE_SERVICE_ACCOUNT: '' } });

test('restore.mjs xem trước: in tổng kiểm đúng, không cần quyền Firebase', async () => {
    const r = run(await makeFile(), 'P1', 'P1-khoiphuc');
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /"payments":4/); assert.match(r.stdout, /Chỉ xem trước/);
});

test('restore.mjs báo rõ khi thiếu tham số hoặc không thấy dự án', async () => {
    assert.equal(run().status, 2);
    const r = run(await makeFile(), 'KHONGCO', 'N');
    assert.equal(r.status, 1); assert.match(r.stderr, /Không thấy dự án KHONGCO/);
});

test('có --yes mà thiếu thông tin đăng nhập → dừng với thông báo rõ, không ghi', async () => {
    const r = run(await makeFile(), 'P1', 'P1-khoiphuc', '--yes');
    assert.notEqual(r.status, 0);
});
