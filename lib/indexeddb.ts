// IndexedDB wrapper for persistent asset storage

export interface StoredAsset {
  id: string;
  type: 'image' | 'video' | 'text';
  name: string;
  mimeType: string;
  data: ArrayBuffer;
  protected: boolean;
  dateAdded: number;
  sourceUrl?: string;
  content?: string;
}

const DB_NAME = 'BrandogAssetDB';
const DB_VERSION = 1;
const STORE_NAME = 'assets';

class AssetDatabase {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('dateAdded', 'dateAdded', { unique: false });
          store.createIndex('type', 'type', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  private getStore(mode: IDBTransactionMode): IDBObjectStore {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }
    const transaction = this.db.transaction(STORE_NAME, mode);
    return transaction.objectStore(STORE_NAME);
  }

  async addAsset(asset: StoredAsset): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore('readwrite');
      const request = store.add(asset);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to add asset'));
    });
  }

  async getAsset(id: string): Promise<StoredAsset | undefined> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore('readonly');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to get asset'));
    });
  }

  async getAllAssets(): Promise<StoredAsset[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore('readonly');
      const index = store.index('dateAdded');
      const request = index.openCursor(null, 'prev'); // Newest first
      const assets: StoredAsset[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          assets.push(cursor.value);
          cursor.continue();
        } else {
          resolve(assets);
        }
      };

      request.onerror = () => reject(new Error('Failed to get assets'));
    });
  }

  async deleteAsset(id: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore('readwrite');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete asset'));
    });
  }

  async updateAsset(asset: StoredAsset): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore('readwrite');
      const request = store.put(asset);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to update asset'));
    });
  }

  async clearAll(): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore('readwrite');
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to clear assets'));
    });
  }

  async getStorageEstimate(): Promise<{ used: number; quota: number } | null> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage || 0,
        quota: estimate.quota || 0
      };
    }
    return null;
  }
}

export const assetDB = new AssetDatabase();
