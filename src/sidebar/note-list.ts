import { render } from 'lit';
import { effect } from '@preact/signals-core';
import {
  OpenInNewIcon,
  PinIcon,
  PinedIcon,
  DuplicateIcon,
  DeleteIcon,
  ExportIcon,
  ImportIcon,
} from '@blocksuite/icons/lit';

import { isTauri } from '../platform';
import type { NoteMeta } from '../types';
import {
  notes,
  activeNoteId,
  selectNote,
  deleteNote,
  duplicateNote,
  togglePinNote,
  openNoteInNewWindow,
} from '../storage/note-store';
import { openImportModal } from '../import/import-modal';
import { openExportModal } from '../export/export-modal';

interface NoteGroup {
  label: string;
  notes: NoteMeta[];
}

function groupNotes(noteList: NoteMeta[]): NoteGroup[] {
  const now = Date.now();
  const oneDay = 86400000;
  const sevenDays = 7 * oneDay;
  const thirtyDays = 30 * oneDay;

  const pinned = noteList.filter(n => n.pinned);
  const unpinned = noteList.filter(n => !n.pinned);

  const groups: Map<string, NoteMeta[]> = new Map();
  const groupOrder: string[] = [];

  function addToGroup(label: string, note: NoteMeta) {
    if (!groups.has(label)) {
      groups.set(label, []);
      groupOrder.push(label);
    }
    groups.get(label)!.push(note);
  }

  for (const note of unpinned) {
    const age = now - note.updatedAt;

    if (age < oneDay) {
      addToGroup('Today', note);
    } else if (age < sevenDays) {
      addToGroup('Previous 7 Days', note);
    } else if (age < thirtyDays) {
      addToGroup('Previous 30 Days', note);
    } else {
      const year = new Date(note.updatedAt).getFullYear().toString();
      addToGroup(year, note);
    }
  }

  const result: NoteGroup[] = [];
  if (pinned.length > 0) {
    result.push({ label: 'Pinned', notes: pinned });
  }
  for (const label of groupOrder) {
    result.push({ label, notes: groups.get(label)! });
  }
  return result;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / 86400000
  );

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  } else {
    return date.toLocaleDateString([], {
      month: 'numeric',
      day: 'numeric',
      year: '2-digit',
    });
  }
}

// Context menu management
let activeMenu: HTMLElement | null = null;
let contextTargetItem: HTMLElement | null = null;

function dismissMenu() {
  if (activeMenu) {
    activeMenu.remove();
    activeMenu = null;
  }
  if (contextTargetItem) {
    contextTargetItem.classList.remove('context-target');
    contextTargetItem = null;
  }
  document.removeEventListener('click', dismissMenu);
}

