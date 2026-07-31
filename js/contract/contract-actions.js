import { state } from '../app.js';
import { getLocalContracts, saveLocalContracts } from './contract-state.js';
import { renderContracts } from './contract-ui.js';
import { generateCashflowForContract } from '../cashflow/cashflow-calc.js';

export function saveContract() {
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
    generateCashflowForContract(updatedContract);

    document.getElementById('contract-detail-modal').classList.add('hidden');
    renderContracts();
    document.dispatchEvent(new Event('dashboardStateChanged'));
}

export function deleteContract() {
    const contractId = document.getElementById('contract-id-hidden').value;
    if (!contractId) return;
    
    if (confirm('Bạn có chắc chắn muốn xóa hợp đồng này không?')) {
        let allContracts = getLocalContracts();
        allContracts = allContracts.filter(c => c.contract_id !== contractId);
        
        saveLocalContracts(allContracts);
        document.getElementById('contract-detail-modal').classList.add('hidden');
        renderContracts();
    }
}

export function bulkDeleteContracts() {
    const checkboxes = document.querySelectorAll('.contract-cb:checked');
    if (checkboxes.length === 0) return;
    
    if (!confirm(`Bạn có chắc chắn muốn xóa ${checkboxes.length} hợp đồng đã chọn?`)) return;
    
    const idsToDelete = Array.from(checkboxes).map(cb => cb.dataset.id);
    let allData = getLocalContracts();
    allData = allData.filter(c => !idsToDelete.includes(c.contract_id));
    
    saveLocalContracts(allData);
    document.getElementById('btn-bulk-delete-contract').classList.add('hidden');
    renderContracts();
}

export function handleContractExcelImport(e) {
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
        const workbook = window.XLSX.read(data, {type: 'array'});
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const rows = window.XLSX.utils.sheet_to_json(worksheet, {header: 1});
        
        let newItems = [];
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length < 4) continue;
            
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
            
            const newCodes = newItems.map(item => item.contract_code);
            allData = allData.filter(c => !(c.project_id === projectId && newCodes.includes(c.contract_code)));
            
            allData = allData.concat(newItems);
            saveLocalContracts(allData);
            
            alert(`Import thành công ${newItems.length} Hợp đồng!`);
            renderContracts();
        } else {
            alert("Không tìm thấy dữ liệu hợp lệ trong file Excel. Yêu cầu ít nhất Mã HĐ và Tên Gói thầu.");
        }
        
        e.target.value = "";
    };
    
    reader.readAsArrayBuffer(file);
}
