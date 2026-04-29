import './quick-append-style.css';
import { invoke } from '@tauri-apps/api/core';
import { emitTo, listen } from '@tauri-apps/api/event';

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

// --- DOM scaffolding ---
const card = document.createElement('div');
card.className = 'qa-card';

const header = document.createElement('div');
header.className = 'qa-header';

const label = document.createElement('span');
label.className = 'qa-label';
label.textContent = 'Append to';

const pickerBtn = document.createElement('button');
pickerBtn.className = 'qa-note-picker';
pickerBtn.type = 'button';

const pickerLabel = document.createElement('span');
pickerLabel.textContent = 'Loading…';

const pickerChevron = document.createElement('span');
pickerChevron.className = 'qa-chevron';
pickerChevron.textContent = '▾';

pickerBtn.appendChild(pickerLabel);
pickerBtn.appendChild(pickerChevron);

const spacer = document.createElement('div');
spacer.className = 'qa-spacer';

const hint = document.createElement('div');
hint.className = 'qa-hint';
hint.innerHTML = '<kbd>⌘</kbd><kbd>↵</kbd> to append';

header.appendChild(label);
header.appendChild(pickerBtn);
header.appendChild(spacer);
header.appendChild(hint);

const body = document.createElement('div');
body.className = 'qa-body';

const editor = document.createElement('textarea');
editor.className = 'qa-editor';
editor.placeholder = 'Type to append…';
editor.spellcheck = true;
editor.autocapitalize = 'sentences';

body.appendChild(editor);

card.appendChild(header);
card.appendChild(body);
root.appendChild(card);

// --- State ---
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

// --- Note picker (in-card panel that replaces the editor while open) ---

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

    const title = document.createElement('span');
    title.className = 'qa-picker-item-title';
    title.textContent = note.title?.trim() || 'Untitled';
    item.appendChild(title);

    if (note.id === selectedNoteId) {
      const check = document.createElement('span');
      check.className = 'qa-picker-item-check';
      check.textContent = '✓';
      item.appendChild(check);
    }

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
      editor.focus();
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
    editor.focus();
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
  if (ev.key === 'Enter') {
    ev.preventDefault();
    const note = pickerFiltered[pickerActiveIdx];
    if (note) {
      setSelectedNote(note.id);
      closePicker();
      editor.focus();
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

  // Default-highlight the currently selected note for fast confirmation.
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
    editor.focus();
  } else {
    openPicker();
  }
});

// --- Submission ---
let lastDismissAt = 0;

async function submit() {
  const text = editor.value;
  if (!text.trim() || !selectedNoteId) return;

  try {
    await emitTo('main', 'quick-append-submit', { noteId: selectedNoteId, text });
  } catch (err) {
    console.error('quick-append: failed to dispatch', err);
  }
  await dismiss();
}

async function dismiss() {
  lastDismissAt = Date.now();
  editor.value = '';
  closePicker();
  try {
    await invoke('hide_quick_append');
  } catch {
    // ignore
  }
}

editor.addEventListener('keydown', (ev) => {
  if ((ev.metaKey || ev.ctrlKey) && ev.key === 'Enter') {
    ev.preventDefault();
    ev.stopPropagation();
    submit();
  }
});

// Escape closes the popup (unless the picker is open and handles it).
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && !pickerPanel) {
    ev.preventDefault();
    dismiss();
  }
});

// Reset state and refresh the note list each time the popup is shown.
async function activate() {
  closePicker();
  editor.value = '';
  await loadNotes();
  requestAnimationFrame(() => editor.focus());
}

listen('quick-append-opened', activate);
// Window focus is the most reliable signal that the popup just became visible.
window.addEventListener('focus', activate);

// Auto-dismiss when the popup loses focus (clicked away). Skip if we just
// dismissed programmatically — the window is already hidden and this blur
// is the consequence.
window.addEventListener('blur', () => {
  if (Date.now() - lastDismissAt < 250) return;
  setTimeout(() => {
    if (!document.hasFocus()) dismiss();
  }, 100);
});

// --- Boot ---
(async () => {
  await applyTheme();
  await loadNotes();
})();
