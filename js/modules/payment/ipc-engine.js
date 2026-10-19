/**
 * ipc-engine.js — Bộ máy tính Chứng chỉ thanh toán tạm (IPC) gói xây dựng
 * theo mẫu CERT (phương pháp LŨY KẾ: tính "đến nay" rồi trừ phần đã xác nhận).
 *
 *  (1)  Giá trị HĐ chấp thuận           (2) Phát sinh duyệt     (3) = (1)+(2)
 *  (4)  Tạm ứng = (4a) kỳ trước + (4b) kỳ này
 *  (5)  Giá trị công việc đến nay = Σ dòng theo Bill / mã ngân sách
 *  (6)  Phát sinh đến nay
 *  (7)  Tổng giá trị thực hiện đến nay = (5) + (6)
 *  (8)  Giữ lại đến nay  = ROUND(r% × cơ sở)   [cơ sở mặc định (7); có trần tùy chọn]
 *  (9)  Hoàn trả TƯ đến nay = MIN(TƯ đến nay; ROUND(k% × cơ sở)) [mặc định (5)]
 *  (10) Xác nhận đến nay = (7) − (8) − (9)
 *  (11) Đã xác nhận các kỳ trước = Σ (14) các IPC trước
 *  (12) Phạt & khấu trừ (lũy kế)   (13) Tạm giữ (chỉ kỳ này, tự hoàn kỳ sau)
 *  (14) Kỳ này trước thuế = ROUND((10) − (11) − (12) − (13))
 *  (15) VAT = ROUND(v% × giá trị gộp kỳ này)  [gộp kỳ này = (7) − (7) kỳ trước]
 *  (16) Thanh toán kỳ này = (4b) + (14) + (15)
 *
 * Thuần: không DOM, không import app → chạy trong unit test Node.
 */

const R = (x) => Math.round(Number(x) || 0);
const N = (x) => Number(x) || 0;

/** Tham số tính của hợp đồng, có giá trị mặc định theo mẫu CERT. */
export function getIPCParams(contract = {}) {
    const has = (k) => contract[k] !== undefined && contract[k] !== null && contract[k] !== '';
    return {
        retentionPct: has('retention_percent') ? N(contract.retention_percent) : 10,
        retentionCapPct: N(contract.max_retention_percent),          // 0 = không giới hạn
        retentionBasis: contract.retention_basis || 'gross',          // 'gross' (7) | 'work_done' (5)
        advancePct: N(contract.advance_payment_percent),
        apRecoveryPct: N(contract.ap_recovery_percent),               // tỷ lệ thu hồi (vd 17.5)
        apRecoveryBasis: contract.ap_recovery_basis || 'work_done',   // 'work_done' (5) | 'gross' (7)
        vatPct: has('vat_percent') ? N(contract.vat_percent) : 8,
    };
}

/**
 * Quy đổi một IPC (mới hoặc kiểu cũ tính rời từng kỳ) về các số LŨY KẾ
 * của riêng kỳ đó, để làm "kỳ trước" cho IPC tiếp theo.
 */
function cumulativeOf(ipc, prevCum) {
    if (ipc && ipc.computed && ipc.engine_version >= 2) {
        const c = ipc.computed;
        return {
            workDone: c.workDoneToDate, variations: c.variationsToDate, gross: c.grossToDate,
            retention: c.retentionToDate, apRecovery: c.apRecoveryToDate,
            certifiedSum: prevCum.certifiedSum + c.thisPeriodExVat,
            penalties: c.penaltiesToDate, advance: c.advanceToDate,
        };
    }
    // IPC kiểu cũ (v1): số liệu là của riêng kỳ → cộng dồn
    const gross = N(ipc.gross_work_done || ipc.submitted_amount);
    const isAdvance = !!ipc.is_advance;
    return {
        workDone: prevCum.workDone + (isAdvance ? 0 : gross),
        variations: prevCum.variations,
        gross: prevCum.gross + (isAdvance ? 0 : gross),
        retention: prevCum.retention + N(ipc.retention_deduction),
        apRecovery: prevCum.apRecovery + N(ipc.ap_deduction),
        certifiedSum: prevCum.certifiedSum + (isAdvance ? 0 : N(ipc.sub_total !== undefined ? ipc.sub_total : gross)),
        penalties: prevCum.penalties,
        advance: prevCum.advance + (isAdvance ? N(ipc.advance_this_period || gross) : 0),
    };
}

const ZERO = { workDone: 0, variations: 0, gross: 0, retention: 0, apRecovery: 0, certifiedSum: 0, penalties: 0, advance: 0 };

/** Lũy kế sau cùng của danh sách IPC trước (đã sắp theo số đợt). */
export function previousCumulative(previousIPCs = []) {
    return previousIPCs.reduce((acc, ipc) => cumulativeOf(ipc, acc), { ...ZERO });
}

/** Tổng giá trị công việc đến nay từ các dòng Bill / mã ngân sách. */
export function sumLines(lines = []) {
    return R(lines.reduce((s, l) => s + N(l.to_date_amount), 0));
}

/**
 * Tính 16 dòng của một IPC gói xây dựng.
 * @param {object} p
 * @param {object} p.contract      hợp đồng (getContractValue đã chuẩn hóa → original_value)
 * @param {object} p.ipc           { lines, variations_to_date, advance_this_period,
 *                                   penalty_this_period, withhold_this_period, vat_pct }
 * @param {Array}  p.previousIPCs  các IPC trước của cùng hợp đồng, theo thứ tự đợt
 * @param {number} p.approvedVariations tổng VO đã duyệt của HĐ (dòng 2)
 */
