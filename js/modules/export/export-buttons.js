// Nút "Xuất Excel" dùng chung cho các bảng danh sách (ngân sách, gói thầu, hợp đồng, VO, dòng tiền).
import { state } from '../../app.js';
import { buildSheet, fileName } from './table-rows.js';

const TABLES = {
    'budget-tracker-table': 'Ngan sach', 'tender-tracker-table': 'Dau thau',
    'contract-table': 'Hop dong', 'vo-table': 'Phat sinh VO', 'cashflow-table': 'Dong tien',
};

function readTable(table) {
    const headers = [...table.querySelectorAll('thead tr:last-child th')].map(th => th.textContent);
    const rows = [...table.querySelectorAll('tbody tr')].filter(tr => !tr.querySelector('td[colspan]'))
        .map(tr => [...tr.children].map(td => td.textContent));
    return { headers, rows };
}

export function exportTable(table, what) {
    const { headers, rows } = readTable(table);
    const s = buildSheet(headers, rows);
    const aoa = [s.header, ...s.body, ...(s.total ? [s.total] : [])];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const last = aoa.length - 1;
    for (let r = 1; r <= last; r++) {
        s.moneyCols.forEach(c => { const cell = ws[XLSX.utils.encode_cell({ r, c })]; if (cell && cell.t === 'n') cell.z = '#,##0'; });
        s.pctCols.forEach(c => { const cell = ws[XLSX.utils.encode_cell({ r, c })]; if (cell && cell.t === 'n') { cell.v = cell.v / 100; cell.z = '0.00%'; } });
    }
    ws['!cols'] = s.header.map((h, c) => ({ wch: Math.min(40, Math.max(h.length + 2, ...aoa.slice(1).map(row => String(row[c] ?? '').length + 2))) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Danh sách');
    const p = (state.appData?.Projects || []).find(x => x.project_id === state.currentProjectId);
    XLSX.writeFile(wb, fileName(p?.project_name || p?.name || state.currentProjectId, what));
    return s;
}

export function installExportButtons() {
    for (const [id, what] of Object.entries(TABLES)) {
        const table = document.getElementById(id);
        if (!table || table.dataset.exportReady) continue;
        table.dataset.exportReady = '1';
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'btn btn-outline btn-export-xlsx'; btn.dataset.exportFor = id;
        btn.innerHTML = '<i class="fa-solid fa-file-excel"></i> Xuất Excel';
        btn.addEventListener('click', () => exportTable(table, what));
        const host = table.closest('.table-responsive, .table-container') || table.parentElement;
        host.parentElement.insertBefore(btn, host);
    }
}
