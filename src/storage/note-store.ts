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
import { getIdentity } from '../collab/identity';
import type { PeakEditorContainer } from '../editor/editor-container';
import {
  listNotes,
  saveNote,
  loadNote,
  deleteNoteFromDisk,
} from './persistence';
import { isTauri } from '../platform/platform';
import * as collabStore from '../collab/collab-store';

export const notes = signal<NoteMeta[]>([]);
export const activeNoteId = signal<string | null>(null);
export const activeMode = signal<'page' | 'edgeless'>('page');
export const saving = signal(false);
export const sidebarVisible = signal(true);

export function toggleSidebar() {
  sidebarVisible.value = !sidebarVisible.value;
}

export let activeStore: Store | null = null;
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
let workspace: TestWorkspace;
let editorEl: PeakEditorContainer;

export function getActiveStore(): Store | null {
  return activeStore;
}

export function getWorkspaceRef(): TestWorkspace {
  return workspace;
}

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

  // Skip disk save for non-host shared notes (server is authoritative)
  const noteMeta = notes.value.find(n => n.id === activeNoteId.value);
  if (noteMeta?.shared && !noteMeta.isHost) {
    // Still update title/preview in memory for sidebar display
    if (activeStore && activeNoteId.value) {
      const { title, preview } = extractTitleAndPreview(activeStore);
      const updated = notes.value.map(n =>
        n.id === activeNoteId.value ? { ...n, title, preview, updatedAt: Date.now() } : n
      );
      notes.value = updated;
    }
    return;
  }

  saving.value = true;
  autoSaveTimer = setTimeout(async () => {
    if (activeStore && activeNoteId.value) {
      const { title, preview } = extractTitleAndPreview(activeStore);
      const mode = activeMode.value;
      const ydoc = getYDoc(activeStore);
      const meta = notes.value.find(n => n.id === activeNoteId.value);
      await saveNote(activeNoteId.value, title, preview, mode, ydoc, meta?.pinned || false);

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

  const noteMeta = notes.value.find(n => n.id === id);
  const session = collabStore.getSession(id);

  if (session) {
    // Shared note with active collab session — reuse existing doc, don't reload
    const doc = workspace.getDoc(id);
    if (doc) {
      activeStore = doc.getStore({ id });
    }
  } else {
    // Regular note — remove old doc and reload from disk
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
  }

  const store = activeStore;
  const mode = (noteMeta?.mode as 'page' | 'edgeless') || 'page';
  activeMode.value = mode;

  if (store) {
    editorEl.doc = store;
    editorEl.pageSpecs = getPageSpecs(editorEl);
    editorEl.edgelessSpecs = getEdgelessSpecs(editorEl);
    editorEl.mode = mode;
  }

  // Activate/deactivate collab awareness for this note
  if (session && store) {
    collabStore.activateSession(id);
    session.provider.rebindDoc(store.spaceDoc);
  } else {
    collabStore.deactivateAwareness();
  }

  if (store) {
    attachAutoSave(store);
  }
}

async function saveCurrentNote() {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }

  if (activeStore && activeNoteId.value) {
    // Skip disk save for non-host shared notes (server is authoritative)
    const curMeta = notes.value.find(n => n.id === activeNoteId.value);
    if (curMeta?.shared && !curMeta.isHost) return;

    const { title, preview } = extractTitleAndPreview(activeStore);
    const ydoc = getYDoc(activeStore);
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
  const noteMeta = notes.value.find(n => n.id === id);

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

  // Handle shared note deletion
  if (noteMeta?.shared) {
    if (noteMeta.isHost) {
      collabStore.closeRoom(id);
    } else {
      collabStore.leaveRoom(id);
    }
  }

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

/** Join a shared room, creating a local note entry for it */
export async function joinSharedNote(roomId: string, token: string, ws?: TestWorkspace, docId?: string) {
  // Use the host's docId if provided — this ensures the store ID matches the host's,
  // which is required for BlockSuite's awareness selections (cursors) to work.
  const id = docId || generateId();
  const now = Date.now();

  const meta: NoteMeta = {
    id,
    title: 'Shared Note',
    createdAt: now,
    updatedAt: now,
    preview: '',
    shared: true,
    roomId,
    roomToken: token,
    isHost: false,
  };

  notes.value = [meta, ...notes.value];

  // Create an EMPTY doc — no initial blocks. Provider will sync content from host.
  const collection = ws || workspace;
  const bsDoc = collection.getDoc(id) ?? collection.createDoc(id);
  const store = bsDoc.getStore({ id });

  activeStore = store;
  activeNoteId.value = id;
  activeMode.value = 'page';

  // Set editor to this store (will show empty until sync completes)
  editorEl.doc = store;
  editorEl.pageSpecs = getPageSpecs(editorEl);
  editorEl.edgelessSpecs = getEdgelessSpecs(editorEl);
  editorEl.mode = 'page';

  // Join the room — provider syncs Yjs data into the spaceDoc
  const spaceDoc = getYDoc(store);
  const session = collabStore.joinRoom(id, roomId, token, spaceDoc);

  // After sync: load the store (initializes block tree + StoreSelectionExtension for cursors)
  session.provider.on('synced', () => {
    // store.load() calls doc.load() internally AND initializes extensions
    // (StoreSelectionExtension.loaded() attaches the awareness listener for remote cursors)
    store.load();

    // Set awareness user info
    const identity = getIdentity();
    if (collection.awarenessStore) {
      collection.awarenessStore.setLocalStateField('user', { name: identity.name });
      collection.awarenessStore.setLocalStateField('color', identity.color);
    }

    // Announce presence after a tick
    setTimeout(() => session.provider.announcePresence(), 200);
  });

  attachAutoSave(store);
}

export async function openNoteInNewWindow(id: string) {
  if (isTauri) {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    const label = `note-${id}-${Date.now()}`;
    new WebviewWindow(label, {
      url: `index.html?noteId=${id}`,
      title: '',
      width: 900,
      height: 700,
      decorations: false,
      transparent: true,
    });
  } else {
    window.open(`?noteId=${id}`, '_blank');
  }
}
