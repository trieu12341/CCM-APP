import { paymentTotals, isApprovedIPC } from '../payment/payment-metrics.js';
import { state } from '../../app.js';
import { parseCurrencyInput } from '../../utils/formatters.js';

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
    let advanceOutstanding = 0;   // Tạm ứng chưa thu hồi
    
    if (state.appData && state.appData.Payments) {
        // D = giá trị đã thanh toán cho công việc qua các IPC đã duyệt/đã thanh toán
        //   = Σ (14) + phần đã bù trừ vào tạm ứng (hoàn trả TƯ lũy kế)
        // E = tạm ứng đã chi nhưng chưa thu hồi → còn phải trừ khi quyết toán
        // ⇒ G = C − D − E − F đúng bằng số còn phải trả (trước thuế)
        const tt = paymentTotals(state.appData.Payments, { contractId, filter: isApprovedIPC });
        d = tt.certifiedExVat + tt.apRecovered;
        totalAdvanceRecovery = tt.apRecovered;
        advanceOutstanding = tt.advanceOutstanding;
    }
    const e = advanceOutstanding;

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
