import { state } from '../../app.js';
import { calculateFinalAccount, getContractsForProject } from './final-state.js';

const formatCurrencyVND = (num) => new Intl.NumberFormat('vi-VN').format(Math.round(num || 0));

let charts = {};

export function renderFinalDashboard() {
    if (!state.currentProjectId) return;
    const contracts = getContractsForProject();

    let totalApprovedFinal = 0;
    let closedCount = 0;
    let totalRetention = 0;
    let finalBalance = 0;

    let chartData = {
        draft: 0, reviewing: 0, agreed: 0, closed: 0
    };
    
    let barCategories = [];
    let originalValues = [];
    let finalValues = [];

    contracts.forEach(contract => {
        const finalAcc = calculateFinalAccount(contract.contract_id);
        if (!finalAcc) return;

        // KPI
        if (contract.status === 'Closed') {
            closedCount++;
            totalApprovedFinal += finalAcc.c;
            totalRetention += finalAcc.fDefault; 
            finalBalance += finalAcc.gDefault;
        }

        // Doughnut Chart Data (Mapping from simple status)
        const st = contract.status || 'Active';
        if (st === 'Closed') chartData.closed++;
        else if (st === 'Active') chartData.reviewing++; // Assume active means in progress/reviewing

        // Bar Chart Data
        barCategories.push(contract.package_name || contract.contract_id);
        originalValues.push(finalAcc.a / 1e9); // Convert to billions
        finalValues.push(finalAcc.c / 1e9);
    });

    document.getElementById('final-kpi-total').innerHTML = `${formatCurrencyVND(totalApprovedFinal)} <span>VNĐ</span>`;
    document.getElementById('final-kpi-closed').textContent = `${closedCount} / ${contracts.length}`;
    document.getElementById('final-kpi-retention').innerHTML = `${formatCurrencyVND(totalRetention)} <span>VNĐ</span>`;
    document.getElementById('final-kpi-balance').innerHTML = `${formatCurrencyVND(finalBalance)} <span>VNĐ</span>`;

    renderCharts(chartData, barCategories, originalValues, finalValues);
    renderFinalTable(contracts);
}

function renderCharts(doughnutData, barCategories, originalValues, finalValues) {
    if (typeof ApexCharts === 'undefined') return;

    if (charts.doughnut) charts.doughnut.destroy();
    if (charts.bar) charts.bar.destroy();

    const dOptions = {
        series: [doughnutData.reviewing, doughnutData.closed],
        chart: { type: 'donut', height: 300, toolbar: { show: false } },
        labels: ['In Progress', 'Closed'],
        colors: ['#3b82f6', '#10b981'],
        dataLabels: { enabled: true }
    };
    charts.doughnut = new ApexCharts(document.querySelector('#final-doughnut-chart'), dOptions);
    charts.doughnut.render();

    const bOptions = {
        series: [
            { name: 'Giá trị gốc (Tỷ VNĐ)', data: originalValues },
            { name: 'Quyết toán (Tỷ VNĐ)', data: finalValues }
        ],
        chart: { type: 'bar', height: 300, toolbar: { show: false } },
        plotOptions: { bar: { horizontal: false, columnWidth: '55%', endingShape: 'rounded' } },
        dataLabels: { enabled: false },
        stroke: { show: true, width: 2, colors: ['transparent'] },
        xaxis: { categories: barCategories },
        yaxis: { title: { text: 'Tỷ VNĐ' } },
        fill: { opacity: 1 },
        colors: ['#94a3b8', '#0ea5e9']
    };
    charts.bar = new ApexCharts(document.querySelector('#final-bar-chart'), bOptions);
    charts.bar.render();
}

