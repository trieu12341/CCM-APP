// Bước 2.1 (T2.01, T2.02): vai trò theo dự án. Ma trận 4 vai trò dự án + admin + người ngoài, trên 2 dự án.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { skip, openRules, closeRules, dbOf, repoOf, newPid } from './support/env.js';

let env;
before(async () => {
    env = await openRules();
    if (!env) return;
    await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        for (const [uid, role] of Object.entries({ pmU: 'user', accU: 'user', viewU: 'user', outU: 'user' })) await db.doc(`users/${uid}`).set({ role, email: `${uid}@ccm.test` });
    });
});
after(closeRules);

const mkProject = async (members) => {
    const pid = newPid();
    await env.withSecurityRulesDisabled(c => c.firestore().doc(`projects/${pid}`).set({ projectId: pid, ...(members ? { members } : {}) }));
    return pid;
};
const MEM = { qs1: 'qs', pmU: 'pm', accU: 'accountant', viewU: 'viewer' };
const rec = (id) => ({ id, package_name: 'Cọc', original_value: 1 });

test('T2.01 thành viên thấy và ghi theo vai trò; viewer chỉ xem; người ngoài dự án bị từ chối cả đọc lẫn ghi', { skip }, async () => {
    const A = await mkProject(MEM), B = await mkProject({ qs2: 'qs' });
    for (const uid of ['qs1', 'pmU', 'accU']) {
        await assertSucceeds(repoOf(env, uid).repo.create('contracts', A, rec(`C-${uid}`)));
    }
    await assertFails(repoOf(env, 'viewU').repo.create('contracts', A, rec('C-v')));
    await assertSucceeds(dbOf(env, 'viewU').collection(`projects/${A}/contracts`).get());
    // qs1 là thành viên A, không thuộc B
    await assertFails(dbOf(env, 'qs1').collection(`projects/${B}/contracts`).get());
    await assertFails(repoOf(env, 'qs1').repo.create('contracts', B, rec('C-x')));
    await assertFails(dbOf(env, 'outU').collection(`projects/${A}/contracts`).get());
    await assertFails(dbOf(env, 'outU').collection(`projects/${A}/audit`).get());
    // admin vào được mọi dự án
    await assertSucceeds(dbOf(env, 'admin1').collection(`projects/${B}/contracts`).get());
    await assertSucceeds(repoOf(env, 'admin1').repo.create('contracts', B, rec('C-a')));
});

test('T2.02 đổi vai trò có hiệu lực ngay ở lần ghi kế tiếp; chỉ admin sửa được members', { skip }, async () => {
    const A = await mkProject({ qs1: 'qs' });
    await assertSucceeds(repoOf(env, 'qs1').repo.create('contracts', A, rec('C1')));
    await assertFails(dbOf(env, 'qs1').doc(`projects/${A}`).set({ members: { qs1: 'pm' } }, { merge: true }));   // tự nâng quyền
    await assertFails(dbOf(env, 'pmU').doc(`projects/${A}`).set({ members: { pmU: 'pm' } }, { merge: true }));
    await assertSucceeds(dbOf(env, 'admin1').doc(`projects/${A}`).set({ members: { qs1: 'viewer' } }, { merge: true }));
    await assertFails(repoOf(env, 'qs1').repo.create('contracts', A, rec('C2')));
    await assertSucceeds(dbOf(env, 'qs1').collection(`projects/${A}/contracts`).get());
});

test('dự án chưa có members chạy như cũ: user ghi, manager chỉ xem; user thường không tự tạo members khi tạo dự án', { skip }, async () => {
    const L = await mkProject(null);
    await assertSucceeds(repoOf(env, 'qs2').repo.create('contracts', L, rec('L1')));
    await assertFails(repoOf(env, 'mgr1').repo.create('contracts', L, rec('L2')));
    await assertSucceeds(dbOf(env, 'mgr1').collection(`projects/${L}/contracts`).get());
    await assertFails(dbOf(env, 'pend1').collection(`projects/${L}/contracts`).get());
    await assertFails(dbOf(env, 'qs1').doc(`projects/${newPid()}`).set({ projectId: 'n', members: { qs1: 'qs' } }));
});
