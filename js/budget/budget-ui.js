import { paymentTotals, isApprovedIPC } from '../modules/payment/payment-metrics.js';
import { escapeHtml } from '../utils/formatters.js';
import { state, formatCurrency, formatCurrencyVND, formatDate, mockActivities, getDynamicContractValue } from '../app.js';
import { renderTenders } from '../tender.js';
// Tách file (≤200 dòng): bảng chi tiết ngân sách & ô chọn dự án — xuất lại để giữ import cũ
export { renderBudgetTableModal } from './budget-table-ui.js';
export { renderProjectTabs } from './project-tabs-ui.js';


let chartInstances = [];

export function renderDashboard() {
    if (!state.appData || !state.currentProjectId) return;

    const project = state.appData.Projects.find(p => p.project_id === state.currentProjectId);
    if (!project) return;

    // Update old #project-name if still exists, otherwise skip safely
    const projectNameEl = document.getElementById('project-name');
    if (projectNameEl) {
        projectNameEl.innerHTML = `${project.project_name} <i class="fa-solid fa-gear" style="color: var(--primary-blue); font-size: 1.2rem;"></i>`;
    }
    
    const metaElement = document.getElementById('project-meta-info');
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
        const activeContracts = linkedContracts.filter(c => {
            const status = c.status || 'Đang thực hiện';
            return status === 'Đang thực hiện' || status === 'Active';
        });
        
        activeContracts.forEach(contract => {
            let contractCommitted = getDynamicContractValue(contract, state.appData);
            
            let contractExpended = 0;
            // Đã chi = Σ (14) các IPC đã duyệt/đã thanh toán (trước thuế, không gồm tạm ứng)
            contractExpended += paymentTotals(state.appData.Payments || [], { contractId: contract.contract_id, filter: isApprovedIPC }).certifiedExVat;
            
            committed += contractCommitted;
            expended += contractExpended;
        });

        // Fallback: nếu chưa có Contract Đang thực hiện, dùng cached_committed từ Award
        if (activeContracts.length === 0 && budget.cached_committed) {
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
                    <h5>${escapeHtml(doc.file_name)}</h5>
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
                <p><strong>${escapeHtml(act.text)}</strong></p>
                <span>${formatDate(act.date)}</span>
            </div>
        `;
        timeline.appendChild(div);
    });
}
