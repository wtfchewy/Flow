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
    if (settings?.theme === 'light') {
      document.documentElement.dataset.theme = 'light';
    } else {
      document.documentElement.dataset.theme = 'dark';
    }
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

const editor = document.createElement('textarea');
editor.className = 'qa-editor';
editor.placeholder = 'Type to append…';
editor.spellcheck = true;
editor.autocapitalize = 'sentences';

card.appendChild(header);
card.appendChild(editor);
root.appendChild(card);

// --- State ---
let allNotes: NoteMeta[] = [];
let selectedNoteId: string | null = null;
let dropdown: HTMLDivElement | null = null;

const LAST_NOTE_KEY = 'peak-last-note';
const LAST_QUICK_NOTE_KEY = 'peak-last-quick-append-note';

function pickDefaultNoteId(): string | null {
  const stored = localStorage.getItem(LAST_QUICK_NOTE_KEY)
    || localStorage.getItem(LAST_NOTE_KEY);
  if (stored && allNotes.find(n => n.id === stored)) return stored;
  // Fall back to most recently updated note.
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

// --- Note picker dropdown ---
function closeDropdown() {
  if (!dropdown) return;
  dropdown.remove();
  dropdown = null;
  document.removeEventListener('mousedown', onDocClickAway, true);
  document.removeEventListener('keydown', onDropdownKey, true);
}

function onDocClickAway(ev: MouseEvent) {
  if (!dropdown) return;
  const target = ev.target as Node;
  if (dropdown.contains(target) || pickerBtn.contains(target)) return;
  closeDropdown();
}

let dropdownActiveIdx = 0;
let dropdownFiltered: NoteMeta[] = [];

function renderDropdown(query: string) {
  if (!dropdown) return;
  const q = query.trim().toLowerCase();
  dropdownFiltered = q
    ? allNotes.filter(n => (n.title || 'Untitled').toLowerCase().includes(q))
    : allNotes;
  dropdownActiveIdx = Math.min(dropdownActiveIdx, Math.max(0, dropdownFiltered.length - 1));

  // Clear existing items (keep search input)
  const itemsContainer = dropdown.querySelector('.qa-dropdown-items') as HTMLDivElement;
  itemsContainer.innerHTML = '';

  if (dropdownFiltered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'qa-dropdown-empty';
    empty.textContent = allNotes.length === 0 ? 'No notes yet' : 'No matching notes';
    itemsContainer.appendChild(empty);
    return;
  }

  dropdownFiltered.forEach((note, idx) => {
    const item = document.createElement('div');
    item.className = 'qa-dropdown-item';
    if (idx === dropdownActiveIdx) item.classList.add('qa-active');
    item.textContent = note.title?.trim() || 'Untitled';
    item.addEventListener('mouseenter', () => {
      dropdownActiveIdx = idx;
      itemsContainer.querySelectorAll('.qa-dropdown-item').forEach((el, i) => {
        el.classList.toggle('qa-active', i === idx);
      });
    });
    item.addEventListener('mousedown', (ev) => {
      ev.preventDefault();
      setSelectedNote(note.id);
      closeDropdown();
      editor.focus();
    });
    itemsContainer.appendChild(item);
  });
}

function onDropdownKey(ev: KeyboardEvent) {
  if (!dropdown) return;
  if (ev.key === 'Escape') {
    ev.preventDefault();
    ev.stopPropagation();
    closeDropdown();
    editor.focus();
    return;
  }
  if (ev.key === 'ArrowDown') {
    ev.preventDefault();
    if (dropdownFiltered.length === 0) return;
    dropdownActiveIdx = (dropdownActiveIdx + 1) % dropdownFiltered.length;
    renderDropdownActive();
    return;
  }
  if (ev.key === 'ArrowUp') {
    ev.preventDefault();
    if (dropdownFiltered.length === 0) return;
    dropdownActiveIdx = (dropdownActiveIdx - 1 + dropdownFiltered.length) % dropdownFiltered.length;
    renderDropdownActive();
    return;
  }
  if (ev.key === 'Enter') {
    ev.preventDefault();
    const note = dropdownFiltered[dropdownActiveIdx];
    if (note) {
      setSelectedNote(note.id);
      closeDropdown();
      editor.focus();
    }
  }
}

function renderDropdownActive() {
  if (!dropdown) return;
  dropdown.querySelectorAll('.qa-dropdown-item').forEach((el, i) => {
    el.classList.toggle('qa-active', i === dropdownActiveIdx);
  });
  const active = dropdown.querySelector('.qa-dropdown-item.qa-active') as HTMLElement | null;
  if (active) active.scrollIntoView({ block: 'nearest' });
}

function openDropdown() {
  if (dropdown) {
    closeDropdown();
    return;
  }
  dropdown = document.createElement('div');
  dropdown.className = 'qa-dropdown';

  const search = document.createElement('input');
  search.type = 'text';
  search.className = 'qa-dropdown-search';
  search.placeholder = 'Search notes…';
  search.addEventListener('input', () => renderDropdown(search.value));

  const items = document.createElement('div');
  items.className = 'qa-dropdown-items';

  dropdown.appendChild(search);
  dropdown.appendChild(items);

  card.appendChild(dropdown);

  // Default-highlight the currently selected note for fast confirmation.
  const currentIdx = allNotes.findIndex(n => n.id === selectedNoteId);
  dropdownActiveIdx = currentIdx >= 0 ? currentIdx : 0;
  renderDropdown('');

  search.focus();
  document.addEventListener('mousedown', onDocClickAway, true);
  document.addEventListener('keydown', onDropdownKey, true);
}

pickerBtn.addEventListener('click', (ev) => {
  ev.stopPropagation();
  openDropdown();
});

// --- Submission ---
let lastDismissAt = 0;

async function submit() {
  const text = editor.value;
  if (!text.trim() || !selectedNoteId) return;

  // Send the payload directly to the main window — no Rust intermediary,
  // so the listener receives the structured object as-is.
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
  closeDropdown();
  try {
    await invoke('hide_quick_append');
  } catch {
    // ignore
  }
}

editor.addEventListener('keydown', (ev) => {
  // Cmd/Ctrl + Enter → submit
  if ((ev.metaKey || ev.ctrlKey) && ev.key === 'Enter') {
    ev.preventDefault();
    ev.stopPropagation();
    submit();
  }
});

// Escape closes the popup (unless the picker dropdown is open and handles it).
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && !dropdown) {
    ev.preventDefault();
    dismiss();
  }
});

// Reset state and refresh the note list each time the popup is shown.
async function activate() {
  closeDropdown();
  editor.value = '';
  await loadNotes();
  requestAnimationFrame(() => editor.focus());
}

listen('quick-append-opened', activate);
// Window focus is the most reliable signal that the popup just became visible.
window.addEventListener('focus', activate);

// Auto-dismiss when the popup loses focus (clicked away). Skip if we just
// dismissed programmatically — the window is already hidden, this blur is
// the consequence of that.
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
  // The window starts hidden — focus will be set on the first open event.
})();
