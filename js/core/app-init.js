import { state } from '../app.js';
import { apiLogin, apiLogout, onAuthStateChanged } from '../api.js';
import { loadAllProjectsFromCloud, subscribeToProject, saveProjectsToCloud, getUserProfile } from '../db-service.js';

import { setupBudgetEvents, renderProjectTabs, renderDashboard } from '../budget.js';
import { setupTenderEvents } from '../tender.js';
import { setupContractEvents } from '../contract.js';
import { setupCashflowEvents, renderCashflow } from '../cashflow.js';
import { setupProjectSummaryEvents } from '../project.js';
import { setupPaymentEvents, renderPaymentDashboard } from '../payment.js';
import { setupVOEvents, renderVODashboard } from '../vo.js';
import { setupFinalEvents, renderFinalDashboard } from '../final.js';
import { initializeOverviewModule, renderOverviewDashboard } from '../overview.js';
import { initAdminUtils } from './admin-utils.js';
import { renderUsersTable } from '../admin/admin.js';

// ─────────────────────────────────────────────────────────────
// MAIN ENTRY POINT — called after all HTML components are loaded
// ─────────────────────────────────────────────────────────────

function showApp() {
    const container = document.getElementById('app-container');
    if (container) container.style.display = '';
    const loginModal = document.getElementById('login-modal');
    if (loginModal) loginModal.classList.add('hidden');
}

function hideApp() {
    const container = document.getElementById('app-container');
    if (container) container.style.display = 'none';
    const loginModal = document.getElementById('login-modal');
    if (loginModal) loginModal.classList.remove('hidden');
}

