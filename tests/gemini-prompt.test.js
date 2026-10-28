// Bộ khung giao việc cho Gemini: dựng prompt, đọc file nhiệm vụ, chặn file ngoài phạm vi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, parseTask, buildWorkPrompt, buildReviewPrompt, outsideAllowed } from '../scripts/gemini/prompt.mjs';

const TASK = `# Viết test cho định dạng VNĐ!
Được sửa: tests/formatters.test.js, \`js/utils/formatters.js\`
Thêm test cho số âm và số 0.`;

test('slugify bỏ dấu tiếng Việt, đ → d, giới hạn độ dài', () => {
    assert.equal(slugify('Viết test cho định dạng VNĐ!'), 'viet-test-cho-dinh-dang-vnd');
    assert.equal(slugify('   '), 'nhiem-vu');
    assert.ok(slugify('a'.repeat(100)).length <= 40);
});

test('parseTask đọc tiêu đề và danh sách file được sửa', () => {
    const t = parseTask(TASK);
    assert.equal(t.title, 'Viết test cho định dạng VNĐ!');
    assert.deepEqual(t.allowed, ['tests/formatters.test.js', 'js/utils/formatters.js']);
});

test('buildWorkPrompt có quy tắc cấm commit/push và cấm đổi định nghĩa số liệu', () => {
    const p = buildWorkPrompt(parseTask(TASK));
    assert.match(p, /KHÔNG commit, KHÔNG push/);
    assert.match(p, /ipc-engine\.js/);
    assert.match(p, /- js\/utils\/formatters\.js/);
    assert.ok(p.endsWith('Thêm test cho số âm và số 0.'));
});

test('buildWorkPrompt từ chối nhiệm vụ thiếu tiêu đề hoặc thiếu phạm vi', () => {
    assert.throws(() => buildWorkPrompt(parseTask('Được sửa: a.js')), /tiêu đề/);
    assert.throws(() => buildWorkPrompt(parseTask('# Làm gì đó')), /Được sửa/);
});

test('buildReviewPrompt chỉ đọc, từ chối diff rỗng', () => {
    assert.match(buildReviewPrompt('+x', 'làm tròn'), /CHỈ ĐỌC[\s\S]*Tập trung vào: làm tròn[\s\S]*# DIFF\n\+x/);
    assert.throws(() => buildReviewPrompt('  '), /rỗng/);
});

test('outsideAllowed bắt file ngoài phạm vi (cả đường dẫn kiểu Windows)', () => {
    assert.deepEqual(outsideAllowed(['tests\\a.test.js', 'js/app.js'], ['tests/a.test.js']), ['js/app.js']);
    assert.deepEqual(outsideAllowed([], ['x']), []);
});
