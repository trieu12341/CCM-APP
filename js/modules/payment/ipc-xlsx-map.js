// Ô cần điền trong templates/ipc-cert.xlsx (sinh bởi tests/fixtures/make-ipc-template.py — giữ đồng bộ).
export const CERT = {
    no: 'D2', project: 'H5', package: 'H6', employer: 'H8', qs: 'H9', contractor: 'H10',
    commencement: 'H12', completion: 'H13', submission: 'H24', valuation: 'H25',
    retentionLabel: 'J34', vatLabel: 'C45', wordsVi: 'B52', wordsEn: 'B53',
    // dòng CERT → ô cột M ↔ trường engine
    rows: [
        ['(1)', 'M15', 'contractSum'], ['(2)', 'M16', 'approvedVariations'], ['(3)', 'M17', 'adjustedContractSum'],
        ['(4)', 'M27', 'advanceToDate'], ['(4a)', 'M28', 'advancePrevious'], ['(4b)', 'M29', 'advanceThisPeriod'],
        ['(5)', 'M30', 'workDoneToDate'], ['(6)', 'M31', 'variationsToDate'], ['(7)', 'M32', 'grossToDate'],
        ['(8)', 'M34', 'retentionToDate'], ['(9)', 'M35', 'apRecoveryToDate'], ['(10)', 'M36', 'certifiedToDate'],
        ['(11)', 'M40', 'previousCertified'], ['(12)', 'M41', 'penaltiesToDate'], ['(13)', 'M42', 'withhold'],
        ['(14)', 'M44', 'thisPeriodExVat'], ['(15)', 'M45', 'vat'], ['(16)', 'M48', 'paymentThisPeriod'],
    ],
};
// Att#0: một dòng cho tạm ứng + mỗi đợt, từ dòng 13; dòng tổng ngay sau dòng cuối của vùng (mặc định 26)
export const ATT = { packageEn: 'B4', packageVi: 'B5', vatLabel: 'G12', first: 13, last: 25, cols: { no: 'B', label: 'C', date: 'D', adv: 'E', gross: 'F', vat: 'G', ap: 'H', ret: 'I', other: 'J', exVat: 'O', incVat: 'P' } };
// FS: dòng Bill từ dòng 11 tới 39; dòng 40/41/42 = tổng trước thuế / VAT / gồm VAT
export const FS = { package: 'B2', no: 'I4', vatLabel: 'D41', first: 11, last: 39, cols: { item: 'B', code: 'C', desc: 'D', contract: 'E', prevPct: 'F', prev: 'G', thisPct: 'H', this: 'I', toDatePct: 'J', toDate: 'K' } };
