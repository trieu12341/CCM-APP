import { state, formatCurrencyVND } from '../../app.js';
import { parseCurrencyInput } from '../../utils/formatters.js';

export function calculateOverviewMetrics() {
    const projectId = state.currentProjectId;
    
    // Total Budget
    const projectBudgets = (state.appData.Budgets || []).filter(b => b.project_id === projectId);
    const totalBudget = projectBudgets.reduce((sum, b) => sum + (Number(b.budgeted) || 0), 0);

    // Committed Cost (Original Contracts + Approved VOs)
    const projectContracts = (state.appData.Contracts || []).filter(c => c.project_id === projectId);
    let totalCommitted = 0;
    projectContracts.forEach(c => {
        if (c.status === 'Closed' && c.final_statement_value !== undefined) {
            totalCommitted += Number(c.final_statement_value);
        } else {
            totalCommitted += (Number(c.original_value) || 0);
        }
    });

    const projectVOs = (state.appData.Variations || []).filter(vo => vo.project_id === projectId && vo.status === 'Approved');
    const totalVO = projectVOs.reduce((sum, vo) => sum + (Number(vo.approved_amount) || Number(vo.claimed_amount) || 0), 0);
    // Note: for Closed contracts, their VOs are already included in final_statement_value. We should exclude them to avoid double counting.
    // Let's filter VOs for contracts that are NOT Closed.
    const activeVOs = projectVOs.filter(vo => {
        const contract = projectContracts.find(c => c.contract_id === vo.contract_id);
        return contract && contract.status !== 'Closed';
    });
    const activeTotalVO = activeVOs.reduce((sum, vo) => sum + (Number(vo.approved_amount) || Number(vo.claimed_amount) || 0), 0);
    totalCommitted += activeTotalVO;

    // Actual Certified
    const projectPayments = (state.appData.Payments || []).filter(p => p.project_id === projectId && (p.status === 'Approved' || p.status === 'Paid'));
    const totalCertified = projectPayments.reduce((sum, p) => {
        const gross = parseCurrencyInput(p.certified_amount || p.net_payable);
        const vat = parseCurrencyInput(p.vat_amount);
        return sum + (p.sub_total !== undefined ? parseCurrencyInput(p.sub_total) : (gross - vat));
    }, 0);

    // Savings / Contingency
    const savings = totalBudget - totalCommitted;
    const savingsPct = totalBudget > 0 ? (totalCommitted / totalBudget) * 100 : 0;

    return {
        totalBudget,
        totalCommitted,
        totalCertified,
        savings,
        savingsPct
    };
}

export function getProjectPackagesData() {
    const projectId = state.currentProjectId;
    const contracts = (state.appData.Contracts || []).filter(c => c.project_id === projectId);
    const variations = (state.appData.Variations || []).filter(vo => vo.project_id === projectId && vo.status === 'Approved');
    const payments = (state.appData.Payments || []).filter(p => p.project_id === projectId && (p.status === 'Approved' || p.status === 'Paid'));

    const data = contracts.map(c => {
        const isClosed = c.status === 'Closed';
        const original = isClosed ? Number(c.final_statement_value) : (Number(c.original_value) || 0);
        
        const contractVOs = variations.filter(vo => vo.contract_id === c.contract_id);
        const voAmount = isClosed ? 0 : contractVOs.reduce((sum, vo) => sum + (Number(vo.approved_amount) || Number(vo.claimed_amount) || 0), 0);
        
        const contractPayments = payments.filter(p => p.contract_id === c.contract_id);
        const certified = contractPayments.reduce((sum, p) => {
            const gross = parseCurrencyInput(p.certified_amount || p.net_payable);
            const vat = parseCurrencyInput(p.vat_amount);
            return sum + (p.sub_total !== undefined ? parseCurrencyInput(p.sub_total) : (gross - vat));
        }, 0);

        return {
            name: c.package_name || c.contract_name || 'N/A',
            original,
            vo: voAmount,
            certified
        };
    });

    return data;
}

export function getRiskAndPendingTasks() {
    const projectId = state.currentProjectId;
    
    // Risk Alerts (Committed > Budget)
    const budgets = (state.appData.Budgets || []).filter(b => b.project_id === projectId);
    const contracts = (state.appData.Contracts || []).filter(c => c.project_id === projectId);
    const variations = (state.appData.Variations || []).filter(vo => vo.project_id === projectId && vo.status === 'Approved');
    
    const risks = [];
    contracts.forEach(c => {
        const relatedBudget = budgets.find(b => b.id === c.budget_id);
        if (relatedBudget) {
            const isClosed = c.status === 'Closed';
            const original = isClosed ? Number(c.final_statement_value) : (Number(c.original_value) || 0);
            const contractVOs = isClosed ? [] : variations.filter(vo => vo.contract_id === c.contract_id);
            const voAmount = contractVOs.reduce((sum, vo) => sum + (Number(vo.approved_amount) || Number(vo.claimed_amount) || 0), 0);
            const committed = original + voAmount;
            
            if (committed > relatedBudget.budgeted) {
                risks.push({
                    package: c.package_name || c.contract_name,
                    issue: `Vượt ngân sách ${formatCurrencyVND(committed - relatedBudget.budgeted)} VNĐ`
                });
            }
        }
    });

    // Pending Tasks
    const pendingTasks = [];
    
    const allVOs = (state.appData.Variations || []).filter(vo => vo.project_id === projectId && vo.status === 'Pending');
    allVOs.forEach(vo => {
        pendingTasks.push({
            type: 'Variation Order',
            name: vo.vo_id || 'VO',
            value: Number(vo.claimed_amount) || 0
        });
    });

    const allPayments = (state.appData.Payments || []).filter(p => p.project_id === projectId && (p.status === 'Draft' || p.status === 'Reviewing'));
    allPayments.forEach(p => {
        const gross = parseCurrencyInput(p.net_payable);
        const vat = parseCurrencyInput(p.vat_amount);
        pendingTasks.push({
            type: 'Thanh toán (IPC)',
            name: `IPC-${p.payment_no} (${p.contract_id})`,
            value: p.sub_total !== undefined ? parseCurrencyInput(p.sub_total) : (gross - vat)
        });
    });

    return { risks, pendingTasks };
}
