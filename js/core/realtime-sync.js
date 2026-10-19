/**
 * realtime-sync.js — Áp dữ liệu dự án nhận từ Firestore (onSnapshot) vào state,
 * lưu bản sao localStorage, rồi vẽ lại tab đang mở (không đóng form đang mở).
 */
import { state } from '../app.js';
import { normalizeContracts } from './contract-fields.js';
import { renderProjectTabs, renderDashboard } from '../budget.js';
import { refreshActiveView } from './sidebar-nav.js';
import { mergeProjectField } from './project-merge.js';

export async function handleProjectSnapshot(projectId, docData) {
    if (docData) {
        // Gộp từng loại dữ liệu. Trường chưa từng có trên cloud (hồ sơ tạo từ bản cũ,
        // vd final_statements) → giữ bản trong máy và tự đẩy lên, không xóa mất.
        const FIELDS = [
            ['Budgets', 'budgets', 'saveBudgetsToCloud'],
            ['Tenders', 'tenders', 'saveTendersToCloud'],
            ['Contracts', 'contracts', 'saveContractsToCloud'],
            ['Cashflow', 'cashflows', 'saveCashflowToCloud'],
            ['Payments', 'payments', 'savePaymentsToCloud'],
            ['Variations', 'variations', 'saveVariationsToCloud'],
            ['Final_Statements', 'final_statements', 'saveFinalStatementsToCloud'],
        ];
        const toPush = [];
        for (const [stateKey, cloudKey, saver] of FIELDS) {
            const { merged, pushLocal } = mergeProjectField(state.appData[stateKey], docData[cloudKey], projectId);
            state.appData[stateKey] = merged;
            if (pushLocal) toPush.push(saver);
        }
        state.appData.Contracts = normalizeContracts(state.appData.Contracts);
        if (toPush.length) {
            const db = await import('../db-service.js');
            // save*ToCloud chỉ ghi phần của dự án đang mở (state.currentProjectId)
            if (state.currentProjectId === projectId) {
                toPush.forEach(fn => db[fn](state.appData[FIELDS.find(f => f[2] === fn)[0]]).catch?.(console.error));
            }
        }

        // Persist to local storage as backup
        localStorage.setItem('ccm_budgets', JSON.stringify(state.appData.Budgets));
        localStorage.setItem('ccm_tenders', JSON.stringify(state.appData.Tenders));
        localStorage.setItem('ccm_contracts', JSON.stringify(state.appData.Contracts));
        localStorage.setItem('ccm_cashflow', JSON.stringify(state.appData.Cashflow));
        localStorage.setItem('ccm_payments', JSON.stringify(state.appData.Payments));
        localStorage.setItem('ccm_variations', JSON.stringify(state.appData.Variations));
        localStorage.setItem('ccm_final', JSON.stringify(state.appData.Final_Statements));

        console.log(`⚡ Realtime Update received for project ${projectId}, triggering UI re-render...`);

        // Dispatch events to trigger UI re-renders instantly
        document.dispatchEvent(new Event('budgetsChanged'));
        document.dispatchEvent(new Event('tendersChanged'));
        document.dispatchEvent(new Event('contractsChanged'));
        document.dispatchEvent(new Event('cashflowsChanged'));
        document.dispatchEvent(new Event('cashflowChanged'));
        document.dispatchEvent(new Event('paymentsChanged'));
        document.dispatchEvent(new Event('variationsChanged'));
        document.dispatchEvent(new Event('finalChanged'));

        // Vẽ lại tab đang mở — KHÔNG "bấm lại" menu vì thao tác đó
        // đóng mọi màn hình con / form người dùng đang làm dở.
        refreshActiveView();

        try { renderProjectTabs(); } catch(e){}
        try { renderDashboard(); } catch(e){}
    } else {
        // Project document doesn't exist on cloud yet. Initialize it.
        console.log(`Initial Setup: Initializing new project document ${projectId}`);
        const { saveBudgetsToCloud, saveTendersToCloud, saveContractsToCloud, saveCashflowToCloud, savePaymentsToCloud, saveVariationsToCloud, saveFinalStatementsToCloud } = await import('../db-service.js');
        saveBudgetsToCloud(state.appData.Budgets);
        saveTendersToCloud(state.appData.Tenders);
        saveContractsToCloud(state.appData.Contracts);
        saveCashflowToCloud(state.appData.Cashflow);
        savePaymentsToCloud(state.appData.Payments);
        saveVariationsToCloud(state.appData.Variations);
        saveFinalStatementsToCloud(state.appData.Final_Statements || []);
    }
}
