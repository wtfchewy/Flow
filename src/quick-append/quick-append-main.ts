import './quick-append-style.css';
import { invoke } from '@tauri-apps/api/core';
import { emitTo, listen } from '@tauri-apps/api/event';
import { render } from 'lit';
import { ArrowDownSmallIcon } from '@blocksuite/icons/lit';

import {
  initBlockSuite,
  createWorkspace,
  createNewDoc,
  getPageSpecs,
  getEdgelessSpecs,
} from '../editor/setup';
import '../editor/editor-container';
import type { PeakEditorContainer } from '../editor/editor-container';
import type { Store } from '@blocksuite/affine/store';
import type { TestWorkspace } from '@blocksuite/affine/store/test';
import type { BlockModel } from '@blocksuite/affine/store';

interface NoteMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  preview: string;
  mode: string;
  pinned: boolean;
}

const root = document.getElementById('quick-append-root')!;

// Apply the user's theme so the popup matches the rest of the app.
async function applyTheme() {
  try {
    const settings = await invoke<{ theme: string }>('load_settings');
    document.documentElement.dataset.theme = settings?.theme === 'light' ? 'light' : 'dark';
  } catch {
    document.documentElement.dataset.theme = 'dark';
  }
}

// Mirror main.ts's makeDraggable: clicking on non-interactive areas of the
// element starts a native window drag.
function makeDraggable(el: HTMLElement) {
  el.addEventListener('mousedown', async (e) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest(
      'button, input, textarea, select, a, [contenteditable], '
      + '.qa-picker-panel, .peak-editor-container, peak-editor-container, '
      + '.affine-page-viewport, rich-text, .qa-editor-host'
    )) return;
    e.preventDefault();
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      getCurrentWindow().startDragging();
    } catch {
      // Not running in Tauri.
    }
  });
}

// --- DOM scaffolding ---
//
// Mirrors the main app's structure exactly:
//   #quick-append-root  ← like #app: full-window rounded secondary surface
//     .qa-drag-wrap     ← like .peak-editor-drag-wrap: 8px draggable padding
//       .qa-panel       ← like .peak-editor-area: rounded primary panel

const dragWrap = document.createElement('div');
dragWrap.className = 'qa-drag-wrap';

const panel = document.createElement('div');
panel.className = 'qa-panel';

const header = document.createElement('div');
header.className = 'qa-header';

const labelEl = document.createElement('span');
labelEl.className = 'qa-label';
labelEl.textContent = 'Append to';

const pickerBtn = document.createElement('button');
pickerBtn.className = 'qa-note-picker';
pickerBtn.type = 'button';

const pickerLabel = document.createElement('span');
pickerLabel.className = 'qa-note-picker-label';
pickerLabel.textContent = 'Loading…';

const pickerChevron = document.createElement('span');
pickerChevron.className = 'qa-chevron';
render(ArrowDownSmallIcon({ width: '14', height: '14' }), pickerChevron);

pickerBtn.appendChild(pickerLabel);
pickerBtn.appendChild(pickerChevron);

const spacer = document.createElement('div');
spacer.className = 'qa-spacer';

const hint = document.createElement('div');
hint.className = 'qa-hint';
hint.innerHTML = '<kbd>⌘</kbd><kbd>↵</kbd> to append';

header.appendChild(labelEl);
header.appendChild(pickerBtn);
header.appendChild(spacer);
header.appendChild(hint);

const body = document.createElement('div');
body.className = 'qa-body';

// Host element for the BlockSuite editor — the editor sets its own height,
// we just give it a flex container.
const editorHost = document.createElement('div');
editorHost.className = 'qa-editor-host';
body.appendChild(editorHost);

panel.appendChild(header);
panel.appendChild(body);
dragWrap.appendChild(panel);
root.appendChild(dragWrap);

makeDraggable(dragWrap);

// --- BlockSuite scratch editor ---

const SCRATCH_DOC_ID = 'quick-append-scratch';

let scratchWorkspace: TestWorkspace | null = null;
let scratchEditor: PeakEditorContainer | null = null;
let scratchStore: Store | null = null;

