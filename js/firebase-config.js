/**
 * firebase-config.js
 * Cấu hình Firebase Web SDK - Cập nhật với đầy đủ config object.
 *
 * ⚠️  HƯỚNG DẪN: Vào Firebase Console → Project Settings → Your apps
 * Sao chép toàn bộ firebaseConfig object và thay thế vào đây.
 * Hiện tại đang dùng cấu hình mẫu cho project "cost-contract-management".
 */
const firebaseConfig = {
    apiKey: "AIzaSyD_1Pjcg3wyhJWG8Wy3AtQxwHV7taPPKpc",
    authDomain: "cost-contract-management.firebaseapp.com",
    projectId: "cost-contract-management",
    storageBucket: "cost-contract-management.firebasestorage.app",
    messagingSenderId: "182752560401",
    appId: "1:182752560401:web:ceaf1ec620d3798b2438b0",
    measurementId: "G-8EDSHT5WF4"
};

// Khởi tạo Firebase App nếu chưa có
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Export các Firebase services
export const db = firebase.firestore();
export const auth = firebase.auth();
