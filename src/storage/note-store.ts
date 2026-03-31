import { signal } from '@preact/signals-core';
import type { Store } from '@blocksuite/affine/store';
import type { TestWorkspace } from '@blocksuite/affine/store/test';
import * as Y from 'yjs';

import type { NoteMeta } from '../types';
import {
  createNewDoc,
  loadExistingDoc,
  getYDoc,
  getPageSpecs,
  getEdgelessSpecs,
  RefNodeSlotsProvider,
} from '../editor/setup';
import type { PeakEditorContainer } from '../editor/editor-container';
import {
  listNotes,
  saveNote,
  loadNote,
  deleteNoteFromDisk,
} from './persistence';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import {
  MarkdownTransformer,
  HtmlTransformer,
} from '@blocksuite/affine/widgets/linked-doc';
import { ExportManager } from '@blocksuite/affine/blocks/surface';

export const notes = signal<NoteMeta[]>([]);
export const activeNoteId = signal<string | null>(null);
export const activeMode = signal<'page' | 'edgeless'>('page');
export const saving = signal(false);
export const sidebarVisible = signal(true);

export function toggleSidebar() {
  sidebarVisible.value = !sidebarVisible.value;
}

let activeStore: Store | null = null;
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
let workspace: TestWorkspace;
let editorEl: PeakEditorContainer;

export function init(ws: TestWorkspace, editor: PeakEditorContainer) {
  workspace = ws;
  editorEl = editor;
}

export async function loadNoteList() {
  const loaded = await listNotes();
  loaded.sort((a, b) => b.updatedAt - a.updatedAt);
  notes.value = loaded;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function extractTitleAndPreview(store: Store): {
  title: string;
  preview: string;
} {
  let title = 'Untitled';
  let preview = '';

  if (!store.root) return { title, preview };

  // Read title from the doc-title (affine:page root block's props.title)
  const rootTitle = (store.root as any).props?.title;
  if (rootTitle) {
    const str = rootTitle.toString().trim();
    if (str) title = str;
  }

  // Read preview from the first text block in the note
  const blocks = store.root.children;
  for (const block of blocks) {
    if (block.flavour === 'affine:note') {
      for (const child of block.children) {
        const text = (child as any).text;
        if (text) {
          const str = text.toString().trim();
          if (str) {
            preview = str;
            break;
          }
        }
      }
      if (preview) break;
    }
  }

  if (preview.length > 100) {
    preview = preview.slice(0, 100) + '...';
  }

  return { title, preview };
}

export function setMode(mode: 'page' | 'edgeless') {
  activeMode.value = mode;
  editorEl.switchEditor(mode);
  scheduleAutoSave();
}

function scheduleAutoSave() {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  saving.value = true;
  autoSaveTimer = setTimeout(async () => {
    if (activeStore && activeNoteId.value) {
      const { title, preview } = extractTitleAndPreview(activeStore);
      const mode = activeMode.value;
      const ydoc = getYDoc(activeStore);
      const noteMeta = notes.value.find(n => n.id === activeNoteId.value);
      await saveNote(activeNoteId.value, title, preview, mode, ydoc, noteMeta?.pinned || false);

      const updated = notes.value.map(n =>
        n.id === activeNoteId.value
          ? { ...n, title, preview, mode, updatedAt: Date.now() }
          : n
      );
      updated.sort((a, b) => b.updatedAt - a.updatedAt);
      notes.value = updated;
    }
    saving.value = false;
  }, 500);
}

let ydocObserver: (() => void) | null = null;

function attachAutoSave(store: Store) {
  if (ydocObserver) {
    ydocObserver();
    ydocObserver = null;
  }

  const ydoc = getYDoc(store);
  const handler = () => scheduleAutoSave();
  ydoc.on('update', handler);
  ydocObserver = () => ydoc.off('update', handler);
}

export async function selectNote(id: string) {
  if (activeNoteId.value === id) return;

  // Save current note before switching
  await saveCurrentNote();

  activeNoteId.value = id;
  localStorage.setItem('peak-last-note', id);

  // Remove old doc if it exists
  try {
    workspace.removeDoc(id);
  } catch {
    // ignore
  }

  const data = await loadNote(id);
  if (data) {
    activeStore = loadExistingDoc(workspace, id, data);
  } else {
    activeStore = createNewDoc(workspace, id);
  }

  const store = activeStore;
  const noteMeta = notes.value.find(n => n.id === id);
  const mode = (noteMeta?.mode as 'page' | 'edgeless') || 'page';
  activeMode.value = mode;

  editorEl.doc = store;
  editorEl.pageSpecs = getPageSpecs(editorEl);
  editorEl.edgelessSpecs = getEdgelessSpecs(editorEl);
  editorEl.mode = mode;

  attachAutoSave(store);
}

async function saveCurrentNote() {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }

  if (activeStore && activeNoteId.value) {
    const { title, preview } = extractTitleAndPreview(activeStore);
    const ydoc = getYDoc(activeStore);
    const curMeta = notes.value.find(n => n.id === activeNoteId.value);
    await saveNote(activeNoteId.value, title, preview, activeMode.value, ydoc, curMeta?.pinned || false);
  }
}

