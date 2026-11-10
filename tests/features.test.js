import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FEATURES, featureOn, applyFeatureFlags } from '../js/config/features.js';

test('mặc định ẩn In/PDF, Xuất CERT, Báo cáo chi phí, Thành viên dự án', () => {
    assert.deepEqual(Object.entries(FEATURES).filter(([, v]) => v).map(([k]) => k), []);
    for (const k of Object.keys(FEATURES)) assert.equal(featureOn(k), false);
});
test('applyFeatureFlags ẩn đúng phần tử của tính năng đang tắt', () => {
    const els = {};
    const doc = { getElementById: (id) => (els[id] ||= { id, hidden: false, dataset: {}, classList: { add() {} } }) };
    applyFeatureFlags(doc);
    for (const id of ['btn-print-ipc', 'btn-xlsx-ipc', 'menu-cost-report', 'module-cost-report', 'members-card']) assert.equal(els[id].hidden, true, id);
});
