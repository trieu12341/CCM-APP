import { state, formatCurrency } from './app.js';
import { saveCashflow } from './api.js';

let chartInstances = [];

export function setupCashflowEvents() {
    const btnToDetail = document.getElementById('btn-cashflow-detail');
    const modal = document.getElementById('cashflow-detail-modal');
    const closeBtn = document.getElementById('close-cashflow-modal');
    const cancelBtn = document.getElementById('btn-cancel-cashflow');
    const addRowBtn = document.getElementById('btn-add-cashflow-row');
    const addReleaseBtn = document.getElementById('btn-add-release');
    const saveBtn = document.getElementById('btn-save-cashflow');
    const periodSelect = document.getElementById('cf-period-select');
    const importBtn = document.getElementById('btn-cf-import-excel');
    const importFile = document.getElementById('excel-import');

    const filterContract = document.getElementById('cf-filter-contract');

    // Fullscreen buttons
    document.querySelectorAll('.btn-fullscreen').forEach(btn => {
        // Remove existing listeners if any (by replacing the node)
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', (e) => {
            const card = e.currentTarget.closest('.cf-chart-card');
            card.classList.toggle('fullscreen-mode');
            const icon = e.currentTarget.querySelector('i');
            if (card.classList.contains('fullscreen-mode')) {
                icon.classList.remove('fa-expand');
                icon.classList.add('fa-compress');
            } else {
                icon.classList.add('fa-expand');
                icon.classList.remove('fa-compress');
            }
            setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
        });
    });

    if (btnToDetail) {
        btnToDetail.addEventListener('click', () => {
            if (filterContract) {
                filterContract.innerHTML = getContractOptions();
            }
            modal.classList.remove('hidden');
            crossCheckValidation();
            renderCashflowTable();
        });
    }

    if (filterContract) {
        filterContract.addEventListener('change', () => {
            renderCashflowTable();
        });
    }

    const closeFn = () => modal.classList.add('hidden');
    if (closeBtn) closeBtn.addEventListener('click', closeFn);
    if (cancelBtn) cancelBtn.addEventListener('click', closeFn);

    const searchInput = document.getElementById('cf-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderCashflowTable();
        });
    }

    const closeCfImportBtn = document.getElementById('close-cf-import-modal');
    const cancelCfImportBtn = document.getElementById('btn-cancel-cf-import');
    const saveCfImportBtn = document.getElementById('btn-save-cf-import');
    const importModal = document.getElementById('cashflow-import-modal');
    
    const closeImportFn = () => importModal.classList.add('hidden');
    if (closeCfImportBtn) closeCfImportBtn.addEventListener('click', closeImportFn);
    if (cancelCfImportBtn) cancelCfImportBtn.addEventListener('click', closeImportFn);
    if (saveCfImportBtn) saveCfImportBtn.addEventListener('click', saveImportedCashflow);

    if (addRowBtn) {
        addRowBtn.addEventListener('click', () => {
            addCashflowRow();
        });
    }

    if (addReleaseBtn) {
        addReleaseBtn.addEventListener('click', () => {
            const filterContract = document.getElementById('cf-filter-contract');
            const selectedContract = filterContract ? filterContract.value : '';
            if (!selectedContract) return;

            const tbody = document.getElementById('cashflow-tbody');
            const emptyMsg = tbody.querySelector('td[colspan="9"]');
            if (emptyMsg) tbody.innerHTML = '';
            
            // Check if Release 1 exists
            let cfs = getLocalCashflow().filter(c => c.project_id === state.currentProjectId && (c.package_name === selectedContract || c.contract === selectedContract));
            const hasRelease1 = cfs.some(c => c.is_release_retention_1 || c.code === 'TOC');
            
            const newItem = {
                id: 'cf-' + Date.now(),
                project_id: state.currentProjectId,
                package_name: selectedContract,
                contract: selectedContract,
                status: 'Planned',
                code: hasRelease1 ? 'DLC' : 'TOC',
                desc: hasRelease1 ? 'Release Retention 2 (DLC)' : 'Release Retention 1 (TOC)',
                is_release_retention_1: !hasRelease1,
                is_release_retention_2: hasRelease1,
                value: 0
            };
            
            let allData = getLocalCashflow();
            allData.push(newItem);
            saveLocalCashflow(allData);
            renderCashflowTable();
        });
    }
    
    if (importBtn && importFile) {
        const newImportBtn = importBtn.cloneNode(true);
        importBtn.parentNode.replaceChild(newImportBtn, importBtn);
        newImportBtn.addEventListener('click', () => {
            document.getElementById('excel-import').click();
        });
        
        const newImportFile = importFile.cloneNode(true);
        importFile.parentNode.replaceChild(newImportFile, importFile);
        newImportFile.addEventListener('change', handleExcelImport);
    }
    
    if (periodSelect) {
        periodSelect.addEventListener('change', () => {
            renderCashflow();
        });
    }

    const clearCashflowBtn = document.getElementById('btn-clear-cashflow');
    if (clearCashflowBtn) {
        clearCashflowBtn.addEventListener('click', () => {
            if (confirm('Bạn có chắc chắn muốn XÓA TOÀN BỘ dữ liệu Kế hoạch Dòng tiền của Dự án này không?')) {
                const projectId = state.currentProjectId;
                if (!projectId) return;
                
                let allData = getLocalCashflow();
                allData = allData.filter(c => c.project_id !== projectId);
                saveLocalCashflow(allData);
                
                renderCashflowTable();
                crossCheckValidation();
                alert('Đã xóa toàn bộ dữ liệu Cashflow của dự án này.');
            }
        });
    }
}

