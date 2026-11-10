// Cờ bật/tắt tính năng. App dùng nội bộ phòng QS để QUẢN LÝ — chứng từ do tư vấn/nhà thầu lập — nên các tính năng dưới đây
// đang ẩn (code giữ nguyên, bật lại bằng cách đổi true). Mở app với ?features=all để bật hết tạm thời (dùng cho test).
export const FEATURES = {
    ipcPrint: false,        // nút In / PDF chứng chỉ IPC (2.7)
    ipcXlsx: false,         // nút Xuất CERT ra Excel theo mẫu (2.6)
    costReport: false,      // tab Báo cáo chi phí (3.2–3.3)
    projectMembers: false,  // bảng Thành viên dự án trong trang Admin (2.1)
};

const allOn = () => {
    try { if (new URLSearchParams(location.search).get('features') === 'all') return true; } catch (_) { /* không có location (Node) */ }
    try { return localStorage.getItem('ccm_features') === 'all'; } catch (_) { return false; }
};

export const featureOn = (name) => FEATURES[name] === true || allOn();

const UI = {
    ipcPrint: ['btn-print-ipc'],
    ipcXlsx: ['btn-xlsx-ipc'],
    costReport: ['menu-cost-report', 'module-cost-report'],
    projectMembers: ['members-card'],
};

/** Ẩn phần giao diện của tính năng đang tắt (gọi lại an toàn nhiều lần). */
export function applyFeatureFlags(doc = document) {
    for (const [name, ids] of Object.entries(UI)) {
        if (featureOn(name)) continue;
        ids.forEach(id => { const el = doc.getElementById(id); if (el) { el.hidden = true; el.classList.add('hidden'); el.dataset.featureOff = name; } });
    }
}
