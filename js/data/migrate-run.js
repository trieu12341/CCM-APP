/**
 * migrate-run.js — Chạy chuyển dữ liệu một dự án: ĐỌC cũ → GHI mới (theo lô) → KIỂM LẠI → mới đặt schemaVersion = 2.
 *  - Chạy thử (dryRun) không ghi gì.
 *  - Chạy lại nhiều lần không tạo bản ghi trùng: bản ghi đã có thì bỏ qua (giữ nguyên mã cũ làm mã bản ghi).
 *  - Không xóa mảng cũ. Chỉ đổi schemaVersion khi kiểm lại KHỚP hoàn toàn; sai lệch → dừng, giữ nguyên.
 * Nhận db / fieldValue từ ngoài → test được trên Firestore giả và Emulator thật.
 */
import { ENTITIES, stripMeta } from './repo.js';
import { planMigration, chunkWrites, plain, stable } from './migrate-plan.js';
import { checksums, compareChecksums } from './migrate-checks.js';

const projectRef = (db, pid) => db.collection('projects').doc(pid);

async function readLegacy(db, pid) {
    const snap = await projectRef(db, pid).get();
    return snap.exists ? snap.data() : null;
}

/** Bản ghi đang có trong cấu trúc mới: { entity: Map(id → dữ liệu) }. */
async function readNew(db, pid) {
    const out = {};
    for (const entity of ENTITIES) {
        const qs = await projectRef(db, pid).collection(entity).get();
        out[entity] = new Map(qs.docs.map(d => [d.id, d.data()]));
    }
    return out;
}

/** Chạy thử: lập kế hoạch + cho biết bao nhiêu bản ghi đã có sẵn ở cấu trúc mới. Không ghi gì. */
export async function dryRun(db, pid) {
    const doc = await readLegacy(db, pid);
    if (!doc) throw new Error(`Không thấy dự án ${pid}`);
    const plan = planMigration(doc, pid);
    const existing = await readNew(db, pid);
    const already = Object.fromEntries(ENTITIES.map(e => [e, plan.records[e].filter(r => existing[e].has(r.id)).length]));
    return { plan, already, schemaVersion: doc.schemaVersion || 1 };
}

/** Kiểm lại: đọc cấu trúc mới, so từng bản ghi và tổng kiểm với kế hoạch. */
export async function verifyMigration(db, pid, plan) {
    const now = await readNew(db, pid);
    const missing = [], different = [], extra = [];
    for (const entity of ENTITIES) {
        for (const r of plan.records[entity]) {
            const got = now[entity].get(r.id);
            if (!got) { missing.push(`${entity}/${r.id}`); continue; }
            if (stable(stripMeta(got)) !== stable(r.data)) different.push(`${entity}/${r.id}`);
        }
        const planned = new Set(plan.records[entity].map(r => r.id));
        for (const id of now[entity].keys()) if (!planned.has(id)) extra.push(`${entity}/${id}`);
    }
    // Tổng kiểm chỉ tính các bản ghi có trong kế hoạch (bản ghi tạo thêm sau này chỉ được liệt kê ở "extra")
    const flat = (entity) => plan.records[entity].filter(r => now[entity].has(r.id))
        .map(r => ({ ...plain(entity, { id: r.id, data: stripMeta(now[entity].get(r.id)) }), deleted: !!now[entity].get(r.id).deleted }));
    const after = checksums(Object.fromEntries(ENTITIES.map(e => [e, flat(e)])));
    const rows = compareChecksums(plan.checksums, after);
    return { ok: !missing.length && !different.length && rows.every(r => r.ok), rows, missing, different, extra };
}

/**
 * Chạy thật. onProgress({entity, done, total}) để hiện thanh tiến độ.
 * @returns {{plan, written, skipped, verify, flipped}}
 */
export async function runMigration({ db, fieldValue, user, pid, onProgress = () => {} }) {
    const doc = await readLegacy(db, pid);
    if (!doc) throw new Error(`Không thấy dự án ${pid}`);
    const plan = planMigration(doc, pid);
    if (plan.blocking) throw new Error('Còn lỗi chặn trong kết quả chạy thử — sửa trước khi chạy thật');

    const ts = () => fieldValue.serverTimestamp();
    const existing = await readNew(db, pid);
    let written = 0, skipped = 0;
    for (const entity of ENTITIES) {
        const todo = plan.records[entity].filter(r => !existing[entity].has(r.id));
        skipped += plan.records[entity].length - todo.length;
        let done = 0;
        for (const chunk of chunkWrites(todo)) {
            const batch = db.batch();
            for (const r of chunk) {
                batch.set(projectRef(db, pid).collection(entity).doc(r.id), {
                    ...r.data, _v: 1, deleted: false,
                    createdAt: ts(), createdBy: user.uid, updatedAt: ts(), updatedBy: user.uid,
                });
            }
            await batch.commit();
            done += chunk.length; written += chunk.length;
            onProgress({ entity, done, total: todo.length });
        }
    }

    const verify = await verifyMigration(db, pid, plan);
    let flipped = false;
    if (verify.ok) {
        if (written > 0) {
            await projectRef(db, pid).collection('audit').doc().set({
                at: ts(), uid: user.uid, name: user.name || user.uid, entity: 'project', entityId: pid, action: 'migrate',
                changes: ENTITIES.filter(e => plan.counts[e]).map(e => ({ field: e, from: 0, to: plan.counts[e] })),
                reason: 'Chuyển dữ liệu sang cấu trúc mới',
            });
        }
        await projectRef(db, pid).set({ schemaVersion: 2, migratedAt: ts(), migratedBy: user.uid }, { merge: true });
        flipped = true;
    }
    return { plan, written, skipped, verify, flipped };
}