export function renderCashflow() {
    // Only render if we have a project selected
    if (!state.currentProjectId) return;
    
    // Clear old charts if they exist
    chartInstances.forEach(c => c.destroy());
    chartInstances = [];

    // 1. Read real data from state
    let contracts = state.appData.Contracts || [];
    
    let budget = 0;
    let revised = 0;
    contracts.filter(c => c.project_id === state.currentProjectId).forEach(c => {
        budget += (Number(c.budget_value) || 0);
        revised += (Number(c.total_value) || 0);
    });

    // 2. Read real data from vcre_cashflow
    let cashflows = getLocalCashflow();
    
    // Run Forecast Engine for Construction Contracts so that is_construction and total_cert are calculated
    const allContracts = state.appData.Contracts || [];
    const constructionPackages = allContracts.filter(c => c.project_id === state.currentProjectId && c.type === 'Construction');
    
    constructionPackages.forEach(contract => {
        const contractCashflows = cashflows.filter(c => c.package_name === contract.package_name && c.project_id === state.currentProjectId);
        if (contractCashflows.length > 0) {
            calculateForecastEngine(contractCashflows, contract);
        }
    });

    let totalCertified = 0;
    let totalPaid = 0;
    
    let monthlyData = {}; // For cumulative chart

    cashflows.filter(c => c.project_id === state.currentProjectId).forEach(c => {
        const val = c.is_construction ? (Number(c.total_cert) || 0) : (Number(c.value) || 0);
        
        if (c.status === 'Certified' || c.status === 'Paid') {
            totalCertified += val;
        }
        if (c.status === 'Paid') {
            totalPaid += val;
        }
        
        // Group Plan Amount by month (using c.date)
        if (c.date) {
            const parts = c.date.split('-');
            if (parts.length >= 2) {
                const monthKey = `${parts[0]}-${parts[1]}`; // YYYY-MM
                const displayKey = `${parts[1]}/${parts[0]}`; // MM/YYYY
                if (!monthlyData[monthKey]) {
                    monthlyData[monthKey] = { display: displayKey, plan: 0 };
                }
                monthlyData[monthKey].plan += val;
            }
        }
    });

    const kpiData = {
        budget: budget,
        revised: revised,
        certified: totalCertified,
        balance: budget - totalCertified,
        paid: totalPaid,
        pctPaid: revised > 0 ? ((totalPaid / revised) * 100).toFixed(1) : 0,
        pctCertified: revised > 0 ? ((totalCertified / revised) * 100).toFixed(1) : 0
    };

    document.getElementById('cf-kpi-budget').textContent = formatCurrency(kpiData.budget);
    document.getElementById('cf-kpi-revised').textContent = formatCurrency(kpiData.revised);
    document.getElementById('cf-kpi-certified').textContent = formatCurrency(kpiData.certified);
    document.getElementById('cf-kpi-balance').textContent = formatCurrency(kpiData.balance);
    document.getElementById('cf-kpi-paid').textContent = formatCurrency(kpiData.paid);
    document.getElementById('cf-kpi-pct-paid').textContent = kpiData.pctPaid + '%';
    document.getElementById('cf-kpi-pct-certified').textContent = kpiData.pctCertified + '%';

    // 1. Budget vs. Revised Total Contract (Bar Chart)
    const budgetB = budget > 0 ? budget / 1000000000 : 0;
    const revisedB = revised > 0 ? revised / 1000000000 : 0;

    var options1 = {
        series: [{ name: 'Project Budget', data: [budgetB] }, { name: 'Revised Total Contract', data: [revisedB] }],
        chart: { type: 'bar', height: 250, toolbar: { show: false } },
        colors: ['#3b82f6', '#f97316'],
        plotOptions: { bar: { horizontal: false, columnWidth: '40%' } },
        dataLabels: { enabled: false },
        xaxis: { categories: ['Total Value (Billion VNĐ)'] },
        yaxis: { labels: { formatter: (val) => val.toFixed(1) + 'B' } },
        tooltip: {
            y: { formatter: function (val) { return formatCurrency(val * 1000000000) + ' VNĐ' } }
        }
    };
    chartInstances.push(new ApexCharts(document.querySelector("#cf-chart-1"), options1));

    // Prepare cumulative data for Chart 3 & 4
    const sortedKeys = Object.keys(monthlyData).sort();
    let cumulativePlanData = [];
    let cumulativeLabels = [];
    let currentCumulative = 0;
    
    if (sortedKeys.length === 0) {
        // If no data, provide an empty chart rather than breaking
        cumulativeLabels = ['(No Data)'];
        cumulativePlanData = [0];
    } else {
        sortedKeys.forEach(k => {
            currentCumulative += monthlyData[k].plan;
            cumulativePlanData.push(currentCumulative / 1000000000); // in billions
            cumulativeLabels.push(monthlyData[k].display);
        });
    }
    
    // We can leave Chart 2 empty since we have no breakdown data
    var options2 = {
        series: [{ name: 'No Data', data: [0] }],
        chart: { type: 'bar', height: 250, stacked: true, toolbar: { show: false } },
        xaxis: { categories: ['-'] },
        yaxis: { labels: { formatter: (val) => val + 'B' } }
    };
    chartInstances.push(new ApexCharts(document.querySelector("#cf-chart-2"), options2));

    // 3. Certified to Date vs. Planned Certified (Combo Bar & Line)
    var options3 = {
        series: [{
            name: 'Planned Cumulative (Billion VNĐ)',
            type: 'line',
            data: cumulativePlanData
        }],
        chart: { 
            height: '100%', 
            type: 'line', 
            toolbar: { show: true, tools: { zoom: true, pan: true, reset: true, download: true } }
        },
        stroke: { width: [3], curve: 'smooth' },
        colors: ['#10b981'],
        xaxis: { categories: cumulativeLabels, tickAmount: Math.min(12, cumulativeLabels.length) },
        yaxis: { labels: { formatter: (val) => val.toFixed(1) + 'B' } },
        legend: { position: 'top' },
        tooltip: {
            y: { formatter: function (val) { return formatCurrency(val * 1000000000) + ' VNĐ' } }
        }
    };
    chartInstances.push(new ApexCharts(document.querySelector("#cf-chart-3"), options3));

    // 4. Paid vs. Planned Paid vs. Certified (Cumulative)
    var options4 = {
        series: [
            { name: 'Planned', data: cumulativePlanData }
        ],
        chart: { 
            type: 'line', 
            height: '100%', 
            toolbar: { show: true, tools: { zoom: true, pan: true, reset: true, download: true } } 
        },
        colors: ['#f97316'],
        stroke: { curve: 'smooth', width: 3 },
        xaxis: { categories: cumulativeLabels, tickAmount: Math.min(12, cumulativeLabels.length) },
        yaxis: { labels: { formatter: (val) => val.toFixed(1) + 'B' } },
        legend: { position: 'top' },
        tooltip: {
            y: { formatter: function (val) { return formatCurrency(val * 1000000000) + ' VNĐ' } }
        }
    };
    chartInstances.push(new ApexCharts(document.querySelector("#cf-chart-4"), options4));

    // Render all
    chartInstances.forEach(c => c.render());
}

