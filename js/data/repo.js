/**
 * repo.js — Lớp dữ liệu mới (Giai đoạn 1): mỗi hồ sơ là MỘT bản ghi Firestore riêng
 *   projects/{pid}/{entity}/{id}
 * thay cho kiểu cũ "cả dự án một bản ghi chứa mọi mảng" (giới hạn 1 MB, ghi đè cả mảng).
 *
 * Chống ghi đè: mỗi bản ghi có _v (số phiên bản). save() gửi kèm _v đã đọc; nếu người khác
 * đã lưu trước (_v trên server khác) → ném ConflictError, KHÔNG ghi. Firestore rules (bước 1.4)
 * chặn thêm ở phía server: _v mới phải = _v cũ + 1.
 *
 * Nối vào app từng phần: IPC và VO từ bước 1.6 (js/core/v2-sync.js), các loại còn lại ở bước 1.7. Không phụ thuộc DOM hay biến toàn cục: nhận `db` (Firestore
 * compat) và `fieldValue` từ ngoài → test được bằng Node trên Firestore giả và Emulator thật.
 */
import { cleanForFirestore } from '../utils/firestore-clean.js';

export const ENTITIES = ['budgets', 'tenders', 'contracts', 'payments', 'variations', 'cashflows', 'finals'];
export const META = ['_v', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'updatedByName', 'deleted', 'deletedAt', 'deletedBy'];

export class ConflictError extends Error {
    constructor(message, current = null) {
        super(message);
        this.name = 'ConflictError';
        this.current = current;   // { _v, updatedBy, updatedAt } của bản trên server, null nếu không còn
    }
}

export const stripMeta = (rec) => Object.fromEntries(Object.entries(rec || {}).filter(([k]) => !META.includes(k) && k !== 'id'));
const metaOf = (d) => (d ? { _v: d._v, updatedBy: d.updatedBy, updatedAt: d.updatedAt } : null);

/**
 * @param {object} o
 * @param {object} o.db          firestore() compat
 * @param {object} o.fieldValue  firebase.firestore.FieldValue (cần serverTimestamp)
 * @param {object} o.user        { uid, name } người đang thao tác
 * @param {Function} [o.onWrite] (tx, info) => void — gọi TRONG transaction sau mỗi lần ghi;
 *                               bước 1.3 dùng để ghi nhật ký. info = { entity, pid, id, action, before, after, reason }
 */
