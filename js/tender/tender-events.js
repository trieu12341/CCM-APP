import { state, formatCurrency } from '../app.js';
import { updateTender, saveTender } from '../api.js';
import { tenderState } from './tender-state.js';
import { renderTenders, initCBA, renderTenderRoundTabs, renderCBATable, renderTenderTableModal } from './tender-ui.js';
import { parseFormattedNumber } from './tender-calc.js';
import { handleExcelUpload } from './tender-excel.js';
import { getLocalContracts, saveLocalContracts } from '../contract/contract-state.js';
import { generateCashflowForContract } from '../cashflow/cashflow-calc.js';

function addRound() {
    const tender = state.appData.Tenders.find(t => t.tender_id === tenderState.currentTenderDetailId);
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
    
    tenderState.currentRoundIndex = tender.cba.rounds.length - 1;
    renderTenderRoundTabs();
    renderCBATable();
}

async function saveTenderDetail() {
    const tender = state.appData.Tenders.find(t => t.tender_id === tenderState.currentTenderDetailId);
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

export function setupTenderEvents() {
    const btnOpenList = document.getElementById('btn-open-tender-list');
    const listModal = document.getElementById('tender-list-modal');
    const closeListBtn = document.getElementById('close-tender-list-modal');

    if (btnOpenList) {
        btnOpenList.addEventListener('click', renderTenderTableModal);
    }
    if (closeListBtn) {
        closeListBtn.addEventListener('click', () => listModal.classList.add('hidden'));
    }

    const btnBackTender = document.getElementById('btn-back-tender');
    if (btnBackTender) {
        btnBackTender.addEventListener('click', () => {
            document.getElementById('tender-detail-view').classList.add('hidden');
            document.getElementById('tender-list-view').classList.remove('hidden');
            tenderState.currentTenderDetailId = null;
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
            const tender = state.appData.Tenders.find(t => t.tender_id === tenderState.currentTenderDetailId);
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
            
            const tender = state.appData.Tenders.find(t => t.tender_id === tenderState.currentTenderDetailId);
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
                    
                    // Workflow 2 & 3: Sync to Contract and Cashflow
                    let allContracts = getLocalContracts();
                    let contractIndex = allContracts.findIndex(c => c.contract_id === tender.tender_id);
                    if (contractIndex >= 0) {
                        let contract = allContracts[contractIndex];
                        contract.total_value = tender.final_price;
                        contract.contractor = tender.winner;
                        contract.status = 'Active';
                        allContracts[contractIndex] = contract;
                        saveLocalContracts(allContracts);
                        
                        // Sync to Cashflow
                        generateCashflowForContract(contract);
                    }

                    awardModal.classList.add('hidden');
                    alert('Đã chốt thầu thành công!');
                    renderTenders();
                    // Optionally dispatch event to trigger Budget dashboard update if visible
                    document.dispatchEvent(new Event('dashboardStateChanged'));
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
