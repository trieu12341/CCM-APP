/**
 * v2-sync.js — Nối project-sync.js vào app: với dự án schemaVersion 2, IPC và VO đọc/ghi từng hồ sơ qua repo.js
 * (kèm _v chống ghi đè + nhật ký); dự án chưa chuyển vẫn chạy đường cũ (mảng trong projects/{pid}).
 */
import { state } from '../app.js';
import { db, FIREBASE_ENV } from '../firebase-config.js';
import { createRepo } from '../data/repo.js';
import { createAuditWriter } from '../data/audit.js';
import { createProjectSync, SYNCED } from '../data/project-sync.js';
import { notifyCloudError } from '../utils/notify.js';

const STATE_KEY = { payments: 'Payments', variations: 'Variations' };
const EVENT = { payments: 'paymentsChanged', variations: 'variationsChanged' };
let sync = null, syncPid = null;

export const isV2 = (pid) => !!sync && syncPid === pid && !!pid;

function onChange(pid, entity, list) {
    if (state.currentProjectId !== pid) return;
    const key = STATE_KEY[entity];
    const others = (state.appData[key] || []).filter(x => x && x.project_id !== pid);
    state.appData[key] = [...others, ...list];
    document.dispatchEvent(new Event(EVENT[entity]));
    import('./sidebar-nav.js').then(m => m.refreshActiveView());
    import('../budget.js').then(m => { try { m.renderDashboard(); } catch (_) {} });
}

function onError(error, { conflict }) {
    (conflict ? console.warn : console.error)('Lưu IPC/VO thất bại:', error);
    notifyCloudError(conflict
        ? 'Hồ sơ vừa được người khác sửa — đã tải lại bản mới nhất, thay đổi của bạn chưa được lưu. Hãy kiểm tra rồi nhập lại.'
        : `Không lưu được: ${String(error?.message || error).slice(0, 160)}`);
}

export function ensureV2(pid) {
    if (syncPid === pid && sync) return;
    stopV2();
    const user = { uid: state.user?.uid, name: state.user?.name || state.user?.email };
    if (!user.uid) return;
    const fieldValue = firebase.firestore.FieldValue;
    const repo = createRepo({ db, fieldValue, user, onWrite: createAuditWriter({ db, fieldValue, user }) });
    sync = createProjectSync({ repo, pid, onChange: (e, l) => onChange(pid, e, l), onError });
    syncPid = pid;
    sync.start();
}

export function stopV2() { if (sync) sync.stop(); sync = null; syncPid = null; }

/** Lưu mảng đầy đủ (mọi dự án) của một loại; chỉ phần của dự án hiện tại được ghi. */
export function commitV2(entity, fullList) {
    const pid = syncPid;
    const mine = (fullList || []).filter(x => x && x.project_id === pid);
    return sync.commit(entity, mine);
}

/** Dải báo ở dự án chưa chuyển. Chỉ hiện ở staging: bản thật chưa mở chuyển dữ liệu (xem migrate-gate.js). */
export function showLegacyBanner(show) {
    let el = document.getElementById('legacy-banner');
    if (!show || FIREBASE_ENV !== 'staging') { if (el) el.hidden = true; return; }
    if (!el) {
        el = document.createElement('div'); el.id = 'legacy-banner'; el.className = 'legacy-banner';
        el.textContent = 'Cần chuyển dữ liệu: dự án này còn lưu kiểu cũ (IPC, VO chưa có chống ghi đè và nhật ký). Admin vào mục "Chuyển dữ liệu" để chuyển.';
        document.body.appendChild(el);
    }
    el.hidden = false;
}
export { SYNCED };
