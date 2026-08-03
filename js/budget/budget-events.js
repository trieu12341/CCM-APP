import { state, mockActivities } from '../app.js';
import { saveProject, saveBudget, saveTender } from '../api.js';
import { persistBudgets } from '../core/data-store.js';
import { renderProjectTabs, renderDashboard, renderBudgetTableModal } from './budget-ui.js';
import { renderTenders } from '../tender.js';



export function setupBudgetEvents() {
    // --- Workflow 4 Reconcile: Refresh Budget UI when any tab changes state ---
    const reRenderBudgetUI = () => {
        try { renderDashboard(); } catch(e) { console.error('renderDashboard error:', e); }
        try { renderBudgetTableModal(); } catch(e) { /* Modal may not be open, ignore */ }
    };
    document.addEventListener('budgetsChanged', reRenderBudgetUI);
    document.addEventListener('tendersChanged', reRenderBudgetUI);
    document.addEventListener('contractsChanged', reRenderBudgetUI);

    // --- Workflow 1: Create Tender from Budget line ---
    window.createTenderFromBudget = async (budget) => {
        const newTender = {
            tender_id: 'T' + (state.appData.Tenders.length + 1).toString().padStart(3, '0'),
            project_id: budget.project_id,
            tender_name: budget.packageName,
            type: budget.category,
            approved_budget: budget.budgeted,
            budget_id: budget.id,          // ← LINK: trực tiếp gắn với Budget item
            status: 'Floating',
            deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            winner: ''
        };
        try {
            const success = await saveTender(newTender);
            if (success) {
                state.appData.Tenders.push(newTender);
                alert(`Đã tạo hồ sơ Đấu thầu cho gói: ${newTender.tender_name}`);
                renderBudgetTableModal();
                if (typeof renderTenders === 'function') renderTenders();
            } else {
                alert('Lỗi khi tạo gói thầu!');
            }
        } catch (e) {
            console.error('[createTenderFromBudget]', e);
            alert('Lỗi khi tạo gói thầu!');
        }
    };

    // --- Budget List Modal ---
    bindEvent('btn-open-budget-list', 'click', () => {
        renderBudgetTableModal();
        window.openInlineWorkspace('budget-list-modal');
    });
    bindEvent('close-budget-list-modal', 'click', () => {
        window.closeInlineWorkspace();
    });

    // --- Budget CRUD Logic ---
    bindEvent('btnAddNewBudget', 'click', () => {
        document.getElementById('budgetFormTitle').textContent = 'Thêm Hạng Mục Ngân Sách';
        document.getElementById('budget-id').value = '';
        document.getElementById('budget-category').value = 'Consultancy';
        document.getElementById('budget-packageName').value = '';
        document.getElementById('budget-budgeted').value = '';
        document.getElementById('budget-notes').value = '';
        document.getElementById('budgetFormModal').classList.remove('hidden');
    });

    bindEvent('close-budget-form-modal', 'click', () => {
        document.getElementById('budgetFormModal').classList.add('hidden');
    });

    bindEvent('cancel-budget-form-modal', 'click', () => {
        document.getElementById('budgetFormModal').classList.add('hidden');
    });

    bindEvent('budgetForm', 'submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('budget-id').value;
        const category = document.getElementById('budget-category').value;
        const packageName = document.getElementById('budget-packageName').value;
        const budgetedStr = document.getElementById('budget-budgeted').value.replace(/,/g, '');
        const budgeted = parseFloat(budgetedStr) || 0;
        const notes = document.getElementById('budget-notes').value;

        if (!state.appData.Budgets) state.appData.Budgets = [];

        if (id) {
            // Edit existing
            const index = state.appData.Budgets.findIndex(b => b.id === id);
            if (index !== -1) {
                state.appData.Budgets[index] = { ...state.appData.Budgets[index], category, packageName, budgeted, notes };
                mockActivities.unshift({ text: `Đã cập nhật ngân sách: ${packageName}`, date: new Date().toISOString() });
            }
        } else {
            // Create new
            const newId = 'B' + (state.appData.Budgets.length + 1).toString().padStart(3, '0') + '-' + Date.now();
            const newItem = {
                id: newId,
                project_id: state.currentProjectId,
                category,
                packageName,
                budgeted,
                notes
            };
            state.appData.Budgets.push(newItem);
            mockActivities.unshift({ text: `Đã thêm hạng mục ngân sách mới: ${packageName}`, date: new Date().toISOString() });
        }

        persistBudgets(state.appData.Budgets);
        
        renderDashboard();
        renderBudgetTableModal();
        document.getElementById('budgetFormModal').classList.add('hidden');
    });

    // Event Delegation for Edit/Delete Budget
    const budgetTrackerTable = document.getElementById('budget-tracker-table');
    if (budgetTrackerTable) {
        budgetTrackerTable.addEventListener('click', async (e) => {
            const btnEdit = e.target.closest('.btn-edit-budget');
            const btnDelete = e.target.closest('.btn-delete-budget');

            if (btnEdit) {
                const id = btnEdit.getAttribute('data-id');
                const budgetItem = (state.appData.Budgets || []).find(b => b.id === id);
                if (budgetItem) {
                    document.getElementById('budgetFormTitle').textContent = 'Sửa Hạng Mục Ngân Sách';
                    document.getElementById('budget-id').value = budgetItem.id;
                    document.getElementById('budget-category').value = budgetItem.category || 'Consultancy';
                    document.getElementById('budget-packageName').value = budgetItem.packageName || '';
                    document.getElementById('budget-budgeted').value = (budgetItem.budgeted || 0).toLocaleString('en-US');
                    document.getElementById('budget-notes').value = budgetItem.notes || '';
                    document.getElementById('budgetFormModal').classList.remove('hidden');
                }
            }

            if (btnDelete) {
                const id = btnDelete.getAttribute('data-id');
                if (confirm('Bạn có chắc chắn muốn xóa hạng mục ngân sách này không?')) {
                    state.appData.Budgets = state.appData.Budgets.filter(b => b.id !== id);
                    mockActivities.unshift({ text: `Đã xóa hạng mục ngân sách`, date: new Date().toISOString() });
                    persistBudgets(state.appData.Budgets);
                    renderDashboard();
                    renderBudgetTableModal();
                }
            }
        });
    }

    // --- Excel Import Logic ---
    bindEvent('btnImportBudget', 'click', () => {
        const fileInput = document.getElementById('budget-excel-upload');
        if (fileInput) fileInput.click();
    });

    bindEvent('budget-excel-upload', 'change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async function(event) {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = window.XLSX.read(data, {type: 'array'});
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const rows = window.XLSX.utils.sheet_to_json(worksheet, {header: 1});
                
                let addedCount = 0;
                
                // Giả định form chuẩn: Category | Package Name | Budgeted
                // Nếu header ở dòng 0, loop từ dòng 1
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || row.length < 2) continue;
                    
                    const catRaw = (row[0] || '').toString().toLowerCase();
                    let category = 'Construction';
                    if (catRaw.includes('tư vấn') || catRaw.includes('soft')) category = 'Consultancy';
                    else if (catRaw.includes('dự phòng') || catRaw.includes('contingency')) category = 'Contingency';
                    
                    const packageName = row[1] || 'Unknown';
                    const budgeted = parseFloat(row[2]) || 0;
                    
                    if (packageName.trim() !== '') {
                        const newId = 'B' + Date.now() + Math.floor(Math.random()*1000);
                        state.appData.Budgets.push({
                            id: newId,
                            project_id: state.currentProjectId,
                            category,
                            packageName,
                            budgeted,
                            notes: ''
                        });
                        addedCount++;
                    }
                }

                if (addedCount > 0) {
                    persistBudgets(state.appData.Budgets);
                    mockActivities.unshift({ text: `Import thành công ${addedCount} hạng mục ngân sách`, date: new Date().toISOString() });
                    renderDashboard();
                    renderBudgetTableModal();
                    alert(`Import thành công ${addedCount} hạng mục ngân sách!`);
                } else {
                    alert('Không tìm thấy dữ liệu ngân sách hợp lệ trong file Excel.');
                }
            } catch (err) {
                console.error('Error importing Excel:', err);
                alert('Có lỗi xảy ra khi đọc file Excel.');
            }
            e.target.value = ''; // Reset
        };
        reader.readAsArrayBuffer(file);
    });

    // --- Payment Modal ---
    const paymentModal = document.getElementById('payment-modal');
    if (paymentModal) {
        bindEvent('btn-initiate-payment', 'click', () => {
            const select = document.getElementById('contract-select');
            if (!select) return;
            select.innerHTML = '';
            (state.appData.Contracts || [])
                .filter(c => c.project_id === state.currentProjectId)
                .forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.contract_id;
                    opt.textContent = c.contract_name;
                    select.appendChild(opt);
                });
            const amtEl = document.getElementById('payment-amount');
            if (amtEl) amtEl.value = '';
            paymentModal.classList.remove('hidden');
        });
        bindEvent('close-modal', 'click', () => paymentModal.classList.add('hidden'));
        bindEvent('cancel-modal', 'click', () => paymentModal.classList.add('hidden'));
        bindEvent('payment-form', 'submit', async (e) => {
            e.preventDefault();
            const contractId = document.getElementById('contract-select')?.value;
            const amount = parseFloat(document.getElementById('payment-amount')?.value);
            if (!amount || amount <= 0) return;
            if (!state.appData.Payment_Claims) state.appData.Payment_Claims = [];
            state.appData.Payment_Claims.push({
                claim_id: 'PC' + (state.appData.Payment_Claims.length + 1).toString().padStart(3, '0'),
                contract_id: contractId,
                period_number: 1,
                claimed_amount: amount,
                advance_deduction: 0,
                retention_amount: 0,
                status: 'Approved'
            });
            const contractName = state.appData.Contracts.find(c => c.contract_id === contractId)?.contract_name;
            mockActivities.unshift({ text: `Payment Claim Approved: ${amount.toLocaleString()} VNĐ for ${contractName}`, date: new Date().toISOString() });
            await saveBudget({ Budgets: state.appData.Budgets, Contracts: state.appData.Contracts, Payment_Claims: state.appData.Payment_Claims, Variations: state.appData.Variations, Documents: state.appData.Documents });
            renderDashboard();
            renderBudgetTableModal();
            paymentModal.classList.add('hidden');
        });
    }

    // --- New Entry Modal (Legacy, replaced by New Budget Entry Modal, but kept for compatibility) ---
    const newEntryModal = document.getElementById('new-entry-modal');
    if (newEntryModal) {
        bindEvent('btn-new-entry', 'click', () => {
            const catEl = document.getElementById('entry-category');
            const amtEl = document.getElementById('entry-amount');
            if (catEl) catEl.value = '';
            if (amtEl) amtEl.value = '';
            newEntryModal.classList.remove('hidden');
        });
        bindEvent('close-entry-modal', 'click', () => newEntryModal.classList.add('hidden'));
        bindEvent('cancel-entry-modal', 'click', () => newEntryModal.classList.add('hidden'));
        bindEvent('new-entry-form', 'submit', async (e) => {
            e.preventDefault();
            const categoryName = document.getElementById('entry-category')?.value;
            const amount = parseFloat(document.getElementById('entry-amount')?.value);
            if (!categoryName || !amount || amount <= 0) return;
            const newContract = {
                contract_id: 'C' + (state.appData.Contracts.length + 1).toString().padStart(3, '0'),
                project_id: state.currentProjectId,
                package_name: categoryName,
                contract_name: categoryName,
                contractor: 'TBD',
                vendor_name: 'TBD',
                budget_value: amount,
                total_value: amount,
                original_value: amount,
                advance_rate: 0,
                retention_rate: 0
            };
            if (!state.appData.Contracts) state.appData.Contracts = [];
            state.appData.Contracts.push(newContract);
            mockActivities.unshift({ text: `New Contract Entry added: ${categoryName}`, date: new Date().toISOString() });
            await saveBudget({ Budgets: state.appData.Budgets, Contracts: state.appData.Contracts, Payment_Claims: state.appData.Payment_Claims, Variations: state.appData.Variations, Documents: state.appData.Documents });
            renderDashboard();
            renderBudgetTableModal();
            newEntryModal.classList.add('hidden');
        });
    }

    // --- New Project Modal ---
    const newProjectModal = document.getElementById('new-project-modal');
    if (newProjectModal) {
        bindEvent('close-project-modal', 'click', () => newProjectModal.classList.add('hidden'));
        bindEvent('cancel-project-modal', 'click', () => newProjectModal.classList.add('hidden'));
        bindEvent('new-project-form', 'submit', async (e) => {
            e.preventDefault();
            const name       = document.getElementById('proj-name')?.value;
            const location   = document.getElementById('proj-location')?.value;
            const start      = document.getElementById('proj-start')?.value;
            const end        = document.getElementById('proj-end')?.value;
            const cfa        = document.getElementById('proj-cfa')?.value;
            const scale      = document.getElementById('proj-scale')?.value;
            const status     = document.getElementById('proj-status')?.value;
            const image      = document.getElementById('proj-image')?.value;

            const newId = 'P' + (state.appData.Projects.length + 1).toString().padStart(3, '0');
            const newProject = { 
                project_id: newId, 
                project_name: name, 
                location: location, 
                start_date: start, 
                end_date: end, 
                cfa: cfa ? Number(cfa) : 0,
                scale: scale,
                status: status,
                image_url: image,
                total_budget: 0, 
                contingency_budget: 0 
            };
            const success = await saveProject(newProject);
            
            // Luôn lưu vào LocalStorage và state (hỗ trợ chế độ offline)
            state.appData.Projects.push(newProject);
            state.currentProjectId = newId;
            
            localStorage.setItem('ccm_projects', JSON.stringify(state.appData.Projects));
            localStorage.setItem('ccm_current_project_id', newId);
            
            window.dispatchEvent(new CustomEvent('appDataChanged'));

            if (typeof renderProjectTabs === 'function') renderProjectTabs();
            renderDashboard();
            renderBudgetTableModal();
            newProjectModal.classList.add('hidden');
            
            if (!success) {
                console.warn('Không thể lưu lên server, đã lưu offline vào LocalStorage');
            }
        });
    }
}
