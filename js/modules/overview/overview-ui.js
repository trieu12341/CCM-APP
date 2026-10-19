import { formatCurrencyVND, formatCurrency } from '../../app.js';
import { setTone } from '../../utils/formatters.js';
import { progressSeries, projectPlanByMonth } from '../../cashflow/cashflow-ui-progress.js';
import { calculateOverviewMetrics } from './overview-state.js';

export function renderOverviewDashboard() {
    const metrics = calculateOverviewMetrics();

    // HÀNG 1: TOP EXECUTIVE KPI CARDS
    document.getElementById('ow2-budget-approved').textContent = formatCurrencyVND(metrics.budget.approved);
    document.getElementById('ow2-budget-committed').textContent = formatCurrencyVND(metrics.budget.committed);
    
    document.getElementById('ow2-commit-pct').textContent = metrics.budget.pct.toFixed(1) + '%';
    const commitBar = document.getElementById('ow2-commit-bar');
    if (commitBar) {
        commitBar.style.width = Math.min(100, metrics.budget.pct) + '%';
        commitBar.className = metrics.budget.pct > 100 ? 'bento-progress-fill bg-red-500' : 'bento-progress-fill bg-cyan-500';
    }

    document.getElementById('ow2-pay-paid').textContent = formatCurrencyVND(metrics.payment.expended ?? metrics.payment.paid);
    document.getElementById('ow2-pay-pct').textContent = metrics.payment.pct.toFixed(1) + '%';
    const payBar = document.getElementById('ow2-pay-bar');
    if (payBar) {
        payBar.style.width = Math.min(100, metrics.payment.pct) + '%';
    }

    const uncommitted = metrics.budget.approved - metrics.budget.committed;
    const uncommittedPct = metrics.budget.approved > 0 ? (uncommitted / metrics.budget.approved) * 100 : 0;
    
    document.getElementById('ow2-budget-uncommitted').textContent = formatCurrencyVND(uncommitted);
    setTone(document.getElementById('ow2-budget-uncommitted'), uncommitted);
    document.getElementById('ow2-uncommit-pct').textContent = uncommittedPct.toFixed(1) + '%';
    const uncommitBar = document.getElementById('ow2-uncommit-bar');
    if (uncommitBar) {
        uncommitBar.style.width = Math.min(100, uncommittedPct) + '%';
        if (uncommitted < 0) {
            uncommitBar.className = 'bento-progress-fill bg-red-500';
            document.getElementById('ow2-uncommit-pct').textContent = 'Over Budget';
        } else {
            uncommitBar.className = 'bento-progress-fill bg-purple-500';
        }
    }

    // HÀNG 2 - CỘT TRÁI: TENDER PIPELINE
    document.getElementById('ow2-tender-awarded').textContent = metrics.tender.awarded;
    document.getElementById('ow2-tender-eval').textContent = metrics.tender.eval;
    document.getElementById('ow2-tender-bidding').textContent = metrics.tender.bidding;
    document.getElementById('ow2-tender-draft').textContent = metrics.tender.draft;
    renderTenderDonut(metrics.tender);

    // HÀNG 2 - CỘT TRÁI: CONTRACT & VO
    document.getElementById('ow2-contract-original').textContent = formatCurrencyVND(metrics.contract.original) + ' VNĐ';
    document.getElementById('ow2-contract-vo').textContent = formatCurrencyVND(metrics.contract.vo) + ' VNĐ';
    document.getElementById('ow2-contract-revised').textContent = formatCurrencyVND(metrics.contract.revised) + ' VNĐ';
    document.getElementById('ow2-contract-vo-pct').textContent = metrics.contract.voPct.toFixed(1) + '%';
    const voBar = document.getElementById('ow2-contract-vo-bar');
    if (voBar) {
        voBar.style.width = Math.min(100, metrics.contract.voPct) + '%';
    }

    // HÀNG 2 - CỘT PHẢI: CASHFLOW S-CURVE
    renderMiniSCurve();
    document.getElementById('ow2-pay-paid-bottom').textContent = formatCurrencyVND(metrics.payment.paid) + ' VNĐ';
    document.getElementById('ow2-pay-advance').textContent = formatCurrencyVND(metrics.payment.advance) + ' VNĐ';
    document.getElementById('ow2-pay-retention').textContent = formatCurrencyVND(metrics.payment.retention) + ' VNĐ';
}

function renderTenderDonut(tenderMetrics) {
    if (!document.getElementById('ow2-tender-donut')) return;
    
    const total = tenderMetrics.awarded + tenderMetrics.eval + tenderMetrics.bidding + tenderMetrics.draft;
    const series = total === 0 ? [0, 0, 0, 1] : [tenderMetrics.awarded, tenderMetrics.eval, tenderMetrics.bidding, tenderMetrics.draft];
    
    const options = {
        series: series,
        chart: { type: 'donut', height: 140, sparkline: { enabled: true } },
        colors: ['approved', 'submitted', 'plan', 'track'],
        labels: ['Đã trao thầu', 'Đang chấm', 'Đang mời thầu', 'Chưa chạy'],
        stroke: { width: 0 },
        tooltip: {
            fixed: { enabled: false },
            x: { show: true },
            y: { title: { formatter: function (seriesName) { return seriesName } } },
            marker: { show: false }
        },
        plotOptions: {
            pie: {
                donut: {
                    size: '70%',
                    labels: {
                        show: true,
                        name: { show: false },
                        value: {
                            show: true,
                            fontSize: '16px',
                            fontWeight: 700,
                            formatter: function (val) {
                                return total === 0 ? "0" : val;
                            }
                        },
                        total: {
                            show: true,
                            showAlways: true,
                            label: 'Total',
                            fontSize: '12px',
                            fontWeight: 600,
                            formatter: function (w) {
                                return total;
                            }
                        }
                    }
                }
            }
        }
    };

    if (window.owTenderDonut) window.owTenderDonut.destroy();
    window.owTenderDonut = new ApexCharts(document.querySelector("#ow2-tender-donut"), options);
    window.owTenderDonut.render();
}

function renderMiniSCurve() {
    if (!document.getElementById('ow2-cashflow-chart')) return;
    // Số thật của dự án (trước đây là dữ liệu mẫu cố định): lũy kế kế hoạch / đã duyệt / đã trả, tỷ VNĐ
    const { cats, plan, certS, paidS } = progressSeries(projectPlanByMonth());
    const options = {
        series: [
            { name: 'Kế hoạch', data: plan },
            { name: 'Đã duyệt', data: certS },
            { name: 'Đã trả', data: paidS }
        ],
        chart: { type: 'line', height: 320, toolbar: { show: false } },
        stroke: { curve: 'smooth', width: [2.5, 2.5, 2.5], dashArray: [5, 0, 0] },
        colors: ['plan', 'approved', 'paid'],
        xaxis: { categories: cats, tickAmount: Math.min(8, cats.length) },
        yaxis: { labels: { formatter: (v) => (v === null || v === undefined ? '' : (Number(v) || 0).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' tỷ') } },
        tooltip: { y: { formatter: (v) => (v === null || v === undefined ? '—' : formatCurrency(v * 1e9)) } },
        grid: { strokeDashArray: 3 },
        legend: { position: 'top' }
    };

    if (window.owMiniSCurveChart) window.owMiniSCurveChart.destroy();
    window.owMiniSCurveChart = new ApexCharts(document.querySelector("#ow2-cashflow-chart"), options);
    window.owMiniSCurveChart.render();
}
