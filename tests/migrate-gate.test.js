// Khóa "Chạy thật" và phần dựng HTML của trang Chuyển dữ liệu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runGate, ALLOW_PROD_MIGRATE } from '../js/data/migrate-gate.js';
import { countsHtml, issuesHtml, checksHtml, resultHtml } from '../js/modules/migrate/migrate-view.js';

const ok = { env: 'staging', isAdmin: true, dryRan: true, blocking: false, typed: 'P001', pid: 'P001' };

test('bản thật đang khóa mặc định (mở khóa ở bước 1.6–1.7)', () => {
    assert.equal(ALLOW_PROD_MIGRATE, false);
    assert.match(runGate({ ...ok, env: 'prod' }).reason, /Bản thật đang khóa/);
    assert.equal(runGate({ ...ok, env: 'prod', allowProd: true }).ok, true);
});

test('chỉ admin, phải chạy thử trước, không còn lỗi chặn, gõ đúng mã dự án', () => {
    assert.equal(runGate(ok).ok, true);
    assert.match(runGate({ ...ok, isAdmin: false }).reason, /admin/);
    assert.match(runGate({ ...ok, dryRan: false }).reason, /Chạy thử/);
    assert.match(runGate({ ...ok, blocking: true }).reason, /lỗi chặn/);
    assert.match(runGate({ ...ok, typed: 'p001' }).reason, /P001/);
    assert.equal(runGate({ ...ok, typed: ' P001 ' }).ok, true);
});

test('HTML: lỗi chặn đỏ, cảnh báo vàng, văn bản người dùng được thoát ký tự', () => {
    const html = issuesHtml([{ level: 'error', entity: 'contracts', message: 'trùng <b>C1</b>' }, { level: 'warn', entity: 'payments', message: 'x' }]);
    assert.match(html, /text-danger[^>]*><strong>LỖI CHẶN/); assert.match(html, /text-warning[^>]*><strong>Cảnh báo/);
    assert.ok(!html.includes('<b>C1</b>') && html.includes('&lt;b&gt;'));
    assert.match(issuesHtml([]), /Không có lỗi/);
});

test('HTML: bảng tổng kiểm hiện KHỚP/LỆCH, số kiểu 1.500.000.000; chưa có số mới thì hiện gạch', () => {
    const html = checksHtml([{ label: 'Σ HĐ', before: 1_500_000_000, after: 1_500_000_000, ok: true }, { label: 'Σ VO', before: 5, after: 4, ok: false }]);
    assert.match(html, /1\.500\.000\.000/); assert.match(html, /KHỚP/); assert.match(html, /LỆCH/);
    assert.ok(!checksHtml([{ label: 'a', before: 1, after: undefined, ok: false }]).includes('LỆCH'));
});

test('HTML: kết luận khác nhau khi đã đổi / chưa đổi schemaVersion; đếm bản ghi từng loại', () => {
    const verify = { missing: [], different: ['contracts/C1'], extra: [] };
    assert.match(resultHtml({ written: 3, skipped: 0, verify: { ...verify, different: [] }, flipped: true }), /Xong\./);
    const bad = resultHtml({ written: 3, skipped: 0, verify, flipped: false });
    assert.match(bad, /Chưa đổi schemaVersion/); assert.match(bad, /contracts\/C1/);
    const plan = { counts: { budgets: 2, tenders: 0, contracts: 3, payments: 0, variations: 0, cashflows: 0, finals: 0 } };
    assert.match(countsHtml(plan, { contracts: 1 }), /Hợp đồng<\/td><td[^>]*>3<\/td>\s*<td[^>]*>1</);
});
