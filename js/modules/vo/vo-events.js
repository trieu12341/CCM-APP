import { state } from '../../app.js';
import { getVOState, updateVOState, getVOById, createVO, updateVO } from './vo-state.js';
import { renderVODashboard, renderVOTable, populateVOContractDropdown, updateVOSummaryFields } from './vo-ui.js';

export function setupVOEvents() {
    // Toggle Layer 1 and Layer 2
    bindEvent('btn-show-vo-layer2', 'click', () => {
        const layer1 = document.getElementById('vo-layer-1');
        const layer2 = document.getElementById('vo-layer-2');
        const btn2 = document.getElementById('btn-show-vo-layer2');
        const title = document.getElementById('vo-header-title');
        
        if(layer1) layer1.classList.add('hidden');
        if(layer2) layer2.classList.remove('hidden');
        if(btn2) btn2.classList.add('hidden');
        if(title) title.textContent = 'Master VO List Workspace';
        
        if (typeof window.collapseSidebar === 'function') window.collapseSidebar();
        
        renderVOTable();
    });

    bindEvent('btn-show-vo-layer1', 'click', () => {
        const layer1 = document.getElementById('vo-layer-1');
        const layer2 = document.getElementById('vo-layer-2');
        const btn2 = document.getElementById('btn-show-vo-layer2');
        const title = document.getElementById('vo-header-title');
        
        if(layer2) layer2.classList.add('hidden');
        if(layer1) layer1.classList.remove('hidden');
        if(btn2) btn2.classList.remove('hidden');
        if(title) title.textContent = 'Variation Order (VO) Dashboard';

        if (typeof window.expandSidebar === 'function') window.expandSidebar();
        document.getElementById('project-tabs-container')?.classList.remove('hidden');
    });

    // Top-level status filter change
    bindEvent('vo-status-filter', 'change', (e) => {
        updateVOState({ currentFilter: e.target.value });
        renderVOTable();
    });

    // Button Create VO
    bindEvent('btn-create-vo', 'click', () => {
        openVOModal(null); // null indicates new
    });

    // Table Row Click
    const tableBody = document.querySelector('#vo-table tbody');
    if (tableBody) {
        tableBody.addEventListener('click', (e) => {
            const row = e.target.closest('.vo-row');
            if (!row) return;
            const voId = row.dataset.id;
            openVOModal(voId);
        });
    }

    // Modal Events
    bindEvent('closeVoModalBtn', 'click', closeVOModal);
    bindEvent('btn-cancel-vo', 'click', closeVOModal);
    
    // Quick action buttons in modal
    bindEvent('btn-vo-mark-approved', 'click', () => {
        const sel = document.getElementById('vo-status');
        if(sel) {
            sel.value = 'Approved';
            sel.className = 'text-success';
        }
    });
    bindEvent('btn-vo-mark-rejected', 'click', () => {
        const sel = document.getElementById('vo-status');
        if(sel) {
            sel.value = 'Rejected';
            sel.className = 'text-danger';
        }
    });

    // Form Submit (Save)
    window.addEventListener('appDataChanged', () => {
        renderVODashboard();
        renderVOTable();
    });

    document.addEventListener('variationsChanged', () => {
        renderVODashboard();
        renderVOTable();
    });

    bindEvent('vo-form', 'submit', (e) => {
        e.preventDefault();
        saveVOForm();
    });

    // Change status color dynamically
    bindEvent('vo-status', 'change', (e) => {
        e.target.className = '';
        if(e.target.value === 'Approved') e.target.classList.add('text-success');
        if(e.target.value === 'Pending') e.target.classList.add('text-warning');
        if(e.target.value === 'Rejected') e.target.classList.add('text-danger');
    });
}

function openVOModal(voId) {
    updateVOState({ activeVOId: voId });
    populateVOContractDropdown();
    
    const form = document.getElementById('vo-form');
    if(form) form.reset();
    
    // Reset summaries
    document.getElementById('vo-claimed-summary').innerText = '$0';
    document.getElementById('vo-approved-summary').innerText = '$0';
    
    if (voId) {
        // Edit Mode
        document.getElementById('vo-modal-title').textContent = 'Chi tiết Phát sinh (VO Breakdown) - ' + voId;
        const vo = getVOById(voId);
        if (vo) {
            document.getElementById('vo-id').value = vo.vo_id || '';
            document.getElementById('vo-name').value = vo.vo_name || '';
            document.getElementById('vo-contract-select').value = vo.contract_id || '';
            document.getElementById('vo-submission-date').value = vo.submission_date ? vo.submission_date.split('T')[0] : '';
            document.getElementById('vo-assessment-date').value = vo.assessment_date ? vo.assessment_date.split('T')[0] : '';
            
            const statusSel = document.getElementById('vo-status');
            statusSel.value = vo.status || 'Pending';
            statusSel.dispatchEvent(new Event('change')); // trigger color change
            
            document.getElementById('vo-reasons').value = vo.reasons || '';
            
            document.getElementById('vo-item-desc').value = vo.boq_desc || '';
            document.getElementById('vo-item-unit').value = vo.boq_unit || '';
            document.getElementById('vo-item-claimed-qty').value = vo.boq_claimed_qty || '';
            document.getElementById('vo-item-claimed-amt').value = vo.claimed_amount || vo.vo_amount || '';
            document.getElementById('vo-item-approved-qty').value = vo.boq_approved_qty || '';
            document.getElementById('vo-item-approved-amt').value = vo.approved_amount || '';
            
            updateVOSummaryFields();
        }
    } else {
        // Create Mode
        document.getElementById('vo-modal-title').textContent = 'Tạo Phát sinh VO Mới';
        document.getElementById('vo-id').value = '';
        const statusSel = document.getElementById('vo-status');
        statusSel.value = 'Pending';
        statusSel.dispatchEvent(new Event('change'));
    }

    const modal = document.getElementById('voModal');
    if (modal) {
        modal.classList.remove('hidden');
        document.body.classList.add('modal-open');
    }
}

function closeVOModal() {
    updateVOState({ activeVOId: null });
    const modal = document.getElementById('voModal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.classList.remove('modal-open');
    }
}

function saveVOForm() {
    const id = document.getElementById('vo-id').value;
    const voData = {
        vo_name: document.getElementById('vo-name').value,
        contract_id: document.getElementById('vo-contract-select').value,
        submission_date: document.getElementById('vo-submission-date').value,
        assessment_date: document.getElementById('vo-assessment-date').value,
        status: document.getElementById('vo-status').value,
        reasons: document.getElementById('vo-reasons').value,
        boq_desc: document.getElementById('vo-item-desc').value,
        boq_unit: document.getElementById('vo-item-unit').value,
        boq_claimed_qty: document.getElementById('vo-item-claimed-qty').value,
        claimed_amount: Number(document.getElementById('vo-item-claimed-amt').value) || 0,
        boq_approved_qty: document.getElementById('vo-item-approved-qty').value,
        approved_amount: Number(document.getElementById('vo-item-approved-amt').value) || 0,
    };

    if (id) {
        updateVO(id, voData);
    } else {
        createVO(voData);
    }

    closeVOModal();
    renderVODashboard();
    
    // Also trigger budget recalculation across the app to update Committed Cost
    // Using the global event dispatcher standard in the app
    document.dispatchEvent(new Event('budgetsChanged'));
}
