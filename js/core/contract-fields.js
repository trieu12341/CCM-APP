/**
 * contract-fields.js — Một nguồn duy nhất để đọc/ghi các trường của Hợp đồng.
 *
 * Lịch sử: form Hợp đồng lưu `original_value / contractor / package_name`,
 * luồng Đấu thầu lưu `total_value`, còn nhiều module đọc `contract_name /
 * vendor_name / contractor_name / value` → cùng một hợp đồng hiện 0 hoặc
 * "undefined" tùy màn hình. Mọi chỗ đọc/ghi nên đi qua các hàm dưới đây.
 *
 * Thuần (không DOM, không import app) → chạy được trong unit test Node.
 */

const num = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d-]/g, '')); // chuỗi kiểu VN '1.234.567'
    return Number.isFinite(n) ? n : null;
};

/** Giá trị hợp đồng gốc (trước phát sinh). */
export function getContractValue(c) {
    if (!c) return 0;
    for (const k of ['original_value', 'total_value', 'contract_value', 'value', 'current_value']) {
        const n = num(c[k]);
        if (n !== null && n !== 0) return n;
    }
    return 0;
}

/** Tên nhà thầu. */
export function getContractorName(c) {
    if (!c) return '';
    return c.contractor || c.contractor_name || c.vendor_name || '';
}

/** Tên gói thầu / hợp đồng. */
export function getContractName(c) {
    if (!c) return '';
    return c.package_name || c.contract_name || c.contract_code || c.contract_id || '';
}

/** Ghi giá trị hợp đồng vào trường chuẩn và mọi bí danh cũ (để code cũ đọc vẫn đúng). */
export function setContractValue(c, value) {
    const v = Math.round(Number(value) || 0);
    c.original_value = v;
    c.total_value = v;
    c.contract_value = v;
    return c;
}

/**
 * Chuẩn hóa một hợp đồng: điền trường chuẩn từ bí danh cũ và ngược lại.
 * Không xóa trường nào → dữ liệu cũ vẫn đọc được.
 */
export function normalizeContract(c) {
    if (!c || typeof c !== 'object') return c;
    setContractValue(c, getContractValue(c));
    const contractor = getContractorName(c);
    c.contractor = contractor;
    c.contractor_name = contractor;
    c.vendor_name = contractor;
    const name = c.package_name || c.contract_name || '';
    if (name) {
        c.package_name = name;
        c.contract_name = name;
    }
    return c;
}

export function normalizeContracts(list) {
    if (!Array.isArray(list)) return list;
    list.forEach(normalizeContract);
    return list;
}
