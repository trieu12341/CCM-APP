import { getContractValue, getContractName, getContractorName } from '../../core/contract-fields.js';
import { escapeHtml } from '../../utils/formatters.js';
import { state, formatCurrency, formatCurrencyVND, formatDate } from '../../app.js';
import { filterVOs } from './vo-state.js';

let doughnutChart = null;
let barChart = null;

export function renderVODashboard() {
    const voList = state.appData.Variations || [];
    
    // Filter VO for current project
    const projectVOs = voList.filter(vo => {
        const contract = state.appData.Contracts.find(c => c.contract_id === vo.contract_id);
        return contract && contract.project_id === state.currentProjectId;
    });

    let totalClaimed = 0;
    let totalApproved = 0;
    let totalPending = 0;
    let totalRejected = 0;
    let approvedCount = 0;

    projectVOs.forEach(vo => {
        const claimed = Number(vo.claimed_amount) || Number(vo.vo_amount) || 0;
        const approved = Number(vo.approved_amount) || 0;

        totalClaimed += claimed;

        if (vo.status === 'Approved') {
            totalApproved += approved;
            approvedCount++;
        } else if (vo.status === 'Pending') {
            totalPending += claimed;
        } else if (vo.status === 'Rejected') {
            totalRejected += claimed;
        }
    });

    // Calculate Original Contract Value for the project
    const projectContracts = state.appData.Contracts.filter(c => c.project_id === state.currentProjectId);
    const originalContractValue = projectContracts.reduce((sum, c) => sum + getContractValue(c), 0);
    
    let ratio = 0;
    if (originalContractValue > 0) {
        ratio = (totalApproved / originalContractValue) * 100;
    }

    // Update KPI UI with innerHTML to preserve <span> styling
    document.getElementById('vo-kpi-claimed').innerHTML = `${formatCurrencyVND(totalClaimed)} <span>VNĐ</span>`;
    document.getElementById('vo-kpi-approved').innerHTML = `${formatCurrencyVND(totalApproved)} <span>VNĐ</span>`;
    document.getElementById('vo-kpi-pending').innerHTML = `${formatCurrencyVND(totalPending)} <span>VNĐ</span>`;
    document.getElementById('vo-kpi-rejected').innerHTML = `${formatCurrencyVND(totalRejected)} <span>VNĐ</span>`;
    document.getElementById('vo-kpi-count').innerHTML = `${approvedCount} <span style="font-size:14px;font-weight:500;opacity:0.7;">/ ${projectVOs.length}</span>`;
    document.getElementById('vo-kpi-ratio').textContent = ratio.toFixed(2) + '%';

    // Update Charts
    renderChartDoughnut(projectVOs);
    renderChartBar(projectVOs, projectContracts);

    // Update Table
    renderVOTable();
}