export async function createNote() {
  await saveCurrentNote();

  const id = generateId();
  const now = Date.now();

  const meta: NoteMeta = {
    id,
    title: 'Untitled',
    createdAt: now,
    updatedAt: now,
    preview: '',
  };

  notes.value = [meta, ...notes.value];

  activeStore = createNewDoc(workspace, id);
  activeNoteId.value = id;
  activeMode.value = 'page';

  const store = activeStore;
  editorEl.doc = store;
  editorEl.pageSpecs = getPageSpecs(editorEl);
  editorEl.edgelessSpecs = getEdgelessSpecs(editorEl);
  editorEl.mode = 'page';
  editorEl.autofocus = true;

  attachAutoSave(store);

  // Save initial empty state
  const ydoc = getYDoc(store);
  await saveNote(id, 'Untitled', '', 'page', ydoc, false);
}

export async function deleteNote(id: string) {
  // Detach auto-save observer before anything else
  if (ydocObserver) {
    ydocObserver();
    ydocObserver = null;
  }
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
  saving.value = false;

  await deleteNoteFromDisk(id);

  try {
    workspace.removeDoc(id);
  } catch {
    // ignore
  }

  const updated = notes.value.filter(n => n.id !== id);
  notes.value = updated;

  if (activeNoteId.value === id) {
    activeNoteId.value = null;
    activeStore = null;

    if (updated.length > 0) {
      await selectNote(updated[0].id);
    }
  }
}

export async function duplicateNote(id: string) {
  const sourceMeta = notes.value.find(n => n.id === id);
  if (!sourceMeta) return;

  const data = await loadNote(id);
  if (!data) return;

  const newId = generateId();
  const now = Date.now();
  const newTitle = `Copy of ${sourceMeta.title}`;

  const meta: NoteMeta = {
    id: newId,
    title: newTitle,
    createdAt: now,
    updatedAt: now,
    preview: sourceMeta.preview,
    mode: sourceMeta.mode,
  };

  notes.value = [meta, ...notes.value];

  // Save the duplicated Yjs data under the new ID
  const tmpDoc = new Y.Doc();
  Y.applyUpdate(tmpDoc, data);
  await saveNote(newId, newTitle, sourceMeta.preview, sourceMeta.mode || 'page', tmpDoc, false);
  tmpDoc.destroy();

  await selectNote(newId);
}

export async function togglePinNote(id: string) {
  const updated = notes.value.map(n =>
    n.id === id ? { ...n, pinned: !n.pinned } : n
  );
  notes.value = updated;

  // Persist the pinned state by re-saving the note
  const note = updated.find(n => n.id === id);
  if (note) {
    const data = await loadNote(id);
    if (data) {
      const tmpDoc = new Y.Doc();
      Y.applyUpdate(tmpDoc, data);
      await saveNote(id, note.title, note.preview, note.mode || 'page', tmpDoc, note.pinned || false);
      tmpDoc.destroy();
    }
  }
}

