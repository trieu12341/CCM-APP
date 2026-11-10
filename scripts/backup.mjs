// Sao lưu MỌI dự án (bản ghi dự án + hồ sơ con + nhật ký) và danh sách tài khoản ra một file JSON.
// Dùng:  node scripts/backup.mjs [thư-mục-đầu-ra]      (mặc định ./backups)
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { adminDb } from './_admin.mjs';
import { exportAll } from '../js/data/backup.js';

const out = process.argv[2] || 'backups';
let all;
try {
    all = await exportAll(adminDb());
} catch (e) {
    // Annotation của GitHub Actions: đọc được ở trang chạy mà không cần mở log
    console.error(`::error title=Sao lưu thất bại::${String(e.code || '')} ${String(e.message || e).replace(/\s+/g, ' ').slice(0, 300)}`);
    process.exit(1);
}
const count = all.projects.reduce((s, p) => s + Object.values(p.collections).reduce((n, l) => n + l.length, 0), 0);
if (!all.projects.length && process.env.ALLOW_EMPTY !== '1') { console.error('::error title=Sao lưu thất bại::Không có dự án nào để sao lưu — nghi sai môi trường hoặc thiếu quyền đọc'); process.exit(1); }
mkdirSync(out, { recursive: true });
const file = join(out, `ccm-backup-${new Date().toISOString().slice(0, 10)}.json`);
writeFileSync(file, JSON.stringify(all));
console.log(`Đã sao lưu ${all.projects.length} dự án, ${count} hồ sơ con, ${all.users.length} tài khoản → ${file}`);
