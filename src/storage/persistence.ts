import { isTauri } from '../platform/platform';

const impl = isTauri
  ? await import('../platform/persistence-tauri')
  : await import('../platform/persistence-web');

export const listNotes = impl.listNotes;
export const saveNote = impl.saveNote;
export const loadNote = impl.loadNote;
export const deleteNoteFromDisk = impl.deleteNoteFromDisk;
