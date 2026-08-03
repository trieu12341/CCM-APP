import { state } from '../../app.js';

/**
 * Lấy danh sách hợp đồng cho một dự án cụ thể.
 */
export function getContractsForProject() {
    if (!state.appData || !state.appData.Contracts) return [];
    return state.appData.Contracts.filter(c => c.project_id === state.currentProjectId);
}

/**
 * Tính toán số liệu Quyết toán cho một hợp đồng cụ thể.
 * @param {string} contractId 
 */
export function calculateFinalAccount(contractId) {
    const contract = getContractsForProject().find(c => c.contract_id === contractId);
    if (!contract) return null;

    // [A] Giá trị HĐ gốc
    const a = contract.original_value || 0;

    // [B] Phát sinh đã duyệt
    let b = 0;
    if (state.appData && state.appData.Variations) {
        const approvedVOs = state.appData.Variations.filter(vo => 
            vo.contract_id === contractId && vo.status === 'Approved'
        );
        b = approvedVOs.reduce((sum, vo) => sum + (parseFloat(vo.approved_amount) || 0), 0);
    }

    // [C] Giá trị quyết toán
    const c = a + b;

    // [D] Đã thanh toán IPC & [E] Thu hồi tạm ứng
    let d = 0; // Lũy kế IPC (Certified Amount)
    let totalAdvanceRecovery = 0; // Lũy kế đã thu hồi
    
    if (state.appData && state.appData.Payments) {
        const contractPayments = state.appData.Payments.filter(p => p.contract_id === contractId);
        // D: Chỉ cộng các IPC đã duyệt/thanh toán (Approved/Paid)
        const certifiedPayments = contractPayments.filter(p => p.status === 'Approved' || p.status === 'Paid');
        d = certifiedPayments.reduce((sum, p) => sum + (parseFloat(p.certified_amount) || 0), 0);
        
        // E: Tổng thu hồi tạm ứng từ các kỳ
        totalAdvanceRecovery = certifiedPayments.reduce((sum, p) => sum + (parseFloat(p.advance_recovery_amount) || 0), 0);
    }
    
    const advancePayment = parseFloat(contract.advance_payment_amount) || 0;
    const e = Math.max(0, advancePayment - totalAdvanceRecovery);

    // Tính tạm F và G với default retention 5%
    // F (Retention) và G (Balance) sẽ được tinh chỉnh lại trên UI dựa theo User Input
    const fDefault = c * 0.05; 
    const gDefault = c - d - e - fDefault;

    return {
        contract,
        a, b, c, d, e,
        fDefault,
        gDefault
    };
}
