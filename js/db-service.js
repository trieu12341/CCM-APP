import { db } from './firebase-config.js';
import { state } from './app.js';


/**
 * db-service.js
 * Cung cấp các thao tác CRUD tới Firestore Cloud.
 * Target collection: projects (Hybrid Realtime Multi-User Sync)
 */

const PROJECTS_COLLECTION = db.collection('projects');
let unsubscribeProject = null;

// === REALTIME LISTENER ===
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
                // If it was created by the new system
                projects.push({
                    id: data.projectId,
                    project_id: data.projectId,
                    name: data.projectName,
                    location: data.location || '',
                    status: data.status || 'Active'
                });
            } else if (data.projects) {
                // Legacy fallback if they didn't wipe DB
                projects.push(...data.projects);
            }
        });
        
        return projects;
    } catch (err) {
        console.error('❌ Failed to load Projects from Cloud:', err);
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
        console.log('✅ Projects saved to Cloud successfully.');
    } catch (err) {
        console.error('❌ Failed to save Projects to Cloud:', err);
    }
}

// Helper to group array by project_id
function groupBy(array, key) {
    return array.reduce((result, currentValue) => {
        const groupKey = currentValue[key];
        if (groupKey) {
            if (!result[groupKey]) {
                result[groupKey] = [];
            }
            result[groupKey].push(currentValue);
        }
        return result;
    }, {});
}

// Helper for Granular Batch Updates
async function saveGranularField(fieldName, arrayData) {
    try {
        const projectId = state.currentProjectId;
        if (!projectId) return;

        // ONLY save data for the current active project to avoid overwriting other projects with stale local data
        const projectData = arrayData.filter(item => item.project_id === projectId);

        const docRef = PROJECTS_COLLECTION.doc(projectId);
        await docRef.set({ 
            [fieldName]: projectData,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        console.log(`✅ ${fieldName} saved granularly to Cloud successfully for project ${projectId}.`);
    } catch (err) {
        console.error(`❌ Failed to save ${fieldName} to Cloud:`, err);
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

// Legacy Load Functions (Not used anymore with onSnapshot, but kept just in case)
export async function loadAllDataFromCloud() {
    return null;
}
export async function loadBudgetsFromCloud() {
    return null;
}
export async function loadTendersFromCloud() {
    return null;
}
