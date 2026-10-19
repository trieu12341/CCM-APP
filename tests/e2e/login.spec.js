// Màn đăng nhập: giữ thông tin khi đang xử lý, báo sai mật khẩu, chuyển cảnh vào app, đăng xuất, mở lại khi còn phiên.
import { test, expect } from '@playwright/test';
import { Backend } from './support/backend.js';
import { Session, step } from './support/harness.js';

const state = (page) => page.evaluate(() => {
    const $ = id => document.getElementById(id);
    return { card: $('login-card').className, label: document.querySelector('#btn-login-submit .login-label').textContent,
        email: $('login-email').value, pw: $('login-password').value, disabled: $('btn-login-submit').disabled,
        error: getComputedStyle($('login-error')).display, msg: $('login-error').textContent, focus: document.activeElement.id,
        login: $('login-modal').className, app: $('app-container').style.display, appCls: $('app-container').className };
});

for (const theme of ['dark', 'light']) {
    test(`Đăng nhập bằng form (${theme === 'dark' ? 'chế độ tối' : 'chế độ sáng'})`, async ({ browser }) => {
        const context = await browser.newContext();
        // Firestore giả: localStorage __auth_form=1 → bắt đầu CHƯA đăng nhập; mật khẩu "wrong" bị từ chối
        await context.addInitScript(t => {
            if (sessionStorage.getItem('__init')) return;
            localStorage.setItem('__auth_form', '1'); localStorage.setItem('ccm_theme', t); sessionStorage.setItem('__init', '1');
        }, theme);
        await new Backend().attach(context);
        const page = await context.newPage(); const s = new Session(page);
        await page.goto('/index.html'); await page.waitForTimeout(1500);

        await step(test, s, 'Màn đăng nhập hiện, màn chờ đã ẩn', async () => {
            expect(await page.isVisible('#login-card')).toBe(true);
            expect(await page.isVisible('#app-splash .splash-inner')).toBe(false);
        });
        await step(test, s, 'Đang xử lý: có spinner, giữ nguyên 2 ô, khóa nút', async () => {
            await page.fill('#login-email', 'qs@demo.vn'); await page.fill('#login-password', 'wrong');
            await page.click('#btn-login-submit'); await page.waitForTimeout(250);
            const st = await state(page);
            expect(st.card).toContain('is-busy'); expect(st.email).toBe('qs@demo.vn'); expect(st.pw).toBe('wrong'); expect(st.disabled).toBe(true);
        });
        await step(test, s, 'Sai mật khẩu: báo lỗi, rung, giữ email, con trỏ về ô mật khẩu', async () => {
            await page.waitForTimeout(700);
            const st = await state(page);
            expect(st.error).not.toBe('none'); expect(st.msg).toContain('không đúng'); expect(st.card).toContain('is-shake');
            expect(st.email).toBe('qs@demo.vn'); expect(st.focus).toBe('login-password');
        });
        await step(test, s, 'Thành công: dấu tích + lời chào, mật khẩu chưa bị xóa giữa chừng', async () => {
            await page.fill('#login-password', 'secret123'); await page.click('#btn-login-submit'); await page.waitForTimeout(900);
            const st = await state(page);
            expect(st.card).toContain('is-done'); expect(st.label).toContain('Xin chào'); expect(st.pw).toBe('secret123');
        });
        await step(test, s, 'Vào app: màn đăng nhập ẩn, đã xóa mật khẩu, gỡ class hiệu ứng', async () => {
            await page.waitForTimeout(1800);
            const st = await state(page);
            expect(st.login).toContain('hidden'); expect(st.app).toBe(''); expect(st.appCls).not.toContain('is-entering'); expect(st.pw).toBe('');
        });
        await step(test, s, 'Đăng xuất: về màn đăng nhập, nhớ email, con trỏ ở ô mật khẩu', async () => {
            await page.click('#btn-logout'); await page.waitForTimeout(800);
            const st = await state(page);
            expect(st.login).not.toContain('hidden'); expect(st.email).toBe('qs@demo.vn'); expect(st.error).toBe('none');
            expect(st.label).toBe('Đăng nhập'); expect(st.focus).toBe('login-password');
        });
        await context.close();
    });
}

test('Mở lại trang khi còn phiên: vào thẳng app, không lóe màn đăng nhập', async ({ browser }) => {
    const context = await browser.newContext();
    await new Backend().attach(context);
    const page = await context.newPage(); const s = new Session(page);
    await page.goto('/index.html', { waitUntil: 'commit' });
    const flashes = [];
    for (let i = 0; i < 30; i++) {
        flashes.push(await page.evaluate(() => { const l = document.getElementById('login-modal'); return !!l && !l.classList.contains('hidden'); }).catch(() => false));
        await page.waitForTimeout(50);
    }
    await page.waitForTimeout(1500);
    expect(flashes.some(Boolean), 'màn đăng nhập lóe lên').toBe(false);
    expect(await page.evaluate(() => document.getElementById('app-container').style.display)).toBe('');
    s.expectNoNewErrors();
    await context.close();
});