export async function initApp() {
    const loginModal = document.getElementById('login-modal');


    // ── Clear session link in login form ──
    document.getElementById('btn-clear-session')?.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.clear();
        apiLogout().then(() => {
            const errorEl = document.getElementById('login-error');
            if (errorEl) { errorEl.style.display = 'block'; errorEl.textContent = 'Đã xóa session cũ. Vui lòng đăng nhập lại.'; }
        });
    });

    // ─────────────────────────────────────────────────────
    // Login Form submit handler (Firebase Email/Password)
    // ─────────────────────────────────────────────────────
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email')?.value.trim();
            const password = document.getElementById('login-password')?.value;
            const errorMsg = document.getElementById('login-error');
            const submitBtn = document.getElementById('btn-login-submit');

            if (!email || !password) return;

            try {
                if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Đang đăng nhập...'; }
                if (errorMsg) errorMsg.style.display = 'none';

                await apiLogin(email, password);
                // onAuthStateChanged will fire and handle the rest
                loginForm.reset();
            } catch (err) {
                console.error('[Login Error]', err);
                let msg = 'Đăng nhập thất bại. Vui lòng thử lại.';
                if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                    msg = 'Email hoặc mật khẩu không đúng.';
                } else if (err.code === 'auth/invalid-email') {
                    msg = 'Định dạng email không hợp lệ.';
                } else if (err.code === 'auth/too-many-requests') {
                    msg = 'Đăng nhập thất bại quá nhiều lần. Vui lòng thử lại sau.';
                }
                if (errorMsg) { errorMsg.style.display = 'block'; errorMsg.textContent = msg; }
            } finally {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Đăng nhập'; }
            }
        });
    }

    // ─────────────────────────────────────────────────────
    // Logout handler
    // ─────────────────────────────────────────────────────
    bindEvent('btn-logout', 'click', () => {
        apiLogout().then(() => {
            state.user = null;
            hideApp();
            document.body.classList.remove('is-manager', 'is-admin');
        });
    });

    // ─────────────────────────────────────────────────────
    // Firebase onAuthStateChanged - Single source of auth truth
    // ─────────────────────────────────────────────────────
    onAuthStateChanged(async (firebaseUser) => {
        if (firebaseUser) {
            // Load role from Firestore /users/{uid}
            const profile = await getUserProfile(
                firebaseUser.uid,
                firebaseUser.email,
                firebaseUser.displayName
            );

            state.user = {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                name: profile.name || firebaseUser.displayName || firebaseUser.email,
                role: profile.role || 'user'
            };

            // Update sidebar user info
            const nameEl = document.getElementById('user-name');
            const roleEl = document.getElementById('user-role');
            if (nameEl) nameEl.textContent = state.user.name;
            if (roleEl) roleEl.textContent = state.user.role;

            // Role-based CSS
            document.body.classList.toggle('is-admin', state.user.role === 'admin');
            document.body.classList.toggle('is-manager', state.user.role === 'manager');

            showApp();
            await loadAppData();
        } else {
            // User is signed out
            state.user = null;
            hideApp();
            document.body.classList.remove('is-admin', 'is-manager');
        }
    });

    // ─────────────────────────────────────────────────────
    // Global ESC Event Listener (FIFO Layer Stack)
    // ─────────────────────────────────────────────────────
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const escapeStack = [
                // Priority 1: Popups
                { container: '#budgetFormModal', btn: '#close-budget-form-modal' },
                { container: '#cashflow-import-modal', btn: '#close-cf-import-modal' },

                // Priority 2: Layer 3
                { container: '#contract-detail-modal', btn: '#close-contract-modal' },
                { container: '#payment-detail-workspace', btn: '#btn-close-ipc-form' },
                { container: '#payment-detail-workspace', btn: '#btn-close-ipc-detail' },
                { container: '#tender-detail-modal', btn: '#close-tender-detail-modal' },
                { container: '#voModal', btn: '#closeVoModalBtn' },
                { container: '#vo-form-workspace', btn: '#btn-cancel-vo' },
                { container: '#final-breakdown-workspace', btn: '#btn-close-final-breakdown' },

                // Priority 3: Layer 2
                { container: '#payment-list-modal', btn: '#btn-payment-back-l1' },
                { container: '#tender-list-modal', btn: '#close-tender-list-modal' },
                { container: '#contract-list-modal', btn: '#close-contract-list-modal' },
                { container: '#budget-list-modal', btn: '#close-budget-list-modal' },
                { container: '#cashflow-detail-modal', btn: '#close-cashflow-modal' },
                { container: '#vo-layer-2', btn: '#btn-show-vo-layer1' },
                { container: '#final-layer-2', btn: '#btn-show-final-layer1' },
            ];

            for (const layer of escapeStack) {
                const el = document.querySelector(layer.container);
                if (el && !el.classList.contains('hidden') && el.style.display !== 'none') {
                    const btn = document.querySelector(layer.btn);
                    if (btn && btn.closest('.hidden') === null && btn.style.display !== 'none') {
                        btn.click();
                        return; // Stop after handling the highest priority layer
                    }
                }
            }
        }
    });
}

