import { test } from 'node:test';
import assert from 'node:assert/strict';
import { soThanhChu } from '../js/utils/so-thanh-chu.js';

test('T2.13 dòng 16 IPC4 đọc đúng thành chữ', () => {
    assert.equal(soThanhChu(2391377432), 'Hai tỷ ba trăm chín mươi mốt triệu ba trăm bảy mươi bảy nghìn bốn trăm ba mươi hai đồng');
});
test('các trường hợp đặc biệt: linh, mốt, lăm, mười, không trăm, nhóm 0', () => {
    const c = {
        0: 'Không đồng', 5: 'Năm đồng', 10: 'Mười đồng', 15: 'Mười lăm đồng', 21: 'Hai mươi mốt đồng', 25: 'Hai mươi lăm đồng',
        101: 'Một trăm linh một đồng', 110: 'Một trăm mười đồng', 1005: 'Một nghìn không trăm linh năm đồng',
        1000000: 'Một triệu đồng', 1000001: 'Một triệu không trăm linh một đồng', 2000050000: 'Hai tỷ không trăm năm mươi nghìn đồng',
        1000000000000: 'Một nghìn tỷ đồng', '-52000000': 'Âm năm mươi hai triệu đồng', 1234.6: 'Một nghìn hai trăm ba mươi lăm đồng',
    };
    for (const [n, s] of Object.entries(c)) assert.equal(soThanhChu(Number(n)), s, `số ${n}`);
});
