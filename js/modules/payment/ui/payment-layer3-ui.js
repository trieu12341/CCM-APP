import { getContractName, getContractorName } from '../../../core/contract-fields.js';
import { escapeHtml } from '../../../utils/formatters.js';
/**
 * payment-layer3-ui.js
 * Layer 3: IPC Detail Workspace
 * - QS Financial Breakdown (standard / consultancy mode)
 * - Approval actions (Approve IPC / Confirm Paid)
 * - Create New IPC form with DYNAMIC fields based on contract type
 */

import { state, formatCurrencyVND, formatCurrencyShort } from '../../../app.js';
import { getIPCById } from '../payment-state.js';
import { computeConsultancyIPC } from '../ipc-engine.js';
import { contractIPCs, ipcCode, periodLabel } from '../ipc-chain.js';
import { renderApprovalActions } from './payment-approval-ui.js';
import { renderCertTable, renderLinesTable, renderSummaryOfPayment, renderAPRecoup } from './ipc-cert-ui.js';

// Form Tạo/Sửa IPC tách sang payment-ipc-form-ui.js — xuất lại để giữ tương thích import cũ
export { renderIPCForm, updateFormCalc, readIPCFormData, applyContractTypeUI, onContractChanged } from './payment-ipc-form-ui.js';
import { getStatusBadge } from './payment-layer1-ui.js';

// ─────────────────────────────────────────────────────────────
// RENDER IPC DETAIL
// ─────────────────────────────────────────────────────────────

export function renderIPCDetail(ipcId) {
    const ipc = getIPCById(ipcId);
    if (!ipc) {
        console.warn(`[payment-layer3] renderIPCDetail: IPC ${ipcId} not found`);
        return;
    }

    const workspace = document.getElementById('payment-detail-workspace');
    if (!workspace) return;

    // ── Header ──────────────────────────────────────────────
    const codeEl = document.getElementById('pay-detail-ipc-code');
    const statusEl = document.getElementById('pay-detail-status-badge');
    if (codeEl) codeEl.textContent = ipcCode(ipc);
    if (statusEl) statusEl.innerHTML = getStatusBadge(ipc.status);

    workspace.dataset.currentIpcId = ipcId;

    // ── Main Info ────────────────────────────────────────────
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '—'; };
    setEl('pay-detail-contract-name', ipc.contract_name);
    setEl('pay-detail-contractor', ipc.contractor_name);
    setEl('pay-detail-payment-no', periodLabel(ipc));
    setEl('pay-detail-submission-date', formatDateShort(ipc.submission_date));
    setEl('pay-detail-due-date', ipc.due_date ? formatDateShort(ipc.due_date) : '—');
    setEl('pay-detail-notes', ipc.notes || '');

    // Contract type badge in detail header
    const typeEl = document.getElementById('pay-detail-contract-type');
    if (typeEl) {
        const isConsultancy = ipc.contract_type === 'Consultancy';
        typeEl.innerHTML = isConsultancy
            ? `<span style="font-size:11px;padding:2px 10px;border-radius:10px;background:var(--accent-violet-soft);color:var(--accent-violet);font-weight:700;margin-left:8px;">Tư vấn</span>`
            : `<span style="font-size:11px;padding:2px 10px;border-radius:10px;background:var(--accent-blue-soft);color:var(--accent-blue);font-weight:700;margin-left:8px;">Xây dựng</span>`;
    }

    // ── Financial Breakdown ──────────────────────────────────
    renderFinancialBreakdown(ipc);

    // ── Approval Buttons ─────────────────────────────────────
    renderApprovalActions(ipc);
}

// ─────────────────────────────────────────────────────────────
// FINANCIAL BREAKDOWN TABLE
// ─────────────────────────────────────────────────────────────

