import { state } from '../app.js';
import { apiLogin, apiLogout, onAuthStateChanged } from '../api.js';
import { getUserProfile } from '../db-service.js';

import { loadAppData } from './app-data.js';

// ─────────────────────────────────────────────────────────────
// MAIN ENTRY POINT — called after all HTML components are loaded
// ─────────────────────────────────────────────────────────────

function showApp() {
    const container = document.getElementById('app-container');
    if (container) container.style.display = '';
    const loginModal = document.getElementById('login-modal');
    if (loginModal) loginModal.classList.add('hidden');
}

function hideApp() {
    const container = document.getElementById('app-container');
    if (container) container.style.display = 'none';
    const loginModal = document.getElementById('login-modal');
    if (loginModal) loginModal.classList.remove('hidden');
}

export async function initApp() {
    const loginModal = document.getElementById('login-modal');

    // ── Clear session link in login form ──
    document.getElementById('btn-clear-session')?.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.clear();
        apiLogout().then(() => {
            const errorEl = document.getElementById('login-error');
            if (errorEl) { errorEl.style.display = 'block'; errorEl.textContent = 'Đã xóa session cũ. Vui lòng đăng nhập lại.'; }
        });
    });

    // ─────────────────────────────────────────────────────
    // Login Form submit handler (Firebase Email/Password)
    // ─────────────────────────────────────────────────────
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email')?.value.trim();
            const password = document.getElementById('login-password')?.value;
            const errorMsg = document.getElementById('login-error');
            const submitBtn = document.getElementById('btn-login-submit');

            if (!email || !password) return;

            try {
                if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Đang đăng nhập...'; }
                if (errorMsg) errorMsg.style.display = 'none';

                await apiLogin(email, password);
                // onAuthStateChanged will fire and handle the rest
                loginForm.reset();
            } catch (err) {
                console.error('[Login Error]', err);
                let msg = 'Đăng nhập thất bại. Vui lòng thử lại.';
                if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                    msg = 'Email hoặc mật khẩu không đúng.';
                } else if (err.code === 'auth/invalid-email') {
                    msg = 'Định dạng email không hợp lệ.';
                } else if (err.code === 'auth/too-many-requests') {
                    msg = 'Đăng nhập thất bại quá nhiều lần. Vui lòng thử lại sau.';
                }
                if (errorMsg) { errorMsg.style.display = 'block'; errorMsg.textContent = msg; }
            } finally {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Đăng nhập'; }
            }
        });
    }

    // ─────────────────────────────────────────────────────
    // Logout handler
    // ─────────────────────────────────────────────────────
    const doLogout = () => apiLogout().then(() => {
        state.user = null;
        hideApp();
        document.body.classList.remove('is-manager', 'is-admin');
    });
    bindEvent('btn-logout', 'click', doLogout);
    bindEvent('btn-logout-side', 'click', doLogout);

    // ─────────────────────────────────────────────────────
    // Firebase onAuthStateChanged - Single source of auth truth
    // ─────────────────────────────────────────────────────
    onAuthStateChanged(async (firebaseUser) => {
        if (firebaseUser) {
            // Load role from Firestore /users/{uid}
            const profile = await getUserProfile(
                firebaseUser.uid,
                firebaseUser.email,
                firebaseUser.displayName
            );

            // Tài khoản mới / chưa được cấp quyền: không vào app
            if (!['admin', 'user', 'manager'].includes(profile.role)) {
                state.user = null;
                hideApp();
                const errorEl = document.getElementById('login-error');
                if (errorEl) {
                    errorEl.style.display = 'block';
                    errorEl.textContent = `Tài khoản ${firebaseUser.email} đang chờ admin cấp quyền. Vui lòng liên hệ quản trị viên.`;
                }
                await apiLogout().catch(() => {});
                return;
            }

            state.user = {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                name: profile.name || firebaseUser.displayName || firebaseUser.email,
                role: profile.role
            };

            // Update sidebar user info
            const nameEl = document.getElementById('user-name');
            const roleEl = document.getElementById('user-role');
            if (nameEl) nameEl.textContent = state.user.name;
            if (roleEl) roleEl.textContent = state.user.role;

            // Role-based CSS
            document.body.classList.toggle('is-admin', state.user.role === 'admin');
            document.body.classList.toggle('is-manager', state.user.role === 'manager');

            showApp();
            await loadAppData();
        } else {
            // User is signed out
            state.user = null;
            hideApp();
            document.body.classList.remove('is-admin', 'is-manager');
        }
    });

    // ─────────────────────────────────────────────────────
    // Global ESC Event Listener (FIFO Layer Stack)
    // ─────────────────────────────────────────────────────
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const escapeStack = [
                // Priority 1: Popups
                { container: '#budgetFormModal', btn: '#close-budget-form-modal' },
                { container: '#cashflow-import-modal', btn: '#close-cf-import-modal' },

                // Priority 2: Layer 3
                { container: '#contract-detail-modal', btn: '#close-contract-modal' },
                { container: '#payment-detail-workspace', btn: '#btn-close-ipc-form' },
                { container: '#payment-detail-workspace', btn: '#btn-close-ipc-detail' },
                { container: '#tender-detail-modal', btn: '#close-tender-detail-modal' },
                { container: '#voModal', btn: '#closeVoModalBtn' },
                { container: '#vo-form-workspace', btn: '#btn-cancel-vo' },
                { container: '#final-breakdown-workspace', btn: '#btn-close-final-breakdown' },

                // Priority 3: Layer 2
                { container: '#payment-list-modal', btn: '#btn-payment-back-l1' },
                { container: '#tender-list-modal', btn: '#close-tender-list-modal' },
                { container: '#contract-list-modal', btn: '#close-contract-list-modal' },
                { container: '#budget-list-modal', btn: '#close-budget-list-modal' },
                { container: '#cashflow-detail-modal', btn: '#close-cashflow-modal' },
                { container: '#vo-layer-2', btn: '#btn-show-vo-layer1' },
                { container: '#final-layer-2', btn: '#btn-show-final-layer1' },
            ];

            for (const layer of escapeStack) {
                const el = document.querySelector(layer.container);
                if (el && !el.classList.contains('hidden') && el.style.display !== 'none') {
                    const btn = document.querySelector(layer.btn);
                    if (btn && btn.closest('.hidden') === null && btn.style.display !== 'none') {
                        btn.click();
                        return; // Stop after handling the highest priority layer
                    }
                }
            }
        }
    });
}
