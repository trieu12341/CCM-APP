/**
 * app-data.js — Nạp dữ liệu (localStorage → state), gắn sự kiện các module,
 * vẽ lần đầu, rồi đồng bộ thời gian thực với Firestore theo dự án đang chọn.
 */
import { normalizeContracts } from './contract-fields.js';
import { state } from '../app.js';
import { loadAllProjectsFromCloud, subscribeToProject, saveProjectsToCloud } from '../db-service.js';

import { setupBudgetEvents, renderProjectTabs, renderDashboard } from '../budget.js';
import { setupTenderEvents } from '../tender.js';
import { setupContractEvents } from '../contract.js';
import { setupCashflowEvents } from '../cashflow.js';
import { setupProjectSummaryEvents } from '../project.js';
import { setupPaymentEvents } from '../payment.js';
import { setupVOEvents } from '../vo.js';
import { setupFinalEvents } from '../final.js';
import { initializeOverviewModule } from '../overview.js';
import { initAdminUtils } from './admin-utils.js';
import { setupSidebarEvents } from './sidebar-nav.js';
import { handleProjectSnapshot } from './realtime-sync.js';

let projectSwitchBound = false;

// ─────────────────────────────────────────────────────────────
// LOAD APP DATA — fetch all data, then wire events, then render
// ─────────────────────────────────────────────────────────────
export async function loadAppData() {
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

        normalizeContracts(state.appData.Contracts);

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
                subscribeToProject(projectId, (docData) => handleProjectSnapshot(projectId, docData));
            };

            // Setup Realtime Listener for Current Project initially
            setupSubscription(state.currentProjectId);

            // Listen for project switch to resubscribe (chỉ gắn 1 lần dù đăng nhập lại)
            if (projectSwitchBound) return;
            projectSwitchBound = true;
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
