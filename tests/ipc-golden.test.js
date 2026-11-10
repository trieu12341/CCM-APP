/**
 * IPC MẪU VÀNG — engine phải khớp file IPC Excel thật tới từng đồng, cả chuỗi đợt.
 * Số liệu thật nằm ở tests/fixtures/private/ipc-golden.json (bị .gitignore vì repo public),
 * sinh bằng: python3 tests/fixtures/extract-golden.py <file IPC .xlsx>
 * Không có file → test tự BỎ QUA (CI trên repo public); có file → bắt buộc khớp.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { computeIPC } from '../js/modules/payment/ipc-engine.js';

const FILE = new URL('./fixtures/private/ipc-golden.json', import.meta.url);
const has = existsSync(FILE);
const g = has ? JSON.parse(readFileSync(FILE, 'utf8')) : null;
const skip = has ? false : 'chưa có tests/fixtures/private/ipc-golden.json (dữ liệu thật, không đưa lên repo public)';

function runChain() {
    const contract = { ...g.contract };
    const prev = [{ engine_version: 2, computed: computeIPC({ contract, ipc: { advance_this_period: g.contract.advance } }) }];
    let toDate = 0;
    return g.periods.map(p => {
        toDate += p.grossThisPeriod;
        const c = computeIPC({ contract, ipc: { work_done_to_date: toDate }, previousIPCs: prev });
        prev.push({ engine_version: 2, computed: c });
        return { p, c };
    });
}

// Att#0 làm tròn tiền giữ lại THEO TỪNG KỲ, còn CERT (và engine) làm tròn trên LŨY KẾ (phương án C đã duyệt).
// Vì vậy từng kỳ có thể lệch đúng 1 đồng so với Att#0 (đã gặp ở IPC-2: 221.524.540 vs 221.524.539),
// nhưng lũy kế luôn khớp CERT tới đồng (test bên dưới). Lệch > 1 đồng = lỗi thật.
test('IPC mẫu vàng: (14) và (16) từng đợt khớp sheet Att#0 (cho phép lệch làm tròn 1 đồng)', { skip }, () => {
    for (const { p, c } of runChain()) {
        assert.ok(Math.abs(c.thisPeriodExVat - p.thisPeriodExVat) <= 1, `${p.name} dòng (14): ${c.thisPeriodExVat} vs ${p.thisPeriodExVat}`);
        assert.ok(Math.abs(c.paymentThisPeriod - p.paymentThisPeriod) <= 1, `${p.name} dòng (16): ${c.paymentThisPeriod} vs ${p.paymentThisPeriod}`);
    }
});

test('IPC mẫu vàng: 16 dòng CERT của đợt cuối khớp sheet CERT', { skip }, () => {
    const c = runChain().at(-1).c;
    const k = g.lastCert;
    const pairs = [['(1)', c.contractSum], ['(4)', c.advanceToDate], ['(4b)', c.advanceThisPeriod],
        ['(5)', c.workDoneToDate], ['(7)', c.grossToDate], ['(8)', c.retentionToDate], ['(9)', c.apRecoveryToDate],
        ['(10)', c.certifiedToDate], ['(11)', c.previousCertified], ['(14)', c.thisPeriodExVat], ['(15)', c.vat],
        ['(16)', c.paymentThisPeriod]];
    for (const [line, got] of pairs) {
        if (k[line] === undefined) continue;
        assert.equal(got, k[line], `CERT dòng ${line}`);
    }
});
