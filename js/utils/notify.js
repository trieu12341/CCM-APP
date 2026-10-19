/**
 * notify.js — Thông báo lỗi lưu cloud hiển thị rõ trên màn hình.
 * Trước đây lỗi lưu Firestore chỉ ghi vào console nên người dùng không biết
 * dữ liệu chưa lên cloud (và có thể bị bản cloud cũ đè khi đồng bộ).
 */
let lastMsg = '';
let lastAt = 0;

export function notifyCloudError(message) {
    const now = Date.now();
    if (message === lastMsg && now - lastAt < 5000) return; // tránh lặp khi lưu nhiều trường liền nhau
    lastMsg = message; lastAt = now;
    if (typeof document === 'undefined') return;

    let box = document.getElementById('cloud-error-banner');
    if (!box) {
        box = document.createElement('div');
        box.id = 'cloud-error-banner';
        box.setAttribute('role', 'alert');
        box.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:10000;max-width:min(720px,92vw);'
            + 'display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border-radius:8px;font-size:13px;line-height:1.45;'
            + 'background:var(--accent-red-soft,#fcebeb);color:var(--accent-red,#b42318);border:1px solid var(--accent-red,#d14343);'
            + 'box-shadow:0 8px 24px rgba(0,0,0,.18);';
        const text = document.createElement('div');
        text.className = 'cloud-error-text';
        const close = document.createElement('button');
        close.type = 'button';
        close.textContent = '✕';
        close.setAttribute('aria-label', 'Đóng');
        close.style.cssText = 'border:0;background:transparent;color:inherit;cursor:pointer;font-size:14px;padding:0 2px;';
        close.addEventListener('click', () => box.remove());
        box.append(text, close);
        document.body.appendChild(box);
    }
    box.querySelector('.cloud-error-text').textContent = '⚠️ ' + message;
}
