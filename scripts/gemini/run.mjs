#!/usr/bin/env node
/**
 * Claude (quản đốc) giao việc cho Gemini CLI (thợ). Chạy trên máy có cài `gemini` (Windows/macOS/Linux).
 *   node scripts/gemini/run.mjs check                       # Gemini có chạy không
 *   node scripts/gemini/run.mjs review [nhánh-gốc] [trọng-tâm]  # Gemini soát diff so với nhánh gốc (mặc định develop)
 *   node scripts/gemini/run.mjs task <file-nhiệm-vụ.md>     # Gemini làm việc trong worktree riêng
 * Biến môi trường: GEMINI_MODEL (vd gemini-2.5-pro), GEMINI_TIMEOUT_MIN (mặc định 20).
 * Gemini KHÔNG commit/push; Claude đọc diff, chạy test, rồi mới quyết định gộp.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { slugify, parseTask, buildWorkPrompt, buildReviewPrompt, outsideAllowed } from './prompt.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const LOG_DIR = join(ROOT, '.gemini-logs');
const TIMEOUT = Number(process.env.GEMINI_TIMEOUT_MIN || 20) * 60_000;
const WIN = process.platform === 'win32';

/** Lệnh dạng shim .cmd (gemini, npm) cần shell trên Windows → phải tự bọc nháy tham số có dấu cách. */
function sh(cmd, args, opts = {}) {
    const shell = WIN && cmd !== 'git';
    const a = shell ? args.map(x => (/[\s"&|<>^]/.test(x) ? `"${x.replace(/"/g, '\\"')}"` : x)) : args;
    const r = spawnSync(cmd, a, { encoding: 'utf8', shell, maxBuffer: 64 * 1024 * 1024, ...opts });
    if (r.error?.code === 'ENOENT') throw new Error(`Không tìm thấy lệnh \`${cmd}\` trên máy này.` + (cmd === 'gemini' ? ' Cài: npm install -g @google/gemini-cli rồi chạy `gemini` một lần để đăng nhập.' : ''));
    if (r.error) throw r.error;
    return r;
}
const git = (args, cwd = ROOT) => {
    const r = sh('git', args, { cwd });
    if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
    return r.stdout.trim();
};

/** Gọi gemini: nội dung dài qua stdin (tránh lỗi trích dẫn trên Windows), -p chỉ là câu lệnh ngắn. */
function gemini(input, { cwd = ROOT, edit = false } = {}) {
    const args = ['-p', 'Làm đúng theo nội dung được gửi qua stdin.'];
    if (edit) args.push('--yolo');               // chỉ dùng trong worktree riêng
    if (process.env.GEMINI_MODEL) args.push('-m', process.env.GEMINI_MODEL);
    const r = sh('gemini', args, { cwd, input, timeout: TIMEOUT });
    if (r.status !== 0) throw new Error(`gemini lỗi (mã ${r.status}): ${r.stderr.slice(-800)}`);
    return r.stdout;
}

function saveLog(name, text) {
    mkdirSync(LOG_DIR, { recursive: true });
    const file = join(LOG_DIR, `${new Date().toISOString().replace(/[:.]/g, '-')}-${name}.md`);
    writeFileSync(file, text);
    return file;
}

function check() {
    const v = sh('gemini', ['--version']);
    if (v.status !== 0) throw new Error('Không gọi được `gemini`. Cài: npm install -g @google/gemini-cli rồi chạy `gemini` để đăng nhập.');
    console.log(`Gemini CLI ${v.stdout.trim()}`);
    console.log(gemini('Trả lời đúng một dòng: "OK CCM".').trim());
}

function review(base = 'develop', focus = '') {
    const diff = git(['diff', `${base}...HEAD`]);
    const out = gemini(buildReviewPrompt(diff, focus));
    console.log(out);
    console.log(`\n[log] ${saveLog('review', out)}`);
}

function task(file) {
    if (!file || !existsSync(file)) throw new Error(`Không thấy file nhiệm vụ: ${file}`);
    const t = parseTask(readFileSync(file, 'utf8'));
    const prompt = buildWorkPrompt(t);
    const slug = slugify(t.title);
    const branch = `gemini/${slug}`;
    const dir = resolve(ROOT, '..', `ccm-gemini-${slug}`);
    if (existsSync(dir)) throw new Error(`Worktree đã tồn tại: ${dir} — xóa bằng: git worktree remove "${dir}"`);
    git(['worktree', 'add', '-b', branch, dir, 'HEAD']);
    if (existsSync(join(ROOT, 'node_modules')) && !existsSync(join(dir, 'node_modules'))) {
        sh('npm', ['ci', '--silent'], { cwd: dir });
    }
    console.log(`Gemini đang làm "${t.title}" trong ${dir} (nhánh ${branch})…`);
    const out = gemini(prompt, { cwd: dir, edit: true });
    git(['add', '-A'], dir);   // chỉ để xem diff (node_modules đã .gitignore); KHÔNG commit
    const changed = git(['diff', '--cached', '--name-only'], dir).split('\n').filter(Boolean);
    const bad = outsideAllowed(changed, t.allowed);
    const report = [`# ${t.title}`, `Worktree: ${dir}`, `Nhánh: ${branch}`,
        `File đổi: ${changed.join(', ') || '(không có)'}`,
        bad.length ? `⚠ NGOÀI PHẠM VI: ${bad.join(', ')} — quản đốc phải từ chối hoặc hoàn tác` : 'Phạm vi: đúng danh sách',
        '', '## Gemini trả lời', out].join('\n');
    console.log(report);
    console.log(`\n[log] ${saveLog(slug, report)}`);
    console.log(`Bước tiếp (Claude): git -C "${dir}" diff --cached → npm test trong worktree → soát → mới commit.`);
    if (bad.length) process.exitCode = 2;
}

const [cmd, ...rest] = process.argv.slice(2);
try {
    if (cmd === 'check') check();
    else if (cmd === 'review') review(rest[0], rest.slice(1).join(' '));
    else if (cmd === 'task') task(rest[0]);
    else { console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 9).join('\n')); process.exitCode = 1; }
} catch (e) {
    console.error(`✗ ${e.message}`);
    process.exitCode = 1;
}
