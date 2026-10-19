/**
 * ipc-fs-parser.js — Đọc sheet "FS" (Final Summary) của hồ sơ IPC Excel
 * thành các dòng Bill / mã ngân sách: mã, mô tả, giá trị HĐ, giá trị đến nay.
 *
 * Nhận dữ liệu dạng mảng 2 chiều (SheetJS sheet_to_json {header:1}) → thuần,
 * test được. Nhận diện cột theo tiêu đề, không cố định vị trí cột.
 *
 * Quy tắc lấy dòng: chỉ lấy dòng CÓ MÃ khoản mục và có giá trị HĐ là số.
 * Dòng tổng phụ không có mã (vd "GIÁ TRỊ V.E") bị bỏ qua để không cộng trùng.
 * Dừng ở dòng "TỔNG TRƯỚC THUẾ / TOTAL EXCLUDING VAT" và dùng dòng đó để đối chiếu.
 */

const norm = (v) => String(v ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function findHeader(rows) {
    for (let r = 0; r < Math.min(rows.length, 40); r++) {
        const row = rows[r] || [];
        const codeCol = row.findIndex(c => /mã khoản mục|^code$|cost code|\/ code/.test(norm(c)));
        const contractCol = row.findIndex(c => /giá trị hợp đồng|contract amount/.test(norm(c)));
        if (codeCol >= 0 && contractCol >= 0) {
            const descCol = row.findIndex(c => /description|mô tả|diễn giải/.test(norm(c)));
            const toDateHead = row.findIndex(c => /đến nay|to date/.test(norm(c)));
            return { r, codeCol, contractCol, descCol, toDateHead };
        }
    }
    return null;
}

function findToDateAmountCol(rows, h) {
    if (h.toDateHead < 0) return -1;
    const sub = rows[h.r + 1] || [];
    for (let c = h.toDateHead; c < Math.min(sub.length, h.toDateHead + 4); c++) {
        if (/amount|giá trị|thành tiền/.test(norm(sub[c]))) return c;
    }
    return h.toDateHead + 1; // mẫu thường: [% | Amount]
}

/**
 * @param {Array<Array>} rows mảng 2 chiều của sheet
 * @returns {{ lines, totals:{contract,toDate}, fileTotals:{contract,toDate}|null, ipcNo, warnings }}
 */
export function parseFSSheet(rows = []) {
    const warnings = [];
    const h = findHeader(rows);
    if (!h) return { lines: [], totals: { contract: 0, toDate: 0 }, fileTotals: null, ipcNo: null,
        warnings: ['Không tìm thấy dòng tiêu đề có "Mã khoản mục" và "Giá trị Hợp đồng".'] };
    const amtCol = findToDateAmountCol(rows, h);
    const descCol = h.descCol >= 0 ? h.descCol : h.codeCol + 1;

    // Số đợt IPC: ô số nằm cạnh tiêu đề "BẢNG TỔNG HỢP" ở phần đầu sheet
    let ipcNo = null;
    for (let r = 0; r < h.r && ipcNo === null; r++) {
        const row = rows[r] || [];
        if (row.some(c => /bảng tổng hợp|final summary/.test(norm(c)))) {
            const n = row.find(isNum); if (n !== undefined) ipcNo = n;
        }
    }

    const lines = [];
    let fileTotals = null;
    for (let r = h.r + 1; r < rows.length; r++) {
        const row = rows[r] || [];
        const text = row.map(norm).join(' ');
        if (/tổng trước thuế|total excluding vat/.test(text)) {
            fileTotals = { contract: isNum(row[h.contractCol]) ? Math.round(row[h.contractCol]) : null,
                toDate: isNum(row[amtCol]) ? Math.round(row[amtCol]) : null };
            break;
        }
        const code = String(row[h.codeCol] ?? '').trim();
        const contractAmt = row[h.contractCol];
        if (!code || !isNum(contractAmt)) continue;
        let description = String(row[descCol] ?? '').split('\n')[0].trim();
        // Dòng tiết kiệm kỹ thuật (giá trị âm) trùng tên với Bill → đánh dấu để không lẫn
        if (contractAmt < 0 && !/^v\.?e\b/i.test(description)) description = `V.E – ${description}`;
        lines.push({
            code,
            description,
            contract_amount: Math.round(contractAmt),
            to_date_amount: isNum(row[amtCol]) ? Math.round(row[amtCol]) : 0,
        });
    }

    const totals = {
        contract: lines.reduce((s, l) => s + l.contract_amount, 0),
        toDate: lines.reduce((s, l) => s + l.to_date_amount, 0),
    };
    if (!lines.length) warnings.push('Không đọc được dòng nào có mã khoản mục.');
    if (fileTotals) {
        // Chênh lệch nhỏ do làm tròn từng dòng (≤ số dòng đồng) được chấp nhận
        const tol = lines.length;
        if (fileTotals.contract !== null && Math.abs(fileTotals.contract - totals.contract) > tol)
            warnings.push(`Tổng giá trị HĐ các dòng (${totals.contract}) khác dòng tổng của file (${fileTotals.contract}).`);
        if (fileTotals.toDate !== null && Math.abs(fileTotals.toDate - totals.toDate) > tol)
            warnings.push(`Tổng giá trị đến nay các dòng (${totals.toDate}) khác dòng tổng của file (${fileTotals.toDate}).`);
    } else {
        warnings.push('Không thấy dòng "TỔNG TRƯỚC THUẾ" để đối chiếu.');
    }
    return { lines, totals, fileTotals, ipcNo, warnings };
}
