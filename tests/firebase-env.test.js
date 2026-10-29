// Chọn môi trường Firebase: mặc định bản thật, staging chỉ khi đúng tên miền / ?env=staging.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickFirebaseEnv, PROD_CONFIG, STAGING_CONFIG } from '../js/firebase-env.js';

test('mặc định (không tham số) là bản thật', () => {
    assert.equal(pickFirebaseEnv().env, 'prod');
    assert.equal(pickFirebaseEnv().config.projectId, 'cost-contract-management');
});

test('tên miền bản thật và localhost dùng bản thật', () => {
    for (const h of ['cost-contract-management.web.app', 'cost-contract-management.firebaseapp.com', 'localhost', '127.0.0.1']) {
        assert.equal(pickFirebaseEnv(h, '').config, PROD_CONFIG, h);
    }
});

test('tên miền staging và kênh xem thử dùng staging', () => {
    for (const h of ['ccm-staging-15ddd.web.app', 'ccm-staging-15ddd.firebaseapp.com', 'ccm-staging-15ddd--pr-7-abc123.web.app']) {
        const r = pickFirebaseEnv(h, '');
        assert.equal(r.env, 'staging', h);
        assert.equal(r.config.projectId, 'ccm-staging-15ddd');
    }
});

test('?env=staging ở máy mình chọn staging; giá trị khác thì không', () => {
    assert.equal(pickFirebaseEnv('localhost', '?env=staging').config, STAGING_CONFIG);
    assert.equal(pickFirebaseEnv('localhost', '?a=1&env=staging').env, 'staging');
    assert.equal(pickFirebaseEnv('localhost', '?env=stagingx').env, 'prod');
    assert.equal(pickFirebaseEnv('localhost', '?env=prod').env, 'prod');
});

test('tên miền giả mạo staging không được nhận', () => {
    for (const h of ['ccm-staging-15ddd.web.app.evil.com', 'evil-ccm-staging-15ddd.web.app', 'ccm-staging-15ddd.example.com']) {
        assert.equal(pickFirebaseEnv(h, '').env, 'prod', h);
    }
});

test('hai cấu hình trỏ về hai project khác nhau, không lẫn trường nào', () => {
    for (const k of ['projectId', 'authDomain', 'storageBucket', 'appId', 'apiKey']) {
        assert.notEqual(PROD_CONFIG[k], STAGING_CONFIG[k], k);
    }
    assert.ok(STAGING_CONFIG.authDomain.startsWith(STAGING_CONFIG.projectId));
    assert.ok(PROD_CONFIG.authDomain.startsWith(PROD_CONFIG.projectId));
});
