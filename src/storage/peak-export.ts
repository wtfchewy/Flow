/**
 * Export/import all notes as a .peak-export file.
 * Used to transfer notes from the web version to the desktop app.
 */

import type { NoteMeta } from '../types';

export interface PeakExport {
  version: 1;
  exportedAt: number;
  notes: PeakExportNote[];
}

export interface PeakExportNote {
  meta: NoteMeta;
  data: number[]; // Yjs binary state as number array
}

/**
 * Export all notes from IndexedDB as a downloadable .peak-export file.
 * Only works in the browser (web version).
 */
export async function exportAllNotesForDesktop(): Promise<void> {
  const browserPersistence = await import('./browser-persistence');
  const metas = await browserPersistence.listNotes();
  if (metas.length === 0) return;

  const notes: PeakExportNote[] = [];
  for (const meta of metas) {
    const data = await browserPersistence.loadNote(meta.id);
    if (data) {
      notes.push({ meta, data: Array.from(data) });
    }
  }

  const exportData: PeakExport = {
    version: 1,
    exportedAt: Date.now(),
    notes,
  };

  const json = JSON.stringify(exportData);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'peak-notes.peak-export';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parse a .peak-export file's JSON content.
 */
export function parsePeakExport(json: string): PeakExport | null {
  try {
    const data = JSON.parse(json);
    if (data.version !== 1 || !Array.isArray(data.notes)) return null;
    return data as PeakExport;
  } catch {
    return null;
  }
}

/**
 * Import notes from a PeakExport into the desktop app's storage.
 * Calls Tauri save_note command directly (works before note-store init).
 */
export async function importPeakExportToDesktop(exportData: PeakExport): Promise<number> {
  const { invoke } = await import('@tauri-apps/api/core');
  let imported = 0;

  for (const note of exportData.notes) {
    try {
      await invoke('save_note', {
        id: note.meta.id,
        title: note.meta.title,
        preview: note.meta.preview,
        mode: note.meta.mode || 'page',
        pinned: note.meta.pinned || false,
        data: note.data,
      });
      imported++;
    } catch (err) {
      console.error('Failed to import note:', note.meta.id, err);
    }
  }

  return imported;
}
