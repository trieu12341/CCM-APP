/**
 * audit-diff.js — So sánh hai phiên bản của một hồ sơ → danh sách thay đổi {field, from, to}
 * để ghi nhật ký ("ai sửa, lúc nào, trường nào, cũ → mới"). Thuần, test được bằng Node.
 *
 *  - Bỏ qua trường hệ thống (_v, người/giờ tạo-sửa-xóa).
 *  - "1500" và 1500 coi là bằng nhau (dữ liệu cũ có chỗ lưu số dạng chữ).
 *  - Mảng dòng có mã (dòng Bill của IPC, dòng VO…) so theo MÃ DÒNG, không theo vị trí:
 *    thêm/xóa một dòng ở giữa không làm mọi dòng sau bị coi là "đã sửa".
 *  - Mảng/đối tượng khác: so cả khối, ghi giá trị dạng rút gọn.
 */
export const IGNORED = new Set(['_v', 'id', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'deleted', 'deletedAt', 'deletedBy']);
const MAX_CHANGES = 200;
const MAX_TEXT = 300;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date);
const asTime = (v) => (v instanceof Date ? v.getTime() : typeof v?.toMillis === 'function' ? v.toMillis() : null);
const numLike = (v) => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))));

export function sameValue(a, b) {
    if (a === b) return true;
    if ((a === undefined || a === null || a === '') && (b === undefined || b === null || b === '')) return true;
    const ta = asTime(a), tb = asTime(b);
    if (ta !== null || tb !== null) return ta === tb;
    if (numLike(a) && numLike(b)) return Number(a) === Number(b);
    if (typeof a === 'object' && typeof b === 'object' && a && b) return JSON.stringify(a) === JSON.stringify(b);
    return false;
}

/** Giá trị gọn để lưu nhật ký (Firestore không nhận mảng lồng, chuỗi quá dài làm phình bản ghi). */
export function compact(v) {
    if (v === undefined) return null;
    const t = asTime(v);
    if (t !== null) return new Date(t).toISOString();
    if (v === null || typeof v !== 'object') return typeof v === 'string' && v.length > MAX_TEXT ? v.slice(0, MAX_TEXT) + '…' : v;
    const s = JSON.stringify(v);
    return s.length > MAX_TEXT ? s.slice(0, MAX_TEXT) + '…' : s;
}

const lineKey = (l) => [l?.code, l?.vo_line_id, l?.description].filter(x => x !== undefined && x !== null && x !== '').join(' | ');
const isKeyedLines = (arr) => Array.isArray(arr) && arr.length > 0 && arr.every(l => isObj(l) && lineKey(l));

function diffLines(field, before = [], after = [], out) {
    const index = (arr) => {
        const m = new Map();
        arr.forEach(l => { let k = lineKey(l), n = 2; while (m.has(k)) k = `${lineKey(l)} #${n++}`; m.set(k, l); });
        return m;
    };
    const A = index(before), B = index(after);
    for (const [k, b] of B) {
        const a = A.get(k);
        if (!a) { out.push({ field: `${field}[${k}]`, from: null, to: compact(b) }); continue; }
        for (const f of new Set([...Object.keys(a), ...Object.keys(b)])) {
            if (!sameValue(a[f], b[f])) out.push({ field: `${field}[${k}].${f}`, from: compact(a[f]), to: compact(b[f]) });
        }
    }
    for (const [k, a] of A) if (!B.has(k)) out.push({ field: `${field}[${k}]`, from: compact(a), to: null });
}

/** @returns {Array<{field:string, from:any, to:any}>} rỗng nếu không có gì đổi */
export function diffRecords(before = {}, after = {}) {
    const out = [];
    const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
    for (const f of [...keys].sort()) {
        if (IGNORED.has(f)) continue;
        const a = before?.[f], b = after?.[f];
        if (sameValue(a, b)) continue;
        if ((isKeyedLines(a) || isKeyedLines(b)) && (Array.isArray(a) || a == null) && (Array.isArray(b) || b == null)) {
            diffLines(f, a || [], b || [], out);
        } else {
            out.push({ field: f, from: compact(a), to: compact(b) });
        }
        if (out.length >= MAX_CHANGES) break;
    }
    return out.slice(0, MAX_CHANGES);
}
