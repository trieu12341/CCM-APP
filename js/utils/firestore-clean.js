/**
 * firestore-clean.js — Làm sạch dữ liệu trước khi ghi Firestore.
 * Firestore từ chối CẢ bản ghi nếu có một trường undefined / NaN / Infinity
 * (lỗi đã làm mất IPC khi lưu cloud). Hàm này:
 *  - bỏ khóa có giá trị undefined hoặc hàm,
 *  - phần tử undefined trong mảng → null,
 *  - NaN / Infinity → 0,
 *  - giữ nguyên Date và các giá trị đặc biệt của Firebase (serverTimestamp…).
 * Thuần → test được bằng Node.
 */
const isPlain = (v) => {
    if (v === null || typeof v !== 'object') return false;
    const proto = Object.getPrototypeOf(v);
    return proto === Object.prototype || proto === null;
};

export function cleanForFirestore(value) {
    if (value === undefined || typeof value === 'function') return undefined;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (Array.isArray(value)) {
        return value.map(v => {
            const c = cleanForFirestore(Array.isArray(v) ? { items: v } : v); // Firestore cấm mảng lồng mảng
            return c === undefined ? null : c;
        });
    }
    if (isPlain(value)) {
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            const c = cleanForFirestore(v);
            if (c !== undefined) out[k] = c;
        }
        return out;
    }
    return value; // string, boolean, null, Date, FieldValue…
}