// ─────────────────────────────────────────────────────────────
// LOAD APP DATA — fetch all data, then wire events, then render
// ─────────────────────────────────────────────────────────────
async function loadAppData() {
    try {
        const isCleared = localStorage.getItem('ccm_user_reset_cleared') === 'true';

        if (isCleared) {
            console.warn('✅ System was hard reset. Will bypass default mock data.');
        }

        // ── 1. Hydrate state ──────────────────────────────
        let fetchedProjects = [];
        let fetchedBudgets = [];
        let fetchedTenders = [];
        let fetchedContracts = [];
        let fetchedCashflow = [];
        let fetchedPayments = [];

        try { const lsProj = localStorage.getItem('ccm_projects'); if (lsProj) fetchedProjects = JSON.parse(lsProj); } catch (e) { }
        try { const lsBud = localStorage.getItem('ccm_budgets'); if (lsBud) fetchedBudgets = JSON.parse(lsBud); } catch (e) { }
        try { const lsTen = localStorage.getItem('ccm_tenders'); if (lsTen) fetchedTenders = JSON.parse(lsTen); } catch (e) { }
        try { const lsCon = localStorage.getItem('ccm_contracts'); if (lsCon) fetchedContracts = JSON.parse(lsCon); } catch (e) { }
        try { const lsCash = localStorage.getItem('ccm_cashflow'); if (lsCash) fetchedCashflow = JSON.parse(lsCash); } catch (e) { }
        try { const lsPay = localStorage.getItem('ccm_payments'); if (lsPay) fetchedPayments = JSON.parse(lsPay); } catch (e) { }
        let fetchedVariations = [];
        try { const lsVo = localStorage.getItem('ccm_variations'); if (lsVo) fetchedVariations = JSON.parse(lsVo); } catch (e) { }
        let fetchedFinal = [];
        try { const lsFinal = localStorage.getItem('ccm_final'); if (lsFinal) fetchedFinal = JSON.parse(lsFinal); } catch (e) { }

        state.appData = {
            Projects: Array.isArray(fetchedProjects) ? fetchedProjects : [],
            Budgets: Array.isArray(fetchedBudgets) ? fetchedBudgets : [],
            Tenders: Array.isArray(fetchedTenders) ? fetchedTenders : [],
            Contracts: Array.isArray(fetchedContracts) ? fetchedContracts : [],
            Cashflow: Array.isArray(fetchedCashflow) ? fetchedCashflow : [],
            Payments: Array.isArray(fetchedPayments) ? fetchedPayments : [],
            Variations: Array.isArray(fetchedVariations) && fetchedVariations.length > 0 ? fetchedVariations : [],
            Final_Statements: Array.isArray(fetchedFinal) ? fetchedFinal : [],
            Documents: []
        };

        const savedActiveId = localStorage.getItem('ccm_current_project_id');
        if (savedActiveId && state.appData.Projects.some(p => p.project_id === savedActiveId)) {
            state.currentProjectId = savedActiveId;
        } else if (state.appData.Projects.length > 0) {
            state.currentProjectId = state.appData.Projects[0].project_id;
            localStorage.setItem('ccm_current_project_id', state.currentProjectId);
        }

        // ── 2. Wire all event listeners FIRST ────────────
        // Each setup function is wrapped so one failure cannot crash the chain
        const setupSteps = [
            { name: 'Sidebar', fn: setupSidebarEvents },
            { name: 'Budget', fn: setupBudgetEvents },
            { name: 'Tender', fn: setupTenderEvents },
            { name: 'Contract', fn: setupContractEvents },
            { name: 'Cashflow', fn: setupCashflowEvents },
            { name: 'ProjectSummary', fn: setupProjectSummaryEvents },
            { name: 'Payment', fn: setupPaymentEvents },
            { name: 'VO', fn: setupVOEvents },
            { name: 'Final', fn: setupFinalEvents },
            { name: 'Overview', fn: initializeOverviewModule },
            { name: 'AdminUtils', fn: initAdminUtils },
        ];

        for (const step of setupSteps) {
            try {
                step.fn();
            } catch (err) {
                console.error(`[loadAppData] setup${step.name}Events failed:`, err);
            }
        }

        // ── 3. Render UI ──────────────────────────────────
        try { renderProjectTabs(); } catch (e) { console.error('renderProjectTabs error:', e); }
        try { renderDashboard(); } catch (e) { console.error('renderDashboard error:', e); }

        // Activate default tab (menu-budget is marked active in sidebar.html)
        const activeTab = document.querySelector('.menu-item.active');
        if (activeTab) activeTab.click();

        // ── 4. Background Fetch from Cloud Firestore ──────
        setTimeout(async () => {
            console.log('🔄 Setting up Hybrid Realtime Sync...');
            
            // Fetch the list of all projects
            const projects = await loadAllProjectsFromCloud();
            if (projects && projects.length > 0) {
                state.appData.Projects = projects;
                localStorage.setItem('ccm_projects', JSON.stringify(projects));
                
                const savedActiveId = localStorage.getItem('ccm_current_project_id');
                if (savedActiveId && state.appData.Projects.some(p => p.project_id === savedActiveId)) {
                    state.currentProjectId = savedActiveId;
                } else {
                    state.currentProjectId = state.appData.Projects[0].project_id;
                    localStorage.setItem('ccm_current_project_id', state.currentProjectId);
                }
            } else if (state.appData.Projects && state.appData.Projects.length > 0) {
                // Initial migration/setup: save local mock projects to cloud
                saveProjectsToCloud(state.appData.Projects).catch(console.error);
            }

            // Function to setup subscription
            const setupSubscription = (projectId) => {
                if (!projectId) return;
                subscribeToProject(projectId, async (docData) => {
                    if (docData) {
                        // Helper to merge per-project data into global array
                        const mergeProjectData = (globalArray = [], projectArray = [], pid) => {
                            const filtered = globalArray.filter(item => item.project_id !== pid);
                            return [...filtered, ...(projectArray || [])];
                        };

                        // Update global state with fresh data for this specific project
                        state.appData.Budgets = mergeProjectData(state.appData.Budgets, docData.budgets, projectId);
                        state.appData.Tenders = mergeProjectData(state.appData.Tenders, docData.tenders, projectId);
                        state.appData.Contracts = mergeProjectData(state.appData.Contracts, docData.contracts, projectId);
                        state.appData.Cashflow = mergeProjectData(state.appData.Cashflow, docData.cashflows, projectId);
                        state.appData.Payments = mergeProjectData(state.appData.Payments, docData.payments, projectId);
                        state.appData.Variations = mergeProjectData(state.appData.Variations, docData.variations, projectId);

                        // Persist to local storage as backup
                        localStorage.setItem('ccm_budgets', JSON.stringify(state.appData.Budgets));
                        localStorage.setItem('ccm_tenders', JSON.stringify(state.appData.Tenders));
                        localStorage.setItem('ccm_contracts', JSON.stringify(state.appData.Contracts));
                        localStorage.setItem('ccm_cashflows', JSON.stringify(state.appData.Cashflow));
                        localStorage.setItem('ccm_payments', JSON.stringify(state.appData.Payments));
                        localStorage.setItem('ccm_variations', JSON.stringify(state.appData.Variations));

                        console.log(`⚡ Realtime Update received for project ${projectId}, triggering UI re-render...`);
                        
                        // Dispatch events to trigger UI re-renders instantly
                        document.dispatchEvent(new Event('budgetsChanged'));
                        document.dispatchEvent(new Event('tendersChanged'));
                        document.dispatchEvent(new Event('contractsChanged'));
                        document.dispatchEvent(new Event('cashflowsChanged'));
                        document.dispatchEvent(new Event('cashflowChanged'));
                        document.dispatchEvent(new Event('paymentsChanged'));
                        document.dispatchEvent(new Event('variationsChanged'));
                        
                        // Force active tab to re-render
                        try {
                            const activeTab = document.querySelector('.menu-item.active');
                            if (activeTab) activeTab.click();
                        } catch(e) {}
                        
                        try { renderProjectTabs(); } catch(e){}
                        try { renderDashboard(); } catch(e){}
                    } else {
                        // Project document doesn't exist on cloud yet. Initialize it.
                        console.log(`Initial Setup: Initializing new project document ${projectId}`);
                        const { saveBudgetsToCloud, saveTendersToCloud, saveContractsToCloud, saveCashflowToCloud, savePaymentsToCloud, saveVariationsToCloud } = await import('../db-service.js');
                        saveBudgetsToCloud(state.appData.Budgets);
                        saveTendersToCloud(state.appData.Tenders);
                        saveContractsToCloud(state.appData.Contracts);
                        saveCashflowToCloud(state.appData.Cashflow);
                        savePaymentsToCloud(state.appData.Payments);
                        saveVariationsToCloud(state.appData.Variations);
                    }
                });
            };

            // Setup Realtime Listener for Current Project initially
            setupSubscription(state.currentProjectId);

            // Listen for project switch to resubscribe
            document.addEventListener('projectSwitched', (e) => {
                const newProjectId = e.detail;
                if (newProjectId) {
                    console.log(`🔄 Switching Realtime Sync to project: ${newProjectId}`);
                    setupSubscription(newProjectId);
                }
            });
        }, 500); // Wait a bit for initial render to finish

    } catch (error) {
        console.error('[loadAppData] Fatal error loading app data:', error);
    }
}

