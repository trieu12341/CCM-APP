import { openSummaryModal, saveSummaryData } from './project-ui.js';

export function setupProjectSummaryEvents() {
    const modal = document.getElementById('project-summary-modal');
    const closeBtn = document.getElementById('close-summary-modal');
    const projectNameEl = document.getElementById('project-name');
    
    if (projectNameEl) {
        projectNameEl.addEventListener('click', () => {
            openSummaryModal();
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
    }

    const btnEdit = document.getElementById('btn-edit-summary');
    const btnSave = document.getElementById('btn-save-summary');
    
    if (btnEdit) {
        btnEdit.addEventListener('click', () => {
            document.getElementById('summary-view-mode').classList.add('hidden');
            document.getElementById('summary-edit-mode').classList.remove('hidden');
            document.getElementById('summary-img-edit-wrap').classList.remove('hidden');
            btnEdit.classList.add('hidden');
            btnSave.classList.remove('hidden');
        });
    }

    if (btnSave) {
        btnSave.addEventListener('click', () => {
            saveSummaryData();
        });
    }

    const imgUpload = document.getElementById('summary-img-upload');
    const imgInput = document.getElementById('summary-img-input');
    const imgView = document.getElementById('summary-img-view');
    const imgPlaceholder = document.getElementById('summary-img-placeholder');

    if (imgUpload) {
        imgUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            if (file.size > 2 * 1024 * 1024) {
                alert('Vui lòng chọn ảnh có dung lượng nhỏ hơn 2MB để tránh lỗi bộ nhớ!');
                e.target.value = '';
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (event) => {
                const dataUrl = event.target.result;
                imgInput.value = dataUrl;
                
                imgView.src = dataUrl;
                imgView.style.display = 'block';
                imgPlaceholder.style.display = 'none';
            };
            reader.readAsDataURL(file);
        });
    }

    if (imgInput) {
        imgInput.addEventListener('input', (e) => {
             if (e.target.value) {
                imgView.src = e.target.value;
                imgView.style.display = 'block';
                imgPlaceholder.style.display = 'none';
             } else {
                imgView.style.display = 'none';
                imgPlaceholder.style.display = 'flex';
             }
        });
    }
}
