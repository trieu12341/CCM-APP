// Hộp thoại hỏi lý do (thay cho prompt()): trả về Promise<string|null> — null khi bấm Hủy.
import { escapeHtml } from '../utils/formatters.js';

export function askReason({ title, message = '', placeholder = 'Lý do…', okText = 'Xác nhận', minLength = 5 }) {
    return new Promise((resolve) => {
        document.getElementById('reason-dialog')?.remove();
        const el = document.createElement('div');
        el.id = 'reason-dialog'; el.className = 'conflict-overlay'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
        el.innerHTML = `<div class="conflict-box">
            <h3>${escapeHtml(title)}</h3>${message ? `<p class="conflict-note">${escapeHtml(message)}</p>` : ''}
            <textarea id="reason-input" class="form-control" rows="3" placeholder="${escapeHtml(placeholder)}" style="width:100%"></textarea>
            <p class="reason-error" role="alert" hidden></p>
            <div class="conflict-actions">
              <button type="button" class="btn btn-secondary" data-act="cancel">Hủy</button>
              <button type="button" class="btn btn-primary" data-act="ok">${escapeHtml(okText)}</button>
            </div></div>`;
        const done = (v) => { el.remove(); resolve(v); };
        el.addEventListener('click', (e) => {
            const act = e.target.closest('[data-act]')?.dataset.act;
            if (act === 'cancel') done(null);
            if (act === 'ok') {
                const v = el.querySelector('#reason-input').value.trim();
                if (v.length < minLength) { const er = el.querySelector('.reason-error'); er.textContent = `Bắt buộc ghi lý do (ít nhất ${minLength} ký tự).`; er.hidden = false; return; }
                done(v);
            }
        });
        el.addEventListener('keydown', (e) => { if (e.key === 'Escape') done(null); });
        document.body.appendChild(el);
        el.querySelector('#reason-input').focus();
    });
}
