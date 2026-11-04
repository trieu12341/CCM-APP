import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effectiveRole, canWrite, visibleProjects, planBackfill, setMember } from '../js/data/members.js';

const P = { A: { projectId: 'A', members: { u1: 'qs', u2: 'viewer', u3: 'pm' } }, B: { projectId: 'B', members: { u9: 'qs' } }, L: { projectId: 'L' } };
const U = (uid, role) => ({ uid, role });

test('T2.01 chỉ thấy dự án mình là thành viên; admin thấy hết; dự án cũ chưa có members thấy theo vai trò cũ', () => {
    assert.deepEqual(visibleProjects(Object.values(P), U('u1', 'user')).map(p => p.projectId), ['A', 'L']);
    assert.deepEqual(visibleProjects(Object.values(P), U('x', 'admin')).map(p => p.projectId), ['A', 'B', 'L']);
    assert.deepEqual(visibleProjects(Object.values(P), U('u1', 'pending')), []);
});
test('vai trò hiệu lực và quyền ghi', () => {
    assert.equal(effectiveRole(P.A, U('u2', 'user')), 'viewer');
    assert.equal(canWrite(P.A, U('u2', 'user')), false);
    assert.equal(canWrite(P.A, U('u3', 'manager')), true);
    assert.equal(effectiveRole(P.L, U('m', 'manager')), 'viewer');
    assert.equal(effectiveRole(P.L, U('m', 'user')), 'qs');
});
test('chuyển vai trò cũ: user → qs, manager → viewer, bỏ qua admin/pending và dự án đã có members', () => {
    const plan = planBackfill(Object.values(P), [U('a', 'admin'), U('q', 'user'), U('m', 'manager'), U('p', 'pending')]);
    assert.deepEqual(plan, [{ pid: 'L', members: { q: 'qs', m: 'viewer' } }]);
});
test('setMember: thêm, đổi, bớt, không đổi; vai trò sai bị từ chối', () => {
    let r = setMember({}, 'u', 'qs'); assert.deepEqual(r.change, { uid: 'u', from: null, to: 'qs' });
    r = setMember(r.members, 'u', 'pm'); assert.deepEqual(r.change, { uid: 'u', from: 'qs', to: 'pm' });
    assert.equal(setMember(r.members, 'u', 'pm').change, null);
    r = setMember(r.members, 'u', null); assert.deepEqual(r.members, {}); assert.equal(r.change.to, null);
    assert.throws(() => setMember({}, 'u', 'boss'), /không hợp lệ/);
});
