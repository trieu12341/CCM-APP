/**
 * payment-layer3-ui.js
 * Layer 3: IPC Detail Workspace
 * - QS Financial Breakdown (standard / consultancy mode)
 * - Approval actions (Approve IPC / Confirm Paid)
 * - Create New IPC form with DYNAMIC fields based on contract type
 */

import { state, formatCurrencyVND, formatCurrencyShort } from '../../../app.js';
import { getIPCById, getPaymentsByProject } from '../payment-state.js';
import { calcNetPayable } from '../payment-calc.js';
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
    if (codeEl) codeEl.textContent = ipc.ipc_id.replace('ipc-', 'IPC-');
    if (statusEl) statusEl.innerHTML = getStatusBadge(ipc.status);

    workspace.dataset.currentIpcId = ipcId;

    // ── Main Info ────────────────────────────────────────────
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '—'; };
    setEl('pay-detail-contract-name', ipc.contract_name);
    setEl('pay-detail-contractor', ipc.contractor_name);
    setEl('pay-detail-payment-no', `Đợt ${ipc.payment_number}`);
    setEl('pay-detail-submission-date', formatDateShort(ipc.submission_date));
    setEl('pay-detail-due-date', ipc.due_date ? formatDateShort(ipc.due_date) : '—');
    setEl('pay-detail-notes', ipc.notes || '');

    // Contract type badge in detail header
    const typeEl = document.getElementById('pay-detail-contract-type');
    if (typeEl) {
        const isConsultancy = ipc.contract_type === 'Consultancy';
        typeEl.innerHTML = isConsultancy
            ? `<span style="font-size:11px;padding:2px 10px;border-radius:10px;background:#fef3c7;color:#d97706;font-weight:700;margin-left:8px;">Tư vấn</span>`
            : `<span style="font-size:11px;padding:2px 10px;border-radius:10px;background:#e0f2fe;color:#0369a1;font-weight:700;margin-left:8px;">Xây dựng</span>`;
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
        const breakdown = calcNetPayable({
            grossWorkDone: ipc.gross_work_done,
            apRecoveryPct: ipc.ap_recovery_pct,
            retentionPct: ipc.retention_pct,
            vatPct: ipc.vat_pct,
        });

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
            <td style="text-align:center;font-weight:600;color:#64748b;width:40px;">${r.no}</td>
            <td>
                <div style="font-weight:${r.highlight ? '700' : '500'};font-size:${r.highlight ? '14px' : '13px'};">${r.label}</div>
                <div style="font-size:11px;color:#94a3b8;font-style:italic;">${r.sublabel}</div>
            </td>
            <td style="text-align:right;font-weight:${r.highlight ? '700' : '500'};
                font-size:${r.highlight ? '15px' : '13px'};
                color:${r.highlight ? 'var(--primary-blue)' : r.isPositive ? 'inherit' : '#ef4444'};">
                ${r.value}
            </td>
        </tr>`).join('');
}

// ─────────────────────────────────────────────────────────────
// APPROVAL ACTIONS
// ─────────────────────────────────────────────────────────────

function renderApprovalActions(ipc) {
    const btnApprove = document.getElementById('btn-approve-ipc');
    const btnPaid = document.getElementById('btn-confirm-paid');
    const paidSection = document.getElementById('pay-paid-date-section');

    if (!btnApprove || !btnPaid) return;

    // Reset
    btnApprove.disabled = false;
    btnPaid.disabled = false;
    btnApprove.classList.remove('btn-disabled');
    btnPaid.classList.remove('btn-disabled');
    btnApprove.innerHTML = '<i class="fa-solid fa-check-double"></i> Phê duyệt IPC';
    btnPaid.innerHTML = '<i class="fa-solid fa-money-bill-transfer"></i> Xác nhận Đã Chuyển Tiền';
    if (paidSection) paidSection.classList.add('hidden');

    switch (ipc.status) {
        case 'Draft':
        case 'Reviewing':
            btnPaid.disabled = true;
            btnPaid.classList.add('btn-disabled');
            break;

        case 'Approved':
            btnApprove.disabled = true;
            btnApprove.classList.add('btn-disabled');
            btnApprove.innerHTML = '✅ Đã Phê duyệt';
            if (paidSection) paidSection.classList.remove('hidden');
            break;

        case 'Paid':
            btnApprove.disabled = true;
            btnApprove.classList.add('btn-disabled');
            btnApprove.innerHTML = '✅ Đã Phê duyệt';
            btnPaid.disabled = true;
            btnPaid.classList.add('btn-disabled');
            btnPaid.innerHTML = '💳 Đã Chuyển Tiền';
            if (paidSection) paidSection.classList.remove('hidden');
            if (ipc.paid_date) {
                const paidDateEl = document.getElementById('pay-paid-date-display');
                if (paidDateEl) paidDateEl.textContent = `Ngày chuyển: ${formatDateShort(ipc.paid_date)}`;
            }
            break;
    }
}

// ─────────────────────────────────────────────────────────────
// CREATE / EDIT IPC FORM
// ─────────────────────────────────────────────────────────────

export function renderIPCForm(ipcId = null) {
    const projectId = state.currentProjectId;
    const contracts = (state.appData.Contracts || []).filter(c => c.project_id === projectId && c.status !== 'Closed');

    // Populate contract dropdown — include data-contract-type for dynamic form
    const contractSel = document.getElementById('ipc-form-contract');
    if (contractSel) {
        contractSel.innerHTML = `<option value="">-- Chọn Gói thầu / Hợp đồng --</option>` +
            contracts.map(c => {
                const ctype = c.type || 'Construction';
                const label = ctype === 'Consultancy' ? '📋 Tư vấn' : '🏗️ Xây dựng';
                return `<option value="${c.contract_id || c.id}"
                    data-name="${escHtml(c.contract_name || c.package_name || '')}"
                    data-contractor="${escHtml(c.contractor_name || '')}"
                    data-contract-type="${ctype}">
                    [${label}] ${escHtml(c.contract_name || c.package_name || 'Không rõ')}
                </option>`;
            }).join('');
    }

    if (ipcId) {
        const ipc = getIPCById(ipcId);
        if (ipc) {
            fillFormFromIPC(ipc);
            applyContractTypeUI(ipc.contract_type || 'Construction');
        }
    } else {
        const form = document.getElementById('ipc-form');
        if (form) form.reset();

        // Defaults for Construction mode
        const retEl = document.getElementById('ipc-form-retention');
        const vatEl = document.getElementById('ipc-form-vat');
        const apEl  = document.getElementById('ipc-form-ap-recovery');
        if (retEl) retEl.value = 5;
        if (vatEl) vatEl.value = 10;
        if (apEl)  apEl.value  = 0;

        const dateEl = document.getElementById('ipc-form-submission-date');
        if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];

        // Start in Construction mode by default
        applyContractTypeUI('Construction');
    }

    // Auto-set payment number
    if (!ipcId && projectId) {
        const count = (getPaymentsByProject(projectId) || []).length;
        const payNoEl = document.getElementById('ipc-form-payment-no');
        if (payNoEl) payNoEl.value = count + 1;
    }

    updateFormCalc();
}

function fillFormFromIPC(ipc) {
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
    setVal('ipc-form-contract', ipc.contract_id);
    setVal('ipc-form-payment-no', ipc.payment_number);
    setVal('ipc-form-submission-date', ipc.submission_date);
    setVal('ipc-form-due-date', ipc.due_date);
    setVal('ipc-form-gross', ipc.gross_work_done);
    setVal('ipc-form-ap-recovery', ipc.ap_recovery_pct);
    setVal('ipc-form-retention', ipc.retention_pct);
    setVal('ipc-form-vat', ipc.vat_pct);
    setVal('ipc-form-qs-deduction', ipc.qs_deduction);
    setVal('ipc-form-notes', ipc.notes);
}

// ─────────────────────────────────────────────────────────────
// DYNAMIC CONTRACT TYPE UI
// ─────────────────────────────────────────────────────────────

/**
 * Toggles form fields and live preview rows based on contract type.
 * Call this whenever the contract dropdown changes.
 *
 * @param {'Construction'|'Consultancy'} contractType
 */
export function applyContractTypeUI(contractType) {
    const isConsultancy = contractType === 'Consultancy';

    // ── Toggle AP & Retention fields ────────────────────────
    const apGroup  = document.getElementById('ipc-form-group-ap');
    const retGroup = document.getElementById('ipc-form-group-retention');

    if (apGroup)  apGroup.style.display  = isConsultancy ? 'none' : '';
    if (retGroup) retGroup.style.display = isConsultancy ? 'none' : '';

    // ── Toggle Live Preview rows ─────────────────────────────
    const prevApRow  = document.getElementById('form-preview-ap-row');
    const prevRetRow = document.getElementById('form-preview-retention-row');

    if (prevApRow)  prevApRow.style.display  = isConsultancy ? 'none' : '';
    if (prevRetRow) prevRetRow.style.display = isConsultancy ? 'none' : '';

    // ── Update preview label for net formula ─────────────────
    const netLabel = document.getElementById('form-preview-net-label');
    if (netLabel) {
        netLabel.textContent = isConsultancy
            ? '✅ NET PAYABLE = (Gross − QS) × (1 + VAT%)'
            : '✅ NET PAYABLE ĐỢT NÀY';
    }

    // Store type on form for readIPCFormData()
    const ipcForm = document.getElementById('ipc-form');
    if (ipcForm) ipcForm.dataset.contractType = contractType;
}

// ─────────────────────────────────────────────────────────────
// LIVE CALCULATION PREVIEW
// ─────────────────────────────────────────────────────────────

/** Real-time calculation preview — adapts to contract type */
export function updateFormCalc() {
    const getNum = id => Number(document.getElementById(id)?.value) || 0;

    const ipcForm = document.getElementById('ipc-form');
    const contractType = ipcForm?.dataset.contractType || 'Construction';
    const isConsultancy = contractType === 'Consultancy';

    const gross  = getNum('ipc-form-gross');
    const vatPct = getNum('ipc-form-vat');
    const qsDed  = getNum('ipc-form-qs-deduction');

    const setPreview = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    if (isConsultancy) {
        // Consultancy formula: (Gross - QS) * (1 + VAT%)
        const afterQS = gross - qsDed;
        const vatAmt  = Math.round(afterQS * vatPct / 100);
        const net     = afterQS + vatAmt;

        setPreview('form-preview-vat', `+ ${fmtV(vatAmt)}`);
        setPreview('form-preview-net', fmtV(net));
    } else {
        // Construction formula: full AP + Retention + VAT
        const result = calcNetPayable({
            grossWorkDone: gross,
            apRecoveryPct: getNum('ipc-form-ap-recovery'),
            retentionPct:  getNum('ipc-form-retention'),
            vatPct,
        });

        setPreview('form-preview-ap',        `- ${fmtV(result.apDeduction)}`);
        setPreview('form-preview-retention',  `- ${fmtV(result.retentionDeduction)}`);
        setPreview('form-preview-vat',        `+ ${fmtV(result.vatAmount)}`);
        setPreview('form-preview-net',        fmtV(result.netPayable));
    }
}

function fmtV(v) {
    return `${formatCurrencyVND(v)} VNĐ`;
}

// ─────────────────────────────────────────────────────────────
// READ FORM DATA
// ─────────────────────────────────────────────────────────────

/** Reads form values into an IPC data object */
export function readIPCFormData() {
    const contractSel = document.getElementById('ipc-form-contract');
    const contractId  = contractSel ? contractSel.value : '';
    const selectedOpt = contractSel ? contractSel.options[contractSel.selectedIndex] : null;
    const contractName     = selectedOpt ? (selectedOpt.dataset.name || selectedOpt.text).replace(/\[.*?\]\s*/,'').trim() : '';
    const contractorName   = selectedOpt ? selectedOpt.dataset.contractor || '' : '';
    const contractType     = selectedOpt ? selectedOpt.dataset.contractType || 'Construction' : 'Construction';

    const getNum = id => Number(document.getElementById(id)?.value) || 0;
    const getStr = id => document.getElementById(id)?.value?.trim() || '';

    const gross  = getNum('ipc-form-gross');
    const vatPct = getNum('ipc-form-vat');
    const qsDed  = getNum('ipc-form-qs-deduction');
    const isConsultancy = contractType === 'Consultancy';

    let apPct = 0, retPct = 0, apDed = 0, retDed = 0, vatAmt = 0, netPayable = 0;

    if (isConsultancy) {
        const afterQS = gross - qsDed;
        vatAmt    = Math.round(afterQS * vatPct / 100);
        netPayable = afterQS + vatAmt;
    } else {
        apPct = getNum('ipc-form-ap-recovery');
        retPct = getNum('ipc-form-retention');
        const breakdown = calcNetPayable({ grossWorkDone: gross, apRecoveryPct: apPct, retentionPct: retPct, vatPct });
        apDed   = breakdown.apDeduction;
        retDed  = breakdown.retentionDeduction;
        vatAmt  = breakdown.vatAmount;
        netPayable = breakdown.netPayable;
    }

    return {
        contract_id:           contractId,
        contract_name:         contractName,
        contractor_name:       contractorName,
        contract_type:         contractType,
        payment_number:        getNum('ipc-form-payment-no'),
        submission_date:       getStr('ipc-form-submission-date'),
        due_date:              getStr('ipc-form-due-date'),
        gross_work_done:       gross,
        ap_recovery_pct:       apPct,
        retention_pct:         retPct,
        vat_pct:               vatPct,
        ap_deduction:          apDed,
        retention_deduction:   retDed,
        vat_amount:            vatAmt,
        net_payable:           netPayable,
        qs_deduction:          qsDed,
        certified_value:       netPayable,
        notes:                 getStr('ipc-form-notes'),
    };
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