export function setupLinkedDocNavigation() {
  // Subscribe to linked doc clicks from BlockSuite
  const trySubscribe = () => {
    try {
      const slots = editorEl.std?.getOptional(RefNodeSlotsProvider);
      if (slots) {
        slots.docLinkClicked.subscribe(async ({ pageId }) => {
          if (!pageId) return;

          // Check if this note exists in our list
          const existing = notes.value.find(n => n.id === pageId);
          if (existing) {
            await selectNote(pageId);
          } else {
            // New doc created by @ menu — create a note entry for it
            const doc = workspace.getDoc(pageId);
            if (doc) {
              const store = doc.getStore();
              doc.load();
              const now = Date.now();
              const meta: NoteMeta = {
                id: pageId,
                title: 'Untitled',
                createdAt: now,
                updatedAt: now,
                preview: '',
              };
              notes.value = [meta, ...notes.value];

              // Save initial state
              const ydoc = getYDoc(store);
              await saveNote(pageId, 'Untitled', '', 'page', ydoc, false);
            }
            await selectNote(pageId);
          }
        });
        return true;
      }
    } catch {
      // std not ready yet
    }
    return false;
  };

  // Retry until editor std is available
  if (!trySubscribe()) {
    const interval = setInterval(() => {
      if (trySubscribe()) clearInterval(interval);
    }, 200);
  }
}

/**
 * Intercept external link clicks and window.open calls so they open
 * in the system browser instead of navigating the Tauri webview.
 */
export function setupExternalLinkHandler() {
  const { openUrl } = await_import_opener();

  // Intercept clicks on <a> tags with external hrefs
  document.addEventListener('click', (e) => {
    const anchor = (e.target as HTMLElement)?.closest?.('a[href]');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!href) return;
    // Skip internal links (relative, javascript:, #hash)
    if (href.startsWith('#') || href.startsWith('javascript:')) return;
    try {
      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) {
        e.preventDefault();
        e.stopPropagation();
        openUrl(url.href);
      }
    } catch {
      // not a valid URL, let default behavior handle it
    }
  }, true);

  // Override window.open for embed blocks (bookmark, github, youtube, etc.)
  const originalOpen = window.open;
  window.open = function(url?: string | URL, target?: string, features?: string) {
    if (url) {
      const urlStr = url.toString();
      try {
        const parsed = new URL(urlStr, window.location.href);
        if (parsed.origin !== window.location.origin) {
          openUrl(parsed.href);
          return null;
        }
      } catch {
        // fall through to original
      }
    }
    return originalOpen.call(window, url, target, features);
  };
}

// Lazy-load the opener plugin to avoid top-level await
function await_import_opener() {
  let _openUrl: ((url: string) => Promise<void>) | null = null;

  return {
    openUrl: (url: string) => {
      if (_openUrl) {
        _openUrl(url);
        return;
      }
      import('@tauri-apps/plugin-opener').then(mod => {
        _openUrl = mod.openUrl;
        _openUrl(url);
      });
    }
  };
}

export function openNoteInNewWindow(id: string) {
  const label = `note-${id}-${Date.now()}`;
  new WebviewWindow(label, {
    url: `index.html?noteId=${id}`,
    title: '',
    width: 900,
    height: 700,
    decorations: false,
    transparent: true,
  });
}

/**
 * Get a Store for the given note id.
 * Returns the active store if it matches, otherwise loads a temporary one.
 */
async function getStoreForNote(id: string): Promise<{ store: Store; temporary: boolean }> {
  if (activeNoteId.value === id && activeStore) {
    return { store: activeStore, temporary: false };
  }
  const data = await loadNote(id);
  if (!data) throw new Error('Note not found');
  const store = loadExistingDoc(workspace, `export-${id}`, data);
  return { store, temporary: true };
}

function cleanupTemporaryStore(id: string) {
  try {
    workspace.removeDoc(`export-${id}`);
  } catch {
    // ignore
  }
}

export async function exportNoteAsMarkdown(id: string) {
  const { store, temporary } = await getStoreForNote(id);
  try {
    await MarkdownTransformer.exportDoc(store);
  } finally {
    if (temporary) cleanupTemporaryStore(id);
  }
}

export async function exportNoteAsHtml(id: string) {
  const { store, temporary } = await getStoreForNote(id);
  try {
    await HtmlTransformer.exportDoc(store);
  } finally {
    if (temporary) cleanupTemporaryStore(id);
  }
}

export async function exportNoteAsPdf(id: string) {
  // PDF export uses html2canvas on the live editor, so the note must be active
  if (activeNoteId.value !== id) {
    await selectNote(id);
    // Wait for the editor to render
    await new Promise(r => setTimeout(r, 300));
  }
  const exportManager = editorEl.std?.get(ExportManager);
  if (exportManager) {
    await exportManager.exportPdf();
  }
}
