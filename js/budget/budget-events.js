import { state, mockActivities } from '../app.js';
import { saveProject, saveBudget } from '../api.js';
import { renderProjectTabs, renderDashboard } from './budget-ui.js';

export function setupBudgetEvents() {
    const paymentModal = document.getElementById('payment-modal');
    const newEntryModal = document.getElementById('new-entry-modal');
    
    document.getElementById('btn-initiate-payment').addEventListener('click', () => {
        const select = document.getElementById('contract-select');
        select.innerHTML = '';
        state.appData.Contracts.filter(c => c.project_id === state.currentProjectId).forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.contract_id;
            opt.textContent = c.contract_name;
            select.appendChild(opt);
        });
        document.getElementById('payment-amount').value = '';
        paymentModal.classList.remove('hidden');
    });
    
    document.getElementById('close-modal').addEventListener('click', () => paymentModal.classList.add('hidden'));
    document.getElementById('cancel-modal').addEventListener('click', () => paymentModal.classList.add('hidden'));
    
    document.getElementById('payment-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const contractId = document.getElementById('contract-select').value;
        const amount = parseFloat(document.getElementById('payment-amount').value);
        if (!amount || amount <= 0) return;
        
        state.appData.Payment_Claims.push({
            claim_id: "PC" + (state.appData.Payment_Claims.length + 1).toString().padStart(3, '0'),
            contract_id: contractId,
            period_number: 1, 
            claimed_amount: amount,
            advance_deduction: 0,
            retention_amount: 0,
            status: "Approved"
        });
        
        const contractName = state.appData.Contracts.find(c => c.contract_id === contractId)?.contract_name;
        mockActivities.unshift({
            text: `Payment Claim Approved: $\${amount.toLocaleString()} for \${contractName}`,
            date: new Date().toISOString()
        });
        
        await saveBudget({
            Contracts: state.appData.Contracts,
            Payment_Claims: state.appData.Payment_Claims,
            Variations: state.appData.Variations,
            Documents: state.appData.Documents
        });
        renderDashboard();
        paymentModal.classList.add('hidden');
    });

    document.getElementById('btn-new-entry').addEventListener('click', () => {
        document.getElementById('entry-category').value = '';
        document.getElementById('entry-amount').value = '';
        newEntryModal.classList.remove('hidden');
    });
    
    document.getElementById('close-entry-modal').addEventListener('click', () => newEntryModal.classList.add('hidden'));
    document.getElementById('cancel-entry-modal').addEventListener('click', () => newEntryModal.classList.add('hidden'));

    document.getElementById('new-entry-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const categoryName = document.getElementById('entry-category').value;
        const amount = parseFloat(document.getElementById('entry-amount').value);

        if (!categoryName || !amount || amount <= 0) return;

        const newContract = {
            contract_id: "C" + (state.appData.Contracts.length + 1).toString().padStart(3, '0'),
            project_id: state.currentProjectId,
            package_name: categoryName,
            contract_name: categoryName,
            contractor: "TBD",
            vendor_name: "TBD",
            budget_value: amount,
            total_value: amount,
            original_value: amount,
            advance_rate: 0,
            retention_rate: 0
        };

        state.appData.Contracts.push(newContract);

        mockActivities.unshift({
            text: `New Budget Entry added: \${categoryName} for $\${amount.toLocaleString()}`,
            date: new Date().toISOString()
        });

        await saveBudget({
            Contracts: state.appData.Contracts,
            Payment_Claims: state.appData.Payment_Claims,
            Variations: state.appData.Variations,
            Documents: state.appData.Documents
        });
        renderDashboard();
        newEntryModal.classList.add('hidden');
    });

    const newProjectModal = document.getElementById('new-project-modal');
    if (newProjectModal) {
        document.getElementById('close-project-modal').addEventListener('click', () => newProjectModal.classList.add('hidden'));
        document.getElementById('cancel-project-modal').addEventListener('click', () => newProjectModal.classList.add('hidden'));

        document.getElementById('new-project-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('proj-name').value;
            const location = document.getElementById('proj-location').value;
            const start = document.getElementById('proj-start').value;
            const end = document.getElementById('proj-end').value;
            const budget = parseFloat(document.getElementById('proj-budget').value);
            const contingency = parseFloat(document.getElementById('proj-contingency').value);
            
            const newId = "P" + (state.appData.Projects.length + 1).toString().padStart(3, '0');
            
            const newProject = {
                project_id: newId,
                project_name: name,
                location: location,
                start_date: start,
                end_date: end,
                total_budget: budget,
                contingency_budget: contingency
            };
            
            const success = await saveProject(newProject);
            if (success) {
                state.appData.Projects.push(newProject);
                state.currentProjectId = newId;
                renderProjectTabs();
                renderDashboard();
                newProjectModal.classList.add('hidden');
            } else {
                console.error("Lỗi khi thêm dự án");
            }
        });
    }
}
