import { state, formatCurrency } from '../app.js';
import { getLocalContracts } from './contract-state.js';

export function toggleDynamicFields(type) {
    const dynamicFields = document.getElementById('contract-dynamic-fields');
    if (!dynamicFields) return;
    
    if (type === 'Construction') {
        dynamicFields.style.display = 'contents'; 
    } else {
        dynamicFields.style.display = 'none'; 
        document.getElementById('contract-ap-recovery-input').value = '';
        document.getElementById('contract-retention-percent-input').value = '';
        document.getElementById('contract-max-retention-input').value = '';
        document.getElementById('contract-ld-input').value = '';
    }
}

let chartInstances = [];

export function renderContracts() {
    const projectId = state.currentProjectId;
    if (!projectId) return;

    const contracts = getLocalContracts().filter(c => c.project_id === projectId);

    // Calculate KPIs
    let totalBudget = 0;
    let totalCommitted = 0;
    let consultancyBudget = 0;
    let consultancyCommitted = 0;
    let constructionBudget = 0;
    let constructionCommitted = 0;

    contracts.forEach(c => {
        const budget = Number(c.budget_value) || 0;
        const committed = Number(c.total_value) || 0;
        
        totalBudget += budget;
        totalCommitted += committed;
        
        if (c.type === 'Consultancy') {
            consultancyBudget += budget;
            consultancyCommitted += committed;
        } else {
            constructionBudget += budget;
            constructionCommitted += committed;
        }
    });

    const variance = totalBudget - totalCommitted;
    const awardedRate = totalBudget > 0 ? ((totalCommitted / totalBudget) * 100).toFixed(1) : 0;

    // Update KPI DOM
    document.getElementById('contract-kpi-budget').textContent = formatCurrency(totalBudget);
    document.getElementById('contract-kpi-committed').textContent = formatCurrency(totalCommitted);
    
    const varianceEl = document.getElementById('contract-kpi-variance');
    varianceEl.textContent = formatCurrency(Math.abs(variance));
    if (variance < 0) {
        varianceEl.style.color = '#ef4444'; // Red for negative savings
        varianceEl.textContent = '-' + varianceEl.textContent;
    } else {
        varianceEl.style.color = '#3b82f6'; // Blue for positive savings
    }
    
    document.getElementById('contract-kpi-awarded-rate').textContent = `${awardedRate}%`;

    // Render Charts
    chartInstances.forEach(c => c.destroy());
    chartInstances = [];

    // Chart 1: Grouped Bar Chart
    const barOptions = {
        series: [{
            name: 'Budget',
            data: [consultancyBudget / 1e9, constructionBudget / 1e9]
        }, {
            name: 'Actual Contract',
            data: [consultancyCommitted / 1e9, constructionCommitted / 1e9]
        }],
        chart: { type: 'bar', height: 350, toolbar: { show: false } },
        colors: ['#cbd5e1', '#3b82f6'],
        plotOptions: { bar: { horizontal: false, columnWidth: '50%', endingShape: 'rounded' } },
        dataLabels: { enabled: false },
        stroke: { show: true, width: 2, colors: ['transparent'] },
        xaxis: { categories: ['Tư vấn (Consultancy)', 'Thi công (Construction)'] },
        yaxis: { labels: { formatter: (val) => val.toFixed(1) + ' Tỷ' } },
        fill: { opacity: 1 },
        tooltip: {
            y: { formatter: function (val) { return formatCurrency(val * 1e9); } }
        }
    };
    chartInstances.push(new ApexCharts(document.querySelector("#contract-chart-bar"), barOptions));

    // Chart 2: Doughnut Chart
    const pieOptions = {
        series: [consultancyCommitted, constructionCommitted],
        chart: { type: 'donut', height: 350 },
        labels: ['Tư vấn (Consultancy)', 'Thi công (Construction)'],
        colors: ['#a855f7', '#3b82f6'],
        dataLabels: { enabled: true, formatter: function (val, opts) { return opts.w.globals.seriesTotals[opts.seriesIndex] > 0 ? val.toFixed(1) + "%" : "" } },
        legend: { position: 'bottom' },
        tooltip: {
            y: { formatter: function (val) { return formatCurrency(val); } }
        }
    };
    chartInstances.push(new ApexCharts(document.querySelector("#contract-chart-pie"), pieOptions));

    chartInstances.forEach(c => c.render());
}

