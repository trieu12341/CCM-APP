// theme-toggle.js

window.ccmChartInstances = window.ccmChartInstances || [];

/*
 * Bảng màu biểu đồ NGỮ NGHĨA dùng chung (định nghĩa ở css/theme/tokens.css, --chart-*):
 *   plan        kế hoạch / ngân sách / giá trị gốc   (xám)
 *   submitted   NT trình / chờ xử lý                 (hổ phách)
 *   approved    đã duyệt / cam kết / đã trao thầu    (xanh dương)
 *   paid        đã trả / đã chi / đã quyết toán      (xanh ngọc)
 *   negative    từ chối / vượt / âm                  (đỏ)
 *   track       phần còn lại / chưa có               (xám nhạt)
 *   soft, hard, contingency   nhóm chi phí: tư vấn, xây dựng, dự phòng
 * Module chỉ ghi tên (colors: ['plan','approved']); hàm dưới đổi ra mã màu theo
 * chế độ sáng/tối hiện tại, và đổi lại khi người dùng chuyển chế độ.
 */
function ccmResolveColors(list) {
    if (!Array.isArray(list)) return list;
    const cs = getComputedStyle(document.documentElement);
    return list.map(c => {
        if (typeof c !== 'string' || !/^[a-z]+$/.test(c)) return c;
        const v = cs.getPropertyValue('--chart-' + c).trim();
        return v || c;
    });
}
window.ccmResolveColors = ccmResolveColors;
const ccmReduceMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

if (window.ApexCharts && !window.ApexCharts.isPatched) {
    const OriginalApexCharts = window.ApexCharts;
    window.ApexCharts = function(el, options) {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        options.theme = options.theme || {};
        options.theme.mode = isDark ? 'dark' : 'light';
        options.chart = options.chart || {};
        options.chart.background = 'transparent';
        options.chart.fontFamily = options.chart.fontFamily || 'Inter, system-ui, sans-serif';
        if (ccmReduceMotion()) options.chart.animations = { enabled: false };
        const semantic = options.colors;
        if (semantic) options.colors = ccmResolveColors(semantic);

        const chart = new OriginalApexCharts(el, options);
        chart._ccmColors = semantic;
        window.ccmChartInstances.push(chart);
        return chart;
    };
    Object.assign(window.ApexCharts, OriginalApexCharts);
    window.ApexCharts.prototype = OriginalApexCharts.prototype;
    // updateOptions(...) từ module cũng nhận tên màu ngữ nghĩa
    const origUpdate = OriginalApexCharts.prototype.updateOptions;
    OriginalApexCharts.prototype.updateOptions = function(opts, ...rest) {
        if (opts && opts.colors) { this._ccmColors = opts.colors; opts = { ...opts, colors: ccmResolveColors(opts.colors) }; }
        return origUpdate.call(this, opts, ...rest);
    };
    window.ApexCharts.isPatched = true;
}

/** Tô lại mọi biểu đồ theo chế độ hiện tại (bỏ biểu đồ đã bị gỡ khỏi trang). */
function ccmRecolorCharts() {
    const mode = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    window.ccmChartInstances = (window.ccmChartInstances || []).filter(c => c && c.el && document.body && document.body.contains(c.el));
    window.ccmChartInstances.forEach(chart => {
        try {
            const o = { theme: { mode } };
            if (chart._ccmColors) o.colors = chart._ccmColors;
            chart.updateOptions(o, false, false);
        } catch (e) {}
    });
}
// Đổi chế độ bằng bất kỳ cách nào (nút, script) → biểu đồ đổi màu theo
new MutationObserver(() => ccmRecolorCharts())
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

function applyTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
    }
    
    ccmRecolorCharts();

    // Dispatch custom event for charts (ApexCharts/Chart.js) to re-render
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: theme } }));
}

function toggleTheme() {
    let currentTheme = localStorage.getItem('ccm_theme') || 'light';
    let newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    localStorage.setItem('ccm_theme', newTheme);
    applyTheme(newTheme);
    updateToggleIcon(newTheme);
}

function updateToggleIcon(theme) {
    const toggleBtn = document.getElementById('theme-toggle-btn');
    if (!toggleBtn) return;
    
    if (theme === 'dark') {
        toggleBtn.innerHTML = '<i class="fa-solid fa-sun" style="font-size: 20px;"></i>';
    } else {
        toggleBtn.innerHTML = '<i class="fa-solid fa-moon" style="font-size: 20px;"></i>';
    }
}

// Initialize theme on load (must be called immediately to avoid flash of wrong theme)
(function initTheme() {
    let savedTheme = localStorage.getItem('ccm_theme');
    if (!savedTheme) {
        // Fallback to light theme if no preference
        savedTheme = 'light';
    }
    applyTheme(savedTheme);
    
    // Wait for DOM to load to attach events
    document.addEventListener('DOMContentLoaded', () => {
        // Find and attach event listener if the button is loaded asynchronously
        // Since topbar is loaded dynamically via loadComponent, we use event delegation
        document.body.addEventListener('click', function(e) {
            const btn = e.target.closest('#theme-toggle-btn');
            if (btn) {
                toggleTheme();
            }
        });
        
        // Polling to update icon once topbar is loaded dynamically
        const observer = new MutationObserver((mutations) => {
            if (document.getElementById('theme-toggle-btn')) {
                updateToggleIcon(localStorage.getItem('ccm_theme') || 'light');
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    });
})();
