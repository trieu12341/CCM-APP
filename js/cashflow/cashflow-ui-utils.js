import { state } from '../app.js';
import { getLocalCashflow } from './cashflow-state.js';
import { updateCashflowSubtotal } from './cashflow-ui-table.js';

export function getContractOptions(selectedVal = '') {
    let contracts = state.appData.Contracts || [];
    const projectId = state.currentProjectId;
    let html = `<option value="">-- Tất cả hợp đồng --</option>`;
    if (projectId) {
        contracts.filter(c => c.project_id === projectId).forEach(c => {
            const pkgName = c.package_name || '';
            if (pkgName) {
                const sel = selectedVal === pkgName ? 'selected' : '';
                html += `<option value="${pkgName}" ${sel}>${pkgName}</option>`;
            }
        });
    }
    return html;
}

export function formatNumberInput(e) {
    let input = e.target;
    let val = input.value.replace(/,/g, '');
    if (val === '') {
        input.value = '';
        updateCashflowSubtotal();
        return;
    }
    const num = parseFloat(val);
    if (!isNaN(num)) {
        input.value = num.toLocaleString('en-US');
    } else {
        input.value = '';
    }
    updateCashflowSubtotal();
}

export function formatToMonthYear(dateString) {
    if (!dateString) return '-';
    const parts = dateString.split('-');
    if (parts.length >= 2) {
        return `${parts[1]}/${parts[0]}`;
    }
    return dateString;
}

export function crossCheckValidation() {
    const alertDiv = document.getElementById('cf-validation-alert');
    if (!alertDiv) return;
    
    const projectId = state.currentProjectId;
    if (!projectId) {
        alertDiv.classList.add('hidden');
        return;
    }
    
    let masterContracts = state.appData.Contracts || [];
    masterContracts = masterContracts.filter(c => c.project_id === projectId);
    const masterPackages = masterContracts.map(c => c.package_name).filter(Boolean);
    
    let cashflows = getLocalCashflow().filter(c => c.project_id === projectId);
    
    if (cashflows.length === 0) {
        alertDiv.classList.add('hidden');
        return;
    }
    
    const cashflowPackages = [...new Set(cashflows.map(c => c.package_name).filter(Boolean))];
    
    const missingInContract = cashflowPackages.filter(p => !masterPackages.includes(p));
    const missingInCashflow = masterPackages.filter(p => !cashflowPackages.includes(p));
    
    if (missingInContract.length === 0 && missingInCashflow.length === 0) {
        alertDiv.className = 'validation-alert success';
        alertDiv.innerHTML = `<i class="fa-solid fa-circle-check"></i> <strong>Đồng bộ hoàn toàn:</strong> Dữ liệu khớp 100% với Contract (${masterPackages.length}/${masterPackages.length} gói thầu).`;
    } else {
        alertDiv.className = 'validation-alert warning';
        let msgs = [];
        if (missingInCashflow.length > 0) {
            msgs.push(`Phát hiện ${missingInCashflow.length} gói thầu chưa lập Cashflow (${missingInCashflow.join(', ')}).`);
        }
        if (missingInContract.length > 0) {
            msgs.push(`Phát hiện ${missingInContract.length} gói thầu có trong Cashflow nhưng không có trong Contract (${missingInContract.join(', ')}).`);
        }
        alertDiv.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <div><strong>Cảnh báo Dữ liệu:</strong><br>${msgs.join('<br>')}</div>`;
    }
    
    alertDiv.classList.remove('hidden');
}