export function renderFinalTable(contracts = getContractsForProject()) {
    const tbody = document.getElementById('final-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (contracts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center">Không có hợp đồng nào.</td></tr>`;
        return;
    }

    contracts.forEach(contract => {
        const finalAcc = calculateFinalAccount(contract.contract_id);
        const tr = document.createElement('tr');
        
        let statusBadge = contract.status === 'Closed' 
            ? `<span class="badge badge-success">Closed</span>`
            : `<span class="badge badge-warning">Active</span>`;

        tr.innerHTML = `
            <td>${contract.contract_id}</td>
            <td><strong>${contract.package_name || 'N/A'}</strong><br><small class="text-muted">${contract.contractor_name || 'N/A'}</small></td>
            <td class="text-right">${formatCurrencyVND(finalAcc.a)}</td>
            <td class="text-right text-blue">${formatCurrencyVND(finalAcc.b)}</td>
            <td class="text-right fw-bold text-blue">${formatCurrencyVND(finalAcc.c)}</td>
            <td class="text-right text-danger">${formatCurrencyVND(finalAcc.d)}</td>
            <td class="text-right fw-bold text-orange">${formatCurrencyVND(finalAcc.gDefault)}</td>
            <td class="text-center">${statusBadge}</td>
            <td class="text-center">
                <button class="btn btn-sm btn-outline btn-open-final" data-id="${contract.contract_id}">
                    <i class="fa-solid fa-folder-open"></i> Chi tiết
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.querySelectorAll('.btn-open-final').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const contractId = e.currentTarget.getAttribute('data-id');
            renderFinalBreakdown(contractId);
            document.getElementById('final-breakdown-workspace').classList.remove('hidden');
        });
    });
}

export function renderFinalBreakdown(contractId) {
    const finalAcc = calculateFinalAccount(contractId);
    if (!finalAcc) return;

    document.getElementById('final-contract-badge').textContent = `Hợp Đồng: ${finalAcc.contract.contract_id} - ${finalAcc.contract.package_name}`;
    
    document.getElementById('final-val-a').textContent = `${formatCurrencyVND(finalAcc.a)} VNĐ`;
    document.getElementById('final-val-b').textContent = `${formatCurrencyVND(finalAcc.b)} VNĐ`;
    document.getElementById('final-val-c').textContent = `${formatCurrencyVND(finalAcc.c)} VNĐ`;
    document.getElementById('final-val-d').textContent = `${formatCurrencyVND(finalAcc.d)} VNĐ`;
    document.getElementById('final-val-e').textContent = `${formatCurrencyVND(finalAcc.e)} VNĐ`;
    
    // Store data to DOM for recalculation
    const workspace = document.getElementById('final-breakdown-workspace');
    workspace.dataset.contractId = contractId;
    workspace.dataset.c = finalAcc.c;
    workspace.dataset.d = finalAcc.d;
    workspace.dataset.e = finalAcc.e;

    // Trigger recalculation to update F and G
    recalculateFinalRetentionAndBalance();
    
    // Check if closed
    const submitBtn = document.getElementById('btn-submit-final');
    if (finalAcc.contract.status === 'Closed') {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-check"></i> ĐÃ QUYẾT TOÁN`;
        submitBtn.style.backgroundColor = '#10b981'; // Success green
    } else {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class="fa-solid fa-lock"></i> CHỐT QUYẾT TOÁN & ĐÓNG HỢP ĐỒNG`;
        submitBtn.style.backgroundColor = 'var(--danger-color)';
    }
}

export function recalculateFinalRetentionAndBalance() {
    const workspace = document.getElementById('final-breakdown-workspace');
    if (!workspace) return;
    
    const c = parseFloat(workspace.dataset.c) || 0;
    const d = parseFloat(workspace.dataset.d) || 0;
    const e = parseFloat(workspace.dataset.e) || 0;

    const retentionType = document.querySelector('input[name="final-retention-type"]:checked').value;
    let f = 0;
    if (retentionType === 'percent') {
        const pct = parseFloat(document.getElementById('final-retention-pct').value) || 0;
        f = c * (pct / 100);
    } // else 'guarantee' -> f = 0

    const g = c - d - e - f;

    document.getElementById('final-val-f').textContent = `${formatCurrencyVND(f)} VNĐ`;
    document.getElementById('final-val-g').textContent = `${formatCurrencyVND(g)} VNĐ`;
    
    workspace.dataset.f = f;
    workspace.dataset.g = g;
}
