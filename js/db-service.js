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
 * Creates a default 'user' role profile on first login.
 * To make someone admin: update their role in Firebase Console
 * or call updateUserRole(uid, 'admin').
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
                role: 'user',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            await docRef.set(defaultProfile);
            console.log(`Created new user profile for ${email}`);
            return defaultProfile;
        }
    } catch (err) {
        console.error('Failed to get/create user profile:', err);
        // Fallback so app does not crash
        return { uid, email, name: displayName || email, role: 'user' };
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
                projects.push({
                    id: data.projectId,
                    project_id: data.projectId,
                    name: data.projectName,
                    location: data.location || '',
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
            batch.set(docRef, {
                projectId: p.project_id,
                projectName: p.name,
                location: p.location || '',
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

// Legacy stubs (kept for import compatibility)
export async function loadAllDataFromCloud() { return null; }
export async function loadBudgetsFromCloud() { return null; }
export async function loadTendersFromCloud() { return null; }