export function computeIPC({ contract = {}, ipc = {}, previousIPCs = [], approvedVariations = 0 }) {
    const P = getIPCParams(contract);
    const prev = previousCumulative(previousIPCs);
    const contractSum = R(contract.original_value);

    // (4) Tạm ứng
    const advancePrev = prev.advance;
    const advanceThis = R(ipc.advance_this_period);
    const advanceToDate = advancePrev + advanceThis;

    // (5)(6)(7)
    const workDoneToDate = ipc.lines && ipc.lines.length ? sumLines(ipc.lines) : R(ipc.work_done_to_date);
    const variationsToDate = R(ipc.variations_to_date);
    const grossToDate = workDoneToDate + variationsToDate;

    // (8) Giữ lại đến nay
    const retBase = P.retentionBasis === 'work_done' ? workDoneToDate : grossToDate;
    let retentionToDate = R(retBase * P.retentionPct / 100);
    if (P.retentionCapPct > 0) retentionToDate = Math.min(retentionToDate, R(contractSum * P.retentionCapPct / 100));

    // (9) Hoàn trả tạm ứng đến nay — không vượt số tạm ứng đã nhận
    const apBase = P.apRecoveryBasis === 'gross' ? grossToDate : workDoneToDate;
    const apRecoveryToDate = Math.min(advanceToDate, R(apBase * P.apRecoveryPct / 100));

    // (10)(11)
    const certifiedToDate = grossToDate - retentionToDate - apRecoveryToDate;
    const previousCertified = prev.certifiedSum;

    // (12) phạt lũy kế, (13) tạm giữ kỳ này
    const penaltiesToDate = prev.penalties + R(ipc.penalty_this_period);
    const withhold = R(ipc.withhold_this_period);

    // (14)(15)(16)
    const thisPeriodExVat = R(certifiedToDate - previousCertified - penaltiesToDate - withhold);
    const grossThisPeriod = grossToDate - prev.gross;
    const vatPct = ipc.vat_pct !== undefined && ipc.vat_pct !== null && ipc.vat_pct !== '' ? N(ipc.vat_pct) : P.vatPct;
    const vat = R(grossThisPeriod * vatPct / 100);
    const paymentThisPeriod = advanceThis + thisPeriodExVat + vat;

    return {
        contractSum,                                          // (1)
        approvedVariations: R(approvedVariations),            // (2)
        adjustedContractSum: contractSum + R(approvedVariations), // (3)
        advancePrevious: advancePrev,                         // (4a)
        advanceThisPeriod: advanceThis,                       // (4b)
        advanceToDate,                                        // (4)
        workDoneToDate,                                       // (5)
        variationsToDate,                                     // (6)
        grossToDate,                                          // (7)
        retentionToDate,                                      // (8)
        apRecoveryToDate,                                     // (9)
        certifiedToDate,                                      // (10)
        previousCertified,                                    // (11)
        penaltiesToDate,                                      // (12)
        withhold,                                             // (13)
        thisPeriodExVat,                                      // (14)
        vatPct,
        vat,                                                  // (15)
        paymentThisPeriod,                                    // (16)
        // Số "kỳ này" để báo cáo / biểu đồ
        workDoneThisPeriod: workDoneToDate - prev.workDone,
        grossThisPeriod,
        retentionThisPeriod: retentionToDate - prev.retention,
        apRecoveryThisPeriod: apRecoveryToDate - prev.apRecovery,
        apOutstanding: advanceToDate - apRecoveryToDate,
        percentComplete: contractSum ? workDoneToDate / contractSum : 0,
    };
}

/** IPC gói tư vấn: (KL − khấu trừ) × (1 + VAT), làm tròn từng dòng. */
export function computeConsultancyIPC({ gross = 0, qsDeduction = 0, vatPct = 10 }) {
    const afterQS = R(gross) - R(qsDeduction);
    const vat = R(afterQS * N(vatPct) / 100);
    return { afterQS, vat, netPayable: afterQS + vat };
}

/**
 * Bảng "Summary of payment": mỗi IPC (đã tính) → số xác nhận trước thuế, VAT,
 * tổng, tạm ứng. Dùng cho màn hình tổng hợp và KPI.
 */
export function summarizeIPC(ipc) {
    if (ipc && ipc.computed && ipc.engine_version >= 2) {
        const c = ipc.computed;
        return {
            advance: c.advanceThisPeriod, certifiedExVat: c.thisPeriodExVat, vat: c.vat,
            payment: c.paymentThisPeriod, grossThisPeriod: c.grossThisPeriod,
        };
    }
    const sub = N(ipc.sub_total !== undefined ? ipc.sub_total : ipc.gross_work_done);
    const vat = N(ipc.vat_amount);
    const isAdv = !!ipc.is_advance;
    return {
        advance: isAdv ? N(ipc.advance_this_period || ipc.gross_work_done) : 0,
        certifiedExVat: isAdv ? 0 : sub,
        vat: isAdv ? 0 : vat,
        payment: N(ipc.net_payable) || sub + vat,
        grossThisPeriod: isAdv ? 0 : N(ipc.gross_work_done),
    };
}
