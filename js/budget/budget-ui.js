import { state, formatCurrency, formatCurrencyVND, formatDate, mockActivities } from '../app.js';
import { renderTenders } from '../tender.js';
import { renderContracts } from '../contract.js';
import { renderCashflow } from '../cashflow.js';

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
            localStorage.setItem('ccm_current_project_id', state.currentProjectId);
            renderProjectTabs();
            renderDashboard();
            renderContracts();
            
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

let chartInstances = [];

export function renderDashboard() {
    if (!state.appData || !state.currentProjectId) return;

    const project = state.appData.Projects.find(p => p.project_id === state.currentProjectId);
    if (!project) return;

    document.getElementById('project-name').innerHTML = `${project.project_name} <i class="fa-solid fa-gear" style="color: var(--primary-blue); font-size: 1.2rem;"></i>`;
    
    const metaElement = document.getElementById('project-meta-info') || document.querySelector('.project-meta');
    if (metaElement) {
        const start = project.start_date ? new Date(project.start_date).toLocaleDateString('en-GB') : '1 January 2024';
        const end = project.end_date ? new Date(project.end_date).toLocaleDateString('en-GB') : '1 December 2024';
        const loc = project.location || 'Belgrade, Serbia';
        metaElement.textContent = `${loc} • ${start} - ${end}`;
    }
    

    const heroCfa = document.getElementById('hero-cfa');
    if (heroCfa) heroCfa.textContent = project.cfa ? `${project.cfa} m²` : '0 m²';

    const heroScale = document.getElementById('hero-scale');
    if (heroScale) heroScale.textContent = project.scale || 'N/A';

    const heroStatus = document.getElementById('hero-status');
    if (heroStatus) heroStatus.textContent = project.status || 'Đang thực hiện';
    
    let allocatedBudget = 0;
    const projectBudgets = (state.appData.Budgets || []).filter(b => b.project_id === state.currentProjectId);

    let consultancyBudget = 0;
    let consultancyCommitted = 0;
    let consultancyExpended = 0;

    let constructionBudget = 0;
    let constructionCommitted = 0;
    let constructionExpended = 0;

    let contingencyBudget = 0;
    let contingencyCommitted = 0;
    let contingencyExpended = 0;

    projectBudgets.forEach(budget => {
        const budgeted = Number(budget.budgeted) || 0;
        
        let committed = 0;
        let expended = 0;
        
        const linkedContracts = (state.appData.Contracts || []).filter(c => c.budget_id === budget.id);
        linkedContracts.forEach(contract => {
            let contractCommitted = Number(contract.total_value || contract.original_value || 0);
            const variations = (state.appData.Variations || []).filter(v => v.contract_id === contract.contract_id && v.status === 'Approved');
            variations.forEach(v => contractCommitted += Number(v.vo_amount || 0));
            
            let contractExpended = 0;
            (state.appData.Payment_Claims || []).filter(p => p.contract_id === contract.contract_id && p.status === 'Approved').forEach(p => {
                contractExpended += Number(p.claimed_amount || 0);
            });
            
            committed += contractCommitted;
            expended += contractExpended;
        });

        // Fallback: nếu chưa có Contract linked, dùng cached_committed từ Award
        if (linkedContracts.length === 0 && budget.cached_committed) {
            committed = Number(budget.cached_committed) || 0;
        }

        allocatedBudget += committed;

        if (budget.category === 'Consultancy') {
            consultancyBudget += budgeted;
            consultancyCommitted += committed;
            consultancyExpended += expended;
        } else if (budget.category === 'Construction') {
            constructionBudget += budgeted;
            constructionCommitted += committed;
            constructionExpended += expended;
        } else if (budget.category === 'Contingency') {
            contingencyBudget += budgeted;
            contingencyCommitted += committed;
            contingencyExpended += expended;
        }
    });

    document.getElementById('metric-allocated').innerHTML = `${formatCurrencyVND(allocatedBudget)} <span>VNĐ</span>`;
    
    // Fallback contingency if not modeled in budgets
    if (contingencyBudget === 0) {
        contingencyBudget = project.contingency_budget || 0;
    }

    // Yêu cầu: Phân bổ Ngân sách thi công/tư vấn (Soft/Hard Cost) bằng Tổng ngân sách trừ Dự phòng 
    // nếu mảng Budgets chưa có dữ liệu chi tiết
    if (consultancyBudget === 0 && constructionBudget === 0 && (project.total_budget || 0) > 0) {
        constructionBudget = (project.total_budget || 0) - contingencyBudget;
        if (constructionBudget < 0) constructionBudget = 0; // Tránh số âm nếu nhập sai
    }

    const contingencyRemaining = contingencyBudget - contingencyExpended; 
    
    const totalBudget = consultancyBudget + constructionBudget + contingencyBudget;
    const totalBudgetFallback = totalBudget > 0 ? totalBudget : (project.total_budget || 0);

    document.getElementById('metric-total-budget').innerHTML = `${formatCurrencyVND(totalBudgetFallback)} <span>VNĐ</span>`;
    
    const heroBudget = document.getElementById('hero-total-budget');
    if (heroBudget) heroBudget.textContent = formatCurrency(totalBudgetFallback);

    const contingencyPct = totalBudgetFallback > 0 ? ((contingencyRemaining / totalBudgetFallback) * 100).toFixed(1) : 0;
    
    document.getElementById('metric-contingency').innerHTML = `${formatCurrencyVND(contingencyRemaining)} <span>VNĐ</span>`;
    const contingencyPctEl = document.getElementById('metric-contingency-pct');
    if (contingencyPctEl) contingencyPctEl.textContent = `${contingencyPct}%`;
    
    const totalPayments = consultancyExpended + constructionExpended;
    const metricPayments = document.getElementById('metric-payments');
    if (metricPayments) metricPayments.textContent = formatCurrency(totalPayments);
    
    const projectedFinalCost = allocatedBudget + contingencyRemaining;
    document.getElementById('metric-projected').innerHTML = `${formatCurrencyVND(projectedFinalCost)} <span>VNĐ</span>`;

    // Render Charts
    chartInstances.forEach(c => c.destroy());
    chartInstances = [];

    // Chart 1: Grouped Bar Chart
    const barOptions = {
        series: [{
            name: 'Budget Duyệt',
            data: [consultancyBudget / 1e9, constructionBudget / 1e9, contingencyBudget / 1e9]
        }, {
            name: 'Thực tế Cam kết',
            data: [consultancyCommitted / 1e9, constructionCommitted / 1e9, 0] // 0 for contingency committed
        }, {
            name: 'Đã Chi',
            data: [consultancyExpended / 1e9, constructionExpended / 1e9, 0] // 0 for contingency expended
        }],
        chart: { type: 'bar', height: 350, toolbar: { show: false } },
        colors: ['#cbd5e1', '#3b82f6', '#10b981'],
        plotOptions: { bar: { horizontal: false, columnWidth: '50%', endingShape: 'rounded' } },
        dataLabels: { enabled: false },
        stroke: { show: true, width: 2, colors: ['transparent'] },
        xaxis: { categories: ['Tư vấn (Soft Cost)', 'Xây dựng / M&E (Hard Cost)', 'Dự phòng (Contingency)'] },
        yaxis: { labels: { formatter: (val) => val.toFixed(1) + ' Tỷ' } },
        fill: { opacity: 1 },
        tooltip: {
            y: { formatter: function (val) { return formatCurrency(val * 1e9); } }
        }
    };
    const barEl = document.querySelector("#budget-chart-bar");
    if (barEl) {
        chartInstances.push(new ApexCharts(barEl, barOptions));
    }

    // Chart 2: Doughnut Chart
    const pieOptions = {
        series: [consultancyBudget, constructionBudget, contingencyBudget],
        chart: { type: 'donut', height: 350 },
        labels: ['Tư vấn (Soft Cost)', 'Xây dựng / M&E (Hard Cost)', 'Dự phòng (Contingency)'],
        colors: ['#a855f7', '#3b82f6', '#f97316'],
        dataLabels: { enabled: true, formatter: function (val, opts) { return opts.w.globals.seriesTotals[opts.seriesIndex] > 0 ? val.toFixed(1) + "%" : "" } },
        legend: { position: 'bottom' },
        tooltip: {
            y: { formatter: function (val) { return formatCurrency(val); } }
        }
    };
    const pieEl = document.querySelector("#budget-chart-pie");
    if (pieEl) {
        chartInstances.push(new ApexCharts(pieEl, pieOptions));
    }

    chartInstances.forEach(c => c.render());

    const docsGrid = document.getElementById('documents-grid');
    const uploader = docsGrid ? docsGrid.querySelector('.document-upload') : null;
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

export function renderBudgetTableModal() {
    const tbodyConsultancy = document.getElementById('budget-tbody-consultancy');
    const tbodyConstruction = document.getElementById('budget-tbody-construction');
    const tbodyContingency = document.getElementById('budget-tbody-contingency');
    const tfootTotal = document.getElementById('budget-tfoot-total');

    if (!tbodyConsultancy || !tbodyConstruction || !tbodyContingency || !tfootTotal) return;

    tbodyConsultancy.innerHTML = '';
    tbodyConstruction.innerHTML = '';
    tbodyContingency.innerHTML = '';
    tfootTotal.innerHTML = '';

    const project = state.appData.Projects.find(p => p.project_id === state.currentProjectId);
    if (!project) return;

    const projectBudgets = (state.appData.Budgets || []).filter(b => b.project_id === state.currentProjectId);

    const createRow = (budget) => {
        const budgeted = Number(budget.budgeted) || 0;
        let committed = 0;
        let expended = 0;
        
        const linkedContracts = (state.appData.Contracts || []).filter(c => c.budget_id === budget.id);
        linkedContracts.forEach(contract => {
            let contractCommitted = Number(contract.total_value || contract.original_value || 0);
            const variations = (state.appData.Variations || []).filter(v => v.contract_id === contract.contract_id && v.status === 'Approved');
            variations.forEach(v => contractCommitted += Number(v.vo_amount || 0));
            
            let contractExpended = 0;
            (state.appData.Payment_Claims || []).filter(p => p.contract_id === contract.contract_id && p.status === 'Approved').forEach(p => {
                contractExpended += Number(p.claimed_amount || 0);
            });
            
            committed += contractCommitted;
            expended += contractExpended;
        });

        // Fallback: nếu chưa có Contract linked, dùng cached_committed từ Award
        if (linkedContracts.length === 0 && budget.cached_committed) {
            committed = Number(budget.cached_committed) || 0;
        }

        const varianceVal = budgeted - committed - expended;
        const progress = committed > 0 ? (expended / committed) * 100 : 0;
        const actionHtml = `
            <div style="display: flex; gap: 8px; justify-content: center; align-items: center;">
                <button class="btn-create-tender bg-amber-700 hover:bg-amber-800 text-white px-2 py-1 rounded" data-id="${budget.id}" style="font-size: 0.85rem; border: none; cursor: pointer;">Tạo Thầu</button>
                <button class="btn-edit-budget text-gray-500 hover:text-blue-600" data-id="${budget.id}" style="background: none; border: none; cursor: pointer; padding: 4px;" title="Sửa"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-delete-budget text-gray-500 hover:text-red-600" data-id="${budget.id}" style="background: none; border: none; cursor: pointer; padding: 4px;" title="Xóa"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${budget.packageName || 'Unnamed Package'}</td>
            <td>${formatCurrency(budgeted)}</td>
            <td>${formatCurrency(committed)}</td>
            <td>${formatCurrency(expended)}</td>
            <td class="${varianceVal < 0 ? 'text-red' : 'text-blue'}">${varianceVal < 0 ? '-' : ''}${formatCurrency(Math.abs(varianceVal))}</td>
            <td>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress}%"></div>
                </div>
            </td>
            <td style="text-align: center;">${actionHtml}</td>
        `;

        const btnCreateTender = tr.querySelector('.btn-create-tender');
        if (btnCreateTender) {
            btnCreateTender.addEventListener('click', () => {
                if (window.createTenderFromBudget) {
                    window.createTenderFromBudget(budget);
                }
            });
        }
        return {
            element: tr,
            budgeted: budgeted,
            committed: committed,
            expended: expended
        };
    };

    let totalBudgeted = 0;
    let totalCommitted = 0;
    let totalExpended = 0;

    const consultancies = projectBudgets.filter(b => b.category === 'Consultancy');
    const constructions = projectBudgets.filter(b => b.category === 'Construction');
    const contingencies = projectBudgets.filter(b => b.category === 'Contingency');

    if (consultancies.length > 0) {
        const headerTR = document.createElement('tr');
        headerTR.innerHTML = `<td colspan="7" style="background-color: #f1f5f9; font-weight: bold; padding: 0.75rem;">I. Tư vấn (Soft Cost)</td>`;
        tbodyConsultancy.appendChild(headerTR);
        consultancies.forEach(b => {
            const rowData = createRow(b);
            tbodyConsultancy.appendChild(rowData.element);
            totalBudgeted += rowData.budgeted;
            totalCommitted += rowData.committed;
            totalExpended += rowData.expended;
        });
    }

    if (constructions.length > 0) {
        const headerTR = document.createElement('tr');
        headerTR.innerHTML = `<td colspan="7" style="background-color: #f1f5f9; font-weight: bold; padding: 0.75rem;">II. Xây dựng / M&E (Hard Cost)</td>`;
        tbodyConstruction.appendChild(headerTR);
        constructions.forEach(b => {
            const rowData = createRow(b);
            tbodyConstruction.appendChild(rowData.element);
            totalBudgeted += rowData.budgeted;
            totalCommitted += rowData.committed;
            totalExpended += rowData.expended;
        });
    }

    if (contingencies.length > 0) {
        const contHeaderTR = document.createElement('tr');
        contHeaderTR.innerHTML = `<td colspan="7" style="background-color: #f1f5f9; font-weight: bold; padding: 0.75rem;">III. Dự phòng (Contingency)</td>`;
        tbodyContingency.appendChild(contHeaderTR);
        contingencies.forEach(b => {
            const rowData = createRow(b);
            tbodyContingency.appendChild(rowData.element);
            totalBudgeted += rowData.budgeted;
            totalCommitted += rowData.committed;
            totalExpended += rowData.expended;
        });
    } else {
        // Fallback static contingency row if not modeled in budgets
        const contingencyBudget = project.contingency_budget || 0;
        totalBudgeted += contingencyBudget;

        const contHeaderTR = document.createElement('tr');
        contHeaderTR.innerHTML = `<td colspan="7" style="background-color: #f1f5f9; font-weight: bold; padding: 0.75rem;">III. Dự phòng (Contingency)</td>`;
        tbodyContingency.appendChild(contHeaderTR);

        const contTR = document.createElement('tr');
        contTR.innerHTML = `
            <td>Dự phòng (Contingency)</td>
            <td>${formatCurrency(contingencyBudget)}</td>
            <td>${formatCurrency(0)}</td>
            <td>${formatCurrency(0)}</td>
            <td class="text-blue">${formatCurrency(contingencyBudget)}</td>
            <td>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: 0%"></div>
                </div>
            </td>
            <td style="text-align: center;">
                <div style="display: flex; gap: 8px; justify-content: center; align-items: center;">
                    <button class="btn-create-tender bg-amber-700 hover:bg-amber-800 text-white px-2 py-1 rounded" style="font-size: 0.85rem; border: none; cursor: pointer;">Tạo Thầu</button>
                </div>
            </td>
        `;
        tbodyContingency.appendChild(contTR);
    }

    // Total Footer
    const totalVariance = totalBudgeted - totalCommitted - totalExpended;
    tfootTotal.innerHTML = `
        <tr style="background: #e2e8f0; font-weight: bold;">
            <td style="text-align: right; padding-right: 1rem;">TỔNG CỘNG</td>
            <td>${formatCurrency(totalBudgeted)}</td>
            <td>${formatCurrency(totalCommitted)}</td>
            <td>${formatCurrency(totalExpended)}</td>
            <td class="${totalVariance < 0 ? 'text-red' : 'text-blue'}">${totalVariance < 0 ? '-' : ''}${formatCurrency(Math.abs(totalVariance))}</td>
            <td></td>
            <td></td>
        </tr>
    `;

    window.openInlineWorkspace('budget-list-modal');
}

export function renderActivities() {
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
