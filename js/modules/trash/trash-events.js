/** trash-events.js — Màn Thùng rác: liệt kê hồ sơ đã xóa mềm của dự án đang mở và khôi phục từng cái. */
import { state } from '../../app.js';
import { getRepo, isV2 } from '../../core/v2-sync.js';
import { ENTITIES } from '../../data/repo.js';
import { escapeHtml as esc } from '../../utils/formatters.js';
import { trashRows } from './trash-model.js';
import { showToast } from '../payment/payment-nav.js';

const $ = (id) => document.getElementById(id);
const fmt = (d) => (d ? d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
let bound = false;

async function render() {
    const pid = state.currentProjectId;
    const body = $('trash-body'), msg = $('trash-msg');
    if (!isV2(pid)) {
        body.innerHTML = ''; msg.textContent = 'Dự án này chưa chuyển sang cấu trúc dữ liệu mới nên chưa có Thùng rác (admin chuyển ở mục "Chuyển dữ liệu").'; return;
    }
    const repo = getRepo();
    const byEntity = {};
    for (const e of ENTITIES) byEntity[e] = await repo.list(e, pid, { includeDeleted: true });
    const rows = trashRows(byEntity);
    msg.textContent = rows.length ? '' : 'Thùng rác trống.';
    body.innerHTML = rows.map((r, i) => `<tr><td>${esc(r.type)}</td><td>${esc(r.code)}</td><td>${esc(r.summary)}</td><td>${esc(r.by)}</td>
        <td>${esc(fmt(r.at))}</td><td>${r.daysLeft} ngày</td>
        <td><button type="button" class="btn btn-outline" data-restore="${i}"><i class="fa-solid fa-rotate-left"></i> Khôi phục</button></td></tr>`).join('');
    body.__rows = rows;
}

async function onClick(e) {
    const btn = e.target.closest('[data-restore]');
    if (!btn) return;
    const row = $('trash-body').__rows[Number(btn.dataset.restore)];
    btn.disabled = true;
    try {
        await getRepo().restore(row.entity, state.currentProjectId, row.id, row._v, { reason: 'Khôi phục từ Thùng rác' });
        showToast(`Đã khôi phục ${row.type} ${row.code}`, 'success');
    } catch (err) {
        showToast(`Không khôi phục được: ${String(err.message || err).slice(0, 120)}`, 'error');
    }
    await render();
}

/** Gọi mỗi lần mở màn Thùng rác. */
export function initTrashPage() {
    if (!$('module-trash')) return;
    if (!bound) { bound = true; $('trash-body').addEventListener('click', onClick); }
    render().catch(err => { $('trash-msg').textContent = `Không tải được Thùng rác: ${String(err.message || err).slice(0, 120)}`; });
}
