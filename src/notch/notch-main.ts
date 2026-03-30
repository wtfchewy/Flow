import './notch-style.css';
import { emit } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

interface NoteMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  preview: string;
  mode: string;
  pinned: boolean;
}

const widget = document.getElementById('notch-widget')!;

const island = document.createElement('div');
island.className = 'notch-island';

const content = document.createElement('div');
content.className = 'notch-content';

const notesRow = document.createElement('div');
notesRow.className = 'notch-notes-row';

content.appendChild(notesRow);
island.appendChild(content);
widget.appendChild(island);

// --- State ---
let opened = false;
let outsideCount = 0;

function setInteractive(interactive: boolean) {
  invoke('notch_set_interactive', { interactive }).catch(() => {});
}

async function loadRecentNotes() {
  try {
    const allNotes = await invoke<NoteMeta[]>('list_notes');
    allNotes.sort((a, b) => b.updatedAt - a.updatedAt);
    const recent = allNotes.slice(0, 4);
    renderNotes(recent);
  } catch {
    // ignore
  }
}

function renderNotes(notesList: NoteMeta[]) {
  notesRow.innerHTML = '';

  // Note cards
  for (const note of notesList) {
    const item = document.createElement('button');
    item.className = 'notch-note-item';
    item.title = note.title || 'Untitled';

    const title = document.createElement('div');
    title.className = 'notch-note-title';
    title.textContent = note.title || 'Untitled';

    const body = document.createElement('div');
    body.className = 'notch-note-body';
    body.textContent = note.preview || '';

    item.appendChild(title);
    item.appendChild(body);

    item.addEventListener('click', async () => {
      await emit('notch-open-note', note.id);
      close();
    });

    notesRow.appendChild(item);
  }

  // + button always at the end
  const btn = document.createElement('button');
  btn.className = 'notch-note-item notch-btn-new';
  btn.title = 'New note';
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
  btn.addEventListener('click', async () => {
    await emit('notch-create-note');
    close();
  });
  notesRow.appendChild(btn);
}

function open() {
  if (opened) return;
  opened = true;
  outsideCount = 0;
  island.classList.add('opened');
  setInteractive(true);
  loadRecentNotes();
  setTimeout(() => {
    if (opened) getCurrentWindow().setFocus().catch(() => {});
  }, 500);
}

function close() {
  if (!opened) return;
  opened = false;
  island.classList.remove('opened');
  setInteractive(false);
}

// --- Cursor polling ---
setInterval(async () => {
  try {
    const [inHoverZone, inWindow]: [boolean, boolean] = await invoke('notch_poll_cursor');

    if (!opened) {
      if (inHoverZone) {
        open();
      }
    } else {
      if (inWindow) {
        outsideCount = 0;
      } else {
        outsideCount++;
        if (outsideCount >= 6) {
          close();
        }
      }
    }
  } catch {
    // ignore
  }
}, 50);
