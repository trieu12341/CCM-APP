/**
 * project-sync.js — Đồng bộ mọi hồ sơ (ngân sách, gói thầu, HĐ, IPC, VO, dòng tiền, quyết toán) của MỘT dự án
 * (schemaVersion 2) qua repo.js. Không dùng DOM/biến toàn cục → test được bằng Node. Giữ "bản gốc" (kèm _v) từng loại;
 * commit() so với bản gốc rồi ghi MỘT lần.
 *
 *  - Có mạng: giao dịch (đọc-kiểm _v-ghi) → xung đột báo NGAY. Mất mạng: BATCH xếp hàng, tự gửi khi có mạng;
 *    nếu lúc đó bản trên server đã đổi, rules từ chối → báo xung đột và tải lại bản server.
 *  - Các lần lưu xếp hàng nối tiếp, nên lưu liên tiếp không tự xung đột với chính mình.
 *  - Lưu hỏng: KHÔNG ghi gì, đọc lại bản server làm chuẩn, báo qua onError (kèm danh sách xung đột nếu có).
 *  - Trạng thái cho huy hiệu: saved | saving | pending (chờ đồng bộ, đang mất mạng) | error.
 */
import { planOps, applyResult } from './entity-diff.js';
import { ConflictError } from './repo.js';
import { ID_KEY, LABEL } from './migrate-plan.js';
import { findConflicts } from './conflicts.js';

export const SYNCED = ['budgets', 'tenders', 'contracts', 'payments', 'variations', 'cashflows', 'finals']
    .map(entity => ({ entity, idKey: ID_KEY[entity], label: LABEL[entity] }));

const OFFLINE_CODES = new Set(['unavailable', 'deadline-exceeded']);

export function createProjectSync({ repo, pid, isOnline = () => true, onChange = () => {}, onError = () => {}, onStatus = () => {} }) {
    const cfg = Object.fromEntries(SYNCED.map(c => [c.entity, c]));
    const baseline = Object.fromEntries(SYNCED.map(c => [c.entity, []]));
    const unsubs = [];
    const opened = new Map();   // `${entity}/${id}` → _v lúc người dùng MỞ form sửa (để phát hiện người khác lưu trong lúc form đang mở)
    let tail = Promise.resolve(), running = 0, inflight = 0, failed = false, stopped = false;

    const setBase = (entity, list) => { baseline[entity] = list; onChange(entity, list); };
    function status() {
        const s = failed ? 'error' : inflight > 0 && !isOnline() ? 'pending' : running + inflight > 0 ? 'saving' : 'saved';
        onStatus(s); return s;
    }

    function markOpened(entity, idValue) {
        const rec = baseline[entity]?.find(r => String(r[cfg[entity].idKey]) === String(idValue));
        if (rec) opened.set(`${entity}/${rec.id}`, rec._v);
    }

    async function refresh(entity) { setBase(entity, await repo.list(entity, pid)); }

    /** Lưu bị từ chối → đọc lại server, tìm hồ sơ xung đột, báo lỗi. */
    async function fail(entity, error, ops) {
        failed = true;
        let conflicts = [];
        try {
            const fresh = await repo.list(entity, pid, { includeDeleted: true });
            conflicts = findConflicts(ops, fresh, cfg[entity].idKey);
            setBase(entity, fresh.filter(r => !r.deleted));
            [...opened.keys()].filter(k => k.startsWith(`${entity}/`)).forEach(k => opened.delete(k));
        } catch (_) { /* mất mạng: giữ nguyên bản gốc */ }
        onError(error, { entity, conflict: error instanceof ConflictError || conflicts.length > 0, conflicts });
        status();
    }

    async function writeOnline(pidArg, ops) {
        try { return { results: await repo.saveMany(pidArg, ops) }; }
        catch (e) { if (OFFLINE_CODES.has(e?.code) && repo.writeBatch) return null; throw e; }   // mạng chập chờn → xếp hàng
    }

    async function run(entity, next) {
        const { idKey, label } = cfg[entity];
        const base = baseline[entity];
        if (!next.length && base.length > 1) throw new Error(`Từ chối lưu: danh sách ${label} trống nhưng đang có ${base.length} hồ sơ (nghi mất dữ liệu).`);
        const { ops } = planOps(entity, idKey, base, next);
        if (!ops.length) return { ok: true, written: 0 };
        // Sửa từ form đã mở trước đó: dùng _v lúc mở, KHÔNG dùng bản vừa nhận realtime (nếu không sẽ ghi đè mù thay đổi của người khác)
        for (const o of ops) if (o.kind !== 'create' && opened.has(`${entity}/${o.id}`)) o.expectedV = opened.get(`${entity}/${o.id}`);
        let res = null;
        try { res = isOnline() ? await writeOnline(pid, ops) : null; } catch (e) { e.ops = ops; throw e; }
        if (!res) {   // BATCH: áp dụng ngay trong máy, server nhận sau
            const { results, committed } = repo.writeBatch(pid, ops);
            inflight++; status();
            committed.then(() => { inflight--; status(); }, async (e) => { inflight--; await fail(entity, e, ops); });
            res = { results };
        }
        baseline[entity] = applyResult(entity, idKey, baseline[entity], ops, res.results);
        ops.forEach(o => opened.delete(`${entity}/${o.id}`));
        failed = false;
        return { ok: true, written: ops.length };
    }

    /** next = các hồ sơ CỦA DỰ ÁN NÀY (đã lọc theo project_id). Luôn resolve; lỗi báo qua onError. */
    function commit(entity, next) {
        if (stopped || !cfg[entity]) return Promise.resolve({ ok: false, error: new Error('Đồng bộ đã dừng') });
        running++; status();
        const job = tail.then(() => run(entity, next));
        const settled = job.catch(async (error) => {
            await fail(entity, error, error.ops || planOps(entity, cfg[entity].idKey, baseline[entity], next).ops);
            return { ok: false, error };
        }).then((r) => { running--; status(); return r; });
        tail = settled;
        return settled;
    }

    function start() {
        SYNCED.forEach(({ entity }) => unsubs.push(repo.subscribe(entity, pid, (list) => setBase(entity, list))));
    }
    function stop() { stopped = true; unsubs.splice(0).forEach(u => { try { u(); } catch (_) {} }); }

    /** Hồ sơ này thuộc dự án đang đồng bộ? (theo project_id, hoặc hồ sơ cũ thiếu project_id đã nằm sẵn trong bản gốc) */
    const owns = (entity, item) => !!item && (item.project_id === pid || (!item.project_id && baseline[entity].some(r => String(r[cfg[entity].idKey]) === String(item[cfg[entity].idKey]))));

    return { start, stop, commit, owns, status, markOpened, clearError: () => { failed = false; status(); }, baseline: (entity) => baseline[entity], whenIdle: () => tail };
}