export function renderContractTableModal() {
    const tbodyConsultancy = document.getElementById('contract-tbody-consultancy');
    const tbodyConstruction = document.getElementById('contract-tbody-construction');
    if (!tbodyConsultancy || !tbodyConstruction) return;

    tbodyConsultancy.innerHTML = '';
    tbodyConstruction.innerHTML = '';
    
    const projectId = state.currentProjectId;
    if (!projectId) return;

    const contracts = getLocalContracts().filter(c => c.project_id === projectId);
    
    if (contracts.length === 0) {
        tbodyConstruction.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:2rem; color:var(--text-muted);">Không có Hợp đồng nào.</td></tr>`;
        document.getElementById('contract-list-modal').classList.remove('hidden');
        return;
    }

    const createRow = (contract) => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        
        let statusClass = '';
        let statusText = contract.status || 'Active';
        if (statusText === 'Active') {
            statusClass = 'text-green';
            statusText = 'Đang thực hiện';
        } else if (statusText === 'Closed') {
            statusClass = 'text-muted';
            statusText = 'Đã đóng';
        } else {
            statusClass = 'text-orange';
            statusText = 'Nháp';
        }

        const typeStr = contract.type === 'Consultancy' ? 'Tư vấn' : 'Thi công';
        const budget = Number(contract.budget_value) || 0;
        const total = Number(contract.total_value) || 0;
        const savings = budget - total;

        let savingsHtml = formatCurrency(Math.abs(savings));
        if (savings < 0) {
            savingsHtml = `<span style="color: var(--danger-color);">- ${savingsHtml}</span>`;
        } else if (savings > 0) {
            savingsHtml = `<span style="color: var(--primary-blue);">${savingsHtml}</span>`;
        } else {
            savingsHtml = `<span style="color: var(--text-muted);">0 VNĐ</span>`;
        }

        tr.innerHTML = `
            <td style="font-weight: 500;">${contract.budget_code || '-'}</td>
            <td style="font-weight: 500; color: var(--primary-blue);">${contract.contract_code || '-'}</td>
            <td><span class="badge ${contract.type === 'Consultancy' ? 'bg-purple' : 'bg-blue'}" style="padding:4px 8px; border-radius:4px; font-size:0.8rem; background:${contract.type === 'Consultancy' ? '#e9d5ff; color:#6b21a8;' : '#dbeafe; color:#1e40af;'}">${typeStr}</span></td>
            <td>${contract.package_name || '-'}</td>
            <td>${contract.contractor || '-'}</td>
            <td style="font-weight: 600;">${formatCurrency(budget)}</td>
            <td style="font-weight: 600;">${formatCurrency(total)}</td>
            <td style="font-weight: 600;">${savingsHtml}</td>
            <td class="${statusClass}"><i class="fa-solid fa-circle" style="font-size: 0.5rem; margin-right: 4px;"></i>${statusText}</td>
            <td style="text-align: center;"><input type="checkbox" class="contract-cb" data-id="${contract.contract_id}"></td>
        `;
        
        tr.addEventListener('click', (e) => {
            if (e.target.classList.contains('contract-cb')) return;
            openContractModal(contract);
        });
        return tr;
    };

    const consultancies = contracts.filter(c => c.type === 'Consultancy');
    const constructions = contracts.filter(c => c.type !== 'Consultancy');

    if (consultancies.length > 0) {
        const headerTR = document.createElement('tr');
        headerTR.innerHTML = `<td colspan="10" style="background-color: #f1f5f9; font-weight: bold; padding: 0.75rem;">I. Gói thầu Tư vấn</td>`;
        tbodyConsultancy.appendChild(headerTR);
        consultancies.forEach(c => tbodyConsultancy.appendChild(createRow(c)));
    }
    
    if (constructions.length > 0) {
        const headerTR = document.createElement('tr');
        headerTR.innerHTML = `<td colspan="10" style="background-color: #f1f5f9; font-weight: bold; padding: 0.75rem;">II. Gói thầu Xây dựng</td>`;
        tbodyConstruction.appendChild(headerTR);
        constructions.forEach(c => tbodyConstruction.appendChild(createRow(c)));
    }

    const checkboxes = document.querySelectorAll('.contract-cb');
    checkboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            const anyChecked = Array.from(checkboxes).some(c => c.checked);
            const allChecked = Array.from(checkboxes).every(c => c.checked);
            const bulkBtn = document.getElementById('btn-bulk-delete-contract');
            const cbSelectAll = document.getElementById('cb-select-all-contracts');
            
            if (cbSelectAll) cbSelectAll.checked = allChecked;
            
            if (bulkBtn) {
                if (anyChecked) bulkBtn.classList.remove('hidden');
                else bulkBtn.classList.add('hidden');
            }
        });
    });

    document.getElementById('contract-list-modal').classList.remove('hidden');
}

