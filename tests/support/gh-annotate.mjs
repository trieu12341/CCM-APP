/**
 * Reporter cho `node --test`: biến mỗi test ĐỎ thành chú thích GitHub (::error::).
 * Chú thích đọc được ở tab Checks / API ngay cả khi không mở được log đầy đủ của CI.
 * Ngoài GitHub Actions, reporter này im lặng. Dùng kèm reporter `spec`.
 */
const esc = (s, prop = false) => {
    const t = String(s ?? '').replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
    return prop ? t.replace(/:/g, '%3A').replace(/,/g, '%2C') : t;
};

/** Một sự kiện test:fail → dòng lệnh GitHub; sự kiện khác → ''. Hàm thuần để test. */
export function toAnnotation(ev) {
    if (ev?.type !== 'test:fail') return '';
    const d = ev.data || {};
    const err = d.details?.error;
    const msg = String(err?.cause?.message || err?.message || err || 'test đỏ').slice(0, 900);
    const file = d.file ? String(d.file).replace(/^.*?[\\/]tests[\\/]/, 'tests/').replace(/\\/g, '/') : '';
    return `::error${file ? ` file=${esc(file, true)},` : ' '}title=${esc(d.name, true)}::${esc(msg)}\n`;
}

export default async function* ghAnnotate(source) {
    if (!process.env.GITHUB_ACTIONS) { for await (const _ of source) { /* bỏ qua */ } return; }
    for await (const ev of source) {
        const line = toAnnotation(ev);
        if (line) yield line;
    }
}
