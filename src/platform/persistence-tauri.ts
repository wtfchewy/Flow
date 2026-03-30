import { invoke } from '@tauri-apps/api/core';
import * as Y from 'yjs';

import type { NoteMeta } from '../types';

export async function listNotes(): Promise<NoteMeta[]> {
  return invoke<NoteMeta[]>('list_notes');
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
  await invoke('save_note', { id, title, preview, mode, pinned, data });
}

export async function loadNote(id: string): Promise<Uint8Array | null> {
  const data = await invoke<number[] | null>('load_note', { id });
  if (!data) return null;
  return new Uint8Array(data);
}

export async function deleteNoteFromDisk(id: string): Promise<void> {
  await invoke('delete_note', { id });
}
