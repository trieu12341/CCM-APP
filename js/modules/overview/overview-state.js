import { paymentTotals, isPaidIPC, isApprovedIPC } from '../payment/payment-metrics.js';
import { state } from '../../app.js';
import { parseCurrencyInput } from '../../utils/formatters.js';

export function calculateOverviewMetrics() {
    const projectId = state.currentProjectId;
    
    // --- BUDGET HEALTH ---
    const projectBudgets = (state.appData.Budgets || []).filter(b => b.project_id === projectId);
    const totalBudget = projectBudgets.reduce((sum, b) => sum + (Number(b.budgeted) || 0), 0);

    const projectContracts = (state.appData.Contracts || []).filter(c => c.project_id === projectId);
    let totalCommitted = 0;
    projectContracts.forEach(c => {
        if (c.status === 'Closed' && c.final_statement_value !== undefined) {
            totalCommitted += Number(c.final_statement_value);
        } else {
            totalCommitted += (Number(c.original_value) || 0);
        }
    });

    // VO đã duyệt KHÔNG cộng vào giá trị cam kết (giá trị HĐ); chỉ vào giá trị quyết toán
    const projectVOs = (state.appData.Variations || []).filter(vo => vo.project_id === projectId && vo.status === 'Approved');

    const remainingContingency = totalBudget - totalCommitted;
    const budgetPct = totalBudget > 0 ? (totalCommitted / totalBudget) * 100 : 0;

    // --- TENDER PIPELINE ---
    const projectTenders = (state.appData.Tenders || []).filter(t => t.project_id === projectId);
    let tenderAwarded = 0, tenderEval = 0, tenderBidding = 0, tenderDraft = 0;
    projectTenders.forEach(t => {
        if (t.status === 'Awarded') tenderAwarded++;
        else if (t.status === 'Evaluation' || t.status === 'Negotiation') tenderEval++;
        else if (t.status === 'Tendering') tenderBidding++;
        else tenderDraft++;
    });

    // Top 3 upcoming awards
    const upcomingTenders = projectTenders
        .filter(t => t.status !== 'Awarded' && t.target_award_date)
        .sort((a, b) => new Date(a.target_award_date) - new Date(b.target_award_date))
        .slice(0, 3);

    // --- CONTRACT & VO ---
    let contractOriginalTotal = 0;
    let contractApprovedVOTotal = 0;
    projectContracts.forEach(c => {
        contractOriginalTotal += (Number(c.original_value) || 0);
    });
    projectVOs.forEach(vo => {
        contractApprovedVOTotal += (Number(vo.approved_amount) || Number(vo.claimed_amount) || 0);
    });
    const revisedContractTotal = contractOriginalTotal + contractApprovedVOTotal;
    const voPct = contractOriginalTotal > 0 ? (contractApprovedVOTotal / contractOriginalTotal) * 100 : 0;

    // --- PAYMENT & EXPENSE ---
    // Chỉ tính IPC đã thanh toán; số giữ lại / thu hồi TƯ là LŨY KẾ đến IPC cuối
    const paidTotals = paymentTotals(state.appData.Payments || [], { projectId, filter: isPaidIPC });
    const totalPaid = paidTotals.paymentExVat;   // tiền đã trả trước thuế, gồm tạm ứng
    const totalRetentionHeld = paidTotals.retentionHeld;
    const totalUnrecoupedAdvance = paidTotals.advanceOutstanding;

    // Đã thực hiện (thẻ "Total Expended"): giá trị công việc gộp đến nay của IPC đã duyệt
    const totalExpended = paymentTotals(state.appData.Payments || [], { projectId, filter: isApprovedIPC }).grossToDate;
    const paymentPct = totalCommitted > 0 ? (totalExpended / totalCommitted) * 100 : 0;

    return {
        budget: {
            approved: totalBudget,
            committed: totalCommitted,
            contingency: remainingContingency,
            pct: budgetPct
        },
        tender: {
            awarded: tenderAwarded,
            eval: tenderEval,
            bidding: tenderBidding,
            draft: tenderDraft,
            upcoming: upcomingTenders
        },
        contract: {
            original: contractOriginalTotal,
            vo: contractApprovedVOTotal,
            revised: revisedContractTotal,
            voPct: voPct
        },
        payment: {
            paid: totalPaid,
            expended: totalExpended,
            advance: totalUnrecoupedAdvance,
            retention: totalRetentionHeld,
            pct: paymentPct
        }
    };
}

export function getProjectPackagesData() {
    return []; // No longer needed
}

export function getRiskAndPendingTasks() {
    return { risks: [], pendingTasks: [] }; // No longer needed
}
