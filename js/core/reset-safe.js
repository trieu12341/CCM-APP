/**
 * reset-safe.js — Reset an toàn (thuần logic, tiêm phụ thuộc → test bằng Node):
 *  chỉ admin · phải gõ đúng TÊN DỰ ÁN · BẮT BUỘC tải xong bản sao lưu JSON trước khi xóa ·
 *  dự án đã chuyển (v2): xóa MỀM (vào Thùng rác, khôi phục được), không xóa thật.
 */
import { ENTITIES } from '../data/repo.js';
import { exportProject } from '../data/backup.js';

export const SCOPES = { payments: ['payments'], cashflow: ['cashflows'], contracts: ['contracts', 'tenders'], full: ENTITIES };

/** Các loại hồ sơ bị ảnh hưởng bởi những phạm vi đã chọn (không trùng). */
export const entitiesOf = (scopes) => [...new Set(scopes.flatMap(s => SCOPES[s] || []))];

export function checkReset({ isAdmin, projectName, typedName, scopes }) {
    if (!isAdmin) return 'Chỉ admin được Reset.';
    if (!scopes?.length) return 'Hãy chọn phạm vi cần xóa.';
    if (!projectName || typedName !== projectName) return 'Tên dự án gõ chưa đúng.';
    return null;
}

/**
 * @param {object} o
 * @param {object} o.db, o.repo, o.pid, o.projectName, o.typedName, o.isAdmin, o.scopes
 * @param {(backup:object, filename:string)=>Promise<void>|void} o.download  phải tải được file trước khi xóa
 * @param {boolean} o.v2  dự án đã chuyển → xóa mềm qua repo; ngược lại chỉ sao lưu rồi để nơi gọi xóa theo đường cũ
 */
export async function runSafeReset({ db, repo, pid, projectName, typedName, isAdmin, scopes, download, v2 }) {
    const problem = checkReset({ isAdmin, projectName, typedName, scopes });
    if (problem) throw new Error(problem);
    const backup = await exportProject(db, pid);
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    await download(backup, `CCM_Backup_${pid}_${stamp}.json`);   // lỗi tải → dừng, chưa xóa gì
    if (!v2) return { backedUp: true, deleted: 0, legacy: true };
    let deleted = 0;
    for (const entity of entitiesOf(scopes)) {
        const live = await repo.list(entity, pid);
        for (let i = 0; i < live.length; i += 200) {
            const ops = live.slice(i, i + 200).map(r => ({ entity, kind: 'delete', id: r.id, expectedV: r._v }));
            await repo.saveMany(pid, ops, { reason: 'Reset hệ thống (có bản sao lưu)' });
            deleted += ops.length;
        }
    }
    return { backedUp: true, deleted, legacy: false };
}
