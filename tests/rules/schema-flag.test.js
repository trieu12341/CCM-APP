// Bước 1.7: cờ schemaVersion trên bản ghi dự án chỉ admin đổi được; user vẫn ghi mảng cũ bình thường (dự án chưa chuyển).
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { skip, openRules, closeRules, dbOf, newPid } from './support/env.js';

let env;
before(async () => { env = await openRules(); });
after(closeRules);

const seed = async (data) => { const pid = newPid(); await env.withSecurityRulesDisabled(c => c.firestore().doc(`projects/${pid}`).set(data)); return pid; };

test('user không tự đặt/đổi/xóa schemaVersion (bản ghi dự án), nhưng ghi mảng cũ khi giữ nguyên cờ thì được', { skip }, async () => {
    const pid = await seed({ projectId: 'x', schemaVersion: 2, payments: [] });
    const ref = dbOf(env, 'qs1').doc(`projects/${pid}`);
    await assertSucceeds(ref.set({ payments: [{ ipc_id: 'A' }] }, { merge: true }));        // giữ nguyên cờ
    await assertFails(ref.set({ schemaVersion: 1 }, { merge: true }));                       // hạ cờ → dữ liệu mới bị bỏ qua
    await assertFails(ref.set({ schemaVersion: 3 }, { merge: true }));
    const legacy = dbOf(env, 'qs1').doc(`projects/${await seed({ projectId: 'y' })}`);
    await assertFails(legacy.set({ schemaVersion: 2 }, { merge: true }));                   // tự bật cờ khi chưa chuyển
    await assertSucceeds(legacy.set({ budgets: [] }, { merge: true }));
});

test('tạo dự án mới: user không kèm schemaVersion thì được, kèm thì bị từ chối; admin đổi cờ được', { skip }, async () => {
    await assertSucceeds(dbOf(env, 'qs1').doc(`projects/${newPid()}`).set({ projectId: 'n' }));
    await assertFails(dbOf(env, 'qs1').doc(`projects/${newPid()}`).set({ projectId: 'n', schemaVersion: 2 }));
    const pid = await seed({ projectId: 'z', schemaVersion: 2 });
    await assertSucceeds(dbOf(env, 'admin1').doc(`projects/${pid}`).set({ schemaVersion: 1 }, { merge: true }));   // đường lui khi chuyển lỗi
});

test('manager vẫn không ghi được bản ghi dự án', { skip }, async () => {
    const pid = await seed({ projectId: 'm' });
    await assertFails(dbOf(env, 'mgr1').doc(`projects/${pid}`).set({ budgets: [] }, { merge: true }));
});
