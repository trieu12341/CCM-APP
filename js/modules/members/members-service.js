// Ghi thành viên dự án (chỉ admin; rules chặn người khác) + một dòng nhật ký cùng lô.
import { db } from '../../firebase-config.js';
import { setMember } from '../../data/members.js';

export async function loadMembers(pid) {
    const d = await db.collection('projects').doc(pid).get();
    const m = d.exists ? d.data().members : null;
    return m && typeof m === 'object' ? m : null;   // null = dự án chưa bật phân quyền theo dự án
}

/** role = null → bớt người. Trả về members mới. */
export async function changeMember(pid, uid, role, actor) {
    const cur = (await loadMembers(pid)) || {};
    const { members, change } = setMember(cur, uid, role);
    if (!change) return cur;
    const FV = firebase.firestore.FieldValue;
    const batch = db.batch();
    batch.set(db.collection('projects').doc(pid), { members }, { merge: true });
    batch.set(db.collection('projects').doc(pid).collection('audit').doc(), {
        at: FV.serverTimestamp(), uid: actor.uid, name: actor.name || actor.email || actor.uid,
        entity: 'project', entityId: uid, action: 'members',
        changes: [{ field: 'members.' + uid, from: change.from, to: change.to }], reason: null,
    });
    await batch.commit();
    return members;
}

/** Bật phân quyền theo dự án cho dự án chưa có members: user → qs, manager → viewer. */
export async function enableMembers(pid, users, actor) {
    const { planBackfill } = await import('../../data/members.js');
    const plan = planBackfill([{ projectId: pid }], users)[0];
    if (!plan) return null;
    const FV = firebase.firestore.FieldValue;
    const batch = db.batch();
    batch.set(db.collection('projects').doc(pid), { members: plan.members }, { merge: true });
    batch.set(db.collection('projects').doc(pid).collection('audit').doc(), {
        at: FV.serverTimestamp(), uid: actor.uid, name: actor.name || actor.email || actor.uid,
        entity: 'project', entityId: pid, action: 'members',
        changes: [{ field: 'members', from: null, to: plan.members }], reason: 'Bật phân quyền theo dự án',
    });
    await batch.commit();
    return plan.members;
}
