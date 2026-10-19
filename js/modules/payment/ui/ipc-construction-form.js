/**
 * ipc-construction-form.js — Phần nhập IPC gói XÂY DỰNG trong form IPC:
 * tạm ứng (IPC 0), giá trị đến nay theo Bill / mã ngân sách, phát sinh,
 * phạt, tạm giữ, VAT, và xem trước 16 dòng chứng chỉ theo thời gian thực.
 */
import { escapeHtml } from '../../../utils/formatters.js';
import { getContractValue } from '../../../core/contract-fields.js';
import { getIPCParams } from '../ipc-engine.js';
import { buildConstructionIPC, previousIPCsFor, linesFromPrevious, lineKey } from '../ipc-chain.js';
import { renderCertTable, fmtMoney } from './ipc-cert-ui.js';

let ctx = null; // { contract, payments, editIpc, approvedVO, lines }

/** Đọc số tiền: cho phép dấu âm (dòng V.E), bỏ dấu chấm/phẩy phân cách. */
export const parseMoney = (v) => {
    const s = String(v ?? '').trim();
    if (!s) return 0;
    const n = Number(s.replace(/[^\d-]/g, ''));
    return Number.isFinite(n) ? n : 0;
};
const $ = (id) => document.getElementById(id);

export function approvedVOTotal(variations = [], contractId) {
    return variations.filter(v => v.contract_id === contractId && v.status === 'Approved')
        .reduce((s, v) => s + (Number(v.approved_amount) || Number(v.vo_amount) || 0), 0);
}

function paramsChip(contract) {
    const P = getIPCParams(contract);
    const basis = (b) => (b === 'gross' ? '(7)' : '(5)');
    return `<div class="ipc-c-params">
        <span>Giá trị HĐ <b>${fmtMoney(getContractValue(contract))}</b></span>
        <span>Tạm ứng <b>${P.advancePct}%</b></span>
        <span>Thu hồi TƯ <b>${P.apRecoveryPct}%</b> × ${basis(P.apRecoveryBasis)}</span>
        <span>Giữ lại <b>${P.retentionPct}%</b> × ${basis(P.retentionBasis)}${P.retentionCapPct ? `, trần ${P.retentionCapPct}%` : ''}</span>
        <span>VAT mặc định <b>${P.vatPct}%</b></span>
        <span class="text-muted">(sửa trong Hợp đồng)</span></div>`;
}

function lineRow(l, i) {
    const kyNay = (Number(l.to_date_amount) || 0) - (Number(l.previous_amount) || 0);
    return `<tr data-i="${i}">
        <td><input class="ipc-c-in" data-f="code" value="${escapeHtml(l.code)}" placeholder="102-03"></td>
        <td><input class="ipc-c-in" data-f="description" value="${escapeHtml(l.description)}" placeholder="Hạng mục"></td>
        <td><input class="ipc-c-in num" data-f="contract_amount" value="${fmtMoney(l.contract_amount)}" inputmode="numeric"></td>
        <td class="num muted">${fmtMoney(l.previous_amount)}</td>
        <td><input class="ipc-c-in num strong" data-f="to_date_amount" value="${fmtMoney(l.to_date_amount)}" inputmode="numeric"></td>
        <td class="num" data-kynay>${fmtMoney(kyNay)}</td>
        <td><button type="button" class="ipc-c-del" data-del="${i}" title="Xóa dòng">×</button></td></tr>`;
}

export function renderLines() {
    const tb = $('ipc-c-lines-body');
    if (tb) tb.innerHTML = ctx.lines.map(lineRow).join('') ||
        `<tr><td colspan="7" class="muted" style="text-align:center">Chưa có dòng — bấm "Thêm dòng" hoặc "Import sheet FS".</td></tr>`;
}

/**
 * @param {object} p { contract, payments, variations, editIpc, paymentNumber }
 */
