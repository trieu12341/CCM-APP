import { state } from '../app.js';
import { tenderState } from './tender-state.js';
import { renderTenderRoundTabs, renderCBATable } from './tender-ui.js';

export function handleExcelUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = window.XLSX.read(data, { type: 'array' });
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const json = window.XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        if (json.length < 1) return;
        
        const headers = json[0];
        
        const pteIndex = headers.findIndex(h => h && h.toString().trim().toUpperCase() === 'PTE') !== -1 
            ? headers.findIndex(h => h && h.toString().trim().toUpperCase() === 'PTE') 
            : 2;
            
        const descIndex = headers.findIndex(h => h && ['DESCRIPTION', 'DIỄN GIẢI', 'HẠNG MỤC', 'ITEM'].includes(h.toString().trim().toUpperCase())) !== -1
            ? headers.findIndex(h => h && ['DESCRIPTION', 'DIỄN GIẢI', 'HẠNG MỤC', 'ITEM'].includes(h.toString().trim().toUpperCase()))
            : 1;
            
        const bidders = [];
        const bidderIndices = [];
        headers.forEach((h, i) => {
            if (h && i !== pteIndex && i !== descIndex && i !== 0) {
                const headerText = h.toString().trim().toUpperCase();
                if (!['TOTAL', 'SUM', 'GHI CHÚ', 'REMARK', 'REMARKS', 'ĐƠN VỊ', 'UNIT', 'SỐ LƯỢNG', 'QTY'].includes(headerText)) {
                    bidders.push(h.toString().trim());
                    bidderIndices.push(i);
                }
            }
        });
        
        const items = [];
        for (let r = 1; r < json.length; r++) {
            const row = json[r];
            if (!row || row.length === 0) continue;
            
            const description = row[descIndex] || "";
            const descText = description.toString().trim().toUpperCase();
            if (!descText && !row[pteIndex]) continue;
            
            if (['TOTAL', 'TỔNG CỘNG', 'TOTAL AMOUNT', 'SUM', 'TỔNG', 'GRAND TOTAL'].some(keyword => descText.includes(keyword))) {
                continue;
            }
            
            const pte = parseFloat(row[pteIndex]) || 0;
            const bids = {};
            
            bidders.forEach((b, idx) => {
                bids[b] = parseFloat(row[bidderIndices[idx]]) || 0;
            });
            
            items.push({ description, pte, bids });
        }
        
        const tender = state.appData.Tenders.find(t => t.tender_id === tenderState.currentTenderDetailId);
        if (!tender) return;
        
        tender.cba = {
            bidders: bidders,
            rounds: [
                {
                    round_name: "Round 1",
                    items: items
                }
            ]
        };
        
        document.getElementById('cba-empty-state').classList.add('hidden');
        document.getElementById('cba-table-view').classList.remove('hidden');
        tenderState.currentRoundIndex = 0;
        renderTenderRoundTabs();
        renderCBATable();
        
        event.target.value = '';
    };
    reader.readAsArrayBuffer(file);
}
