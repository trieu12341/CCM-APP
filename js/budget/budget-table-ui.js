/**
 * budget-table-ui.js — Bảng chi tiết phân bổ ngân sách (cam kết / đã chi / chênh lệch theo mục).
 */
import { expendedByBudget, committedByBudget } from '../modules/payment/payment-metrics.js';
import { escapeHtml } from '../utils/formatters.js';
import { state, formatCurrency, getDynamicContractValue } from '../app.js';

export function renderBudgetTableModal(filterType = 'all') {
    const tbodyConsultancy = document.getElementById('budget-tbody-consultancy');
    const tbodyConstruction = document.getElementById('budget-tbody-construction');
    const tbodyContingency = document.getElementById('budget-tbody-contingency');
    const tfootTotal = document.getElementById('budget-tfoot-total');

    if (!tbodyConsultancy || !tbodyConstruction || !tbodyContingency || !tfootTotal) return;

    tbodyConsultancy.innerHTML = '';
    tbodyConstruction.innerHTML = '';
    tbodyContingency.innerHTML = '';
    tfootTotal.innerHTML = '';

    const btnReset = document.getElementById('btn-budget-reset-filter');
    if (btnReset) {
        if (filterType !== 'all') {
            btnReset.classList.remove('hidden');
        } else {
            btnReset.classList.add('hidden');
        }
    }

    const project = state.appData.Projects.find(p => p.project_id === state.currentProjectId);
    if (!project) return;

    const projectBudgets = (state.appData.Budgets || []).filter(b => b.project_id === state.currentProjectId);

    // Đã chi theo mục ngân sách (phân bổ theo mã ngân sách của dòng Bill trong IPC)
    const expendedMap = expendedByBudget({ payments: state.appData.Payments || [], contracts: state.appData.Contracts || [],
        budgets: state.appData.Budgets || [], projectId: state.currentProjectId });
    const committedMap = committedByBudget({ payments: state.appData.Payments || [], contracts: state.appData.Contracts || [],
        budgets: state.appData.Budgets || [], projectId: state.currentProjectId,
        valueOf: (c) => getDynamicContractValue(c, state.appData) });

    const createRow = (budget, index = 0) => {
        const budgeted = Number(budget.budgeted) || 0;
        let committed = 0;
        let expended = 0;
        
        const linkedContracts = (state.appData.Contracts || []).filter(c => c.budget_id === budget.id);
        // Cam kết / đã chi theo mục ngân sách (phân bổ theo mã của dòng Bill nếu có)
        committed = committedMap.get(budget.id) || 0;
        expended = expendedMap.get(budget.id) || 0;

        // Fallback: nếu chưa có Contract linked, dùng cached_committed từ Award
        if (linkedContracts.length === 0 && !committed && budget.cached_committed) {
            committed = Number(budget.cached_committed) || 0;
        }

        // Chênh lệch = Ngân sách − Dự báo chi phí (đã chi là một phần của cam kết, không trừ hai lần)
        const varianceVal = budgeted - Math.max(committed, expended);
        const progress = committed > 0 ? (expended / committed) * 100 : 0;
        const isTenderCreated = (state.appData.Tenders || []).some(t => t.budget_id === budget.id) || 
                                (budget.tender_status && budget.tender_status !== 'Draft') || 
                                !!budget.tender_id;

        // --- FILTER LOGIC ---
        if (filterType === 'committed' && committed <= 0) return null;
        if (filterType === 'overbudget' && varianceVal >= 0) return null;
        // --------------------

        const btnCreateHtml = isTenderCreated 
            ? `<button class="w-8 h-8 rounded-md flex items-center justify-center text-slate-300 cursor-not-allowed" disabled title="Đã tạo gói thầu"><i class="fa-solid fa-plus"></i></button>`
            : `<button class="btn-create-tender w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors" data-id="${budget.id}" title="Tạo gói thầu từ mục này"><i class="fa-solid fa-plus"></i></button>`;

        const actionHtml = `
            <div style="display: flex; gap: 4px; justify-content: flex-end; align-items: center;">
                ${btnCreateHtml}
                <button class="btn-edit-budget w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition-colors" data-id="${budget.id}" title="Chỉnh sửa"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-delete-budget w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:text-red-600 hover:bg-slate-100 transition-colors" data-id="${budget.id}" title="Xóa"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;

        const tr = document.createElement('tr');
        tr.classList.add(index % 2 === 0 ? 'zebra-odd' : 'zebra-even');
        tr.innerHTML = `
            <td>${escapeHtml(budget.budgetCode || '')}</td>
            <td>${escapeHtml(budget.packageName || 'Unnamed Package')}</td>
            <td class="numeric-cell">${formatCurrency(budgeted)}</td>
            <td class="numeric-cell">${formatCurrency(committed)}</td>
            <td class="numeric-cell">${formatCurrency(expended)}</td>
            <td class="numeric-cell ${varianceVal < 0 ? 'text-red' : 'text-blue'}">${varianceVal < 0 ? '-' : ''}${formatCurrency(Math.abs(varianceVal))}</td>
            <td style="text-align: right; padding-right: 0.5rem;">${actionHtml}</td>
        `;

        const btnCreateTender = tr.querySelector('.btn-create-tender');
        if (btnCreateTender) {
            btnCreateTender.addEventListener('click', () => {
                if (window.createTenderFromBudget) {
                    window.createTenderFromBudget(budget);
                }
            });
        }
        return {
            element: tr,
            budgeted: budgeted,
            committed: committed,
            expended: expended,
            variance: varianceVal
        };
    };

    let totalBudgeted = 0;
    let totalCommitted = 0;
    let totalExpended = 0;
    let totalVarianceRows = 0;
    let staticContingency = 0;

    const consultancies = projectBudgets.filter(b => b.category === 'Consultancy');
    const constructions = projectBudgets.filter(b => b.category === 'Construction');
    const contingencies = projectBudgets.filter(b => b.category === 'Contingency');

    if (consultancies.length > 0) {
        const headerTR = document.createElement('tr');
        headerTR.innerHTML = `<td colspan="7" style="background-color: var(--bg-table-header); font-weight: bold; padding: 0.75rem;">I. Tư vấn (Soft Cost)</td>`;
        let groupHasRows = false;
        
        consultancies.forEach((b, idx) => {
            const rowData = createRow(b, idx);
            if (rowData) {
                if (!groupHasRows) {
                    tbodyConsultancy.appendChild(headerTR);
                    groupHasRows = true;
                }
                tbodyConsultancy.appendChild(rowData.element);
                totalBudgeted += rowData.budgeted;
                totalCommitted += rowData.committed;
                totalExpended += rowData.expended;
            totalVarianceRows += rowData.variance;
            }
        });
    }

    if (constructions.length > 0) {
        const headerTR = document.createElement('tr');
        headerTR.innerHTML = `<td colspan="7" style="background-color: var(--bg-table-header); font-weight: bold; padding: 0.75rem;">II. Xây dựng / M&E (Hard Cost)</td>`;
        tbodyConstruction.appendChild(headerTR);
        constructions.forEach((b, idx) => {
            const rowData = createRow(b, idx);
            tbodyConstruction.appendChild(rowData.element);
            totalBudgeted += rowData.budgeted;
            totalCommitted += rowData.committed;
            totalExpended += rowData.expended;
            totalVarianceRows += rowData.variance;
        });
    }

    if (contingencies.length > 0) {
        const contHeaderTR = document.createElement('tr');
        contHeaderTR.innerHTML = `<td colspan="7" style="background-color: var(--bg-table-header); font-weight: bold; padding: 0.75rem;">III. Dự phòng (Contingency)</td>`;
        tbodyContingency.appendChild(contHeaderTR);
        contingencies.forEach((b, idx) => {
            const rowData = createRow(b, idx);
            tbodyContingency.appendChild(rowData.element);
            totalBudgeted += rowData.budgeted;
            totalCommitted += rowData.committed;
            totalExpended += rowData.expended;
            totalVarianceRows += rowData.variance;
        });
    } else {
        // Fallback static contingency row if not modeled in budgets
        const contingencyBudget = project.contingency_budget || 0;
        totalBudgeted += contingencyBudget;
        staticContingency = contingencyBudget;

        const contHeaderTR = document.createElement('tr');
        contHeaderTR.innerHTML = `<td colspan="7" style="background-color: var(--bg-table-header); font-weight: bold; padding: 0.75rem;">III. Dự phòng (Contingency)</td>`;
        tbodyContingency.appendChild(contHeaderTR);

        const contTR = document.createElement('tr');
        contTR.classList.add('zebra-odd');
        contTR.innerHTML = `
            <td></td>
            <td>Dự phòng (Contingency)</td>
            <td class="numeric-cell">${formatCurrency(contingencyBudget)}</td>
            <td class="numeric-cell">${formatCurrency(0)}</td>
            <td class="numeric-cell">${formatCurrency(0)}</td>
            <td class="numeric-cell text-blue">${formatCurrency(contingencyBudget)}</td>
            <td style="text-align: right; padding-right: 0.5rem;">
                <div style="display: flex; gap: 4px; justify-content: flex-end; align-items: center;">
                    <button class="btn-create-tender w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors" title="Tạo gói thầu từ mục này"><i class="fa-solid fa-plus"></i></button>
                </div>
            </td>
        `;
        tbodyContingency.appendChild(contTR);
    }

    // Total Footer
    // Tổng chênh lệch = Σ chênh lệch từng dòng (+ dự phòng tĩnh nếu có)
    const totalVariance = totalVarianceRows + staticContingency;
    tfootTotal.innerHTML = `
        <tr style="background: var(--bg-table-footer); font-weight: bold;">
            <td colspan="2" style="text-align: right; padding-right: 1rem;">TỔNG CỘNG</td>
            <td class="numeric-cell">${formatCurrency(totalBudgeted)}</td>
            <td class="numeric-cell">${formatCurrency(totalCommitted)}</td>
            <td class="numeric-cell">${formatCurrency(totalExpended)}</td>
            <td class="numeric-cell ${totalVariance < 0 ? 'text-red' : 'text-blue'}">${totalVariance < 0 ? '-' : ''}${formatCurrency(Math.abs(totalVariance))}</td>
            <td></td>
        </tr>
    `;
}
