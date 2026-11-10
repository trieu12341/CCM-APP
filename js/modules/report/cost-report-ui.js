// Tab "Báo cáo chi phí" (bước 3.3): chọn ngày, bảng theo nhóm, bấm dòng xem VO / IPC tạo nên số, xuất Excel.
import { state } from '../../app.js';
import { escapeHtml, formatCurrencyVND } from '../../utils/formatters.js';
import { buildCostReport, COLS } from './cost-report.js';
import { writeCostReport } from './cost-report-xlsx.js';
import { loadExcelJS } from '../payment/ipc-xlsx-events.js';
import { isPaidIPC } from '../payment/payment-metrics.js';
import { ipcCode } from '../payment/ipc-chain.js';

const $ = (id) => document.getElementById(id);
const money = (v) => (v ? formatCurrencyVND(v) : '-');
const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
let last = null;

export function currentReport(asOf = $('cr-asof')?.value || null) {
    const d = state.appData || {};
    return buildCostReport({ budgets: d.Budgets || [], contracts: d.Contracts || [], variations: d.Variations || [], payments: d.Payments || [],
        projectId: state.currentProjectId, asOf });
}

const cells = (o, cls = '') => COLS.map(k => `<td class="num ${k === 'balance' && o[k] < 0 ? 'cr-neg' : ''} ${cls}">${money(o[k])}</td>`).join('');

export function renderCostReport() {
    const body = $('cr-body');
    if (!body) return;
    last = currentReport();
    let n = 0;
    body.innerHTML = last.groups.map((g, gi) => `
        <tr class="cr-group"><td>${String.fromCharCode(65 + gi)}</td><td></td><td>${escapeHtml(g.label)}</td>${cells(g.total)}</tr>
        ${g.rows.map(r => `<tr class="cr-row" tabindex="0" data-contract="${escapeHtml(r.contractId || '')}" title="${r.contractId ? 'Bấm để xem VO và IPC của hợp đồng này' : 'Chưa có hợp đồng'}">
            <td>${++n}</td><td>${escapeHtml(r.code)}</td><td>${escapeHtml(r.name)}${r.contractor ? `<div class="cr-sub">${escapeHtml(r.contractor)}</div>` : ''}</td>${cells(r)}</tr>`).join('')}`).join('')
        + `<tr class="cr-total"><td></td><td></td><td>TỔNG TRƯỚC THUẾ</td>${cells(last.total)}</tr>`;
    if (!last.groups.length) body.innerHTML = '<tr><td colspan="13" style="text-align:center">Dự án chưa có mục ngân sách nào.</td></tr>';
    const w = $('cr-warnings');
    w.innerHTML = last.warnings.map(x => `<div>⚠ ${escapeHtml(x)}</div>`).join('');
    w.hidden = !last.warnings.length;
    $('cr-detail').hidden = true;
}

function showDetail(contractId) {
    const d = state.appData || {}, box = $('cr-detail');
    if (!contractId) { box.hidden = true; return; }
    const c = (d.Contracts || []).find(x => x.contract_id === contractId) || {};
    const vos = (d.Variations || []).filter(v => v.contract_id === contractId && !v.deleted);
    const ipcs = (d.Payments || []).filter(p => p.contract_id === contractId && !p.deleted);
    const li = (a) => a.length ? `<ul>${a.join('')}</ul>` : '<p class="cr-sub">Không có.</p>';
    box.innerHTML = `<h3>${escapeHtml(c.package_name || contractId)} — giá trị HĐ ${money(c.original_value)}</h3>
        <div class="cr-detail-grid"><div><strong>VO</strong>${li(vos.map(v => `<li>${escapeHtml(v.vo_name || v.id || '')} · ${escapeHtml(v.status || '')} · QS: ${money(v.approved_amount)} · NT: ${money(v.claimed_amount)}</li>`))}</div>
        <div><strong>IPC</strong>${li(ipcs.map(p => `<li>${escapeHtml(ipcCode(p))} · ${escapeHtml(p.status || '')}${isPaidIPC(p) ? ' (tính vào Đã thanh toán)' : ''}${p.paid_date ? ' · trả ' + escapeHtml(String(p.paid_date)) : ''}</li>`))}</div></div>`;
    box.hidden = false;
}

async function exportXlsx() {
    const btn = $('cr-export'); btn.disabled = true;
    try {
        const ExcelJS = await loadExcelJS();
        const wb = new ExcelJS.Workbook();
        const p = (state.appData.Projects || []).find(x => x.project_id === state.currentProjectId) || {};
        const asOf = $('cr-asof').value || today();
        writeCostReport(wb, currentReport(asOf), { projectName: p.project_name || p.name || '', asOf });
        const blob = new Blob([await wb.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = `Cost-report_${String(p.project_name || state.currentProjectId).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-')}_${asOf}.xlsx`;
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (e) { console.warn('exportCostReport:', e); const w = $('cr-warnings'); w.hidden = false; w.textContent = 'Không xuất được: ' + e.message; }
    finally { btn.disabled = false; }
}

let wired = false;
export function initCostReportPage() {
    const asOf = $('cr-asof');
    if (!asOf) return;
    if (!asOf.value) asOf.value = today();
    if (!wired) {
        wired = true;
        asOf.addEventListener('change', renderCostReport);
        $('cr-export').addEventListener('click', exportXlsx);
        const pick = (e) => { const tr = e.target.closest('tr.cr-row'); if (tr) showDetail(tr.dataset.contract); };
        $('cr-body').addEventListener('click', pick);
        $('cr-body').addEventListener('keydown', (e) => { if (e.key === 'Enter') pick(e); });
    }
    renderCostReport();
}
