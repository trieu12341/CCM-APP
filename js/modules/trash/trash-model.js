/**
 * trash-model.js — Dữ liệu cho màn Thùng rác (thuần, test bằng Node): gom hồ sơ đã xóa mềm của mọi loại,
 * kèm người xóa, ngày xóa, số ngày còn lại (giữ tối thiểu 30 ngày).
 */
import { ID_KEY, LABEL } from '../../data/migrate-plan.js';
import { ENTITIES } from '../../data/repo.js';

export const KEEP_DAYS = 30;
const toDate = (v) => (v?.toDate ? v.toDate() : v instanceof Date ? v : v ? new Date(v) : null);

/** Mô tả ngắn để người dùng nhận ra hồ sơ. */
export function summaryOf(entity, r) {
    const pick = r.package_name || r.packageName || r.name || r.contractor || r.contractor_name || r.title || r.description || r.category || '';
    const money = r.approved_amount ?? r.claimed_amount ?? r.original_value ?? r.budgeted ?? r.value;
    return [pick, money !== undefined && money !== null && money !== '' ? Number(money).toLocaleString('de-DE') : ''].filter(Boolean).join(' · ');
}

/** @param {{[entity]: object[]}} byEntity  hồ sơ (cả đã xóa) theo loại → các dòng của bảng, mới xóa nhất lên đầu */
export function trashRows(byEntity, now = new Date()) {
    const rows = [];
    for (const e of ENTITIES) {
        for (const r of byEntity[e] || []) {
            if (!r.deleted) continue;
            const at = toDate(r.deletedAt);
            const age = at ? Math.floor((now - at) / 86_400_000) : 0;
            rows.push({ entity: e, id: r.id, _v: r._v, type: LABEL[e], code: r[ID_KEY[e]] ?? r.id, summary: summaryOf(e, r),
                by: r.updatedByName || r.deletedBy || '', at, daysLeft: Math.max(0, KEEP_DAYS - age) });
        }
    }
    return rows.sort((a, b) => (b.at?.getTime() || 0) - (a.at?.getTime() || 0));
}
