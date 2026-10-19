/**
 * cashflow-ui-progress.js — Các biểu đồ tiến độ dòng tiền của tab Cashflow:
 *  - cf-chart-2: phần đã duyệt / còn lại theo từng hợp đồng
 *  - cf-chart-3: lũy kế Kế hoạch vs Đã duyệt (thực tế)
 *  - cf-chart-4: lũy kế Kế hoạch vs Đã duyệt vs Đã trả
 * Số thực tế = tiền thanh toán trước thuế, gồm tạm ứng (cùng cơ sở đường kế hoạch).
 */
import { state, formatCurrency, getDynamicContractValue } from '../app.js';
import { paymentTotals, paymentsByMonth, cumulativeSeries, isApprovedIPC } from '../modules/payment/payment-metrics.js';
import { getContractName } from '../core/contract-fields.js';

const B = 1e9;
const toB = (v) => (v === null ? null : Math.round(v / B * 1000) / 1000);
const label = (k) => { const [y, m] = k.split('-'); return `${m}/${y}`; };
const nowKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const tooltip = { y: { formatter: (v) => (v === null || v === undefined ? '—' : formatCurrency(v * B)) } };
const lineChart = (series, colors, categories) => ({
    series, colors,
    chart: { type: 'line', height: '100%', toolbar: { show: true, tools: { zoom: true, pan: true, reset: true, download: true } } },
    stroke: { curve: 'smooth', width: series.map((_, i) => (i === 0 ? 3 : 2.5)), dashArray: series.map((_, i) => (i === 0 ? 5 : 0)) },
    markers: { size: series.map((_, i) => (i === 0 ? 0 : 4)), strokeWidth: 0 },
    xaxis: { categories, tickAmount: Math.min(12, categories.length) },
    yaxis: { labels: { formatter: (v) => (Number(v) || 0).toFixed(1) + ' Tỷ' } },
    legend: { position: 'top' }, tooltip,
});

/**
 * @param {Object} planByMonth { 'YYYY-MM': số tiền kế hoạch trong tháng }
 * @returns {Array} các ApexCharts chưa render
 */
export function buildProgressCharts(planByMonth = {}) {
    const pid = state.currentProjectId;
    const payments = state.appData.Payments || [];
    const cert = paymentsByMonth(payments, 'certified', pid);
    const paid = paymentsByMonth(payments, 'paid', pid);

    const keys = [...new Set([...Object.keys(planByMonth), ...Object.keys(cert), ...Object.keys(paid)])].sort();
    // Lũy kế xuất phát từ 0: thêm tháng liền trước tháng đầu tiên → đường thực tế luôn
    // thành một đoạn nhìn thấy được, kể cả khi mới có một đợt thanh toán.
    if (keys.length) {
        const [y, m] = keys[0].split('-').map(Number);
        const d = new Date(y, m - 2, 1);
        keys.unshift(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    const cats = keys.length ? keys.map(label) : ['(Chưa có dữ liệu)'];
    const now = nowKey();
    const plan = keys.length ? cumulativeSeries(keys, planByMonth).map(toB) : [0];
    const certS = keys.length ? cumulativeSeries(keys, cert, now).map(toB) : [0];
    const paidS = keys.length ? cumulativeSeries(keys, paid, now).map(toB) : [0];

    const charts = [];
    const el3 = document.querySelector('#cf-chart-3');
    if (el3) charts.push(new ApexCharts(el3, lineChart([
        { name: 'Kế hoạch (lũy kế)', data: plan },
        { name: 'Đã duyệt thực tế (lũy kế)', data: certS },
    ], ['#94a3b8', '#10b981'], cats)));
    const el4 = document.querySelector('#cf-chart-4');
    if (el4) charts.push(new ApexCharts(el4, lineChart([
        { name: 'Kế hoạch (lũy kế)', data: plan },
        { name: 'Đã duyệt', data: certS },
        { name: 'Đã trả', data: paidS },
    ], ['#94a3b8', '#10b981', '#f97316'], cats)));

    // Phần đã duyệt / còn lại theo hợp đồng (giá trị HĐ gồm VO đã duyệt)
    const contracts = (state.appData.Contracts || []).filter(c => c.project_id === pid && c.status !== 'Closed');
    const rows = contracts.map(c => {
        const value = getDynamicContractValue(c, state.appData);
        const done = paymentTotals(payments, { contractId: c.contract_id, filter: isApprovedIPC }).paymentExVat;
        return { name: getContractName(c) || c.contract_id, done: Math.min(done, value), left: Math.max(0, value - done) };
    }).filter(r => r.done + r.left > 0).sort((a, b) => (b.done + b.left) - (a.done + a.left)).slice(0, 12);
    const el2 = document.querySelector('#cf-chart-2');
    if (el2) charts.push(new ApexCharts(el2, {
        series: rows.length
            ? [{ name: 'Đã duyệt', data: rows.map(r => toB(r.done)) }, { name: 'Còn lại', data: rows.map(r => toB(r.left)) }]
            : [{ name: 'Chưa có hợp đồng', data: [0] }],
        chart: { type: 'bar', height: 250, stacked: true, toolbar: { show: false } },
        plotOptions: { bar: { horizontal: true, barHeight: '60%' } },
        colors: ['#10b981', '#cbd5e1'],
        dataLabels: { enabled: false },
        xaxis: { categories: rows.length ? rows.map(r => r.name.length > 28 ? r.name.slice(0, 27) + '…' : r.name) : ['-'],
            labels: { formatter: (v) => (Number(v) || 0).toFixed(1) + ' Tỷ' } },
        legend: { position: 'top' }, tooltip,
    }));
    return charts;
}
