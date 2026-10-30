/**
 * conflicts.js — Sau khi lưu bị từ chối: so thao tác của mình với bản mới nhất trên server → danh sách xung đột
 * để hộp thoại nêu "<tên> sửa lúc <giờ>" và trường nào khác nhau (thuần, test bằng Node).
 */
import { diffRecords } from './audit-diff.js';
import { LABEL } from './migrate-plan.js';

const timeOf = (v) => (v?.toDate ? v.toDate() : v instanceof Date ? v : v ? new Date(v) : null);

/**
 * @param {Array} ops    thao tác đã thử ghi ({entity, kind, id, expectedV, record})
 * @param {Array} fresh  hồ sơ hiện có trên server (kèm trong thùng rác nếu có), cùng một loại
 * @param {string} idKey tên trường mã nghiệp vụ
 */
export function findConflicts(ops, fresh, idKey) {
    const byId = new Map(fresh.map(r => [r.id, r]));
    const out = [];
    for (const o of ops) {
        const theirs = byId.get(o.id) || null;
        const clash = o.kind === 'create' ? !!theirs : !theirs || theirs._v !== o.expectedV;
        if (!clash) continue;
        out.push({
            entity: o.entity, id: o.id, kind: o.kind,
            label: `${LABEL[o.entity] || o.entity} ${o.record?.[idKey] ?? o.id}`,
            by: theirs?.updatedByName || theirs?.updatedBy || null,
            at: timeOf(theirs?.updatedAt),
            gone: !theirs,
            mine: o.record || null, theirs,
            changes: o.kind === 'delete' ? [] : diffRecords(theirs || {}, o.record || {}),   // from = bản trên server, to = bản của tôi
        });
    }
    return out;
}
