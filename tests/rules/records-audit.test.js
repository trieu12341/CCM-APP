// Rules cho bản ghi mới và nhật ký: chống ghi đè (T1.14), chống giả mạo người/giờ, nhật ký chỉ thêm (T1.08).
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { skip, openRules, closeRules, repoOf, dbOf, newPid, seedContract, FieldValue } from './support/env.js';
import { listAudit } from '../../js/data/audit.js';

let env;
before(async () => { env = await openRules(); });
after(closeRules);

const ts = () => FieldValue.serverTimestamp();
/** Bản ghi ghi thẳng (như người dùng mở console): đủ trường hợp lệ, test từng lần đổi một trường. */
const raw = (uid, over = {}) => ({ package_name: 'X', _v: 1, deleted: false, createdBy: uid, createdAt: ts(), updatedBy: uid, updatedAt: ts(), ...over });

test('luồng thật của app qua rules: tạo → sửa → xóa mềm → khôi phục đều được, nhật ký đủ 4 dòng', { skip }, async () => {
    const pid = newPid();
    const { repo, db } = repoOf(env, 'qs1');
    await assertSucceeds(repo.create('variations', pid, { id: 'VO-01', approved_amount: -52_000_000 }));
    await assertSucceeds(repo.save('variations', pid, { id: 'VO-01', approved_amount: -50_000_000 }, 1, { reason: 'điều chỉnh' }));
    await assertSucceeds(repo.softDelete('variations', pid, 'VO-01', 2, { reason: 'nhập nhầm' }));
    await assertSucceeds(repo.restore('variations', pid, 'VO-01', 3));
    const log = await listAudit(db, pid);
    assert.deepEqual(log.map(e => e.action).sort(), ['create', 'delete', 'restore', 'update']);
});

test('T1.14 ghi với phiên bản cũ / nhảy phiên bản / lùi phiên bản → bị rules từ chối', { skip }, async () => {
    const pid = await seedContract(env);
    const { repo, db } = repoOf(env, 'qs1');
    await repo.save('contracts', pid, { id: 'C1', package_name: 'v2' }, 1);   // server đang ở _v = 2
    const ref = db.doc(`projects/${pid}/contracts/C1`);
    const keep = { createdBy: 'qs1', createdAt: (await ref.get()).data().createdAt };
    await assertFails(ref.set(raw('qs1', { ...keep, _v: 2 })));   // ghi lại đúng _v cũ (ghi đè mù)
    await assertFails(ref.set(raw('qs1', { ...keep, _v: 4 })));   // nhảy cóc
    await assertFails(ref.set(raw('qs1', { ...keep, _v: 1 })));   // lùi
    await assertSucceeds(ref.set(raw('qs1', { ...keep, _v: 3 }))); // đúng _v + 1
});

test('không giả mạo được người ghi, giờ ghi, người tạo', { skip }, async () => {
    const pid = await seedContract(env);
    const { db } = repoOf(env, 'qs2');
    const ref = db.doc(`projects/${pid}/contracts/C1`);
    const cur = (await dbOf(env, 'qs2').doc(`projects/${pid}/contracts/C1`).get()).data();
    const keep = { createdBy: cur.createdBy, createdAt: cur.createdAt };
    await assertFails(ref.set(raw('qs2', { ...keep, _v: 2, updatedBy: 'qs1' })));                 // mạo danh người sửa
    await assertFails(ref.set(raw('qs2', { ...keep, _v: 2, updatedAt: new Date('2020-01-01') }))); // lùi giờ
    await assertFails(ref.set(raw('qs2', { ...keep, _v: 2, createdBy: 'qs2' })));                  // đổi người tạo
    await assertSucceeds(ref.set(raw('qs2', { ...keep, _v: 2 })));
});

