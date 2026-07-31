import { state, formatCurrency, formatCurrencyVND } from '../app.js';
import { getLocalCashflow } from './cashflow-state.js';
import { calculateForecastEngine, calculatePackageTotalPlanned } from './cashflow-calc.js';

let chartInstances = [];

export function renderCashflow() {
    if (!state.currentProjectId) return;
    
    chartInstances.forEach(c => c.destroy());
    chartInstances = [];

    let contracts = state.appData.Contracts || [];
    
    let budget = 0;
    let revised = 0;
    contracts.filter(c => c.project_id === state.currentProjectId).forEach(c => {
        budget += (Number(c.budget_value) || 0);
        revised += (Number(c.total_value) || 0);
    });

    let cashflows = getLocalCashflow();
    
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
    
    let monthlyData = {}; 

    cashflows.filter(c => c.project_id === state.currentProjectId).forEach(c => {
        const val = c.is_construction ? (Number(c.netPayable) || Number(c.total_cert) || 0) : (Number(c.value) || 0);
        
        if (c.status === 'Certified' || c.status === 'Paid') {
            totalCertified += val;
        }
        if (c.status === 'Paid') {
            totalPaid += val;
        }
        
        if (c.date) {
            const parts = c.date.split('-');
            if (parts.length >= 2) {
                const monthKey = `${parts[0]}-${parts[1]}`;
                const displayKey = `${parts[1]}/${parts[0]}`; 
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

    const totalPlan = calculatePackageTotalPlanned(cashflows.filter(c => c.project_id === state.currentProjectId));

    const setKPIHtml = (id, html) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = html;
    };
    const setKPIText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    setKPIHtml('cf-kpi-budget', `${formatCurrencyVND(kpiData.budget)} <span>VNĐ</span>`);
    setKPIHtml('cf-kpi-revised', `${formatCurrencyVND(kpiData.revised)} <span>VNĐ</span>`);
    setKPIHtml('cf-kpi-planned', `${formatCurrencyVND(totalPlan)} <span>VNĐ</span>`);
    setKPIHtml('cf-kpi-certified', `${formatCurrencyVND(kpiData.certified)} <span>VNĐ</span>`);
    setKPIHtml('cf-kpi-balance', `${formatCurrencyVND(kpiData.balance)} <span>VNĐ</span>`);
    setKPIHtml('cf-kpi-paid', `${formatCurrencyVND(kpiData.paid)} <span>VNĐ</span>`);
    setKPIText('cf-kpi-pct-paid', kpiData.pctPaid + '%');
    setKPIText('cf-kpi-pct-certified', kpiData.pctCertified + '%');

    const budgetB = budget > 0 ? budget / 1000000000 : 0;
    const revisedB = revised > 0 ? revised / 1000000000 : 0;

    var options1 = {
        series: [{ name: 'Project Budget', data: [budgetB] }, { name: 'Revised Total Contract', data: [revisedB] }],
        chart: { type: 'bar', height: 250, toolbar: { show: false } },
        colors: ['#3b82f6', '#f97316'],
        plotOptions: { bar: { horizontal: false, columnWidth: '40%' } },
        dataLabels: { enabled: false },
        xaxis: { categories: ['Total Value (Tỷ VNĐ)'] },
        yaxis: { labels: { formatter: (val) => val.toFixed(1) + ' Tỷ' } },
        tooltip: {
            y: { formatter: function (val) { return formatCurrency(val * 1000000000); } }
        }
    };
    chartInstances.push(new ApexCharts(document.querySelector("#cf-chart-1"), options1));

    const sortedKeys = Object.keys(monthlyData).sort();
    let cumulativePlanData = [];
    let cumulativeLabels = [];
    let currentCumulative = 0;
    
    if (sortedKeys.length === 0) {
        cumulativeLabels = ['(No Data)'];
        cumulativePlanData = [0];
    } else {
        sortedKeys.forEach(k => {
            currentCumulative += monthlyData[k].plan;
            cumulativePlanData.push(currentCumulative / 1000000000); 
            cumulativeLabels.push(monthlyData[k].display);
        });
    }
    
    var options2 = {
        series: [{ name: 'No Data', data: [0] }],
        chart: { type: 'bar', height: 250, stacked: true, toolbar: { show: false } },
        xaxis: { categories: ['-'] },
        yaxis: { labels: { formatter: (val) => val + ' Tỷ' } }
    };
    chartInstances.push(new ApexCharts(document.querySelector("#cf-chart-2"), options2));

    var options3 = {
        series: [{
            name: 'Planned Cumulative (Tỷ VNĐ)',
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
        yaxis: { labels: { formatter: (val) => val.toFixed(1) + ' Tỷ' } },
        legend: { position: 'top' },
        tooltip: {
            y: { formatter: function (val) { return formatCurrency(val * 1000000000); } }
        }
    };
    chartInstances.push(new ApexCharts(document.querySelector("#cf-chart-3"), options3));

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
        yaxis: { labels: { formatter: (val) => val.toFixed(1) + ' Tỷ' } },
        legend: { position: 'top' },
        tooltip: {
            y: { formatter: function (val) { return formatCurrency(val * 1000000000); } }
        }
    };
    chartInstances.push(new ApexCharts(document.querySelector("#cf-chart-4"), options4));

    chartInstances.forEach(c => c.render());
}
