import * as Y from 'yjs';
import type { NoteMeta } from '../types';

const DB_NAME = 'peak-notes';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('data')) {
        db.createObjectStore('data');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  db: IDBDatabase,
  stores: string | string[],
  mode: IDBTransactionMode,
  fn: (tx: IDBTransaction) => IDBRequest
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(stores, mode);
    const request = fn(transaction);
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error);
  });
}

export async function listNotes(): Promise<NoteMeta[]> {
  const db = await openDB();
  const result = await tx<NoteMeta[]>(db, 'meta', 'readonly', (t) =>
    t.objectStore('meta').getAll()
  );
  db.close();
  return result || [];
}

export async function saveNote(
  id: string,
  title: string,
  preview: string,
  mode: string,
  ydoc: Y.Doc,
  pinned: boolean = false
): Promise<void> {
  const data = Y.encodeStateAsUpdate(ydoc);
  const now = Date.now();
  const db = await openDB();

  // Get existing meta to preserve createdAt
  const existing = await tx<NoteMeta | undefined>(db, 'meta', 'readonly', (t) =>
    t.objectStore('meta').get(id)
  );

  const meta: NoteMeta = {
    id,
    title,
    preview,
    mode: mode as 'page' | 'edgeless',
    pinned,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    // Preserve collab fields if they exist
    ...(existing?.shared !== undefined ? { shared: existing.shared } : {}),
    ...(existing?.roomId ? { roomId: existing.roomId } : {}),
    ...(existing?.roomToken ? { roomToken: existing.roomToken } : {}),
    ...(existing?.isHost !== undefined ? { isHost: existing.isHost } : {}),
  };

  const transaction = db.transaction(['meta', 'data'], 'readwrite');
  transaction.objectStore('meta').put(meta);
  transaction.objectStore('data').put(data, id);

  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });

  db.close();
}

export async function loadNote(id: string): Promise<Uint8Array | null> {
  const db = await openDB();
  const data = await tx<Uint8Array | undefined>(db, 'data', 'readonly', (t) =>
    t.objectStore('data').get(id)
  );
  db.close();
  return data || null;
}

export async function deleteNoteFromDisk(id: string): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction(['meta', 'data'], 'readwrite');
  transaction.objectStore('meta').delete(id);
  transaction.objectStore('data').delete(id);
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}
