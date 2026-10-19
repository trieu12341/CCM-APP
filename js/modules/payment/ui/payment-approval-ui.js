/**
 * payment-approval-ui.js — Nút Phê duyệt / Xác nhận đã chuyển tiền / Sửa của IPC.
 */
import { isLockedIPC } from '../ipc-chain.js';

const formatDateShort = (d) => {
    if (!d) return '—';
    const x = new Date(d);
    return isNaN(x) ? d : `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}`;
};

// ─────────────────────────────────────────────────────────────
// APPROVAL ACTIONS
// ─────────────────────────────────────────────────────────────

export function renderApprovalActions(ipc) {
    const btnApprove = document.getElementById('btn-approve-ipc');
    const btnPaid = document.getElementById('btn-confirm-paid');
    const paidSection = document.getElementById('pay-paid-date-section');

    const btnEdit = document.getElementById('btn-edit-ipc');
    if (btnEdit) btnEdit.classList.toggle('hidden', isLockedIPC(ipc));
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

