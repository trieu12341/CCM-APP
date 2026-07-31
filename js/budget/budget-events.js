import { state, mockActivities } from '../app.js';
import { saveProject, saveBudget, saveTender } from '../api.js';
import { renderProjectTabs, renderDashboard, renderBudgetTableModal } from './budget-ui.js';
import { renderTenders } from '../tender.js';

// Utility: safely bind an event listener, skipping if element not found
function bindEvent(id, event, handler) {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener(event, handler);
    } else {
        console.warn(`[budget-events] Element #${id} not found — skipping event binding.`);
    }
}

export function setupBudgetEvents() {
    // --- Workflow 4 Reconcile: Refresh Budget UI when any tab changes state ---
    document.addEventListener('dashboardStateChanged', () => {
        try { renderDashboard(); } catch(e) { console.error('renderDashboard error:', e); }
        try { renderBudgetTableModal(); } catch(e) { /* Modal may not be open, ignore */ }
    });

    // --- Workflow 1: Create Tender from Budget line ---
    window.createTenderFromBudget = async (contract) => {
        const newTender = {
            tender_id: contract.contract_id,
            project_id: contract.project_id,
            tender_name: contract.package_name || contract.contract_name,
            type: contract.type,
            approved_budget: contract.budget_value || contract.original_value,
            status: 'Floating',
            deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            winner: ''
        };
        try {
            const success = await saveTender(newTender);
            if (success) {
                state.appData.Tenders.push(newTender);
                alert(`Đã tạo hồ sơ Đấu thầu cho gói: ${newTender.tender_name}`);
                renderBudgetTableModal();
                if (typeof renderTenders === 'function') renderTenders();
            } else {
                alert('Lỗi khi tạo gói thầu!');
            }
        } catch (e) {
            console.error('[createTenderFromBudget]', e);
            alert('Lỗi khi tạo gói thầu!');
        }
    };

    // --- Budget List Modal ---
    bindEvent('btn-open-budget-list', 'click', renderBudgetTableModal);
    bindEvent('close-budget-list-modal', 'click', () => {
        const modal = document.getElementById('budget-list-modal');
        if (modal) modal.classList.add('hidden');
    });

    // --- Payment Modal ---
    const paymentModal = document.getElementById('payment-modal');
    if (paymentModal) {
        bindEvent('btn-initiate-payment', 'click', () => {
            const select = document.getElementById('contract-select');
            if (!select) return;
            select.innerHTML = '';
            (state.appData.Contracts || [])
                .filter(c => c.project_id === state.currentProjectId)
                .forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.contract_id;
                    opt.textContent = c.contract_name;
                    select.appendChild(opt);
                });
            const amtEl = document.getElementById('payment-amount');
            if (amtEl) amtEl.value = '';
            paymentModal.classList.remove('hidden');
        });
        bindEvent('close-modal', 'click', () => paymentModal.classList.add('hidden'));
        bindEvent('cancel-modal', 'click', () => paymentModal.classList.add('hidden'));
        bindEvent('payment-form', 'submit', async (e) => {
            e.preventDefault();
            const contractId = document.getElementById('contract-select')?.value;
            const amount = parseFloat(document.getElementById('payment-amount')?.value);
            if (!amount || amount <= 0) return;
            state.appData.Payment_Claims.push({
                claim_id: 'PC' + (state.appData.Payment_Claims.length + 1).toString().padStart(3, '0'),
                contract_id: contractId,
                period_number: 1,
                claimed_amount: amount,
                advance_deduction: 0,
                retention_amount: 0,
                status: 'Approved'
            });
            const contractName = state.appData.Contracts.find(c => c.contract_id === contractId)?.contract_name;
            mockActivities.unshift({ text: `Payment Claim Approved: ${amount.toLocaleString()} VNĐ for ${contractName}`, date: new Date().toISOString() });
            await saveBudget({ Contracts: state.appData.Contracts, Payment_Claims: state.appData.Payment_Claims, Variations: state.appData.Variations, Documents: state.appData.Documents });
            renderDashboard();
            paymentModal.classList.add('hidden');
        });
    }

    // --- New Budget Entry Modal ---
    const newEntryModal = document.getElementById('new-entry-modal');
    if (newEntryModal) {
        bindEvent('btn-new-entry', 'click', () => {
            const catEl = document.getElementById('entry-category');
            const amtEl = document.getElementById('entry-amount');
            if (catEl) catEl.value = '';
            if (amtEl) amtEl.value = '';
            newEntryModal.classList.remove('hidden');
        });
        bindEvent('close-entry-modal', 'click', () => newEntryModal.classList.add('hidden'));
        bindEvent('cancel-entry-modal', 'click', () => newEntryModal.classList.add('hidden'));
        bindEvent('new-entry-form', 'submit', async (e) => {
            e.preventDefault();
            const categoryName = document.getElementById('entry-category')?.value;
            const amount = parseFloat(document.getElementById('entry-amount')?.value);
            if (!categoryName || !amount || amount <= 0) return;
            const newContract = {
                contract_id: 'C' + (state.appData.Contracts.length + 1).toString().padStart(3, '0'),
                project_id: state.currentProjectId,
                package_name: categoryName,
                contract_name: categoryName,
                contractor: 'TBD',
                vendor_name: 'TBD',
                budget_value: amount,
                total_value: amount,
                original_value: amount,
                advance_rate: 0,
                retention_rate: 0
            };
            state.appData.Contracts.push(newContract);
            mockActivities.unshift({ text: `New Budget Entry added: ${categoryName} for ${amount.toLocaleString()} VNĐ`, date: new Date().toISOString() });
            await saveBudget({ Contracts: state.appData.Contracts, Payment_Claims: state.appData.Payment_Claims, Variations: state.appData.Variations, Documents: state.appData.Documents });
            renderDashboard();
            newEntryModal.classList.add('hidden');
        });
    }

    // --- New Project Modal ---
    const newProjectModal = document.getElementById('new-project-modal');
    if (newProjectModal) {
        bindEvent('close-project-modal', 'click', () => newProjectModal.classList.add('hidden'));
        bindEvent('cancel-project-modal', 'click', () => newProjectModal.classList.add('hidden'));
        bindEvent('new-project-form', 'submit', async (e) => {
            e.preventDefault();
            const name       = document.getElementById('proj-name')?.value;
            const location   = document.getElementById('proj-location')?.value;
            const start      = document.getElementById('proj-start')?.value;
            const end        = document.getElementById('proj-end')?.value;
            const budget      = parseFloat(document.getElementById('proj-budget')?.value);
            const contingency = parseFloat(document.getElementById('proj-contingency')?.value);
            const newId = 'P' + (state.appData.Projects.length + 1).toString().padStart(3, '0');
            const newProject = { project_id: newId, project_name: name, location, start_date: start, end_date: end, total_budget: budget, contingency_budget: contingency };
            const success = await saveProject(newProject);
            if (success) {
                state.appData.Projects.push(newProject);
                state.currentProjectId = newId;
                renderProjectTabs();
                renderDashboard();
                newProjectModal.classList.add('hidden');
            } else {
                console.error('Lỗi khi thêm dự án');
            }
        });
    }
}
