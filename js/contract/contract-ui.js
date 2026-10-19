import { getContractValue, getContractName, getContractorName } from '../core/contract-fields.js';
import { setTone } from '../utils/formatters.js';
import { escapeHtml } from '../utils/formatters.js';
import { state, formatCurrency, formatCurrencyVND, getContractBudgetValue, getDynamicContractValue } from '../app.js';
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
    try {
        const projectId = state.currentProjectId;
        if (!projectId) return;

        // Ensure Contracts array exists
        if (!state.appData.Contracts) {
            state.appData.Contracts = [];
        }

        const contracts = getLocalContracts().filter(c => c.project_id === projectId);

        // Calculate KPIs
        let totalBudget = 0;
        let totalCommitted = 0;
        let consultancyBudget = 0;
        let consultancyCommitted = 0;
        let constructionBudget = 0;
        let constructionCommitted = 0;

        if (state.appData.Budgets) {
            const projectBudgets = state.appData.Budgets.filter(b => b.project_id === projectId);
            projectBudgets.forEach(b => {
                const bVal = Number(b.budgeted) || 0;
                totalBudget += bVal;
                if (b.category === 'Consultancy') {
                    consultancyBudget += bVal;
                } else if (b.category === 'Construction') {
                    constructionBudget += bVal;
                }
            });
        }

        contracts.forEach(c => {
            const status = c.status || 'Đang thực hiện';
            if (status !== 'Đang thực hiện' && status !== 'Active') return;
            const committed = getDynamicContractValue(c, state.appData);
            
            totalCommitted += committed;
            
            if (c.type === 'Consultancy') {
                consultancyCommitted += committed;
            } else {
                constructionCommitted += committed;
            }
        });

        const variance = totalBudget - totalCommitted;
        const awardedRate = totalBudget > 0 ? ((totalCommitted / totalBudget) * 100).toFixed(1) : 0;

        // Update KPI DOM safely
        const elBudget = document.getElementById('contract-kpi-budget');
        const elCommitted = document.getElementById('contract-kpi-committed');
        const varianceEl = document.getElementById('contract-kpi-variance');
        const elAwardedRate = document.getElementById('contract-kpi-awarded-rate');

        if (elBudget) elBudget.innerHTML = `${formatCurrencyVND(totalBudget)} <span>VNĐ</span>`;
        if (elCommitted) elCommitted.innerHTML = `${formatCurrencyVND(totalCommitted)} <span>VNĐ</span>`;
        
        if (varianceEl) {
            varianceEl.innerHTML = `${formatCurrencyVND(Math.abs(variance))} <span>VNĐ</span>`;
            if (variance < 0) varianceEl.innerHTML = `-${formatCurrencyVND(Math.abs(variance))} <span>VNĐ</span>`;
            setTone(varianceEl, variance, { positive: true });
        }
        
        if (elAwardedRate) elAwardedRate.textContent = `${awardedRate}%`;

        // Safe Chart Initialization
        chartInstances.forEach(c => {
            if (c && typeof c.destroy === 'function') c.destroy();
        });
        chartInstances = [];

        // Chart 1: Grouped Bar Chart
        const barEl = document.querySelector("#contract-chart-bar");
        if (barEl) {
            const barOptions = {
                series: [{
                    name: 'Ngân sách',
                    data: [consultancyBudget / 1e9, constructionBudget / 1e9]
                }, {
                    name: 'Giá trị HĐ',
                    data: [consultancyCommitted / 1e9, constructionCommitted / 1e9]
                }],
                chart: { type: 'bar', height: 350, toolbar: { show: false } },
                colors: ['plan', 'approved'],
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
            chartInstances.push(new ApexCharts(barEl, barOptions));
        }

        // Chart 2: Doughnut Chart
        const pieEl = document.querySelector("#contract-chart-pie");
        if (pieEl) {
            const pieOptions = {
                series: [consultancyCommitted, constructionCommitted],
                chart: { type: 'donut', height: 350 },
                labels: ['Tư vấn', 'Thi công'],
                colors: ['soft', 'hard'],
                dataLabels: { enabled: true, formatter: function (val, opts) { return opts.w.globals.seriesTotals[opts.seriesIndex] > 0 ? val.toFixed(1) + "%" : "" } },
                legend: { position: 'bottom' },
                tooltip: {
                    y: { formatter: function (val) { return formatCurrency(val); } }
                }
            };
            chartInstances.push(new ApexCharts(pieEl, pieOptions));
        }

        chartInstances.forEach(c => c.render());

        // Render Summary Table
        const tbody = document.getElementById('contract-summary-tbody');
        if (tbody) {
            tbody.innerHTML = '';
            if (contracts.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:1rem; color:var(--text-muted);">Không có Hợp đồng nào.</td></tr>`;
            } else {
                contracts.forEach(c => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td style="padding: 0.75rem; border-bottom: 1px solid var(--border-color);">${escapeHtml(getContractName(c) || '-')}</td>
                        <td style="padding: 0.75rem; border-bottom: 1px solid var(--border-color);">${escapeHtml(getContractorName(c) || '-')}</td>
                        <td style="text-align: right; padding: 0.75rem; border-bottom: 1px solid var(--border-color); font-weight: 500;">${formatCurrency(getContractValue(c))}</td>
                        <td style="text-align: center; padding: 0.75rem; border-bottom: 1px solid var(--border-color);">${isConsultancyContract(c) ? 'Tư vấn' : 'Thi công'}</td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        }
    } catch (error) {
        console.error('[renderContracts] Exception occurred:', error);
    }
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
        const budget = getContractBudgetValue(contract, state.appData);
        const contractVal = getDynamicContractValue(contract, state.appData);
        const savings = budget - contractVal;

        let savingsHtml = formatCurrency(Math.abs(savings));
        if (!budget) {
            // Chưa gắn ngân sách → không có cơ sở so sánh (trước hiện "−toàn bộ giá trị" màu đỏ)
            savingsHtml = `<span style="color: var(--text-muted);" title="Hợp đồng chưa gắn mục ngân sách">—</span>`;
        } else if (savings < 0) {
            savingsHtml = `<span style="color: var(--danger-color);">- ${savingsHtml}</span>`;
        } else if (savings > 0) {
            savingsHtml = `<span style="color: var(--primary-blue);">${savingsHtml}</span>`;
        } else {
            savingsHtml = `<span style="color: var(--text-muted);">0 VNĐ</span>`;
        }

        tr.innerHTML = `
            <td style="font-weight: 500;">${escapeHtml(contract.budget_code || '-')}</td>
            <td style="font-weight: 500; color: var(--primary-blue);">${escapeHtml(contract.contract_code || '-')}</td>
            <td><span class="badge ${contract.type === 'Consultancy' ? 'bg-purple' : 'bg-blue'}" style="padding:4px 8px; border-radius:4px; font-size:0.8rem; background:${contract.type === 'Consultancy' ? 'var(--accent-violet-soft); color:var(--accent-violet);' : 'var(--accent-blue-soft); color:var(--accent-blue);'}">${typeStr}</span></td>
            <td>${escapeHtml(contract.package_name || '-')}</td>
            <td>${escapeHtml(contract.contractor || '-')}</td>
            <td style="font-weight: 600;">${budget ? formatCurrency(budget) : '<span style="color: var(--text-muted);">—</span>'}</td>
            <td style="font-weight: 600;">${formatCurrency(contractVal)}</td>
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
        headerTR.innerHTML = `<td colspan="10" style="background-color: var(--bg-table-header); font-weight: bold; padding: 0.75rem;">I. Gói thầu Tư vấn</td>`;
        tbodyConsultancy.appendChild(headerTR);
        consultancies.forEach(c => tbodyConsultancy.appendChild(createRow(c)));
    }
    
    if (constructions.length > 0) {
        const headerTR = document.createElement('tr');
        headerTR.innerHTML = `<td colspan="10" style="background-color: var(--bg-table-header); font-weight: bold; padding: 0.75rem;">II. Gói thầu Xây dựng</td>`;
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
        document.getElementById('contract-budget-input').value = getContractBudgetValue(contract, state.appData) || '';
        document.getElementById('contract-value-input').value = getDynamicContractValue(contract, state.appData) || '';
        document.getElementById('contract-attachment-input').value = contract.attachment_url || '';
        
        document.getElementById('contract-adv-percent-input').value = contract.advance_payment_percent || '';
        document.getElementById('contract-ap-recovery-input').value = contract.ap_recovery_percent || '';
        document.getElementById('contract-retention-percent-input').value = contract.retention_percent || '';
        document.getElementById('contract-max-retention-input').value = contract.max_retention_percent || '';
        const setSel = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
        setSel('contract-ap-basis-input', contract.ap_recovery_basis || 'work_done');
        setSel('contract-retention-basis-input', contract.retention_basis || 'gross');
        setSel('contract-vat-input', contract.vat_percent ?? 8);
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
    
    window.openInlineWorkspace('contract-detail-modal');
}

export function closeContractDetailModal() {
    window.openInlineWorkspace('contract-list-modal');
}
