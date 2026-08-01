/**
 * payment-events.js
 * Layer Controller / Router for Tab 5 Payment.
 * Wires all button events and manages Layer 1 ↔ Layer 2 ↔ Layer 3 transitions.
 *
 * Navigation contract (CORRECTED):
 *   Layer 1 → Layer 2 : hide #module-payment, show #payment-list-modal (full workspace)
 *   Layer 2 → Layer 1 : hide #payment-list-modal, show #module-payment
 *   Layer 2 → Layer 3 : show #payment-detail-workspace (slide-in panel)
 *   Layer 3 → Layer 2 : hide #payment-detail-workspace, ensure scroll unlocked
 */

import { renderPaymentDashboard } from './ui/payment-layer1-ui.js';
import { renderIPCList, applyIPCFilters } from './ui/payment-layer2-ui.js';
import { renderIPCDetail, renderIPCForm, updateFormCalc, readIPCFormData, applyContractTypeUI } from './ui/payment-layer3-ui.js';
import { createIPC, updateIPC, deleteIPC, initPaymentsFromLS } from './payment-state.js';

// ─────────────────────────────────────────────────────────────
// MAIN SETUP — Called from app-init.js
// ─────────────────────────────────────────────────────────────

export function setupPaymentEvents() {
    // Recover data from localStorage if state was empty
    initPaymentsFromLS();

    // ── LAYER 1 EVENTS ───────────────────────────────────────

    // "Danh sách Tổng hợp Hồ sơ Thanh toán" button
    const btnOpenList = document.getElementById('btn-open-payment-list');
    if (btnOpenList) {
        btnOpenList.addEventListener('click', () => openLayer2());
    }

    // Pending table row clicks → jump directly to Layer 3 via Layer 2
    const pendingTbody = document.getElementById('pay-pending-tbody');
    if (pendingTbody) {
        pendingTbody.addEventListener('click', (e) => {
            const row = e.target.closest('.pending-row');
            if (!row) return;
            const ipcId = row.dataset.ipcId;
            if (ipcId) {
                openLayer2();
                openIPCDetail(ipcId);
            }
        });
    }

    // ── LAYER 2 EVENTS ───────────────────────────────────────

    // "Quay lại Dashboard" button in Layer 2
    const btnBackToL1 = document.getElementById('btn-payment-back-l1');
    if (btnBackToL1) {
        btnBackToL1.addEventListener('click', () => closeLayer2());
    }

    // Filter: search input
    const searchInput = document.getElementById('ipc-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', applyIPCFilters);
    }

    // Filter: status select
    const statusFilter = document.getElementById('ipc-status-filter');
    if (statusFilter) {
        statusFilter.addEventListener('change', applyIPCFilters);
    }

    // Filter: contract type select (NEW)
    const contractTypeFilter = document.getElementById('ipc-contract-type-filter');
    if (contractTypeFilter) {
        contractTypeFilter.addEventListener('change', applyIPCFilters);
    }

    // "+ Tạo Hồ sơ Thanh toán Mới (IPC)" button
    const btnNewIPC = document.getElementById('btn-new-ipc');
    if (btnNewIPC) {
        btnNewIPC.addEventListener('click', () => openIPCForm(null));
    }

    // IPC table row & detail button click → Layer 3
    const ipcListTbody = document.getElementById('ipc-list-tbody');
    if (ipcListTbody) {
        ipcListTbody.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-ipc-detail');
            const row = e.target.closest('.ipc-row');
            const ipcId = (btn || row)?.dataset.ipcId;
            if (ipcId) openIPCDetail(ipcId);
        });
    }

    // ── LAYER 3 EVENTS — IPC DETAIL ─────────────────────────

    // Close Layer 3 detail → back to Layer 2 list
    const btnCloseDetail = document.getElementById('btn-close-ipc-detail');
    if (btnCloseDetail) {
        btnCloseDetail.addEventListener('click', closeIPCDetail);
    }

    // "Phê duyệt IPC" button
    const btnApprove = document.getElementById('btn-approve-ipc');
    if (btnApprove) {
        btnApprove.addEventListener('click', () => {
            const ipcId = getCurrentDetailIpcId();
            if (!ipcId) return;
            const updated = updateIPC(ipcId, { status: 'Approved' });
            if (updated) {
                renderIPCDetail(ipcId);
                renderIPCList();
                showToast('✅ IPC đã được Phê duyệt thành công!', 'success');
            }
        });
    }

    // "Xác nhận Đã Chuyển Tiền" button
    const btnPaid = document.getElementById('btn-confirm-paid');
    if (btnPaid) {
        btnPaid.addEventListener('click', () => {
            const ipcId = getCurrentDetailIpcId();
            if (!ipcId) return;
            const paidDate = new Date().toISOString().split('T')[0];
            const ipc = updateIPC(ipcId, {
                status: 'Paid',
                paid_date: paidDate,
                paid_amount: Number(document.getElementById('payment-detail-workspace')?.dataset.netPayable || 0),
            });
            if (ipc) {
                renderIPCDetail(ipcId);
                renderIPCList();
                showToast('💳 Đã xác nhận Chuyển tiền thành công!', 'success');
            }
        });
    }

    // Delete IPC button
    const btnDeleteIPC = document.getElementById('btn-delete-ipc');
    if (btnDeleteIPC) {
        btnDeleteIPC.addEventListener('click', () => {
            const ipcId = getCurrentDetailIpcId();
            if (!ipcId) return;
            if (!confirm('Bạn có chắc chắn muốn xóa Hồ sơ Thanh toán này?')) return;
            deleteIPC(ipcId);
            closeIPCDetail();
            renderIPCList();
            showToast('🗑️ Đã xóa Hồ sơ Thanh toán', 'info');
        });
    }

    // ESC key → close Layer 3 first, then Layer 2
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const detail = document.getElementById('payment-detail-workspace');
            if (detail && !detail.classList.contains('hidden')) {
                closeIPCDetail();
                return;
            }
            const listModal = document.getElementById('payment-list-modal');
            if (listModal && !listModal.classList.contains('hidden')) {
                closeLayer2();
            }
        }
    });

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

    // Contract dropdown change → auto-fill contractor + detect type → toggle form fields
    const contractSel = document.getElementById('ipc-form-contract');
    if (contractSel) {
        contractSel.addEventListener('change', () => {
            const opt = contractSel.options[contractSel.selectedIndex];

            // Auto-fill contractor name
            const contractorEl = document.getElementById('ipc-form-contractor-display');
            if (contractorEl) contractorEl.textContent = opt?.dataset.contractor || '';

            // Detect type and apply dynamic UI
            const contractType = opt?.dataset.contractType || 'Construction';
            applyContractTypeUI(contractType);
            updateFormCalc();
        });
    }

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
            const workspace = document.getElementById('payment-detail-workspace');
            const editIpcId = workspace?.dataset.formEditIpcId;

            if (editIpcId) {
                updateIPC(editIpcId, formData);
                showToast('✏️ Đã cập nhật Hồ sơ Thanh toán', 'success');
            } else {
                createIPC(formData);
                showToast('🆕 Đã tạo Hồ sơ Thanh toán mới', 'success');
            }

            closeIPCForm();
            renderIPCList();
            renderPaymentDashboard();
        });
    }

    // Initial render of Layer 1
    renderPaymentDashboard();

    // Listen for paymentsChanged (e.g. from other sources)
    document.addEventListener('paymentsChanged', () => {
        const payMod = document.getElementById('module-payment');
        if (payMod && !payMod.classList.contains('hidden')) {
            renderPaymentDashboard();
        }
    });
}