function renderFinancialBreakdown(ipc) {
    const v2Box = document.getElementById('pay-v2-breakdown');
    const oldTable = document.getElementById('pay-breakdown-table-body')?.closest('table');
    const isV2 = ipc.engine_version >= 2 && ipc.computed;
    if (oldTable) oldTable.classList.toggle('hidden', !!isV2);
    if (v2Box) v2Box.innerHTML = '';
    if (isV2) {
        const c = ipc.computed;
        const all = contractIPCs(state.appData.Payments || [], ipc.contract_id);
        const lines = withPreviousAmounts(ipc, all);
        if (v2Box) v2Box.innerHTML = `
            ${renderCertTable(c)}
            ${lines.length ? `<div class="breakdown-section-title">Giá trị công việc theo Bill / mã ngân sách</div>${renderLinesTable(lines)}` : ''}
            ${c.advanceToDate ? `<div class="breakdown-section-title">Thu hồi tạm ứng</div>${renderAPRecoup(c)}` : ''}
            <div class="breakdown-section-title">Tổng hợp thanh toán của hợp đồng (đến đợt này)</div>
            ${renderSummaryOfPayment(all, ipc.ipc_id)}`;
        const netEl = document.getElementById('pay-net-payable-display');
        if (netEl) netEl.textContent = `${formatCurrencyVND(c.paymentThisPeriod)} VNĐ`;
        const ws = document.getElementById('payment-detail-workspace');
        if (ws) ws.dataset.netPayable = c.paymentThisPeriod;
        return;
    }
    const isConsultancy = ipc.contract_type === 'Consultancy';

    const fmt = v => `${formatCurrencyVND(v)} VNĐ`;
    const fmtPct = v => `${Number(v) || 0}%`;

    let rows = [];

    if (isConsultancy) {
        // ── Consultancy: simplified formula ─────────────────
        const gross = Number(ipc.gross_work_done) || 0;
        const qsDed = Number(ipc.qs_deduction) || 0;
        const vatPct = Number(ipc.vat_pct) || 10;
        const afterQS = gross - qsDed;
        const vatAmt = Math.round(afterQS * vatPct / 100);
        const net = afterQS + vatAmt;

        rows = [
            { no: '1', label: 'Giá trị Khối lượng Đợt này', sublabel: '(Gross Work Done)', value: fmt(gross), highlight: false, isPositive: true },
            { no: '2', label: `Khấu trừ điều chỉnh QS (nếu có)`, sublabel: '(QS Adjustment Deduction)', value: qsDed > 0 ? `- ${fmt(qsDed)}` : '—', highlight: false, isPositive: false },
            { no: '3', label: `Thuế GTGT (VAT ${fmtPct(vatPct)})`, sublabel: '(Value Added Tax)', value: `+ ${fmt(vatAmt)}`, highlight: false, isPositive: true },
            { no: '4', label: 'TỔNG GIÁ TRỊ THỰC CHI ĐỢT NÀY', sublabel: '(NET PAYABLE = (Gross − QS) × (1 + VAT%))', value: fmt(net), highlight: true, isPositive: true },
        ];

        // Update net payable display
        const netEl = document.getElementById('pay-net-payable-display');
        if (netEl) netEl.textContent = fmt(net);

    } else {
        // ── Construction: full 5-line breakdown ─────────────
        // IPC kiểu cũ (trước khi có bộ máy lũy kế): hiển thị đúng số đã lưu
        const breakdown = {
            apDeduction: Number(ipc.ap_deduction) || 0,
            retentionDeduction: Number(ipc.retention_deduction) || 0,
            vatAmount: Number(ipc.vat_amount) || 0,
            netPayable: Number(ipc.net_payable) || 0,
        };

        rows = [
            { no: '1', label: 'Giá trị Khối lượng Đợt này', sublabel: '(Gross Work Done)', value: fmt(ipc.gross_work_done), highlight: false, isPositive: true },
            { no: '2', label: `Khấu trừ Thu hồi Tạm ứng (AP Recovery ${fmtPct(ipc.ap_recovery_pct)})`, sublabel: '(Advance Payment Deduction)', value: `- ${fmt(breakdown.apDeduction)}`, highlight: false, isPositive: false },
            { no: '3', label: `Giữ lại Bảo hành (Retention ${fmtPct(ipc.retention_pct)})`, sublabel: '(Retention Deduction)', value: `- ${fmt(breakdown.retentionDeduction)}`, highlight: false, isPositive: false },
            { no: '4', label: `Thuế GTGT (VAT ${fmtPct(ipc.vat_pct)})`, sublabel: '(Value Added Tax)', value: `+ ${fmt(breakdown.vatAmount)}`, highlight: false, isPositive: true },
            { no: '5', label: 'TỔNG GIÁ TRỊ THỰC CHI ĐỢT NÀY', sublabel: '(NET PAYABLE THIS PERIOD)', value: fmt(breakdown.netPayable), highlight: true, isPositive: true },
        ];

        if (Number(ipc.qs_deduction) > 0) {
            rows.splice(3, 0, {
                no: '3b', label: 'Khấu trừ điều chỉnh QS', sublabel: '(QS Adjustment Deduction)',
                value: `- ${fmt(ipc.qs_deduction)}`, highlight: false, isPositive: false,
            });
        }

        const netEl = document.getElementById('pay-net-payable-display');
        if (netEl) netEl.textContent = fmt(breakdown.netPayable);
    }

    const container = document.getElementById('pay-breakdown-table-body');
    if (!container) return;

    container.innerHTML = rows.map(r => `
        <tr class="${r.highlight ? 'breakdown-total-row' : ''}">
            <td style="text-align:center;font-weight:600;color:var(--text-muted);width:40px;">${r.no}</td>
            <td>
                <div style="font-weight:${r.highlight ? '700' : '500'};font-size:${r.highlight ? '14px' : '13px'};">${escapeHtml(r.label)}</div>
                <div style="font-size:11px;color:var(--text-muted);font-style:italic;">${r.sublabel}</div>
            </td>
            <td style="text-align:right;font-weight:${r.highlight ? '700' : '500'};
                font-size:${r.highlight ? '15px' : '13px'};
                color:${r.highlight ? 'var(--primary-blue)' : r.isPositive ? 'inherit' : 'var(--accent-red)'};">
                ${r.value}
            </td>
        </tr>`).join('');
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

/** Gắn "đến kỳ trước" cho từng dòng Bill của IPC (lấy từ IPC đứng trước). */
function withPreviousAmounts(ipc, all) {
    const lines = ipc.lines || [];
    const idx = all.findIndex(p => p.ipc_id === ipc.ipc_id);
    const prev = all.slice(0, idx).reverse().find(p => Array.isArray(p.lines) && p.lines.length);
    const key = (l) => `${l.code}|${String(l.description).toLowerCase()}`;
    const map = new Map((prev?.lines || []).map(l => [key(l), Number(l.to_date_amount) || 0]));
    return lines.map(l => ({ ...l, previous_amount: map.get(key(l)) || 0 }));
}

function formatDateShort(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

