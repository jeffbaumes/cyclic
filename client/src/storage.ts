import { BlobStorage } from '../../shared/storage';
import * as msgpack from '@msgpack/msgpack';

export const createIndexedDBBlobStorage = (dbName: string): BlobStorage => {
  const getDb = async (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };

  return {
    save: async (name: string, data: any): Promise<void> => {
      const db = await getDb();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('files', 'readwrite');
        const store = transaction.objectStore('files');
        const request = store.put(msgpack.encode(data), name);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    },

    load: async (name: string): Promise<any> => {
      const db = await getDb();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('files', 'readonly');
        const store = transaction.objectStore('files');
        const request = store.get(name);
        request.onsuccess = () => {
          if (request.result) {
            resolve(msgpack.decode(new Uint8Array(request.result)));
          } else {
            reject(new Error('File not found'));
          }
        };
        request.onerror = () => reject(request.error);
      });
    },

    list: async (): Promise<string[]> => {
      const db = await getDb();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('files', 'readonly');
        const store = transaction.objectStore('files');
        const request = store.getAllKeys();
        request.onsuccess = () => resolve(request.result as string[]);
        request.onerror = () => reject(request.error);
      });
    },
  };
};