export function createRepo({ db, fieldValue, user, onWrite = () => {} }) {
    if (!db || !fieldValue || !user?.uid) throw new Error('createRepo cần db, fieldValue và user.uid');
    const ts = () => fieldValue.serverTimestamp();
    const who = user.name || user.email || user.uid;   // tên hiện trong hộp thoại xung đột ("vừa được <tên> sửa")

    const col = (entity, pid) => {
        if (!ENTITIES.includes(entity)) throw new Error(`Loại hồ sơ không hợp lệ: ${entity}`);
        if (!pid) throw new Error('Thiếu mã dự án');
        return db.collection('projects').doc(pid).collection(entity);
    };
    const toRecord = (snap) => ({ id: snap.id, ...snap.data() });

    async function list(entity, pid, { includeDeleted = false } = {}) {
        const qs = await col(entity, pid).get();
        return qs.docs.map(toRecord).filter(r => includeDeleted || !r.deleted);
    }

    async function get(entity, pid, id) {
        const snap = await col(entity, pid).doc(id).get();
        return snap.exists ? toRecord(snap) : null;
    }

    /** Theo dõi realtime; cb nhận danh sách đã bỏ bản ghi trong thùng rác. Trả về hàm hủy. */
    function subscribe(entity, pid, cb, { includeDeleted = false } = {}) {
        return col(entity, pid).onSnapshot(qs => cb(qs.docs.map(toRecord).filter(r => includeDeleted || !r.deleted)));
    }

    /** Tạo mới. Có record.id thì dùng (giữ mã cũ khi chuyển dữ liệu); trùng mã → ConflictError. */
    async function create(entity, pid, record) {
        const ref = record.id ? col(entity, pid).doc(String(record.id)) : col(entity, pid).doc();
        return db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            if (snap.exists) throw new ConflictError(`Đã có ${entity}/${ref.id}`, metaOf(snap.data()));
            const data = { ...cleanForFirestore(stripMeta(record)), _v: 1, deleted: false,
                createdAt: ts(), createdBy: user.uid, updatedAt: ts(), updatedBy: user.uid, updatedByName: who };
            tx.set(ref, data);
            onWrite(tx, { entity, pid, id: ref.id, action: 'create', before: null, after: data });
            return { id: ref.id, _v: 1 };
        });
    }

    /** Lưu thay đổi. expectedV = _v lúc mở hồ sơ. Khác server → ConflictError, không ghi. */
    async function save(entity, pid, record, expectedV, { reason } = {}) {
        if (!record?.id) throw new Error('save() cần record.id');
        const ref = col(entity, pid).doc(String(record.id));
        return db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists) throw new ConflictError(`${entity}/${ref.id} không còn tồn tại`, null);
            const cur = snap.data();
            if (cur._v !== expectedV) throw new ConflictError(`${entity}/${ref.id} vừa được người khác lưu`, metaOf(cur));
            const data = { ...cleanForFirestore(stripMeta(record)), _v: expectedV + 1, deleted: !!cur.deleted,
                createdAt: cur.createdAt ?? null, createdBy: cur.createdBy ?? null, updatedAt: ts(), updatedBy: user.uid, updatedByName: who };
            tx.set(ref, data);
            onWrite(tx, { entity, pid, id: ref.id, action: 'update', before: cur, after: data, reason });
            return { id: ref.id, _v: data._v };
        });
    }

    async function setDeleted(entity, pid, id, expectedV, deleted, reason) {
        const ref = col(entity, pid).doc(String(id));
        return db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists) throw new ConflictError(`${entity}/${id} không còn tồn tại`, null);
            const cur = snap.data();
            if (cur._v !== expectedV) throw new ConflictError(`${entity}/${id} vừa được người khác lưu`, metaOf(cur));
            const patch = { _v: expectedV + 1, deleted, updatedAt: ts(), updatedBy: user.uid, updatedByName: who,
                deletedAt: deleted ? ts() : null, deletedBy: deleted ? user.uid : null };
            tx.update(ref, patch);
            onWrite(tx, { entity, pid, id, action: deleted ? 'delete' : 'restore', before: cur, after: { ...cur, ...patch }, reason });
            return { id, _v: patch._v };
        });
    }

    /**
     * Ghi NHIỀU hồ sơ trong MỘT giao dịch: hoặc tất cả cùng vào, hoặc không cái nào (vd tính lại chuỗi IPC).
     * ops: [{ entity, kind: 'create'|'save'|'delete', id, record?, expectedV? }]. Trả về [{ entity, id, kind, _v }].
     * Sai _v ở BẤT KỲ hồ sơ nào → ConflictError, không ghi gì. Mỗi hồ sơ có dòng nhật ký riêng (qua onWrite).
     */
    async function saveMany(pid, ops, { reason } = {}) {
        if (!ops.length) return [];
        if (ops.length > 200) throw new Error('Một lần lưu tối đa 200 hồ sơ');
        const refs = ops.map(o => col(o.entity, pid).doc(String(o.id)));
        return db.runTransaction(async (tx) => {
            const snaps = [];
            for (const r of refs) snaps.push(await tx.get(r));   // đọc hết trước khi ghi
            ops.forEach((o, i) => {
                const cur = snaps[i].exists ? snaps[i].data() : null;
                if (o.kind === 'create' && cur) throw new ConflictError(`Đã có ${o.entity}/${o.id}`, metaOf(cur));
                if (o.kind !== 'create' && !cur) throw new ConflictError(`${o.entity}/${o.id} không còn tồn tại`, null);
                if (o.kind !== 'create' && cur._v !== o.expectedV) throw new ConflictError(`${o.entity}/${o.id} vừa được người khác lưu`, metaOf(cur));
            });
            return ops.map((o, i) => {
                const cur = snaps[i].exists ? snaps[i].data() : null;
                const base = { entity: o.entity, pid, id: refs[i].id, reason };
                if (o.kind === 'create') {
                    const data = { ...cleanForFirestore(stripMeta(o.record)), _v: 1, deleted: false, createdAt: ts(), createdBy: user.uid, updatedAt: ts(), updatedBy: user.uid, updatedByName: who };
                    tx.set(refs[i], data); onWrite(tx, { ...base, action: 'create', before: null, after: data });
                    return { entity: o.entity, id: refs[i].id, kind: o.kind, _v: 1 };
                }
                if (o.kind === 'save') {
                    const data = { ...cleanForFirestore(stripMeta(o.record)), _v: o.expectedV + 1, deleted: !!cur.deleted,
                        createdAt: cur.createdAt ?? null, createdBy: cur.createdBy ?? null, updatedAt: ts(), updatedBy: user.uid, updatedByName: who };
                    tx.set(refs[i], data); onWrite(tx, { ...base, action: 'update', before: cur, after: data });
                    return { entity: o.entity, id: refs[i].id, kind: o.kind, _v: data._v };
                }
                const patch = { _v: o.expectedV + 1, deleted: true, updatedAt: ts(), updatedBy: user.uid, updatedByName: who, deletedAt: ts(), deletedBy: user.uid };
                tx.update(refs[i], patch); onWrite(tx, { ...base, action: 'delete', before: cur, after: { ...cur, ...patch } });
                return { entity: o.entity, id: refs[i].id, kind: o.kind, _v: patch._v };
            });
        });
    }

    /**
     * Ghi nhiều hồ sơ bằng BATCH (không đọc trước) — dùng được khi MẤT MẠNG: Firestore xếp hàng và tự gửi khi có mạng.
     * Chống ghi đè do rules chịu trách nhiệm (_v mới phải = _v cũ + 1): bản cũ bị server từ chối khi đồng bộ.
     * ops như saveMany, nhưng save/delete phải kèm `before` (bản đã đọc, để giữ createdAt/By và ghi nhật ký).
     * @returns {{ results, committed: Promise }} results áp dụng ngay trong máy; committed xong khi server nhận (hoặc từ chối).
     */
    function writeBatch(pid, ops, { reason } = {}) {
        if (ops.length > 200) throw new Error('Một lần lưu tối đa 200 hồ sơ');
        const batch = db.batch();
        const results = ops.map((o) => {
            const ref = col(o.entity, pid).doc(String(o.id));
            const base = { entity: o.entity, pid, id: ref.id, reason };
            if (o.kind === 'create') {
                const data = { ...cleanForFirestore(stripMeta(o.record)), _v: 1, deleted: false, createdAt: ts(), createdBy: user.uid, updatedAt: ts(), updatedBy: user.uid, updatedByName: who };
                batch.set(ref, data); onWrite(batch, { ...base, action: 'create', before: null, after: data });
                return { entity: o.entity, id: ref.id, kind: o.kind, _v: 1 };
            }
            const cur = o.before || {};
            if (o.kind === 'save') {
                const data = { ...cleanForFirestore(stripMeta(o.record)), _v: o.expectedV + 1, deleted: !!cur.deleted,
                    createdAt: cur.createdAt ?? null, createdBy: cur.createdBy ?? null, updatedAt: ts(), updatedBy: user.uid, updatedByName: who };
                batch.set(ref, data); onWrite(batch, { ...base, action: 'update', before: cur, after: data });
                return { entity: o.entity, id: ref.id, kind: o.kind, _v: data._v };
            }
            const patch = { _v: o.expectedV + 1, deleted: true, updatedAt: ts(), updatedBy: user.uid, updatedByName: who, deletedAt: ts(), deletedBy: user.uid };
            batch.update(ref, patch); onWrite(batch, { ...base, action: 'delete', before: cur, after: { ...cur, ...patch } });
            return { entity: o.entity, id: ref.id, kind: o.kind, _v: patch._v };
        });
        return { results, committed: ops.length ? batch.commit() : Promise.resolve() };
    }

    return {
        list, get, subscribe, create, save, saveMany, writeBatch,
        /** Xóa mềm: vào thùng rác, khôi phục được. Không xóa thật. */
        softDelete: (entity, pid, id, expectedV, { reason } = {}) => setDeleted(entity, pid, id, expectedV, true, reason),
        restore: (entity, pid, id, expectedV, { reason } = {}) => setDeleted(entity, pid, id, expectedV, false, reason),
    };
}