// ----------------------------------------------------
// Detail Modal Logic
// ----------------------------------------------------
function getLocalCashflow() {
    return [...(state.appData.Cashflow || [])];
}

function saveLocalCashflow(data) {
    state.appData.Cashflow = data;
    saveCashflow(data).catch(err => console.error('Failed to save cashflow', err));
}

function getContractOptions(selectedVal = '') {
    let contracts = state.appData.Contracts || [];
    const projectId = state.currentProjectId;
    let html = `<option value="">-- Tất cả hợp đồng --</option>`;
    if (projectId) {
        contracts.filter(c => c.project_id === projectId).forEach(c => {
            // "Package name" is stored as package_name in vcre_contracts
            const pkgName = c.package_name || '';
            if (pkgName) {
                const sel = selectedVal === pkgName ? 'selected' : '';
                html += `<option value="${pkgName}" ${sel}>${pkgName}</option>`;
            }
        });
    }
    return html;
}

function formatNumberInput(e) {
    let input = e.target;
    let val = input.value.replace(/,/g, '');
    if (val === '') {
        input.value = '';
        updateCashflowSubtotal();
        return;
    }
    const num = parseFloat(val);
    if (!isNaN(num)) {
        input.value = num.toLocaleString('en-US');
    } else {
        input.value = '';
    }
    updateCashflowSubtotal();
}

function formatToMonthYear(dateString) {
    if (!dateString) return '-';
    const parts = dateString.split('-');
    if (parts.length >= 2) {
        return `${parts[1]}/${parts[0]}`;
    }
    return dateString;
}

function updateCashflowSubtotal() {
    const tbody = document.getElementById('cashflow-tbody');
    const rows = tbody.querySelectorAll('tr:not(.cf-group-header)');
    let total = 0;
    
    rows.forEach(tr => {
        const valInput = tr.querySelector('.cf-value');
        if (valInput) {
            const val = parseFloat(valInput.value.replace(/,/g, ''));
            if (!isNaN(val)) total += val;
        } else {
            const textEl = tr.querySelector('.cf-text-value');
            if (textEl) {
                const val = parseFloat(textEl.textContent.replace(/,/g, ''));
                if (!isNaN(val)) total += val;
            }
        }
    });
    
    const subtotalEl = document.getElementById('cf-subtotal');
    if (subtotalEl) {
        subtotalEl.textContent = total.toLocaleString('en-US');
    }
    
    const footerTotal = document.getElementById('cf-grand-total-plan');
    if (footerTotal) {
        footerTotal.textContent = total.toLocaleString('en-US');
    }
}

