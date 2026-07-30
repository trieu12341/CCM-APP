import { state, formatCurrencyVND } from '../app.js';
import { tenderState } from './tender-state.js';
import { recalculateCBA, parseFormattedNumber } from './tender-calc.js';
import { renderCBATable } from './tender-ui.js';

window.updateBidderName = function(bIdx, newName) {
    const tender = state.appData.Tenders.find(t => t.tender_id === tenderState.currentTenderDetailId);
    if (!tender) return;
    
    const oldName = tender.cba.bidders[bIdx];
    tender.cba.bidders[bIdx] = newName || `Bidder ${bIdx+1}`;
    
    tender.cba.rounds.forEach(round => {
        round.items.forEach(item => {
            if (item.bids && item.bids.hasOwnProperty(oldName)) {
                item.bids[newName] = item.bids[oldName];
                delete item.bids[oldName];
            }
        });
    });
    renderCBATable();
}

window.updateItemDesc = function(itemIdx, desc) {
    const tender = state.appData.Tenders.find(t => t.tender_id === tenderState.currentTenderDetailId);
    if (!tender) return;
    tender.cba.rounds[tenderState.currentRoundIndex].items[itemIdx].description = desc;
}

window.updateItemValue = function(itemIdx, key, val) {
    const tender = state.appData.Tenders.find(t => t.tender_id === tenderState.currentTenderDetailId);
    if (!tender) return;
    const item = tender.cba.rounds[tenderState.currentRoundIndex].items[itemIdx];
    let numVal = parseFormattedNumber(val);
    
    if (key === 'pte') {
        item.pte = numVal;
    } else {
        if (!item.bids) item.bids = {};
        item.bids[key] = numVal;
    }
    recalculateCBA();
}

window.addBidder = function() {
    const tender = state.appData.Tenders.find(t => t.tender_id === tenderState.currentTenderDetailId);
    if (!tender || !tender.cba) return;
    const count = tender.cba.bidders.length + 1;
    tender.cba.bidders.push(`Nhà thầu ${count}`);
    renderCBATable();
}

window.addItem = function() {
    const tender = state.appData.Tenders.find(t => t.tender_id === tenderState.currentTenderDetailId);
    if (!tender || !tender.cba) return;
    tender.cba.rounds[tenderState.currentRoundIndex].items.push({
        description: "",
        pte: 0,
        bids: {}
    });
    renderCBATable();
}

window.removeBidder = function(bIdx) {
    const tender = state.appData.Tenders.find(t => t.tender_id === tenderState.currentTenderDetailId);
    if (!tender || !tender.cba) return;
    const bidderName = tender.cba.bidders[bIdx];
    tender.cba.bidders.splice(bIdx, 1);
    
    tender.cba.rounds.forEach(round => {
        round.items.forEach(item => {
            if (item.bids && item.bids.hasOwnProperty(bidderName)) {
                delete item.bids[bidderName];
            }
        });
    });
    renderCBATable();
}

window.removeItem = function(itemIdx) {
    const tender = state.appData.Tenders.find(t => t.tender_id === tenderState.currentTenderDetailId);
    if (!tender || !tender.cba) return;
    tender.cba.rounds[tenderState.currentRoundIndex].items.splice(itemIdx, 1);
    renderCBATable();
}

window.formatInputNumber = function(input) {
    let val = parseFormattedNumber(input.value);
    if (val !== 0 || input.value.trim() !== '') {
        input.value = formatCurrencyVND(val);
    }
}
