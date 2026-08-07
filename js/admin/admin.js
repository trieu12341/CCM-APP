import { db } from '../firebase-config.js';
import { updateUserRole } from '../db-service.js';

/**
 * Lấy toàn bộ danh sách users từ Firestore.
 * Chỉ hoạt động nếu user hiện tại là admin (theo firestore.rules).
 */
export async function fetchAllUsers() {
    try {
        const snapshot = await db.collection('users').get();
        const users = [];
        snapshot.forEach(doc => {
            users.push(doc.data());
        });
        return users;
    } catch (err) {
        console.error('Failed to fetch users (có thể không đủ quyền):', err);
        return [];
    }
}

/**
 * Render bảng danh sách user.
 */
export async function renderUsersTable() {
    const tbody = document.getElementById('admin-users-tbody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải dữ liệu...</td></tr>`;

    const users = await fetchAllUsers();

    if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--danger-color);">Không thể tải danh sách tài khoản (Bạn không có quyền hoặc có lỗi xảy ra).</td></tr>`;
        return;
    }

    // Sắp xếp theo ngày tạo mới nhất (nếu có createdAt)
    users.sort((a, b) => {
        const timeA = a.createdAt ? (a.createdAt.toMillis ? a.createdAt.toMillis() : 0) : 0;
        const timeB = b.createdAt ? (b.createdAt.toMillis ? b.createdAt.toMillis() : 0) : 0;
        return timeB - timeA;
    });

    tbody.innerHTML = '';

    users.forEach(user => {
        const tr = document.createElement('tr');
        
        // Format ngày tham gia
        let dateStr = 'N/A';
        if (user.createdAt && user.createdAt.toDate) {
            dateStr = user.createdAt.toDate().toLocaleDateString('vi-VN', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit'
            });
        }

        tr.innerHTML = `
            <td>
                <div style="font-weight: 500;">${user.name || 'No Name'}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">UID: ${user.uid}</div>
            </td>
            <td>${user.email || 'N/A'}</td>
            <td>
                <select class="admin-role-select" data-uid="${user.uid}" style="padding: 0.25rem 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--main-bg);">
                    <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                    <option value="manager" ${user.role === 'manager' ? 'selected' : ''}>Manager</option>
                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
            </td>
            <td style="font-size: 0.85rem; color: var(--text-muted);">${dateStr}</td>
        `;
        tbody.appendChild(tr);
    });

    // Gắn sự kiện change cho dropdown role
    document.querySelectorAll('.admin-role-select').forEach(select => {
        select.addEventListener('change', async (e) => {
            const uid = e.target.getAttribute('data-uid');
            const newRole = e.target.value;
            const originalRole = users.find(u => u.uid === uid)?.role;
            
            // Disable select during update
            e.target.disabled = true;
            
            try {
                await updateUserRole(uid, newRole);
                
                // Show notification if it's the current user modifying themselves
                const currentUserUid = firebase.auth().currentUser?.uid;
                if (uid === currentUserUid && newRole !== 'admin') {
                    alert('Lưu ý: Bạn vừa hạ cấp quyền của chính mình. Sự thay đổi sẽ có hiệu lực sau khi tải lại trang.');
                } else {
                    // Quick visual feedback (có thể thay bằng toast UI)
                    const td = e.target.closest('td');
                    const msg = document.createElement('span');
                    msg.textContent = ' Đã lưu';
                    msg.style.color = 'var(--primary-blue)';
                    msg.style.fontSize = '0.75rem';
                    td.appendChild(msg);
                    setTimeout(() => msg.remove(), 2000);
                }
            } catch (err) {
                alert('Lỗi khi cập nhật quyền: ' + err.message);
                e.target.value = originalRole; // revert
            } finally {
                e.target.disabled = false;
            }
        });
    });
}
