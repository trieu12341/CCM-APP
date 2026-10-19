/**
 * project-merge.js — Gộp danh sách dự án tải từ cloud với bản đang có trong
 * trình duyệt. Thuần (không DOM, không Firebase) → test được bằng Node.
 *
 * Bối cảnh: bản cũ của app lưu lên cloud nhầm trường tên (projectName rỗng),
 * nên tên thật của dự án chỉ còn trong localStorage của máy đã tạo dự án.
 * Nếu ghi đè thẳng bằng danh sách cloud, tên thật sẽ mất. Hàm này:
 *   - giữ tên/thông tin thật từ bản cục bộ khi cloud thiếu,
 *   - giữ dự án chỉ có ở máy này (chưa từng lên cloud),
 *   - báo needsCloudSave để app tự vá ngược dữ liệu lên cloud.
 */

const FIELDS = ['location', 'start_date', 'end_date', 'total_budget', 'contingency_budget', 'status'];

const realName = (p) => {
    const n = String(p?.project_name || p?.name || '').trim();
    return n && n !== String(p?.project_id || '') ? n : '';
};
const isEmpty = (v) => v === undefined || v === null || v === '' || v === 0;

/**
 * @param {Array} cloud  danh sách dự án đọc từ Firestore
 * @param {Array} local  danh sách dự án trong localStorage
 * @returns {{ merged: Array, needsCloudSave: boolean }}
 */
export function mergeProjectLists(cloud = [], local = []) {
    const localById = new Map((local || []).filter(p => p && p.project_id).map(p => [p.project_id, p]));
    let needsCloudSave = false;

    const merged = (cloud || []).filter(p => p && p.project_id).map(c => {
        const l = localById.get(c.project_id);
        const out = { ...c };
        const name = realName(c) || realName(l) || c.project_id;
        if (name !== (c.project_name || c.name)) needsCloudSave = true;
        out.project_name = name;
        out.name = name;
        if (l) {
            for (const f of FIELDS) {
                if (isEmpty(out[f]) && !isEmpty(l[f])) { out[f] = l[f]; needsCloudSave = true; }
            }
        }
        out.id = out.id || out.project_id;
        return out;
    });

    const cloudIds = new Set(merged.map(p => p.project_id));
    for (const l of localById.values()) {
        if (!cloudIds.has(l.project_id)) {
            const name = realName(l) || l.project_id;
            merged.push({ ...l, id: l.id || l.project_id, project_name: name, name });
            needsCloudSave = true;
        }
    }
    return { merged, needsCloudSave };
}

/**
 * Gộp một loại dữ liệu (budgets, payments, final_statements…) của MỘT dự án
 * nhận từ cloud vào mảng toàn cục.
 *  - cloudArr là mảng (kể cả rỗng) → cloud là nguồn chuẩn, thay phần của dự án.
 *  - cloudArr chưa từng tồn tại (undefined/null — hồ sơ tạo từ bản cũ chưa có
 *    trường này) → GIỮ bản trong máy, và báo cần đẩy lên cloud.
 * @returns {{ merged: Array, pushLocal: Array|null }}
 */
export function mergeProjectField(globalArr = [], cloudArr, projectId) {
    const all = Array.isArray(globalArr) ? globalArr : [];
    if (!Array.isArray(cloudArr)) {
        const mine = all.filter(i => i && i.project_id === projectId);
        return { merged: all, pushLocal: mine.length ? mine : null };
    }
    return { merged: [...all.filter(i => !i || i.project_id !== projectId), ...cloudArr], pushLocal: null };
}

/**
 * Bổ sung project_id còn thiếu (VO tạo từ bản cũ không gán project_id → không
 * lên được cloud, bị lọc khỏi thống kê dự án). Lấy theo hợp đồng của bản ghi.
 * @returns {{ items: Array, fixed: number }}
 */
export function backfillProjectIds(items = [], contracts = []) {
    const pidOf = new Map((contracts || []).map(c => [c.contract_id, c.project_id]));
    let fixed = 0;
    const out = (items || []).map(it => {
        if (!it || it.project_id) return it;
        const pid = pidOf.get(it.contract_id);
        if (!pid) return it;
        fixed++;
        return { ...it, project_id: pid };
    });
    return { items: out, fixed };
}

/** Mã VO kế tiếp, không trùng kể cả sau khi xóa: VO-07 → VO-08. */
export function nextVOId(variations = []) {
    const nums = (variations || []).map(v => parseInt((String(v?.vo_id || '').match(/^VO-?(\d+)/i) || [])[1], 10) || 0);
    return 'VO-' + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(2, '0');
}

/** Gộp 2 danh sách theo khóa, bản `preferred` thắng khi trùng khóa. */
export function unionByKey(base = [], preferred = [], key = 'vo_id') {
    const m = new Map();
    (base || []).forEach(x => x && m.set(x[key], x));
    (preferred || []).forEach(x => x && m.set(x[key], x));
    return [...m.values()];
}
