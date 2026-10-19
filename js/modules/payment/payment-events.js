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
import { renderIPCDetail } from './ui/payment-layer3-ui.js';
import { setupIPCFormEvents } from './payment-form-events.js';
import { createIPC, updateIPC, deleteIPC, initPaymentsFromLS, getPayments, getIPCById, savePaymentsState } from './payment-state.js';
import { recomputeChain, isLockedIPC } from './ipc-chain.js';
import { openLayer2, closeLayer2, openIPCDetail, closeIPCDetail, openIPCForm, getCurrentDetailIpcId, showToast } from './payment-nav.js';
import { approvedVOTotal } from './ui/ipc-construction-form.js';
import { state } from '../../app.js';

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



    // ── LAYER 3 — FORM TẠO / SỬA IPC ───────────────────────
    setupIPCFormEvents();

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

export { renderPaymentDashboard };
