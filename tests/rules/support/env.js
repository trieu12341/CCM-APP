/**
 * Môi trường test Firestore rules: nạp firestore.rules THẬT vào Emulator, tạo sẵn 5 người dùng.
 * Chỉ chạy khi có Emulator (npm run test:rules:emulator đặt FIRESTORE_EMULATOR_HOST); không có → các test tự bỏ qua.
 */
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { createRepo } from '../../../js/data/repo.js';
import { createAuditWriter } from '../../../js/data/audit.js';

export const skip = process.env.FIRESTORE_EMULATOR_HOST ? false : 'cần Firestore Emulator (npm run test:rules:emulator)';
export const FieldValue = firebase.firestore.FieldValue;

/** uid → vai trò. 'ghost' có đăng nhập nhưng chưa có hồ sơ users/. */
export const PEOPLE = { admin1: 'admin', qs1: 'user', qs2: 'user', mgr1: 'manager', pend1: 'pending' };

let env = null;
let seq = 0;

export async function openRules() {
    if (skip) return null;
    if (env) return env;
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
    env = await initializeTestEnvironment({
        projectId: 'demo-ccm-rules',
        firestore: { rules: readFileSync(new URL('../../../firestore.rules', import.meta.url), 'utf8'), host, port: Number(port) },
    });
    await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        for (const [uid, role] of Object.entries(PEOPLE)) await db.doc(`users/${uid}`).set({ role, email: `${uid}@ccm.test` });
    });
    return env;
}

export const closeRules = () => (env ? env.cleanup() : undefined);
export const newPid = () => `R${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Firestore của một người đã đăng nhập (uid), hoặc của khách chưa đăng nhập (uid = null). */
export const dbOf = (e, uid) => (uid ? e.authenticatedContext(uid).firestore() : e.unauthenticatedContext().firestore());

/** Repo thật của app (kèm ghi nhật ký) chạy dưới danh nghĩa uid — để thử rules với đúng cách app ghi. */
export function repoOf(e, uid) {
    const db = dbOf(e, uid);
    const user = { uid, name: uid };
    return { db, repo: createRepo({ db, fieldValue: FieldValue, user, onWrite: createAuditWriter({ db, fieldValue: FieldValue, user }) }) };
}

/** Tạo sẵn một hồ sơ hợp lệ do qs1 ghi; trả về mã dự án. */
export async function seedContract(e, pid = newPid(), id = 'C1') {
    await repoOf(e, 'qs1').repo.create('contracts', pid, { id, package_name: 'Cọc', original_value: 1_500_000_000 });
    return pid;
}
