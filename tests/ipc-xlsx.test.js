// Bước 2.6 (T2.12): xuất chứng chỉ IPC vào file mẫu CERT. Đọc lại file đã xuất, so từng ô tiền với file Excel gốc.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
import { computeIPC } from '../js/modules/payment/ipc-engine.js';
import { fillIPCWorkbook, attRows } from '../js/modules/payment/ipc-xlsx.js';
import { CERT } from '../js/modules/payment/ipc-xlsx-map.js';
import { numberToEnglish } from '../js/utils/number-words-en.js';

const TEMPLATE = new URL('../templates/ipc-cert.xlsx', import.meta.url);
const GOLD = new URL('./fixtures/private/ipc-golden.json', import.meta.url);
const ORIG = new URL('./fixtures/private/ipc-main-works.xlsx', import.meta.url);
const skip = existsSync(GOLD) && existsSync(ORIG) ? false : 'chưa có file IPC gốc (dữ liệu thật, không đưa lên repo public)';

const load = async (src) => { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(src); return wb; };
const val = (cell) => { const v = cell.value; return v && typeof v === 'object' && 'result' in v ? v.result : v && typeof v === 'object' && 'formula' in v ? undefined : v; };
const num = (v) => (v === null || v === undefined || v === '' ? 0 : Math.round(Number(v)));
async function exportAndReload(data) { const wb = await load(readFileSync(TEMPLATE)); fillIPCWorkbook(wb, data); return load(await wb.xlsx.writeBuffer()); }

function goldenChain() {
    const g = JSON.parse(readFileSync(GOLD, 'utf8'));
    const contract = { contract_id: 'C1', package_name: 'Main Works', ...g.contract };
    const chain = [{ is_advance: true, engine_version: 2, computed: computeIPC({ contract, ipc: { advance_this_period: g.contract.advance } }), label: 'Advance Payment' }];
    let toDate = 0;
    g.periods.forEach((p, i) => {
        toDate += p.grossThisPeriod;
        chain.push({ payment_number: i + 1, engine_version: 2, label: `IPC-${i + 1}`, computed: computeIPC({ contract, ipc: { work_done_to_date: toDate }, previousIPCs: chain }) });
    });
    return { contract, chain };
}

test('T2.12 file mẫu sạch: chỉ 3 sheet CERT / Att#0 / FS, không còn số, công thức, tên dự án', async () => {
    const wb = await load(readFileSync(TEMPLATE));
    assert.deepEqual(wb.worksheets.map(w => w.name), ['CERT', 'Att#0', 'FS']);
    wb.eachSheet(ws => ws.eachRow(r => r.eachCell(c => {
        assert.ok(!(c.value && typeof c.value === 'object' && 'formula' in c.value), `${ws.name}!${c.address} còn công thức`);
        assert.ok(typeof c.value !== 'number', `${ws.name}!${c.address} còn số`);
        assert.ok(!/westique|iconic|turner|wealthcons/i.test(String(c.value ?? '')), `${ws.name}!${c.address} còn tên riêng`);
    })));
});

test('T2.12 IPC4 xuất ra: 16 dòng CERT khớp file gốc tới từng đồng (0 ô lệch), dòng 16 = 2.391.377.432, bằng chữ đúng', { skip }, async () => {
    const { contract, chain } = goldenChain();
    const out = await exportAndReload({ ipc: chain.at(-1), chain, contract, project: { project_name: 'Dự án thử' } });
    const orig = await load(readFileSync(ORIG));
    const lech = [];
    for (const [no, ref] of CERT.rows) {
        const a = num(val(out.getWorksheet('CERT').getCell(ref))), b = num(val(orig.getWorksheet('CERT').getCell(ref)));
        if (a !== b) lech.push(`${no} ${ref}: xuất ${a} ≠ gốc ${b}`);
    }
    assert.deepEqual(lech, []);
    assert.equal(val(out.getWorksheet('CERT').getCell('M48')), 2391377432);
    assert.equal(val(out.getWorksheet('CERT').getCell('B52')), 'Bằng chữ: Hai tỷ ba trăm chín mươi mốt triệu ba trăm bảy mươi bảy nghìn bốn trăm ba mươi hai đồng');
    assert.equal(val(out.getWorksheet('CERT').getCell('D2')), 4);
});

test('T2.12 Att#0: tạm ứng + IPC1–4 khớp file gốc (tiền giữ lại từng kỳ cho lệch làm tròn ≤ 1 đồng — phương án C)', { skip }, async () => {
    const { contract, chain } = goldenChain();
    const out = (await exportAndReload({ ipc: chain.at(-1), chain, contract })).getWorksheet('Att#0');
    const orig = (await load(readFileSync(ORIG))).getWorksheet('Att#0_IPC Record (Internal)');
    const lech = [];
    for (let r = 13; r <= 17; r++) for (const col of ['E', 'F', 'G', 'H', 'I', 'O', 'P']) {
        const a = num(val(out.getCell(col + r))), b = num(val(orig.getCell(col + r)));
        const tol = ['I', 'O', 'P'].includes(col) ? 1 : 0;
        if (Math.abs(a - b) > tol) lech.push(`${col}${r}: xuất ${a} ≠ gốc ${b}`);
    }
    assert.deepEqual(lech, []);
    for (const col of ['E', 'F', 'G', 'H']) assert.equal(num(val(out.getCell(col + 26))), num(val(orig.getCell(col + 26))), `tổng ${col}26`);
});

test('FS: dòng Bill, tổng trước thuế / VAT / gồm VAT; nhiều dòng hơn mẫu thì tự chèn dòng', async () => {
    const lines = Array.from({ length: 35 }, (_, i) => ({ code: `102-${i}`, description: `Hạng mục ${i}`, contract_amount: 1_000_000, previous_amount: 100_000, to_date_amount: 250_000 }));
    const c = computeIPC({ contract: { original_value: 35_000_000 }, ipc: { work_done_to_date: 35 * 250_000 }, previousIPCs: [] });
    const out = (await exportAndReload({ ipc: { payment_number: 2, computed: c }, chain: [{ computed: c, label: 'IPC-2' }], lines, contract: { package_name: 'Cọc' } })).getWorksheet('FS');
    assert.equal(val(out.getCell('C11')), '102-0');
    assert.equal(val(out.getCell('C45')), '102-34');
    assert.equal(val(out.getCell('E46')), 35_000_000);    // dòng tổng bị đẩy xuống 6 dòng (40 → 46)
    assert.equal(val(out.getCell('I46')), 35 * 150_000);
    assert.equal(val(out.getCell('K47')), Math.round(35 * 250_000 * 0.08));
    assert.equal(val(out.getCell('K48')), Math.round(35 * 250_000 * 1.08));
    assert.equal(val(out.getCell('J11')), 0.25);
});

test('Att#0 dòng tạm ứng chỉ có (a); dòng đợt có VAT, khấu trừ âm; chữ tiếng Anh', () => {
    const rows = attRows([{ is_advance: true, computed: { advanceThisPeriod: 500 } }, { label: 'IPC-1', computed: { grossThisPeriod: 1000, vat: 80, apRecoveryThisPeriod: 175, retentionThisPeriod: 100, penaltiesToDate: 0 } }]);
    assert.deepEqual(rows.map(r => [r.adv, r.gross, r.ap, r.ret, r.exVat, r.incVat]), [[500, 0, 0, 0, 500, 500], [0, 1000, -175, -100, 725, 805]]);
    assert.equal(numberToEnglish(2391377432), 'Two Billion, Three Hundred Ninety One Million, Three Hundred Seventy Seven Thousand, Four Hundred Thirty Two');
});
