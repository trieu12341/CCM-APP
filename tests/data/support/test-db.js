/**
 * Chọn Firestore cho test lớp dữ liệu:
 *  - mặc định: Firestore giả trong bộ nhớ (chạy mọi nơi, không cần Java/mạng);
 *  - CCM_TEST_EMULATOR=host:port → Firestore Emulator thật qua SDK compat (CI chạy cả hai).
 * Mỗi test dùng mã dự án riêng để không đụng nhau.
 */
import { createFakeFirestore } from './fake-firestore.js';

export const usingEmulator = !!process.env.CCM_TEST_EMULATOR;
let appSeq = 0;

export async function openTestDb() {
    if (!usingEmulator) return { ...createFakeFirestore(), close: async () => {} };
    const { default: firebase } = await import('firebase/compat/app');
    await import('firebase/compat/firestore');
    const app = firebase.initializeApp({ projectId: 'demo-ccm', apiKey: 'demo' }, `t${++appSeq}-${Date.now()}`);
    const db = app.firestore();
    const [host, port] = process.env.CCM_TEST_EMULATOR.split(':');
    db.useEmulator(host, Number(port));
    return { db, fieldValue: firebase.firestore.FieldValue, close: () => app.delete() };
}

export const newPid = () => `T${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
