/**
 * sidebar-nav.js — Chuyển tab bằng menu bên trái và vẽ lại tab đang mở.
 */
import { renderDashboard } from '../budget.js';
import { renderTenders } from '../tender.js';
import { renderCashflow } from '../cashflow.js';
import { renderPaymentDashboard } from '../payment.js';
import { renderVODashboard } from '../vo.js';
import { renderFinalDashboard } from '../final.js';
import { renderOverviewDashboard } from '../overview.js';
import { renderUsersTable } from '../admin/admin.js';

/** Vẽ lại nội dung tab đang mở mà không đóng màn hình con/form đang mở. */
export function refreshActiveView() {
    const active = document.querySelector('.menu-item.active');
    if (!active) return;
    const renderers = {
        'menu-overview': renderOverviewDashboard,
        'menu-tender': renderTenders,
        'menu-budget': renderDashboard,
        'menu-cashflow': renderCashflow,
        'menu-payment': renderPaymentDashboard,
        'menu-vo': renderVODashboard,
        'menu-final': renderFinalDashboard,
    };
    try { (renderers[active.id] || (() => {}))(); } catch (e) { console.error('refreshActiveView:', e); }
}

// ─────────────────────────────────────────────────────────────
// SIDEBAR NAVIGATION
// ─────────────────────────────────────────────────────────────
export function setupSidebarEvents() {
    const modules = [
        { menu: 'menu-overview', mod: 'module-overview' },
        { menu: 'menu-budget', mod: 'module-budget' },
        { menu: 'menu-tender', mod: 'module-tender' },
        { menu: 'menu-contract', mod: 'contract-view' },
        { menu: 'menu-cashflow', mod: 'cashflow-view' },
        { menu: 'menu-payment', mod: 'module-payment' },
        { menu: 'menu-vo', mod: 'module-vo' },
        { menu: 'menu-final', mod: 'module-final' },
        { menu: 'menu-admin', mod: 'module-admin' },
        { menu: 'menu-migrate', mod: 'module-migrate' },
        { menu: 'menu-trash', mod: 'module-trash' }
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

                // Trang chuyển dữ liệu (admin)
                if (m.mod === 'module-migrate') {
                    import('../modules/migrate/migrate-events.js').then(mod => mod.initMigratePage()).catch(err => console.error(err));
                }

                if (m.mod === 'module-trash') {
                    import('../modules/trash/trash-events.js').then(mod => mod.initTrashPage()).catch(err => console.error(err));
                }

                // Admin dashboard render
                if (m.mod === 'module-admin') {
                    setTimeout(() => { try { renderUsersTable(); } catch (e) { console.error(e); } }, 50);
                }
            }
        });
    });
}
