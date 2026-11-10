/**
 * conflict-dialog.js — Hộp thoại khi lưu bị chặn vì người khác đã sửa hồ sơ trước:
 *  "<Hồ sơ> vừa được <tên> sửa lúc <giờ>", liệt kê trường khác nhau (bản trên server ↔ bản của tôi),
 *  và hai lựa chọn: tải bản mới (bỏ thay đổi của tôi — app đã tải sẵn) / chép thay đổi của tôi ra để nhập lại.
 */
import { escapeHtml } from '../utils/formatters.js';

const fmtVal = (v) => {
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'number') return v.toLocaleString('de-DE');
    return String(typeof v === 'object' ? JSON.stringify(v) : v).slice(0, 160);
};
const fmtTime = (d) => (d instanceof Date && !isNaN(d) ? d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '');

/** Nội dung văn bản để chép ra (dán vào ghi chú / chat để nhập lại). */
export function conflictText(conflicts) {
    return conflicts.map(c => `${c.label}${c.gone ? ' (đã bị xóa)' : ''}\n` + (c.changes.length
        ? c.changes.map(x => `  - ${x.field}: bản trên server = ${fmtVal(x.from)} · của tôi = ${fmtVal(x.to)}`).join('\n')
        : '  (không có trường nào khác nhau)')).join('\n\n');
}

function section(c) {
    const who = c.by ? `<strong>${escapeHtml(c.by)}</strong>` : 'người khác';
    const when = fmtTime(c.at) ? ` lúc ${escapeHtml(fmtTime(c.at))}` : '';
    const head = c.gone ? `${escapeHtml(c.label)} đã bị ${who} xóa${when}.` : `${escapeHtml(c.label)} vừa được ${who} sửa${when}.`;
    const rows = c.changes.slice(0, 12).map(x => `<tr><td>${escapeHtml(x.field)}</td><td>${escapeHtml(fmtVal(x.from))}</td><td>${escapeHtml(fmtVal(x.to))}</td></tr>`).join('');
    const table = rows ? `<table class="conflict-table"><thead><tr><th>Trường</th><th>Bản trên server</th><th>Của tôi</th></tr></thead><tbody>${rows}</tbody></table>` : '';
    return `<div class="conflict-item"><p>${head}</p>${table}</div>`;
}

export function showConflictDialog(conflicts, { copy = defaultCopy, onClose = () => {} } = {}) {
    document.getElementById('conflict-dialog')?.remove();
    const el = document.createElement('div');
    el.id = 'conflict-dialog'; el.className = 'conflict-overlay'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.innerHTML = `<div class="conflict-box">
        <h3>Chưa lưu được — hồ sơ đã bị đổi</h3>
        <p class="conflict-note">Thay đổi của bạn <strong>chưa được ghi</strong>; số liệu của người kia còn nguyên. App đã tải bản mới nhất.</p>
        ${conflicts.map(section).join('')}
        <div class="conflict-actions">
          <button type="button" class="btn btn-secondary" data-act="copy">Chép thay đổi của tôi</button>
          <button type="button" class="btn btn-primary" data-act="reload">Tải bản mới (bỏ thay đổi của tôi)</button>
        </div><p class="conflict-copied" hidden>Đã chép — dán vào nơi bạn muốn rồi nhập lại sau khi xem bản mới.</p></div>`;
    el.addEventListener('click', async (e) => {
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (act === 'reload') { el.remove(); onClose(); }
        if (act === 'copy') { await copy(conflictText(conflicts)); el.querySelector('.conflict-copied').hidden = false; }
    });
    document.body.appendChild(el);
    return el;
}

async function defaultCopy(text) {
    try { await navigator.clipboard.writeText(text); return; } catch (_) { /* thử cách cũ */ }
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } finally { ta.remove(); }
}
