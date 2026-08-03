import { saveProject, saveTender, saveBudget, saveContracts, saveCashflow, savePayments } from '../api.js';

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
            if (e.target.value === 'RESET') {
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
            if (confirmInput.value !== 'RESET') return;
            executeReset();
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

function handleAutoBackup() {
    const backupData = {};
    SYSTEM_KEYS.forEach(key => {
        const data = localStorage.getItem(key);
        if (data) {
            try {
                backupData[key] = JSON.parse(data);
            } catch (e) {
                backupData[key] = data; // fallback to string if not JSON
            }
        }
    });

    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create timestamp string
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `CCM_Backup_${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 200);
    
    console.log(`Auto-backup created: CCM_Backup_${timestamp}.json`);
}

function executeReset() {
    const scopePayments = document.getElementById('reset-scope-payments')?.checked;
    const scopeCashflow = document.getElementById('reset-scope-cashflow')?.checked;
    const scopeContracts = document.getElementById('reset-scope-contracts')?.checked;
    const scopeFull = document.getElementById('reset-scope-full')?.checked;

    // 1. Backup before reset
    handleAutoBackup();

    // 2. Wait slightly to ensure download triggers, then delete and reload
    setTimeout(async () => {
        try {
            if (scopeFull) {
                SYSTEM_KEYS.forEach(key => localStorage.removeItem(key));
                await saveProject([]);
                await saveBudget({ Budgets: [], Contracts: [], Payment_Claims: [], Variations: [], Documents: [] });
                await saveTender([]);
                await saveContracts([]);
                await saveCashflow([]);
                await savePayments([]);
            } else {
                if (scopePayments) {
                    localStorage.removeItem('ccm_payments');
                    await savePayments([]);
                }
                if (scopeCashflow) {
                    localStorage.removeItem('ccm_cashflow');
                    await saveCashflow([]);
                }
                if (scopeContracts) {
                    localStorage.removeItem('ccm_contracts');
                    localStorage.removeItem('ccm_tenders');
                    await saveContracts([]);
                    await saveTender([]);
                }
            }
        } catch (err) {
            console.error("Failed to clear API data", err);
        }

        // Add a visual toast/alert before reload
        alert('Đã dọn dẹp dữ liệu theo yêu cầu! Hệ thống sẽ tự động khởi động lại (Reload).');
        location.reload();
    }, 500);
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
            for (const key of SYSTEM_KEYS) {
                if (data.hasOwnProperty(key)) {
                    const value = typeof data[key] === 'object' ? JSON.stringify(data[key]) : data[key];
                    localStorage.setItem(key, value);
                    restoredCount++;
                    
                    // Sync restored data back to the server via API
                    try {
                        if (key === 'ccm_projects') await saveProject(data[key] || []);
                        if (key === 'ccm_tenders') await saveTender(data[key] || []);
                        if (key === 'ccm_contracts') await saveContracts(data[key] || []);
                        if (key === 'ccm_cashflow') await saveCashflow(data[key] || []);
                        if (key === 'ccm_payments') await savePayments(data[key] || []);
                    } catch (err) {
                        console.error('Failed to restore API data for', key, err);
                    }
                }
            }

            // Sync Budget manually if it exists to match the API structure
            if (data.hasOwnProperty('ccm_budgets')) {
                try {
                    await saveBudget({
                        Budgets: data['ccm_budgets'] || [],
                        Contracts: data['ccm_contracts'] || [],
                        Payment_Claims: [],
                        Variations: [],
                        Documents: []
                    });
                } catch (err) {
                    console.error('Failed to restore Budget API data', err);
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