function renderCashflowTable() {
    const tbody = document.getElementById('cashflow-tbody');
    tbody.innerHTML = '';
    
    const projectId = state.currentProjectId;
    if (!projectId) return;
    
    const filterContract = document.getElementById('cf-filter-contract');
    const selectedContract = filterContract ? filterContract.value : '';
    
    const btnAddRelease = document.getElementById('btn-add-release');
    if (btnAddRelease) {
        if (selectedContract) {
            const allContracts = state.appData.Contracts || [];
            const c = allContracts.find(x => (x.package_name === selectedContract || x.contract === selectedContract) && x.project_id === projectId);
            if (c && c.type === 'Construction') {
                btnAddRelease.style.display = 'inline-block';
            } else {
                btnAddRelease.style.display = 'none';
            }
        } else {
            btnAddRelease.style.display = 'none';
        }
    }
    
    const searchInput = document.getElementById('cf-search-input');
    const searchVal = searchInput ? searchInput.value.trim().toLowerCase() : '';
    
    // Sync with Payment before rendering
    syncCashflowWithPayment(projectId);
    
    let items = getLocalCashflow().filter(c => c.project_id === projectId);
    
    if (selectedContract) {
        items = items.filter(c => c.package_name === selectedContract || c.contract === selectedContract);
    }
    
    if (searchVal) {
        items = items.filter(c => 
            (c.package_name && c.package_name.toLowerCase().includes(searchVal)) ||
            (c.code && c.code.toLowerCase().includes(searchVal)) ||
            (c.desc && c.desc.toLowerCase().includes(searchVal))
        );
    }

    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:1rem; color:var(--text-muted);">Chưa có dữ liệu. Bấm "+ Thêm Đợt Kế Hoạch" để bắt đầu hoặc Import từ Excel.</td></tr>`;
        updateCashflowSubtotal();
        return;
    }

    // Run Forecast Engine for Construction Contracts
    const allContracts = state.appData.Contracts || [];
    const constructionPackages = allContracts.filter(c => c.project_id === projectId && c.type === 'Construction');
    
    constructionPackages.forEach(contract => {
        // Find all cashflows for this contract
        const contractCashflows = items.filter(c => c.package_name === contract.package_name);
        if (contractCashflows.length > 0) {
            calculateForecastEngine(contractCashflows, contract);
        }
    });

    // Grouping by package_name
    const grouped = items.reduce((acc, item) => {
        const pkg = item.package_name || 'Khác';
        if (!acc[pkg]) {
            const allContracts = state.appData.Contracts || [];
            const matchedContract = allContracts.find(c => c.package_name === pkg && c.project_id === state.currentProjectId);
            const contractTotal = matchedContract ? (Number(matchedContract.total_value) || Number(matchedContract.budget_value) || 0) : 0;
            
            acc[pkg] = { items: [], totalPlan: contractTotal };
        }
        acc[pkg].items.push(item);
        // If there's no matching contract, we might want to sum non-duplicate items, but it's safer to not duplicate.
        // If it's a loosely created item without a contract, fallback to summing its value.
        if (acc[pkg].totalPlan === 0 && (!state.appData.Contracts || !state.appData.Contracts.some(c => c.package_name === pkg && c.project_id === state.currentProjectId))) {
             acc[pkg].totalPlan += (Number(item.value) || 0);
        }
        return acc;
    }, {});

    Object.keys(grouped).forEach(pkgName => {
        const group = grouped[pkgName];
        
        // Render Group Header
        const headerRow = document.createElement('tr');
        headerRow.className = 'cf-group-header';
        headerRow.innerHTML = `
            <td colspan="9">
                <div style="display:flex; justify-content: space-between; align-items: center; width: 100%;">
                    <div style="display:flex; align-items: center; gap: 0.5rem; color: var(--primary-blue);">
                        <i class="fa-solid fa-chevron-down group-toggle" style="width: 20px;"></i>
                        <span style="font-size: 1.05rem;">${pkgName}</span>
                    </div>
                    <div>
                        <span style="color: var(--text-color); font-weight: normal; margin-right: 0.5rem;">Tổng giá trị:</span>
                        <span style="color: var(--primary-blue); font-size: 1.05rem;">${group.totalPlan.toLocaleString('en-US')} VNĐ</span>
                    </div>
                </div>
            </td>
        `;
        
        tbody.appendChild(headerRow);

        // Render Child Rows
        const childRows = [];
        group.items.forEach(item => {
            const tr = createCashflowRowNode(item, false);
            tr.classList.add('cf-child-row');
            tbody.appendChild(tr);
            childRows.push(tr);
        });

        // Toggle logic
        headerRow.addEventListener('click', (e) => {
            if (e.target.closest('.cf-edit-btn') || e.target.closest('.cf-del-btn')) return;
            const icon = headerRow.querySelector('.group-toggle');
            const isCollapsed = icon.classList.contains('fa-chevron-right');
            
            if (isCollapsed) {
                icon.classList.remove('fa-chevron-right');
                icon.classList.add('fa-chevron-down');
                childRows.forEach(r => r.classList.remove('hidden'));
            } else {
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-right');
                childRows.forEach(r => r.classList.add('hidden'));
            }
        });
    });

    updateCashflowSubtotal();
}

