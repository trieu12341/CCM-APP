/**
 * ipc-construction-events.js — Sự kiện của phần nhập IPC xây dựng
 * (gắn 1 lần, ủy quyền trên #ipc-construction-section) + import sheet FS.
 */
import { escapeHtml } from '../../../utils/formatters.js';
import { parseFSSheet } from '../ipc-fs-parser.js';
import { lineKey } from '../ipc-chain.js';
import { getConstructionCtx, renderLines, updatePreview, parseMoney } from './ipc-construction-form.js';
import { fmtMoney } from './ipc-cert-ui.js';

const MONEY_FIELDS = ['contract_amount', 'to_date_amount'];
let bound = false;

function showImportMsg(html, ok) {
    const el = document.getElementById('ipc-c-import-msg');
    if (el) el.innerHTML = `<div class="ipc-c-msg ${ok ? 'ok' : 'warn'}">${html}</div>`;
}

/** Ghép dòng mới từ file với dòng kỳ trước (giữ "đến kỳ trước"). */
function mergeImported(ctx, imported) {
    const prev = new Map(ctx.lines.map(l => [lineKey(l), l.previous_amount || 0]));
    ctx.lines = imported.map(l => ({ ...l, previous_amount: prev.get(lineKey(l)) || 0 }));
}

async function handleFile(file) {
    const ctx = getConstructionCtx();
    if (!file || !ctx) return;
    if (typeof XLSX === 'undefined') { showImportMsg('Chưa tải được thư viện đọc Excel. Tải lại trang và thử lại.', false); return; }
    try {
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        const name = wb.SheetNames.find(n => n.trim().toUpperCase() === 'FS')
            || wb.SheetNames.find(n => /final summary|tổng hợp/i.test(n));
        if (!name) { showImportMsg(`Không thấy sheet "FS" trong file. Các sheet: ${escapeHtml(wb.SheetNames.join(', '))}`, false); return; }
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null });
        const r = parseFSSheet(rows);
        if (!r.lines.length) { showImportMsg(escapeHtml(r.warnings.join(' ')), false); return; }
        mergeImported(ctx, r.lines);
        renderLines();
        updatePreview();
        const check = r.fileTotals
            ? `Đối chiếu dòng tổng của file: giá trị HĐ ${fmtMoney(r.totals.contract)} / ${fmtMoney(r.fileTotals.contract)}, đến nay ${fmtMoney(r.totals.toDate)} / ${fmtMoney(r.fileTotals.toDate)}.`
            : '';
        const warn = r.warnings.length ? `<br>⚠️ ${escapeHtml(r.warnings.join(' '))}` : '';
        showImportMsg(`Đã đọc ${r.lines.length} dòng từ sheet "${escapeHtml(name)}"${r.ipcNo ? ` (IPC số ${r.ipcNo})` : ''}. ${check}${warn}`, !r.warnings.length);
    } catch (err) {
        console.error('[IPC import FS]', err);
        showImportMsg('Không đọc được file Excel: ' + escapeHtml(err.message), false);
    }
}

export function bindConstructionEvents() {
    if (bound) return;
    const box = document.getElementById('ipc-construction-section');
    if (!box) return;
    bound = true;

    box.addEventListener('input', (e) => {
        const ctx = getConstructionCtx();
        if (!ctx) return;
        const t = e.target;
        if (t.classList.contains('ipc-c-in')) {
            const i = Number(t.closest('tr')?.dataset.i);
            const f = t.dataset.f;
            if (!Number.isNaN(i) && ctx.lines[i]) {
                ctx.lines[i][f] = MONEY_FIELDS.includes(f) ? parseMoney(t.value) : t.value;
                const l = ctx.lines[i];
                const cell = t.closest('tr').querySelector('[data-kynay]');
                if (cell) cell.textContent = fmtMoney((Number(l.to_date_amount) || 0) - (Number(l.previous_amount) || 0));
            }
        }
        updatePreview();
    });

    // Định dạng lại số khi rời ô
    box.addEventListener('focusout', (e) => {
        const t = e.target;
        if (t.tagName === 'INPUT' && (t.classList.contains('num') || MONEY_FIELDS.includes(t.dataset.f))) {
            t.value = fmtMoney(parseMoney(t.value));
        }
    });

    box.addEventListener('change', (e) => {
        if (e.target.id === 'ipc-c-is-advance') {
            const adv = e.target.checked;
            document.getElementById('ipc-c-adv-box')?.classList.toggle('hidden', !adv);
            document.getElementById('ipc-c-work-box')?.classList.toggle('hidden', adv);
            updatePreview();
        }
        if (e.target.id === 'ipc-c-file') { handleFile(e.target.files[0]); e.target.value = ''; }
    });

    box.addEventListener('click', (e) => {
        const ctx = getConstructionCtx();
        if (!ctx) return;
        const t = e.target;
        if (t.id === 'ipc-c-add') {
            ctx.lines.push({ code: '', description: '', contract_amount: 0, previous_amount: 0, to_date_amount: 0 });
            renderLines(); updatePreview();
        } else if (t.dataset.del !== undefined) {
            ctx.lines.splice(Number(t.dataset.del), 1);
            renderLines(); updatePreview();
        } else if (t.id === 'ipc-c-import') {
            document.getElementById('ipc-c-file')?.click();
        } else if (t.id === 'ipc-c-use-vo') {
            e.preventDefault();
            const el = document.getElementById('ipc-c-vo');
            if (el) { el.value = fmtMoney(ctx.approvedVO); updatePreview(); }
        }
    });
}
