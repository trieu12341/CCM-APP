import { formatCurrencyVND } from '../../app.js';
import { calculateOverviewMetrics, getProjectPackagesData, getRiskAndPendingTasks } from './overview-state.js';

export function renderOverviewDashboard() {
    const metrics = calculateOverviewMetrics();

    // 1. Render KPIs
    document.getElementById('ov-kpi-budget').innerHTML = `${formatCurrencyVND(metrics.totalBudget)} <span>VNĐ</span>`;
    document.getElementById('ov-kpi-committed').innerHTML = `${formatCurrencyVND(metrics.totalCommitted)} <span>VNĐ</span>`;
    document.getElementById('ov-kpi-certified').innerHTML = `${formatCurrencyVND(metrics.totalCertified)} <span>VNĐ</span>`;
    document.getElementById('ov-kpi-savings').innerHTML = `${formatCurrencyVND(metrics.savings)} <span>VNĐ</span>`;
    
    const savingsBar = document.getElementById('ov-kpi-savings-bar');
    if (savingsBar) {
        savingsBar.style.width = `${Math.min(100, metrics.savingsPct)}%`;
        if (metrics.savingsPct > 100) savingsBar.style.backgroundColor = '#ef4444'; // Red if over budget
        else savingsBar.style.backgroundColor = '#10b981'; // Green if within budget
    }

    // 2. Render Charts
    renderOverviewCharts();

    // 3. Render Risk & Pending Tasks
    renderRiskAndPendingTables();
}

function renderOverviewCharts() {
    const packageData = getProjectPackagesData();
    
    // Stacked Bar Chart (Packages)
    if (document.getElementById('ov-chart-packages')) {
        const options = {
            series: [
                { name: 'Original Contract', data: packageData.map(d => d.original) },
                { name: 'Approved VO', data: packageData.map(d => d.vo) },
                { name: 'Certified', data: packageData.map(d => d.certified) }
            ],
            chart: { type: 'bar', height: 300, stacked: true },
            xaxis: { categories: packageData.map(d => d.name) },
            yaxis: { 
                labels: { formatter: (val) => formatCurrencyVND(val) }
            },
            colors: ['#3b82f6', '#f59e0b', '#10b981'],
            fill: { opacity: 1 },
            legend: { position: 'bottom' }
        };

        if (window.ovPackagesChart) window.ovPackagesChart.destroy();
        window.ovPackagesChart = new ApexCharts(document.querySelector("#ov-chart-packages"), options);
        window.ovPackagesChart.render();
    }

    // S-Curve Chart (Placeholder logic for S-Curve, using cumulative data over time if available. For now, simple line chart)
    if (document.getElementById('ov-chart-scurve')) {
        const options = {
            series: [
                { name: 'Budget Baseline', type: 'area', data: packageData.map(d => d.original + d.vo + 1000000000) }, // Mock S-Curve plan
                { name: 'Actual Certified', type: 'line', data: packageData.map(d => d.certified) }
            ],
            chart: { type: 'line', height: 300 },
            stroke: { curve: 'smooth', width: [0, 3] },
            fill: { type: ['solid', 'solid'], opacity: [0.1, 1] },
            xaxis: { categories: packageData.map(d => d.name) },
            yaxis: { labels: { formatter: (val) => formatCurrencyVND(val) } },
            colors: ['#94a3b8', '#10b981'],
            legend: { position: 'bottom' }
        };

        if (window.ovSCurveChart) window.ovSCurveChart.destroy();
        window.ovSCurveChart = new ApexCharts(document.querySelector("#ov-chart-scurve"), options);
        window.ovSCurveChart.render();
    }
}

function renderRiskAndPendingTables() {
    const data = getRiskAndPendingTasks();
    
    // Risk Table
    const riskBody = document.getElementById('ov-risk-table-body');
    if (riskBody) {
        if (data.risks.length === 0) {
            riskBody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:#64748b;">Không có rủi ro nào.</td></tr>';
        } else {
            riskBody.innerHTML = data.risks.map(r => `
                <tr>
                    <td style="font-weight: 600;">${r.package}</td>
                    <td style="color: #ef4444;">${r.issue}</td>
                </tr>
            `).join('');
        }
    }

    // Pending Table
    const pendingBody = document.getElementById('ov-pending-table-body');
    if (pendingBody) {
        if (data.pendingTasks.length === 0) {
            pendingBody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#64748b;">Không có tác vụ chờ.</td></tr>';
        } else {
            pendingBody.innerHTML = data.pendingTasks.map(p => `
                <tr>
                    <td><span class="badge ${p.type === 'Variation Order' ? 'bg-orange' : 'bg-blue'}">${p.type}</span></td>
                    <td style="font-weight: 600;">${p.name}</td>
                    <td class="text-right" style="font-weight: 600;">${formatCurrencyVND(p.value)}</td>
                </tr>
            `).join('');
        }
    }
}
