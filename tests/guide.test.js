// Tab Hướng dẫn: nội dung trỏ đúng menu đang có, id không trùng, tìm không phân biệt dấu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GUIDE_1 } from '../js/modules/guide/guide-content.js';
import { GUIDE_2 } from '../js/modules/guide/guide-content-2.js';
import { matchSections as match } from '../js/modules/guide/guide-search.js';

const SECTIONS = [...GUIDE_1, ...GUIDE_2];

test('mỗi mục có id riêng, tiêu đề, nội dung; menu trỏ tới đúng id có trong sidebar', () => {
    const sidebar = readFileSync(new URL('../components/sidebar.html', import.meta.url), 'utf8');
    const ids = SECTIONS.map(s => s.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const s of SECTIONS) {
        assert.ok(s.title && s.html.length > 80, s.id);
        if (s.menu) assert.ok(sidebar.includes(`id="${s.menu}"`), `menu ${s.menu} không còn trong sidebar`);
    }
    assert.ok(sidebar.includes('id="menu-guide"'));
});

test('nút được nhắc trong hướng dẫn có thật trên giao diện', () => {
    const ui = ['components/modals-2.html', 'components/modules-1.html', 'components/modules-2.html', 'components/migrate.html']
        .map(f => readFileSync(new URL('../' + f, import.meta.url), 'utf8')).join('\n');
    for (const label of ['+ Thêm Hạng Mục Ngân Sách', '+ Khởi tạo Bảng CBA', '🏆 Chốt Chọn Nhà Thầu', 'Chuyển sang Hợp đồng', '+ Tạo Hợp đồng',
        'Tạo Hồ sơ Thanh toán Mới (IPC)', 'Phê duyệt IPC', 'Xác nhận Đã Chuyển Tiền', 'Mở khóa', 'Tạo Phát sinh VO Mới', 'Lập Hồ Sơ Quyết Toán Mới',
        'Tiếp tục lập Quyết toán', '⚡ Tự động tạo', 'Chạy thử', 'Chạy thật']) {
        assert.ok(ui.includes(label), `không thấy nút "${label}"`);
    }
});

test('tìm không dấu: "thung rac" ra mục an toàn dữ liệu, "mo khoa" ra mục IPC', () => {
    assert.ok(match('thung rac').some(s => s.id === 'an-toan'));
    assert.ok(match('mo khoa').some(s => s.id === 'ipc'));
    assert.equal(match('').length, SECTIONS.length);
    assert.deepEqual(match('khongcotukhoanay'), []);
    assert.ok(match('VO Approved').every(s => s.id === 'vo' || /approved/i.test(s.html)));
});