// ─────────────────────────────────────────────────────────────
// SIDEBAR NAVIGATION
// ─────────────────────────────────────────────────────────────
function setupSidebarEvents() {
    const modules = [
        { menu: 'menu-overview', mod: 'module-overview' },
        { menu: 'menu-budget', mod: 'module-budget' },
        { menu: 'menu-tender', mod: 'module-tender' },
        { menu: 'menu-contract', mod: 'contract-view' },
        { menu: 'menu-cashflow', mod: 'cashflow-view' },
        { menu: 'menu-payment', mod: 'module-payment' },
        { menu: 'menu-vo', mod: 'module-vo' },
        { menu: 'menu-final', mod: 'module-final' },
        { menu: 'menu-admin', mod: 'module-admin' }
    ];

    modules.forEach(m => {
        const menuEl = document.getElementById(m.menu);
        if (!menuEl) return;

        menuEl.addEventListener('click', (e) => {
            e.preventDefault();

            // Clean up modal state before tab switch
            document.querySelectorAll('.modal-overlay, .inline-workspace, #payment-list-modal').forEach(el => el.classList.add('hidden'));
            document.body.classList.remove('modal-open', 'workspace-active', 'overflow-hidden');

            // Return to Dashboard Layer 1 via helpers.js
            if (typeof window.closeInlineWorkspace === 'function') {
                window.closeInlineWorkspace();
            } else {
                document.getElementById('sidebar')?.classList.remove('sidebar-collapsed');
                document.getElementById('project-tabs-container')?.classList.remove('hidden');
            }

            // Reset VO module to Layer 1
            document.getElementById('vo-layer-1')?.classList.remove('hidden');
            document.getElementById('vo-layer-2')?.classList.add('hidden');
            document.getElementById('btn-show-vo-layer2')?.classList.remove('hidden');

            // Final module doesn't have layer 2 anymore, it uses inline-workspace

            document.body.style.overflow = '';
            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                mainContent.style.overflowY = 'auto';
                mainContent.classList.remove('overflow-hidden');
            }

            // Deactivate all
            modules.forEach(x => {
                document.getElementById(x.menu)?.classList.remove('active');
                document.getElementById(x.mod)?.classList.add('hidden');
            });
            // Activate clicked
            menuEl.classList.add('active');
            const modEl = document.getElementById(m.mod);
            if (modEl) {
                modEl.classList.remove('hidden');

                // Force re-render of tenders to fix chart issues when hidden
                if (m.menu === 'menu-tender') {
                    import('../tender.js').then(module => {
                        if (typeof module.renderTenders === 'function') {
                            module.renderTenders();
                        }
                    });
                }

                // Cashflow charts need a tick to measure container size
                if (m.mod === 'cashflow-view') {
                    setTimeout(() => { try { renderCashflow(); } catch (e) { console.error(e); } }, 50);
                }

                // Payment dashboard re-render on tab switch
                if (m.mod === 'module-payment') {
                    setTimeout(() => { try { renderPaymentDashboard(); } catch (e) { console.error(e); } }, 50);
                }

                // VO dashboard re-render on tab switch
                if (m.mod === 'module-vo') {
                    setTimeout(() => { try { renderVODashboard(); } catch (e) { console.error(e); } }, 50);
                }

                // Final dashboard re-render on tab switch
                if (m.mod === 'module-final') {
                    setTimeout(() => { try { renderFinalDashboard(); } catch (e) { console.error(e); } }, 50);
                }

                // Admin dashboard render
                if (m.mod === 'module-admin') {
                    setTimeout(() => { try { renderUsersTable(); } catch (e) { console.error(e); } }, 50);
                }
            }
        });
    });
}
