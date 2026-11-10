// Đọc số tiền thành chữ tiếng Anh cho dòng "In Words" của CERT. Hàm thuần.
const ONES = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
    'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const SCALE = ['', 'Thousand', 'Million', 'Billion', 'Trillion', 'Quadrillion'];

function under1000(n) {
    const h = Math.floor(n / 100), r = n % 100, out = [];
    if (h) out.push(ONES[h], 'Hundred');
    if (r >= 20) out.push(TENS[Math.floor(r / 10)] + (r % 10 ? ' ' + ONES[r % 10] : ''));
    else if (r) out.push(ONES[r]);
    return out.join(' ');
}

/** 2391377432 → "Two Billion, Three Hundred Ninety One Million, … Thirty Two" */
export function numberToEnglish(value) {
    let n = Math.round(Math.abs(Number(value) || 0));
    if (n === 0) return 'Zero';
    const parts = [];
    for (let i = 0; n > 0; i++, n = Math.floor(n / 1000)) {
        const g = n % 1000;
        if (g) parts.unshift(under1000(g) + (SCALE[i] ? ' ' + SCALE[i] : ''));
    }
    return (Number(value) < 0 ? 'Minus ' : '') + parts.join(', ');
}
