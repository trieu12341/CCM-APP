// Tab "Hướng dẫn sử dụng": mục lục bên trái, nội dung bên phải, ô tìm (không phân biệt dấu), nút "Mở tab" nhảy sang tab tương ứng.
import { matchSections } from './guide-search.js';
import { state } from '../../app.js';

const $ = (id) => document.getElementById(id);

function render(list) {
    const isAdmin = state.user?.role === 'admin';
    const shown = list.filter(s => !s.admin || isAdmin);
    $('guide-toc').innerHTML = shown.map(s => `<li><a href="#guide-${s.id}" data-guide="${s.id}"><i class="fa-solid ${s.icon}"></i> ${s.title}</a></li>`).join('');
    $('guide-body').innerHTML = shown.map((s, i) => `
        <section class="guide-section" id="guide-${s.id}">
            <header><span class="guide-no">${i + 1}</span><h3><i class="fa-solid ${s.icon}"></i> ${s.title}</h3>
            ${s.menu ? `<button type="button" class="btn btn-secondary guide-go" data-go="${s.menu}">Mở tab <i class="fa-solid fa-arrow-right"></i></button>` : ''}</header>
            ${s.html}
        </section>`).join('') || '<p class="guide-empty">Không thấy mục nào khớp. Thử từ khác, ví dụ "khóa", "VO", "thùng rác".</p>';
}

let wired = false;
export function initGuidePage() {
    if (!$('guide-body')) return;
    render(matchSections($('guide-search').value));
    if (wired) return;
    wired = true;
    $('guide-search').addEventListener('input', (e) => render(matchSections(e.target.value)));
    $('module-guide').addEventListener('click', (e) => {
        const go = e.target.closest('[data-go]');
        if (go) { document.getElementById(go.dataset.go)?.click(); return; }
        const a = e.target.closest('[data-guide]');
        if (a) { e.preventDefault(); $(`guide-${a.dataset.guide}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
}
