/**
 * migrate-plan.js — Lập kế hoạch chuyển dữ liệu: bản ghi dự án KIỂU CŨ (projects/{pid} chứa các mảng)
 * → các bản ghi riêng projects/{pid}/{loại}/{id}. THUẦN (không DOM, không Firestore) → test bằng Node.
 *
 * Không làm mất dữ liệu: bản ghi thiếu mã được gán mã tạm (LEG-…) và báo cảnh báo; bản ghi trùng mã
 * KHÁC nội dung thì chặn (phải sửa trong app trước), trùng mã GIỐNG hệt thì gộp làm một.
 */
import { cleanForFirestore } from '../utils/firestore-clean.js';
import { ENTITIES, META, stripMeta } from './repo.js';
import { checksums } from './migrate-checks.js';

/** Tên mảng trong bản ghi dự án cũ. */
export const LEGACY_FIELD = { budgets: 'budgets', tenders: 'tenders', contracts: 'contracts', payments: 'payments',
    variations: 'variations', cashflows: 'cashflows', finals: 'final_statements' };
/** Trường chứa mã của từng loại hồ sơ cũ. */
export const ID_KEY = { budgets: 'id', tenders: 'tender_id', contracts: 'contract_id', payments: 'ipc_id',
    variations: 'vo_id', cashflows: 'id', finals: 'id' };
export const LABEL = { budgets: 'Ngân sách', tenders: 'Gói thầu', contracts: 'Hợp đồng', payments: 'IPC',
    variations: 'VO', cashflows: 'Dòng tiền', finals: 'Quyết toán' };
export const MAX_DOC_BYTES = 900_000;   // Firestore giới hạn 1 MiB mỗi bản ghi

/** JSON có khóa sắp xếp → so sánh nội dung không phụ thuộc thứ tự khóa. */
export function stable(v) {
    if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
    if (v && typeof v === 'object' && !(v instanceof Date) && typeof v.toMillis !== 'function') {
        return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
    }
    if (v && typeof v.toMillis === 'function') return `ts:${v.toMillis()}`;
    return JSON.stringify(v instanceof Date ? v.toISOString() : v) ?? 'null';
}

/** Mã hợp lệ làm tên bản ghi Firestore (không có "/", không phải "." / "..", không dạng __x__). */
export function safeId(raw) {
    let id = String(raw).trim().replace(/\//g, '_');
    if (id === '.' || id === '..' || /^__.*__$/.test(id)) id = `id${id}`;
    return id;
}

/** Bản ghi {id, data} của kế hoạch → dạng phẳng như bản ghi cũ (id nằm trong chính nó) để tính tổng kiểm. */
export const plain = (entity, r) => ({ ...r.data, [ID_KEY[entity]]: r.id });

/**
 * @param {object|null} doc  dữ liệu projects/{pid} đọc từ cloud
 * @returns {{pid, records:{[entity]:{id,data}[]}, issues:{level:'error'|'warn',entity,index?,code,message}[],
 *            blocking:boolean, counts:object, checksums:object}}
 */
export function planMigration(doc, pid) {
    const records = {}, issues = [];
    const add = (level, entity, code, message, index) => issues.push({ level, entity, code, message, ...(index === undefined ? {} : { index }) });

    for (const entity of ENTITIES) {
        records[entity] = [];
        const raw = doc?.[LEGACY_FIELD[entity]];
        if (raw === undefined || raw === null) continue;
        if (!Array.isArray(raw)) { add('error', entity, 'khong-phai-mang', `"${LEGACY_FIELD[entity]}" không phải danh sách`); continue; }
        const seen = new Map();
        raw.forEach((item, i) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) { add('warn', entity, 'phan-tu-rong', `Dòng ${i + 1} rỗng, bỏ qua`, i); return; }
            const key = ID_KEY[entity];
            let id = item[key] === undefined || item[key] === null ? '' : String(item[key]).trim();
            if (!id) { id = `LEG-${entity}-${i + 1}`; add('warn', entity, 'thieu-ma', `Dòng ${i + 1} thiếu mã → gán mã tạm ${id}`, i); }
            const safe = safeId(id);
            if (safe !== id) { add('warn', entity, 'doi-ma', `Mã "${id}" có ký tự không hợp lệ → đổi thành "${safe}"`, i); id = safe; }

            const dropped = Object.keys(item).filter(k => META.includes(k));
            if (dropped.length) add('warn', entity, 'truong-he-thong', `${id}: bỏ các trường hệ thống mới sẽ tự đặt (${dropped.join(', ')})`, i);
            const data = cleanForFirestore(stripMeta({ ...item, [key]: id }));
            if (key !== 'id') data[key] = id;   // stripMeta bỏ "id"; các mã khác (contract_id…) giữ trong nội dung
            if (item.project_id && item.project_id !== pid) add('warn', entity, 'khac-du-an', `${id} thuộc dự án "${item.project_id}" nhưng nằm trong dự án ${pid}`, i);
            if (stable(data).length > MAX_DOC_BYTES) add('warn', entity, 'qua-lon', `${id} dài hơn 900 KB, có thể bị Firestore từ chối`, i);

            if (seen.has(id)) {
                if (stable(seen.get(id)) === stable(data)) add('warn', entity, 'trung-ma-giong', `Mã ${id} xuất hiện 2 lần, nội dung giống hệt → gộp`, i);
                else add('error', entity, 'trung-ma-khac', `Mã ${id} xuất hiện 2 lần với nội dung KHÁC NHAU — sửa trong app trước khi chuyển`, i);
                return;
            }
            seen.set(id, data);
            records[entity].push({ id, data });
        });
    }
    const counts = Object.fromEntries(ENTITIES.map(e => [e, records[e].length]));
    const plainRecs = Object.fromEntries(ENTITIES.map(e => [e, records[e].map(r => plain(e, r))]));
    return { pid, records, issues, blocking: issues.some(x => x.level === 'error'), counts, checksums: checksums(plainRecs) };
}

/** Chia danh sách ghi thành các lô ≤ maxCount bản ghi và ≤ maxBytes (Firestore: ≤ 500 thao tác, ≤ 10 MiB mỗi lô). */
export function chunkWrites(items, { maxCount = 400, maxBytes = 8_000_000 } = {}) {
    const out = []; let cur = [], bytes = 0;
    for (const it of items) {
        const size = stable(it.data).length + 200;
        if (cur.length && (cur.length >= maxCount || bytes + size > maxBytes)) { out.push(cur); cur = []; bytes = 0; }
        cur.push(it); bytes += size;
    }
    if (cur.length) out.push(cur);
    return out;
}
