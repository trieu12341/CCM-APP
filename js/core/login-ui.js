/**
 * login-ui.js — Trạng thái & hiệu ứng của màn đăng nhập, màn chờ và lúc vào/ra app.
 *  - Không xóa ô nhập khi đang xử lý; chỉ xóa mật khẩu SAU khi đã vào app.
 *  - Nút có 3 trạng thái: bình thường → đang xử lý (spinner) → thành công (dấu tích).
 *  - Sai mật khẩu: thẻ rung nhẹ, viền đỏ, con trỏ quay về ô mật khẩu.
 *  - Nhớ email lần đăng nhập trước.
 */
const $ = (id) => document.getElementById(id);
const EMAIL_KEY = 'ccm_last_email';
const reduceMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const wait = (ms) => new Promise(r => setTimeout(r, reduceMotion() ? 0 : ms));

let loginInFlight = false;
export const isLoginInFlight = () => loginInFlight;

function setLabel(text) {
    const el = document.querySelector('#btn-login-submit .login-label');
    if (el) el.textContent = text;
}

export function setBusy(busy) {
    loginInFlight = busy;
    const card = $('login-card');
    card?.classList.toggle('is-busy', busy);
    card?.classList.remove('is-done');
    const btn = $('btn-login-submit');
    if (btn) btn.disabled = busy;
    ['login-email', 'login-password'].forEach(id => { const el = $(id); if (el) el.readOnly = busy; });
    setLabel(busy ? 'Đang đăng nhập…' : 'Đăng nhập');
}

export function clearError() {
    const el = $('login-error');
    if (el) el.style.display = 'none';
    $('login-card')?.classList.remove('is-error', 'is-shake');
}

export function showError(msg, { shake = true, focusPassword = true } = {}) {
    const el = $('login-error');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
    const card = $('login-card');
    if (card) {
        card.classList.add('is-error');
        if (shake && !reduceMotion()) {
            card.classList.remove('is-shake'); void card.offsetWidth; card.classList.add('is-shake');
        }
    }
    if (focusPassword) { const pw = $('login-password'); if (pw) { pw.focus(); pw.select(); } }
}

/** Thành công: dấu tích + lời chào, giữ một nhịp ngắn để người dùng thấy. */
export async function playSuccess(name) {
    loginInFlight = false;
    const card = $('login-card');
    card?.classList.remove('is-busy', 'is-error');
    card?.classList.add('is-done');
    setLabel(name ? `Xin chào, ${name}` : 'Đăng nhập thành công');
    try { localStorage.setItem(EMAIL_KEY, $('login-email')?.value.trim() || ''); } catch (e) { /* bỏ qua */ }
    await wait(650);
}

/** Màn chờ (kiểm tra phiên đăng nhập khi mở trang). */
export function setSplash(visible, text) {
    const s = $('app-splash');
    if (!s) return;
    if (text) { const t = $('app-splash-text'); if (t) t.textContent = text; }
    s.classList.toggle('is-gone', !visible);
}

/** Hiện app: màn đăng nhập mờ dần phía trên, app hiện lên phía dưới. */
export async function enterApp() {
    const app = $('app-container');
    const login = $('login-modal');
    if (app) {
        app.style.display = '';
        app.classList.remove('is-entering'); void app.offsetWidth; app.classList.add('is-entering');
        // gỡ class sau hiệu ứng: transform trên khung app làm lệch các hộp thoại position:fixed
        app.addEventListener('animationend', () => app.classList.remove('is-entering'), { once: true });
        setTimeout(() => app.classList.remove('is-entering'), 700);
    }
    if (login && !login.classList.contains('hidden')) {
        login.classList.add('is-leaving');
        await wait(450);
        login.classList.add('hidden');
        login.classList.remove('is-leaving');
    } else if (login) {
        login.classList.add('hidden');
    }
    // Đã vào app: xóa mật khẩu, trả nút về trạng thái thường cho lần đăng nhập sau
    const pw = $('login-password'); if (pw) { pw.value = ''; pw.type = 'password'; }
    $('login-card')?.classList.remove('is-done', 'is-busy', 'is-error');
    setBusy(false);
}

/** Về màn đăng nhập (đăng xuất / chưa đăng nhập / chưa được cấp quyền). */
export function showLogin() {
    const app = $('app-container');
    if (app) { app.style.display = 'none'; app.classList.remove('is-entering'); }
    const login = $('login-modal');
    if (login) { login.classList.remove('is-leaving'); login.classList.remove('hidden'); }
    const email = $('login-email');
    if (email && !email.value) { try { email.value = localStorage.getItem(EMAIL_KEY) || ''; } catch (e) { /* bỏ qua */ } }
    setTimeout(() => (email && email.value ? $('login-password') : email)?.focus(), 60);
}

/** Gắn các tiện ích nhỏ: hiện/ẩn mật khẩu, cảnh báo Caps Lock, xóa lỗi khi gõ lại. */
export function bindLoginExtras() {
    const pw = $('login-password');
    const eye = $('btn-toggle-password');
    eye?.addEventListener('click', () => {
        if (!pw) return;
        const show = pw.type === 'password';
        pw.type = show ? 'text' : 'password';
        eye.innerHTML = `<i class="fa-regular ${show ? 'fa-eye-slash' : 'fa-eye'}"></i>`;
        const label = show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu';
        eye.setAttribute('aria-label', label); eye.title = label;
        pw.focus();
    });
    const caps = $('login-caps');
    const onKey = (e) => { if (caps && e.getModifierState) caps.hidden = !e.getModifierState('CapsLock'); };
    pw?.addEventListener('keydown', onKey);
    pw?.addEventListener('keyup', onKey);
    pw?.addEventListener('blur', () => { if (caps) caps.hidden = true; });
    ['login-email', 'login-password'].forEach(id => $(id)?.addEventListener('input', () => {
        if (!loginInFlight) $('login-card')?.classList.remove('is-error');
    }));
}
