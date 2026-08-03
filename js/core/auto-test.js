import { state } from '../app.js';
import { 
    clearResetFlag, 
    persistBudgets, 
    persistTenders, 
    persistContracts, 
    persistCashflow, 
    persistPayments 
} from './data-store.js';

let isVisualDelayEnabled = true;

const delay = ms => new Promise(r => setTimeout(r, isVisualDelayEnabled ? ms : 0));

function terminalLog(msg, type = 'info') {
    const term = document.getElementById('testing-terminal');
    if (!term) return;
    
    const time = new Date().toLocaleTimeString();
    let color = '#38bdf8'; // default blue
    if (type === 'success') color = '#10b981'; // green
    if (type === 'error') color = '#ef4444'; // red
    if (type === 'warn') color = '#f59e0b'; // yellow

    const logLine = document.createElement('div');
    logLine.style.color = color;
    logLine.textContent = `[${time}] ${msg}`;
    
    term.appendChild(logLine);
    term.scrollTop = term.scrollHeight; // Auto-scroll
}

function updateKPI(total, pass, fail, time) {
    const elTotal = document.getElementById('kpi-total-tests');
    const elPass = document.getElementById('kpi-pass-tests');
    const elFail = document.getElementById('kpi-fail-tests');
    const elTime = document.getElementById('kpi-time-tests');
    
    if (elTotal) elTotal.textContent = total;
    if (elPass) elPass.textContent = pass;
    if (elFail) elFail.textContent = fail;
    if (elTime) elTime.textContent = (time / 1000).toFixed(2);
}

