import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFSSheet } from '../js/modules/payment/ipc-fs-parser.js';

// Mô phỏng cấu trúc sheet FS (số giả lập)
const rows = [
    [null, 'DỰ ÁN DEMO'],
    [null, 'BẢNG TỔNG HỢP', null, null, null, null, null, null, 3],
    [],
    [null, 'ITEM\nMỤC', 'Mã khoản mục / Code', 'DESCRIPTION \nMÔ TẢ', 'Giá trị Hợp đồng\nContract Amount', 'Kỳ trước\nPrevious', null, 'Kỳ này\nThis Period', null, 'Đến nay\nTo Date'],
    [null, null, null, null, null, '%', 'Amount [VND]', '%', 'Amount [VND]', '%', 'Amount [VND]'],
    [null, 'BILL 1', '102-08', 'PRELIMINARIES', 1000.4, 0.2, 200, 0.1, 100, 0.3, 300],
    [null, 'BIỂU SỐ 1', null, 'CÁC ĐIỀU KIỆN CHUNG'],
    [null, 'BILL 2', '102-02', 'PILING', 500, 1, 500, 0, 0, 1, 500],
    [null, 'BILL 7', null, 'PRIME COST SUMS'],
    [null, null, null, 'GIÁ TRỊ V.E / V.E AMOUNT', -150, null, -50, null, -10, null, -60],
    [null, null, '102-02', 'PILING', -100, null, -50, null, 0, null, -50],
    [null, null, '102-08', 'CONTRACT CONDITION', -50, null, 0, null, -10, null, -10],
    [null, null, null, 'TỔNG TRƯỚC THUẾ / TOTAL EXCLUDING VAT', 1350, null, 650, null, 90, null, 740],
    [null, null, null, 'Cộng thuế GTGT / Add VAT 8%', 108],
];

test('đọc đúng các dòng có mã, bỏ dòng tổng phụ V.E, dừng ở TỔNG TRƯỚC THUẾ', () => {
    const r = parseFSSheet(rows);
    assert.equal(r.lines.length, 4);
    assert.deepEqual(r.lines[0], { code: '102-08', description: 'PRELIMINARIES', contract_amount: 1000, to_date_amount: 300 });
    assert.equal(r.lines[2].description, 'V.E – PILING');
    assert.deepEqual(r.totals, { contract: 1350, toDate: 740 });
    assert.deepEqual(r.fileTotals, { contract: 1350, toDate: 740 });
    assert.equal(r.ipcNo, 3);
    assert.deepEqual(r.warnings, []);
});

test('cảnh báo khi tổng các dòng lệch dòng tổng của file', () => {
    const bad = rows.map(r => r.slice());
    bad[12][10] = 999;
    const r = parseFSSheet(bad);
    assert.equal(r.warnings.length, 1);
    assert.match(r.warnings[0], /đến nay/);
});

test('báo lỗi khi không phải sheet FS', () => {
    const r = parseFSSheet([['abc'], ['def']]);
    assert.equal(r.lines.length, 0);
    assert.match(r.warnings[0], /Không tìm thấy/);
});
