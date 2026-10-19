import { paymentTotals, isApprovedIPC, isPaidIPC } from '../modules/payment/payment-metrics.js';
import { state, formatCurrency, formatCurrencyVND, getContractBudgetValue, getDynamicContractValue } from '../app.js';
import { getLocalCashflow } from './cashflow-state.js';
import { calculateForecastEngine, calculatePackageTotalPlanned } from './cashflow-calc.js';
import { buildProgressCharts } from './cashflow-ui-progress.js';
import { parseCurrencyInput } from '../utils/formatters.js';

let chartInstances = [];

export function renderCashflow() {
    if (!state.currentProjectId) return;
    
    chartInstances.forEach(c => c.destroy());
    chartInstances = [];

    let contracts = state.appData.Contracts || [];
    
    let budget = 0;
    if (state.appData.Budgets) {
        state.appData.Budgets.filter(b => b.project_id === state.currentProjectId).forEach(b => {
            budget += Number(b.budgeted) || 0;
        });
    }

    let revised = 0;
    contracts.filter(c => c.project_id === state.currentProjectId).forEach(c => {
        const status = c.status || 'Active';
        if (status !== 'Active') return;
        revised += getDynamicContractValue(c, state.appData);
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
    
    // Single Source of Truth for Payments
    if (state.appData.Payments) {
        const pid = state.currentProjectId;
        // Tab dòng tiền: Duyệt và Đã trả CÙNG một cơ sở — tiền thanh toán trước thuế, gồm tạm ứng
        // (= tạm ứng + Σ(14)), khớp đường kế hoạch netPayable (cũng gồm tạm ứng). Nhờ vậy Đã trả ≤ Đã duyệt.
        totalCertified = paymentTotals(state.appData.Payments, { projectId: pid, filter: isApprovedIPC }).paymentExVat;
        totalPaid = paymentTotals(state.appData.Payments, { projectId: pid, filter: isPaidIPC }).paymentExVat;
    }

    let monthlyData = {}; 

    cashflows.filter(c => c.project_id === state.currentProjectId).forEach(c => {
        const val = c.is_construction ? (Number(c.netPayable) || Number(c.total_cert) || 0) : (Number(c.value) || 0);
        
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

    // Biểu đồ tiến độ: kế hoạch vs thực tế (đã duyệt / đã trả) + phần còn lại theo HĐ
    const planByMonth = {};
    Object.keys(monthlyData).forEach(k => { planByMonth[k] = monthlyData[k].plan; });
    chartInstances.push(...buildProgressCharts(planByMonth));

    chartInstances.forEach(c => c.render());
}
