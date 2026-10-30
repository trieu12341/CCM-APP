// Dựng dự án ĐÃ CHUYỂN (schemaVersion 2) trong "máy chủ" giả: mảng cũ vẫn còn trong projects/{pid}, bản ghi mới ở subcollection.
import { planMigration } from '../../../js/data/migrate-plan.js';
import { makeLegacyProject } from '../../data/support/legacy-fixture.js';

export function seedV2(be, pid = 'P001', opts = { ipcs: 4, vos: 6, cashflows: 8 }) {
    const doc = makeLegacyProject(pid, opts);
    const plan = planMigration(doc, pid);
    for (const entity of ['payments', 'variations']) {
        for (const r of plan.records[entity]) {
            be.DB[`projects/${pid}/${entity}/${r.id}`] = { ...r.data, _v: 1, deleted: false, createdBy: 'seed', createdAt: '2026-01-01', updatedBy: 'seed', updatedAt: '2026-01-01' };
        }
    }
    be.DB[`projects/${pid}`] = { ...doc, schemaVersion: 2 };
    return be;
}
export const auditOf = (be, pid = 'P001') => Object.entries(be.DB).filter(([k]) => k.startsWith(`projects/${pid}/audit/`)).map(([, v]) => v);
