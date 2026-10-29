/**
 * migrate-gate.js — Khi nào được bấm "Chạy thật". Thuần → test được.
 * Bản thật bị KHÓA cho tới khi ứng dụng đã đọc/ghi theo cấu trúc mới (bước 1.6–1.7); đổi cờ này trong PR của các bước đó.
 */
export const ALLOW_PROD_MIGRATE = false;

/**
 * @param {{env:'prod'|'staging', isAdmin:boolean, dryRan:boolean, blocking:boolean, typed:string, pid:string, allowProd?:boolean}} s
 * @returns {{ok:boolean, reason:string}}
 */
export function runGate({ env, isAdmin, dryRan, blocking, typed, pid, allowProd = ALLOW_PROD_MIGRATE }) {
    if (!isAdmin) return { ok: false, reason: 'Chỉ admin được chạy chuyển dữ liệu.' };
    if (env === 'prod' && !allowProd) return { ok: false, reason: 'Bản thật đang khóa: app chưa đọc theo cấu trúc mới. Chạy thử trên staging trước.' };
    if (!dryRan) return { ok: false, reason: 'Bấm "Chạy thử" trước.' };
    if (blocking) return { ok: false, reason: 'Còn lỗi chặn trong kết quả chạy thử — sửa trong app rồi chạy thử lại.' };
    if (!pid || String(typed).trim() !== pid) return { ok: false, reason: `Gõ đúng mã dự án "${pid}" để xác nhận.` };
    return { ok: true, reason: '' };
}
