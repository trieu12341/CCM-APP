import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCell, buildSheet, fileName, safeName } from '../js/modules/export/table-rows.js';

test('parseCell: số kiểu Việt thành số thật, % tách riêng, chữ giữ nguyên', () => {
    assert.deepEqual(parseCell('1.234.567'), { v: 1234567 });
    assert.deepEqual(parseCell('-52.000.000 VNĐ'), { v: -52000000 });
    assert.deepEqual(parseCell('12,34%'), { v: 12.34, pct: true });
    assert.deepEqual(parseCell('VO-07'), { v: 'VO-07' });
    assert.deepEqual(parseCell('01/10/2026'), { v: '01/10/2026' });
    assert.deepEqual(parseCell(''), { v: '' });
});
test('T2.14 buildSheet: bỏ cột Hành động, cột tiền là số, dòng tổng bằng tổng cột, % không cộng', () => {
    const h = ['Mã VO', 'Giá trị Đệ trình (VNĐ)', 'Giá trị QS Duyệt (VNĐ)', 'Tỷ lệ', 'Hành động'];
    const r = [['VO-01', '100.000.000', '90.000.000', '10,00%', 'Sửa'], ['VO-02', '-52.000.000', '-52.000.000', '0,00%', 'Sửa']];
    const s = buildSheet(h, r);
    assert.deepEqual(s.header, ['Mã VO', 'Giá trị Đệ trình (VNĐ)', 'Giá trị QS Duyệt (VNĐ)', 'Tỷ lệ']);
    assert.deepEqual(s.body[0], ['VO-01', 100000000, 90000000, 10]);
    assert.deepEqual(s.total, ['Tổng cộng', 48000000, 38000000, '']);
    assert.deepEqual(s.pctCols, [3]);
});
test('bảng rỗng không có dòng tổng; tên file có tên dự án (bỏ dấu) + ngày', () => {
    assert.equal(buildSheet(['A', 'B'], []).total, null);
    assert.equal(safeName('Nobu Đà Nẵng'), 'Nobu-Da-Nang');
    assert.equal(fileName('Nobu Đà Nẵng', 'Phat sinh VO', new Date('2026-11-04T05:00:00Z')), 'Nobu-Da-Nang_Phat-sinh-VO_2026-11-04.xlsx');
});
