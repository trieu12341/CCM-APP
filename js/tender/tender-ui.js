import { state, formatCurrency, formatCurrencyVND, formatDate } from '../app.js';
import { tenderState } from './tender-state.js';
import { recalculateCBA, parseFormattedNumber } from './tender-calc.js';

export function renderTenders() {
    if (!state.appData.Tenders) state.appData.Tenders = [];
    
    const tenders = state.appData.Tenders.filter(t => t.project_id === state.currentProjectId);
    
    let total = tenders.length;
    let floating = tenders.filter(t => t.status === 'Floating').length;
    let evaluating = tenders.filter(t => t.status === 'Evaluating' || t.status === 'Bidding').length;
    let awarded = tenders.filter(t => t.status === 'Awarded').length;
    
    const elTotal = document.getElementById('tender-kpi-total');
    if (elTotal) elTotal.textContent = total;
    const elFloating = document.getElementById('tender-kpi-floating');
    if (elFloating) elFloating.textContent = floating;
    const elEvaluating = document.getElementById('tender-kpi-evaluating');
    if (elEvaluating) elEvaluating.textContent = evaluating;
    const elAwarded = document.getElementById('tender-kpi-awarded');
    if (elAwarded) elAwarded.textContent = awarded;
    
    const tbody = document.getElementById('tender-tbody');
    if(tbody) {
        tbody.innerHTML = '';
        tenders.forEach(t => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>\${t.tender_id}</td>
                <td>\${t.tender_name}</td>
                <td>\${formatCurrency(t.approved_budget)}</td>
                <td>\${formatDate(t.deadline)}</td>
                <td><span class="status-badge \${t.status.toLowerCase()}">\${t.status}</span></td>
                <td>\${t.winner || '-'}</td>
            `;
            tr.style.cursor = 'pointer';
            tr.onclick = () => openTenderDetail(t.tender_id);
            tbody.appendChild(tr);
        });
    }
}

export function openTenderDetail(tenderId) {
    tenderState.currentTenderDetailId = tenderId;
    const tender = state.appData.Tenders.find(t => t.tender_id === tenderId);
    if (!tender) return;

    document.getElementById('tender-list-view').classList.add('hidden');
    document.getElementById('tender-detail-view').classList.remove('hidden');

    document.getElementById('detail-tender-name').textContent = tender.tender_name || '-';
    document.getElementById('detail-tender-code').textContent = tender.tender_id || '-';
    document.getElementById('detail-tender-status').textContent = tender.status || '-';
    document.getElementById('detail-tender-deadline').textContent = tender.deadline ? formatDate(tender.deadline) : '-';
    document.getElementById('detail-tender-winner').textContent = tender.winner || 'ChÆ°a chá»‘t';
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
        a.innerHTML = `<i class="fa-solid fa-layer-group"></i> \${round.round_name}`;
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
        <th style="width: 250px;">DIá»„N GIáº¢I</th>
        <th style="width: 150px; text-align: right; background: #e0f2fe; color: #0284c7;">PTE (GiÃ¡ TV)</th>
    `;
    bidders.forEach((bidder, idx) => {
        theadHtml += `<th style="width: 150px; text-align: right; position: relative; padding-right: 25px;">
            <input type="text" value="\${bidder}" onchange="window.updateBidderName(\${idx}, this.value)" placeholder="TÃªn NhÃ  tháº§u" style="text-align: right; font-weight: bold;">
            <button onclick="window.removeBidder(\${idx})" class="btn-remove-col" title="XÃ³a cá»™t nÃ y">âŒ</button>
        </th>`;
    });
    theadHtml += `<th style="width: 40px;"></th>`;
    theadTr.innerHTML = theadHtml;

    const tbody = document.getElementById('cba-tbody');