function createCashflowRowNode(item, isEditMode = false) {
    const tr = document.createElement('tr');
    tr.dataset.id = item.id || ('cf-' + Date.now() + '-' + Math.floor(Math.random() * 1000));
    
    if (isEditMode) {
        tr.innerHTML = `
            <td><input type="text" class="cf-input cf-package" value="${item.package_name || ''}" placeholder="Package name"></td>
            <td><input type="text" class="cf-input cf-code" value="${item.code || ''}" placeholder="Vd: IPC-01"></td>
            <td><input type="text" class="cf-input cf-desc" value="${item.desc || ''}" placeholder="Diễn giải công việc"></td>
            <td><input type="text" class="cf-input cf-value" value="${(item.value || 0).toLocaleString('en-US')}" style="width: 100%; text-align: right;"></td>
            <td><input type="date" class="cf-input cf-date" value="${item.date || ''}"></td>
            <td class="col-synced">${item.certified_date || '-'}</td>
            <td class="col-synced">${item.paid_date || '-'}</td>
            <td class="col-synced">
                <select class="cf-input cf-status" style="background-color: transparent; border: 1px solid #cbd5e1; padding: 2px;">
                    <option value="Planned" ${(!item.status || item.status === 'Planned') ? 'selected' : ''}>Planned</option>
                    <option value="Certified" ${item.status === 'Certified' ? 'selected' : ''}>Certified</option>
                    <option value="Paid" ${item.status === 'Paid' ? 'selected' : ''}>Paid</option>
                </select>
            </td>
            <td style="text-align: center; white-space: nowrap;">
                <button type="button" class="btn btn-secondary cf-save-btn" style="color:#10b981; padding: 0.25rem 0.5rem;" title="Lưu"><i class="fa-solid fa-check"></i></button>
                <button type="button" class="btn btn-secondary cf-cancel-btn" style="color:var(--text-muted); padding: 0.25rem 0.5rem;" title="Hủy"><i class="fa-solid fa-xmark"></i></button>
            </td>
        `;
        
        const valueInput = tr.querySelector('.cf-value');
        valueInput.addEventListener('input', formatNumberInput);
        
        tr.querySelector('.cf-save-btn').addEventListener('click', () => saveRowData(tr, item.id));
        tr.querySelector('.cf-cancel-btn').addEventListener('click', () => {
            if (!item.code && !item.desc) {
                tr.remove(); // if it was a new empty row
            } else {
                tr.replaceWith(createCashflowRowNode(item, false));
                // Make sure to re-apply classes
                const newTr = tr.previousElementSibling || tr.nextElementSibling || tr;
                newTr.classList.add('cf-child-row');
            }
            updateCashflowSubtotal();
        });
    } else {
        let valueHtml = '';
        if (item.is_construction) {
            valueHtml = `
                <div style="text-align: right; line-height: 1.4;">
                    <div style="font-size: 0.8rem; color: #64748b;" title="Gross Work Done">WD: ${(item.workdone || 0).toLocaleString('en-US')}</div>
                    <div style="font-size: 0.8rem; color: #ef4444;" title="Retention">Ret: ${(item.retention || 0).toLocaleString('en-US')}</div>
                    <div style="font-size: 0.8rem; color: #f97316;" title="AP Recovery">AP: ${(item.ap_recovery || 0).toLocaleString('en-US')}</div>
                    <div style="font-weight: 700; color: #10b981; margin-top: 4px; border-top: 1px dashed #cbd5e1; padding-top: 2px;" title="Net Certified">
                        Net: <span class="cf-text-value">${(item.total_cert || 0).toLocaleString('en-US')}</span>
                    </div>
                </div>
            `;
        } else {
            valueHtml = `<div style="text-align: right; font-weight:600;" class="cf-text-value">${(item.value || 0).toLocaleString('en-US')}</div>`;
        }

        tr.innerHTML = `
            <td></td>
            <td><span style="font-weight:500; color:#ea580c;">${item.code || '-'}</span></td>
            <td>${item.desc || '-'}</td>
            <td>${valueHtml}</td>
            <td>${formatToMonthYear(item.date)}</td>
            <td class="col-synced">${formatToMonthYear(item.certified_date)}</td>
            <td class="col-synced">${formatToMonthYear(item.paid_date)}</td>
            <td class="col-synced"><span class="badge ${item.status==='Paid'?'bg-blue':item.status==='Certified'?'bg-purple':'bg-gray'}" style="padding:4px 8px; font-size:0.8rem;">${item.status || 'Planned'}</span></td>
            <td style="text-align: center; white-space: nowrap;">
                <button type="button" class="btn btn-secondary cf-edit-btn manager-hide" style="color:var(--primary-blue); padding: 0.25rem 0.5rem;" title="Sửa"><i class="fa-solid fa-pencil"></i></button>
                <button type="button" class="btn btn-secondary cf-del-btn manager-hide" style="color:var(--danger-color); padding: 0.25rem 0.5rem;" title="Xóa"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        
        tr.querySelector('.cf-edit-btn').addEventListener('click', () => {
            const editTr = createCashflowRowNode(item, true);
            editTr.classList.add('cf-child-row');
            tr.replaceWith(editTr);
        });
        
        tr.querySelector('.cf-del-btn').addEventListener('click', () => {
            if (confirm('Bạn có chắc chắn muốn xóa đợt thanh toán này?')) {
                let allData = getLocalCashflow();
                allData = allData.filter(c => c.id !== item.id);
                saveLocalCashflow(allData);
                tr.remove();
                updateCashflowSubtotal();
            }
        });
    }
    
    return tr;
}

function saveRowData(tr, existingId) {
    const projectId = state.currentProjectId;
    if (!projectId) return;

    const pkg = tr.querySelector('.cf-package').value.trim();
    const newItem = {
        id: existingId || tr.dataset.id,
        project_id: projectId,
        package_name: pkg,
        code: tr.querySelector('.cf-code').value.trim(),
        contract: pkg, // keep contract in sync with package
        desc: tr.querySelector('.cf-desc').value.trim(),
        date: tr.querySelector('.cf-date').value,
        value: parseFloat(tr.querySelector('.cf-value').value.replace(/,/g, '')) || 0,
        certified_date: '', // managed by sync
        paid_date: '',
        status: tr.querySelector('.cf-status').value
    };
    
    let allData = getLocalCashflow();
    const index = allData.findIndex(c => c.id === newItem.id);
    
    if (index >= 0) {
        // Retain sync fields
        newItem.certified_date = allData[index].certified_date;
        newItem.paid_date = allData[index].paid_date;
        allData[index] = newItem;
    } else {
        allData.push(newItem);
    }
    
    saveLocalCashflow(allData);
    tr.replaceWith(createCashflowRowNode(newItem, false));
    updateCashflowSubtotal();
}

function addCashflowRow() {
    const filterContract = document.getElementById('cf-filter-contract');
    const selectedContract = filterContract ? filterContract.value : '';
    
    const tbody = document.getElementById('cashflow-tbody');
    const emptyMsg = tbody.querySelector('td[colspan="9"]');
    if (emptyMsg) tbody.innerHTML = '';
    
    const newItem = {
        id: 'cf-' + Date.now(),
        package_name: selectedContract,
        status: 'Planned'
    };
    
    const tr = createCashflowRowNode(newItem, true);
    tbody.insertBefore(tr, tbody.firstChild);
}
    
let pendingImportCashflow = [];

function handleExcelImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const projectId = state.currentProjectId;
    const filterContract = document.getElementById('cf-filter-contract');
    const selectedContract = filterContract ? filterContract.value : '';

    const reader = new FileReader();
    reader.onload = function(event) {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const rows = XLSX.utils.sheet_to_json(worksheet, {header: 1});
        
        let newItems = [];
        let headerRowIdx = -1;
        let ipcColumns = [];
        
        // 1. Try to find Horizontal Matrix Timeline Header (Months)
        for (let i = 0; i < Math.min(15, rows.length); i++) {
            let matches = 0;
            let tempMonths = [];
            for (let j = 0; j < (rows[i] ? rows[i].length : 0); j++) {
                const cellVal = rows[i][j];
                let isDate = false;
                let dateStr = "";

                if (typeof cellVal === 'string') {
                    const str = cellVal.trim();
                    // Match Jun/26, Jun-26, Jun-2026, etc.
                    if (/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[/-]\d{2,4}$/i.test(str)) {
                        isDate = true;
                        const parts = str.split(/[/-]/);
                        const monthMap = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
                        const m = monthMap[parts[0].toLowerCase().substring(0, 3)];
                        let y = parts[1];
                        if (y.length === 2) y = "20" + y;
                        dateStr = `${y}-${m}-01`;
                    } 
                    // Match 06/2026, 6/26, 2026-06
                    else if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(str) || /^\d{1,2}[/-]\d{2,4}$/.test(str)) {
                        isDate = true;
                        // For fallback, we just need a valid date. Let's try Date.parse or assume generic
                        const d = new Date(str);
                        if (!isNaN(d.getTime())) {
                            dateStr = d.toISOString().substring(0, 8) + '01';
                        }
                    }
                } else if (typeof cellVal === 'number' && cellVal > 30000 && cellVal < 70000) {
                    // Excel date number (e.g. 45000)
                    isDate = true;
                    const dateObj = new Date(Math.round((cellVal - 25569) * 86400 * 1000));
                    if (!isNaN(dateObj.getTime())) {
                        dateStr = dateObj.toISOString().substring(0, 8) + '01';
                    }
                }

                if (isDate && dateStr) {
                    matches++;
                    tempMonths.push({ index: j, dateStr: dateStr });
                }
            }
            if (matches >= 2) {
                headerRowIdx = i;
                ipcColumns = tempMonths; // Mapping month headers
                break;
            }
        }
        
        if (headerRowIdx !== -1 && ipcColumns.length > 0) {
            // --- HORIZONTAL MATRIX PARSE (Block Parsing) ---
            let currentPackageName = "";

            for (let i = headerRowIdx + 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row) continue;
                
                // A row is the start of a block (Title Row) if the NEXT row contains "% Workdone" or similar
                const nextRow = rows[i+1] || [];
                let isBlockStart = false;
                
                for (let c = 0; c < 5 && c < nextRow.length; c++) {
                    const nextCellVal = (nextRow[c] || "").toString().trim().toLowerCase();
                    if (nextCellVal.includes("% workdone") || nextCellVal.includes("% work done") || nextCellVal.includes("progress")) {
                        isBlockStart = true;
                        break;
                    }
                }

                if (isBlockStart) {
                    // Extract Package Name from Column B (index 1)
                    const colBVal = (row[1] || "").toString().trim();
                    if (colBVal) {
                        currentPackageName = colBVal;
                    }
                    
                    let pkgName = currentPackageName;

                    // We found a Block Start (Title row). The block spans this row + next 5 rows.
                    const titleRow = rows[i] || [];
                    const progRow = rows[i+1] || [];
                    const wdRow = rows[i+2] || [];
                    const retRow = rows[i+3] || [];
                    const apRow = rows[i+4] || [];
                    const netRow = rows[i+5] || [];

                    ipcColumns.forEach(mh => {
                        const colIdx = mh.index;
                        const titleRaw = (titleRow[colIdx] || "").toString().trim();
                        
                        let workdone = parseFloat(wdRow[colIdx]) || 0;
                        let net_certified = parseFloat(netRow[colIdx]) || 0;
                        let titleUpper = titleRaw.toUpperCase();
                        let isAdvance = titleUpper.includes("ADVANCE") || titleUpper.includes("TẠM ỨNG");
                        let isRelease1 = titleUpper.includes('TOC') || titleUpper.includes('PAC') || titleUpper.includes('RELEASE 1');
                        let isRelease2 = titleUpper.includes('DLC') || titleUpper.includes('RELEASE 2');

                        if (net_certified !== 0 || workdone !== 0 || isRelease1 || isRelease2 || (isAdvance && net_certified !== 0)) {
                            let codeToUse = titleRaw;
                            if (!codeToUse && !isAdvance && !isRelease1 && !isRelease2) {
                                codeToUse = "IPC-" + mh.dateStr.substring(5, 7); 
                            }
                            
                            let descToUse = codeToUse;
                            if (!isAdvance && !isRelease1 && !isRelease2) {
                                if (!descToUse.toLowerCase().includes("thanh toán") && !descToUse.toLowerCase().includes("ipc")) {
                                    descToUse = "Thanh toán đợt " + codeToUse;
                                }
                            } else {
                                descToUse = isAdvance ? 'Advance Payment' : (isRelease1 ? 'Release Retention 1' : 'Release Retention 2');
                            }
                            
                            let item = {
                                id: 'cf-imp-' + Date.now() + '-' + Math.floor(Math.random()*10000) + colIdx,
                                project_id: projectId,
                                package_name: pkgName,
                                contract: pkgName,
                                code: codeToUse,
                                desc: descToUse,
                                date: mh.dateStr,
                                value: isAdvance ? net_certified : workdone,
                                progress_pct: parseFloat(progRow[colIdx]) || 0,
                                workdone: isAdvance ? 0 : workdone,
                                retention: parseFloat(retRow[colIdx]) || 0,
                                ap_recovery: parseFloat(apRow[colIdx]) || 0,
                                total_cert: net_certified,
                                status: 'Planned',
                                is_release_retention_1: isRelease1,
                                is_release_retention_2: isRelease2,
                                is_construction: true,
                                is_imported_matrix: true,
                                has_custom_retention: true,
                                has_custom_ap_recovery: true,
                                custom_retention: parseFloat(retRow[colIdx]) || 0,
                                custom_ap_recovery: parseFloat(apRow[colIdx]) || 0
                            };
                            newItems.push(item);
                        }
                    });

                    i += 5; // Skip the next 5 rows as we just parsed them
                }
            }
        } else {
            // --- VERTICAL PARSE (Legacy Mode) ---
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row || row.length < 4) continue;
                
                const pkgName = row[0] ? row[0].toString().trim() : '';
                const codeRaw = row[1] ? row[1].toString().trim() : '';
                const desc = row[2];
                const amountRaw = row[3];
                const dateRaw = row[4];
                
                if (!desc || amountRaw === undefined) continue;
                if (!codeRaw || codeRaw.length < 2) {
                    if (!isNaN(codeRaw)) continue; 
                }
                
                let amount = parseFloat(amountRaw);
                if (isNaN(amount)) continue;
                
                let dateStr = "";
                if (dateRaw) {
                    if (typeof dateRaw === 'number') {
                        const dateObj = new Date(Math.round((dateRaw - 25569) * 86400 * 1000));
                        dateStr = dateObj.toISOString().split('T')[0];
                    } else if (typeof dateRaw === 'string') {
                        const parts = dateRaw.split('/');
                        if (parts.length === 2) { 
                            dateStr = `${parts[1]}-${parts[0].padStart(2, '0')}-01`;
                        } else if (parts.length === 3) { 
                            dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                        } else {
                            const d = new Date(dateRaw);
                            if (!isNaN(d.getTime())) {
                                dateStr = d.toISOString().split('T')[0];
                            }
                        }
                    }
                }
                
                newItems.push({
                    id: 'cf-imp-' + Date.now() + '-' + Math.floor(Math.random()*10000) + i,
                    project_id: projectId,
                    package_name: pkgName || selectedContract,
                    code: codeRaw,
                    contract: selectedContract || pkgName,
                    desc: desc.toString().trim(),
                    date: dateStr,
                    value: amount,
                    status: 'Planned'
                });
            }
        }

        
        if (newItems.length > 0) {
            pendingImportCashflow = newItems;
            const importTbody = document.getElementById('cf-import-tbody');
            importTbody.innerHTML = '';
            
            newItems.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${item.package_name || '-'}</td>
                    <td><span style="font-weight:500; color:var(--primary-blue);">${item.code || '-'}</span></td>
                    <td>${item.desc || '-'}</td>
                    <td style="text-align: right; font-weight:600;">${(item.value || 0).toLocaleString('en-US')}</td>
                    <td>${formatToMonthYear(item.date)}</td>
                `;
                importTbody.appendChild(tr);
            });
            
            document.getElementById('cf-import-count').textContent = newItems.length;
            document.getElementById('cashflow-detail-modal').classList.add('hidden'); // Hide master modal
            document.getElementById('cashflow-import-modal').classList.remove('hidden'); // Show import modal
            
        } else {
            alert("Không tìm thấy dữ liệu hợp lệ trong file Excel. Vui lòng kiểm tra lại cấu trúc.");
        }
        
        e.target.value = '';
    };
    reader.readAsArrayBuffer(file);
}

