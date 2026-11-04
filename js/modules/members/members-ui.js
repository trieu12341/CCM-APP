// Màn "Thành viên dự án" trong trang Admin.
import { escapeHtml } from '../../utils/formatters.js';
import { PROJECT_ROLES, ROLE_LABEL } from '../../data/members.js';
import { fetchAllUsers } from '../../admin/admin.js';
import { loadMembers, changeMember, enableMembers } from './members-service.js';
import { state } from '../../app.js';
import { notifyCloudError } from '../../utils/notify.js';

let users = [];
const $ = (id) => document.getElementById(id);
const say = (t, bad) => { const m = $('members-msg'); if (m) { m.textContent = t; m.style.color = bad ? 'var(--danger-color)' : 'var(--text-muted)'; } };

async function renderTable() {
    const pid = $('members-project').value;
    const tbody = $('members-tbody'), note = $('members-note');
    if (!pid) { tbody.innerHTML = ''; return; }
    const members = await loadMembers(pid);
    if (!members) {
        note.innerHTML = 'Dự án này chưa bật phân quyền theo dự án: mọi tài khoản đang dùng vai trò chung (User = QS, Manager = chỉ xem). ';
        const b = document.createElement('button'); b.className = 'btn btn-primary'; b.textContent = 'Bật phân quyền theo dự án';
        b.onclick = async () => { b.disabled = true; try { await enableMembers(pid, users, state.user); say('Đã bật. User → QS, Manager → Người xem.'); await renderTable(); } catch (e) { notifyCloudError(e); b.disabled = false; } };
        note.appendChild(b); tbody.innerHTML = ''; return;
    }
    note.textContent = 'Chỉ người có tên dưới đây (và Admin) thấy dữ liệu dự án này. Chọn "— Không —" để bớt người.';
    tbody.innerHTML = users.filter(u => ['user', 'manager'].includes(u.role)).map(u => `
        <tr><td>${escapeHtml(u.name || 'No Name')}</td><td>${escapeHtml(u.email || '')}</td>
        <td><select data-uid="${escapeHtml(u.uid)}" aria-label="Vai trò của ${escapeHtml(u.name || u.email || '')}">
            <option value="">— Không —</option>
            ${PROJECT_ROLES.map(r => `<option value="${r}" ${members[u.uid] === r ? 'selected' : ''}>${ROLE_LABEL[r]}</option>`).join('')}
        </select></td></tr>`).join('') || '<tr><td colspan="3" style="text-align:center">Chưa có tài khoản User/Manager nào.</td></tr>';
    tbody.querySelectorAll('select').forEach(sel => sel.addEventListener('change', async () => {
        sel.disabled = true;
        try { await changeMember(pid, sel.dataset.uid, sel.value || null, state.user); say('Đã lưu. Có hiệu lực ngay ở lần ghi/đọc kế tiếp của người đó.'); }
        catch (e) { say('Không lưu được: ' + e.message, true); await renderTable(); }
        sel.disabled = false;
    }));
}

export async function renderMembersPanel() {
    const sel = $('members-project');
    if (!sel) return;
    users = await fetchAllUsers();
    sel.innerHTML = (state.appData?.Projects || []).map(p => `<option value="${escapeHtml(p.project_id)}">${escapeHtml(p.project_name || p.name || p.project_id)}</option>`).join('');
    sel.onchange = () => renderTable().catch(e => say(e.message, true));
    await renderTable().catch(e => say(e.message, true));
}
