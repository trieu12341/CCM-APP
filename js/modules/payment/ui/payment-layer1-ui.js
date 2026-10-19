import { periodLabel } from '../ipc-chain.js';
import { escapeHtml } from '../../../utils/formatters.js';
/**
 * payment-layer1-ui.js
 * Layer 1: Executive Payment Dashboard
 * - Top 4 KPI Cards (Compact style)
 * - Payment Trend & Certified vs Paid chart (ApexCharts)
 * - Pending IPCs table
 */

import { state, formatCurrencyVND, formatCurrencyShort } from '../../../app.js';
import { getPaymentsByProject } from '../payment-state.js';
import { calcPaymentKPIs, calcPaymentTrend, calcPendingIPCs, daysToDue } from '../payment-calc.js';

let trendChartInstance = null;

// ─────────────────────────────────────────────────────────────
// MAIN RENDER
// ─────────────────────────────────────────────────────────────

export function renderPaymentDashboard() {
    const projectId = state.currentProjectId;
    if (!projectId) return;

    const payments = getPaymentsByProject(projectId);
    const contracts = (state.appData.Contracts || []).filter(c => c.project_id === projectId);

    renderKPICards(payments, contracts);
    renderTrendChart(payments);
    renderPendingTable(payments);
}

// ─────────────────────────────────────────────────────────────
// KPI CARDS
// ─────────────────────────────────────────────────────────────

function renderKPICards(payments, contracts) {
    const kpis = calcPaymentKPIs(payments, contracts);

    const setKPI = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = `${formatCurrencyVND(value)} <span>VNĐ</span>`;
    };

    setKPI('pay-kpi-active-contracts', kpis.totalActiveContracts);
    setKPI('pay-kpi-submitted', kpis.totalSubmitted);
    setKPI('pay-kpi-approved', kpis.totalApproved);
    setKPI('pay-kpi-paid', kpis.totalPaid);

    // Sub-labels
    const countEl = document.getElementById('pay-kpi-ipc-count');
    if (countEl) countEl.textContent = `${payments.length} IPC`;

    const pendingEl = document.getElementById('pay-kpi-pending-count');
    const pending = payments.filter(p => p.status === 'Draft' || p.status === 'Reviewing').length;
    if (pendingEl) pendingEl.textContent = `${pending} chờ duyệt`;
}

// ─────────────────────────────────────────────────────────────
// TREND CHART
// ─────────────────────────────────────────────────────────────

function renderTrendChart(payments) {
    const chartEl = document.getElementById('pay-trend-chart');
    if (!chartEl || typeof ApexCharts === 'undefined') return;

    const trend = calcPaymentTrend(payments);

    if (trendChartInstance) {
        trendChartInstance.destroy();
        trendChartInstance = null;
    }

    // If no data, show empty state
    if (trend.categories.length === 0) {
        chartEl.innerHTML = `
            <div style="height:260px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#94a3b8;gap:8px;">
                <i class="fa-regular fa-chart-bar" style="font-size:2rem;"></i>
                <span style="font-size:13px;">Chưa có dữ liệu IPC để hiển thị biểu đồ</span>
            </div>`;
        return;
    }

    const options = {
        chart: {
            type: 'bar',
            height: 260,
            stacked: false,
            toolbar: { show: false },
            fontFamily: 'Inter, sans-serif',
            background: 'transparent',
        },
        series: [
            { name: 'Giá trị Trình (Submitted)', data: trend.submitted },
            { name: 'Đã Phê duyệt (Certified)', data: trend.certified },
            { name: 'Đã Thanh toán (Paid)', data: trend.paid },
        ],
        xaxis: {
            categories: trend.categories,
            labels: { style: { fontSize: '11px' } },
        },
        yaxis: {
            labels: {
                formatter: v => formatCurrencyShort(v),
                style: { fontSize: '10px' },
            },
        },
        colors: ['#3b82f6', '#10b981', '#8b5cf6'],
        plotOptions: {
            bar: { borderRadius: 4, columnWidth: '65%' },
        },
        dataLabels: { enabled: false },
        legend: { position: 'top', fontSize: '12px' },
        grid: { borderColor: '#f1f5f9', strokeDashArray: 3 },
        tooltip: {
            y: { formatter: v => `${formatCurrencyVND(v)} VNĐ` },
        },
    };

    trendChartInstance = new ApexCharts(chartEl, options);
    trendChartInstance.render();
}

// ─────────────────────────────────────────────────────────────
// PENDING IPCs TABLE
// ─────────────────────────────────────────────────────────────

function renderPendingTable(payments) {
    const tbody = document.getElementById('pay-pending-tbody');
    if (!tbody) return;

    const pending = calcPendingIPCs(payments);

    if (pending.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center;padding:24px 0;color:#94a3b8;">
                    <i class="fa-regular fa-circle-check" style="margin-right:6px;"></i>
                    Không có hồ sơ nào đang chờ xử lý
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = pending.map(p => {
        const days = daysToDue(p.due_date);
        const urgencyClass = days !== null
            ? (days < 0 ? 'urgency-overdue' : days <= 7 ? 'urgency-soon' : '')
            : '';
        const daysLabel = days === null ? '—'
            : days < 0 ? `<span class="overdue-badge">Quá hạn ${Math.abs(days)}n</span>`
            : days === 0 ? `<span class="urgency-badge-today">Hôm nay</span>`
            : `${days} ngày`;

        return `
            <tr class="pending-row ${urgencyClass}" data-ipc-id="${p.ipc_id}" style="cursor:pointer;">
                <td><span class="ipc-code">${p.ipc_id.replace('ipc-', 'IPC-')}</span></td>
                <td>
                    <div style="font-weight:600;font-size:13px;">${escapeHtml(p.contract_name) || '—'}</div>
                    <div style="font-size:11px;color:#64748b;">${escapeHtml(p.contractor_name) || ''}</div>
                </td>
                <td style="text-align:center;">${periodLabel(p)}</td>
                <td>${formatCurrencyShort(p.gross_work_done)}</td>
                <td style="text-align:center;">${daysLabel}</td>
                <td style="text-align:center;">${getStatusBadge(p.status)}</td>
            </tr>`;
    }).join('');
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

export function getStatusBadge(status) {
    const map = {
        'Draft':     { label: 'Draft',     cls: 'badge-draft' },
        'Reviewing': { label: 'Đang xét',  cls: 'badge-reviewing' },
        'Approved':  { label: 'Đã duyệt',  cls: 'badge-approved' },
        'Paid':      { label: 'Đã TT',     cls: 'badge-paid' },
    };
    const info = map[status] || { label: status, cls: '' };
    return `<span class="status-badge ${info.cls}">${escapeHtml(info.label)}</span>`;
}

