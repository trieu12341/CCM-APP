/**
 * payment-nav.js — Điều hướng giữa các lớp của module Thanh toán
 * (Dashboard ↔ Danh sách ↔ Chi tiết / Form IPC) và thông báo toast.
 */
import { markOpened } from '../../core/v2-sync.js';
import { renderPaymentDashboard } from './ui/payment-layer1-ui.js';
import { renderIPCList } from './ui/payment-layer2-ui.js';
import { renderIPCDetail, renderIPCForm } from './ui/payment-layer3-ui.js';

// ─────────────────────────────────────────────────────────────
// LAYER 1 ↔ LAYER 2 NAVIGATION
// ─────────────────────────────────────────────────────────────

/**
 * Opens Layer 2 full workspace:
 * - Hides #module-payment (Layer 1) completely
 * - Shows #payment-list-modal as full-screen workspace
 * - Collapses the sidebar to maximize space
 */
export function openLayer2() {
    // Hide Layer 1 dashboard
    const layer1 = document.getElementById('module-payment');
    if (layer1) layer1.classList.add('hidden');

    // Show Layer 2 list
    const layer2 = document.getElementById('payment-list-modal');
    if (layer2) layer2.classList.remove('hidden');

    // Auto-collapse sidebar
    if (typeof window.collapseSidebar === 'function') window.collapseSidebar();

    // Render fresh data
    renderIPCList();
}

/**
 * Closes Layer 2, restores Layer 1 Dashboard.
 */
export function closeLayer2() {
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

    // Restore sidebar
    if (typeof window.expandSidebar === 'function') window.expandSidebar();

    // Refresh KPI dashboard
    renderPaymentDashboard();
}

// ─────────────────────────────────────────────────────────────
// LAYER 3 NAVIGATION HELPERS
// ─────────────────────────────────────────────────────────────

export function openIPCDetail(ipcId) {
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

export function closeIPCDetail() {
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

export function openIPCForm(editIpcId = null) {
    const detailPanel = document.getElementById('ipc-detail-panel');
    const formPanel = document.getElementById('ipc-form-panel');
    if (detailPanel) detailPanel.classList.add('hidden');
    if (formPanel) formPanel.classList.remove('hidden');

    const workspace = document.getElementById('payment-detail-workspace');
    if (workspace) {
        workspace.classList.remove('hidden');
        if (editIpcId) {
            workspace.dataset.formEditIpcId = editIpcId;
            markOpened('payments', editIpcId);
        } else {
            delete workspace.dataset.formEditIpcId;
        }
    }

    renderIPCForm(editIpcId);
}

export function closeIPCForm() {
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

export function getCurrentDetailIpcId() {
    return document.getElementById('payment-detail-workspace')?.dataset.currentIpcId || null;
}

// ─────────────────────────────────────────────────────────────
// TOAST NOTIFICATION (lightweight)
// ─────────────────────────────────────────────────────────────

export function showToast(message, type = 'info') {
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
