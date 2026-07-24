import { state, formatCurrency } from './app.js';
import { saveContracts } from './api.js';

export function setupContractEvents() {
    const btnNewContract = document.getElementById('btn-new-contract');
    const modal = document.getElementById('contract-detail-modal');
    const closeBtn = document.getElementById('close-contract-modal');
    const cancelBtn = document.getElementById('btn-cancel-contract');
    const typeSelect = document.getElementById('contract-type-select');
    const form = document.getElementById('contract-form');
    const deleteBtn = document.getElementById('btn-delete-contract');

    if (btnNewContract) {
        btnNewContract.addEventListener('click', () => {
            openContractModal();
        });
    }

    const closeFn = () => modal.classList.add('hidden');
    if (closeBtn) closeBtn.addEventListener('click', closeFn);
    if (cancelBtn) cancelBtn.addEventListener('click', closeFn);

    if (typeSelect) {
        typeSelect.addEventListener('change', (e) => {
            toggleDynamicFields(e.target.value);
        });
    }

    if (form) {
        // Handle Save
        document.getElementById('btn-save-contract').addEventListener('click', (e) => {
            e.preventDefault();
            if (form.checkValidity()) {
                saveContract();
            } else {
                form.reportValidity();
            }
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            deleteContract();
        });
    }

    const importFile = document.getElementById('contract-excel-import');
    if (importFile) {
        const newImportFile = importFile.cloneNode(true);
        importFile.parentNode.replaceChild(newImportFile, importFile);
        newImportFile.addEventListener('change', handleContractExcelImport);
    }
    
    const btnBulkDelete = document.getElementById('btn-bulk-delete-contract');
    if (btnBulkDelete) {
        btnBulkDelete.addEventListener('click', bulkDeleteContracts);
    }
    
    const cbSelectAll = document.getElementById('cb-select-all-contracts');
    if (cbSelectAll) {
        cbSelectAll.addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('.contract-cb');
            checkboxes.forEach(cb => cb.checked = e.target.checked);
            
            if (btnBulkDelete) {
                if (e.target.checked && checkboxes.length > 0) btnBulkDelete.classList.remove('hidden');
                else btnBulkDelete.classList.add('hidden');
            }
        });
    }

    renderContracts();
}

function getLocalContracts() {
    return [...state.appData.Contracts];
}

function saveLocalContracts(contracts) {
    state.appData.Contracts = contracts;
    saveContracts(contracts).catch(err => console.error('Failed to save contracts', err));
}

