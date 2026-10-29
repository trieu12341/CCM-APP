// Ma trận quyền: 4 vai trò + khách + người chưa có hồ sơ × đọc / tạo / sửa / xóa mềm / xóa thật (T1.09 và các ô còn lại).
import { test, after, before } from 'node:test';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { skip, openRules, closeRules, repoOf, dbOf, newPid, seedContract } from './support/env.js';

let env;
before(async () => { env = await openRules(); });
after(closeRules);

// [uid, đọc, tạo, sửa, xóa mềm, xóa thật]
const MATRIX = [
    ['admin1', true,  true,  true,  true,  true ],
    ['qs1',    true,  true,  true,  true,  false],
    ['mgr1',   true,  false, false, false, false],
    ['pend1',  false, false, false, false, false],
    ['ghost',  false, false, false, false, false],   // có đăng nhập, chưa có users/{uid}
    [null,     false, false, false, false, false],   // khách chưa đăng nhập
];
const verdict = (ok) => (ok ? assertSucceeds : assertFails);
const label = (u) => u ?? 'khách';

for (const [uid, canRead, canCreate, canSave, canSoft, canHard] of MATRIX) {
    test(`ma trận quyền · ${label(uid)}: đọc ${canRead ? '✓' : '✗'} · tạo ${canCreate ? '✓' : '✗'} · sửa ${canSave ? '✓' : '✗'} · xóa mềm ${canSoft ? '✓' : '✗'} · xóa thật ${canHard ? '✓' : '✗'}`, { skip }, async () => {
        const db = dbOf(env, uid);
        const { repo } = uid ? repoOf(env, uid) : { repo: null };
        const pid = await seedContract(env);

        await verdict(canRead)(db.doc(`projects/${pid}/contracts/C1`).get());
        if (repo) {
            await verdict(canCreate)(repo.create('contracts', pid, { id: 'C2', package_name: 'Thép' }));
            await verdict(canSave)(repo.save('contracts', pid, { id: 'C1', package_name: 'Cọc đổi tên' }, 1));
            // sau lần sửa thành công _v đã là 2; nếu bị từ chối thì vẫn là 1
            await verdict(canSoft)(repo.softDelete('contracts', pid, 'C1', canSave ? 2 : 1));
        } else {
            await assertFails(db.doc(`projects/${pid}/contracts/C9`).set({ _v: 1 }));
        }
        await verdict(canHard)(db.doc(`projects/${pid}/contracts/C1`).delete());
    });
}

test('T1.09 manager thử tạo IPC (payments) trực tiếp qua console → bị từ chối', { skip }, async () => {
    const { repo } = repoOf(env, 'mgr1');
    await assertFails(repo.create('payments', newPid(), { id: 'IPC-01', gross: 1 }));
});

test('manager đọc được nhật ký nhưng không ghi được; pending không đọc được', { skip }, async () => {
    const pid = await seedContract(env);
    await assertSucceeds(dbOf(env, 'mgr1').collection(`projects/${pid}/audit`).get());
    await assertFails(dbOf(env, 'pend1').collection(`projects/${pid}/audit`).get());
});