function saveImportedCashflow() {
    if (!pendingImportCashflow || pendingImportCashflow.length === 0) return;
    
    const projectId = state.currentProjectId;
    let allData = getLocalCashflow();
    
    let addedCount = 0;
    let updatedCount = 0;
    
    pendingImportCashflow.forEach(newItem => {
        // Unique key: project_id + package_name + code
        const existingIndex = allData.findIndex(item => 
            item.project_id === projectId &&
            item.package_name === newItem.package_name &&
            item.code === newItem.code
        );
        
        if (existingIndex >= 0) {
            // Update existing
            const existing = allData[existingIndex];
            existing.desc = newItem.desc;
            existing.value = newItem.value;
            existing.date = newItem.date;
            // Retain id, certified_date, paid_date, status
            updatedCount++;
        } else {
            // Insert new
            allData.push(newItem);
            addedCount++;
        }
    });
    
    saveLocalCashflow(allData);
    
    pendingImportCashflow = [];
    document.getElementById('cashflow-import-modal').classList.add('hidden');
    document.getElementById('cashflow-detail-modal').classList.remove('hidden');
    
    renderCashflowTable();
    crossCheckValidation();
    alert(`✅ Đã cập nhật thành công! (Thêm mới ${addedCount} đợt thanh toán, Cập nhật ${updatedCount} đợt thanh toán hiện có)`);
}