function toggleDynamicFields(type) {
    const dynamicFields = document.getElementById('contract-dynamic-fields');
    if (!dynamicFields) return;
    
    if (type === 'Construction') {
        dynamicFields.style.display = 'contents'; // Show
    } else {
        dynamicFields.style.display = 'none'; // Hide
        // Optionally clear values
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

function openContractModal(contract = null) {
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
        toggleDynamicFields('Construction'); // Default
    }
    
    modal.classList.remove('hidden');
}

function saveContract() {
    const projectId = state.currentProjectId;
    if (!projectId) {
        alert('Vui lòng chọn Dự án trước!');
        return;
    }
    
    const contractId = document.getElementById('contract-id-hidden').value || 'c-' + Date.now();
    let allContracts = getLocalContracts();
    let index = allContracts.findIndex(c => c.contract_id === contractId);
    
    let existingContract = {};
    if (index >= 0) {
        existingContract = allContracts[index];
    }
    
    const updatedContract = {
        ...existingContract,
        contract_id: contractId,
        project_id: projectId,
        contract_code: document.getElementById('contract-code-input').value.trim(),
        type: document.getElementById('contract-type-select').value,
        package_name: document.getElementById('contract-name-input').value.trim(),
        contractor: document.getElementById('contract-contractor-input').value.trim(),
        contract_date: document.getElementById('contract-date-input').value,
        status: document.getElementById('contract-status-input').value,
        budget_value: parseFloat(document.getElementById('contract-budget-input').value) || 0,
        total_value: parseFloat(document.getElementById('contract-value-input').value) || 0,
        attachment_url: document.getElementById('contract-attachment-input').value.trim(),
        
        advance_payment_percent: parseFloat(document.getElementById('contract-adv-percent-input').value) || 0,
        ap_recovery_percent: parseFloat(document.getElementById('contract-ap-recovery-input').value) || 0,
        retention_percent: parseFloat(document.getElementById('contract-retention-percent-input').value) || 0,
        max_retention_percent: parseFloat(document.getElementById('contract-max-retention-input').value) || 0,
        liquidated_damages: document.getElementById('contract-ld-input').value.trim(),
        scope_of_work: document.getElementById('contract-scope-input').value.trim()
    };
    
    if (index >= 0) {
        allContracts[index] = updatedContract;
    } else {
        allContracts.push(updatedContract);
    }
    
    saveLocalContracts(allContracts);
    
    // Sync state
    state.appData.Contracts = allContracts;
    
    document.getElementById('contract-detail-modal').classList.add('hidden');
    renderContracts();
}

function deleteContract() {
    const contractId = document.getElementById('contract-id-hidden').value;
    if (!contractId) return;
    
    if (confirm('Bạn có chắc chắn muốn xóa hợp đồng này không?')) {
        let allContracts = getLocalContracts();
        allContracts = allContracts.filter(c => c.contract_id !== contractId);
        
        saveLocalContracts(allContracts);
        state.appData.Contracts = allContracts;
        
        document.getElementById('contract-detail-modal').classList.add('hidden');
        renderContracts();
    }
}

function handleContractExcelImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const projectId = state.currentProjectId;
    if (!projectId) {
        alert("Vui lòng chọn Dự án trước khi Import.");
        e.target.value = "";
        return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const rows = XLSX.utils.sheet_to_json(worksheet, {header: 1});
        
        let newItems = [];
        // Header is row 0
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length < 4) continue; // At least code and pkgName
            
            const budgetCode = row[0];
            const code = row[1];
            const type = row[2];
            const pkgName = row[3];
            const contractor = row[4];
            const budgetRaw = row[5];
            const valueRaw = row[6];
            const status = row[7];
            
            if (!code || !pkgName) continue;
            
            let budgetValue = parseFloat(budgetRaw);
            if (isNaN(budgetValue)) budgetValue = 0;
            
            let value = parseFloat(valueRaw);
            if (isNaN(value)) value = 0;
            
            let typeStr = type ? type.toString().trim() : 'Construction';
            if (typeStr.toLowerCase() === 'tư vấn' || typeStr.toLowerCase() === 'consultancy') {
                typeStr = 'Consultancy';
            } else {
                typeStr = 'Construction';
            }
            
            newItems.push({
                contract_id: 'c-' + Date.now() + '-' + i,
                project_id: projectId,
                budget_code: budgetCode ? budgetCode.toString().trim() : '',
                contract_code: code.toString().trim(),
                type: typeStr,
                package_name: pkgName.toString().trim(),
                contractor: contractor ? contractor.toString().trim() : '',
                budget_value: budgetValue,
                total_value: value,
                status: status ? status.toString().trim() : 'Active'
            });
        }
        
        if (newItems.length > 0) {
            let allData = getLocalContracts();
            
            // Filter out existing ones with the same code in the same project to avoid duplicates
            const newCodes = newItems.map(item => item.contract_code);
            allData = allData.filter(c => !(c.project_id === projectId && newCodes.includes(c.contract_code)));
            
            allData = allData.concat(newItems);
            saveLocalContracts(allData);
            state.appData.Contracts = allData;
            
            alert(`Import thành công ${newItems.length} Hợp đồng!`);
            renderContracts();
        } else {
            alert("Không tìm thấy dữ liệu hợp lệ trong file Excel. Yêu cầu ít nhất Mã HĐ và Tên Gói thầu.");
        }
        
        e.target.value = "";
    };
    
    reader.readAsArrayBuffer(file);
}

function bulkDeleteContracts() {
    const checkboxes = document.querySelectorAll('.contract-cb:checked');
    if (checkboxes.length === 0) return;
    
    if (!confirm(`Bạn có chắc chắn muốn xóa ${checkboxes.length} hợp đồng đã chọn?`)) return;
    
    const idsToDelete = Array.from(checkboxes).map(cb => cb.dataset.id);
    let allData = getLocalContracts();
    allData = allData.filter(c => !idsToDelete.includes(c.contract_id));
    
    saveLocalContracts(allData);
    state.appData.Contracts = allData;
    
    document.getElementById('btn-bulk-delete-contract').classList.add('hidden');
    renderContracts();
}
