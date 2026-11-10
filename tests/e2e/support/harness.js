/**
 * Tiện ích chung cho E2E: mở trang gắn Backend, ghi lại lỗi JS + hộp thoại, đọc localStorage.
 * Mỗi bước gọi expectNoNewErrors() để bắt lỗi JS phát sinh trong bước đó.
 */
import { expect } from '@playwright/test';

export const APP = '/index.html';

export class Session {
    constructor(page, tag = '') {
        this.page = page; this.errors = []; this.dialogs = [];
        page.on('pageerror', e => this.errors.push(`${tag}PAGEERROR ${String(e).slice(0, 220)}`));
        page.on('console', m => {
            if (m.type() !== 'error') return;
            const t = m.text();
            if (/favicon|Failed to load resource|net::ERR_/.test(t)) return;   // tài nguyên CDN bị chặn có chủ đích
            this.errors.push(`${tag}CONSOLE ${t.slice(0, 220)}`);
        });
        page.on('dialog', d => {
            this.dialogs.push(`${d.type()}: ${d.message().slice(0, 160)}`);
            d.type() === 'prompt' ? d.accept(d.defaultValue() || '') : d.accept();
        });
        this.mark();
    }
    mark() { this.e0 = this.errors.length; this.d0 = this.dialogs.length; }
    newErrors() { return this.errors.slice(this.e0); }
    newDialogs() { return this.dialogs.slice(this.d0); }
    expectNoNewErrors() { expect(this.newErrors(), 'lỗi JS trong bước này').toEqual([]); }
}

export async function openApp(browser, backend, { tag = '', init } = {}) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    if (init) await context.addInitScript(init);
    await backend.attach(context);
    const page = await context.newPage();
    const s = new Session(page, tag);
    await page.goto(APP);
    await page.waitForTimeout(2500);
    return { context, page, s };
}

/** Một bước test: đánh dấu mốc lỗi, chạy, rồi kiểm không có lỗi JS mới. */
export async function step(test, s, title, fn) {
    await test.step(title, async () => {
        s.mark();
        await fn();
        s.expectNoNewErrors();
    });
}

export const LS = (page, key) => page.evaluate(k => JSON.parse(localStorage.getItem(k) || '[]'), key);
export const txt = (t) => String(t || '').replace(/\s+/g, ' ').trim();
export const digits = (t) => Number(String(t || '').replace(/\D/g, '') || 0);
export const vnd = (n) => Math.round(n).toLocaleString('de-DE');   // 1.500.000.000

export async function closeAll(page) {
    for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(150); }
}
