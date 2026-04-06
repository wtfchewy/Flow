import * as Y from 'yjs';
import { isTauri } from '../platform';
import type { NoteMeta } from '../types';
import * as browserPersistence from './browser-persistence';

// Lazy-loaded Tauri invoke
let _invoke: ((cmd: string, args?: any) => Promise<any>) | null = null;

async function getInvoke() {
  if (_invoke) return _invoke;
  const mod = await import('@tauri-apps/api/core');
  _invoke = mod.invoke;
  return _invoke;
}

export async function listNotes(): Promise<NoteMeta[]> {
  if (!isTauri()) return browserPersistence.listNotes();
  const invoke = await getInvoke();
  return invoke('list_notes') as Promise<NoteMeta[]>;
}

export async function saveNote(
  id: string,
  title: string,
  preview: string,
  mode: string,
  ydoc: Y.Doc,
  pinned: boolean = false
): Promise<void> {
  if (!isTauri()) return browserPersistence.saveNote(id, title, preview, mode, ydoc, pinned);
  const invoke = await getInvoke();
  const data = Array.from(Y.encodeStateAsUpdate(ydoc));
  await invoke('save_note', { id, title, preview, mode, pinned, data });
}

export async function loadNote(id: string): Promise<Uint8Array | null> {
  if (!isTauri()) return browserPersistence.loadNote(id);
  const invoke = await getInvoke();
  const data = (await invoke('load_note', { id })) as number[] | null;
  if (!data) return null;
  return new Uint8Array(data);
}

export async function deleteNoteFromDisk(id: string): Promise<void> {
  if (!isTauri()) return browserPersistence.deleteNoteFromDisk(id);
  const invoke = await getInvoke();
  await invoke('delete_note', { id });
}
