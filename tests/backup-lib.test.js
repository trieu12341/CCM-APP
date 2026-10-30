// backup.js: mã hóa/giải mã thời điểm, từ chối khôi phục ghi đè.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encode, decode, restoreProject } from '../js/data/backup.js';

test('thời điểm đi qua JSON mà không mất: Date/Timestamp → {__ts} → Date, kể cả lồng trong mảng', () => {
    const d = new Date('2026-10-30T01:02:03.000Z');
    const back = decode(JSON.parse(JSON.stringify(encode({ a: d, b: [{ t: { toDate: () => d } }], n: 5, s: 'x' }))));
    assert.equal(back.a.getTime(), d.getTime()); assert.equal(back.b[0].t.getTime(), d.getTime()); assert.equal(back.n, 5);
});

test('khôi phục từ chối file sai, mã trùng dự án gốc', async () => {
    await assert.rejects(restoreProject({}, { version: 9 }, 'X'), /không hợp lệ/);
    await assert.rejects(restoreProject({}, { version: 1, projectId: 'P1', doc: {} }, 'P1'), /MỚI/);
});