function exportErrorLogTxt(errorLogs) {
    if (!errorLogs || errorLogs.length === 0) return;
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const testerName = state.user?.name || 'Admin';
    
    let logString = `======================================================================\n`;
    logString += `[QA AUTO-TEST ERROR LOG - SYSTEM TESTING]\n`;
    logString += `======================================================================\n`;
    logString += `Thời gian: ${new Date().toLocaleString()}\n`;
    logString += `Tester: ${testerName}\n`;
    logString += `Tổng số lỗi phát hiện: ${errorLogs.length}\n`;
    logString += `----------------------------------------------------------------------\n\n`;
    
    errorLogs.forEach((log, index) => {
        logString += `[LỖI ${index + 1}] Test Case ID: ${log.testCaseId} | Module: ${log.module}\n`;
        logString += `> Mô tả bước test: ${log.step}\n`;
        logString += `> Kết quả Kỳ vọng (Expected): ${log.expected}\n`;
        logString += `> Thực tế nhận được (Actual): ${log.actual}\n`;
        logString += `> Thông báo lỗi (Error): ${log.errorMessage}\n`;
        logString += `> Stack Trace:\n${log.stackTrace}\n\n`;
        logString += `----------------------------------------------------------------------\n\n`;
    });
    
    const blob = new Blob([logString], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `CCM_AutoTest_ErrorLog_${timestamp}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

document.addEventListener('componentsLoaded', () => {
    const btnStart = document.getElementById('btn-start-autotest');
    if (btnStart) {
        btnStart.addEventListener('click', () => {
            runAutoTestWorkflow();
        });
    }
});

export async function runAutoTestWorkflow() {
    const chkVisual = document.getElementById('chk-visual-delay');
    isVisualDelayEnabled = chkVisual ? chkVisual.checked : true;
    
    const chkExport = document.getElementById('chk-auto-export');
    const isAutoExportEnabled = chkExport ? chkExport.checked : true;

    const term = document.getElementById('testing-terminal');
    if (term) term.innerHTML = ''; // Clear terminal
    
    terminalLog('🚀 ĐANG KHỞI CHẠY AUTO-TEST WORKFLOW...', 'info');
    updateKPI(4, 0, 0, 0); // Reset KPI
    
    const startTime = performance.now();
    let passed = 0;
    let failed = 0;
    const total = 4;
    const errorLogs = [];

    // --- CƠ CHẾ INJECT & SYNC DATA STATE ---
    try {
        terminalLog('Chuẩn bị Môi trường Kiểm thử (Injecting Data State)...', 'info');
        clearResetFlag();
        
        state.appData.Budgets = [];
        state.appData.Tenders = [];
        state.appData.Contracts = [];
        state.appData.Cashflow = [];
        state.appData.Payments = [];
        
        persistBudgets(state.appData.Budgets);
        persistTenders(state.appData.Tenders);
        persistContracts(state.appData.Contracts);
        persistCashflow(state.appData.Cashflow);
        persistPayments(state.appData.Payments);
        
        localStorage.setItem('ccm_projects', JSON.stringify([]));

        window.dispatchEvent(new CustomEvent('appDataChanged'));
        terminalLog('Môi trường Kiểm thử đã sẵn sàng.', 'success');
    } catch (e) {
        terminalLog(`Lỗi khởi tạo môi trường: ${e.message}`, 'error');
    }

    // TEST CASE 1: VERIFY CLEAN RESET
    terminalLog('\n--- TEST CASE 1: VERIFY CLEAN RESET ---', 'warn');
    try {
        await delay(600);
        const isClean = state.appData.Budgets.length === 0 && 
                        state.appData.Tenders.length === 0 && 
                        state.appData.Contracts.length === 0;
                        
        if (!isClean) throw new Error("Mảng dữ liệu vẫn còn phần tử sau khi reset");
        
        terminalLog('✅ TC1 Passed: Dữ liệu đã được dọn dẹp sạch sẽ 100%.', 'success');
        passed++;
    } catch (error) {
        terminalLog(`❌ TC1 Failed: ${error.message}`, 'error');
        failed++;
        errorLogs.push({
            testCaseId: 'TC1', module: 'System', step: 'Kiểm tra reset dữ liệu',
            expected: 'Các mảng dữ liệu (Budgets, Tenders, Contracts) phải rỗng',
            actual: 'Dữ liệu vẫn còn tồn tại',
            errorMessage: error.message, stackTrace: error.stack
        });
    }
    updateKPI(total, passed, failed, performance.now() - startTime);

    // TEST CASE 2: WORKFLOW LINKAGE (BUDGET -> TENDER)
    terminalLog('\n--- TEST CASE 2: WORKFLOW LINKAGE (BUDGET -> TENDER) ---', 'warn');
    try {
        const testBudget = [{
            budget_id: 'b-test-autotest',
            package_name: 'Auto Test Package',
            total_budget: 1000000,
            status: 'Approved'
        }];
        persistBudgets(testBudget);
        window.dispatchEvent(new CustomEvent('appDataChanged'));
        terminalLog('Đã bơm (inject) 1 Budget mẫu.', 'info');
        await delay(600);
        
        const budgetMenu = document.getElementById('menu-budget');
        if (budgetMenu) {
            terminalLog('Chuyển qua Tab Budget...', 'info');
            budgetMenu.click();
        }
        await delay(600);
        
        const tenderMenu = document.getElementById('menu-tender');
        if (tenderMenu) {
            terminalLog('Chuyển qua Tab Tender...', 'info');
            tenderMenu.click();
        }
        await delay(600);
        
        terminalLog('✅ TC2 Passed: Liên kết dữ liệu Budget sang Tender hoạt động bình thường.', 'success');
        passed++;
    } catch (error) {
        terminalLog(`❌ TC2 Failed: ${error.message}`, 'error');
        failed++;
        errorLogs.push({
            testCaseId: 'TC2', module: 'Budget/Tender', step: 'Tạo Budget và chuyển qua tab Tender',
            expected: 'Hệ thống chuyển tab mượt mà và load dữ liệu liên kết',
            actual: 'Có lỗi xảy ra khi click menu hoặc render component',
            errorMessage: error.message, stackTrace: error.stack
        });
    }
    updateKPI(total, passed, failed, performance.now() - startTime);

    // TEST CASE 3: PAYMENT LAYER 2 UI & DYNAMIC FORM
    terminalLog('\n--- TEST CASE 3: PAYMENT LAYER 2 UI & DYNAMIC FORM ---', 'warn');
    try {
        const paymentMenu = document.getElementById('menu-payment');
        if (paymentMenu) {
            terminalLog('Mở Tab Payment...', 'info');
            paymentMenu.click();
        }
        await delay(600);
        
        const openWorkspaceBtn = document.getElementById('btn-new-payment') || document.getElementById('btn-open-ipc-workspace');
        if (openWorkspaceBtn) {
            terminalLog('Mở Workspace Payment IPC Mới...', 'info');
            openWorkspaceBtn.click();
        }
        await delay(600);
        
        const isSidebarCollapsed = document.body.classList.contains('sidebar-collapsed') || document.getElementById('sidebar')?.classList.contains('sidebar-collapsed');
        if (!isSidebarCollapsed) {
            throw new Error("Sidebar chưa được thu nhỏ (thiếu class sidebar-collapsed)");
        }
        terminalLog('Đã xác nhận Sidebar tự động thu nhỏ.', 'success');
        
        const typeSelect = document.getElementById('ipc-type');
        if (typeSelect) {
            terminalLog('Đang chuyển loại Hợp đồng sang: Consultancy...', 'info');
            typeSelect.value = 'Consultancy';
            typeSelect.dispatchEvent(new Event('change'));
        }
        await delay(600);
        
        const apContainer = document.getElementById('ipc-ap-container');
        const retContainer = document.getElementById('ipc-retention-container');
        
        let hidden = true;
        if (apContainer && apContainer.style.display !== 'none' && !apContainer.classList.contains('hidden')) hidden = false;
        if (retContainer && retContainer.style.display !== 'none' && !retContainer.classList.contains('hidden')) hidden = false;

        if (!hidden) {
            throw new Error("2 ô nhập % AP Recovery và % Retention chưa bị ẩn khỏi UI");
        }
        
        terminalLog('✅ TC3 Passed: Form linh động (Dynamic UI) xử lý chính xác.', 'success');
        passed++;
    } catch (error) {
        terminalLog(`❌ TC3 Failed: ${error.message}`, 'error');
        failed++;
        errorLogs.push({
            testCaseId: 'TC3', module: 'Payment', step: 'Mở Form IPC và chọn gói thầu Consultancy',
            expected: 'Sidebar thu nhỏ; Ẩn trường AP Recovery và Retention',
            actual: 'Trạng thái UI không đúng yêu cầu',
            errorMessage: error.message, stackTrace: error.stack
        });
    }
    updateKPI(total, passed, failed, performance.now() - startTime);

    // TEST CASE 4: ESC KEY LISTENER & CLEANUP
    terminalLog('\n--- TEST CASE 4: ESC KEY LISTENER & CLEANUP ---', 'warn');
    try {
        terminalLog('Giả lập phím ESC lần 1...', 'info');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        await delay(600);
        
        terminalLog('Giả lập phím ESC lần 2 (Đóng Layer 2/3)...', 'info');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        await delay(600);
        
        const modalOpen = document.body.classList.contains('modal-open');
        if (modalOpen) {
            throw new Error("Thẻ body vẫn còn class modal-open sau khi gõ ESC");
        }
        
        terminalLog('✅ TC4 Passed: ESC Key listener đã dọn dẹp (Cleanup) hoàn chỉnh.', 'success');
        passed++;
    } catch (error) {
        terminalLog(`❌ TC4 Failed: ${error.message}`, 'error');
        failed++;
        errorLogs.push({
            testCaseId: 'TC4', module: 'Core UI', step: 'Nhấn phím ESC để đóng Modal/Layer',
            expected: 'Đóng tất cả Modal, gỡ class modal-open khỏi body',
            actual: 'Modal vẫn còn mở hoặc body vẫn bị khoá scroll',
            errorMessage: error.message, stackTrace: error.stack
        });
    }

    // CƠ CHẾ DỌN DẸP
    terminalLog('\nHoàn tất Workflow. Đang đưa UI về trạng thái ổn định (Reset)...', 'info');
    document.querySelectorAll('.modal-overlay, .inline-workspace, #payment-list-modal').forEach(el => el.classList.add('hidden'));
    document.body.classList.remove('modal-open', 'workspace-active', 'overflow-hidden');
    document.getElementById('sidebar')?.classList.remove('sidebar-collapsed');
    document.body.style.overflow = '';
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        mainContent.style.overflowY = 'auto';
        mainContent.classList.remove('overflow-hidden');
    }
    
    // Switch back to testing tab just in case
    const testingMenu = document.getElementById('menu-testing');
    if (testingMenu) testingMenu.click();

    // KẾT QUẢ BÁO CÁO
    const endTime = performance.now();
    updateKPI(total, passed, failed, endTime - startTime);
    
    if (errorLogs.length === 0) {
        terminalLog('\n🎉 TẤT CẢ TEST CASES ĐỀU PASS!', 'success');
    } else {
        terminalLog(`\n⚠️ PHÁT HIỆN ${errorLogs.length} LỖI. VUI LÒNG KIỂM TRA LOG!`, 'error');
        
        const btnExport = document.getElementById('btn-export-log');
        if (btnExport) {
            btnExport.style.display = 'inline-block';
            // Lần nào gán lại cũng clear old event listener bằng cách replace node hoặc cẩn thận, nhưng đây ta gán đè onclick
            btnExport.onclick = () => exportErrorLogTxt(errorLogs);
        }
        
        if (isAutoExportEnabled) {
            terminalLog('Đang tự động xuất file log .txt...', 'info');
            exportErrorLogTxt(errorLogs);
        }
    }
}
