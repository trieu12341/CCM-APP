import { state, formatCurrency, formatCurrencyVND, formatDate } from '../app.js';
import { tenderState } from './tender-state.js';
import { recalculateCBA, parseFormattedNumber } from './tender-calc.js';

let chartInstances = [];

function isConsultancyTender(tender) {
    if (tender.type) return tender.type === 'Consultancy';
    const name = (tender.tender_name || '').toLowerCase();
    return name.includes('tư vấn') || name.includes('tv');
}

export function renderTenders() {
    try {
        if (!state.appData.Tenders) state.appData.Tenders = [];

        const tenders = state.appData.Tenders.filter(t => t.project_id === state.currentProjectId);

        let totalBudget = 0;
        
        let floatingCount = 0;
        let floatingVal = 0;
        
        let evaluatingCount = 0;
        let evaluatingVal = 0;
        
        let awardedCount = 0;
        let awardedVal = 0;

        let notOpenedVal = 0;

        let consultancyVal = 0;
        let constructionVal = 0;

        tenders.forEach(t => {
            const budget = Number(t.approved_budget) || 0;
            totalBudget += budget;

            if (isConsultancyTender(t)) {
                consultancyVal += budget;
            } else {
                constructionVal += budget;
            }

            const status = t.status || '';
            if (status === 'Floating') {
                floatingCount++;
                floatingVal += budget;
            } else if (status === 'Evaluating' || status === 'Bidding') {
                evaluatingCount++;
                evaluatingVal += budget;
            } else if (status === 'Awarded') {
                awardedCount++;
                awardedVal += budget;
            } else {
                notOpenedVal += budget;
            }
        });

        const elTotalVal = document.getElementById('tender-kpi-total-val');
        if (elTotalVal) elTotalVal.textContent = formatCurrency(totalBudget);

        const elFloatingCount = document.getElementById('tender-kpi-floating-count');
        const elFloatingVal = document.getElementById('tender-kpi-floating-val');
        if (elFloatingCount) elFloatingCount.textContent = floatingCount;
        if (elFloatingVal) elFloatingVal.textContent = `(${formatCurrency(floatingVal)})`;

        const elEvaluatingCount = document.getElementById('tender-kpi-evaluating-count');
        const elEvaluatingVal = document.getElementById('tender-kpi-evaluating-val');
        if (elEvaluatingCount) elEvaluatingCount.textContent = evaluatingCount;
        if (elEvaluatingVal) elEvaluatingVal.textContent = `(${formatCurrency(evaluatingVal)})`;

        const elAwardedCount = document.getElementById('tender-kpi-awarded-count');
        const elAwardedVal = document.getElementById('tender-kpi-awarded-val');
        if (elAwardedCount) elAwardedCount.textContent = awardedCount;
        if (elAwardedVal) elAwardedVal.textContent = `(${formatCurrency(awardedVal)})`;

        // Render Charts
        chartInstances.forEach(c => c.destroy());
        chartInstances = [];

        // Chart 1: Bar Chart (Budget by Status)
        const barOptions = {
            series: [{
                name: 'Ngân sách (Tỷ VNĐ)',
                data: [notOpenedVal / 1e9, floatingVal / 1e9, evaluatingVal / 1e9, awardedVal / 1e9]
            }],
            chart: { type: 'bar', height: 350, toolbar: { show: false } },
            colors: ['#94a3b8', '#f97316', '#3b82f6', '#10b981'],
            plotOptions: { bar: { horizontal: false, columnWidth: '50%', endingShape: 'rounded', distributed: true } },
            dataLabels: { enabled: false },
            legend: { show: false },
            xaxis: { categories: ['Chưa mở / Nháp', 'Đang phát hành', 'Đang chấm thầu', 'Đã trao thầu'] },
            yaxis: { labels: { formatter: (val) => val.toFixed(1) + ' Tỷ' } },
            tooltip: {
                y: { formatter: function (val) { return formatCurrency(val * 1e9); } }
            }
        };
        const barEl = document.querySelector("#tender-chart-bar");
        if (barEl) {
            chartInstances.push(new ApexCharts(barEl, barOptions));
        }

        // Chart 2: Pie Chart (Budget by Type)
        const pieOptions = {
            series: [consultancyVal, constructionVal],
            chart: { type: 'donut', height: 350 },
            labels: ['Tư vấn (Consultancy)', 'Xây dựng / M&E'],
            colors: ['#a855f7', '#3b82f6'],
            dataLabels: { enabled: true, formatter: function (val, opts) { return opts.w.globals.seriesTotals[opts.seriesIndex] > 0 ? val.toFixed(1) + "%" : "" } },
            legend: { position: 'bottom' },
            tooltip: {
                y: { formatter: function (val) { return formatCurrency(val); } }
            }
        };
        const pieEl = document.querySelector("#tender-chart-pie");
        if (pieEl) {
            chartInstances.push(new ApexCharts(pieEl, pieOptions));
        }

        chartInstances.forEach(c => c.render());

        // Render Summary Table
        const tbody = document.getElementById('tender-summary-tbody');
        if (tbody) {
            tbody.innerHTML = '';
            if (tenders.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:1rem; color:var(--text-muted);">Không có Gói thầu nào.</td></tr>`;
            } else {
                tenders.forEach(t => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td style="padding: 0.75rem; border-bottom: 1px solid var(--border-color);">${t.tender_name || '-'}</td>
                        <td style="text-align: right; padding: 0.75rem; border-bottom: 1px solid var(--border-color); font-weight: 500;">${formatCurrency(t.approved_budget || 0)}</td>
                        <td style="text-align: center; padding: 0.75rem; border-bottom: 1px solid var(--border-color);"><span class="status-badge ${t.status ? t.status.toLowerCase() : ''}">${t.status || '-'}</span></td>
                        <td style="text-align: center; padding: 0.75rem; border-bottom: 1px solid var(--border-color);">${t.deadline ? formatDate(t.deadline) : '-'}</td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        }
    } catch (error) {
        console.error('[renderTenders] Exception occurred:', error);
    }
}

export function renderTenderTableModal() {
    const tbodyConsultancy = document.getElementById('tender-tbody-consultancy');
    const tbodyConstruction = document.getElementById('tender-tbody-construction');
    if (!tbodyConsultancy || !tbodyConstruction) return;

    tbodyConsultancy.innerHTML = '';
    tbodyConstruction.innerHTML = '';

    const tenders = state.appData.Tenders.filter(t => t.project_id === state.currentProjectId);

    if (tenders.length === 0) {
        tbodyConstruction.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">Không có Gói thầu nào.</td></tr>`;
        document.getElementById('tender-list-modal').classList.remove('hidden');
        return;
    }

    const createRow = (t) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${t.tender_id || '-'}</td>
            <td>${t.tender_name || '-'}</td>
            <td style="font-weight: 600;">${formatCurrency(t.approved_budget || 0)}</td>
            <td>${t.deadline ? formatDate(t.deadline) : '-'}</td>
            <td><span class="status-badge ${t.status ? t.status.toLowerCase() : ''}">${t.status || '-'}</span></td>
            <td>${t.winner || '-'}</td>
        `;
        tr.style.cursor = 'pointer';
        tr.onclick = () => openTenderDetail(t.tender_id);
        return tr;
    };

    const consultancies = tenders.filter(t => isConsultancyTender(t));
    const constructions = tenders.filter(t => !isConsultancyTender(t));

    if (consultancies.length > 0) {
        const headerTR = document.createElement('tr');
        headerTR.innerHTML = `<td colspan="6" style="background-color: #f1f5f9; font-weight: bold; padding: 0.75rem;">I. Gói thầu Tư vấn</td>`;
        tbodyConsultancy.appendChild(headerTR);
        consultancies.forEach(t => tbodyConsultancy.appendChild(createRow(t)));
    }
    
    if (constructions.length > 0) {
        const headerTR = document.createElement('tr');
        headerTR.innerHTML = `<td colspan="6" style="background-color: #f1f5f9; font-weight: bold; padding: 0.75rem;">II. Gói thầu Xây dựng / M&E</td>`;
        tbodyConstruction.appendChild(headerTR);
        constructions.forEach(t => tbodyConstruction.appendChild(createRow(t)));
    }

    document.getElementById('tender-list-modal').classList.remove('hidden');
}

export function openTenderDetail(tenderId) {
    tenderState.currentTenderDetailId = tenderId;
    const tender = state.appData.Tenders.find(t => t.tender_id === tenderId);
    if (!tender) return;

    // Populate detail fields
    document.getElementById('detail-tender-name').textContent = tender.tender_name || '-';
    document.getElementById('detail-tender-code').textContent = tender.tender_id || '-';
    document.getElementById('detail-tender-status').textContent = tender.status || '-';
    document.getElementById('detail-tender-deadline').textContent = tender.deadline ? formatDate(tender.deadline) : '-';
    document.getElementById('detail-tender-winner').textContent = tender.winner || 'Chưa chốt';
    document.getElementById('detail-tender-final-price').textContent = tender.final_price ? formatCurrency(tender.final_price) : '-';

    if (!tender.cba || tender.cba.rounds.length === 0) {
        document.getElementById('cba-empty-state').classList.remove('hidden');
        document.getElementById('cba-table-view').classList.add('hidden');
        document.getElementById('tender-rounds-tabs').innerHTML = '';
    } else {
        document.getElementById('cba-empty-state').classList.add('hidden');
        document.getElementById('cba-table-view').classList.remove('hidden');
        tenderState.currentRoundIndex = 0;
        renderTenderRoundTabs();
        renderCBATable();
    }

    // Open Layer 3 overlay modal (on top of tender-list-modal)
    const detailModal = document.getElementById('tender-detail-modal');
    if (detailModal) {
        detailModal.classList.remove('hidden');
        document.body.classList.add('modal-open');
    }
}

export function closeTenderDetailModal() {
    const detailModal = document.getElementById('tender-detail-modal');
    if (detailModal) {
        detailModal.classList.add('hidden');
    }
    // Remove modal-open only if no other modal is visible
    const anyVisible = document.querySelector(
        '#tender-list-modal:not(.hidden), #contract-list-modal:not(.hidden), #contract-detail-modal:not(.hidden)'
    );
    if (!anyVisible) document.body.classList.remove('modal-open');
}


export function initCBA() {
    const tender = state.appData.Tenders.find(t => t.tender_id === tenderState.currentTenderDetailId);
    if (!tender) return;

    tender.cba = {
        bidders: [],
        rounds: [
            {
                round_name: "Round 1",
                items: []
            }
        ]
    };

    document.getElementById('cba-empty-state').classList.add('hidden');
    document.getElementById('cba-table-view').classList.remove('hidden');
    tenderState.currentRoundIndex = 0;
    renderTenderRoundTabs();
    renderCBATable();
}

export function renderTenderRoundTabs() {
    const tender = state.appData.Tenders.find(t => t.tender_id === tenderState.currentTenderDetailId);
    if (!tender || !tender.cba) return;

    const tabsContainer = document.getElementById('tender-rounds-tabs');
    if (!tabsContainer) return;
    tabsContainer.innerHTML = '';

    tender.cba.rounds.forEach((round, index) => {
        const a = document.createElement('a');
        a.href = '#';
        a.className = 'tab' + (index === tenderState.currentRoundIndex ? ' active' : '');
        a.innerHTML = `<i class="fa-solid fa-layer-group"></i> ${round.round_name}`;
        a.onclick = (e) => {
            e.preventDefault();
            tenderState.currentRoundIndex = index;
            renderTenderRoundTabs();
            renderCBATable();
        };
        tabsContainer.appendChild(a);
    });
}

export function renderCBATable() {
    const tender = state.appData.Tenders.find(t => t.tender_id === tenderState.currentTenderDetailId);
    if (!tender || !tender.cba) return;

    const round = tender.cba.rounds[tenderState.currentRoundIndex];
    const bidders = tender.cba.bidders;

    const theadTr = document.getElementById('cba-thead-tr');
    if (!theadTr) return;
    let theadHtml = `
        <th style="width: 50px;">STT</th>
        <th style="width: 250px;">DIỄN GIẢI</th>
        <th style="width: 150px; text-align: right; background: #e0f2fe; color: #0284c7;">PTE (Giá TV)</th>
    `;
    bidders.forEach((bidder, idx) => {
        theadHtml += `<th style="width: 150px; text-align: right; position: relative; padding-right: 25px;">
            <input type="text" value="${bidder}" onchange="window.updateBidderName(${idx}, this.value)" placeholder="Tên Nhà thầu" style="text-align: right; font-weight: bold;">
            <button onclick="window.removeBidder(${idx})" class="btn-remove-col" title="Xóa cột này">❌</button>
        </th>`;
    });
    theadHtml += `<th style="width: 40px;"></th>`;
    theadTr.innerHTML = theadHtml;

    const tbody = document.getElementById('cba-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    round.items.forEach((item, itemIdx) => {
        let tr = document.createElement('tr');
        let pteVal = item.pte ? formatCurrencyVND(item.pte) : '';
        let tdHtml = `
            <td>${itemIdx + 1}</td>
            <td><input type="text" value="${item.description || ''}" onchange="window.updateItemDesc(${itemIdx}, this.value)" placeholder="VD: Bill 1 Preliminaries"></td>
            <td><input type="text" value="${pteVal}" oninput="window.updateItemValue(${itemIdx}, 'pte', this.value)" onblur="window.formatInputNumber(this)" placeholder="0"></td>
        `;

        bidders.forEach((bidder, bIdx) => {
            let val = (item.bids && item.bids[bidder]) ? item.bids[bidder] : 0;
            let formattedVal = val ? formatCurrencyVND(val) : '';
            tdHtml += `<td><input type="text" value="${formattedVal}" oninput="window.updateItemValue(${itemIdx}, '${bidder}', this.value)" onblur="window.formatInputNumber(this)" placeholder="0"></td>`;
        });

        tdHtml += `<td style="text-align: center;"><button onclick="window.removeItem(${itemIdx})" class="btn-remove-row" title="Xóa hàng này">🗑️</button></td>`;
        tr.innerHTML = tdHtml;
        tbody.appendChild(tr);
    });

    recalculateCBA();
}
