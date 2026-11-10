// Khóa số IPC (bước 2.3, bản cho phòng QS tự dùng) — hàm thuần.
// IPC Đã duyệt / Đã thanh toán = đã chốt: không sửa, chuỗi tính lại không đụng tới số của nó.
// Muốn sửa: Mở khóa (bắt buộc lý do) → về Nháp. IPC đã chốt phía sau bị lệch số kỳ trước → "cần xem lại".
import { contractIPCs, isLockedIPC, buildConstructionIPC } from './ipc-chain.js';

const TOL = 1;   // lệch làm tròn ≤ 1 đồng không tính

/**
 * Các IPC đã chốt của hợp đồng có số "đã xác nhận kỳ trước" (11) không còn khớp với các kỳ trước hiện tại
 * (thường vì một kỳ trước đã được mở khóa và sửa). Trả về [{ ipc_id, stored, expected, diff }].
 */
export function staleLockedIPCs(payments, contract, approvedVariations = 0) {
    const out = [], done = [];
    for (const ipc of contractIPCs(payments, contract.contract_id)) {
        if (ipc.engine_version >= 2 && isLockedIPC(ipc) && ipc.computed && done.length) {
            const fresh = buildConstructionIPC({ contract, input: ipc, previousIPCs: done, approvedVariations }).computed;
            const stored = Number(ipc.computed.previousCertified) || 0, expected = Number(fresh?.previousCertified) || 0;
            if (Math.abs(stored - expected) > TOL) out.push({ ipc_id: ipc.ipc_id, stored, expected, diff: expected - stored });
        }
        done.push(ipc);
    }
    return out;
}

/** Thay đổi để mở khóa một IPC: về Nháp, ghi lý do + trạng thái cũ (nhật ký ghi lại toàn bộ). Ném lỗi nếu thiếu lý do. */
export function unlockPatch(ipc, reason, who, now = new Date()) {
    const r = String(reason || '').trim();
    if (!isLockedIPC(ipc)) throw new Error('IPC này chưa chốt — không cần mở khóa');
    if (r.length < 5) throw new Error('Bắt buộc ghi lý do mở khóa (ít nhất 5 ký tự)');
    return { status: 'Draft', last_unlock: { at: now.toISOString(), by: who || '', reason: r, from_status: ipc.status } };
}
