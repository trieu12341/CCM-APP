// Điền số IPC vào file mẫu CERT (bước 2.6). Nhận workbook ExcelJS đã nạp templates/ipc-cert.xlsx — không DOM,
// dùng chung cho trình duyệt và test Node. Ghi GIÁ TRỊ (không ghi công thức) để số khớp app tới từng đồng.
import { CERT, ATT, FS } from './ipc-xlsx-map.js';
import { soThanhChu } from '../../utils/so-thanh-chu.js';
import { numberToEnglish } from '../../utils/number-words-en.js';

const N = (v) => Math.round(Number(v) || 0);
const asDate = (d) => {
    if (!d) return null;
    const x = d?.toDate ? d.toDate() : new Date(d);
    return isNaN(x) ? null : new Date(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()));
};
// ExcelJS làm mất định dạng số "có sẵn" của Excel (numFmtId 37–44) khi lưu lại → gán lại định dạng tường minh.
const MONEY = '_(* #,##0_);_(* (#,##0);_(* "-"_);_(@_)';
const PCT = '0.00%';
const set = (ws, ref, v, numFmt) => {
    const cell = ws.getCell(ref);
    cell.value = v === undefined ? null : v;
    if (numFmt) cell.numFmt = numFmt;
    else if (typeof v === 'number' && (!cell.numFmt || cell.numFmt === 'General')) cell.numFmt = MONEY;
};

/** Chỗ trống cho n dòng từ `first`; chèn thêm dòng (chép kiểu dòng cuối) nếu vùng mẫu không đủ. Trả về số dòng đã chèn. */
function ensureRows(ws, first, last, n) {
    const extra = n - (last - first + 1);
    if (extra > 0) ws.duplicateRow(last, extra, true);
    return Math.max(0, extra);
}

function fillCert(ws, { c, no, project, contract, ipc, retentionPct, vatPct }) {
    set(ws, CERT.no, no, null);
    set(ws, CERT.project, project.project_name || project.name || '');
    set(ws, CERT.package, contract.package_name || ipc.contract_name || '');
    set(ws, CERT.employer, project.employer || project.client || '');
    set(ws, CERT.qs, project.qs_consultant || '');
    set(ws, CERT.contractor, contract.contractor_name || contract.contractor || ipc.contractor_name || '');
    set(ws, CERT.commencement, asDate(contract.start_date));
    set(ws, CERT.completion, asDate(contract.end_date));
    set(ws, CERT.submission, asDate(ipc.submission_date));
    set(ws, CERT.valuation, asDate(ipc.valuation_date || ipc.submission_date));
    for (const [, ref, key] of CERT.rows) set(ws, ref, N(c[key]), MONEY);
    set(ws, CERT.retentionLabel, `(8) = ${retentionPct}% x (7)`);
    set(ws, CERT.vatLabel, `Cộng ${vatPct}% Thuế GTGT / Add VAT ${vatPct}%`);
    set(ws, CERT.wordsVi, `Bằng chữ: ${soThanhChu(c.paymentThisPeriod)}`);
    set(ws, CERT.wordsEn, `In Words: Vietnamese Dong ${numberToEnglish(c.paymentThisPeriod)} Only`);
}

/** Att#0: tạm ứng + từng đợt tới IPC đang xuất. chain = các IPC đã tính theo thứ tự đợt. */
export function attRows(chain) {
    const rows = []; let prevPen = 0;
    for (const p of chain) {
        const c = p.computed || {};
        const adv = p.is_advance || (!N(c.grossThisPeriod) && N(c.advanceThisPeriod) > 0);
        const pen = N(c.penaltiesToDate) - prevPen; prevPen = N(c.penaltiesToDate);
        if (adv) { rows.push({ label: 'Advance Payment', date: p.submission_date, adv: N(c.advanceThisPeriod), gross: 0, vat: 0, ap: 0, ret: 0, other: 0 }); continue; }
        rows.push({ label: p.label, date: p.submission_date, adv: N(c.advanceThisPeriod), gross: N(c.grossThisPeriod), vat: N(c.vat),
            ap: -N(c.apRecoveryThisPeriod), ret: -N(c.retentionThisPeriod), other: -pen });
    }
    return rows.map(r => ({ ...r, exVat: r.adv + r.gross + r.ap + r.ret + r.other, incVat: r.adv + r.gross + r.vat + r.ap + r.ret + r.other }));
}

