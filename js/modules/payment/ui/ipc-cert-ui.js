/**
 * ipc-cert-ui.js — Hiển thị IPC xây dựng theo mẫu CERT: bảng 16 dòng,
 * bảng dòng Bill / mã ngân sách, bảng tổng hợp thanh toán, bảng thu hồi tạm ứng.
 * Chỉ dựng HTML (chuỗi) từ số đã tính — không tự tính toán.
 */
import { escapeHtml } from '../../../utils/formatters.js';
import { summarizeIPC } from '../ipc-engine.js';

const fmt = (v) => new Intl.NumberFormat('vi-VN').format(Math.round(Number(v) || 0));
const pct = (v) => `${(Number(v) || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`;
const neg = (v) => (Number(v) ? `(${fmt(v)})` : '—');

/** 16 dòng chứng chỉ. */
export function certRows(c) {
    return [
        { no: '(1)', label: 'Giá trị Hợp đồng chấp thuận', value: fmt(c.contractSum) },
        { no: '(2)', label: 'Giá trị phát sinh đã duyệt', value: fmt(c.approvedVariations) },
        { no: '(3)', label: 'Giá trị HĐ điều chỉnh', value: fmt(c.adjustedContractSum), sub: true },
        { no: '(4)', label: `Tạm ứng: kỳ trước ${fmt(c.advancePrevious)} + kỳ này ${fmt(c.advanceThisPeriod)}`, value: fmt(c.advanceToDate) },
        { no: '(5)', label: 'Giá trị công việc thực hiện đến nay', value: fmt(c.workDoneToDate) },
        { no: '(6)', label: 'Phát sinh thực hiện đến nay', value: fmt(c.variationsToDate) },
        { no: '(7)', label: 'Tổng giá trị thực hiện đến nay = (5) + (6)', value: fmt(c.grossToDate), sub: true },
        { no: '(8)', label: 'Trừ giữ lại đến nay', value: neg(c.retentionToDate) },
        { no: '(9)', label: 'Trừ hoàn trả tạm ứng đến nay', value: neg(c.apRecoveryToDate) },
        { no: '(10)', label: 'Giá trị xác nhận đến nay = (7) − (8) − (9)', value: fmt(c.certifiedToDate), sub: true },
        { no: '(11)', label: 'Trừ: đã xác nhận các kỳ trước', value: neg(c.previousCertified) },
        { no: '(12)', label: 'Trừ: phạt & khấu trừ (lũy kế)', value: neg(c.penaltiesToDate) },
        { no: '(13)', label: 'Trừ: tạm giữ kỳ này', value: neg(c.withhold) },
        { no: '(14)', label: 'Giá trị kỳ này trước thuế', value: fmt(c.thisPeriodExVat), sub: true },
        { no: '(15)', label: `Thuế GTGT ${pct(c.vatPct)} × KL gộp kỳ này (${fmt(c.grossThisPeriod)})`, value: fmt(c.vat) },
        { no: '(16)', label: 'THANH TOÁN KỲ NÀY = (4b) + (14) + (15)', value: fmt(c.paymentThisPeriod), total: true },
    ];
}

export function renderCertTable(c) {
    if (!c) return '';
    return `<table class="ipc-cert-table"><tbody>${certRows(c).map(r => `
        <tr class="${r.total ? 'is-total' : r.sub ? 'is-sub' : ''}">
            <td class="no">${r.no}</td><td>${r.label}</td><td class="num">${r.value}</td>
        </tr>`).join('')}</tbody></table>`;
}

/** Bảng dòng Bill / mã ngân sách (chỉ đọc). */
export function renderLinesTable(lines = []) {
    if (!lines.length) return '';
    let tc = 0, tp = 0, tt = 0;
    const body = lines.map(l => {
        const prev = Number(l.previous_amount) || 0, to = Number(l.to_date_amount) || 0, ca = Number(l.contract_amount) || 0;
        tc += ca; tp += prev; tt += to;
        return `<tr><td>${escapeHtml(l.code)}</td><td>${escapeHtml(l.description)}</td>
            <td class="num">${fmt(ca)}</td><td class="num">${fmt(prev)}</td><td class="num">${fmt(to - prev)}</td>
            <td class="num"><strong>${fmt(to)}</strong></td><td class="num">${ca ? pct(to / ca * 100) : '—'}</td></tr>`;
    }).join('');
    return `<table class="ipc-lines-table"><thead><tr><th>Mã NS</th><th>Hạng mục</th><th class="num">Giá trị HĐ</th>
        <th class="num">Đến kỳ trước</th><th class="num">Kỳ này</th><th class="num">Đến nay</th><th class="num">% HT</th></tr></thead>
        <tbody>${body}</tbody><tfoot><tr><td></td><td>Tổng</td><td class="num">${fmt(tc)}</td><td class="num">${fmt(tp)}</td>
        <td class="num">${fmt(tt - tp)}</td><td class="num">${fmt(tt)}</td><td class="num">${tc ? pct(tt / tc * 100) : '—'}</td></tr></tfoot></table>`;
}

/** Bảng tổng hợp thanh toán (Summary of payment) cho các IPC của một hợp đồng. */
export function renderSummaryOfPayment(ipcs = [], uptoId = null) {
    const rows = [];
    let tC = 0, tV = 0, tP = 0;
    for (const ipc of ipcs) {
        const s = summarizeIPC(ipc);
        const label = ipc.is_advance ? 'Tạm ứng' : `IPC#${ipc.payment_number}`;
        const amount = ipc.is_advance ? s.advance : s.certifiedExVat;
        tC += amount; tV += s.vat; tP += s.payment;
        rows.push(`<tr class="${ipc.ipc_id === uptoId ? 'is-current' : ''}"><td>${label}</td><td class="num">${fmt(amount)}</td>
            <td class="num">${fmt(s.vat)}</td><td class="num">${fmt(s.payment)}</td><td>${escapeHtml(ipc.status || '')}</td>
            <td>${escapeHtml(ipc.paid_date || '')}</td></tr>`);
        if (ipc.ipc_id === uptoId) break;
    }
    return `<table class="ipc-lines-table"><thead><tr><th>Đợt</th><th class="num">Xác nhận (trước thuế)</th><th class="num">VAT</th>
        <th class="num">Thanh toán</th><th>Trạng thái</th><th>Ngày TT</th></tr></thead><tbody>${rows.join('')}</tbody>
        <tfoot><tr><td>Tổng</td><td class="num">${fmt(tC)}</td><td class="num">${fmt(tV)}</td><td class="num">${fmt(tP)}</td><td></td><td></td></tr></tfoot></table>`;
}

/** Bảng thu hồi tạm ứng. */
export function renderAPRecoup(c) {
    if (!c || !c.advanceToDate) return '';
    return `<table class="ipc-lines-table"><thead><tr><th class="num">Tạm ứng đã nhận</th><th class="num">Thu hồi đến kỳ trước</th>
        <th class="num">Thu hồi kỳ này</th><th class="num">Thu hồi đến nay</th><th class="num">Còn phải thu hồi</th></tr></thead>
        <tbody><tr><td class="num">${fmt(c.advanceToDate)}</td><td class="num">${fmt(c.apRecoveryToDate - c.apRecoveryThisPeriod)}</td>
        <td class="num">${fmt(c.apRecoveryThisPeriod)}</td><td class="num">${fmt(c.apRecoveryToDate)}</td>
        <td class="num">${fmt(c.apOutstanding)}</td></tr></tbody></table>`;
}

export { fmt as fmtMoney };