// ─────────────────────────────────────────────────────────────
// LAYER 1 ↔ LAYER 2 NAVIGATION
// ─────────────────────────────────────────────────────────────

/**
 * Opens Layer 2 full workspace:
 * - Hides #module-payment (Layer 1) completely
 * - Shows #payment-list-modal as full-screen workspace
 */
function openLayer2() {
    // Hide Layer 1 dashboard
    const layer1 = document.getElementById('module-payment');
    if (layer1) layer1.classList.add('hidden');

    // Show Layer 2 list
    const layer2 = document.getElementById('payment-list-modal');
    if (layer2) layer2.classList.remove('hidden');

    // Render fresh data
    renderIPCList();
}

/**
 * Closes Layer 2, restores Layer 1 Dashboard.
 */
function closeLayer2() {
    // Close Layer 3 if still open
    const workspace = document.getElementById('payment-detail-workspace');
    if (workspace && !workspace.classList.contains('hidden')) {
        closeIPCDetail();
    }

    // Hide Layer 2
    const layer2 = document.getElementById('payment-list-modal');
    if (layer2) layer2.classList.add('hidden');

    // Restore Layer 1
    const layer1 = document.getElementById('module-payment');
    if (layer1) layer1.classList.remove('hidden');

    // Refresh KPI dashboard
    renderPaymentDashboard();
}

