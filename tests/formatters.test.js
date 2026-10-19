import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, parseCurrencyInput } from '../js/utils/formatters.js';

test('escapeHtml thoát đủ 5 ký tự nguy hiểm', () => {
    assert.equal(escapeHtml('<img src=x onerror="alert(1)">'),
        '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    assert.equal(escapeHtml("Cọc & tường vây 'B2'"), 'Cọc &amp; tường vây &#39;B2&#39;');
});

test('escapeHtml với null/undefined/số', () => {
    assert.equal(escapeHtml(null), '');
    assert.equal(escapeHtml(undefined), '');
    assert.equal(escapeHtml(0), '0');
});

test('parseCurrencyInput đọc số kiểu VN', () => {
    assert.equal(parseCurrencyInput('1.234.567'), 1234567);
    assert.equal(parseCurrencyInput(2500), 2500);
    assert.equal(parseCurrencyInput(''), 0);
});