function ensureEditor() {
  if (scratchEditor) return;
  initBlockSuite();
  scratchWorkspace = createWorkspace();

  const editor = document.createElement('peak-editor-container') as PeakEditorContainer;
  editor.classList.add('qa-editor');
  editor.style.flex = '1';
  editor.style.minHeight = '0';
  editor.style.width = '100%';
  editorHost.appendChild(editor);
  scratchEditor = editor;
}

function resetEditor() {
  if (!scratchWorkspace) ensureEditor();
  if (!scratchWorkspace || !scratchEditor) return;

  // Tear down the previous scratch doc so the editor starts empty.
  try { scratchWorkspace.removeDoc(SCRATCH_DOC_ID); } catch { /* ignore */ }

  scratchStore = createNewDoc(scratchWorkspace, SCRATCH_DOC_ID);
  scratchEditor.doc = scratchStore;
  scratchEditor.pageSpecs = getPageSpecs(scratchEditor);
  scratchEditor.edgelessSpecs = getEdgelessSpecs(scratchEditor);
  scratchEditor.mode = 'page';
  scratchEditor.autofocus = true;
}

// Walk the scratch doc's affine:note children and produce a markdown string.
// Loses inline formatting but preserves block structure (headings, lists,
// quotes, code blocks, dividers). Good enough for quick-append; the receiver
// uses BlockSuite's markdown importer so anything we emit gets faithfully
// re-blocked.
function docToMarkdown(store: Store): string {
  const noteBlock = store.root?.children.find(b => b.flavour === 'affine:note');
  if (!noteBlock) return '';

  const lines: string[] = [];
  for (const child of noteBlock.children) {
    const md = blockToMarkdown(child, 0);
    if (md.length > 0) lines.push(md);
  }
  return lines.join('\n\n');
}

function blockToMarkdown(block: BlockModel, depth: number): string {
  const flavour = block.flavour;
  const props = (block as any).props ?? {};
  const text = (props.text?.toString() ?? '').replace(/​/g, '');
  const indent = '  '.repeat(depth);

  let out = '';
  switch (flavour) {
    case 'affine:paragraph': {
      const type = props.type || 'text';
      if (type === 'h1') out = `# ${text}`;
      else if (type === 'h2') out = `## ${text}`;
      else if (type === 'h3') out = `### ${text}`;
      else if (type === 'h4') out = `#### ${text}`;
      else if (type === 'h5') out = `##### ${text}`;
      else if (type === 'h6') out = `###### ${text}`;
      else if (type === 'quote') out = `> ${text}`;
      else out = text;
      break;
    }
    case 'affine:list': {
      const type = props.type || 'bulleted';
      if (type === 'todo') out = `${indent}- [${props.checked ? 'x' : ' '}] ${text}`;
      else if (type === 'numbered') out = `${indent}1. ${text}`;
      else out = `${indent}- ${text}`;
      break;
    }
    case 'affine:code': {
      const lang = (props.language || '').toString();
      out = `\`\`\`${lang}\n${text}\n\`\`\``;
      break;
    }
    case 'affine:divider':
      out = '---';
      break;
    default:
      out = text;
  }

  if (block.children.length > 0) {
    const childLines: string[] = [];
    for (const child of block.children) {
      const md = blockToMarkdown(child, depth + 1);
      if (md.length > 0) childLines.push(md);
    }
    if (childLines.length > 0) {
      out += (out ? '\n' : '') + childLines.join('\n');
    }
  }
  return out;
}

// --- Note picker state ---
let allNotes: NoteMeta[] = [];
let selectedNoteId: string | null = null;
let pickerPanel: HTMLDivElement | null = null;
let pickerActiveIdx = 0;
let pickerFiltered: NoteMeta[] = [];

const LAST_NOTE_KEY = 'peak-last-note';
const LAST_QUICK_NOTE_KEY = 'peak-last-quick-append-note';

function pickDefaultNoteId(): string | null {
  const stored = localStorage.getItem(LAST_QUICK_NOTE_KEY)
    || localStorage.getItem(LAST_NOTE_KEY);
  if (stored && allNotes.find(n => n.id === stored)) return stored;
  if (allNotes.length > 0) return allNotes[0].id;
  return null;
}

