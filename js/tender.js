import { state, formatCurrency, formatCurrencyVND, formatDate } from './app.js';
import { saveTender, updateTender } from './api.js';

let currentTenderDetailId = null;
let currentRoundIndex = 0;

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
                <td>${t.tender_id}</td>
                <td>${t.tender_name}</td>
                <td>${formatCurrency(t.approved_budget)}</td>
                <td>${formatDate(t.deadline)}</td>
                <td><span class="status-badge ${t.status.toLowerCase()}">${t.status}</span></td>
                <td>${t.winner || '-'}</td>
            `;
            tr.style.cursor = 'pointer';
            tr.onclick = () => openTenderDetail(t.tender_id);
            tbody.appendChild(tr);
        });
    }
}

export function openTenderDetail(tenderId) {
    currentTenderDetailId = tenderId;
    const tender = state.appData.Tenders.find(t => t.tender_id === tenderId);
    if (!tender) return;

    document.getElementById('tender-list-view').classList.add('hidden');
    document.getElementById('tender-detail-view').classList.remove('hidden');

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
        currentRoundIndex = 0;
        renderTenderRoundTabs();
        renderCBATable();
    }
}

function initCBA() {
    const tender = state.appData.Tenders.find(t => t.tender_id === currentTenderDetailId);
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
    currentRoundIndex = 0;
    renderTenderRoundTabs();
    renderCBATable();
}

function renderTenderRoundTabs() {
    const tender = state.appData.Tenders.find(t => t.tender_id === currentTenderDetailId);
    if (!tender || !tender.cba) return;
    
    const tabsContainer = document.getElementById('tender-rounds-tabs');
    tabsContainer.innerHTML = '';
    
    tender.cba.rounds.forEach((round, index) => {
        const a = document.createElement('a');
        a.href = '#';
        a.className = 'tab' + (index === currentRoundIndex ? ' active' : '');
        a.innerHTML = `<i class="fa-solid fa-layer-group"></i> ${round.round_name}`;
        a.onclick = (e) => {
            e.preventDefault();
            currentRoundIndex = index;
            renderTenderRoundTabs();
            renderCBATable();
        };
        tabsContainer.appendChild(a);
    });
}

function addRound() {
    const tender = state.appData.Tenders.find(t => t.tender_id === currentTenderDetailId);
    if (!tender || !tender.cba) return;
    
    const currentRound = tender.cba.rounds[tender.cba.rounds.length - 1];
    const nextRoundName = `Round ${tender.cba.rounds.length + 1}`;
    
    const newItems = currentRound.items.map(item => {
        return {
            description: item.description,
            pte: item.pte,
            bids: { ...item.bids } 
        };
    });
    
    tender.cba.rounds.push({
        round_name: nextRoundName,
        items: newItems
    });
    
    currentRoundIndex = tender.cba.rounds.length - 1;
    renderTenderRoundTabs();
    renderCBATable();
}

function parseFormattedNumber(val) {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    return parseFloat(val.toString().replace(/,/g, '')) || 0;
}

window.formatInputNumber = function(input) {
    let val = parseFormattedNumber(input.value);
    if (val !== 0 || input.value.trim() !== '') {
        input.value = formatCurrencyVND(val);
    }
}

function renderCBATable() {
    const tender = state.appData.Tenders.find(t => t.tender_id === currentTenderDetailId);
    if (!tender || !tender.cba) return;
    
    const round = tender.cba.rounds[currentRoundIndex];
    const bidders = tender.cba.bidders;
    
    const theadTr = document.getElementById('cba-thead-tr');
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

function recalculateCBA() {
    const tender = state.appData.Tenders.find(t => t.tender_id === currentTenderDetailId);
    if (!tender || !tender.cba) return;
    const round = tender.cba.rounds[currentRoundIndex];
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
    let tfootSumHtml = `
        <tr>
            <td colspan="2">TỔNG CỘNG (TOTAL)</td>
            <td style="text-align: right; background: #e0f2fe; color: #0284c7;">${formatCurrencyVND(sumPTE)}</td>
    `;
    
    let tfootVarHtml = `
        <tr>
            <td colspan="2">Chênh lệch so với PTE</td>
            <td style="text-align: right; background: #e0f2fe; color: #0284c7;">-</td>
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

window.updateBidderName = function(bIdx, newName) {
    const tender = state.appData.Tenders.find(t => t.tender_id === currentTenderDetailId);
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
    const tender = state.appData.Tenders.find(t => t.tender_id === currentTenderDetailId);
    tender.cba.rounds[currentRoundIndex].items[itemIdx].description = desc;
}

window.updateItemValue = function(itemIdx, key, val) {
    const tender = state.appData.Tenders.find(t => t.tender_id === currentTenderDetailId);
    const item = tender.cba.rounds[currentRoundIndex].items[itemIdx];
    
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
    const tender = state.appData.Tenders.find(t => t.tender_id === currentTenderDetailId);
    if (!tender || !tender.cba) return;
    const count = tender.cba.bidders.length + 1;
    tender.cba.bidders.push(`Nhà thầu ${count}`);
    renderCBATable();
}

window.addItem = function() {
    const tender = state.appData.Tenders.find(t => t.tender_id === currentTenderDetailId);
    if (!tender || !tender.cba) return;
    tender.cba.rounds[currentRoundIndex].items.push({
        description: "",
        pte: 0,
        bids: {}
    });
    renderCBATable();
}

window.removeBidder = function(bIdx) {
    const tender = state.appData.Tenders.find(t => t.tender_id === currentTenderDetailId);
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
    const tender = state.appData.Tenders.find(t => t.tender_id === currentTenderDetailId);
    if (!tender || !tender.cba) return;
    
    tender.cba.rounds[currentRoundIndex].items.splice(itemIdx, 1);
    renderCBATable();
}