export function renderConstructionSection({ contract, payments, variations, editIpc = null, paymentNumber }) {
    const box = $('ipc-construction-section');
    if (!box) return;
    if (!contract) { box.innerHTML = ''; ctx = null; return; }
    const previous = previousIPCsFor(payments, contract.contract_id, paymentNumber, editIpc?.ipc_id);
    const prevLines = linesFromPrevious(previous);
    let lines;
    if (editIpc?.lines?.length) {
        const prevMap = new Map(prevLines.map(l => [lineKey(l), l.previous_amount]));
        lines = editIpc.lines.map(l => ({ ...l, previous_amount: prevMap.get(lineKey(l)) || 0 }));
    } else {
        lines = prevLines.length ? prevLines : [{ code: '', description: 'Tổng giá trị công việc', contract_amount: getContractValue(contract), previous_amount: 0, to_date_amount: 0 }];
    }
    const approvedVO = approvedVOTotal(variations, contract.contract_id);
    const prevVO = previous.length ? (previous.at(-1).computed?.variationsToDate || 0) : 0;
    const advPaid = previous.reduce((s, p) => s + (Number(p.advance_this_period) || 0), 0);
    const advDefault = Math.max(0, Math.round(getContractValue(contract) * getIPCParams(contract).advancePct / 100) - advPaid);
    ctx = { contract, payments, previous, approvedVO, lines, editIpc };
    const e = editIpc || {};
    const isAdv = editIpc ? !!e.is_advance : (paymentNumber === 0 || (!previous.length && advDefault > 0 && !advPaid));

    box.innerHTML = `${paramsChip(contract)}
      <label class="ipc-c-check"><input type="checkbox" id="ipc-c-is-advance" ${isAdv ? 'checked' : ''}>
        Đây là hồ sơ <b>thanh toán tạm ứng</b> (IPC 0)</label>
      <div id="ipc-c-adv-box" class="form-group ${isAdv ? '' : 'hidden'}">
        <label>Số tiền tạm ứng kỳ này</label>
        <input id="ipc-c-advance" class="num" inputmode="numeric" value="${fmtMoney(e.advance_this_period ?? advDefault)}">
        <small class="text-muted">Mặc định = % tạm ứng × giá trị HĐ − đã tạm ứng (${fmtMoney(advPaid)}).</small></div>
      <div id="ipc-c-work-box" class="${isAdv ? 'hidden' : ''}">
        <div class="ipc-c-toolbar"><b>Giá trị công việc đến nay theo Bill / mã ngân sách</b>
          <span><button type="button" class="btn btn-secondary" id="ipc-c-import">Import sheet FS (Excel)</button>
          <button type="button" class="btn btn-secondary" id="ipc-c-add">+ Thêm dòng</button>
          <input type="file" id="ipc-c-file" accept=".xlsx,.xlsm,.xls" hidden></span></div>
        <div id="ipc-c-import-msg"></div>
        <div class="ipc-c-table-wrap"><table class="ipc-lines-table ipc-c-lines"><thead><tr><th>Mã NS</th><th>Hạng mục</th>
          <th class="num">Giá trị HĐ</th><th class="num">Đến kỳ trước</th><th class="num">Đến nay</th><th class="num">Kỳ này</th><th></th></tr></thead>
          <tbody id="ipc-c-lines-body"></tbody></table></div>
        <div class="form-row-3">
          <div class="form-group"><label>(6) Phát sinh thực hiện đến nay</label>
            <input id="ipc-c-vo" class="num" inputmode="numeric" value="${fmtMoney(e.variations_to_date ?? prevVO)}">
            <small class="text-muted">VO đã duyệt: ${fmtMoney(approvedVO)} — <a href="#" id="ipc-c-use-vo">dùng số này</a></small></div>
          <div class="form-group"><label>(12) Phạt &amp; khấu trừ kỳ này</label>
            <input id="ipc-c-penalty" class="num" inputmode="numeric" value="${fmtMoney(e.penalty_this_period || 0)}">
            <small class="text-muted">NCR, điện nước, OT giám sát… — trừ một lần.</small></div>
          <div class="form-group"><label>(13) Tạm giữ kỳ này</label>
            <input id="ipc-c-withhold" class="num" inputmode="numeric" value="${fmtMoney(e.withhold_this_period || 0)}">
            <small class="text-muted">Tự hoàn lại ở kỳ sau nếu không nhập lại.</small></div>
        </div></div>
      <div class="form-row-3">
        <div class="form-group"><label>% Thuế GTGT kỳ này</label>
          <input id="ipc-c-vat" type="number" step="0.5" min="0" max="100" value="${e.vat_pct ?? getIPCParams(contract).vatPct}"></div>
        <div class="form-group"><label>Ngày đánh giá (valuation)</label>
          <input id="ipc-c-valuation-date" type="date" value="${escapeHtml(e.valuation_date || '')}"></div>
      </div>
      <div class="form-calc-preview"><h4>Chứng chỉ thanh toán — xem trước</h4><div id="ipc-c-preview"></div></div>`;
    renderLines();
    updatePreview();
}

/** Dữ liệu nhập hiện tại → input cho bộ máy IPC. */
export function readConstructionInput() {
    if (!ctx) return null;
    const isAdv = $('ipc-c-is-advance')?.checked;
    return {
        is_advance: !!isAdv,
        advance_this_period: isAdv ? parseMoney($('ipc-c-advance')?.value) : 0,
        lines: isAdv ? [] : ctx.lines.map(({ code, description, contract_amount, to_date_amount }) =>
            ({ code, description, contract_amount: Number(contract_amount) || 0, to_date_amount: Number(to_date_amount) || 0 })),
        work_done_to_date: isAdv ? (ctx.previous.at(-1)?.computed?.workDoneToDate || 0) : undefined,
        variations_to_date: isAdv ? (ctx.previous.at(-1)?.computed?.variationsToDate || 0) : parseMoney($('ipc-c-vo')?.value),
        penalty_this_period: isAdv ? 0 : parseMoney($('ipc-c-penalty')?.value),
        withhold_this_period: isAdv ? 0 : parseMoney($('ipc-c-withhold')?.value),
        vat_pct: Number($('ipc-c-vat')?.value),
        valuation_date: $('ipc-c-valuation-date')?.value || '',
    };
}

/** Bản ghi IPC đầy đủ (đã tính) từ form. */
export function buildFromForm(base = {}) {
    if (!ctx) return null;
    return buildConstructionIPC({ contract: ctx.contract, input: { ...base, ...readConstructionInput() },
        previousIPCs: ctx.previous, approvedVariations: ctx.approvedVO });
}

export function updatePreview() {
    const box = $('ipc-c-preview');
    if (!box || !ctx) return;
    const rec = buildFromForm();
    box.innerHTML = renderCertTable(rec.computed);
    const netEl = $('pay-net-payable-display');
    if (netEl) netEl.textContent = `${fmtMoney(rec.computed.paymentThisPeriod)} VNĐ`;
}

export const getConstructionCtx = () => ctx;
