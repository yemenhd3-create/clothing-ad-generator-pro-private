import type { DynamicAsset, DynamicAssetType, DynamicTemplate } from './dynamicAssetManager';

const DATABASE_NAME = 'clothing-ad-dynamic-assets-v1';
const DATABASE_VERSION = 1;
const TEMPLATE_STORE = 'dynamic_templates';
const ASSET_STORE = 'dynamic_assets';

// In-memory fallback if IndexedDB is unavailable or blocked (e.g. private mode, restricted WebView)
const memoryTemplateCache = new Map<string, DynamicTemplate>();
const memoryAssetCache = new Map<string, DynamicAsset>();

function isIndexedDBSupported(): boolean {
  return typeof indexedDB !== 'undefined' && indexedDB !== null;
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (!isIndexedDBSupported()) return Promise.resolve(null);
  return new Promise(resolve => {
    try {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(TEMPLATE_STORE)) {
          db.createObjectStore(TEMPLATE_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(ASSET_STORE)) {
          db.createObjectStore(ASSET_STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.warn('[DynamicAssetStorage] Failed to open IndexedDB, falling back to memory/local');
        resolve(null);
      };
      request.onblocked = () => {
        console.warn('[DynamicAssetStorage] IndexedDB blocked');
        resolve(null);
      };
    } catch (e) {
      console.warn('[DynamicAssetStorage] Exception opening IndexedDB:', e);
      resolve(null);
    }
  });
}

async function runTransaction<T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T | null> {
  const db = await openDatabase();
  if (!db) return null;
  return new Promise(resolve => {
    try {
      const tx = db.transaction(storeName, mode);
      const req = action(tx.objectStore(storeName));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
      tx.onerror = () => db.close();
    } catch (err) {
      console.warn(`[DynamicAssetStorage] Transaction failed on ${storeName}:`, err);
      db.close();
      resolve(null);
    }
  });
}

// ----------------- Template Operations -----------------

export async function saveDynamicTemplate(template: DynamicTemplate): Promise<boolean> {
  memoryTemplateCache.set(template.id, template);
  const result = await runTransaction(TEMPLATE_STORE, 'readwrite', store => store.put(template));
  if (result === null && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(`clogen_dyn_tpl_${template.id}`, JSON.stringify(template));
    } catch {
      // Memory cache is already populated
    }
  }
  return true;
}

export async function getDynamicTemplate(id: string): Promise<DynamicTemplate | null> {
  if (memoryTemplateCache.has(id)) {
    return memoryTemplateCache.get(id) || null;
  }
  const result = await runTransaction<DynamicTemplate>(TEMPLATE_STORE, 'readonly', store => store.get(id));
  if (result) {
    memoryTemplateCache.set(id, result);
    return result;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      const item = localStorage.getItem(`clogen_dyn_tpl_${id}`);
      if (item) {
        const parsed = JSON.parse(item) as DynamicTemplate;
        memoryTemplateCache.set(id, parsed);
        return parsed;
      }
    } catch {}
  }
  return null;
}

export async function listDynamicTemplates(): Promise<DynamicTemplate[]> {
  const result = await runTransaction<DynamicTemplate[]>(TEMPLATE_STORE, 'readonly', store => store.getAll());
  if (result && Array.isArray(result) && result.length > 0) {
    result.forEach(t => memoryTemplateCache.set(t.id, t));
    return result;
  }
  if (memoryTemplateCache.size > 0) {
    return Array.from(memoryTemplateCache.values());
  }
  if (typeof localStorage !== 'undefined') {
    const fromLocal: DynamicTemplate[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('clogen_dyn_tpl_')) {
          const val = localStorage.getItem(key);
          if (val) fromLocal.push(JSON.parse(val));
        }
      }
    } catch {}
    if (fromLocal.length > 0) {
      fromLocal.forEach(t => memoryTemplateCache.set(t.id, t));
      return fromLocal;
    }
  }
  return [];
}

export async function deleteDynamicTemplate(id: string): Promise<boolean> {
  memoryTemplateCache.delete(id);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(`clogen_dyn_tpl_${id}`);
    } catch {}
  }
  await runTransaction(TEMPLATE_STORE, 'readwrite', store => store.delete(id));
  return true;
}

// ----------------- Asset Operations (Stickers, Fonts, Badges) -----------------

export async function saveDynamicAsset(asset: DynamicAsset): Promise<boolean> {
  memoryAssetCache.set(asset.id, asset);
  const result = await runTransaction(ASSET_STORE, 'readwrite', store => store.put(asset));
  return result !== null || memoryAssetCache.has(asset.id);
}

export async function getDynamicAsset(id: string): Promise<DynamicAsset | null> {
  if (memoryAssetCache.has(id)) return memoryAssetCache.get(id) || null;
  const result = await runTransaction<DynamicAsset>(ASSET_STORE, 'readonly', store => store.get(id));
  if (result) {
    memoryAssetCache.set(id, result);
    return result;
  }
  return null;
}

export async function listDynamicAssets(type?: DynamicAssetType): Promise<DynamicAsset[]> {
  const result = await runTransaction<DynamicAsset[]>(ASSET_STORE, 'readonly', store => store.getAll());
  const all = (result && Array.isArray(result) && result.length > 0)
    ? result
    : Array.from(memoryAssetCache.values());
  all.forEach(a => memoryAssetCache.set(a.id, a));
  if (type) return all.filter(a => a.type === type);
  return all;
}

export async function deleteDynamicAsset(id: string): Promise<boolean> {
  memoryAssetCache.delete(id);
  await runTransaction(ASSET_STORE, 'readwrite', store => store.delete(id));
  return true;
}

export async function clearAllDynamicAssets(): Promise<void> {
  memoryTemplateCache.clear();
  memoryAssetCache.clear();
  await runTransaction(TEMPLATE_STORE, 'readwrite', store => store.clear());
  await runTransaction(ASSET_STORE, 'readwrite', store => store.clear());
}
