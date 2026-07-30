import { state } from '../app.js';
import { getLocalCashflow, saveLocalCashflow } from './cashflow-state.js';
import { renderCashflowTable } from './cashflow-ui-table.js';
import { formatToMonthYear, crossCheckValidation } from './cashflow-ui-utils.js';
import { parseExcelMatrixFormat, parseExcelStandardFormat } from './cashflow-excel-parser.js';

let pendingImportCashflow = [];

export function handleExcelImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const projectId = state.currentProjectId;
    const filterContract = document.getElementById('cf-filter-contract');
    const selectedContract = filterContract ? filterContract.value : '';

    const reader = new FileReader();
    reader.onload = function(event) {
        const data = new Uint8Array(event.target.result);
        const workbook = window.XLSX.read(data, {type: 'array'});
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const rows = window.XLSX.utils.sheet_to_json(worksheet, {header: 1});
        
        let newItems = [];
        let headerRowIdx = -1;
        let ipcColumns = [];
        
        for (let i = 0; i < Math.min(15, rows.length); i++) {
            let matches = 0;
            let tempMonths = [];
            for (let j = 0; j < (rows[i] ? rows[i].length : 0); j++) {
                const cellVal = rows[i][j];
                let isDate = false;
                let dateStr = "";

                if (typeof cellVal === 'string') {
                    const str = cellVal.trim();
                    if (/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[/-]\d{2,4}$/i.test(str)) {
                        isDate = true;
                        const parts = str.split(/[/-]/);
                        const monthMap = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
                        const m = monthMap[parts[0].toLowerCase().substring(0, 3)];
                        let y = parts[1];
                        if (y.length === 2) y = "20" + y;
                        dateStr = `${y}-${m}-01`;
                    } else if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(str) || /^\d{1,2}[/-]\d{2,4}$/.test(str)) {
                        isDate = true;
                        const d = new Date(str);
                        if (!isNaN(d.getTime())) {
                            dateStr = d.toISOString().substring(0, 8) + '01';
                        }
                    }
                } else if (typeof cellVal === 'number' && cellVal > 30000 && cellVal < 70000) {
                    isDate = true;
                    const dateObj = new Date(Math.round((cellVal - 25569) * 86400 * 1000));
                    if (!isNaN(dateObj.getTime())) {
                        dateStr = dateObj.toISOString().substring(0, 8) + '01';
                    }
                }

                if (isDate && dateStr) {
                    matches++;
                    tempMonths.push({ index: j, dateStr: dateStr });
                }
            }
            if (matches >= 2) {
                headerRowIdx = i;
                ipcColumns = tempMonths; 
                break;
            }
        }
        
        if (headerRowIdx !== -1 && ipcColumns.length > 0) {
            newItems = parseExcelMatrixFormat(rows, headerRowIdx, ipcColumns, projectId);
        } else {
            newItems = parseExcelStandardFormat(rows, projectId, selectedContract);
        }

        if (newItems.length > 0) {
            pendingImportCashflow = newItems;
            const importTbody = document.getElementById('cf-import-tbody');
            importTbody.innerHTML = '';
            
            newItems.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${item.package_name || '-'}</td>
                    <td><span style="font-weight:500; color:var(--primary-blue);">${item.code || '-'}</span></td>
                    <td>${item.desc || '-'}</td>
                    <td style="text-align: right; font-weight:600;">${(item.value || 0).toLocaleString('en-US')}</td>
                    <td>${formatToMonthYear(item.date)}</td>
                `;
                importTbody.appendChild(tr);
            });
            
            document.getElementById('cf-import-count').textContent = newItems.length;
            document.getElementById('cashflow-detail-modal').classList.add('hidden'); 
            document.getElementById('cashflow-import-modal').classList.remove('hidden'); 
            
        } else {
            alert("Không tìm thấy dữ liệu hợp lệ trong file Excel. Vui lòng kiểm tra lại cấu trúc.");
        }
        
        e.target.value = '';
    };
    reader.readAsArrayBuffer(file);
}

export function saveImportedCashflow() {
    if (!pendingImportCashflow || pendingImportCashflow.length === 0) return;
    
    const projectId = state.currentProjectId;
    let allData = getLocalCashflow();
    
    let addedCount = 0;
    let updatedCount = 0;
    
    pendingImportCashflow.forEach(newItem => {
        const existingIndex = allData.findIndex(item => 
            item.project_id === projectId &&
            item.package_name === newItem.package_name &&
            item.code === newItem.code
        );
        
        if (existingIndex >= 0) {
            const existing = allData[existingIndex];
            existing.desc = newItem.desc;
            existing.value = newItem.value;
            existing.date = newItem.date;
            updatedCount++;
        } else {
            allData.push(newItem);
            addedCount++;
        }
    });
    
    saveLocalCashflow(allData);
    
    pendingImportCashflow = [];
    document.getElementById('cashflow-import-modal').classList.add('hidden');
    document.getElementById('cashflow-detail-modal').classList.remove('hidden');
    
    renderCashflowTable();
    crossCheckValidation();
    alert(`✅ Đã cập nhật thành công! (Thêm mới ${addedCount} đợt thanh toán, Cập nhật ${updatedCount} đợt thanh toán hiện có)`);
}