function showContextMenu(e: MouseEvent, note: NoteMeta) {
  e.preventDefault();
  dismissMenu();

  // Highlight the right-clicked note
  const noteItem = (e.target as HTMLElement).closest('.peak-note-item') as HTMLElement | null;
  if (noteItem) {
    noteItem.classList.add('context-target');
    contextTargetItem = noteItem;
  }

  const menu = document.createElement('div');
  menu.className = 'peak-context-menu';
  menu.style.left = `${e.clientX}px`;
  menu.style.top = `${e.clientY}px`;

  function addItem(
    iconFn: (opts: any) => any,
    label: string,
    onClick: () => void,
    danger = false
  ) {
    const item = document.createElement('div');
    item.className = `peak-context-menu-item${danger ? ' danger' : ''}`;

    const iconEl = document.createElement('span');
    iconEl.className = 'peak-context-menu-icon';
    render(iconFn({ width: '18', height: '18' }), iconEl);

    const labelEl = document.createElement('span');
    labelEl.textContent = label;

    item.appendChild(iconEl);
    item.appendChild(labelEl);
    item.addEventListener('click', (ev) => {
      ev.stopPropagation();
      dismissMenu();
      onClick();
    });
    menu.appendChild(item);
  }

  function addSubmenu(
    iconFn: (opts: any) => any,
    label: string,
    items: { icon: (opts: any) => any; label: string; onClick: () => void }[]
  ) {
    const wrapper = document.createElement('div');
    wrapper.className = 'peak-context-submenu-wrapper';

    const trigger = document.createElement('div');
    trigger.className = 'peak-context-menu-item peak-context-submenu-trigger';

    const iconEl = document.createElement('span');
    iconEl.className = 'peak-context-menu-icon';
    render(iconFn({ width: '18', height: '18' }), iconEl);

    const labelEl = document.createElement('span');
    labelEl.textContent = label;

    const arrow = document.createElement('span');
    arrow.className = 'peak-context-submenu-arrow';
    arrow.textContent = '\u203A'; // ›

    trigger.appendChild(iconEl);
    trigger.appendChild(labelEl);
    trigger.appendChild(arrow);

    const sub = document.createElement('div');
    sub.className = 'peak-context-submenu';

    for (const item of items) {
      const subItem = document.createElement('div');
      subItem.className = 'peak-context-menu-item';

      const subIcon = document.createElement('span');
      subIcon.className = 'peak-context-menu-icon';
      render(item.icon({ width: '18', height: '18' }), subIcon);

      const subLabel = document.createElement('span');
      subLabel.textContent = item.label;

      subItem.appendChild(subIcon);
      subItem.appendChild(subLabel);
      subItem.addEventListener('click', (ev) => {
        ev.stopPropagation();
        dismissMenu();
        item.onClick();
      });
      sub.appendChild(subItem);
    }

    wrapper.appendChild(trigger);
    wrapper.appendChild(sub);
    menu.appendChild(wrapper);
  }

  function addSeparator() {
    const sep = document.createElement('div');
    sep.className = 'peak-context-menu-separator';
    menu.appendChild(sep);
  }

  addItem(OpenInNewIcon, 'Open in New Window', () => openNoteInNewWindow(note.id));
  addItem(
    note.pinned ? PinedIcon : PinIcon,
    note.pinned ? 'Unpin Note' : 'Pin Note',
    () => togglePinNote(note.id)
  );
  addItem(DuplicateIcon, 'Duplicate Note', () => duplicateNote(note.id));
  addSeparator();
  addItem(ImportIcon, 'Import', () => openImportModal());
  addItem(ExportIcon, 'Export', () => openExportModal(note.id));
  addSeparator();
  addItem(DeleteIcon, 'Delete Note', () => deleteNote(note.id), true);

  document.body.appendChild(menu);
  activeMenu = menu;

  // Adjust position if menu goes off screen
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    menu.style.left = `${window.innerWidth - rect.width - 8}px`;
  }
  if (rect.bottom > window.innerHeight) {
    menu.style.top = `${window.innerHeight - rect.height - 8}px`;
  }

  setTimeout(() => {
    document.addEventListener('click', dismissMenu);
  });
}

function createNoteItem(note: NoteMeta, isActive: boolean): HTMLElement {
  const item = document.createElement('div');
  item.className = `peak-note-item${isActive ? ' active' : ''}`;
  item.dataset.noteId = note.id;

  item.addEventListener('click', () => selectNote(note.id));
  item.addEventListener('contextmenu', (e) => showContextMenu(e, note));

  const titleEl = document.createElement('div');
  titleEl.className = 'peak-note-item-title';
  titleEl.textContent = note.title || 'Untitled';

  const metaEl = document.createElement('div');
  metaEl.className = 'peak-note-item-meta';

  const dateEl = document.createElement('span');
  dateEl.className = 'peak-note-item-date';
  dateEl.textContent = formatDate(note.updatedAt);

  const previewEl = document.createElement('span');
  previewEl.className = 'peak-note-item-preview';
  previewEl.textContent = note.preview || 'No additional text';

  metaEl.appendChild(dateEl);
  metaEl.appendChild(previewEl);

  item.appendChild(titleEl);
  item.appendChild(metaEl);

  return item;
}

export function renderNoteList(container: HTMLElement) {
  effect(() => {
    const noteList = notes.value;
    const activeId = activeNoteId.value;

    container.innerHTML = '';

    if (noteList.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'peak-empty-state';
      empty.textContent = 'No notes yet';
      container.appendChild(empty);
      return;
    }

    const grouped = groupNotes(noteList);

    for (const group of grouped) {
      const groupEl = document.createElement('div');
      groupEl.className = 'peak-note-group';

      const headerEl = document.createElement('div');
      headerEl.className = 'peak-note-group-header';
      headerEl.textContent = group.label;
      groupEl.appendChild(headerEl);

      for (const note of group.notes) {
        const item = createNoteItem(note, note.id === activeId);
        groupEl.appendChild(item);
      }

      container.appendChild(groupEl);
    }
  });
}
