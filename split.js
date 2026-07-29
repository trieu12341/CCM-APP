const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf-8');

function getBlock(startMarker, endMarker) {
    const s = html.indexOf(startMarker);
    const e = html.indexOf(endMarker, s);
    return html.substring(s, e + endMarker.length);
}

const sidebar = getBlock('<!-- Sidebar -->', '</aside>');
const topbar = getBlock('<!-- Topbar -->', '</header>');
let projectHeader = getBlock('<!-- Project Header -->', '</div>\r\n\r\n                <div id="module-overview"');
if (!projectHeader.includes('</div>')) {
    projectHeader = getBlock('<!-- Project Header -->', '</div>\n\n                <div id="module-overview"');
}
let phEnd = projectHeader.lastIndexOf('</div>');
let phClean = projectHeader.substring(0, phEnd + 6);

let modules = getBlock('<div id="module-overview"', '</div>\r\n        </main>');
if (!modules.includes('</div>')) {
    modules = getBlock('<div id="module-overview"', '</div>\n        </main>');
}
let modEnd = modules.lastIndexOf('</div>');
let modClean = modules.substring(0, modEnd + 6);

let modals = getBlock('<!-- Login Modal -->', '</div>\r\n\r\n    <!-- Scripts -->');
if (!modals.includes('</div>')) {
    modals = getBlock('<!-- Login Modal -->', '</div>\n\n    <!-- Scripts -->');
}
let modalEnd = modals.lastIndexOf('</div>');
let modalClean = modals.substring(0, modalEnd + 6);

fs.writeFileSync('components/sidebar.html', sidebar);
fs.writeFileSync('components/topbar.html', topbar);
fs.writeFileSync('components/project-header.html', phClean);
fs.writeFileSync('components/modules.html', modClean);
fs.writeFileSync('components/modals.html', modalClean);

const newIndex = html.substring(0, html.indexOf('<!-- Sidebar -->')) +
`        <div id="sidebar-container"></div>
        <!-- Main Content -->
        <main class="main-content">
            <div id="topbar-container"></div>
            <div class="content-wrapper">
                <!-- Project Tabs Container -->
                <div class="project-tabs-container" id="project-tabs-container"></div>
                <div id="project-header-container"></div>
                <div id="modules-container"></div>
            </div>
        </main>
    </div>
    <div id="modals-container"></div>
    <!-- Scripts -->
    <script type="module" src="js/app.js"></script>
    <script type="module">
        import { loadComponent } from './js/utils/html-loader.js';
        import { initApp } from './js/core/app-init.js';
        
        async function boot() {
            await Promise.all([
                loadComponent('sidebar-container', 'components/sidebar.html'),
                loadComponent('topbar-container', 'components/topbar.html'),
                loadComponent('project-header-container', 'components/project-header.html'),
                loadComponent('modules-container', 'components/modules.html'),
                loadComponent('modals-container', 'components/modals.html')
            ]);
            // Dispatch a custom event so app-init knows DOM is ready
            document.dispatchEvent(new Event('componentsLoaded'));
        }
        document.addEventListener('DOMContentLoaded', boot);
    </script>
</body>
</html>`;

fs.writeFileSync('index.html', newIndex);
console.log('Done HTML splitting!');
