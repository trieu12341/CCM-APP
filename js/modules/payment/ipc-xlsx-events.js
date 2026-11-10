// Nút "Xuất Excel" ở chi tiết IPC: điền số vào file mẫu CERT (templates/ipc-cert.xlsx) và tải về (bước 2.6).
import { state } from '../../app.js';
import { getIPCById } from './payment-state.js';
import { contractIPCs, ipcCode } from './ipc-chain.js';
import { withPreviousAmounts } from './ui/payment-layer3-ui.js';
import { fillIPCWorkbook } from './ipc-xlsx.js';
import { showToast, getCurrentDetailIpcId } from './payment-nav.js';

const EXCELJS_URL = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
const TEMPLATE_URL = 'templates/ipc-cert.xlsx';

let loading = null;
function loadExcelJS() {
    if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
    loading ||= new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = EXCELJS_URL; s.async = true;
        s.onload = () => (window.ExcelJS ? resolve(window.ExcelJS) : reject(new Error('Không nạp được thư viện ExcelJS')));
        s.onerror = () => { loading = null; reject(new Error('Không tải được thư viện ExcelJS — kiểm tra mạng')); };
        document.head.appendChild(s);
    });
    return loading;
}

const safe = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Dữ liệu để điền: IPC, chuỗi IPC tới nó (Att#0), dòng Bill (FS), hợp đồng, dự án. */
export function exportData(ipcId) {
    const ipc = getIPCById(ipcId);
    if (!ipc) throw new Error('Không tìm thấy IPC');
    const all = contractIPCs(state.appData.Payments || [], ipc.contract_id);
    const chain = all.slice(0, all.findIndex(p => p.ipc_id === ipc.ipc_id) + 1).map(p => ({ ...p, label: p.is_advance ? 'Advance Payment' : ipcCode(p) }));
    return {
        ipc, chain, lines: withPreviousAmounts(ipc, all),
        contract: (state.appData.Contracts || []).find(c => c.contract_id === ipc.contract_id) || {},
        project: (state.appData.Projects || []).find(p => p.project_id === (ipc.project_id || state.currentProjectId)) || {},
    };
}

export async function exportIPCXlsx(ipcId) {
    const data = exportData(ipcId);
    if (!data.ipc.computed) throw new Error('IPC này chưa có số theo mẫu CERT (gói tư vấn / nhập kiểu cũ) — chưa xuất được');
    const [ExcelJS, buf] = await Promise.all([loadExcelJS(), fetch(TEMPLATE_URL).then(r => { if (!r.ok) throw new Error('Không tải được file mẫu CERT'); return r.arrayBuffer(); })]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    fillIPCWorkbook(wb, data);
    const out = await wb.xlsx.writeBuffer();
    const name = `${ipcCode(data.ipc)}_${safe(data.contract.contract_code || data.contract.package_name || data.ipc.contract_id)}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    return name;
}

export function setupIPCXlsx() {
    const btn = document.getElementById('btn-xlsx-ipc');
    btn?.addEventListener('click', async () => {
        const ipcId = getCurrentDetailIpcId();
        btn.disabled = true;
        try { const name = await exportIPCXlsx(ipcId); showToast(`Đã xuất ${name}`, 'success'); }
        catch (e) { console.warn('exportIPCXlsx:', e); showToast(e.message, 'error'); }
        finally { btn.disabled = false; }
    });
}
