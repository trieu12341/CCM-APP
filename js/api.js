/**
 * api.js
 * Lớp Authentication duy nhất cho ứng dụng.
 * Sử dụng Firebase Authentication (Email/Password).
 * Đã loại bỏ hoàn toàn JWT và Express API calls.
 */
import { auth } from './firebase-config.js';

/**
 * Đăng nhập bằng Firebase Email/Password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<firebase.auth.UserCredential>}
 */
export async function apiLogin(email, password) {
    return auth.signInWithEmailAndPassword(email, password);
}

/**
 * Đăng xuất khỏi Firebase Auth.
 * @returns {Promise<void>}
 */
export async function apiLogout() {
    return auth.signOut();
}

/**
 * Lấy người dùng hiện tại từ Firebase Auth.
 * @returns {firebase.User | null}
 */
export function getCurrentUser() {
    return auth.currentUser;
}

/**
 * Lắng nghe thay đổi trạng thái auth (login/logout).
 * @param {function} callback - (user) => void, user=null khi logout
 * @returns {function} unsubscribe function
 */
export function onAuthStateChanged(callback) {
    return auth.onAuthStateChanged(callback);
}
