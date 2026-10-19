/**
 * payment-ipc-form-ui.js — Form Tạo / Sửa IPC.
 *  - Gói XÂY DỰNG: phần nhập theo mẫu CERT (ipc-construction-form.js), số do
 *    bộ máy IPC lũy kế tính.
 *  - Gói TƯ VẤN: (Giá trị − khấu trừ QS) × (1 + VAT), làm tròn từng dòng.
 */
import { state, formatCurrencyVND } from '../../../app.js';
import { escapeHtml } from '../../../utils/formatters.js';
import { getContractName, getContractorName } from '../../../core/contract-fields.js';
import { getIPCParams, computeConsultancyIPC } from '../ipc-engine.js';
import { contractIPCs, nextPaymentNumber } from '../ipc-chain.js';
import { getIPCById } from '../payment-state.js';
import { renderConstructionSection, updatePreview, buildFromForm } from './ipc-construction-form.js';
import { bindConstructionEvents } from './ipc-construction-events.js';

const $ = (id) => document.getElementById(id);
const getContract = (id) => (state.appData.Contracts || []).find(c => c.contract_id === id);
const isConsultancyContract = (c) => (c?.type || 'Construction') === 'Consultancy';

export function renderIPCForm(ipcId = null) {
    bindConstructionEvents();
    const projectId = state.currentProjectId;
    const editIpc = ipcId ? getIPCById(ipcId) : null;
    const contracts = (state.appData.Contracts || []).filter(c => c.project_id === projectId
        && (c.status !== 'Closed' || c.contract_id === editIpc?.contract_id));

    const sel = $('ipc-form-contract');
    if (sel) {
        sel.innerHTML = `<option value="">-- Chọn Gói thầu / Hợp đồng --</option>` + contracts.map(c => {
            const t = c.type || 'Construction';
            return `<option value="${escapeHtml(c.contract_id)}" data-name="${escapeHtml(getContractName(c))}"
                data-contractor="${escapeHtml(getContractorName(c))}" data-contract-type="${t}">
                [${t === 'Consultancy' ? 'Tư vấn' : 'Xây dựng'}] ${escapeHtml(getContractName(c) || 'Không rõ')}</option>`;
        }).join('');
        sel.disabled = !!editIpc; // không đổi hợp đồng của IPC đã có
    }
    const title = $('ipc-form-title');
    if (title) title.textContent = editIpc ? `Sửa Hồ sơ Thanh toán ${editIpc.ipc_id}` : 'Tạo Hồ sơ Thanh toán Mới (IPC)';

    const form = $('ipc-form');
    if (form) form.reset();
    const set = (id, v) => { const el = $(id); if (el) el.value = v ?? ''; };
    if (editIpc) {
        set('ipc-form-contract', editIpc.contract_id);
        set('ipc-form-payment-no', editIpc.payment_number);
        set('ipc-form-submission-date', editIpc.submission_date);
        set('ipc-form-due-date', editIpc.due_date);
        if (editIpc.contract_type === 'Consultancy') set('ipc-form-gross', editIpc.gross_work_done);
        set('ipc-form-vat', editIpc.vat_pct);
        set('ipc-form-qs-deduction', editIpc.qs_deduction);
        set('ipc-form-notes', editIpc.notes);
    } else {
        set('ipc-form-submission-date', new Date().toISOString().split('T')[0]);
        set('ipc-form-vat', 10);
        set('ipc-form-qs-deduction', 0);
    }
    onContractChanged({ keepPaymentNo: !!editIpc });
}