async function saveTenderDetail() {
    const tender = state.appData.Tenders.find(t => t.tender_id === currentTenderDetailId);
    if (!tender) return;

    try {
        const success = await updateTender(tender);
        if (success) {
            alert('Đã lưu cập nhật gói thầu thành công!');
            renderTenders();
        } else {
            alert('Lưu thất bại!');
        }
    } catch (error) {
        console.error("Error saving tender detail:", error);
    }
}

function handleExcelUpload(event) {
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
        
        const tender = state.appData.Tenders.find(t => t.tender_id === currentTenderDetailId);
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
        currentRoundIndex = 0;
        renderTenderRoundTabs();
        renderCBATable();
        
        event.target.value = '';
    };
    reader.readAsArrayBuffer(file);
}

export function setupTenderEvents() {
    const btnBackTender = document.getElementById('btn-back-tender');
    if (btnBackTender) {
        btnBackTender.addEventListener('click', () => {
            document.getElementById('tender-detail-view').classList.add('hidden');
            document.getElementById('tender-list-view').classList.remove('hidden');
            currentTenderDetailId = null;
        });
    }

    const btnInitCBA = document.getElementById('btn-init-cba');
    if (btnInitCBA) btnInitCBA.addEventListener('click', initCBA);

    const btnAddBidder = document.getElementById('btn-add-bidder');
    if (btnAddBidder) btnAddBidder.addEventListener('click', window.addBidder);

    const btnAddItem = document.getElementById('btn-add-item');
    if (btnAddItem) btnAddItem.addEventListener('click', window.addItem);

    const btnSaveCBA = document.getElementById('btn-save-cba');
    if (btnSaveCBA) btnSaveCBA.addEventListener('click', saveTenderDetail);
    
    const btnAddRound = document.getElementById('btn-add-round');
    if (btnAddRound) btnAddRound.addEventListener('click', addRound);

    const awardModal = document.getElementById('award-tender-modal');
    const btnAwardTender = document.getElementById('btn-award-tender');
    if (btnAwardTender && awardModal) {
        btnAwardTender.addEventListener('click', () => {
            const tender = state.appData.Tenders.find(t => t.tender_id === currentTenderDetailId);
            if (!tender) return;
            
            const selectWinner = document.getElementById('award-winner');
            selectWinner.innerHTML = '';
            
            if (tender.cba && tender.cba.bidders) {
                tender.cba.bidders.forEach(bidder => {
                    const opt = document.createElement('option');
                    opt.value = bidder;
                    opt.textContent = bidder;
                    selectWinner.appendChild(opt);
                });
            }
            
            document.getElementById('award-price').value = '';
            awardModal.classList.remove('hidden');
        });
        
        document.getElementById('close-award-modal').addEventListener('click', () => awardModal.classList.add('hidden'));
        document.getElementById('cancel-award-modal').addEventListener('click', () => awardModal.classList.add('hidden'));
        
        document.getElementById('award-tender-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const tender = state.appData.Tenders.find(t => t.tender_id === currentTenderDetailId);
            if (!tender) return;
            
            const winner = document.getElementById('award-winner').value;
            const price = parseFormattedNumber(document.getElementById('award-price').value);
            
            tender.winner = winner;
            tender.final_price = price;
            tender.status = 'Awarded';
            
            try {
                const success = await updateTender(tender);
                if (success) {
                    document.getElementById('detail-tender-status').textContent = tender.status;
                    document.getElementById('detail-tender-winner').textContent = tender.winner;
                    document.getElementById('detail-tender-final-price').textContent = formatCurrency(tender.final_price);
                    
                    awardModal.classList.add('hidden');
                    alert('Đã chốt thầu thành công!');
                    renderTenders();
                } else {
                    alert('Lỗi khi chốt thầu');
                }
            } catch (error) {
                console.error('Error awarding tender:', error);
            }
        });
    }
    
    const btnImportExcel = document.getElementById('btn-import-excel');
    const excelUploadInput = document.getElementById('excel-upload-input');
    if (btnImportExcel && excelUploadInput) {
        btnImportExcel.addEventListener('click', () => excelUploadInput.click());
        excelUploadInput.addEventListener('change', handleExcelUpload);
    }

    const newTenderModal = document.getElementById('new-tender-modal');
    if (newTenderModal) {
        const btnNewTender = document.getElementById('btn-new-tender');
        if (btnNewTender) {
            btnNewTender.addEventListener('click', () => {
                document.getElementById('new-tender-form').reset();
                newTenderModal.classList.remove('hidden');
            });
        }
        document.getElementById('close-tender-modal').addEventListener('click', () => newTenderModal.classList.add('hidden'));
        document.getElementById('cancel-tender-modal').addEventListener('click', () => newTenderModal.classList.add('hidden'));

        document.getElementById('new-tender-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!state.appData.Tenders) state.appData.Tenders = [];
            
            const code = document.getElementById('tender-code').value;
            const name = document.getElementById('tender-name').value;
            const budget = parseFloat(document.getElementById('tender-budget').value);
            const status = document.getElementById('tender-status').value;
            const deadline = document.getElementById('tender-deadline').value;
            
            const newTender = {
                tender_id: code,
                project_id: state.currentProjectId,
                tender_name: name,
                approved_budget: budget,
                status: status,
                deadline: deadline,
                winner: ""
            };
            
            const success = await saveTender(newTender);
            if (success) {
                state.appData.Tenders.push(newTender);
                renderTenders();
                newTenderModal.classList.add('hidden');
            } else {
                console.error("Lỗi khi thêm gói thầu");
            }
        });
    }
}
