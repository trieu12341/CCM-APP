/**
 * Chọn cấu hình Firebase theo môi trường — hàm thuần (không DOM) để test bằng Node.
 * Mặc định LUÔN là bản thật; chỉ chọn staging khi chạy trên tên miền của project staging,
 * hoặc khi mở bằng ?env=staging (để thử ở máy mình). Không có đường nào từ staging trỏ sang bản thật.
 */
export const PROD_CONFIG = {
    apiKey: 'AIzaSyD_1Pjcg3wyhJWG8Wy3AtQxwHV7taPPKpc',
    authDomain: 'cost-contract-management.firebaseapp.com',
    projectId: 'cost-contract-management',
    storageBucket: 'cost-contract-management.firebasestorage.app',
    messagingSenderId: '182752560401',
    appId: '1:182752560401:web:ceaf1ec620d3798b2438b0',
    measurementId: 'G-8EDSHT5WF4',
};

export const STAGING_CONFIG = {
    apiKey: 'AIzaSyClV7PUXoiVvVsjTHfhrSSWuPf-D_4meNM',
    authDomain: 'ccm-staging-15ddd.firebaseapp.com',
    projectId: 'ccm-staging-15ddd',
    storageBucket: 'ccm-staging-15ddd.firebasestorage.app',
    messagingSenderId: '238084652157',
    appId: '1:238084652157:web:c4ad48b8fc27958af30514',
    measurementId: 'G-PS8W0W31NV',
};

/** Tên miền Hosting của project staging, gồm cả kênh xem thử (ccm-staging-15ddd--abc.web.app). */
const STAGING_HOST = /^ccm-staging-15ddd(--[a-z0-9-]+)?\.(web\.app|firebaseapp\.com)$/i;

/** @returns {{env:'prod'|'staging', config:object}} */
export function pickFirebaseEnv(hostname = '', search = '') {
    const wantsStaging = STAGING_HOST.test(String(hostname)) || /(^|[?&])env=staging(&|$)/.test(String(search));
    return wantsStaging ? { env: 'staging', config: STAGING_CONFIG } : { env: 'prod', config: PROD_CONFIG };
}
