import { setContractValue, normalizeContract } from '../core/contract-fields.js';
import { state, formatCurrency } from '../app.js';

import { tenderState } from './tender-state.js';
import { renderTenders, initCBA, renderTenderRoundTabs, renderCBATable, renderTenderTableModal, closeTenderDetailModal } from './tender-ui.js';
import { parseFormattedNumber } from './tender-calc.js';
import { handleExcelUpload } from './tender-excel.js';
import { parseCurrencyInput } from '../utils/formatters.js';
import { getLocalContracts, saveLocalContracts } from '../contract/contract-state.js';
import { openContractModal, renderContractTableModal } from '../contract/contract-ui.js';
import { generateCashflowForContract } from '../cashflow/cashflow-calc.js';
import { createDraftContractFromTender } from '../contract/contract-actions.js';
import { persistBudgets, persistTenders } from '../core/data-store.js';

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
            persistTenders(state.appData.Tenders);
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
        btnOpenList.addEventListener('click', () => {
            renderTenderTableModal();
            window.openInlineWorkspace('tender-list-modal');
        });
    }
    if (closeListBtn) {
        closeListBtn.addEventListener('click', () => {
            window.closeInlineWorkspace();
        });
    }

    const btnBackTender = document.getElementById('btn-back-tender-modal');
    if (btnBackTender) {
        btnBackTender.addEventListener('click', () => {
            closeTenderDetailModal();
            // Re-open the list modal if it was closed
            const listModal = document.getElementById('tender-list-modal');
            if (listModal) listModal.classList.remove('hidden');
        });
    }

    // Close Tender Detail Modal via ✕ button
    document.getElementById('close-tender-detail-modal')?.addEventListener('click', closeTenderDetailModal);



    // Close Tender Detail Modal via clicking backdrop
    document.getElementById('tender-detail-modal')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('tender-detail-modal')) {
            closeTenderDetailModal();
        }
    });

    const btnInitCBA = document.getElementById('btn-init-cba');
    if (btnInitCBA) btnInitCBA.addEventListener('click', initCBA);

    const btnAddBidderEmpty = document.getElementById('btn-add-bidder-empty');
    if (btnAddBidderEmpty) {
        btnAddBidderEmpty.addEventListener('click', () => {
            initCBA();
            window.addBidder();
        });
    }

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
            
            // Pre-fill with existing winner or first bidder name if available
            const winnerInput = document.getElementById('award-winner');
            if (winnerInput) {
                const defaultName = tender.winner 
                    || (tender.cba && tender.cba.bidders && tender.cba.bidders[0]) 
                    || '';
                winnerInput.value = defaultName;
            }
            
            document.getElementById('award-price').value = '';
            awardModal.classList.remove('hidden');
        });
        
        document.getElementById('close-award-modal')?.addEventListener('click', () => awardModal.classList.add('hidden'));
        document.getElementById('cancel-award-modal')?.addEventListener('click', () => awardModal.classList.add('hidden'));
        
        document.getElementById('award-tender-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const tender = state.appData.Tenders.find(t => t.tender_id === tenderState.currentTenderDetailId);
            if (!tender) return;
            
            const winner = document.getElementById('award-winner').value;
            const price = parseFormattedNumber(document.getElementById('award-price').value);
            
            tender.winner = winner;
            tender.awardedPrice = price;
            tender.final_price = price;
            tender.status = 'Awarded';
            
            try {
                const success = await updateTender(tender);
                if (success) {
                    persistTenders(state.appData.Tenders);
                    document.getElementById('detail-tender-status').textContent = tender.status;
                    document.getElementById('detail-tender-winner').textContent = tender.winner;
                    document.getElementById('detail-tender-final-price').textContent = formatCurrency(tender.final_price);
                    
                    // ── Workflow: Sync to Contract ──────────────────────────
                    let allContracts = getLocalContracts();
                    // Tìm Contract đã link với tender này (qua contract_id hoặc from_tender_id)
                    let contractIndex = allContracts.findIndex(
                        c => c.contract_id === tender.tender_id || c.from_tender_id === tender.tender_id
                    );
                    if (contractIndex >= 0) {
                        // Cập nhật contract đã có
                        let contract = allContracts[contractIndex];
                        setContractValue(contract, tender.final_price);
                        contract.contractor  = tender.winner;
                        normalizeContract(contract);
                        contract.status      = 'Active';
                        contract.budget_id   = tender.budget_id || contract.budget_id; // ← giữ link
                        allContracts[contractIndex] = contract;
                        saveLocalContracts(allContracts);
                        generateCashflowForContract(contract);
                    } else if (tender.budget_id) {
                        // Chưa có Contract → tự tạo Draft có budget_id
                        createDraftContractFromTender(tender);
                    }

                    // ── Cập nhật committed trên Budget item ─────────────────
                    if (tender.budget_id && state.appData.Budgets) {
                        const budgetIdx = state.appData.Budgets.findIndex(b => b.id === tender.budget_id);
                        if (budgetIdx !== -1) {
                            state.appData.Budgets[budgetIdx].cached_committed = Number(tender.final_price || 0);
                            // Persist vào server để survive reload
                            persistBudgets(state.appData.Budgets);
                        }
                    }

                    // Show "Chuyển Sang Hợp Đồng" button after successful award
                    const btnConvert = document.getElementById('btn-convert-to-contract');
                    if (btnConvert) btnConvert.classList.remove('hidden');

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

    // ─────────────────────────────────────────────────────────────
    // Nút "Chuyển Sang Hợp Đồng" — Awarded Tender → Contract Draft
    // ─────────────────────────────────────────────────────────────
    const btnConvertToContract = document.getElementById('btn-convert-to-contract');
    if (btnConvertToContract) {
        btnConvertToContract.addEventListener('click', () => {
            const tender = state.appData.Tenders.find(t => t.tender_id === tenderState.currentTenderDetailId);
            if (!tender) return;

            // 1. Kiểm tra trùng lặp dựa vào from_tender_id
            const allContracts = getLocalContracts();
            const existing = allContracts.find(c => c.from_tender_id === tender.tender_id);

            if (existing) {
                // Đã tồn tại → chuyển tab và mở luôn contract đó
                const menuContract = document.getElementById('menu-contract');
                if (menuContract) menuContract.click();
                setTimeout(() => openContractModal(existing), 200);
                return;
            }

            // 2. Tạo Contract Draft mới
            const newContract = createDraftContractFromTender(tender);

            // 5. Chuyển sang Tab Contract và mở detail modal
            const menuContract = document.getElementById('menu-contract');
            if (menuContract) menuContract.click();

            setTimeout(() => {
                renderContractTableModal();
                setTimeout(() => openContractModal(newContract), 100);
            }, 200);
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
        document.getElementById('close-tender-modal')?.addEventListener('click', () => newTenderModal.classList.add('hidden'));
        document.getElementById('cancel-tender-modal')?.addEventListener('click', () => newTenderModal.classList.add('hidden'));

        document.getElementById('new-tender-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!state.appData.Tenders) state.appData.Tenders = [];
            
            const code = document.getElementById('tender-code').value;
            const name = document.getElementById('tender-name').value;
            const budget = parseCurrencyInput(document.getElementById('tender-budget').value);
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
            
            state.appData.Tenders.push(newTender);
            persistTenders(state.appData.Tenders);
            renderTenders();
            newTenderModal.classList.add('hidden');
        });
    }
}
