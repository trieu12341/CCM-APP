import { state, formatCurrency } from '../app.js';
import { getLocalContracts } from './contract-state.js';

export function toggleDynamicFields(type) {
    const dynamicFields = document.getElementById('contract-dynamic-fields');
    if (!dynamicFields) return;
    
    if (type === 'Construction') {
        dynamicFields.style.display = 'contents'; 
    } else {
        dynamicFields.style.display = 'none'; 
        document.getElementById('contract-ap-recovery-input').value = '';
        document.getElementById('contract-retention-percent-input').value = '';
        document.getElementById('contract-max-retention-input').value = '';
        document.getElementById('contract-ld-input').value = '';
    }
}

export function renderContracts() {
    const tbody = document.getElementById('contract-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    const projectId = state.currentProjectId;
    if (!projectId) return;

    const contracts = getLocalContracts().filter(c => c.project_id === projectId);
    
    if (contracts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">Không có Hợp đồng nào. Bấm "+ Tạo Hợp đồng" để thêm mới.</td></tr>`;
        return;
    }

    contracts.forEach(contract => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        
        let statusClass = '';
        let statusText = contract.status || 'Active';
        if (statusText === 'Active') {
            statusClass = 'text-green';
            statusText = 'Đang thực hiện';
        } else if (statusText === 'Closed') {
            statusClass = 'text-muted';
            statusText = 'Đã đóng';
        } else {
            statusClass = 'text-orange';
            statusText = 'Nháp';
        }

        const typeStr = contract.type === 'Consultancy' ? 'Tư vấn' : 'Thi công';

        tr.innerHTML = `
            <td style="font-weight: 500;">${contract.budget_code || '-'}</td>
            <td style="font-weight: 500; color: var(--primary-blue);">${contract.contract_code || '-'}</td>
            <td><span class="badge ${contract.type === 'Consultancy' ? 'bg-purple' : 'bg-blue'}" style="padding:4px 8px; border-radius:4px; font-size:0.8rem; background:${contract.type === 'Consultancy' ? '#e9d5ff; color:#6b21a8;' : '#dbeafe; color:#1e40af;'}">${typeStr}</span></td>
            <td>${contract.package_name || '-'}</td>
            <td>${contract.contractor || '-'}</td>
            <td style="font-weight: 600;">${formatCurrency(contract.budget_value || 0)}</td>
            <td style="font-weight: 600;">${formatCurrency(contract.total_value || 0)}</td>
            <td class="${statusClass}"><i class="fa-solid fa-circle" style="font-size: 0.5rem; margin-right: 4px;"></i>${statusText}</td>
            <td style="text-align: center;"><input type="checkbox" class="contract-cb" data-id="${contract.contract_id}"></td>
        `;
        
        tr.addEventListener('click', (e) => {
            if (e.target.classList.contains('contract-cb')) return;
            openContractModal(contract);
        });
        
        tbody.appendChild(tr);
    });
    
    const checkboxes = document.querySelectorAll('.contract-cb');
    checkboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            const anyChecked = Array.from(checkboxes).some(c => c.checked);
            const allChecked = Array.from(checkboxes).every(c => c.checked);
            const bulkBtn = document.getElementById('btn-bulk-delete-contract');
            const cbSelectAll = document.getElementById('cb-select-all-contracts');
            
            if (cbSelectAll) cbSelectAll.checked = allChecked;
            
            if (bulkBtn) {
                if (anyChecked) bulkBtn.classList.remove('hidden');
                else bulkBtn.classList.add('hidden');
            }
        });
    });
}

export function openContractModal(contract = null) {
    const modal = document.getElementById('contract-detail-modal');
    const form = document.getElementById('contract-form');
    const deleteBtn = document.getElementById('btn-delete-contract');
    
    form.reset();
    
    if (contract) {
        document.getElementById('contract-modal-title').textContent = `Sửa Hợp đồng: ${contract.contract_code}`;
        document.getElementById('contract-id-hidden').value = contract.contract_id || '';
        
        document.getElementById('contract-code-input').value = contract.contract_code || '';
        document.getElementById('contract-type-select').value = contract.type || 'Construction';
        document.getElementById('contract-name-input').value = contract.package_name || '';
        document.getElementById('contract-contractor-input').value = contract.contractor || '';
        
        if (contract.contract_date) {
            const dt = new Date(contract.contract_date);
            if (!isNaN(dt.getTime())) {
                document.getElementById('contract-date-input').value = dt.toISOString().split('T')[0];
            }
        }
        
        document.getElementById('contract-status-input').value = contract.status || 'Active';
        document.getElementById('contract-budget-input').value = contract.budget_value || '';
        document.getElementById('contract-value-input').value = contract.total_value || '';
        document.getElementById('contract-attachment-input').value = contract.attachment_url || '';
        
        document.getElementById('contract-adv-percent-input').value = contract.advance_payment_percent || '';
        document.getElementById('contract-ap-recovery-input').value = contract.ap_recovery_percent || '';
        document.getElementById('contract-retention-percent-input').value = contract.retention_percent || '';
        document.getElementById('contract-max-retention-input').value = contract.max_retention_percent || '';
        document.getElementById('contract-ld-input').value = contract.liquidated_damages || '';
        document.getElementById('contract-scope-input').value = contract.scope_of_work || '';
        
        deleteBtn.classList.remove('hidden');
        toggleDynamicFields(contract.type || 'Construction');
    } else {
        document.getElementById('contract-modal-title').textContent = `Thêm mới Hợp đồng`;
        document.getElementById('contract-id-hidden').value = '';
        deleteBtn.classList.add('hidden');
        toggleDynamicFields('Construction'); 
    }
    
    modal.classList.remove('hidden');
}
