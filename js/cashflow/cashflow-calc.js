import { state } from '../app.js';
import { getLocalCashflow, saveLocalCashflow } from './cashflow-state.js';

export function syncCashflowWithPayment(projectId) {
    let cashflows = getLocalCashflow();
    
    let payments = state.appData.Payments || [];
    if (!Array.isArray(payments) || payments.length === 0) return;
    
    let hasChanges = false;
    
    cashflows.forEach(cf => {
        if (cf.project_id === projectId) {
            // Find matching payment based on Package Name and Payment No (code)
            const matchedPayment = payments.find(p => 
                p.project_id === projectId && 
                p.package_name === cf.package_name && 
                p.code === cf.code
            );
            
            if (matchedPayment) {
                if (cf.certified_date !== matchedPayment.certified_date || 
                    cf.paid_date !== matchedPayment.paid_date ||
                    cf.status !== matchedPayment.status) {
                    
                    cf.certified_date = matchedPayment.certified_date || '';
                    cf.paid_date = matchedPayment.paid_date || '';
                    cf.status = matchedPayment.status || 'Planned';
                    hasChanges = true;
                }
            }
        }
    });
    
    if (hasChanges) {
        saveLocalCashflow(cashflows);
    }
}

export function calculateForecastEngine(cashflows, contract) {
    // Sort items by date to calculate cumulative correctly
    cashflows.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

    const retentionPercent = parseFloat(contract.retention_percent) || 0;
    const maxRetentionPercent = parseFloat(contract.max_retention_percent) || 0;
    const apPercent = parseFloat(contract.advance_payment_percent) || 0;
    const apRecoveryPercent = parseFloat(contract.ap_recovery_percent) || 0;
    const totalValue = parseFloat(contract.total_value) || 0;

    const maxRetentionValue = totalValue * (maxRetentionPercent / 100);
    const totalApValue = totalValue * (apPercent / 100);

    let cumRetention = 0;
    let cumApRecovery = 0;

    cashflows.forEach(item => {
        item.is_construction = true;

        if (item.is_imported_matrix) {
            // Bypass calculation: Trust values parsed from Excel
            cumRetention += item.retention || 0;
            cumApRecovery += item.ap_recovery || 0;
            return; // Skip recalculation
        }

        if (item.is_release_retention_1) {
            item.workdone = 0;
            item.ap_recovery = 0;
            item.retention = -(cumRetention / 2); // Release 50%
            cumRetention += item.retention; // reduces cumulative retention
            item.total_cert = item.workdone - item.retention - item.ap_recovery;
        } else if (item.is_release_retention_2) {
            item.workdone = 0;
            item.ap_recovery = 0;
            item.retention = -cumRetention; // Release remaining
            cumRetention += item.retention;
            item.total_cert = item.workdone - item.retention - item.ap_recovery;
        } else {
            let workdone = parseFloat(item.value) || 0;
            item.workdone = workdone;

            // Retention calculation
            if (item.has_custom_retention) {
                item.retention = item.custom_retention || 0;
            } else {
                let rawRetention = workdone * (retentionPercent / 100);
                if (cumRetention + rawRetention > maxRetentionValue) {
                    item.retention = Math.max(0, maxRetentionValue - cumRetention);
                } else {
                    item.retention = rawRetention;
                }
            }
            cumRetention += item.retention;

            // AP Recovery calculation
            if (item.has_custom_ap_recovery) {
                item.ap_recovery = item.custom_ap_recovery || 0;
            } else {
                let rawAp = workdone * (apRecoveryPercent / 100);
                if (cumApRecovery + rawAp > totalApValue) {
                    item.ap_recovery = Math.max(0, totalApValue - cumApRecovery);
                } else {
                    item.ap_recovery = rawAp;
                }
            }
            cumApRecovery += item.ap_recovery;

            item.total_cert = item.workdone - item.retention - item.ap_recovery;
        }
    });
}
