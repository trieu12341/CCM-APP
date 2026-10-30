// Sao lưu MỌI dự án (bản ghi dự án + hồ sơ con + nhật ký) và danh sách tài khoản ra một file JSON.
// Dùng:  node scripts/backup.mjs [thư-mục-đầu-ra]      (mặc định ./backups)
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { adminDb } from './_admin.mjs';
import { exportAll } from '../js/data/backup.js';

const out = process.argv[2] || 'backups';
const db = adminDb();
const all = await exportAll(db);
const count = all.projects.reduce((s, p) => s + Object.values(p.collections).reduce((n, l) => n + l.length, 0), 0);
if (!all.projects.length) { console.error('Không có dự án nào để sao lưu — dừng (nghi sai môi trường/quyền).'); process.exit(1); }
mkdirSync(out, { recursive: true });
const file = join(out, `ccm-backup-${new Date().toISOString().slice(0, 10)}.json`);
writeFileSync(file, JSON.stringify(all));
console.log(`Đã sao lưu ${all.projects.length} dự án, ${count} hồ sơ con, ${all.users.length} tài khoản → ${file}`);
