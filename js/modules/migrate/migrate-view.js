/**
 * migrate-view.js — Dựng HTML cho trang "Chuyển dữ liệu" (chuỗi HTML thuần, không chạm DOM → test được bằng Node).
 * Màu chỉ qua lớp có sẵn (text-success / text-warning / text-danger).
 */
import { escapeHtml as esc } from '../../utils/formatters.js';
import { LABEL } from '../../data/migrate-plan.js';
import { ENTITIES } from '../../data/repo.js';

const num = (n) => Number(n || 0).toLocaleString('de-DE');   // 1.500.000.000

/** Bảng số bản ghi: cũ → mới (đã có sẵn). */
export function countsHtml(plan, already = {}) {
    const rows = ENTITIES.map(e => `<tr><td>${LABEL[e]}</td><td style="text-align:right">${num(plan.counts[e])}</td>
        <td style="text-align:right">${num(already[e] || 0)}</td></tr>`).join('');
    return `<table class="data-table"><thead><tr><th>Loại</th><th style="text-align:right">Bản ghi cần chuyển</th>
        <th style="text-align:right">Đã có ở cấu trúc mới</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/** Danh sách lỗi (đỏ, chặn) và cảnh báo (vàng). */
export function issuesHtml(issues = []) {
    if (!issues.length) return '<p class="text-success"><i class="fa-solid fa-circle-check"></i> Không có lỗi hay cảnh báo.</p>';
    const li = (i) => `<li class="${i.level === 'error' ? 'text-danger' : 'text-warning'}"><strong>${i.level === 'error' ? 'LỖI CHẶN' : 'Cảnh báo'}</strong>
        · ${esc(LABEL[i.entity] || i.entity)} · ${esc(i.message)}</li>`;
    return `<ul style="padding-left:1.2rem;display:grid;gap:.25rem">${issues.map(li).join('')}</ul>`;
}

/** Bảng tổng kiểm trước / sau, từng dòng KHỚP hoặc LỆCH. */
export function checksHtml(rows = []) {
    const tr = (r) => `<tr><td>${esc(r.label)}</td><td style="text-align:right">${num(r.before)}</td>
        <td style="text-align:right">${r.after === undefined ? '—' : num(r.after)}</td>
        <td class="${r.after === undefined ? '' : r.ok ? 'text-success' : 'text-danger'}"><strong>${r.after === undefined ? '—' : r.ok ? 'KHỚP' : 'LỆCH'}</strong></td></tr>`;
    return `<table class="data-table"><thead><tr><th>Tổng kiểm</th><th style="text-align:right">Bản cũ</th>
        <th style="text-align:right">Cấu trúc mới</th><th>Kết quả</th></tr></thead><tbody>${rows.map(tr).join('')}</tbody></table>`;
}

/** Dòng kết luận sau khi chạy thật. */
export function resultHtml({ written, skipped, verify, flipped }) {
    const head = flipped
        ? `<p class="text-success"><i class="fa-solid fa-circle-check"></i> <strong>Xong.</strong> Đã ghi ${num(written)} bản ghi mới, bỏ qua ${num(skipped)} bản ghi đã có. Mọi tổng kiểm KHỚP; dự án đã đặt schemaVersion = 2.</p>`
        : `<p class="text-danger"><i class="fa-solid fa-triangle-exclamation"></i> <strong>Chưa đổi schemaVersion</strong> vì kiểm lại còn lệch. Dữ liệu cũ vẫn nguyên vẹn.</p>`;
    const list = (title, arr) => (arr.length ? `<p class="text-danger">${title}: ${arr.slice(0, 20).map(esc).join(', ')}${arr.length > 20 ? ` … (+${arr.length - 20})` : ''}</p>` : '');
    return head + list('Thiếu', verify.missing) + list('Khác nội dung', verify.different)
        + (verify.extra.length ? `<p class="text-warning">Có ${verify.extra.length} bản ghi mới tạo thêm ngoài kế hoạch (không tính vào tổng kiểm).</p>` : '');
}
