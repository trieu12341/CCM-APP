/**
 * repo.js — Lớp dữ liệu mới (Giai đoạn 1): mỗi hồ sơ là MỘT bản ghi Firestore riêng
 *   projects/{pid}/{entity}/{id}
 * thay cho kiểu cũ "cả dự án một bản ghi chứa mọi mảng" (giới hạn 1 MB, ghi đè cả mảng).
 *
 * Chống ghi đè: mỗi bản ghi có _v (số phiên bản). save() gửi kèm _v đã đọc; nếu người khác
 * đã lưu trước (_v trên server khác) → ném ConflictError, KHÔNG ghi. Firestore rules (bước 1.4)
 * chặn thêm ở phía server: _v mới phải = _v cũ + 1.
 *
 * CHƯA nối vào app (bước 1.6–1.7). Không phụ thuộc DOM hay biến toàn cục: nhận `db` (Firestore
 * compat) và `fieldValue` từ ngoài → test được bằng Node trên Firestore giả và Emulator thật.
 */
import { cleanForFirestore } from '../utils/firestore-clean.js';

export const ENTITIES = ['budgets', 'tenders', 'contracts', 'payments', 'variations', 'cashflows', 'finals'];
const META = ['_v', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'deleted', 'deletedAt', 'deletedBy'];

export class ConflictError extends Error {
    constructor(message, current = null) {
        super(message);
        this.name = 'ConflictError';
        this.current = current;   // { _v, updatedBy, updatedAt } của bản trên server, null nếu không còn
    }
}

const stripMeta = (rec) => Object.fromEntries(Object.entries(rec || {}).filter(([k]) => !META.includes(k) && k !== 'id'));
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
                createdAt: ts(), createdBy: user.uid, updatedAt: ts(), updatedBy: user.uid };
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
                createdAt: cur.createdAt ?? null, createdBy: cur.createdBy ?? null, updatedAt: ts(), updatedBy: user.uid };
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
            const patch = { _v: expectedV + 1, deleted, updatedAt: ts(), updatedBy: user.uid,
                deletedAt: deleted ? ts() : null, deletedBy: deleted ? user.uid : null };
            tx.update(ref, patch);
            onWrite(tx, { entity, pid, id, action: deleted ? 'delete' : 'restore', before: cur, after: { ...cur, ...patch }, reason });
            return { id, _v: patch._v };
        });
    }

    return {
        list, get, subscribe, create, save,
        /** Xóa mềm: vào thùng rác, khôi phục được. Không xóa thật. */
        softDelete: (entity, pid, id, expectedV, { reason } = {}) => setDeleted(entity, pid, id, expectedV, true, reason),
        restore: (entity, pid, id, expectedV, { reason } = {}) => setDeleted(entity, pid, id, expectedV, false, reason),
    };
}
