/**
 * Firestore "máy chủ" giả cho E2E: dữ liệu nằm trong bộ nhớ của tiến trình test, nên sống qua
 * nhiều trình duyệt (máy A, máy B). Trang web nạp firebase-stub.js thay cho SDK thật (chặn URL
 * gstatic), stub gọi đồng bộ /__fs/<path> và route dưới đây trả lời.
 * Stub kiểm dữ liệu như Firestore thật (từ chối undefined, NaN, serverTimestamp trong mảng).
 *
 * CDN (font, Font Awesome, ApexCharts, SheetJS):
 *  - CI có mạng → cho đi thẳng.
 *  - Máy không ra được mạng → đặt CCM_VENDOR_DIR=<thư mục node_modules có các gói đó> để phục vụ từ máy.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const STUB = readFileSync(new URL('./firebase-stub.js', import.meta.url), 'utf8');
const VENDOR = process.env.CCM_VENDOR_DIR || '';

export class Backend {
    constructor(role = 'admin') {
        this.DB = { 'users/demo': { name: 'QS Demo', role, email: 'qs@demo.vn' } };
    }

    /** Sao chép dữ liệu dự án sang backend khác (vd: thử vai trò khác trên cùng dữ liệu). */
    copyProjectsFrom(other) {
        for (const [k, v] of Object.entries(other.DB)) if (k.startsWith('projects/')) this.DB[k] = structuredClone(v);
        return this;
    }

    project(id = 'P001') { return this.DB[`projects/${id}`] || {}; }

    async attach(context) {
        await context.route('**/*', (route) => this.handle(route));
    }

    async handle(route) {
        const req = route.request();
        const url = req.url();
        if (url.includes('/__fs/')) {
            const path = decodeURIComponent(url.split('/__fs/')[1]);
            if (req.method() === 'POST') {
                const b = JSON.parse(req.postData());
                const cur = { ...(b.merge ? this.DB[path] || {} : {}), ...b.data };
                this.DB[path] = cur;
                return route.fulfill({ body: JSON.stringify(cur), contentType: 'application/json' });
            }
            if (path.startsWith('__list__')) {
                const pre = path.slice(8) + '/';
                const out = Object.fromEntries(Object.entries(this.DB).filter(([k]) => k.startsWith(pre)).map(([k, v]) => [k.slice(pre.length), v]));
                return route.fulfill({ body: JSON.stringify(out), contentType: 'application/json' });
            }
            return route.fulfill({ body: JSON.stringify(this.DB[path] ?? null), contentType: 'application/json' });
        }
        if (url.includes('gstatic.com/firebasejs')) {
            return route.fulfill({ body: url.includes('app-compat') ? STUB : '', contentType: 'application/javascript' });
        }
        if (VENDOR) {
            const file = vendorFile(url);
            if (file) return existsSync(file) ? route.fulfill({ path: file }) : route.abort();
            if (/fonts\.(googleapis|gstatic)\.com/.test(url)) return route.abort();
        }
        if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) return route.continue();
        if (!VENDOR && /cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|cdn\.sheetjs\.com|fonts\.(googleapis|gstatic)\.com/.test(url)) return route.continue();
        return route.abort();
    }
}

function vendorFile(url) {
    if (url.includes('apexcharts')) return join(VENDOR, 'apexcharts/dist/apexcharts.min.js');
    if (url.includes('cdn.sheetjs.com')) return join(VENDOR, 'xlsx/dist/xlsx.full.min.js');
    const fa = url.match(/font-awesome\/[\d.]+\/(.+?)(\?|$)/);
    if (fa) return join(VENDOR, '@fortawesome/fontawesome-free', fa[1]);
    return null;
}
