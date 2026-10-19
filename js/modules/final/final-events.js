import { state, formatCurrencyVND } from '../../app.js';
import { getContractsForProject, calculateFinalAccount } from './final-state.js';
import { renderFinalDashboard, renderFinalTable, renderFinalBreakdown, recalculateFinalRetentionAndBalance } from './final-ui.js';
import { persistFinalStatements, persistContracts, persistBudgets } from '../../core/data-store.js';

export function setupFinalEvents() {
    // ----------------------------------------------------------------------
    // NAVIGATION: Layer 1 <-> Layer 2
    // ----------------------------------------------------------------------
    const btnShowL2 = document.getElementById('btn-show-final-layer2');
    
    if (btnShowL2) {
        btnShowL2.addEventListener('click', () => {
            const btnNewFinal = document.getElementById('btn-new-final-statement');
            if (btnNewFinal) btnNewFinal.click();
        });
    }

    // ----------------------------------------------------------------------
    // OPEN CONTRACT SELECTOR
    // ----------------------------------------------------------------------
    const btnNewFinal = document.getElementById('btn-new-final-statement');
    if (btnNewFinal) {
        btnNewFinal.addEventListener('click', () => {
            const select = document.getElementById('final-contract-select');
            if (!select) return;
            select.innerHTML = '';
            
            const contracts = getContractsForProject().filter(c => c.status !== 'Closed');
            if (contracts.length === 0) {
                select.innerHTML = '<option value="">Không có hợp đồng nào khả dụng.</option>';
                document.getElementById('btn-confirm-final-contract').disabled = true;
            } else {
                contracts.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.contract_id;
                    opt.textContent = `${c.contract_id} - ${c.package_name}`;
                    select.appendChild(opt);
                });
                document.getElementById('btn-confirm-final-contract').disabled = false;
            }
            
            document.getElementById('modal-select-final-contract').classList.remove('hidden');
        });
    }

    const btnConfirmFinal = document.getElementById('btn-confirm-final-contract');
    if (btnConfirmFinal) {
        btnConfirmFinal.addEventListener('click', () => {
            const select = document.getElementById('final-contract-select');
            if (select && select.value) {
                document.getElementById('modal-select-final-contract').classList.add('hidden');
                renderFinalBreakdown(select.value);
                document.getElementById('final-breakdown-workspace').classList.remove('hidden');
            }
        });
    }

    // ----------------------------------------------------------------------
    // LAYER 3 BREAKDOWN LOGIC
    // ----------------------------------------------------------------------
    const btnCloseBreakdown = document.getElementById('btn-close-final-breakdown');
    if (btnCloseBreakdown) {
        btnCloseBreakdown.addEventListener('click', () => {
            document.getElementById('final-breakdown-workspace').classList.add('hidden');
        });
    }

    // Retention Recalculation
    document.querySelectorAll('input[name="final-retention-type"]').forEach(r => {
        r.addEventListener('change', recalculateFinalRetentionAndBalance);
    });
    const pctInput = document.getElementById('final-retention-pct');
    if (pctInput) {
        pctInput.addEventListener('input', recalculateFinalRetentionAndBalance);
    }

    // Submit / Closure
    const btnSubmit = document.getElementById('btn-submit-final');
    if (btnSubmit) {
        btnSubmit.addEventListener('click', () => {
            if (!confirm('Bạn có chắc chắn muốn chốt số liệu quyết toán? Hành động này sẽ đóng hợp đồng, vô hiệu hóa việc tạo mới IPC và VO cho hợp đồng này.')) {
                return;
            }
            
            const workspace = document.getElementById('final-breakdown-workspace');
            const contractId = workspace.dataset.contractId;

            // Chống quyết toán 1 hợp đồng 2 lần (cộng dự phòng 2 lần)
            const alreadyClosed = (state.appData.Final_Statements || []).some(fs =>
                fs.contract_id === contractId && fs.project_id === state.currentProjectId && fs.status === 'Closed');
            if (alreadyClosed) {
                alert('Hợp đồng này đã được quyết toán trước đó. Không thể quyết toán lần nữa.');
                return;
            }

            const finalAcc = calculateFinalAccount(contractId);
            if (!finalAcc) return;

            // 1. Update Contract Status
            const contract = state.appData.Contracts.find(c => c.contract_id === contractId);
            if (contract) {
                contract.status = 'Closed';
                contract.final_statement_value = finalAcc.c; // Save C
            }

            // 2. Add Final Statement Record
            // Mã quyết toán: số kế tiếp trong dự án + hậu tố thời gian → không trùng giữa các máy
            const projectFS = (state.appData.Final_Statements || []).filter(fs => fs.project_id === state.currentProjectId);
            const nextNo = projectFS.reduce((mx, fs) => Math.max(mx, parseInt(String(fs.id).split('-')[1], 10) || 0), 0) + 1;
            const record = {
                id: `FS-${String(nextNo).padStart(2, '0')}-${Date.now().toString(36)}`,
                contract_id: contractId,
                contract_name: contract.package_name || contract.contract_name || contract.contract_id,
                project_id: state.currentProjectId,
                original_value: finalAcc.a,
                final_value: finalAcc.c,
                savings: (Number(contract.original_value) || 0) - finalAcc.c,
                retention_held: parseFloat(workspace.dataset.f) || 0,
                status: 'Closed',
                value_a: finalAcc.a,
                value_b: finalAcc.b,
                value_c: finalAcc.c,
                value_d: finalAcc.d,
                value_e: finalAcc.e,
                value_f: parseFloat(workspace.dataset.f) || 0,
                value_g: parseFloat(workspace.dataset.g) || 0,
                created_at: new Date().toISOString()
            };
            if (!state.appData.Final_Statements) state.appData.Final_Statements = [];
            state.appData.Final_Statements.push(record);

            // 3. Balance Budget Contingency
            // Delta = Budget_Baseline - Final_Account_Value (C)
            // Where Budget_Baseline is from Budget item mapped to contract, or fallback to original_value
            let budgetBaseline = finalAcc.a; // Fallback to original value
            const budgetItem = state.appData.Budgets.find(b => b.id === contract.budget_id);
            if (budgetItem && budgetItem.budgeted) {
                budgetBaseline = budgetItem.budgeted;
            }
            const delta = budgetBaseline - finalAcc.c;

            // Add delta to Contingency
            if (delta !== 0) {
                const contId = `BG-CONT-${state.currentProjectId}`;
                let contingencyBudget = state.appData.Budgets.find(b =>
                    (b.id === contId || b.id === 'BG-CONT') && b.project_id === state.currentProjectId);
                if (contingencyBudget) {
                    contingencyBudget.budgeted = (contingencyBudget.budgeted || 0) + delta;
                    contingencyBudget.notes = (contingencyBudget.notes || '') + `\n+ Quyết toán ${contract.contract_id}: ${formatCurrencyVND(delta)}`;
                } else {
                    state.appData.Budgets.push({
                        id: contId,
                        project_id: state.currentProjectId,
                        category: 'Contingency',
                        packageName: 'Dự phòng chung & Quyết toán',
                        budgeted: delta,
                        notes: `+ Quyết toán ${contract.contract_id}: ${formatCurrencyVND(delta)}`
                    });
                }
            }

            // 4. Persist Data
            persistFinalStatements(state.appData.Final_Statements);
            persistContracts(state.appData.Contracts);
            persistBudgets(state.appData.Budgets);

            // 5. Success
            alert('Đã chốt quyết toán hợp đồng thành công! Dữ liệu đã được khóa.');
            workspace.classList.add('hidden');
            renderFinalDashboard();
        });
    }
}
