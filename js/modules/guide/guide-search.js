// Tìm trong hướng dẫn — hàm thuần. Bỏ dấu tiếng Việt để "thung rac" ra "Thùng rác".
import { GUIDE_1 } from './guide-content.js';
import { GUIDE_2 } from './guide-content-2.js';

export const SECTIONS = [...GUIDE_1, ...GUIDE_2];
export const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const plain = (html) => html.replace(/<[^>]+>/g, ' ');

/** Các mục chứa đủ mọi từ khóa (rỗng = tất cả). */
export function matchSections(query, sections = SECTIONS) {
    const words = fold(query).trim().split(/\s+/).filter(Boolean);
    if (!words.length) return sections;
    return sections.filter(s => { const t = fold(s.title + ' ' + plain(s.html)); return words.every(w => t.includes(w)); });
}
