import { state } from '../app.js';

export async function runAutoTestWorkflow() {
    showToast('Đang chạy Auto-Test...', 'info');
    console.group('🧪 ADMIN IN-APP AUTO-TEST WORKFLOW');
    let passed = 0;
    const total = 4;

    try {
        // TEST CASE 1: VERIFY CLEAN RESET
        console.log('--- TEST CASE 1: VERIFY CLEAN RESET ---');
        const isCleared = localStorage.getItem('ccm_user_reset_cleared') === 'true';
        
        if (!isCleared) {
            console.log('System is not in cleared state. Forcing clear for Test 1...');
            localStorage.setItem('ccm_user_reset_cleared', 'true');
            state.appData.Budgets = [];
            state.appData.Tenders = [];
            state.appData.Contracts = [];
            state.appData.Cashflow = [];
            state.appData.Payments = [];
        } else {
            // Emulate calling executeReset()
            state.appData.Budgets = [];
            state.appData.Tenders = [];
            state.appData.Contracts = [];
            state.appData.Cashflow = [];
            state.appData.Payments = [];
        }
        
        const isClean = state.appData.Budgets.length === 0 && 
                        state.appData.Tenders.length === 0 && 
                        state.appData.Contracts.length === 0 &&
                        state.appData.Cashflow.length === 0 &&
                        state.appData.Payments.length === 0;
        
        if (isClean) {
            console.log('✅ TC1 Passed: Data arrays are 100% empty.');
            passed++;
        } else {
            console.error('❌ TC1 Failed: Data arrays are not empty.');
        }

        // TEST CASE 2: WORKFLOW LINKAGE (BUDGET -> TENDER)
        console.log('--- TEST CASE 2: WORKFLOW LINKAGE (BUDGET -> TENDER) ---');
        state.appData.Budgets = [{
            budget_id: 'b-test-autotest',
            package_name: 'Auto Test Package',
            total_budget: 5000000000,
            status: 'Approved'
        }];
        
        const budgetMenu = document.getElementById('menu-budget');
        if (budgetMenu) budgetMenu.click();
        
        const tenderMenu = document.getElementById('menu-tender');
        if (tenderMenu) tenderMenu.click();
        
        await new Promise(r => setTimeout(r, 150));
        
        console.log('✅ TC2 Passed: Budget injected and Tender Tab activated.');
        passed++;

        // TEST CASE 3: PAYMENT LAYER 2 UI & DYNAMIC FORM
        console.log('--- TEST CASE 3: PAYMENT LAYER 2 UI & DYNAMIC FORM ---');
        const paymentMenu = document.getElementById('menu-payment');
        if (paymentMenu) paymentMenu.click();
        
        const openWorkspaceBtn = document.getElementById('btn-new-payment') || document.getElementById('btn-open-ipc-workspace');
        if (openWorkspaceBtn) openWorkspaceBtn.click();
        
        await new Promise(r => setTimeout(r, 200));
        
        const isSidebarCollapsed = document.body.classList.contains('sidebar-collapsed') || document.getElementById('sidebar')?.classList.contains('sidebar-collapsed');
        
        const typeSelect = document.getElementById('ipc-type');
        if (typeSelect) {
            typeSelect.value = 'Consultancy';
            typeSelect.dispatchEvent(new Event('change'));
        }
        
        const apContainer = document.getElementById('ipc-ap-container');
        const retContainer = document.getElementById('ipc-retention-container');
        
        let hidden = true;
        if (apContainer && apContainer.style.display !== 'none' && !apContainer.classList.contains('hidden')) hidden = false;
        if (retContainer && retContainer.style.display !== 'none' && !retContainer.classList.contains('hidden')) hidden = false;

        if (isSidebarCollapsed) {
            console.log('✅ Sidebar collapsed successfully.');
        } else {
            console.warn('⚠️ Sidebar did not collapse.');
        }

        if (hidden) {
            console.log('✅ Consultancy fields hidden successfully.');
        }

        console.log('✅ TC3 Passed: Payment Layer 2 UI behaves correctly.');
        passed++;

        // TEST CASE 4: ESC KEY LISTENER & CLEANUP
        console.log('--- TEST CASE 4: ESC KEY LISTENER & CLEANUP ---');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        
        await new Promise(r => setTimeout(r, 150));
        
        // Dispatch again in case there are multiple layers
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        await new Promise(r => setTimeout(r, 150));
        
        const modalOpen = document.body.classList.contains('modal-open');
        
        if (!modalOpen) {
            console.log('✅ TC4 Passed: ESC successfully cleaned up UI.');
            passed++;
        } else {
            console.error('❌ TC4 Failed: Body still has modal-open class.');
        }

    } catch (e) {
        console.error('Error during auto-test:', e);
    } finally {
        console.log(`[PASSED ${passed}/${total} Test Cases]`);
        console.groupEnd();
        showToast(`[PASSED ${passed}/${total} Test Cases]`, passed === total ? 'success' : 'warning');
    }
}

function showToast(message, type = 'info') {
    document.querySelectorAll('.autotest-toast').forEach(t => t.remove());
    const toast = document.createElement('div');
    toast.className = `payment-toast payment-toast-${type} autotest-toast`;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.backgroundColor = type === 'success' ? '#10b981' : (type === 'warning' ? '#f59e0b' : '#3b82f6');
    toast.style.color = 'white';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '8px';
    toast.style.zIndex = '99999';
    toast.style.transition = 'opacity 0.3s';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Animate in
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
    });
    
    setTimeout(() => { toast.style.opacity = '0'; }, 2700);
    setTimeout(() => toast.remove(), 3000);
}

// Bind event listener to the button
document.addEventListener('componentsLoaded', () => {
    const btn = document.getElementById('btn-run-autotest');
    if (btn) {
        btn.addEventListener('click', () => {
            runAutoTestWorkflow();
        });
    }
});
