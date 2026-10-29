/**
 * migrate-events.js — Trang admin "Chuyển dữ liệu": chọn dự án → Chạy thử → (gõ mã dự án) Chạy thật → kiểm lại.
 * Logic nằm ở js/data/migrate-*.js (thuần, đã test); file này chỉ nối giao diện.
 */
import { db, FIREBASE_ENV } from '../../firebase-config.js';
import { state } from '../../app.js';
import { dryRun, runMigration } from '../../data/migrate-run.js';
import { compareChecksums } from '../../data/migrate-checks.js';
import { runGate } from '../../data/migrate-gate.js';
import { escapeHtml } from '../../utils/formatters.js';
import { countsHtml, issuesHtml, checksHtml, resultHtml } from './migrate-view.js';

const $ = (id) => document.getElementById(id);
let bound = false;
let lastDry = null;   // kết quả chạy thử của dự án đang chọn

const pid = () => $('mg-project')?.value || '';
const setBusy = (on) => { ['mg-dry', 'mg-run', 'mg-project'].forEach(id => { if ($(id)) $(id).disabled = on; }); if (!on) updateGate(); };

function updateGate() {
    const g = runGate({ env: FIREBASE_ENV, isAdmin: state.user?.role === 'admin', dryRan: !!lastDry, blocking: !!lastDry?.plan.blocking, typed: $('mg-confirm').value, pid: pid() });
    $('mg-run').disabled = !g.ok;
    $('mg-gate').textContent = g.ok ? '' : g.reason;
}

function resetOutputs() {
    lastDry = null;
    ['mg-dry-out', 'mg-run-box'].forEach(id => $(id).classList.add('hidden'));
    ['mg-result', 'mg-checks-after', 'mg-progress-text'].forEach(id => { $(id).innerHTML = ''; });
    $('mg-confirm').value = '';
}

async function onDry() {
    resetOutputs(); setBusy(true);
    try {
        lastDry = await dryRun(db, pid());
        const { plan, already } = lastDry;
        $('mg-counts').innerHTML = countsHtml(plan, already);
        $('mg-issues').innerHTML = issuesHtml(plan.issues);
        $('mg-checks-before').innerHTML = checksHtml(compareChecksums(plan.checksums, {}));
        $('mg-pid-hint').textContent = pid();
        $('mg-dry-out').classList.remove('hidden'); $('mg-run-box').classList.remove('hidden');
    } catch (e) {
        $('mg-result').innerHTML = `<p class="text-danger">Chạy thử thất bại: ${escapeHtml(String(e.message || e).slice(0, 200))}</p>`;
    } finally { setBusy(false); }
}

async function onRun() {
    setBusy(true);
    const bar = $('mg-progress'); bar.classList.remove('hidden');
    try {
        const user = { uid: state.user.uid, name: state.user.name };
        const r = await runMigration({
            db, fieldValue: firebase.firestore.FieldValue, user, pid: pid(),
            onProgress: ({ entity, done, total }) => { bar.value = total ? Math.round(done / total * 100) : 100; $('mg-progress-text').textContent = `Đang ghi ${entity}: ${done}/${total}`; },
        });
        $('mg-result').innerHTML = resultHtml(r);
        $('mg-checks-after').innerHTML = checksHtml(r.verify.rows);
        $('mg-progress-text').textContent = '';
    } catch (e) {
        $('mg-result').innerHTML = `<p class="text-danger">Chạy thật dừng giữa chừng: ${escapeHtml(String(e.message || e).slice(0, 200))}. Dữ liệu cũ vẫn nguyên; bấm Chạy thử rồi Chạy thật để làm tiếp (bản ghi đã ghi sẽ được bỏ qua).</p>`;
    } finally { bar.classList.add('hidden'); setBusy(false); }
}

/** Gọi mỗi lần mở trang. */
export function initMigratePage() {
    if (!$('module-migrate')) return;
    $('mg-env').textContent = FIREBASE_ENV === 'staging' ? 'STAGING' : 'BẢN THẬT';
    const sel = $('mg-project');
    const keep = sel.value || state.currentProjectId;
    sel.innerHTML = (state.appData.Projects || []).map(p => `<option value="${escapeHtml(p.project_id)}">${escapeHtml(p.project_id)} — ${escapeHtml(p.project_name || p.name || '')}</option>`).join('');
    if (keep) sel.value = keep;
    resetOutputs();
    if (!bound) {
        bound = true;
        $('mg-dry').addEventListener('click', onDry);
        $('mg-run').addEventListener('click', onRun);
        $('mg-confirm').addEventListener('input', updateGate);
        sel.addEventListener('change', resetOutputs);
    }
    updateGate();
}
