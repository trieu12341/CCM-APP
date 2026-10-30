// Khởi tạo firebase-admin từ biến môi trường (dùng cho backup.mjs / restore.mjs). Cài: npm i --no-save firebase-admin@12
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);

export function adminDb() {
    const admin = require('firebase-admin');
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT || (process.env.GOOGLE_APPLICATION_CREDENTIALS ? readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8') : '');
    if (!raw) throw new Error('Thiếu FIREBASE_SERVICE_ACCOUNT (nội dung JSON) hoặc GOOGLE_APPLICATION_CREDENTIALS (đường dẫn file)');
    const sa = JSON.parse(raw);
    admin.initializeApp({ credential: admin.credential.cert(sa), projectId: process.env.FIREBASE_PROJECT || sa.project_id });
    return admin.firestore();
}
