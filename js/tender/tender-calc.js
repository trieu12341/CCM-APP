import { state, formatCurrencyVND } from '../app.js';
import { tenderState } from './tender-state.js';

export function recalculateCBA() {
    const tender = state.appData.Tenders.find(t => t.tender_id === tenderState.currentTenderDetailId);
    if (!tender || !tender.cba) return;
    const round = tender.cba.rounds[tenderState.currentRoundIndex];
    const bidders = tender.cba.bidders;

    let sumPTE = 0;
    let sumBidders = new Array(bidders.length).fill(0);

    round.items.forEach((item) => {
        sumPTE += (item.pte || 0);
        bidders.forEach((bidder, bIdx) => {
            let val = (item.bids && item.bids[bidder]) ? item.bids[bidder] : 0;
            sumBidders[bIdx] += val;
        });
    });

    const tfoot = document.getElementById('cba-tfoot');
    if (!tfoot) return;
    
    let tfootSumHtml = `
        <tr>
            <td colspan="2">TỔNG CỘNG (TOTAL)</td>
            <td style="text-align: right; background: var(--accent-blue-soft); color: var(--accent-blue);">${formatCurrencyVND(sumPTE)}</td>
    `;
    
    let tfootVarHtml = `
        <tr>
            <td colspan="2">Chênh lệch so với PTE</td>
            <td style="text-align: right; background: var(--accent-blue-soft); color: var(--accent-blue);">-</td>
    `;

    bidders.forEach((bidder, bIdx) => {
        tfootSumHtml += `<td style="text-align: right;">${formatCurrencyVND(sumBidders[bIdx])}</td>`;
        
        let variance = sumBidders[bIdx] - sumPTE;
        let varPercent = sumPTE === 0 ? 0 : (variance / sumPTE * 100);
        let colorClass = variance > 0 ? "text-orange" : "text-green";
        let sign = variance > 0 ? "+" : "";
        
        tfootVarHtml += `<td style="text-align: right;" class="variance-cell ${colorClass}">
            ${sign}${formatCurrencyVND(variance)}<br>
            <small>${sign}${varPercent.toFixed(2)}%</small>
        </td>`;
    });
    
    tfootSumHtml += `<td></td></tr>`;
    tfootVarHtml += `<td></td></tr>`;
    tfoot.innerHTML = tfootSumHtml + tfootVarHtml;
}

export function parseFormattedNumber(val) {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    return parseFloat(val.toString().replace(/\D/g, '')) || 0;
}
