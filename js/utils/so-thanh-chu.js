// Đọc số tiền thành chữ tiếng Việt (dùng cho dòng 16 của chứng chỉ IPC). Hàm thuần.
const SO = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

/** Đọc một nhóm 3 chữ số. full = có nhóm đứng trước (phải đọc "không trăm", "linh"). */
function docNhom(n, full) {
    const tram = Math.floor(n / 100), chuc = Math.floor(n / 10) % 10, dv = n % 10;
    const out = [];
    if (tram || full) out.push(SO[tram], 'trăm');
    if (chuc === 0) { if (dv && (tram || full)) out.push('linh'); }
    else if (chuc === 1) out.push('mười');
    else out.push(SO[chuc], 'mươi');
    if (dv) {
        if (dv === 1 && chuc >= 2) out.push('mốt');
        else if (dv === 5 && chuc >= 1) out.push('lăm');
        else out.push(SO[dv]);
    }
    return out.join(' ');
}

/** Số nguyên không âm → chữ (không có "đồng"). Hỗ trợ tới hàng tỷ tỷ. */
function docSoNguyen(n) {
    if (n === 0) return 'không';
    const nhom = [];
    while (n > 0) { nhom.push(n % 1000); n = Math.floor(n / 1000); }
    const parts = [];
    for (let i = nhom.length - 1; i >= 0; i--) {
        const g = nhom[i];
        if (g) parts.push(docNhom(g, i < nhom.length - 1));
        // đơn vị: nghìn (i%3==1), triệu (i%3==2), tỷ ở mỗi bậc chia hết cho 3 (i=3, 6…)
        const unit = i === 0 ? '' : i % 3 === 1 ? 'nghìn' : i % 3 === 2 ? 'triệu' : 'tỷ';
        if (unit && (g || unit === 'tỷ')) parts.push(unit);
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/** 2391377432 → "Hai tỷ ba trăm chín mươi mốt triệu … đồng". Làm tròn đến đồng; số âm thêm "Âm". */
export function soThanhChu(value) {
    let n = Math.round(Number(value) || 0);
    const am = n < 0; n = Math.abs(n);
    if (!Number.isSafeInteger(n)) throw new Error('Số quá lớn');
    const s = (am ? 'âm ' : '') + docSoNguyen(n) + ' đồng';
    return s.charAt(0).toUpperCase() + s.slice(1);
}