function syncCashflowWithPayment(projectId) {
    let cashflows = getLocalCashflow();
    
    let payments = state.appData.Payments || [];
    if (!Array.isArray(payments) || payments.length === 0) return;
    
    let hasChanges = false;
    
    cashflows.forEach(cf => {
        if (cf.project_id === projectId) {
            // Find matching payment based on Package Name and Payment No (code)
            const matchedPayment = payments.find(p => 
                p.project_id === projectId && 
                p.package_name === cf.package_name && 
                p.code === cf.code
            );
            
            if (matchedPayment) {
                if (cf.certified_date !== matchedPayment.certified_date || 
                    cf.paid_date !== matchedPayment.paid_date ||
                    cf.status !== matchedPayment.status) {
                    
                    cf.certified_date = matchedPayment.certified_date || '';
                    cf.paid_date = matchedPayment.paid_date || '';
                    cf.status = matchedPayment.status || 'Planned';
                    hasChanges = true;
                }
            }
        }
    });
    
    if (hasChanges) {
        saveLocalCashflow(cashflows);
    }
}

export function crossCheckValidation() {
    const alertDiv = document.getElementById('cf-validation-alert');
    if (!alertDiv) return;
    
    const projectId = state.currentProjectId;
    if (!projectId) {
        alertDiv.classList.add('hidden');
        return;
    }
    
    let masterContracts = state.appData.Contracts || [];
    masterContracts = masterContracts.filter(c => c.project_id === projectId);
    const masterPackages = masterContracts.map(c => c.package_name).filter(Boolean);
    
    let cashflows = getLocalCashflow().filter(c => c.project_id === projectId);
    
    if (cashflows.length === 0) {
        alertDiv.classList.add('hidden');
        return;
    }
    
    const cashflowPackages = [...new Set(cashflows.map(c => c.package_name).filter(Boolean))];
    
    const missingInContract = cashflowPackages.filter(p => !masterPackages.includes(p));
    const missingInCashflow = masterPackages.filter(p => !cashflowPackages.includes(p));
    
    if (missingInContract.length === 0 && missingInCashflow.length === 0) {
        alertDiv.className = 'validation-alert success';
        alertDiv.innerHTML = `<i class="fa-solid fa-circle-check"></i> <strong>Đồng bộ hoàn toàn:</strong> Dữ liệu khớp 100% với Contract (${masterPackages.length}/${masterPackages.length} gói thầu).`;
    } else {
        alertDiv.className = 'validation-alert warning';
        let msgs = [];
        if (missingInCashflow.length > 0) {
            msgs.push(`Phát hiện ${missingInCashflow.length} gói thầu chưa lập Cashflow (${missingInCashflow.join(', ')}).`);
        }
        if (missingInContract.length > 0) {
            msgs.push(`Phát hiện ${missingInContract.length} gói thầu có trong Cashflow nhưng không có trong Contract (${missingInContract.join(', ')}).`);
        }
        alertDiv.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <div><strong>Cảnh báo Dữ liệu:</strong><br>${msgs.join('<br>')}</div>`;
    }
    
    alertDiv.classList.remove('hidden');
}

// ----------------------------------------------------
// Construction Forecast Engine
// ----------------------------------------------------
function calculateForecastEngine(cashflows, contract) {
    // Sort items by date to calculate cumulative correctly
    cashflows.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

    const retentionPercent = parseFloat(contract.retention_percent) || 0;
    const maxRetentionPercent = parseFloat(contract.max_retention_percent) || 0;
    const apPercent = parseFloat(contract.advance_payment_percent) || 0;
    const apRecoveryPercent = parseFloat(contract.ap_recovery_percent) || 0;
    const totalValue = parseFloat(contract.total_value) || 0;

    const maxRetentionValue = totalValue * (maxRetentionPercent / 100);
    const totalApValue = totalValue * (apPercent / 100);

    let cumRetention = 0;
    let cumApRecovery = 0;

    cashflows.forEach(item => {
        item.is_construction = true;

        if (item.is_imported_matrix) {
            // Bypass calculation: Trust values parsed from Excel
            cumRetention += item.retention || 0;
            cumApRecovery += item.ap_recovery || 0;
            return; // Skip recalculation
        }

        if (item.is_release_retention_1) {
            item.workdone = 0;
            item.ap_recovery = 0;
            item.retention = -(cumRetention / 2); // Release 50%
            cumRetention += item.retention; // reduces cumulative retention
            item.total_cert = item.workdone - item.retention - item.ap_recovery;
        } else if (item.is_release_retention_2) {
            item.workdone = 0;
            item.ap_recovery = 0;
            item.retention = -cumRetention; // Release remaining
            cumRetention += item.retention;
            item.total_cert = item.workdone - item.retention - item.ap_recovery;
        } else {
            let workdone = parseFloat(item.value) || 0;
            item.workdone = workdone;

            // Retention calculation
            if (item.has_custom_retention) {
                item.retention = item.custom_retention || 0;
            } else {
                let rawRetention = workdone * (retentionPercent / 100);
                if (cumRetention + rawRetention > maxRetentionValue) {
                    item.retention = Math.max(0, maxRetentionValue - cumRetention);
                } else {
                    item.retention = rawRetention;
                }
            }
            cumRetention += item.retention;

            // AP Recovery calculation
            if (item.has_custom_ap_recovery) {
                item.ap_recovery = item.custom_ap_recovery || 0;
            } else {
                let rawAp = workdone * (apRecoveryPercent / 100);
                if (cumApRecovery + rawAp > totalApValue) {
                    item.ap_recovery = Math.max(0, totalApValue - cumApRecovery);
                } else {
                    item.ap_recovery = rawAp;
                }
            }
            cumApRecovery += item.ap_recovery;

            item.total_cert = item.workdone - item.retention - item.ap_recovery;
        }
    });
}
