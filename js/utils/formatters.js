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
