/**
 * firebase-config.js
 * Cấu hình Firebase Web SDK. Cấu hình từng môi trường nằm ở firebase-env.js (mặc định = bản thật;
 * staging chỉ khi chạy trên tên miền staging hoặc mở với ?env=staging).
 */
import { pickFirebaseEnv } from './firebase-env.js';

const { env, config: firebaseConfig } = pickFirebaseEnv(location.hostname, location.search);
export const FIREBASE_ENV = env;
if (env === 'staging') {
    document.documentElement.classList.add('env-staging');
    document.title = `[STAGING] ${document.title}`;
}

// Khởi tạo Firebase App nếu chưa có
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Export các Firebase services
export const db = firebase.firestore();
// Lớp an toàn thứ hai: bỏ qua trường undefined thay vì từ chối cả bản ghi
try { db.settings({ ignoreUndefinedProperties: true, merge: true }); } catch (e) { console.warn('Firestore settings:', e); }
export const auth = firebase.auth();
