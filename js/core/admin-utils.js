// admin-utils.js - Data Reset and Auto-Backup utilities
import { state } from '../app.js';
import { isV2, getRepo } from './v2-sync.js';
import { runSafeReset, checkReset } from './reset-safe.js';
import { db } from '../firebase-config.js';
import { showToast } from '../modules/payment/payment-nav.js';

// admin-utils.js
// Utility module for Admin functions: Data Reset and Auto-Backup

const SYSTEM_KEYS = [
    'ccm_projects',
    'ccm_budgets',
    'ccm_tenders',
    'ccm_contracts',
    'ccm_cashflow',
    'ccm_payments',
    'ccm_current_project_id'
];

export function initAdminUtils() {
    const btnReset = document.getElementById('btn-admin-reset');
    const btnRestore = document.getElementById('btn-admin-restore');
    const fileInputRestore = document.getElementById('admin-restore-file');
    
    const resetModal = document.getElementById('system-reset-modal');
    const closeResetModal = document.getElementById('close-reset-modal');
    const cancelResetModal = document.getElementById('cancel-reset-modal');
    const confirmInput = document.getElementById('reset-confirm-input');
    const btnExecuteReset = document.getElementById('btn-execute-reset');
    const resetForm = document.getElementById('system-reset-form');

    // 1. Setup Data Reset Modal
    if (btnReset && resetModal) {
        btnReset.addEventListener('click', (e) => {
            e.preventDefault();
            resetModal.classList.remove('hidden');
            const nameEl = document.getElementById('reset-project-name');
            if (nameEl) nameEl.textContent = currentProjectName();
            if (confirmInput) {
                confirmInput.value = '';
                confirmInput.dispatchEvent(new Event('input')); // trigger validation
            }
        });
    }

    const closeModalFn = () => {
        if (resetModal) resetModal.classList.add('hidden');
    };
    if (closeResetModal) closeResetModal.addEventListener('click', (e) => { e.preventDefault(); closeModalFn(); });
    if (cancelResetModal) cancelResetModal.addEventListener('click', (e) => { e.preventDefault(); closeModalFn(); });

    // Validate confirmation string
    if (confirmInput && btnExecuteReset) {
        confirmInput.addEventListener('input', (e) => {
            if (e.target.value === currentProjectName() && currentProjectName()) {
                btnExecuteReset.disabled = false;
                btnExecuteReset.style.opacity = '1';
                btnExecuteReset.style.cursor = 'pointer';
            } else {
                btnExecuteReset.disabled = true;
                btnExecuteReset.style.opacity = '0.5';
                btnExecuteReset.style.cursor = 'not-allowed';
            }
        });
    }

    // Execute Reset on form submit
    if (resetForm) {
        resetForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (confirmInput.value !== currentProjectName()) return;
            executeReset(confirmInput.value);
        });
    }

    // 2. Setup Restore (Import JSON)
    if (btnRestore && fileInputRestore) {
        btnRestore.addEventListener('click', (e) => {
            e.preventDefault();
            fileInputRestore.click();
        });
        
        fileInputRestore.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            handleRestore(file);
            e.target.value = ''; // Reset input to allow re-selection
        });
    }
}

function currentProjectName() {
    const p = (state.appData.Projects || []).find(x => x.project_id === state.currentProjectId);
    return p ? (p.project_name || p.name || p.project_id) : '';
}

/** Tải file JSON xuống máy; resolve sau khi đã kích hoạt tải. */
async function downloadJson(data, filename) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 500);
}

async function executeReset(typedName) {
    const scopes = ['payments', 'cashflow', 'contracts', 'full'].filter(k => document.getElementById(`reset-scope-${k}`)?.checked);
    const pid = state.currentProjectId;
    const isAdmin = state.user?.role === 'admin';
    const problem = checkReset({ isAdmin, projectName: currentProjectName(), typedName, scopes });
    if (problem) { showToast(problem, 'error'); return; }
    try {
        const v2 = isV2(pid);
        const r = await runSafeReset({ db, repo: v2 ? getRepo() : null, pid, projectName: currentProjectName(), typedName, isAdmin, scopes, download: downloadJson, v2 });
        if (v2) {
            document.getElementById('system-reset-modal')?.classList.add('hidden');
            showToast(`Đã tải bản sao lưu và chuyển ${r.deleted} hồ sơ vào Thùng rác (khôi phục được).`, 'success');
            return;
        }
        await legacyReset(scopes);   // dự án chưa chuyển: giữ cách xóa cũ (đã có bản sao lưu ở trên)
    } catch (err) {
        console.error('Reset thất bại:', err);
        showToast(`Chưa xóa gì: ${String(err.message || err).slice(0, 140)}`, 'error');
    }
}

async function legacyReset(scopes) {
    const has = (k) => scopes.includes(k);
    const { saveContractsToCloud, saveCashflowToCloud, savePaymentsToCloud, saveTendersToCloud } = await import('../db-service.js');
    if (has('full')) {
        localStorage.clear(); sessionStorage.clear();
        localStorage.setItem('ccm_user_reset_cleared', 'true');
    } else {
        if (has('payments')) { localStorage.removeItem('ccm_payments'); await savePaymentsToCloud([]); }
        if (has('cashflow')) { localStorage.removeItem('ccm_cashflow'); await saveCashflowToCloud([]); }
        if (has('contracts')) {
            localStorage.removeItem('ccm_contracts'); localStorage.removeItem('ccm_tenders');
            await saveContractsToCloud([]); await saveTendersToCloud([]);
        }
    }
    showToast('Đã dọn dữ liệu theo yêu cầu (đã tải bản sao lưu). Đang tải lại…', 'success');
    setTimeout(() => location.reload(), 1200);
}

function handleRestore(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (typeof data !== 'object' || data === null) {
                throw new Error('Invalid JSON structure');
            }
            
            let restoredCount = 0;
            const { saveProjectsToCloud, saveTendersToCloud, saveContractsToCloud, saveCashflowToCloud, savePaymentsToCloud, saveBudgetsToCloud } = await import('../db-service.js');

            for (const key of SYSTEM_KEYS) {
                if (data.hasOwnProperty(key)) {
                    const value = typeof data[key] === 'object' ? JSON.stringify(data[key]) : data[key];
                    localStorage.setItem(key, value);
                    restoredCount++;
                    
                    // Sync restored data to Firestore
                    try {
                        if (key === 'ccm_projects') await saveProjectsToCloud(data[key] || []);
                        if (key === 'ccm_tenders') await saveTendersToCloud(data[key] || []);
                        if (key === 'ccm_contracts') await saveContractsToCloud(data[key] || []);
                        if (key === 'ccm_cashflow') await saveCashflowToCloud(data[key] || []);
                        if (key === 'ccm_payments') await savePaymentsToCloud(data[key] || []);
                        if (key === 'ccm_budgets') await saveBudgetsToCloud(data[key] || []);
                    } catch (err) {
                        console.error('Failed to restore Firestore data for', key, err);
                    }
                }
            }
            
            if (restoredCount > 0) {
                alert(`Khôi phục thành công ${restoredCount} mảng dữ liệu! Hệ thống sẽ tự động khởi động lại.`);
                location.reload();
            } else {
                alert('File JSON không chứa cấu trúc dữ liệu của CCM App.');
            }
        } catch (error) {
            console.error('Error restoring JSON backup:', error);
            alert('Lỗi: File JSON không hợp lệ hoặc bị hỏng.');
        }
    };
    reader.readAsText(file);
}
