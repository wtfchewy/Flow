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
  getStoreExtensions,
  RefNodeSlotsProvider,
} from '../editor/setup';
import type { PeakEditorContainer } from '../editor/editor-container';
import {
  listNotes,
  saveNote,
  loadNote,
  deleteNoteFromDisk,
} from './persistence';
import { isTauri } from '../platform';
import {
  MarkdownTransformer,
  HtmlTransformer,
  NotionHtmlTransformer,
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

async function updateWindowTitle(title: string) {
  const displayTitle = title || 'Untitled';
  document.title = displayTitle;
  if (isTauri()) {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    getCurrentWindow().setTitle(displayTitle);
  }
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

      updateWindowTitle(title);
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

  updateWindowTitle(noteMeta?.title || 'Untitled');
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
  updateWindowTitle('Untitled');

  // Save initial empty state
  const ydoc = getYDoc(store);
  await saveNote(id, 'Untitled', '', 'page', ydoc, false);
}

export async function importMarkdownFile(file: File) {
  await saveCurrentNote();

  let markdown = await file.text();
  const fileName = file.name.replace(/\.md$/i, '') || 'Untitled';

  // Extract title from first line if it's a # heading
  let headingTitle = '';
  const firstLineMatch = markdown.match(/^#\s+(.+)/);
  if (firstLineMatch) {
    headingTitle = firstLineMatch[1].trim();
    // Strip the heading line from the markdown body
    markdown = markdown.replace(/^#\s+.+\n?/, '');
  }

  const id = generateId();
  const now = Date.now();

  // Create a new doc with initial structure
  const store = createNewDoc(workspace, id);

  // Set the doc title from the heading
  if (headingTitle && store.root) {
    const titleProp = (store.root as any).props?.title;
    if (titleProp && typeof titleProp.insert === 'function') {
      titleProp.insert(headingTitle, 0);
    }
  }

  // Find the note block to import markdown into
  const noteBlock = store.root?.children.find(b => b.flavour === 'affine:note');
  if (!noteBlock) return;

  // Remove the default empty paragraph
  for (const child of noteBlock.children) {
    store.deleteBlock(child);
  }

  // Import markdown content into the note block
  await MarkdownTransformer.importMarkdownToBlock({
    doc: store,
    blockId: noteBlock.id,
    markdown,
    extensions: getStoreExtensions(),
  });

  // Extract title/preview from the imported content
  const { title, preview } = extractTitleAndPreview(store);
  const finalTitle = headingTitle || (title !== 'Untitled' ? title : fileName);

  const meta: NoteMeta = {
    id,
    title: finalTitle,
    createdAt: now,
    updatedAt: now,
    preview,
  };

  notes.value = [meta, ...notes.value];

  activeStore = store;
  activeNoteId.value = id;
  activeMode.value = 'page';

  editorEl.doc = store;
  editorEl.pageSpecs = getPageSpecs(editorEl);
  editorEl.edgelessSpecs = getEdgelessSpecs(editorEl);
  editorEl.mode = 'page';

  attachAutoSave(store);

  // Save to disk
  const ydoc = getYDoc(store);
  await saveNote(id, finalTitle, preview, 'page', ydoc, false);
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
    activeStore = null;

    if (updated.length > 0) {
      await selectNote(updated[0].id);
    } else {
      // Last note deleted — create a fresh one inline to avoid null flash
      const newId = generateId();
      const now = Date.now();
      const meta: NoteMeta = { id: newId, title: 'Untitled', createdAt: now, updatedAt: now, preview: '' };
      notes.value = [meta];
      activeNoteId.value = newId;
      activeStore = createNewDoc(workspace, newId);
      activeMode.value = 'page';
      editorEl.doc = activeStore;
      editorEl.pageSpecs = getPageSpecs(editorEl);
      editorEl.edgelessSpecs = getEdgelessSpecs(editorEl);
      editorEl.mode = 'page';
      editorEl.autofocus = true;
      attachAutoSave(activeStore);
      updateWindowTitle('Untitled');
      const ydoc = getYDoc(activeStore);
      await saveNote(newId, 'Untitled', '', 'page', ydoc, false);
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
 * In browser mode, external links open in new tabs naturally.
 */
export function setupExternalLinkHandler() {
  if (!isTauri()) {
    // In browser, just ensure external links open in new tabs
    document.addEventListener('click', (e) => {
      const anchor = (e.target as HTMLElement)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href) return;
      if (href.startsWith('#') || href.startsWith('javascript:')) return;
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) {
          e.preventDefault();
          e.stopPropagation();
          window.open(url.href, '_blank', 'noopener');
        }
      } catch {
        // not a valid URL
      }
    }, true);
    return;
  }

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

export async function openNoteInNewWindow(id: string) {
  if (!isTauri()) {
    // In browser, open in a new tab
    window.open(`${window.location.pathname}?noteId=${id}`, '_blank');
    return;
  }
  const noteMeta = notes.value.find(n => n.id === id);
  const title = noteMeta?.title || 'Untitled';
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
  const label = `note-${id}-${Date.now()}`;
  new WebviewWindow(label, {
    url: `index.html?noteId=${id}`,
    title,
    width: 900,
    height: 700,
    decorations: false,
    transparent: true,
    visible: false,
  });
}

/**
 * Get a Store for the given note id.
 * Returns the active store if it matches, otherwise loads a temporary one.
 */
export async function getStoreForNote(id: string): Promise<{ store: Store; temporary: boolean }> {
  if (activeNoteId.value === id && activeStore) {
    return { store: activeStore, temporary: false };
  }
  const data = await loadNote(id);
  if (!data) throw new Error('Note not found');
  const store = loadExistingDoc(workspace, `export-${id}`, data);
  return { store, temporary: true };
}

export function cleanupTemporaryStore(id: string) {
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

// ===== Import functions =====

/** Helper: after importing a doc into the workspace, register it in Peak's note list. */
async function registerImportedDoc(store: Store) {
  const { title, preview } = extractTitleAndPreview(store);
  const now = Date.now();
  const id = store.id;

  const meta: NoteMeta = { id, title, createdAt: now, updatedAt: now, preview };
  notes.value = [meta, ...notes.value];

  activeStore = store;
  activeNoteId.value = id;
  activeMode.value = 'page';

  editorEl.doc = store;
  editorEl.pageSpecs = getPageSpecs(editorEl);
  editorEl.edgelessSpecs = getEdgelessSpecs(editorEl);
  editorEl.mode = 'page';

  attachAutoSave(store);

  const ydoc = getYDoc(store);
  await saveNote(id, title, preview, 'page', ydoc, false);
}

export async function importHtmlFile(file: File) {
  await saveCurrentNote();

  const html = await file.text();
  const fileName = file.name.replace(/\.html?$/i, '') || 'Untitled';
  const schema = workspace.schema;

  const docId = await HtmlTransformer.importHTMLToDoc({
    collection: workspace,
    schema,
    html,
    fileName,
    extensions: getStoreExtensions(),
  });

  if (!docId) return;

  const doc = workspace.getDoc(docId);
  if (!doc) return;
  const store = doc.getStore({ id: docId });
  await registerImportedDoc(store);
}

export async function importMarkdownZip(file: File) {
  await saveCurrentNote();

  const schema = workspace.schema;
  const docIds = await MarkdownTransformer.importMarkdownZip({
    collection: workspace,
    schema,
    imported: file,
    extensions: getStoreExtensions(),
  });

  // Register each imported doc
  for (const id of docIds) {
    const doc = workspace.getDoc(id);
    if (!doc) continue;
    const store = doc.getStore({ id });
    await registerImportedDoc(store);
  }
}

export async function importNotionZip(file: File) {
  await saveCurrentNote();

  const schema = workspace.schema;
  const result = await NotionHtmlTransformer.importNotionZip({
    collection: workspace,
    schema,
    imported: file,
    extensions: getStoreExtensions(),
  });

  // Register each imported doc
  for (const id of result.pageIds) {
    const doc = workspace.getDoc(id);
    if (!doc) continue;
    const store = doc.getStore({ id });
    await registerImportedDoc(store);
  }
}

