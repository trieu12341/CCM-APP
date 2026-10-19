/**
 * Firestore giả trong bộ nhớ, đủ phần API compat mà js/data/ dùng:
 * collection/doc/get/set/update/onSnapshot/runTransaction + FieldValue.serverTimestamp.
 * Transaction mô phỏng Firestore: ghi dồn tới lúc commit; nếu bản ghi đã đọc bị người khác ghi
 * trong lúc đó → chạy lại hàm transaction (tối đa 5 lần) như SDK thật.
 */
const TS = Symbol('serverTimestamp');
const clone = (v) => (v === undefined ? undefined : structuredClone(v));
const tick = () => new Promise(r => setTimeout(r, 0));
let autoId = 0;

export function createFakeFirestore() {
    const docs = new Map();      // path → data
    const versions = new Map();  // path → số lần ghi (để phát hiện xung đột trong transaction)
    const listeners = new Set(); // { colPath, cb }

    const resolve = (data) => Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v === TS ? new Date() : clone(v)]));
    const docSnap = (path) => ({ id: path.split('/').pop(), exists: docs.has(path), data: () => clone(docs.get(path)) });
    const children = (colPath) => [...docs.keys()].filter(p => p.startsWith(colPath + '/') && !p.slice(colPath.length + 1).includes('/'));
    const querySnap = (colPath) => ({ docs: children(colPath).sort().map(docSnap) });

    function write(path, data) {
        docs.set(path, data);
        versions.set(path, (versions.get(path) || 0) + 1);
        const colPath = path.slice(0, path.lastIndexOf('/'));
        for (const l of listeners) if (l.colPath === colPath) setTimeout(() => l.cb(querySnap(colPath)), 0);
    }
    function setDoc(path, data, opts = {}) {
        write(path, { ...(opts.merge ? docs.get(path) || {} : {}), ...resolve(data) });
    }
    function updateDoc(path, patch) {
        if (!docs.has(path)) throw Object.assign(new Error(`not-found: ${path}`), { code: 'not-found' });
        write(path, { ...docs.get(path), ...resolve(patch) });
    }

    const docRef = (path) => ({
        id: path.split('/').pop(), path,
        collection: (name) => colRef(`${path}/${name}`),
        get: async () => { await tick(); return docSnap(path); },
        set: async (d, o) => { await tick(); setDoc(path, d, o); },
        update: async (p) => { await tick(); updateDoc(path, p); },
    });
    const colRef = (path) => ({
        path,
        doc: (id) => docRef(`${path}/${id ?? `auto${++autoId}`}`),
        get: async () => { await tick(); return querySnap(path); },
        onSnapshot: (cb) => {
            const l = { colPath: path, cb };
            listeners.add(l); setTimeout(() => cb(querySnap(path)), 0);
            return () => listeners.delete(l);
        },
    });

    async function runTransaction(fn) {
        for (let attempt = 0; attempt < 5; attempt++) {
            const reads = new Map(); const writes = [];
            const tx = {
                get: async (ref) => { await tick(); reads.set(ref.path, versions.get(ref.path) || 0); return docSnap(ref.path); },
                set: (ref, d, o) => { writes.push(() => setDoc(ref.path, d, o)); return tx; },
                update: (ref, p) => { writes.push(() => updateDoc(ref.path, p)); return tx; },
            };
            const result = await fn(tx);              // lỗi ném ra ở đây → không ghi gì
            await tick();
            const stale = [...reads].some(([p, v]) => (versions.get(p) || 0) !== v);
            if (stale) continue;                        // có người ghi chen vào → chạy lại như Firestore
            writes.forEach(w => w());
            return result;
        }
        throw Object.assign(new Error('aborted: quá nhiều lần thử lại'), { code: 'aborted' });
    }

    return {
        db: { collection: (name) => colRef(name), runTransaction },
        fieldValue: { serverTimestamp: () => TS },
        dump: () => Object.fromEntries([...docs].map(([k, v]) => [k, clone(v)])),
    };
}