export function renderVOTable() {
    const tbody = document.querySelector('#vo-table tbody');
    if (!tbody) return;
    
    const list = filterVOs();
    tbody.innerHTML = '';

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: var(--text-muted);">Không có dữ liệu Phát sinh / No Variation Orders found</td></tr>';
        return;
    }

    list.forEach(vo => {
        const contract = state.appData.Contracts.find(c => c.contract_id === vo.contract_id);
        const contractName = contract ? getContractName(contract) : 'Unknown';
        
        const claimed = Number(vo.claimed_amount) || Number(vo.vo_amount) || 0;
        const approved = Number(vo.approved_amount) || 0;
        const variance = approved - claimed;

        let statusClass = 'status-default';
        if (vo.status === 'Approved') statusClass = 'status-approved';
        if (vo.status === 'Pending') statusClass = 'status-pending';
        if (vo.status === 'Rejected') statusClass = 'status-rejected';

        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.className = 'vo-row';
        tr.dataset.id = vo.vo_id;
        
        tr.innerHTML = `
            <td style="font-weight:600; color:var(--primary-blue);">${vo.vo_id}</td>
            <td>${escapeHtml(vo.vo_name || '')}</td>
            <td>${escapeHtml(contractName)}</td>
            <td>${vo.submission_date ? formatDate(vo.submission_date) : '-'}</td>
            <td>${vo.assessment_date ? formatDate(vo.assessment_date) : '-'}</td>
            <td style="text-align:right;">${formatCurrency(claimed)}</td>
            <td style="text-align:right; font-weight:600;" class="text-success">${formatCurrency(approved)}</td>
            <td style="text-align:right;" class="${vo.status === 'Approved' ? (variance < 0 ? 'text-danger' : 'text-success') : 'text-muted'}">${vo.status === 'Approved' ? formatCurrency(variance) : '—'}</td>
            <td><span class="status-badge ${statusClass}">${vo.status || 'Pending'}</span></td>
            <td>
                <button class="btn-icon btn-view-vo" data-id="${vo.vo_id}" title="Xem Chi tiết"><i class="fa-solid fa-eye"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}



export function populateVOContractDropdown() {
    const select = document.getElementById('vo-contract-select');
    if (!select) return;

    select.innerHTML = '<option value="">-- Chọn Hợp đồng --</option>';
    const projectContracts = state.appData.Contracts.filter(c => c.project_id === state.currentProjectId && c.status !== 'Closed');
    
    projectContracts.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.contract_id;
        opt.textContent = `${getContractName(c)} (${getContractorName(c) || 'TBD'})`;
        select.appendChild(opt);
    });
}

export function updateVOSummaryFields() {
    const claimedAmt = Number(document.getElementById('vo-item-claimed-amt').value) || 0;
    const approvedAmt = Number(document.getElementById('vo-item-approved-amt').value) || 0;
    document.getElementById('vo-claimed-summary').textContent = formatCurrency(claimedAmt);
    document.getElementById('vo-approved-summary').textContent = formatCurrency(approvedAmt);
}

export function renderChartDoughnut(projectVOs) {
    if (!document.getElementById('vo-doughnut-chart')) return;
    
    let approved = 0;
    let pending = 0;
    let rejected = 0;

    projectVOs.forEach(vo => {
        if (vo.status === 'Approved') approved++;
        else if (vo.status === 'Pending') pending++;
        else if (vo.status === 'Rejected') rejected++;
    });

    const options = {
        series: [approved, pending, rejected],
        chart: { type: 'donut', height: 280 },
        labels: ['Đã duyệt', 'Chờ duyệt', 'Từ chối'],
        colors: ['approved', 'submitted', 'negative'],
        dataLabels: { enabled: false },
        plotOptions: {
            pie: {
                donut: {
                    size: '70%',
                    labels: {
                        show: true,
                        name: { show: true },
                        value: { show: true, formatter: (val) => val + " VO" },
                        total: { show: true, showAlways: true, label: 'Tổng số VO', formatter: (w) => w.globals.seriesTotals.reduce((a, b) => a + b, 0) }
                    }
                }
            }
        },
        legend: { position: 'bottom' }
    };

    if (doughnutChart) {
        doughnutChart.updateOptions(options);
    } else {
        doughnutChart = new ApexCharts(document.querySelector("#vo-doughnut-chart"), options);
        doughnutChart.render();
    }
}

export function renderChartBar(projectVOs, projectContracts) {
    if (!document.getElementById('vo-bar-chart')) return;

    const contractNames = [];
    const claimedData = [];
    const approvedData = [];

    projectContracts.forEach(contract => {
        const vosForContract = projectVOs.filter(vo => vo.contract_id === contract.contract_id);
        if (vosForContract.length > 0) {
            contractNames.push(getContractName(contract));
            
            let totalClaimed = 0;
            let totalApproved = 0;
            
            vosForContract.forEach(vo => {
                totalClaimed += Number(vo.claimed_amount) || Number(vo.vo_amount) || 0;
                totalApproved += Number(vo.approved_amount) || 0;
            });
            
            // To display nicely, convert to thousands or millions? 
            // We can just keep it full and let formatter handle it.
            claimedData.push(totalClaimed);
            approvedData.push(totalApproved);
        }
    });

    const options = {
        series: [{
            name: 'NT đề xuất',
            data: claimedData
        }, {
            name: 'QS duyệt',
            data: approvedData
        }],
        chart: { type: 'bar', height: 280, stacked: false },
        colors: ['submitted', 'approved'],
        plotOptions: {
            bar: {
                horizontal: true,
                columnWidth: '55%',
                endingShape: 'rounded',
                dataLabels: { position: 'top' }
            },
        },
        dataLabels: {
            enabled: false
        },
        stroke: { show: true, width: 2, colors: ['transparent'] },
        xaxis: {
            categories: contractNames.length > 0 ? contractNames : ['No Data'],
            labels: {
                formatter: function (val) {
                    return (val / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + " tr";
                }
            }
        },
        yaxis: {
            title: { text: undefined }
        },
        fill: { opacity: 1 },
        tooltip: {
            y: { formatter: function (val) { return formatCurrency(val) } }
        }
    };

    if (barChart) {
        barChart.updateOptions(options);
    } else {
        barChart = new ApexCharts(document.querySelector("#vo-bar-chart"), options);
        barChart.render();
    }
}
