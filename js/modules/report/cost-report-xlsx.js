// Xuất báo cáo chi phí ra Excel theo bố cục cost report của phòng QS (bước 3.3). Nhận workbook ExcelJS — không DOM, test được bằng Node.
import { COLS } from './cost-report.js';

const MONEY = '_(* #,##0_);[Red]_(* (#,##0);_(* "-"_);_(@_)';
const HEAD = [['No.', ''], ['Cost code', 'Mã'], ['Scope of works', 'Hạng mục'], ['Budget', 'Ngân sách'], ['Award', 'Giá trị HĐ'],
    ['Approved VO', 'VO đã duyệt'], ['Submitted VO', 'VO chờ duyệt'], ['Total committed', 'Tổng cam kết'], ['Non-committed', 'Chưa cam kết'],
    ['Anticipated Amount to completion', 'Dự kiến đến khi xong'], ['Certified payment', 'Đã thanh toán'], ['Remaining', 'Còn phải trả'],
    ['Balance to Budget', 'Chênh lệch ngân sách']];
const NOTE = ['(1)', '', '(2)', '(3)', '(4)', '(5)', '(6)', '(7) = (4+5)', '(8)', '(9) = (6+7+8)', '(10)', '(11) = (7-10)', '(12) = (3-9)'];
const LETTER = (i) => String.fromCharCode(65 + i);
const thin = { style: 'thin' };
const box = { top: thin, left: thin, bottom: thin, right: thin };

/** @returns số dòng dữ liệu đã ghi (để test). */
export function writeCostReport(wb, report, { projectName = '', asOf = '' } = {}) {
    const ws = wb.addWorksheet('Report', { views: [{ state: 'frozen', ySplit: 6, xSplit: 3 }], pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    ws.columns = [{ width: 6 }, { width: 11 }, { width: 38 }, ...COLS.map(() => ({ width: 17 }))];
    ws.getCell('A1').value = projectName.toUpperCase(); ws.getCell('A1').font = { bold: true, size: 13 };
    ws.getCell('A2').value = 'MONTHLY COST REPORT — BÁO CÁO CHI PHÍ'; ws.getCell('A2').font = { bold: true };
    ws.getCell('D2').value = asOf ? `Ngày báo cáo: ${asOf.split('-').reverse().join('/')}` : '';
    ws.getRow(4).values = HEAD.map(h => h[0]); ws.getRow(5).values = HEAD.map(h => h[1]); ws.getRow(6).values = NOTE;
    for (const r of [4, 5, 6]) ws.getRow(r).eachCell({ includeEmpty: true }, (c) => {
        c.font = { bold: r === 4, italic: r === 6, size: r === 4 ? 10 : 9 }; c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; c.border = box;
    });
    ws.getRow(4).height = 30;
    let y = 7, n = 0, written = 0;
    const put = (vals, { bold = false, fill = null } = {}) => {
        const row = ws.getRow(y++); row.values = vals;
        for (let c = 1; c <= HEAD.length; c++) {
            const cell = row.getCell(c); cell.border = box;
            if (c > 3) cell.numFmt = MONEY;
            if (bold) cell.font = { bold: true };
            if (fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
        }
        return row;
    };
    report.groups.forEach((g, gi) => {
        put([LETTER(gi), '', g.label.toUpperCase(), ...COLS.map(k => g.total[k])], { bold: true, fill: 'FFF2F2F2' });
        for (const r of g.rows) { put([++n, r.code, r.name + (r.contractor ? ` — ${r.contractor}` : ''), ...COLS.map(k => r[k])]); written++; }
    });
    put(['', '', 'TOTAL (EXCL. VAT) — TỔNG TRƯỚC THUẾ', ...COLS.map(k => report.total[k])], { bold: true, fill: 'FFE2E8F0' });
    if (report.warnings.length) {
        y++; ws.getCell(`C${y++}`).value = 'Cảnh báo:';
        report.warnings.forEach(w => { ws.getCell(`C${y++}`).value = `• ${w}`; });
    }
    return written;
}
