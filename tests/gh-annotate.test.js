// Reporter chú thích GitHub: chỉ test đỏ mới sinh dòng ::error::, ký tự đặc biệt được thoát.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toAnnotation, toSummary } from './support/gh-annotate.mjs';

test('test đạt hoặc sự kiện khác → không có dòng nào', () => {
    assert.equal(toAnnotation({ type: 'test:pass', data: { name: 'a' } }), '');
    assert.equal(toAnnotation(undefined), '');
});

test('test đỏ → ::error có file, tên test và thông báo; xuống dòng/dấu phẩy/hai chấm được thoát', () => {
    const out = toAnnotation({ type: 'test:fail', data: {
        name: 'T1.08: không sửa, được nhật ký', file: '/work/repo/tests/rules/audit.test.js',
        details: { error: { message: 'dòng 1\ndòng 2 100%' } } } });
    assert.equal(out, '::error file=tests/rules/audit.test.js,title=T1.08%3A không sửa%2C được nhật ký::dòng 1%0Adòng 2 100%25\n');
});

test('tổng kết nêu rõ số đạt / đỏ / bỏ qua', () => {
    assert.equal(toSummary({ pass: 21, fail: 0, skip: 0 }), '::notice title=Tổng kết test::đạt 21 · đỏ 0 · bỏ qua 0\n');
});
