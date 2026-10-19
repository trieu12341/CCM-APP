import { db } from './firebase-config.js';
import { state } from './app.js';

/**
 * db-service.js
 * Cung cap cac thao tac CRUD toi Firestore Cloud.
 * Target collection: projects (Hybrid Realtime Multi-User Sync)
 */

const PROJECTS_COLLECTION = db.collection('projects');
const USERS_COLLECTION = db.collection('users');
let unsubscribeProject = null;

// ==========================================
// USER PROFILE (Role Management from Firestore)
// ==========================================

/**
 * Load user profile from Firestore /users/{uid}.
 * Lần đăng nhập đầu tạo hồ sơ role 'pending' (chờ admin cấp quyền).
 * firestore.rules chỉ cho phép tự tạo hồ sơ với role 'pending'.
 * Admin cấp quyền trong tab Quản lý Tài khoản (hoặc Firebase Console).
 */
export async function getUserProfile(uid, email, displayName) {
    try {
        const docRef = USERS_COLLECTION.doc(uid);
        const doc = await docRef.get();
        if (doc.exists) {
            return doc.data();
        } else {
            // First login: create default profile
            const defaultProfile = {
                uid,
                email,
                name: displayName || email,
                role: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            await docRef.set(defaultProfile);
            console.log(`Created new user profile for ${email}`);
            return defaultProfile;
        }
    } catch (err) {
        console.error('Failed to get/create user profile:', err);
        // Không đọc được hồ sơ → coi như chưa có quyền (an toàn hơn cấp 'user')
        return { uid, email, name: displayName || email, role: 'pending' };
    }
}

export async function updateUserRole(uid, role) {
    try {
        await USERS_COLLECTION.doc(uid).update({ role });
        console.log(`Updated role for ${uid} to ${role}`);
    } catch (err) {
        console.error('Failed to update user role:', err);
    }
}

// ==========================================
// REALTIME LISTENER
// ==========================================

export function subscribeToProject(projectId, callback) {
    if (unsubscribeProject) {
        unsubscribeProject();
    }
    
    if (!projectId) return;

    unsubscribeProject = PROJECTS_COLLECTION.doc(projectId).onSnapshot((doc) => {
        // Bỏ qua "tiếng vọng" từ chính lần lưu cục bộ (chưa lên server) —
        // tránh vẽ lại màn hình ngay khi người dùng vừa bấm Lưu.
        if (doc.metadata && doc.metadata.hasPendingWrites) return;
        if (doc.exists) {
            callback(doc.data());
        } else {
            console.warn(`Project document ${projectId} does not exist yet.`);
            callback(null);
        }
    }, (error) => {
        console.error('Error listening to project:', error);
    });
}

// === ALL PROJECTS ===
export async function loadAllProjectsFromCloud() {
    try {
        const snapshot = await PROJECTS_COLLECTION.get();
        const projects = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.projectId) {
                // Dữ liệu cũ lưu nhầm tên vào projectName=undefined → lấy từ các trường còn lại
                const projectName = data.projectName || data.project_name || data.name || data.projectId;
                projects.push({
                    id: data.projectId,
                    project_id: data.projectId,
                    project_name: projectName,
                    name: projectName,
                    location: data.location || '',
                    start_date: data.start_date || '',
                    end_date: data.end_date || '',
                    total_budget: data.total_budget || 0,
                    contingency_budget: data.contingency_budget || 0,
                    status: data.status || 'Active'
                });
            } else if (data.projects) {
                projects.push(...data.projects);
            }
        });
        
        return projects;
    } catch (err) {
        console.error('Failed to load Projects from Cloud:', err);
        return [];
    }
}

export async function saveProjectsToCloud(projectsData) {
    try {
        const batch = db.batch();
        projectsData.forEach(p => {
            const docRef = PROJECTS_COLLECTION.doc(p.project_id);
            const projectName = p.project_name || p.name || p.project_id;
            batch.set(docRef, {
                projectId: p.project_id,
                projectName,
                project_name: projectName,
                location: p.location || '',
                start_date: p.start_date || '',
                end_date: p.end_date || '',
                total_budget: Number(p.total_budget) || 0,
                contingency_budget: Number(p.contingency_budget) || 0,
                status: p.status || 'Active',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        });
        await batch.commit();
        console.log('Projects saved to Cloud successfully.');
    } catch (err) {
        console.error('Failed to save Projects to Cloud:', err);
    }
}

// Helper for Granular Batch Updates
async function saveGranularField(fieldName, arrayData) {
    try {
        const projectId = state.currentProjectId;
        if (!projectId) return;

        // Only save data for the current active project
        const projectData = arrayData.filter(item => item.project_id === projectId);

        const docRef = PROJECTS_COLLECTION.doc(projectId);
        await docRef.set({ 
            [fieldName]: projectData,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        console.log(`${fieldName} saved to Cloud for project ${projectId}.`);
    } catch (err) {
        console.error(`Failed to save ${fieldName} to Cloud:`, err);
    }
}

// === BUDGETS ===
export async function saveBudgetsToCloud(budgetsData) {
    await saveGranularField('budgets', budgetsData);
}

// === TENDERS ===
export async function saveTendersToCloud(tendersData) {
    await saveGranularField('tenders', tendersData);
}

// === CONTRACTS ===
export async function saveContractsToCloud(contractsData) {
    await saveGranularField('contracts', contractsData);
}

// === CASHFLOW ===
export async function saveCashflowToCloud(cashflowData) {
    await saveGranularField('cashflows', cashflowData);
}

// === PAYMENTS ===
export async function savePaymentsToCloud(paymentsData) {
    await saveGranularField('payments', paymentsData);
}

// === VARIATIONS ===
export async function saveVariationsToCloud(variationsData) {
    await saveGranularField('variations', variationsData);
}

// === FINAL STATEMENTS (Quyết toán) ===
export async function saveFinalStatementsToCloud(finalData) {
    await saveGranularField('final_statements', finalData);
}

// Legacy stubs (kept for import compatibility)
export async function loadAllDataFromCloud() { return null; }
export async function loadBudgetsFromCloud() { return null; }
export async function loadTendersFromCloud() { return null; }
