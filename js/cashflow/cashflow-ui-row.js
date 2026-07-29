import { state } from '../app.js';
import { getLocalCashflow, saveLocalCashflow } from './cashflow-state.js';
import { formatNumberInput, formatToMonthYear } from './cashflow-ui-utils.js';
import { updateCashflowSubtotal } from './cashflow-ui-table.js';

export function createCashflowRowNode(item, isEditMode = false) {
    const tr = document.createElement('tr');
    tr.dataset.id = item.id || ('cf-' + Date.now() + '-' + Math.floor(Math.random() * 1000));
    
    if (isEditMode) {
        tr.innerHTML = `
            <td><input type="text" class="cf-input cf-package" value="${item.package_name || ''}" placeholder="Package name"></td>
            <td><input type="text" class="cf-input cf-code" value="${item.code || ''}" placeholder="Vd: IPC-01"></td>
            <td><input type="text" class="cf-input cf-desc" value="${item.desc || ''}" placeholder="Diễn giải công việc"></td>
            <td><input type="text" class="cf-input cf-value" value="${(item.value || 0).toLocaleString('en-US')}" style="width: 100%; text-align: right;"></td>
            <td><input type="date" class="cf-input cf-date" value="${item.date || ''}"></td>
            <td class="col-synced">${item.certified_date || '-'}</td>
            <td class="col-synced">${item.paid_date || '-'}</td>
            <td class="col-synced">
                <select class="cf-input cf-status" style="background-color: transparent; border: 1px solid #cbd5e1; padding: 2px;">
                    <option value="Planned" ${(!item.status || item.status === 'Planned') ? 'selected' : ''}>Planned</option>
                    <option value="Certified" ${item.status === 'Certified' ? 'selected' : ''}>Certified</option>
                    <option value="Paid" ${item.status === 'Paid' ? 'selected' : ''}>Paid</option>
                </select>
            </td>
            <td style="text-align: center; white-space: nowrap;">
                <button type="button" class="btn btn-secondary cf-save-btn" style="color:#10b981; padding: 0.25rem 0.5rem;" title="Lưu"><i class="fa-solid fa-check"></i></button>
                <button type="button" class="btn btn-secondary cf-cancel-btn" style="color:var(--text-muted); padding: 0.25rem 0.5rem;" title="Hủy"><i class="fa-solid fa-xmark"></i></button>
            </td>
        `;
        
        const valueInput = tr.querySelector('.cf-value');
        valueInput.addEventListener('input', formatNumberInput);
        
        tr.querySelector('.cf-save-btn').addEventListener('click', () => saveRowData(tr, item.id));
        tr.querySelector('.cf-cancel-btn').addEventListener('click', () => {
            if (!item.code && !item.desc) {
                tr.remove(); 
            } else {
                tr.replaceWith(createCashflowRowNode(item, false));
                const newTr = tr.previousElementSibling || tr.nextElementSibling || tr;
                if(newTr) newTr.classList.add('cf-child-row');
            }
            updateCashflowSubtotal();
        });
    } else {
        let valueHtml = '';
        if (item.is_construction) {
            valueHtml = `
                <div style="text-align: right; line-height: 1.4;">
                    <div style="font-size: 0.8rem; color: #64748b;" title="Gross Work Done">WD: ${(item.workdone || 0).toLocaleString('en-US')}</div>
                    <div style="font-size: 0.8rem; color: #ef4444;" title="Retention">Ret: ${(item.retention || 0).toLocaleString('en-US')}</div>
                    <div style="font-size: 0.8rem; color: #f97316;" title="AP Recovery">AP: ${(item.ap_recovery || 0).toLocaleString('en-US')}</div>
                    <div style="font-weight: 700; color: #10b981; margin-top: 4px; border-top: 1px dashed #cbd5e1; padding-top: 2px;" title="Net Certified">
                        Net: <span class="cf-text-value">${(item.total_cert || 0).toLocaleString('en-US')}</span>
                    </div>
                </div>
            `;
        } else {
            valueHtml = `<div style="text-align: right; font-weight:600;" class="cf-text-value">${(item.value || 0).toLocaleString('en-US')}</div>`;
        }

        tr.innerHTML = `
            <td></td>
            <td><span style="font-weight:500; color:#ea580c;">${item.code || '-'}</span></td>
            <td>${item.desc || '-'}</td>
            <td>${valueHtml}</td>
            <td>${formatToMonthYear(item.date)}</td>
            <td class="col-synced">${formatToMonthYear(item.certified_date)}</td>
            <td class="col-synced">${formatToMonthYear(item.paid_date)}</td>
            <td class="col-synced"><span class="badge ${item.status==='Paid'?'bg-blue':item.status==='Certified'?'bg-purple':'bg-gray'}" style="padding:4px 8px; font-size:0.8rem;">${item.status || 'Planned'}</span></td>
            <td style="text-align: center; white-space: nowrap;">
                <button type="button" class="btn btn-secondary cf-edit-btn manager-hide" style="color:var(--primary-blue); padding: 0.25rem 0.5rem;" title="Sửa"><i class="fa-solid fa-pencil"></i></button>
                <button type="button" class="btn btn-secondary cf-del-btn manager-hide" style="color:var(--danger-color); padding: 0.25rem 0.5rem;" title="Xóa"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        
        tr.querySelector('.cf-edit-btn').addEventListener('click', () => {
            const editTr = createCashflowRowNode(item, true);
            editTr.classList.add('cf-child-row');
            tr.replaceWith(editTr);
        });
        
        tr.querySelector('.cf-del-btn').addEventListener('click', () => {
            if (confirm('Bạn có chắc chắn muốn xóa đợt thanh toán này?')) {
                let allData = getLocalCashflow();
                allData = allData.filter(c => c.id !== item.id);
                saveLocalCashflow(allData);
                tr.remove();
                updateCashflowSubtotal();
            }
        });
    }
    
    return tr;
}

export function saveRowData(tr, existingId) {
    const projectId = state.currentProjectId;
    if (!projectId) return;

    const pkg = tr.querySelector('.cf-package').value.trim();
    const newItem = {
        id: existingId || tr.dataset.id,
        project_id: projectId,
        package_name: pkg,
        code: tr.querySelector('.cf-code').value.trim(),
        contract: pkg, 
        desc: tr.querySelector('.cf-desc').value.trim(),
        date: tr.querySelector('.cf-date').value,
        value: parseFloat(tr.querySelector('.cf-value').value.replace(/,/g, '')) || 0,
        certified_date: '', 
        paid_date: '',
        status: tr.querySelector('.cf-status').value
    };
    
    let allData = getLocalCashflow();
    const index = allData.findIndex(c => c.id === newItem.id);
    
    if (index >= 0) {
        newItem.certified_date = allData[index].certified_date;
        newItem.paid_date = allData[index].paid_date;
        allData[index] = newItem;
    } else {
        allData.push(newItem);
    }
    
    saveLocalCashflow(allData);
    tr.replaceWith(createCashflowRowNode(newItem, false));
    updateCashflowSubtotal();
}

export function addCashflowRow() {
    const filterContract = document.getElementById('cf-filter-contract');
    const selectedContract = filterContract ? filterContract.value : '';
    
    const tbody = document.getElementById('cashflow-tbody');
    const emptyMsg = tbody.querySelector('td[colspan="9"]');
    if (emptyMsg) tbody.innerHTML = '';
    
    const newItem = {
        id: 'cf-' + Date.now(),
        package_name: selectedContract,
        status: 'Planned'
    };
    
    const tr = createCashflowRowNode(newItem, true);
    tbody.insertBefore(tr, tbody.firstChild);
}
