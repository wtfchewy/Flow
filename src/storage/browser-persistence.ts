/**
 * Browser-based persistence using IndexedDB.
 * Used as a fallback when Tauri is not available.
 */

import * as Y from 'yjs';
import type { NoteMeta, ClaudeSessionLink } from '../types';

const DB_NAME = 'peak-notes';
const DB_VERSION = 3;
const NOTES_STORE = 'notes';
const META_STORE = 'meta';

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // Recreate stores to ensure correct key configuration
      if (db.objectStoreNames.contains(NOTES_STORE)) {
        db.deleteObjectStore(NOTES_STORE);
      }
      if (db.objectStoreNames.contains(META_STORE)) {
        db.deleteObjectStore(META_STORE);
      }
      // notes: out-of-line keys (raw Yjs binary data keyed by note id)
      db.createObjectStore(NOTES_STORE);
      // meta: inline key on 'id' field (NoteMeta objects)
      db.createObjectStore(META_STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => {
      dbInstance = req.result;
      // If the browser closes the connection (e.g. version change from another tab),
      // reset so next call re-opens.
      dbInstance.onclose = () => {
        dbInstance = null;
        dbPromise = null;
      };
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
        dbPromise = null;
      };
      resolve(dbInstance);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
    req.onblocked = () => {
      dbPromise = null;
      reject(new Error('IndexedDB blocked — close other Peak tabs and retry'));
    };
  });

  return dbPromise;
}

function idbReq<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function listNotes(): Promise<NoteMeta[]> {
  const db = await openDB();
  const store = db.transaction(META_STORE, 'readonly').objectStore(META_STORE);
  const all = await idbReq<NoteMeta[]>(store.getAll());
  return all || [];
}

export async function saveNote(
  id: string,
  title: string,
  preview: string,
  mode: string,
  ydoc: Y.Doc,
  pinned: boolean = false
): Promise<void> {
  const data = Array.from(Y.encodeStateAsUpdate(ydoc));
  const db = await openDB();
  const transaction = db.transaction([NOTES_STORE, META_STORE], 'readwrite');

  const meta: NoteMeta = {
    id,
    title,
    preview,
    mode: mode as NoteMeta['mode'],
    pinned,
    createdAt: 0,
    updatedAt: Date.now(),
  };

  // Preserve original createdAt and claudeSession across saves
  const existing = await idbReq<NoteMeta | undefined>(
    transaction.objectStore(META_STORE).get(id)
  );
  meta.createdAt = existing?.createdAt || Date.now();
  if (existing?.claudeSession) {
    meta.claudeSession = existing.claudeSession;
  }

  transaction.objectStore(NOTES_STORE).put(data, id);
  transaction.objectStore(META_STORE).put(meta); // keyPath: 'id' — key is in the object

  await txComplete(transaction);
}

export async function loadNote(id: string): Promise<Uint8Array | null> {
  const db = await openDB();
  const store = db.transaction(NOTES_STORE, 'readonly').objectStore(NOTES_STORE);
  const data = await idbReq<number[] | undefined>(store.get(id));
  if (!data) return null;
  return new Uint8Array(data);
}

export async function setNoteClaudeSession(
  id: string,
  session: ClaudeSessionLink | null,
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(META_STORE, 'readwrite');
  const store = tx.objectStore(META_STORE);
  const existing = await idbReq<NoteMeta | undefined>(store.get(id));
  if (!existing) {
    await txComplete(tx);
    return;
  }
  const updated: NoteMeta = { ...existing };
  if (session) {
    updated.claudeSession = session;
  } else {
    delete updated.claudeSession;
  }
  store.put(updated);
  await txComplete(tx);
}

export async function deleteNoteFromDisk(id: string): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([NOTES_STORE, META_STORE], 'readwrite');
  transaction.objectStore(NOTES_STORE).delete(id);
  transaction.objectStore(META_STORE).delete(id);
  await txComplete(transaction);
}