function fillAtt(ws, { contract, chain, vatPct }) {
    const pkg = contract.package_name || '';
    set(ws, ATT.packageEn, `PACKAGE: ${pkg.toUpperCase()}`);
    set(ws, ATT.packageVi, `GÓI THẦU: ${pkg}`);
    set(ws, ATT.vatLabel, `(c) = ${vatPct}% x (b)`);
    const rows = attRows(chain);
    const added = ensureRows(ws, ATT.first, ATT.last, rows.length);
    const C = ATT.cols;
    rows.forEach((r, i) => {
        const y = ATT.first + i;
        set(ws, C.no + y, String(i + 1).padStart(2, '0')); set(ws, C.label + y, r.label); set(ws, C.date + y, asDate(r.date));
        const advOnly = !r.gross && r.adv;   // dòng tạm ứng: chỉ (a), O, P như file gốc
        for (const k of ['adv', 'gross', 'vat', 'ap', 'ret', 'other', 'exVat', 'incVat']) {
            set(ws, C[k] + y, advOnly && !['adv', 'exVat', 'incVat'].includes(k) ? null : (k === 'adv' && !r.adv ? null : r[k]), MONEY);
        }
    });
    const t = ATT.last + added + 1;
    for (const k of ['adv', 'gross', 'vat', 'ap', 'ret', 'other', 'exVat', 'incVat']) set(ws, C[k] + t, rows.reduce((s, r) => s + (r[k] || 0), 0), MONEY);
    return rows;
}

const pct = (a, b) => (b ? a / b : null);

function fillFS(ws, { no, contract, lines, vatPct }) {
    set(ws, FS.package, contract.package_name || '');
    set(ws, FS.no, no, null);
    set(ws, FS.vatLabel, `Cộng thuế GTGT / Add VAT ${vatPct}%`);
    const added = ensureRows(ws, FS.first, FS.last, lines.length);
    const C = FS.cols, tot = { contract: 0, prev: 0, this: 0, toDate: 0 };
    lines.forEach((l, i) => {
        const y = FS.first + i, ct = N(l.contract_amount), pv = N(l.previous_amount), td = N(l.to_date_amount), th = td - pv;
        tot.contract += ct; tot.prev += pv; tot.this += th; tot.toDate += td;
        set(ws, C.item + y, i + 1, '0'); set(ws, C.code + y, l.code || ''); set(ws, C.desc + y, l.description || '');
        set(ws, C.contract + y, ct, MONEY); set(ws, C.prev + y, pv, MONEY); set(ws, C.this + y, th, MONEY); set(ws, C.toDate + y, td, MONEY);
        set(ws, C.prevPct + y, pct(pv, ct), PCT); set(ws, C.thisPct + y, pct(th, ct), PCT); set(ws, C.toDatePct + y, pct(td, ct), PCT);
    });
    const r40 = FS.last + added + 1, r41 = r40 + 1, r42 = r40 + 2;
    for (const k of ['contract', 'prev', 'this', 'toDate']) {
        const vat = N(tot[k] * vatPct / 100);
        set(ws, C[k] + r40, tot[k], MONEY); set(ws, C[k] + r41, vat, MONEY); set(ws, C[k] + r42, tot[k] + vat, MONEY);
    }
    set(ws, C.prevPct + r40, pct(tot.prev, tot.contract), PCT); set(ws, C.thisPct + r40, pct(tot.this, tot.contract), PCT); set(ws, C.toDatePct + r40, pct(tot.toDate, tot.contract), PCT);
    return tot;
}

/**
 * @param wb    workbook ExcelJS (đã load templates/ipc-cert.xlsx)
 * @param d     { ipc (đã tính), chain (các IPC tới ipc, theo đợt, mỗi cái có label), lines (có previous_amount), contract, project }
 */
export function fillIPCWorkbook(wb, { ipc, chain = [ipc], lines = [], contract = {}, project = {} }) {
    const c = ipc.computed;
    if (!c) throw new Error('IPC chưa có số theo mẫu CERT (engine v2) — chưa xuất được');
    const no = ipc.is_advance ? 0 : Number(ipc.payment_number) || null;
    const retentionPct = Number(contract.retention_percent ?? 10), vatPct = Number(c.vatPct ?? 8);
    fillCert(wb.getWorksheet('CERT'), { c, no, project, contract, ipc, retentionPct, vatPct });
    const att = fillAtt(wb.getWorksheet('Att#0'), { contract, chain, vatPct });
    const fs = fillFS(wb.getWorksheet('FS'), { no, contract, lines, vatPct });
    return { att, fs };
}
