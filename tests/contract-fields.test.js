import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getContractValue, getContractorName, getContractName, normalizeContract, setContractValue } from '../js/core/contract-fields.js';

test('đọc giá trị HĐ từ mọi tên trường cũ, ưu tiên original_value', () => {
    assert.equal(getContractValue({ original_value: 100, total_value: 50 }), 100);
    assert.equal(getContractValue({ total_value: 50 }), 50);
    assert.equal(getContractValue({ value: '1.234' }), 1234);
    assert.equal(getContractValue({}), 0);
    assert.equal(getContractValue(null), 0);
});

test('tên nhà thầu / gói thầu từ các bí danh', () => {
    assert.equal(getContractorName({ vendor_name: 'A' }), 'A');
    assert.equal(getContractorName({ contractor: 'B', vendor_name: 'A' }), 'B');
    assert.equal(getContractName({ contract_name: 'X' }), 'X');
    assert.equal(getContractName({ package_name: 'P', contract_name: 'X' }), 'P');
});

test('normalizeContract điền mọi bí danh, không xóa trường cũ', () => {
    const c = normalizeContract({ contract_id: 'C1', total_value: 900, vendor_name: 'NT', contract_name: 'Gói 1', extra: 1 });
    assert.equal(c.original_value, 900);
    assert.equal(c.contract_value, 900);
    assert.equal(c.contractor, 'NT');
    assert.equal(c.contractor_name, 'NT');
    assert.equal(c.package_name, 'Gói 1');
    assert.equal(c.extra, 1);
});

test('setContractValue cập nhật đồng bộ mọi bí danh (sửa giá sau khi chốt thầu)', () => {
    const c = { original_value: 100, total_value: 100 };
    setContractValue(c, 250.6);
    assert.deepEqual([c.original_value, c.total_value, c.contract_value], [251, 251, 251]);
});
