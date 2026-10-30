/**
 * backup.js — Xuất / nhập TRỌN một dự án (bản ghi dự án + mọi hồ sơ con + nhật ký) ra JSON.
 * Dùng chung cho: nút Reset trong app (tự tải bản sao lưu trước khi xóa), scripts/backup.mjs (hằng ngày),
 * scripts/restore.mjs (khôi phục vào dự án MỚI). Chỉ cần API: collection().get(), doc().get()/set(), batch() — chạy được với
 * Firestore web (compat), firebase-admin và Firestore giả để test. Không ghi đè dự án đã có.
 */
import { ENTITIES } from './repo.js';
import { checksums } from './migrate-checks.js';
import { LEGACY_FIELD } from './migrate-plan.js';

export const BACKUP_VERSION = 1;
const SUBS = [...ENTITIES, 'audit'];

const isTs = (v) => v && typeof v === 'object' && typeof v.toDate === 'function';
/** Thời điểm → {__ts: ISO} để JSON giữ được; hàm này đi sâu vào đối tượng/mảng. */
export function encode(v) {
    if (isTs(v)) return { __ts: v.toDate().toISOString() };
    if (v instanceof Date) return { __ts: v.toISOString() };
    if (Array.isArray(v)) return v.map(encode);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, encode(x)]));
    return v;
}
export function decode(v) {
    if (Array.isArray(v)) return v.map(decode);
    if (v && typeof v === 'object') return typeof v.__ts === 'string' && Object.keys(v).length === 1 ? new Date(v.__ts) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, decode(x)]));
    return v;
}

export async function exportProject(db, pid) {
    const ref = db.collection('projects').doc(pid);
    const snap = await ref.get();
    if (!snap.exists) throw new Error(`Không có dự án ${pid}`);
    const collections = {};
    for (const name of SUBS) {
        const qs = await ref.collection(name).get();
        collections[name] = qs.docs.map(d => ({ id: d.id, data: encode(d.data()) }));
    }
    return { version: BACKUP_VERSION, projectId: pid, exportedAt: new Date().toISOString(), doc: encode(snap.data()), collections };
}

export async function exportAll(db) {
    const qs = await db.collection('projects').get();
    const projects = [];
    for (const d of qs.docs) projects.push(await exportProject(db, d.id));
    const users = (await db.collection('users').get()).docs.map(d => ({ id: d.id, data: encode(d.data()) }));
    return { version: BACKUP_VERSION, exportedAt: new Date().toISOString(), projects, users };
}

/** Đổi project_id cũ → mới trong mọi hồ sơ (nếu không, app lọc theo project_id sẽ không thấy dữ liệu). */
function reId(v, from, to) {
    if (Array.isArray(v)) return v.map(x => reId(x, from, to));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'project_id' && x === from ? to : reId(x, from, to)]));
    return v;
}

/** Tổng kiểm của một bản sao lưu (từ hồ sơ con nếu có, ngược lại từ mảng cũ) — để so bản gốc với bản đã khôi phục. */
export function backupChecksums(b) {
    const v2 = Number(b.doc?.schemaVersion) >= 2;
    const recs = {};
    for (const e of ENTITIES) {
        recs[e] = v2 ? b.collections[e].map(r => decode(r.data)) : (b.doc?.[LEGACY_FIELD[e]] || []);
    }
    return checksums(recs);
}

/**
 * Khôi phục vào dự án MỚI `newPid` (từ chối nếu mã đã tồn tại). Ghi theo lô ≤ 400.
 * @returns {{written:number}}
 */
export async function restoreProject(db, backup, newPid, { suffix = ' (khôi phục)' } = {}) {
    if (!backup || backup.version !== BACKUP_VERSION || !backup.doc) throw new Error('File sao lưu không hợp lệ');
    if (!newPid || newPid === backup.projectId) throw new Error('Phải khôi phục vào mã dự án MỚI, khác dự án gốc');
    const ref = db.collection('projects').doc(newPid);
    if ((await ref.get()).exists) throw new Error(`Dự án ${newPid} đã tồn tại — không ghi đè`);
    for (const name of SUBS) if ((await ref.collection(name).get()).docs.length) throw new Error(`Dự án ${newPid} đã có dữ liệu ${name} — không ghi đè`);

    const from = backup.projectId;
    const doc = decode(reId(backup.doc, from, newPid));
    doc.projectId = newPid;
    for (const k of ['projectName', 'project_name', 'name']) if (typeof doc[k] === 'string') doc[k] += suffix;
    const writes = [[ref, doc]];
    for (const name of SUBS) for (const r of backup.collections[name] || []) writes.push([ref.collection(name).doc(r.id), decode(reId(r.data, from, newPid))]);
    for (let i = 0; i < writes.length; i += 400) {
        const batch = db.batch();
        writes.slice(i, i + 400).forEach(([r, d]) => batch.set(r, d));
        await batch.commit();
    }
    return { written: writes.length };
}
