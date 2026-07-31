export const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US').format(Math.round(value || 0)) + ' VNĐ';
};

export const formatCurrencyVND = (value) => {
    return new Intl.NumberFormat('en-US').format(Math.round(value || 0));
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
    return new Date(dateString).toLocaleDateString('en-US', options);
};
