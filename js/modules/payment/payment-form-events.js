/**
 * payment-form-events.js — Sự kiện của form Tạo / Sửa IPC:
 * đổi hợp đồng / số đợt, nút Sửa, Lưu (kèm tính lại chuỗi IPC phía sau).
 */
import { state } from '../../app.js';
import { renderPaymentDashboard } from './ui/payment-layer1-ui.js';
import { renderIPCList } from './ui/payment-layer2-ui.js';
import { updateFormCalc, readIPCFormData, onContractChanged } from './ui/payment-layer3-ui.js';
import { createIPC, updateIPC, getPayments, getIPCById, savePaymentsState } from './payment-state.js';
import { recomputeChain, isLockedIPC } from './ipc-chain.js';
import { approvedVOTotal } from './ui/ipc-construction-form.js';
import { openIPCForm, closeIPCForm, getCurrentDetailIpcId, showToast } from './payment-nav.js';

export function setupIPCFormEvents() {
    // ── LAYER 3 EVENTS — CREATE FORM ────────────────────────

    // Close create form
    const btnCloseForm = document.getElementById('btn-close-ipc-form');
    if (btnCloseForm) {
        btnCloseForm.addEventListener('click', closeIPCForm);
    }

    // Real-time calc — all numeric inputs trigger update
    ['ipc-form-gross', 'ipc-form-ap-recovery', 'ipc-form-retention', 'ipc-form-vat', 'ipc-form-qs-deduction'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', updateFormCalc);
    });

    // Đổi hợp đồng → bật phần nhập phù hợp (xây dựng/tư vấn), đặt số đợt
    document.getElementById('ipc-form-contract')?.addEventListener('change', () => onContractChanged());
    // Đổi số đợt → tính lại "kỳ trước" cho phần nhập xây dựng
    document.getElementById('ipc-form-payment-no')?.addEventListener('change', () => onContractChanged({ keepPaymentNo: true }));

    // Nút "Sửa" IPC (chỉ khi chưa duyệt)
    document.getElementById('btn-edit-ipc')?.addEventListener('click', () => {
        const ipcId = getCurrentDetailIpcId();
        const ipc = ipcId && getIPCById(ipcId);
        if (!ipc) return;
        if (isLockedIPC(ipc)) { showToast('IPC đã duyệt/đã thanh toán — không sửa được.', 'info'); return; }
        openIPCForm(ipcId);
    });

    // Save new/edit IPC form
    const btnSaveIPC = document.getElementById('btn-save-ipc');
    if (btnSaveIPC) {
        btnSaveIPC.addEventListener('click', () => {
            const formEl = document.getElementById('ipc-form');
            if (formEl && !formEl.checkValidity()) {
                formEl.reportValidity();
                return;
            }

            const formData = readIPCFormData();
            if (!formData || !formData.contract_id) { showToast('Chọn Gói thầu / Hợp đồng trước khi lưu.', 'info'); return; }
            const workspace = document.getElementById('payment-detail-workspace');
            const editIpcId = workspace?.dataset.formEditIpcId;

            // Không trùng số đợt trong cùng hợp đồng
            const dup = getPayments().find(p => p.contract_id === formData.contract_id && p.ipc_id !== editIpcId
                && Number(p.payment_number) === Number(formData.payment_number));
            if (dup) { showToast(`Hợp đồng này đã có đợt ${formData.payment_number} (${dup.ipc_id}).`, 'info'); return; }

            let savedId = editIpcId;
            if (editIpcId) {
                updateIPC(editIpcId, formData);
                showToast('✏️ Đã cập nhật Hồ sơ Thanh toán', 'success');
            } else {
                savedId = createIPC(formData).ipc_id;
                showToast('🆕 Đã tạo Hồ sơ Thanh toán mới', 'success');
            }

            // Gói xây dựng: tính lại các IPC phía sau (chưa duyệt) để (11) luôn khớp
            if (formData.engine_version >= 2) {
                const contract = (state.appData.Contracts || []).find(c => c.contract_id === formData.contract_id);
                if (contract) {
                    savePaymentsState(recomputeChain(getPayments(), contract,
                        approvedVOTotal(state.appData.Variations || [], contract.contract_id)));
                }
            }
            if (savedId && workspace) workspace.dataset.currentIpcId = savedId;

            closeIPCForm();
            renderIPCList();
            renderPaymentDashboard();
        });
    }
}
