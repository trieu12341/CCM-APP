// Chuyển bảng đang hiển thị thành mảng dòng cho Excel — hàm thuần (không DOM) để test bằng Node.
// Số kiểu Việt ("1.234.567", "-52.000.000", "12,34%") → số thật; dòng tổng cho cột tiền.
const MONEY = /^-?\d{1,3}(\.\d{3})+(,\d+)?$|^-?\d+(,\d+)?$/;

/** "1.234.567" → 1234567 ; "12,5%" → 12.5 (cột %) ; không phải số → giữ chữ. */
export function parseCell(text) {
    const t = String(text ?? '').replace(/\s+/g, ' ').trim().replace(/\s*(VNĐ|VND|đ)$/i, '');
    if (/^-?\d+(,\d+)?\s*%$/.test(t)) return { v: Number(t.replace('%', '').replace(',', '.')), pct: true };
    if (MONEY.test(t) && !/^0\d/.test(t)) return { v: Number(t.replace(/\./g, '').replace(',', '.')) };
    return { v: t };
}

const SKIP_HEADER = /^(hành động|thao tác|action|#)$/i;
const NO_TOTAL = /^(stt|no\.?|số tt|mã|tỷ lệ|%|ngày)/i;

/**
 * @param headers  tên cột đang hiển thị
 * @param rows     mảng các mảng chữ (đúng thứ tự cột)
 * @returns {{ header: string[], body: any[][], total: any[]|null, pctCols: number[], moneyCols: number[] }}
 */
export function buildSheet(headers, rows) {
    const keep = headers.map((h, i) => (SKIP_HEADER.test(String(h).trim()) ? -1 : i)).filter(i => i >= 0);
    const parsed = rows.map(r => keep.map(i => parseCell(r[i])));
    const moneyCols = [], pctCols = [];
    keep.forEach((src, c) => {
        const col = parsed.map(r => r[c]).filter(x => x.v !== '');
        const nums = col.length && col.every(x => typeof x.v === 'number');
        if (nums && col.some(x => x.pct)) pctCols.push(c);
        else if (nums && !NO_TOTAL.test(String(headers[src]).trim())) moneyCols.push(c);
    });
    const body = parsed.map(r => r.map(x => x.v));
    const total = moneyCols.length && body.length
        ? keep.map((_, c) => (c === 0 ? 'Tổng cộng' : moneyCols.includes(c) ? Math.round(body.reduce((s, r) => s + (typeof r[c] === 'number' ? r[c] : 0), 0)) : ''))
        : null;
    return { header: keep.map(i => String(headers[i]).replace(/\s+/g, ' ').trim()), body, total, pctCols, moneyCols };
}

export const safeName = (s) => String(s || 'du-an').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'du-an';
export const fileName = (project, what, date = new Date()) => `${safeName(project)}_${safeName(what)}_${date.toISOString().slice(0, 10)}.xlsx`;
