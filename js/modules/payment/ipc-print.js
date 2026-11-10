// Trang in chứng chỉ IPC khổ A4 dọc (bước 2.7). buildIPCPrintHtml là hàm thuần (trả về chuỗi HTML trọn trang).
import { certRows, renderLinesTable } from './ui/ipc-cert-ui.js';
import { soThanhChu } from '../../utils/so-thanh-chu.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

const CSS = `
:root { --ink: #111827; --muted: #4b5563; --line: #9ca3af; --soft: #f3f4f6; --mark: rgba(220, 38, 38, .13); }
@page { size: A4 portrait; margin: 14mm 12mm; }
* { box-sizing: border-box; }
body { font-family: "Times New Roman", Times, serif; color: var(--ink); background: #fff; font-size: 11pt; margin: 0; }
.sheet { max-width: 186mm; margin: 0 auto; padding: 8mm 0; position: relative; }
.toolbar { position: sticky; top: 0; background: var(--soft); padding: 8px; text-align: center; border-bottom: 1px solid var(--line); }
.toolbar button { font-size: 14px; padding: 6px 16px; cursor: pointer; }
h1 { text-align: center; font-size: 15pt; margin: 4mm 0 1mm; text-transform: uppercase; }
.sub { text-align: center; color: var(--muted); margin-bottom: 4mm; }
.info { width: 100%; border-collapse: collapse; margin-bottom: 4mm; }
.info td { padding: 1mm 2mm; vertical-align: top; } .info td:first-child { width: 34%; color: var(--muted); }
table.ipc-cert-table, table.ipc-lines-table { width: 100%; border-collapse: collapse; }
.ipc-cert-table td, .ipc-lines-table td, .ipc-lines-table th { border: 1px solid var(--line); padding: 1.2mm 2mm; }
.ipc-lines-table { font-size: 9pt; margin-top: 3mm; } .ipc-lines-table th { background: var(--soft); }
td.no { width: 12mm; text-align: center; } .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
tr.is-sub td { font-weight: bold; } tr.is-total td { font-weight: bold; background: var(--soft); font-size: 12pt; }
.words { margin: 3mm 0; font-style: italic; } .words b { font-style: normal; }
.sign { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; margin-top: 8mm; text-align: center; page-break-inside: avoid; }
.sign .role { font-weight: bold; text-transform: uppercase; } .sign .hint { color: var(--muted); font-size: 9pt; }
.sign .space { height: 24mm; } .sign .name { font-weight: bold; min-height: 5mm; }
.draft { position: fixed; top: 40%; left: 0; right: 0; text-align: center; font-size: 72pt; font-weight: bold;
         color: var(--mark); transform: rotate(-30deg); pointer-events: none; z-index: 0; }
@media print { .toolbar { display: none; } .sheet { padding: 0; } }
`;

const fmtDate = (d) => {
    if (!d) return '';
    const x = typeof d === 'string' ? new Date(d) : d?.toDate ? d.toDate() : d instanceof Date ? d : null;
    return x && !isNaN(x) ? x.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : String(d);
};

/**
 * @param {object} p
 * @param {object} p.ipc          IPC đã tính (ipc.computed theo engine v2)
 * @param {object} p.contract     hợp đồng
 * @param {object} p.project      dự án
 * @param {Array}  p.lines        dòng Bill kèm previous_amount (có thể rỗng)
 * @param {boolean} p.draft       true → in kèm dấu nước BẢN NHÁP
 * @param {object} p.signers      { qs: {name, date}, pm: {name, date}, client: {name, date} }
 */
export function buildIPCPrintHtml({ ipc, contract = {}, project = {}, lines = [], draft = true, signers = {}, code = '', period = '' }) {
    const c = ipc.computed;
    if (!c) throw new Error('IPC chưa có số theo mẫu CERT (engine v2) — chưa in được');
    const sig = (key, role, hint) => {
        const s = signers[key] || {};
        return `<div><div class="role">${role}</div><div class="hint">${hint}</div><div class="space"></div>
            <div class="name">${esc(s.name || '')}</div><div class="hint">${s.date ? 'Ngày ' + esc(fmtDate(s.date)) : 'Ngày ...../...../.........'}</div></div>`;
    };
    const info = [
        ['Dự án', project.project_name || project.name || ipc.project_id],
        ['Hợp đồng', [contract.contract_code || contract.contract_id, contract.package_name || ipc.contract_name].filter(Boolean).join(' — ')],
        ['Nhà thầu', contract.contractor_name || ipc.contractor_name],
        ['Đợt thanh toán', period],
        ['Ngày đệ trình', fmtDate(ipc.submission_date)],
    ].filter(([, v]) => v);
    return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(code)} — Chứng chỉ thanh toán</title><style>${CSS}</style></head><body>
<div class="toolbar"><button type="button" id="btn-print-now" onclick="window.print()">In / Lưu PDF</button></div>
${draft ? '<div class="draft" data-draft>BẢN NHÁP</div>' : ''}
<div class="sheet">
<h1>Chứng chỉ thanh toán tạm</h1><div class="sub">Interim Payment Certificate — ${esc(code)}</div>
<table class="info"><tbody>${info.map(([k, v]) => `<tr><td>${k}</td><td>${esc(v)}</td></tr>`).join('')}</tbody></table>
<table class="ipc-cert-table"><tbody>${certRows(c).map(r => `<tr class="${r.total ? 'is-total' : r.sub ? 'is-sub' : ''}">
<td class="no">${r.no}</td><td>${esc(r.label)}</td><td class="num" data-row="${r.no}">${r.value}</td></tr>`).join('')}</tbody></table>
<p class="words" data-words>Bằng chữ: <b>${esc(soThanhChu(c.paymentThisPeriod))}</b></p>
${lines.length ? renderLinesTable(lines) : ''}
<div class="sign">${sig('qs', 'QS lập', 'Ký, ghi rõ họ tên')}${sig('pm', 'Quản lý dự án', 'Ký, ghi rõ họ tên')}${sig('client', 'Chủ đầu tư', 'Ký, đóng dấu')}</div>
</div></body></html>`;
}
