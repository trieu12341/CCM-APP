/**
 * Hàm thuần dựng nhiệm vụ gửi Gemini (không gọi Gemini, không đụng đĩa) — để test bằng Node.
 * Dùng bởi scripts/gemini/run.mjs.
 */

/** Tên nhánh/worktree an toàn từ tiêu đề nhiệm vụ: "Viết test VO!" → "viet-test-vo". */
export function slugify(title) {
    const s = String(title || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'D')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
        .slice(0, 40).replace(/-+$/g, '');
    return s || 'nhiem-vu';
}

/** Đọc file nhiệm vụ: dòng "# ..." đầu tiên là tiêu đề, dòng "Được sửa: a, b" là danh sách file cho phép. */
export function parseTask(markdown) {
    const text = String(markdown || '');
    const title = (text.match(/^#\s+(.+)$/m) || [])[1]?.trim() || '';
    const line = (text.match(/^Được sửa:\s*(.+)$/mi) || [])[1] || '';
    const allowed = line.split(/[,;]/).map(s => s.trim().replace(/^`|`$/g, '')).filter(Boolean);
    return { title, allowed, body: text.trim() };
}

const RULES = [
    'Bạn là THỢ, Claude là quản đốc. Đọc GEMINI.md và CLAUDE.md trước khi làm.',
    'Chỉ sửa/tạo các file trong danh sách "Được sửa". Cần sửa file khác thì DỪNG và ghi lý do vào báo cáo.',
    'KHÔNG commit, KHÔNG push, KHÔNG xóa file, KHÔNG chạy lệnh deploy hay firebase.',
    'KHÔNG đổi định nghĩa số liệu (mục 4 CLAUDE.md), ipc-engine.js, payment-metrics.js, firestore.rules.',
    'Viết test cho chính thay đổi của bạn; chạy `npm test` và ghi kết quả.',
    'Kết thúc bằng mục "## Báo cáo": file đã đổi, test đã thêm, kết quả test, chỗ chưa chắc.',
];

/** Prompt cho chế độ làm việc (sửa code trong worktree riêng). */
export function buildWorkPrompt(task) {
    if (!task.title) throw new Error('File nhiệm vụ thiếu dòng tiêu đề "# ..."');
    if (!task.allowed.length) throw new Error('File nhiệm vụ thiếu dòng "Được sửa: ..."');
    return [
        '# QUY TẮC BẮT BUỘC', ...RULES.map(r => `- ${r}`), '',
        `# FILE ĐƯỢC SỬA\n${task.allowed.map(f => `- ${f}`).join('\n')}`, '',
        '# NHIỆM VỤ', task.body,
    ].join('\n');
}

/** Prompt cho chế độ soát (chỉ đọc diff, không sửa gì). */
export function buildReviewPrompt(diff, focus = '') {
    if (!String(diff || '').trim()) throw new Error('Diff rỗng — không có gì để soát');
    return [
        'Bạn là người soát code thứ hai cho CCM-APP (đọc GEMINI.md, CLAUDE.md). CHỈ ĐỌC, không sửa file nào.',
        'Tìm lỗi thật: sai logic, sai số tiền/làm tròn, vi phạm mục 4 CLAUDE.md, thiếu test, lỗi bảo mật Firestore.',
        'Không góp ý văn phong. Mỗi lỗi: file:dòng — vấn đề — kịch bản gây lỗi cụ thể. Không có lỗi thì ghi "Không thấy lỗi".',
        focus ? `Tập trung vào: ${focus}` : '', '', '# DIFF', diff,
    ].filter(l => l !== '').join('\n');
}

/** File bị đổi nằm ngoài danh sách cho phép (để quản đốc từ chối). */
export function outsideAllowed(changed, allowed) {
    const ok = new Set(allowed.map(f => f.replace(/\\/g, '/')));
    return changed.map(f => f.replace(/\\/g, '/')).filter(f => f && !ok.has(f));
}
