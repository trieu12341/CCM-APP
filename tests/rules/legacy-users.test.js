// Quy tắc cũ phải giữ nguyên: hồ sơ người dùng (users/) và bản ghi dự án kiểu cũ (projects/{pid} chứa các mảng).
import { test, after, before } from 'node:test';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { skip, openRules, closeRules, dbOf, newPid } from './support/env.js';

let env;
before(async () => { env = await openRules(); });
after(closeRules);

test('users: tự tạo hồ sơ chỉ được với role pending; không tạo hộ người khác', { skip }, async () => {
    const db = dbOf(env, 'newbie');
    await assertFails(db.doc('users/newbie').set({ role: 'admin', email: 'n@x' }));
    await assertFails(dbOf(env, 'newbie').doc('users/someone-else').set({ role: 'pending' }));
    await assertSucceeds(db.doc('users/newbie').set({ role: 'pending', email: 'n@x' }));
});

test('users: không tự nâng quyền; admin đổi được role của người khác', { skip }, async () => {
    await assertFails(dbOf(env, 'qs1').doc('users/qs1').update({ role: 'admin' }));
    await assertSucceeds(dbOf(env, 'qs1').doc('users/qs1').update({ name: 'QS Một' }));
    await assertSucceeds(dbOf(env, 'admin1').doc('users/pend1').update({ role: 'pending' }));
});

test('users: chỉ đọc hồ sơ của mình (admin đọc được tất cả)', { skip }, async () => {
    await assertSucceeds(dbOf(env, 'qs1').doc('users/qs1').get());
    await assertFails(dbOf(env, 'qs1').doc('users/mgr1').get());
    await assertSucceeds(dbOf(env, 'admin1').doc('users/mgr1').get());
});

test('bản ghi dự án cũ projects/{pid}: user ghi được, manager chỉ đọc, pending không thấy, chỉ admin xóa', { skip }, async () => {
    const pid = newPid();
    await assertSucceeds(dbOf(env, 'qs1').doc(`projects/${pid}`).set({ name: 'Dự án cũ', contracts: [] }));
    await assertSucceeds(dbOf(env, 'mgr1').doc(`projects/${pid}`).get());
    await assertFails(dbOf(env, 'mgr1').doc(`projects/${pid}`).update({ name: 'đổi' }));
    await assertFails(dbOf(env, 'pend1').doc(`projects/${pid}`).get());
    await assertFails(dbOf(env, 'qs1').doc(`projects/${pid}`).delete());
    await assertSucceeds(dbOf(env, 'admin1').doc(`projects/${pid}`).delete());
});

test('mọi đường dẫn khác bị từ chối', { skip }, async () => {
    await assertFails(dbOf(env, 'admin1').doc('settings/x').set({ a: 1 }));
    await assertFails(dbOf(env, 'admin1').doc('settings/x').get());
});
