// Thành viên & vai trò theo dự án (bước 2.1) — hàm thuần, không DOM.
// projects/{pid}.members = { uid: 'qs' | 'pm' | 'accountant' | 'viewer' }
// Dự án CHƯA có trường members chạy như cũ (theo vai trò toàn hệ thống) để không ai bị khóa ngoài khi chưa chuyển.
export const PROJECT_ROLES = ['qs', 'pm', 'accountant', 'viewer'];
export const ROLE_LABEL = { qs: 'QS (lập hồ sơ)', pm: 'PM (duyệt)', accountant: 'Kế toán', viewer: 'Người xem' };
// Giai đoạn 2.1: qs/pm/accountant ghi được (luồng duyệt ở 2.2 sẽ siết theo từng trạng thái); viewer chỉ xem.
export const WRITE_ROLES = ['qs', 'pm', 'accountant'];

export const hasMembers = (p) => !!p && p.members != null && typeof p.members === 'object';

/** Vai trò hiệu lực của người dùng trong dự án: 'admin' | vai trò dự án | null (không có quyền). */
export function effectiveRole(project, user) {
    if (!user || !['admin', 'user', 'manager'].includes(user.role)) return null;
    if (user.role === 'admin') return 'admin';
    if (!hasMembers(project)) return user.role === 'user' ? 'qs' : 'viewer';   // bản cũ: user → qs, manager → viewer
    return PROJECT_ROLES.includes(project.members[user.uid]) ? project.members[user.uid] : null;
}
export const canWrite = (project, user) => { const r = effectiveRole(project, user); return r === 'admin' || WRITE_ROLES.includes(r); };

/** Chỉ giữ dự án người này được thấy. */
export const visibleProjects = (projects, user) => (projects || []).filter(p => effectiveRole(p, user) !== null);

/** Kế hoạch gán thành viên cho dự án chưa có members: user → qs, manager → viewer (pending/admin bỏ qua). */
export function planBackfill(projects, users) {
    const map = {};
    for (const u of users) { if (u.role === 'user') map[u.uid] = 'qs'; else if (u.role === 'manager') map[u.uid] = 'viewer'; }
    return projects.filter(p => p && p.projectId && !hasMembers(p)).map(p => ({ pid: p.projectId, members: { ...map } }));
}

/** Đổi thành viên: trả về { members, change } hoặc ném lỗi tiếng Việt nếu vai trò sai. role = null → bớt người. */
export function setMember(members, uid, role) {
    if (!uid) throw new Error('Thiếu tài khoản');
    if (role !== null && !PROJECT_ROLES.includes(role)) throw new Error(`Vai trò không hợp lệ: ${role}`);
    const next = { ...(members || {}) };
    const before = next[uid] ?? null;
    if (role === null) delete next[uid]; else next[uid] = role;
    return { members: next, change: before === role ? null : { uid, from: before, to: role } };
}
