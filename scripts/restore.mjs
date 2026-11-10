// Khôi phục MỘT dự án từ file sao lưu vào mã dự án MỚI (không ghi đè). Mặc định chỉ xem trước; thêm --yes để ghi.
// Dùng:  node scripts/restore.mjs <file.json> <mã-dự-án-gốc> <mã-dự-án-mới> [--yes]
import { readFileSync } from 'node:fs';
import { adminDb } from './_admin.mjs';
import { restoreProject, backupChecksums } from '../js/data/backup.js';

const [file, pid, newPid, flag] = process.argv.slice(2);
if (!file || !pid || !newPid) { console.error('Dùng: node scripts/restore.mjs <file.json> <mã-gốc> <mã-mới> [--yes]'); process.exit(2); }
const all = JSON.parse(readFileSync(file, 'utf8'));
const backup = all.projects ? all.projects.find(p => p.projectId === pid) : all;
if (!backup) { console.error(`Không thấy dự án ${pid} trong file. Có: ${(all.projects || []).map(p => p.projectId).join(', ')}`); process.exit(1); }
console.log('Tổng kiểm của bản sao lưu:', JSON.stringify(backupChecksums(backup)));
if (flag !== '--yes') { console.log('Chỉ xem trước. Thêm --yes để khôi phục vào', newPid); process.exit(0); }
const r = await restoreProject(adminDb(), backup, newPid);
console.log(`Đã khôi phục ${r.written} bản ghi vào dự án ${newPid}. Mở app, chọn dự án này và so tổng kiểm.`);
