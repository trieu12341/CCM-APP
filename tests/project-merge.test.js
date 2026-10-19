import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeProjectLists } from '../js/core/project-merge.js';

test('cloud thiếu tên (dữ liệu bản cũ) → giữ tên thật từ máy và yêu cầu vá lên cloud', () => {
    const cloud = [{ project_id: 'P1', project_name: 'P1', name: 'P1', location: '' }];
    const local = [{ project_id: 'P1', project_name: 'Dự án Alpha', location: 'TP.HCM', total_budget: 1000 }];
    const { merged, needsCloudSave } = mergeProjectLists(cloud, local);
    assert.equal(merged[0].project_name, 'Dự án Alpha');
    assert.equal(merged[0].name, 'Dự án Alpha');
    assert.equal(merged[0].location, 'TP.HCM');
    assert.equal(merged[0].total_budget, 1000);
    assert.equal(needsCloudSave, true);
});

test('cloud đã có tên đúng → ưu tiên cloud, không cần lưu lại', () => {
    const cloud = [{ project_id: 'P1', project_name: 'Tên mới', name: 'Tên mới', location: 'HN' }];
    const local = [{ project_id: 'P1', project_name: 'Tên cũ', location: 'HN' }];
    const { merged, needsCloudSave } = mergeProjectLists(cloud, local);
    assert.equal(merged[0].project_name, 'Tên mới');
    assert.equal(needsCloudSave, false);
});

test('dự án chỉ có ở máy này được giữ lại và đẩy lên cloud', () => {
    const { merged, needsCloudSave } = mergeProjectLists(
        [{ project_id: 'P1', project_name: 'A', name: 'A' }],
        [{ project_id: 'P2', project_name: 'B' }]);
    assert.deepEqual(merged.map(p => p.project_id), ['P1', 'P2']);
    assert.equal(merged[1].name, 'B');
    assert.equal(needsCloudSave, true);
});

test('không máy nào có tên → dùng mã dự án, không lỗi', () => {
    const { merged } = mergeProjectLists([{ project_id: 'P9' }], []);
    assert.equal(merged[0].project_name, 'P9');
});

import { mergeProjectField } from '../js/core/project-merge.js';

test('cloud chưa có trường (hồ sơ bản cũ) → giữ dữ liệu trong máy và đẩy lên cloud', () => {
    const local = [{ id: 'FS-1', project_id: 'P1' }, { id: 'FS-9', project_id: 'P2' }];
    const { merged, pushLocal } = mergeProjectField(local, undefined, 'P1');
    assert.equal(merged.length, 2);
    assert.deepEqual(pushLocal.map(x => x.id), ['FS-1']);
});

test('cloud có mảng (kể cả rỗng) → thay phần của dự án, giữ dự án khác', () => {
    const local = [{ id: 'a', project_id: 'P1' }, { id: 'b', project_id: 'P2' }];
    assert.deepEqual(mergeProjectField(local, [], 'P1').merged.map(x => x.id), ['b']);
    assert.deepEqual(mergeProjectField(local, [{ id: 'c', project_id: 'P1' }], 'P1').merged.map(x => x.id), ['b', 'c']);
    assert.equal(mergeProjectField(local, [], 'P1').pushLocal, null);
});

import { backfillProjectIds, nextVOId, unionByKey } from '../js/core/project-merge.js';
test('VO bản cũ thiếu project_id → bổ sung theo hợp đồng', () => {
    const { items, fixed } = backfillProjectIds(
        [{ vo_id: 'VO-01', contract_id: 'C1' }, { vo_id: 'VO-02', contract_id: 'C9', project_id: 'P2' }, { vo_id: 'VO-03', contract_id: 'CX' }],
        [{ contract_id: 'C1', project_id: 'P1' }]);
    assert.equal(fixed, 1);
    assert.equal(items[0].project_id, 'P1');
    assert.equal(items[1].project_id, 'P2');
    assert.equal(items[2].project_id, undefined);
});
test('mã VO không trùng kể cả sau khi xóa', () => {
    assert.equal(nextVOId([]), 'VO-01');
    assert.equal(nextVOId([{ vo_id: 'VO-01' }, { vo_id: 'VO-07' }]), 'VO-08');
});
test('gộp theo khóa: bản trong máy thắng, giữ bản cloud của máy khác', () => {
    const r = unionByKey([{ vo_id: 'A', v: 1 }, { vo_id: 'B', v: 1 }], [{ vo_id: 'A', v: 2 }, { vo_id: 'C', v: 2 }]);
    assert.deepEqual(r.map(x => x.vo_id + x.v), ['A2', 'B1', 'C2']);
});