// ─────────────────────────────────────────────────────────────
// LAYER 3 NAVIGATION HELPERS
// ─────────────────────────────────────────────────────────────

function openIPCDetail(ipcId) {
    const detailPanel = document.getElementById('ipc-detail-panel');
    const formPanel = document.getElementById('ipc-form-panel');
    if (detailPanel) detailPanel.classList.remove('hidden');
    if (formPanel) formPanel.classList.add('hidden');

    const workspace = document.getElementById('payment-detail-workspace');
    if (workspace) {
        workspace.classList.remove('hidden');
        workspace.dataset.currentIpcId = ipcId;
    }

    renderIPCDetail(ipcId);
}

function closeIPCDetail() {
    const workspace = document.getElementById('payment-detail-workspace');
    if (workspace) {
        workspace.classList.add('hidden');
        delete workspace.dataset.currentIpcId;
        delete workspace.dataset.formEditIpcId;
    }

    // CRITICAL: Remove any scroll-lock classes
    document.body.classList.remove('modal-open', 'overflow-hidden');
    document.body.style.overflow = '';
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        mainContent.style.overflowY = 'auto';
        mainContent.classList.remove('overflow-hidden');
    }
}

function openIPCForm(editIpcId = null) {
    const detailPanel = document.getElementById('ipc-detail-panel');
    const formPanel = document.getElementById('ipc-form-panel');
    if (detailPanel) detailPanel.classList.add('hidden');
    if (formPanel) formPanel.classList.remove('hidden');

    const workspace = document.getElementById('payment-detail-workspace');
    if (workspace) {
        workspace.classList.remove('hidden');
        if (editIpcId) {
            workspace.dataset.formEditIpcId = editIpcId;
        } else {
            delete workspace.dataset.formEditIpcId;
        }
    }

    renderIPCForm(editIpcId);
}

function closeIPCForm() {
    const detailPanel = document.getElementById('ipc-detail-panel');
    const formPanel = document.getElementById('ipc-form-panel');
    if (formPanel) formPanel.classList.add('hidden');
    if (detailPanel) detailPanel.classList.remove('hidden');

    const workspace = document.getElementById('payment-detail-workspace');
    const currentId = workspace?.dataset.currentIpcId;
    if (currentId) {
        renderIPCDetail(currentId);
    } else {
        closeIPCDetail();
    }
}

function getCurrentDetailIpcId() {
    return document.getElementById('payment-detail-workspace')?.dataset.currentIpcId || null;
}

// ─────────────────────────────────────────────────────────────
// TOAST NOTIFICATION (lightweight)
// ─────────────────────────────────────────────────────────────

function showToast(message, type = 'info') {
    document.querySelectorAll('.payment-toast').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = `payment-toast payment-toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => { toast.classList.add('payment-toast-show'); });

    setTimeout(() => {
        toast.classList.remove('payment-toast-show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Re-export renderPaymentDashboard for app-init.js
export { renderPaymentDashboard };
