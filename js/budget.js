import { state, formatCurrency, formatDate, mockActivities } from './app.js';
import { renderTenders } from './tender.js';
import { saveProject, saveBudget } from './api.js';
import { renderContracts } from './contract.js';
import { renderCashflow } from './cashflow.js';

export function renderProjectTabs() {
    const container = document.getElementById('project-tabs-container');
    if (!container) return;
    container.innerHTML = '';
    
    state.appData.Projects.forEach(project => {
        const btn = document.createElement('button');
        btn.className = `project-tab ${project.project_id === state.currentProjectId ? 'active' : ''}`;
        btn.textContent = `[${project.project_name}]`;
        btn.onclick = () => {
            state.currentProjectId = project.project_id;
            renderProjectTabs();
            renderDashboard();
            renderContracts();
            
            // Check if Cashflow tab is active, if so, re-render it
            const menuCashflow = document.getElementById('menu-cashflow');
            if (menuCashflow && menuCashflow.classList.contains('active')) {
                renderCashflow();
            }
        };
        container.appendChild(btn);
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'project-tab';
    addBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Thêm dự án';
    addBtn.onclick = () => {
        document.getElementById('new-project-form').reset();
        document.getElementById('new-project-modal').classList.remove('hidden');
    };
    container.appendChild(addBtn);
}

export function renderDashboard() {
    if (!state.appData || !state.currentProjectId) return;

    const project = state.appData.Projects.find(p => p.project_id === state.currentProjectId);
    if (!project) return;

    document.getElementById('project-name').innerHTML = `${project.project_name} <i class="fa-solid fa-circle-info" style="color: var(--primary-blue); font-size: 1.2rem;"></i>`;
    
    const metaElement = document.querySelector('.project-meta');
    if (metaElement) {
        const start = project.start_date ? new Date(project.start_date).toLocaleDateString('en-GB') : '1 January 2024';
        const end = project.end_date ? new Date(project.end_date).toLocaleDateString('en-GB') : '1 December 2024';
        const loc = project.location || 'Belgrade, Serbia';
        metaElement.textContent = `${start} - ${end} • ${loc}`;
    }
    
    const totalBudget = project.total_budget + project.contingency_budget;
    document.getElementById('metric-total-budget').textContent = formatCurrency(totalBudget);
    
    let allocatedBudget = 0;
    // Tạm thời clear khu vực budget theo yêu cầu của user
    const projectContracts = []; // state.appData.Contracts.filter(c => c.project_id === state.currentProjectId);

    projectContracts.forEach(contract => {
        allocatedBudget += (contract.total_value || contract.original_value || 0);
        const variations = state.appData.Variations.filter(v => v.contract_id === contract.contract_id && v.status === 'Approved');
        variations.forEach(v => allocatedBudget += v.vo_amount);
    });
    document.getElementById('metric-allocated').textContent = formatCurrency(allocatedBudget);
    
    document.getElementById('metric-contingency').textContent = formatCurrency(project.contingency_budget) + ' - 10%';
    
    let totalPayments = 0;
    state.appData.Payment_Claims.forEach(claim => {
        if (claim.status === 'Approved' && projectContracts.some(c => c.contract_id === claim.contract_id)) {
            totalPayments += claim.claimed_amount;
        }
    });
    document.getElementById('metric-payments').textContent = formatCurrency(totalPayments);
    
    document.getElementById('metric-projected').textContent = formatCurrency(totalBudget - project.contingency_budget + totalPayments);

    const tbody = document.getElementById('breakdown-tbody');
    tbody.innerHTML = ''; 
    projectContracts.forEach(contract => {
        let expended = 0;
        state.appData.Payment_Claims.filter(p => p.contract_id === contract.contract_id && p.status === 'Approved').forEach(p => {
            expended += p.claimed_amount;
        });
        
        const budgeted = contract.budget_value || contract.original_value || 0;
        const committed = contract.total_value || contract.original_value || 0; 
        const varianceVal = budgeted - committed - expended;
        const progress = committed > 0 ? (expended / committed) * 100 : 0;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${contract.package_name || contract.contract_name || 'Unnamed Package'}</td>
            <td>${formatCurrency(budgeted)}</td>
            <td>${formatCurrency(committed)}</td>
            <td>${formatCurrency(expended)}</td>
            <td class="${varianceVal < 0 ? 'negative' : ''}">${varianceVal < 0 ? '-' : ''}${formatCurrency(Math.abs(varianceVal))}</td>
            <td>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress}%"></div>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    const trTotal = document.createElement('tr');
    const totalVariance = totalBudget - allocatedBudget - totalPayments;
    trTotal.innerHTML = `
        <td><strong>Total</strong></td>
        <td><strong>${formatCurrency(totalBudget)}</strong></td>
        <td><strong>${formatCurrency(allocatedBudget)}</strong></td>
        <td><strong>${formatCurrency(totalPayments)}</strong></td>
        <td class="${totalVariance < 0 ? 'negative' : ''}"><strong>${totalVariance < 0 ? '-' : ''}${formatCurrency(Math.abs(totalVariance))}</strong></td>
        <td></td>
    `;
    tbody.appendChild(trTotal);

    const docsGrid = document.getElementById('documents-grid');
    const uploader = docsGrid.querySelector('.document-upload');
    if (docsGrid) {
        docsGrid.innerHTML = '';
        state.appData.Documents.filter(d => projectContracts.some(c => c.contract_id === d.related_id)).forEach(doc => {
            const isPdf = doc.file_name.endsWith('.pdf');
            const docCard = document.createElement('div');
            docCard.className = 'doc-card';
            docCard.innerHTML = `
                <div class="doc-icon ${isPdf ? 'pdf' : 'excel'}">
                    <i class="fa-regular ${isPdf ? 'fa-file-pdf' : 'fa-file-excel'}"></i>
                </div>
                <div class="doc-info">
                    <h5>${doc.file_name}</h5>
                    <span>2MB - ${isPdf ? 'PDF' : 'DOC'}</span>
                </div>
            `;
            docsGrid.appendChild(docCard);
        });
        if (uploader) docsGrid.appendChild(uploader);
    }

    renderActivities();
    renderTenders();
}

function renderActivities() {
    const timeline = document.getElementById('activities-timeline');
    if(!timeline) return;
    timeline.innerHTML = '';
    mockActivities.forEach(act => {
        const div = document.createElement('div');
        div.className = 'activity-item';
        div.innerHTML = `
            <div class="activity-dot"></div>
            <div class="activity-content">
                <p><strong>${act.text}</strong></p>
                <span>${formatDate(act.date)}</span>
            </div>
        `;
        timeline.appendChild(div);
    });
}

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
            text: `Payment Claim Approved: $${amount.toLocaleString()} for ${contractName}`,
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
            package_name: categoryName, // Use package_name for new format
            contract_name: categoryName, // Keep for fallback
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
            text: `New Budget Entry added: ${categoryName} for $${amount.toLocaleString()}`,
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