function setSelectedNote(id: string | null) {
  selectedNoteId = id;
  if (id) localStorage.setItem(LAST_QUICK_NOTE_KEY, id);
  const meta = allNotes.find(n => n.id === id);
  pickerLabel.textContent = meta?.title?.trim() || 'Untitled';
}

async function loadNotes() {
  try {
    const notes = await invoke<NoteMeta[]>('list_notes');
    notes.sort((a, b) => b.updatedAt - a.updatedAt);
    allNotes = notes;
  } catch {
    allNotes = [];
  }
  setSelectedNote(pickDefaultNoteId());
}

// --- Note picker (in-card panel) ---

function renderPickerList(query: string) {
  if (!pickerPanel) return;
  const list = pickerPanel.querySelector('.qa-picker-list') as HTMLDivElement;
  list.innerHTML = '';

  const q = query.trim().toLowerCase();
  pickerFiltered = q
    ? allNotes.filter(n => (n.title || 'Untitled').toLowerCase().includes(q))
    : allNotes;
  pickerActiveIdx = Math.min(pickerActiveIdx, Math.max(0, pickerFiltered.length - 1));

  if (pickerFiltered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'qa-picker-empty';
    empty.textContent = allNotes.length === 0 ? 'No notes yet' : 'No matching notes';
    list.appendChild(empty);
    return;
  }

  pickerFiltered.forEach((note, idx) => {
    const item = document.createElement('div');
    item.className = 'qa-picker-item';
    if (idx === pickerActiveIdx) item.classList.add('qa-active');
    if (note.id === selectedNoteId) item.classList.add('qa-selected');
    item.textContent = note.title?.trim() || 'Untitled';

    item.addEventListener('mouseenter', () => {
      pickerActiveIdx = idx;
      list.querySelectorAll('.qa-picker-item').forEach((el, i) => {
        el.classList.toggle('qa-active', i === idx);
      });
    });
    item.addEventListener('mousedown', (ev) => {
      ev.preventDefault();
      setSelectedNote(note.id);
      closePicker();
      focusEditor();
    });
    list.appendChild(item);
  });
}

function highlightActive() {
  if (!pickerPanel) return;
  const list = pickerPanel.querySelector('.qa-picker-list') as HTMLDivElement;
  list.querySelectorAll('.qa-picker-item').forEach((el, i) => {
    el.classList.toggle('qa-active', i === pickerActiveIdx);
  });
  const active = list.querySelector('.qa-picker-item.qa-active') as HTMLElement | null;
  if (active) active.scrollIntoView({ block: 'nearest' });
}

function onPickerKey(ev: KeyboardEvent) {
  if (!pickerPanel) return;
  if (ev.key === 'Escape') {
    ev.preventDefault();
    ev.stopPropagation();
    closePicker();
    focusEditor();
    return;
  }
  if (ev.key === 'ArrowDown') {
    ev.preventDefault();
    if (pickerFiltered.length === 0) return;
    pickerActiveIdx = (pickerActiveIdx + 1) % pickerFiltered.length;
    highlightActive();
    return;
  }
  if (ev.key === 'ArrowUp') {
    ev.preventDefault();
    if (pickerFiltered.length === 0) return;
    pickerActiveIdx = (pickerActiveIdx - 1 + pickerFiltered.length) % pickerFiltered.length;
    highlightActive();
    return;
  }
  if (ev.key === 'Enter' && !ev.metaKey && !ev.ctrlKey) {
    ev.preventDefault();
    const note = pickerFiltered[pickerActiveIdx];
    if (note) {
      setSelectedNote(note.id);
      closePicker();
      focusEditor();
    }
  }
}

