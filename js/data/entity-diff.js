/**
 * entity-diff.js — So mảng hồ sơ mà app đang giữ (state) với bản gốc đã đọc từ Firestore
 * → danh sách thao tác tối thiểu cho repo.saveMany (thuần, test được bằng Node).
 *
 *  - Hồ sơ mới (chưa có trong bản gốc)  → create (id = mã nghiệp vụ, vd ipc_id, đã làm an toàn)
 *  - Hồ sơ đổi nội dung                 → save, kèm _v của bản gốc (KHÔNG tin _v nằm trong state)
 *  - Hồ sơ biến mất khỏi mảng           → delete mềm (vào thùng rác, khôi phục được)
 *  - Hồ sơ không đổi                    → không ghi gì (tính lại chuỗi IPC chỉ ghi IPC thực sự đổi)
 */
import { stripMeta } from './repo.js';
import { stable, safeId } from './migrate-plan.js';
import { cleanForFirestore } from '../utils/firestore-clean.js';

const body = (r) => stable(cleanForFirestore(stripMeta(r)));

/** @param {string} entity @param {string} idKey tên trường mã nghiệp vụ (ipc_id, vo_id…) */
export function planOps(entity, idKey, baseline = [], next = []) {
    const base = new Map(baseline.map(r => [String(r[idKey]), r]));
    const seen = new Set(), ops = [], skipped = [];
    for (const item of next) {
        if (!item || item[idKey] === undefined || item[idKey] === null || item[idKey] === '') { skipped.push(item); continue; }
        const key = String(item[idKey]);
        if (seen.has(key)) continue;   // trùng mã trong mảng: giữ bản đầu, tránh ghi hai lần cùng hồ sơ
        seen.add(key);
        const cur = base.get(key);
        if (!cur) ops.push({ entity, kind: 'create', id: safeId(key), record: item });
        else if (body(item) !== body(cur)) ops.push({ entity, kind: 'save', id: cur.id, expectedV: cur._v, record: item, before: cur });
    }
    for (const [key, cur] of base) if (!seen.has(key)) ops.push({ entity, kind: 'delete', id: cur.id, expectedV: cur._v, before: cur });
    return { ops, skipped };
}

/** Cập nhật bản gốc trong máy sau khi ghi thành công (để lần lưu kế tiếp dùng đúng _v mới). */
export function applyResult(entity, idKey, baseline, ops, results) {
    const m = new Map(baseline.map(r => [r.id, r]));
    ops.forEach((o, i) => {
        if (o.kind === 'delete') m.delete(o.id);
        else m.set(o.id, { ...stripMeta(o.record), [idKey]: o.record[idKey], id: o.id, _v: results[i]._v });
    });
    return [...m.values()];
}
