// Giao diện khóa số IPC: dải trạng thái "Đã chốt" / "Cần xem lại", nút Mở khóa (bắt buộc lý do).
import { state } from '../../../app.js';
import { isLockedIPC } from '../ipc-chain.js';
import { staleLockedIPCs } from '../ipc-lock.js';
import { approvedVOTotal } from './ipc-construction-form.js';
import { escapeHtml, formatCurrency } from '../../../utils/formatters.js';

const fmtTime = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }); };

/** IPC đã chốt bị lệch số kỳ trước của cùng hợp đồng (rỗng nếu không có). */
export function staleFor(ipc) {
    const contract = (state.appData?.Contracts || []).find(c => c.contract_id === ipc.contract_id);
    if (!contract) return null;
    return staleLockedIPCs(state.appData?.Payments || [], contract, approvedVOTotal(state.appData?.Variations || [], contract.contract_id)).find(s => s.ipc_id === ipc.ipc_id) || null;
}

export function renderLockState(ipc) {
    const btn = document.getElementById('btn-unlock-ipc');
    const banner = document.getElementById('ipc-lock-banner');
    const locked = isLockedIPC(ipc);
    if (btn) btn.classList.toggle('hidden', !locked);
    if (!banner) return;
    const parts = [];
    const stale = locked ? staleFor(ipc) : null;
    if (stale) {
        parts.push(`<strong>⚠ Cần xem lại:</strong> số "đã xác nhận các kỳ trước" (11) lưu trên IPC này là ${formatCurrency(stale.stored)}, ` +
            `nhưng các kỳ trước hiện cộng lại ${formatCurrency(stale.expected)} (lệch ${formatCurrency(stale.diff)}). ` +
            'Số của IPC đã chốt không tự đổi — mở khóa, kiểm và duyệt lại nếu cần.');
    } else if (locked) {
        parts.push('🔒 IPC đã chốt — số liệu không sửa được. Muốn sửa, bấm "Mở khóa" và ghi lý do.');
    }
    const u = ipc.last_unlock;
    if (u && u.reason) parts.push(`Lần mở khóa gần nhất: ${escapeHtml(fmtTime(u.at))} — ${escapeHtml(u.by || '')} — lý do: “${escapeHtml(u.reason)}”.`);
    banner.innerHTML = parts.join('<br>');
    banner.hidden = !parts.length;
    banner.classList.toggle('is-locked', locked && !stale);
}
