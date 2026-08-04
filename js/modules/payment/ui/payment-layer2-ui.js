/**
 * payment-layer2-ui.js
 * Layer 2: Master IPC List
 * - Renders master IPC table with filter bar
 * - Filters: search, status, contract type (Consultancy / Construction)
 */

import { state, formatCurrencyShort } from '../../../app.js';
import { getPaymentsByProject } from '../payment-state.js';
import { getStatusBadge } from './payment-layer1-ui.js';

// ─────────────────────────────────────────────────────────────
// RENDER MASTER IPC TABLE
// ─────────────────────────────────────────────────────────────

/**
 * Renders the full master IPC table, applying current filter state.
 * @param {{ search: string, status: string, contractType: string }} filterState
 */
export function renderIPCList(filterState = { search: '', status: 'All', contractType: 'All' }) {
    const projectId = state.currentProjectId;
    if (!projectId) return;

    let payments = getPaymentsByProject(projectId);

    // Apply filters
    const { search, status, contractType } = filterState;

    if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        payments = payments.filter(p =>
            (p.ipc_id || '').toLowerCase().includes(q) ||
            (p.contract_name || '').toLowerCase().includes(q) ||
            (p.contractor_name || '').toLowerCase().includes(q)
        );
    }

    if (status && status !== 'All') {
        payments = payments.filter(p => p.status === status);
    }

    if (contractType && contractType !== 'All') {
        payments = payments.filter(p => (p.contract_type || 'Construction') === contractType);
    }

    // Sort: newest first by created_at
    payments = payments.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    const tbody = document.getElementById('ipc-list-tbody');
    if (!tbody) return;

    if (payments.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align:center;padding:40px 0;color:#94a3b8;">
                    <i class="fa-regular fa-folder-open" style="font-size:2rem;display:block;margin-bottom:10px;"></i>
                    Không có Hồ sơ Thanh toán nào phù hợp
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = payments.map((p, idx) => {
        const ipcCode = p.ipc_id.replace('ipc-', 'IPC-');
        const gross    = Number(p.gross_work_done) || 0;
        const qsDed    = Number(p.qs_deduction) || 0;
        const certifiedGross = Number(p.certified_value) || Number(p.net_payable) || 0;
        const vat = Number(p.vat_amount) || 0;
        const certified = p.sub_total !== undefined ? Number(p.sub_total) : (certifiedGross - vat);
        const netPay   = certified;
        const ctType   = p.contract_type || 'Construction';
        const ctBadge  = ctType === 'Consultancy'
            ? `<span style="font-size:10px;padding:2px 7px;border-radius:10px;background:#fef3c7;color:#d97706;font-weight:700;">Tư vấn</span>`
            : `<span style="font-size:10px;padding:2px 7px;border-radius:10px;background:#e0f2fe;color:#0369a1;font-weight:700;">Xây dựng</span>`;

        return `
            <tr class="ipc-row" data-ipc-id="${p.ipc_id}" style="cursor:pointer;" title="Nhấn để xem chi tiết IPC">
                <td style="text-align:center;color:#94a3b8;font-size:12px;">${idx + 1}</td>
                <td>
                    <span class="ipc-code" style="font-family:monospace;font-weight:700;color:var(--primary-blue);font-size:12px;">${ipcCode}</span>
                </td>
                <td>
                    <div style="font-weight:600;font-size:13px;line-height:1.4;">${escHtml(p.contract_name) || '<span style="color:#94a3b8;">—</span>'}</div>
                    <div style="font-size:11px;color:#64748b;margin-top:2px;">${escHtml(p.contractor_name) || ''} ${ctBadge}</div>
                </td>
                <td style="text-align:center;font-weight:600;">Đợt ${p.payment_number || '—'}</td>
                <td style="text-align:center;color:#64748b;font-size:12px;">${formatDateShort(p.submission_date)}</td>
                <td style="text-align:right;font-size:13px;">${formatCurrencyShort(gross)}</td>
                <td style="text-align:right;font-size:13px;color:#ef4444;">${qsDed > 0 ? '- ' + formatCurrencyShort(qsDed) : '—'}</td>
                <td style="text-align:right;font-size:13px;font-weight:600;color:#10b981;">${formatCurrencyShort(certified)}</td>
                <td style="text-align:right;font-size:13px;font-weight:700;color:var(--primary-blue);">${formatCurrencyShort(netPay)}</td>
                <td style="text-align:center;">${getStatusBadge(p.status)}</td>
                <td style="text-align:center;">
                    <button class="btn-ipc-detail" data-ipc-id="${p.ipc_id}"
                        style="background:none;border:1px solid #e2e8f0;border-radius:6px;padding:4px 10px;
                               cursor:pointer;font-size:12px;color:var(--primary-blue);
                               transition:all 0.18s;white-space:nowrap;"
                        title="Xem chi tiết">
                        👁️ Chi tiết
                    </button>
                </td>
            </tr>`;
    }).join('');
}

// ─────────────────────────────────────────────────────────────
// FILTER APPLICATION
// ─────────────────────────────────────────────────────────────

/** Reads all filter inputs from DOM */
export function readFilterState() {
    return {
        search:       document.getElementById('ipc-search-input')?.value || '',
        status:       document.getElementById('ipc-status-filter')?.value || 'All',
        contractType: document.getElementById('ipc-contract-type-filter')?.value || 'All',
    };
}

/** Applies current filters and re-renders the table */
export function applyIPCFilters() {
    renderIPCList(readFilterState());
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function formatDateShort(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
