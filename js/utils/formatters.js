export const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US').format(Math.round(value || 0)) + ' VNĐ';
};

export const formatCurrencyVND = (value) => {
    return new Intl.NumberFormat('en-US').format(Math.round(value || 0));
};

export const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute:'2-digit' };
    return new Date(dateString).toLocaleDateString('en-US', options);
};
