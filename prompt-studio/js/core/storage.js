/* Persistent storage: IndexedDB with an in-memory fallback (private mode, file:// restrictions, Node tests). */
(function (A) {
  'use strict';
  const DB_NAME = 'anime-game-prompt-studio';
  const DB_VERSION = 1;
  const STORES = { projects: 'id', templates: 'id', settings: 'key' };

  function memoryBackend() {
    const data = { projects: new Map(), templates: new Map(), settings: new Map() };
    return {
      name: 'memory',
      persistent: false,
      async all(store) { return Array.from(data[store].values()).map((v) => JSON.parse(JSON.stringify(v))); },
      async get(store, key) { const v = data[store].get(key); return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); },
      async put(store, value) { data[store].set(value[STORES[store]], JSON.parse(JSON.stringify(value))); return value; },
      async del(store, key) { data[store].delete(key); },
      async clear() { Object.values(data).forEach((m) => m.clear()); },
    };
  }

  function idbBackend(db) {
    function tx(store, mode, fn) {
      return new Promise((resolve, reject) => {
        const t = db.transaction(store, mode);
        const s = t.objectStore(store);
        let result;
        const req = fn(s);
        if (req) req.onsuccess = () => (result = req.result);
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error || new Error('IndexedDB transaction failed'));
        t.onabort = () => reject(t.error || new Error('IndexedDB transaction aborted (storage quota?)'));
      });
    }
    return {
      name: 'indexeddb',
      persistent: true,
      all: (store) => tx(store, 'readonly', (s) => s.getAll()),
      get: (store, key) => tx(store, 'readonly', (s) => s.get(key)),
      put: (store, value) => tx(store, 'readwrite', (s) => s.put(value)).then(() => value),
      del: (store, key) => tx(store, 'readwrite', (s) => s.delete(key)),
      clear: () => Promise.all(Object.keys(STORES).map((st) => tx(st, 'readwrite', (s) => s.clear()))),
    };
  }

  function openIdb() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB not available'));
      let req;
      try { req = indexedDB.open(DB_NAME, DB_VERSION); } catch (e) { return reject(e); }
      req.onupgradeneeded = () => {
        const db = req.result;
        Object.keys(STORES).forEach((name) => {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: STORES[name] });
        });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
      req.onblocked = () => reject(new Error('IndexedDB blocked by another tab'));
    });
  }

  const St = (A.storage = { backend: null, lastError: null, memoryBackend });

  St.init = async function (opts) {
    if (opts && opts.forceMemory) { St.backend = memoryBackend(); return St.backend; }
    try {
      St.backend = idbBackend(await openIdb());
    } catch (e) {
      St.lastError = e.message;
      St.backend = memoryBackend();
    }
    return St.backend;
  };

  function b() { if (!St.backend) throw new Error('Storage not initialised'); return St.backend; }

  St.listProjects = async () => (await b().all('projects')).sort((x, y) => String(y.updatedAt).localeCompare(String(x.updatedAt)));
  St.getProject = (id) => b().get('projects', id);
  St.putProject = (p) => {
    p.updatedAt = A.util.now();
    return b().put('projects', A.schema.stripSecrets(p));
  };
  St.deleteProject = (id) => b().del('projects', id);
  St.listTemplates = () => b().all('templates');
  St.putTemplate = (t) => b().put('templates', t);
  St.deleteTemplate = (id) => b().del('templates', id);
  St.getSetting = async (key, def) => { const r = await b().get('settings', key); return r === undefined ? def : r.value; };
  St.setSetting = (key, value) => b().put('settings', { key, value: A.schema.stripSecrets(value) });
  St.clearAll = () => b().clear();
})(globalThis.AGPS = globalThis.AGPS || {});
