export const formatCurrency = (value) => {
    return new Intl.NumberFormat('vi-VN').format(Math.round(value || 0)) + ' VNĐ';
};

export const formatCurrencyVND = (value) => {
    return new Intl.NumberFormat('vi-VN').format(Math.round(value || 0));
};

export const formatCurrencyShort = (value) => {
    const val = value || 0;
    if (Math.abs(val) >= 1e9) {
        return (val / 1e9).toFixed(3).replace(/\.?0+$/, '') + ' Tỷ VNĐ';
    } else if (Math.abs(val) >= 1e6) {
        return (val / 1e6).toFixed(0) + ' Triệu VNĐ';
    } else {
        return formatCurrency(val);
    }
};

export const formatCurrencyDetailed = (value) => {
    return `${formatCurrency(value)} (${formatCurrencyShort(value)})`;
};

export const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute:'2-digit' };
    const dateObj = new Date(dateString);
    return isNaN(dateObj) ? dateString : dateObj.toLocaleDateString('vi-VN');
};

export const parseCurrencyInput = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    // Remove all non-numeric characters except for dots and commas
    // For Vietnam currency, 4.000.000.000 uses dots. We can just strip all non-digit characters.
    // If we expect decimal values like 4.5, then it's different. But VN currency rarely uses decimals.
    // However, to be safe: strip all non-digits.
    const str = String(value).replace(/\D/g, '');
    return parseFloat(str) || 0;
};

// Keep parseBudget for backwards compatibility if needed elsewhere
export const parseBudget = parseCurrencyInput;

/**
 * Chống XSS: thoát ký tự HTML trước khi chèn chuỗi người dùng nhập
 * (tên gói thầu, nhà thầu, mô tả, email…) vào innerHTML/thuộc tính.
 */
export const escapeHtml = (value) => {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

/** Tô màu theo NGHĨA cho số KPI: âm/vượt → đỏ, dương (khi có nghĩa tốt) → xanh. */
export function setTone(el, value, { positive = false } = {}) {
    if (!el) return;
    el.classList.toggle('tone-neg', value < 0);
    el.classList.toggle('tone-pos', positive && value > 0);
    const card = el.closest && el.closest('.kpi-card');
    if (card) card.classList.toggle('has-alert', value < 0);
}
