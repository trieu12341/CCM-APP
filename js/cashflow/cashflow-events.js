import { state, getDynamicContractValue } from '../app.js';
import { getLocalCashflow, saveLocalCashflow } from './cashflow-state.js';
import { getContractOptions, crossCheckValidation } from './cashflow-ui-utils.js';
import { renderCashflowTable, getCurrentSelectedPackageId } from './cashflow-ui-table.js';
import { renderCashflow } from './cashflow-ui-charts.js';
import { addCashflowRow } from './cashflow-ui-row.js';
import { handleExcelImport, saveImportedCashflow } from './cashflow-excel.js';

export function setupCashflowEvents() {
    const btnToDetail = document.getElementById('btn-cashflow-detail');
    const modal = document.getElementById('cashflow-detail-modal');
    const closeBtn = document.getElementById('close-cashflow-modal');
    const cancelBtn = document.getElementById('btn-cancel-cashflow');
    const addRowBtn = document.getElementById('btn-add-cashflow-row');
    const addReleaseBtn = document.getElementById('btn-add-release');
    const periodSelect = document.getElementById('cf-period-select');
    const importBtn = document.getElementById('btn-cf-import-excel');
    const importFile = document.getElementById('excel-import');
    const filterContract = document.getElementById('cf-filter-contract');

    // Esc thoát chế độ phóng to biểu đồ (trước đây chỉ thoát được bằng nút nhỏ ở góc)
    if (!window.__cfFullscreenEscBound) {
        window.__cfFullscreenEscBound = true;
        document.addEventListener('keydown', (ev) => {
            if (ev.key !== 'Escape') return;
            document.querySelectorAll('.cf-chart-card.fullscreen-mode').forEach(card => {
                card.classList.remove('fullscreen-mode');
                const icon = card.querySelector('.btn-fullscreen i');
                if (icon) { icon.classList.add('fa-expand'); icon.classList.remove('fa-compress'); }
                setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
            });
        });
    }

    document.querySelectorAll('.btn-fullscreen').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', (e) => {
            const card = e.currentTarget.closest('.cf-chart-card');
            card.classList.toggle('fullscreen-mode');
            const icon = e.currentTarget.querySelector('i');
            if (card.classList.contains('fullscreen-mode')) {
                icon.classList.remove('fa-expand');
                icon.classList.add('fa-compress');
            } else {
                icon.classList.add('fa-expand');
                icon.classList.remove('fa-compress');
            }
            setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
        });
    });

    if (btnToDetail) {
        btnToDetail.addEventListener('click', () => {
            if (filterContract) {
                filterContract.innerHTML = getContractOptions();
            }
            window.openInlineWorkspace('cashflow-detail-modal');
            crossCheckValidation();
            renderCashflowTable();
        });
    }

    if (filterContract) {
        filterContract.addEventListener('change', () => {
            renderCashflowTable();
        });
    }

    const closeFn = () => {
        const cashflowModal = document.getElementById('cashflow-detail-modal');
        if (cashflowModal) cashflowModal.classList.add('hidden');
        window.closeInlineWorkspace();
    };
    if (closeBtn) closeBtn.addEventListener('click', closeFn);
    if (cancelBtn) cancelBtn.addEventListener('click', closeFn);

    const searchInput = document.getElementById('cf-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderCashflowTable();
        });
    }

    const closeCfImportBtn = document.getElementById('close-cf-import-modal');
    const cancelCfImportBtn = document.getElementById('btn-cancel-cf-import');
    const saveCfImportBtn = document.getElementById('btn-save-cf-import');
    const importModal = document.getElementById('cashflow-import-modal');
    
    const closeImportFn = () => importModal.classList.add('hidden');
    if (closeCfImportBtn) closeCfImportBtn.addEventListener('click', closeImportFn);
    if (cancelCfImportBtn) cancelCfImportBtn.addEventListener('click', closeImportFn);
    if (saveCfImportBtn) saveCfImportBtn.addEventListener('click', saveImportedCashflow);

    if (addRowBtn) {
        addRowBtn.addEventListener('click', () => {
            addCashflowRow();
        });
    }

    const autoGenBtn = document.getElementById('btn-auto-gen-cashflow');
    if (autoGenBtn) {
        autoGenBtn.addEventListener('click', () => {
            const contractId = getCurrentSelectedPackageId();
            if (!contractId) return;
            
            const allContracts = state.appData.Contracts || [];
            const contractObj = allContracts.find(c => String(c.id || c.contract_id || c.package_name) === contractId);
            if (!contractObj) return;

            const contractValue = getDynamicContractValue(contractObj, state.appData);
            if (contractValue <= 0) {
                alert("Giá trị Hợp đồng bằng 0 hoặc chưa có giá trị, không thể tạo cashflow.");
                return;
            }

            const type = contractObj.type || '';
            const packageName = contractObj.package_name || '';
            let newCashflows = [];
            let baseDate = new Date();
            
            let allCashflows = getLocalCashflow();
            allCashflows = allCashflows.filter(c => c.project_id !== state.currentProjectId || (c.package_name !== packageName && c.contract !== packageName));

            const createCf = (desc, pct, daysOffset, code = '') => {
                const d = new Date(baseDate);
                d.setDate(d.getDate() + daysOffset);
                return {
                    id: 'cf-' + Date.now() + Math.random().toString(36).substr(2, 5),
                    project_id: state.currentProjectId,
                    package_name: packageName,
                    contract: packageName,
                    status: 'Planned',
                    code: code,
                    desc: desc,
                    date: d.toISOString().split('T')[0],
                    value: contractValue * (pct / 100),
                    total_cert: contractValue * (pct / 100),
                    netPayable: contractValue * (pct / 100)
                };
            };

            if (type === 'Consultancy' || packageName.toLowerCase().includes('tư vấn')) {
                newCashflows.push(createCf('Tạm ứng hợp đồng (15%)', 15, 0, 'ADV'));
                newCashflows.push(createCf('Hoàn thành Báo cáo / Concept (30%)', 30, 30, 'IPC'));
                newCashflows.push(createCf('Bàn giao Hồ sơ Thiết kế Kỹ thuật (30%)', 30, 60, 'IPC'));
                newCashflows.push(createCf('Bàn giao Hồ sơ Đấu thầu / BVTC (20%)', 20, 90, 'IPC'));
                newCashflows.push(createCf('Quyết toán & Khai thác (5%)', 5, 120, 'FAC'));
            } else {
                newCashflows.push(createCf('Tạm ứng (10%)', 10, 0, 'ADV'));
                newCashflows.push(createCf('Thanh toán đợt 1 (17%)', 17, 30, 'IPC'));
                newCashflows.push(createCf('Thanh toán đợt 2 (17%)', 17, 60, 'IPC'));
                newCashflows.push(createCf('Thanh toán đợt 3 (17%)', 17, 90, 'IPC'));
                newCashflows.push(createCf('Thanh toán đợt 4 (17%)', 17, 120, 'IPC'));
                newCashflows.push(createCf('Thanh toán đợt 5 (17%)', 17, 150, 'IPC'));
                newCashflows.push(createCf('Quyết toán & Bảo hành (5%)', 5, 180, 'FAC'));
            }

            allCashflows.push(...newCashflows);
            saveLocalCashflow(allCashflows);
            
            crossCheckValidation();
            renderCashflowTable();
        });
    }

    if (addReleaseBtn) {
        addReleaseBtn.addEventListener('click', () => {
            const contractId = getCurrentSelectedPackageId();
            if (!contractId) return;
            const allContracts = state.appData.Contracts || [];
            const contractObj = allContracts.find(c => c.id === contractId);
            const selectedContract = contractObj ? contractObj.package_name : '';
            if (!selectedContract) return;

            const tbody = document.getElementById('cashflow-tbody');
            const emptyMsg = tbody.querySelector('td[colspan="9"]');
            if (emptyMsg) tbody.innerHTML = '';
            
            let cfs = getLocalCashflow().filter(c => c.project_id === state.currentProjectId && (c.package_name === selectedContract || c.contract === selectedContract));
            const hasRelease1 = cfs.some(c => c.is_release_retention_1 || c.code === 'TOC');
            
            const newItem = {
                id: 'cf-' + Date.now(),
                project_id: state.currentProjectId,
                package_name: selectedContract,
                contract: selectedContract,
                status: 'Planned',
                code: hasRelease1 ? 'DLC' : 'TOC',
                desc: hasRelease1 ? 'Release Retention 2 (DLC)' : 'Release Retention 1 (TOC)',
                is_release_retention_1: !hasRelease1,
                is_release_retention_2: hasRelease1,
                value: 0
            };
            
            let allData = getLocalCashflow();
            allData.push(newItem);
            saveLocalCashflow(allData);
            renderCashflowTable();
        });
    }
    
    if (importBtn && importFile) {
        const newImportBtn = importBtn.cloneNode(true);
        importBtn.parentNode.replaceChild(newImportBtn, importBtn);
        newImportBtn.addEventListener('click', () => {
            document.getElementById('excel-import').click();
        });
        
        const newImportFile = importFile.cloneNode(true);
        importFile.parentNode.replaceChild(newImportFile, importFile);
        newImportFile.addEventListener('change', handleExcelImport);
    }
    
    if (periodSelect) {
        periodSelect.addEventListener('change', () => {
            renderCashflow();
        });
    }

    const clearCashflowBtn = document.getElementById('btn-clear-cashflow');
    if (clearCashflowBtn) {
        clearCashflowBtn.addEventListener('click', () => {
            if (confirm('Bạn có chắc chắn muốn XÓA TOÀN BỘ dữ liệu Kế hoạch Dòng tiền của Dự án này không?')) {
                const projectId = state.currentProjectId;
                if (!projectId) return;
                
                let allData = getLocalCashflow();
                allData = allData.filter(c => c.project_id !== projectId);
                saveLocalCashflow(allData);
                
                renderCashflowTable();
                crossCheckValidation();
                alert('Đã xóa toàn bộ dữ liệu Cashflow của dự án này.');
            }
        });
    }

    // Switcher View Logic
    const btnTableView = document.getElementById('cf-btn-table-view');
    const btnTimelineView = document.getElementById('cf-btn-timeline-view');
    const tableViewContainer = document.getElementById('cashflow-table-view');
    const timelineViewContainer = document.getElementById('cashflow-timeline-view');

    if (btnTableView && btnTimelineView && tableViewContainer && timelineViewContainer) {
        btnTableView.addEventListener('click', () => {
            btnTableView.classList.add('active');
            btnTimelineView.classList.remove('active');
            tableViewContainer.style.display = 'block';
            timelineViewContainer.style.display = 'none';
        });

        btnTimelineView.addEventListener('click', () => {
            btnTimelineView.classList.add('active');
            btnTableView.classList.remove('active');
            timelineViewContainer.style.display = 'flex'; // It's a flex container for the placeholder
            tableViewContainer.style.display = 'none';
        });
    }

    window.addEventListener('appDataChanged', () => {
        renderCashflow();
        renderCashflowTable();
    });

    document.addEventListener('cashflowsChanged', () => {
        renderCashflow();
        renderCashflowTable();
    });
    
    document.addEventListener('cashflowChanged', () => {
        renderCashflow();
        renderCashflowTable();
    });
}
