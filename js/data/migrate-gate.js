/**
 * migrate-gate.js — Khi nào được bấm "Chạy thật". Thuần → test được.
 * Bản thật đã MỞ (app đọc/ghi được cấu trúc mới từ bước 1.6–1.7). Chuyển dữ liệu không xóa mảng kiểu cũ và tự tải
 * bản sao lưu dự án về máy trước khi ghi; vẫn phải là admin, chạy thử trước, không lỗi chặn, gõ đúng mã dự án.
 */
export const ALLOW_PROD_MIGRATE = true;

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
