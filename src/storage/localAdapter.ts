import { del, get, set } from 'idb-keyval';
import { keyValueAdapter, memoryKeyValue, type KeyValue, type StorageAdapter } from './adapter';

const idb: KeyValue = {
  get: (key) => get(key),
  set: (key, value) => set(key, value),
  del: (key) => del(key),
};

/** Guest storage: IndexedDB on the device, or memory where it is unavailable. */
/** `userId` keeps an account's offline copy apart from guest data. */
export function createLocalAdapter(userId?: string): StorageAdapter {
  const hasIdb = typeof indexedDB !== 'undefined';
  return keyValueAdapter(hasIdb ? idb : memoryKeyValue(), hasIdb ? 'local' : 'memory', userId ? `af:u:${userId}:` : 'af:');
}
