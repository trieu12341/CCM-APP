/**
 * project-sync.js — Đồng bộ IPC và VO của MỘT dự án (schemaVersion 2) qua repo.js. Không dùng DOM/biến toàn cục
 * → test được bằng Node. Giữ "bản gốc" (records kèm _v) từng loại; commit() so với bản gốc rồi ghi MỘT giao dịch.
 *
 *  - Các lần lưu xếp hàng nối tiếp, nên lưu liên tiếp (sửa IPC rồi tính lại chuỗi) không tự xung đột với chính mình.
 *  - Lưu hỏng (xung đột, mất quyền, mất mạng): KHÔNG ghi gì, đọc lại bản server làm chuẩn, báo qua onError.
 */
import { planOps, applyResult } from './entity-diff.js';
import { ConflictError } from './repo.js';

export const SYNCED = [
    { entity: 'payments', idKey: 'ipc_id', label: 'IPC' },
    { entity: 'variations', idKey: 'vo_id', label: 'VO' },
];

export function createProjectSync({ repo, pid, onChange = () => {}, onError = () => {}, onStatus = () => {} }) {
    const cfg = Object.fromEntries(SYNCED.map(c => [c.entity, c]));
    const baseline = { payments: [], variations: [] };
    const unsubs = [];
    let tail = Promise.resolve(), pending = 0, stopped = false;

    const setBase = (entity, list) => { baseline[entity] = list; onChange(entity, list); };
    const status = () => onStatus(pending > 0 ? 'saving' : 'saved');

    async function refresh(entity) {
        setBase(entity, await repo.list(entity, pid));
    }

    async function run(entity, next) {
        const { idKey, label } = cfg[entity];
        const base = baseline[entity];
        if (!next.length && base.length > 1) throw new Error(`Từ chối lưu: danh sách ${label} trống nhưng đang có ${base.length} hồ sơ (nghi mất dữ liệu).`);
        const { ops } = planOps(entity, idKey, base, next);
        if (!ops.length) return { ok: true, written: 0 };
        const results = await repo.saveMany(pid, ops);
        baseline[entity] = applyResult(entity, idKey, baseline[entity], ops, results);
        return { ok: true, written: ops.length };
    }

    /** next = các hồ sơ CỦA DỰ ÁN NÀY (đã lọc theo project_id). Luôn resolve; lỗi báo qua onError. */
    function commit(entity, next) {
        if (stopped || !cfg[entity]) return Promise.resolve({ ok: false, error: new Error('Đồng bộ đã dừng') });
        pending++; status();
        const job = tail.then(() => run(entity, next));
        const settled = job.catch(async (error) => {
            onError(error, { entity, conflict: error instanceof ConflictError });
            try { await refresh(entity); } catch (_) { /* mất mạng: giữ nguyên bản gốc */ }
            return { ok: false, error };
        }).then((r) => { pending--; status(); return r; });
        tail = settled;
        return settled;
    }

    function start() {
        SYNCED.forEach(({ entity }) => unsubs.push(repo.subscribe(entity, pid, (list) => setBase(entity, list))));
    }
    function stop() { stopped = true; unsubs.splice(0).forEach(u => { try { u(); } catch (_) {} }); }

    return { start, stop, commit, baseline: (entity) => baseline[entity], whenIdle: () => tail };
}