test('tạo mới phải là _v = 1, chưa xóa, người tạo là chính mình; không tạo được loại hồ sơ lạ', { skip }, async () => {
    const pid = newPid();
    const { db } = repoOf(env, 'qs1');
    await assertFails(db.doc(`projects/${pid}/contracts/A`).set(raw('qs1', { _v: 5 })));
    await assertFails(db.doc(`projects/${pid}/contracts/B`).set(raw('qs1', { deleted: true })));
    await assertFails(db.doc(`projects/${pid}/contracts/C`).set(raw('qs1', { createdBy: 'qs2' })));
    await assertFails(db.doc(`projects/${pid}/secrets/D`).set(raw('qs1')));   // không nằm trong danh sách loại hồ sơ
    await assertSucceeds(db.doc(`projects/${pid}/contracts/E`).set(raw('qs1')));
});

test('xóa mềm phải ghi rõ ai xóa và khi nào', { skip }, async () => {
    const pid = await seedContract(env);
    const { db } = repoOf(env, 'qs1');
    const ref = db.doc(`projects/${pid}/contracts/C1`);
    const cur = (await ref.get()).data();
    const base = { createdBy: cur.createdBy, createdAt: cur.createdAt, _v: 2 };
    await assertFails(ref.set(raw('qs1', { ...base, deleted: true })));   // thiếu deletedBy/deletedAt
    await assertFails(ref.set(raw('qs1', { ...base, deleted: true, deletedBy: 'qs2', deletedAt: ts() })));
    await assertSucceeds(ref.set(raw('qs1', { ...base, deleted: true, deletedBy: 'qs1', deletedAt: ts() })));
});

test('T1.08 nhật ký chỉ được thêm: sửa/xóa bị từ chối với mọi vai trò, kể cả admin', { skip }, async () => {
    const pid = await seedContract(env);
    const entry = (await dbOf(env, 'qs1').collection(`projects/${pid}/audit`).get()).docs[0];
    for (const uid of ['qs1', 'admin1', 'mgr1']) {
        const ref = dbOf(env, uid).doc(`projects/${pid}/audit/${entry.id}`);
        await assertFails(ref.update({ reason: 'đổi lý do' }));
        await assertFails(ref.delete());
    }
});

test('nhật ký: không giả mạo người ghi / giờ ghi, không thêm trường lạ', { skip }, async () => {
    const pid = newPid();
    const { db } = repoOf(env, 'qs1');
    await db.doc(`projects/${pid}/contracts/C1`).set(raw('qs1'));   // có hồ sơ vừa ghi...
    const audit = db.collection(`projects/${pid}/audit`);
    const ok = { at: ts(), uid: 'qs1', name: 'QS 1', entity: 'contracts', entityId: 'C1', action: 'update', changes: [], reason: null };
    await assertFails(audit.add({ ...ok }));   // ...nhưng nhật ký ghi RIÊNG, khác giao dịch → không khớp giờ máy chủ
    // mỗi lần thử dùng hồ sơ mới; nhật ký ghi CÙNG giao dịch (batch) với lần ghi hồ sơ
    const fresh = (id, extra) => {
        const batch = db.batch();
        batch.set(db.doc(`projects/${pid}/contracts/${id}`), raw('qs1'));
        batch.set(audit.doc(), { ...ok, entityId: id, action: 'create', ...extra });
        return batch.commit();
    };
    await assertFails(fresh('N1', { uid: 'qs2' }));                          // mạo danh
    await assertFails(fresh('N2', { at: new Date('2020-01-01') }));          // giờ giả
    await assertFails(fresh('N3', { admin: true }));                         // trường lạ
    await assertFails(fresh('N4', { action: 'hack' }));                      // hành động lạ
    await assertFails(fresh('N5', { entity: 'users' }));                     // loại hồ sơ lạ
    await assertSucceeds(fresh('N6', {}));                                   // đúng
});

test('nhật ký "migrate" (bước 1.5): admin ghi được, user thường thì không', { skip }, async () => {
    const pid = newPid();
    const entry = { at: ts(), uid: 'admin1', name: 'Admin', entity: 'project', entityId: pid, action: 'migrate', changes: [], reason: 'chuyển dữ liệu' };
    await assertSucceeds(dbOf(env, 'admin1').collection(`projects/${pid}/audit`).add(entry));
    await assertFails(dbOf(env, 'qs1').collection(`projects/${pid}/audit`).add({ ...entry, uid: 'qs1' }));
});
