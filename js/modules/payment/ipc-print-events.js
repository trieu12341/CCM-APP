// Nút "In / PDF" ở chi tiết IPC: mở trang in A4 trong cửa sổ mới (bước 2.7).
import { state } from '../../app.js';
import { getIPCById } from './payment-state.js';
import { contractIPCs, ipcCode, periodLabel } from './ipc-chain.js';
import { isApprovedIPC } from './payment-metrics.js';
import { withPreviousAmounts } from './ui/payment-layer3-ui.js';
import { buildIPCPrintHtml } from './ipc-print.js';
import { showToast } from './payment-nav.js';

export function printIPCHtml(ipcId) {
    const ipc = getIPCById(ipcId);
    if (!ipc) throw new Error('Không tìm thấy IPC');
    const contract = (state.appData.Contracts || []).find(c => c.contract_id === ipc.contract_id) || {};
    const project = (state.appData.Projects || []).find(p => p.project_id === (ipc.project_id || state.currentProjectId)) || {};
    const all = contractIPCs(state.appData.Payments || [], ipc.contract_id);
    return buildIPCPrintHtml({
        ipc, contract, project, lines: withPreviousAmounts(ipc, all),
        draft: !isApprovedIPC(ipc), code: ipcCode(ipc), period: periodLabel(ipc),
        signers: { qs: { name: ipc.updatedByName || state.user?.name || '', date: ipc.submission_date } },
    });
}

export function setupIPCPrint() {
    document.getElementById('btn-print-ipc')?.addEventListener('click', () => {
        const ipcId = document.getElementById('payment-detail-workspace')?.dataset.currentIpcId;
        let html;
        try { html = printIPCHtml(ipcId); } catch (e) { showToast(e.message, 'error'); return; }
        const w = window.open('', '_blank');
        if (!w) { showToast('Trình duyệt chặn cửa sổ mới — hãy cho phép cửa sổ bật lên rồi bấm lại.', 'error'); return; }
        w.document.open(); w.document.write(html); w.document.close();
    });
}