/** Gọi khi đổi hợp đồng: bật đúng phần nhập, đặt số đợt, dựng phần xây dựng. */
export function onContractChanged({ keepPaymentNo = false } = {}) {
    const sel = $('ipc-form-contract');
    const contract = getContract(sel?.value);
    const contractorEl = $('ipc-form-contractor-display');
    if (contractorEl) contractorEl.textContent = contract ? getContractorName(contract) : '';
    const consult = isConsultancyContract(contract);
    applyContractTypeUI(contract ? (consult ? 'Consultancy' : 'Construction') : 'Construction');

    const payments = state.appData.Payments || [];
    const workspace = $('payment-detail-workspace');
    const editIpc = workspace?.dataset.formEditIpcId ? getIPCById(workspace.dataset.formEditIpcId) : null;
    const noEl = $('ipc-form-payment-no');
    if (contract && !keepPaymentNo && noEl) {
        const hasAny = contractIPCs(payments, contract.contract_id).length > 0;
        noEl.value = !consult && !hasAny && getIPCParams(contract).advancePct > 0 ? 0 : nextPaymentNumber(payments, contract.contract_id);
    }
    if (contract && !consult) {
        renderConstructionSection({ contract, payments, variations: state.appData.Variations || [],
            editIpc, paymentNumber: Number(noEl?.value) || 0 });
    } else {
        renderConstructionSection({ contract: null });
    }
    updateFormCalc();
}

export function applyContractTypeUI(contractType) {
    const consult = contractType === 'Consultancy';
    $('ipc-construction-section')?.classList.toggle('hidden', consult);
    $('ipc-simple-section')?.classList.toggle('hidden', !consult);
    const gross = $('ipc-form-gross');
    if (gross) gross.required = consult; // ô ẩn không được chặn submit
    const noEl = $('ipc-form-payment-no');
    if (noEl) noEl.min = consult ? 1 : 0;
    ['ipc-form-group-ap', 'ipc-form-group-retention', 'form-preview-ap-row', 'form-preview-retention-row']
        .forEach(id => { const el = $(id); if (el) el.style.display = 'none'; });
    const netLabel = $('form-preview-net-label');
    if (netLabel) netLabel.textContent = 'THANH TOÁN = (Giá trị − khấu trừ QS) × (1 + VAT)';
    const f = $('ipc-form');
    if (f) f.dataset.contractType = contractType;
}

export function updateFormCalc() {
    const contract = getContract($('ipc-form-contract')?.value);
    if (contract && !isConsultancyContract(contract)) { updatePreview(); return; }
    const num = (id) => Number($(id)?.value) || 0;
    const r = computeConsultancyIPC({ gross: num('ipc-form-gross'), qsDeduction: num('ipc-form-qs-deduction'), vatPct: num('ipc-form-vat') });
    const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
    set('form-preview-vat', `+ ${formatCurrencyVND(r.vat)} VNĐ`);
    set('form-preview-net', `${formatCurrencyVND(r.netPayable)} VNĐ`);
}

/** Đọc form → bản ghi IPC (đã tính). */
export function readIPCFormData() {
    const sel = $('ipc-form-contract');
    const contract = getContract(sel?.value);
    const str = (id) => $(id)?.value?.trim() || '';
    const base = {
        project_id: state.currentProjectId,
        contract_id: contract?.contract_id || '',
        contract_name: getContractName(contract),
        contractor_name: getContractorName(contract),
        payment_number: Number($('ipc-form-payment-no')?.value) || 0,
        submission_date: str('ipc-form-submission-date'),
        due_date: str('ipc-form-due-date'),
        notes: str('ipc-form-notes'),
    };
    if (contract && !isConsultancyContract(contract)) return buildFromForm(base);

    const num = (id) => Number($(id)?.value) || 0;
    const gross = num('ipc-form-gross'), qs = num('ipc-form-qs-deduction'), vatPct = num('ipc-form-vat');
    const r = computeConsultancyIPC({ gross, qsDeduction: qs, vatPct });
    return {
        ...base, contract_type: 'Consultancy', gross_work_done: gross, submitted_amount: gross, qs_deduction: qs,
        vat_pct: vatPct, ap_deduction: 0, retention_deduction: 0, ap_recovery_pct: 0, retention_pct: 0,
        sub_total: r.afterQS, certified_value: r.afterQS, certified_amount: r.afterQS,
        vat_amount: r.vat, net_payable: r.netPayable,
    };
}
