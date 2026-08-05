import { renderContracts, openContractModal, toggleDynamicFields, renderContractTableModal, closeContractDetailModal } from './contract-ui.js';
import { saveContract, deleteContract, bulkDeleteContracts, handleContractExcelImport } from './contract-actions.js';

export function setupContractEvents() {
    const btnNewContract = document.getElementById('btn-new-contract');
    const modal = document.getElementById('contract-detail-modal');
    const closeBtn = document.getElementById('close-contract-modal');
    const cancelBtn = document.getElementById('btn-cancel-contract');
    const typeSelect = document.getElementById('contract-type-select');
    const form = document.getElementById('contract-form');
    const deleteBtn = document.getElementById('btn-delete-contract');

    // Layer 2 Modal
    const btnOpenList = document.getElementById('btn-open-contract-list');
    const listModal = document.getElementById('contract-list-modal');
    const closeListBtn = document.getElementById('close-contract-list-modal');

    if (btnOpenList) {
        btnOpenList.addEventListener('click', () => {
            renderContractTableModal();
            window.openInlineWorkspace('contract-list-modal');
        });
    }
    if (closeListBtn) {
        closeListBtn.addEventListener('click', () => {
            window.closeInlineWorkspace();
        });
    }

    if (btnNewContract) {
        btnNewContract.addEventListener('click', () => {
            openContractModal();
        });
    }

    const closeFn = () => closeContractDetailModal();
    if (closeBtn) closeBtn.addEventListener('click', closeFn);
    if (cancelBtn) cancelBtn.addEventListener('click', closeFn);



    // Close Modal via clicking backdrop
    document.getElementById('contract-detail-modal')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('contract-detail-modal')) {
            closeContractDetailModal();
        }
    });

    if (typeSelect) {
        typeSelect.addEventListener('change', (e) => {
            toggleDynamicFields(e.target.value);
        });
    }

    if (form) {
        document.getElementById('btn-save-contract').addEventListener('click', (e) => {
            e.preventDefault();
            if (form.checkValidity()) {
                saveContract();
            } else {
                form.reportValidity();
            }
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            deleteContract();
        });
    }

    const importFile = document.getElementById('contract-excel-import');
    if (importFile) {
        const newImportFile = importFile.cloneNode(true);
        importFile.parentNode.replaceChild(newImportFile, importFile);
        newImportFile.addEventListener('change', handleContractExcelImport);
    }
    
    const btnBulkDelete = document.getElementById('btn-bulk-delete-contract');
    if (btnBulkDelete) {
        btnBulkDelete.addEventListener('click', bulkDeleteContracts);
    }
    
    const cbSelectAll = document.getElementById('cb-select-all-contracts');
    if (cbSelectAll) {
        cbSelectAll.addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('.contract-cb');
            checkboxes.forEach(cb => cb.checked = e.target.checked);
            
            if (btnBulkDelete) {
                if (e.target.checked && checkboxes.length > 0) btnBulkDelete.classList.remove('hidden');
                else btnBulkDelete.classList.add('hidden');
            }
        });
    }

    window.addEventListener('appDataChanged', () => {
        renderContracts();
    });

    document.addEventListener('contractsChanged', () => {
        renderContracts();
    });

    renderContracts();
}
