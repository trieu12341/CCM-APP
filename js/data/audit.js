/**
 * audit.js — Ghi nhật ký thay đổi vào projects/{pid}/audit/{autoId}, CÙNG transaction với
 * lần ghi hồ sơ (ghi được hồ sơ thì chắc chắn có nhật ký, và ngược lại).
 * Firestore rules (bước 1.4): nhật ký chỉ được THÊM, không ai sửa hay xóa.
 *
 * Dùng: createRepo({ db, fieldValue, user, onWrite: createAuditWriter({ db, fieldValue, user }) })
 */
import { diffRecords } from './audit-diff.js';

/**
 * @returns {(tx, info) => void}  info = { entity, pid, id, action, before, after, reason }
 */
export function createAuditWriter({ db, fieldValue, user }) {
    return (tx, { entity, pid, id, action, before, after, reason }) => {
        const changes = action === 'update' ? diffRecords(before, after) : [];
        // Lưu lại mà không đổi gì và không có lý do → không cần dòng nhật ký
        if (action === 'update' && !changes.length && !reason) return;
        const ref = db.collection('projects').doc(pid).collection('audit').doc();
        tx.set(ref, {
            at: fieldValue.serverTimestamp(),
            uid: user.uid,
            name: user.name || user.email || user.uid,
            entity, entityId: String(id), action,
            changes,
            reason: reason || null,
        });
    };
}

/** Nhật ký của một hồ sơ, mới nhất trước (dùng cho panel "Lịch sử" ở bước giao diện). */
export async function listAudit(db, pid, { entity, entityId } = {}) {
    const qs = await db.collection('projects').doc(pid).collection('audit').get();
    const time = (v) => (v?.toMillis ? v.toMillis() : v instanceof Date ? v.getTime() : 0);
    return qs.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(e => (!entity || e.entity === entity) && (!entityId || e.entityId === String(entityId)))
        .sort((a, b) => time(b.at) - time(a.at));
}
