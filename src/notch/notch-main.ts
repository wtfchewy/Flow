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

// --- Drag-and-drop markdown import ---
// Listen on document so the full webview area is a drop target.
// dragenter + dragover must preventDefault for drop to fire.
let dragEnterCount = 0;

document.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragEnterCount++;
  if (!opened) open();
  island.classList.add('notch-drop-target');
}, true);

document.addEventListener('dragover', (e) => {
  e.preventDefault();
}, true);

document.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dragEnterCount--;
  if (dragEnterCount <= 0) {
    dragEnterCount = 0;
    island.classList.remove('notch-drop-target');
  }
}, true);

document.addEventListener('drop', async (e) => {
  e.preventDefault();
  dragEnterCount = 0;
  island.classList.remove('notch-drop-target');

  const files = Array.from(e.dataTransfer?.files ?? []);
  const importable = files.filter(f => {
    const name = f.name.toLowerCase();
    return name.endsWith('.md') || name.endsWith('.html') || name.endsWith('.htm') || name.endsWith('.zip');
  });

  if (importable.length > 0) {
    island.classList.add('notch-drop-success');

    for (const file of importable) {
      const name = file.name.toLowerCase();
      if (name.endsWith('.md')) {
        const markdown = await file.text();
        const fileName = file.name.replace(/\.md$/i, '');
        await emit('notch-import-markdown', JSON.stringify({ markdown, fileName }));
      } else if (name.endsWith('.html') || name.endsWith('.htm')) {
        const html = await file.text();
        const fileName = file.name.replace(/\.html?$/i, '');
        await emit('notch-import-html', JSON.stringify({ html, fileName }));
      } else if (name.endsWith('.zip')) {
        const buffer = await file.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        const fileName = file.name;
        await emit('notch-import-zip', JSON.stringify({ base64, fileName }));
      }
    }

    setTimeout(() => {
      island.classList.remove('notch-drop-success');
      close();
    }, 800);
  }
}, true);

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
