// Bước 2.7 (T2.13): trang in chứng chỉ IPC — dòng 16, số bằng chữ, ô ký, dấu BẢN NHÁP.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { computeIPC } from '../js/modules/payment/ipc-engine.js';
import { buildIPCPrintHtml } from '../js/modules/payment/ipc-print.js';

const contract = { contract_id: 'C1', contract_code: 'HĐ-01', package_name: 'Main Works', contractor_name: 'Nhà thầu A', original_value: 50_000_000_000 };
const c4 = computeIPC({ contract, ipc: { work_done_to_date: 10_000_000_000 }, previousIPCs: [] });
const row16 = (html) => html.match(/data-row="\(16\)">([^<]+)</)[1];

test('T2.13 IPC đã duyệt: dòng 16 = số engine, số bằng chữ khớp, có tên QS lập, KHÔNG có dấu BẢN NHÁP', () => {
    const html = buildIPCPrintHtml({ ipc: { computed: c4, submission_date: '2026-10-25' }, contract, project: { project_name: 'Dự án <A>' },
        draft: false, code: 'IPC-04', period: 'Đợt 4', signers: { qs: { name: 'QS An', date: '2026-10-25' } } });
    assert.equal(row16(html), new Intl.NumberFormat('vi-VN').format(c4.paymentThisPeriod));
    assert.match(html, /Bằng chữ: <b>[A-ZĐ][^<]+ đồng<\/b>/);
    assert.ok(html.includes('QS An')); assert.ok(html.includes('Ngày 25/10/2026'));
    assert.ok(!html.includes('data-draft'));
    assert.ok(html.includes('Dự án &lt;A&gt;'), 'tên dự án được thoát ký tự HTML');
    assert.match(html, /@page \{ size: A4 portrait/);
});
test('T2.13 IPC nháp in kèm dấu BẢN NHÁP; ô ký PM/CĐT để trống ngày', () => {
    const html = buildIPCPrintHtml({ ipc: { computed: c4 }, contract, draft: true, code: 'IPC-05' });
    assert.ok(html.includes('data-draft') && html.includes('BẢN NHÁP'));
    assert.equal((html.match(/Ngày \.\.\.\.\./g) || []).length, 3);
});
test('IPC chưa có số theo mẫu CERT (gói tư vấn / bản cũ) báo lỗi rõ ràng', () => {
    assert.throws(() => buildIPCPrintHtml({ ipc: {} }), /chưa in được/);
});

const GOLD = new URL('./fixtures/private/ipc-golden.json', import.meta.url);
test('T2.13 mẫu vàng: IPC4 in dòng 16 = 2.391.377.432 và bằng chữ đúng', { skip: existsSync(GOLD) ? false : 'chưa có file mẫu vàng (dữ liệu thật)' }, () => {
    const g = JSON.parse(readFileSync(GOLD, 'utf8'));
    const prev = [{ engine_version: 2, computed: computeIPC({ contract: g.contract, ipc: { advance_this_period: g.contract.advance } }) }];
    let toDate = 0, c;
    for (const p of g.periods) { toDate += p.grossThisPeriod; c = computeIPC({ contract: g.contract, ipc: { work_done_to_date: toDate }, previousIPCs: prev }); prev.push({ engine_version: 2, computed: c }); }
    const html = buildIPCPrintHtml({ ipc: { computed: c }, contract: g.contract, draft: false, code: 'IPC-04' });
    assert.equal(row16(html), '2.391.377.432');
    assert.ok(html.includes('Hai tỷ ba trăm chín mươi mốt triệu ba trăm bảy mươi bảy nghìn bốn trăm ba mươi hai đồng'));
});
