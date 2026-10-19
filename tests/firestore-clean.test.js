import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanForFirestore } from '../js/utils/firestore-clean.js';

test('bỏ undefined, NaN → 0, giữ số/chuỗi/null/Date', () => {
    const d = new Date(0);
    const out = cleanForFirestore({ a: 1, b: undefined, c: NaN, d: 'x', e: null, f: d, g: () => 1, h: Infinity });
    assert.deepEqual(Object.keys(out).sort(), ['a', 'c', 'd', 'e', 'f', 'h']);
    assert.equal(out.c, 0); assert.equal(out.h, 0); assert.equal(out.f, d);
});

test('làm sạch lồng nhau trong mảng IPC (lỗi work_done_to_date: undefined)', () => {
    const out = cleanForFirestore([{ ipc_id: 'A', computed: { x: 1 } }, { ipc_id: 'B', work_done_to_date: undefined, lines: [{ code: '102-08', v: undefined }] }, undefined]);
    assert.equal('work_done_to_date' in out[1], false);
    assert.deepEqual(out[1].lines[0], { code: '102-08' });
    assert.equal(out[2], null);
});

test('giữ nguyên giá trị đặc biệt (không phải object thường) như serverTimestamp', () => {
    class Sentinel {} const s = new Sentinel();
    assert.equal(cleanForFirestore({ t: s }).t, s);
});
