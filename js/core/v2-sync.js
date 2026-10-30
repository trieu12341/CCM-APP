/**
 * v2-sync.js — Nối project-sync.js vào app: với dự án schemaVersion 2, mọi hồ sơ đọc/ghi từng hồ sơ qua repo.js
 * (kèm _v chống ghi đè + nhật ký); dự án chưa chuyển vẫn chạy đường cũ (mảng trong projects/{pid}).
 */
import { state } from '../app.js';
import { db, FIREBASE_ENV } from '../firebase-config.js';
import { createRepo } from '../data/repo.js';
import { createAuditWriter } from '../data/audit.js';
import { createProjectSync, SYNCED } from '../data/project-sync.js';
import { showConflictDialog } from './conflict-dialog.js';
import { notifyCloudError } from '../utils/notify.js';
import { ID_KEY } from '../data/migrate-plan.js';
import { normalizeContracts } from './contract-fields.js';

export const STATE_KEY = { budgets: 'Budgets', tenders: 'Tenders', contracts: 'Contracts', payments: 'Payments', variations: 'Variations', cashflows: 'Cashflow', finals: 'Final_Statements' };
const EVENTS = { budgets: ['budgetsChanged'], tenders: ['tendersChanged'], contracts: ['contractsChanged'], payments: ['paymentsChanged'],
    variations: ['variationsChanged'], cashflows: ['cashflowsChanged', 'cashflowChanged'], finals: ['finalChanged'] };
let sync = null, syncPid = null, netBound = false;

export const isV2 = (pid) => !!sync && syncPid === pid && !!pid;

function onChange(pid, entity, list) {
    if (state.currentProjectId !== pid) return;
    const key = STATE_KEY[entity];
    const idKey = ID_KEY[entity], inList = new Set(list.map(r => String(r[idKey])));
    const others = (state.appData[key] || []).filter(x => x && x.project_id !== pid && !inList.has(String(x[idKey])));
    const merged = [...others, ...list];
    state.appData[key] = entity === 'contracts' ? normalizeContracts(merged) : merged;
    EVENTS[entity].forEach(n => document.dispatchEvent(new Event(n)));
    import('./sidebar-nav.js').then(m => m.refreshActiveView());
    import('../budget.js').then(m => { try { m.renderDashboard(); } catch (_) {} });
}

const BADGE = { saved: ['Đã lưu', 'fa-circle-check'], saving: ['Đang lưu…', 'fa-spinner fa-spin'], pending: ['Chờ đồng bộ', 'fa-cloud-arrow-up'], error: ['Lỗi lưu', 'fa-triangle-exclamation'] };
function setBadge(status) {
    const el = document.getElementById('sync-badge');
    if (!el) return;
    el.hidden = !status;
    if (!status) return;
    el.dataset.state = status;
    el.innerHTML = `<i class="fa-solid ${BADGE[status][1]}"></i> ${BADGE[status][0]}`;
}

function onError(error, { conflict, conflicts }) {
    if (conflict && conflicts?.length) { showConflictDialog(conflicts, { onClose: () => sync && sync.clearError() }); return; }
    (conflict ? console.warn : console.error)('Lưu hồ sơ thất bại:', error);
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
    sync = createProjectSync({ repo, pid, isOnline: () => navigator.onLine !== false, onChange: (e, l) => onChange(pid, e, l), onError, onStatus: setBadge });
    setBadge('saved');
    if (!netBound) { netBound = true; ['online', 'offline'].forEach(ev => window.addEventListener(ev, () => sync && setBadge(sync.status()))); }
    syncPid = pid;
    sync.start();
}

/** Gọi khi người dùng MỞ form sửa một hồ sơ: ghi nhớ _v lúc mở để phát hiện người khác lưu trong lúc form đang mở. */
export function markOpened(entity, idValue) { if (sync) sync.markOpened(entity, idValue); }

export function stopV2() { if (sync) sync.stop(); sync = null; syncPid = null; setBadge(null); }

/** Lưu mảng đầy đủ (mọi dự án) của một loại; chỉ phần của dự án hiện tại được ghi. */
export function commitV2(entity, fullList) {
    const pid = syncPid;
    const mine = (fullList || []).filter(x => sync.owns(entity, x) || (x && x.project_id === pid));
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