export function openContractModal(contract = null) {
    const modal = document.getElementById('contract-detail-modal');
    const form = document.getElementById('contract-form');
    const deleteBtn = document.getElementById('btn-delete-contract');
    
    form.reset();
    
    if (contract) {
        document.getElementById('contract-modal-title').textContent = `Sửa Hợp đồng: ${contract.contract_code}`;
        document.getElementById('contract-id-hidden').value = contract.contract_id || '';
        
        document.getElementById('contract-code-input').value = contract.contract_code || '';
        document.getElementById('contract-type-select').value = contract.type || 'Construction';
        document.getElementById('contract-name-input').value = contract.package_name || '';
        document.getElementById('contract-contractor-input').value = contract.contractor || '';
        
        if (contract.contract_date) {
            const dt = new Date(contract.contract_date);
            if (!isNaN(dt.getTime())) {
                document.getElementById('contract-date-input').value = dt.toISOString().split('T')[0];
            }
        }
        
        document.getElementById('contract-status-input').value = contract.status || 'Active';
        document.getElementById('contract-budget-input').value = contract.budget_value || '';
        document.getElementById('contract-value-input').value = contract.total_value || '';
        document.getElementById('contract-attachment-input').value = contract.attachment_url || '';
        
        document.getElementById('contract-adv-percent-input').value = contract.advance_payment_percent || '';
        document.getElementById('contract-ap-recovery-input').value = contract.ap_recovery_percent || '';
        document.getElementById('contract-retention-percent-input').value = contract.retention_percent || '';
        document.getElementById('contract-max-retention-input').value = contract.max_retention_percent || '';
        document.getElementById('contract-ld-input').value = contract.liquidated_damages || '';
        document.getElementById('contract-scope-input').value = contract.scope_of_work || '';
        
        deleteBtn.classList.remove('hidden');
        toggleDynamicFields(contract.type || 'Construction');
    } else {
        document.getElementById('contract-modal-title').textContent = `Thêm mới Hợp đồng`;
        document.getElementById('contract-id-hidden').value = '';
        deleteBtn.classList.add('hidden');
        toggleDynamicFields('Construction'); 
    }
    
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
}

export function closeContractDetailModal() {
    const modal = document.getElementById('contract-detail-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
    // Remove modal-open only if no other list modal is visible
    const anyVisible = document.querySelector(
        '#contract-list-modal:not(.hidden), #tender-list-modal:not(.hidden), #budget-list-modal:not(.hidden), #tender-detail-modal:not(.hidden)'
    );
    if (!anyVisible) document.body.classList.remove('modal-open');
}