function openPicker() {
  if (pickerPanel) {
    closePicker();
    return;
  }
  pickerPanel = document.createElement('div');
  pickerPanel.className = 'qa-picker-panel';

  const searchWrap = document.createElement('div');
  searchWrap.className = 'qa-picker-search-wrap';

  const search = document.createElement('input');
  search.type = 'text';
  search.className = 'qa-picker-search';
  search.placeholder = 'Search notes…';
  search.addEventListener('input', () => renderPickerList(search.value));

  searchWrap.appendChild(search);

  const list = document.createElement('div');
  list.className = 'qa-picker-list';

  pickerPanel.appendChild(searchWrap);
  pickerPanel.appendChild(list);
  body.appendChild(pickerPanel);

  const currentIdx = allNotes.findIndex(n => n.id === selectedNoteId);
  pickerActiveIdx = currentIdx >= 0 ? currentIdx : 0;
  renderPickerList('');

  search.focus();
  document.addEventListener('keydown', onPickerKey, true);
}

function closePicker() {
  if (!pickerPanel) return;
  pickerPanel.remove();
  pickerPanel = null;
  document.removeEventListener('keydown', onPickerKey, true);
}

pickerBtn.addEventListener('click', (ev) => {
  ev.stopPropagation();
  if (pickerPanel) {
    closePicker();
    focusEditor();
  } else {
    openPicker();
  }
});

// Focus the editor's rich-text reliably. The popup is shown asynchronously
// and the WebView body grabs focus once the OS makes the window key, so a
// single focus call loses the race. Instead we re-apply focusEnd() every
// ~16ms for half a second — once the inline editor exists and the OS has
// finished focusing the window, our call sticks. Subsequent calls on an
// already-focused element are a no-op so this is safe.
let focusInterval: ReturnType<typeof setInterval> | null = null;

function focusEditor() {
  if (focusInterval) clearInterval(focusInterval);
  if (!scratchEditor) return;
  let attempts = 0;
  focusInterval = setInterval(() => {
    if (!scratchEditor) {
      if (focusInterval) clearInterval(focusInterval);
      focusInterval = null;
      return;
    }
    const richText = scratchEditor.querySelector('rich-text') as any;
    richText?.inlineEditor?.focusEnd?.();
    if (++attempts >= 30) {
      if (focusInterval) clearInterval(focusInterval);
      focusInterval = null;
    }
  }, 16);
}

// --- Submission ---
let lastDismissAt = 0;

async function submit() {
  if (!scratchStore || !selectedNoteId) return;
  const markdown = docToMarkdown(scratchStore).trim();
  if (!markdown) return;

  try {
    await emitTo('main', 'quick-append-submit', { noteId: selectedNoteId, markdown });
  } catch (err) {
    console.error('quick-append: failed to dispatch', err);
  }
  await dismiss();
}

async function dismiss() {
  lastDismissAt = Date.now();
  closePicker();
  // Clear the editor BEFORE hiding so the next time the window is shown
  // it's already blank — no flash of the previous snippet.
  resetEditor();
  try {
    await invoke('hide_quick_append');
  } catch {
    // ignore
  }
}

// Cmd/Ctrl + Enter → submit. Use the capture phase so we beat any BlockSuite
// keymap that might also bind Enter.
document.addEventListener('keydown', (ev) => {
  if ((ev.metaKey || ev.ctrlKey) && ev.key === 'Enter') {
    ev.preventDefault();
    ev.stopPropagation();
    submit();
    return;
  }
  // Escape closes the popup (unless the picker is open and handles it).
  if (ev.key === 'Escape' && !pickerPanel) {
    ev.preventDefault();
    dismiss();
  }
}, true);

// Each time the popup is shown: refresh notes and focus the editor. The
// editor itself was already reset on the last dismiss so no flicker.
function activate() {
  closePicker();
  loadNotes();
  focusEditor();
}

listen('quick-append-opened', activate);
window.addEventListener('focus', activate);

// Auto-dismiss when the popup loses focus (clicked away).
window.addEventListener('blur', () => {
  if (Date.now() - lastDismissAt < 250) return;
  setTimeout(() => {
    if (!document.hasFocus()) dismiss();
  }, 100);
});

// --- Boot ---
(async () => {
  await applyTheme();
  ensureEditor();
  resetEditor();
  await loadNotes();
})();
