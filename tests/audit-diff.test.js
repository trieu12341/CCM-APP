import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffRecords, sameValue, compact } from '../js/data/audit-diff.js';

test('đổi giá trị HĐ: 1 thay đổi, đúng cũ → mới', () => {
    assert.deepEqual(diffRecords({ original_value: 1_500_000_000 }, { original_value: 1_450_000_000 }),
        [{ field: 'original_value', from: 1_500_000_000, to: 1_450_000_000 }]);
});

test('bỏ qua trường hệ thống và giá trị "trống" tương đương; "1500" = 1500', () => {
    const a = { _v: 1, updatedAt: new Date(1), updatedBy: 'x', note: null, amount: '1500', id: 'C1' };
    const b = { _v: 2, updatedAt: new Date(2), updatedBy: 'y', note: '', amount: 1500, id: 'C1' };
    assert.deepEqual(diffRecords(a, b), []);
});

test('thêm và bỏ trường', () => {
    assert.deepEqual(diffRecords({ a: 1 }, { b: 2 }), [{ field: 'a', from: 1, to: null }, { field: 'b', from: null, to: 2 }]);
});

test('dòng Bill so theo mã: chèn dòng mới ở giữa không làm các dòng khác bị coi là sửa', () => {
    const before = { lines: [{ code: '102-02', to_date_amount: 100 }, { code: '102-08', to_date_amount: 50 }] };
    const after = { lines: [{ code: '102-02', to_date_amount: 100 }, { code: '102-03', to_date_amount: 7 }, { code: '102-08', to_date_amount: 80 }] };
    assert.deepEqual(diffRecords(before, after), [
        { field: 'lines[102-03]', from: null, to: '{"code":"102-03","to_date_amount":7}' },
        { field: 'lines[102-08].to_date_amount', from: 50, to: 80 },
    ]);
});

test('dòng V.E trùng mã với dòng Bill được phân biệt nhờ mô tả', () => {
    const before = { lines: [{ code: '102-02', description: 'PILING', to_date_amount: 500 }, { code: '102-02', description: 'V.E – PILING', to_date_amount: -50 }] };
    const after = { lines: [{ code: '102-02', description: 'PILING', to_date_amount: 500 }, { code: '102-02', description: 'V.E – PILING', to_date_amount: -60 }] };
    assert.deepEqual(diffRecords(before, after), [{ field: 'lines[102-02 | V.E – PILING].to_date_amount', from: -50, to: -60 }]);
});

test('xóa dòng Bill', () => {
    assert.deepEqual(diffRecords({ lines: [{ code: 'A', x: 1 }] }, { lines: [] }), [{ field: 'lines[A]', from: '{"code":"A","x":1}', to: null }]);
});

test('ngày tháng so theo thời điểm; giá trị dài được rút gọn', () => {
    assert.equal(sameValue(new Date('2026-10-01'), { toMillis: () => Date.parse('2026-10-01') }), true);
    assert.equal(compact(new Date('2026-10-01T00:00:00Z')), '2026-10-01T00:00:00.000Z');
    assert.ok(compact('x'.repeat(1000)).length <= 301);
    assert.equal(typeof compact({ a: [1, 2] }), 'string');   // không ghi đối tượng lồng vào nhật ký
});
