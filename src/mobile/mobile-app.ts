/**
 * Mobile layout for Peak.
 * Two-view navigation: Note List (home) and Editor (note detail).
 * Slides between views with native-feeling transitions.
 */

import { render } from 'lit';
import {
  NewPageIcon,
  SearchIcon,
  ArrowLeftBigIcon,
  SettingsIcon,
} from '@blocksuite/icons/lit';
import { effect } from '@preact/signals-core';
import { createModeSwitch } from '../mode-switch/mode-switch';
import {
  initBlockSuite,
  createWorkspace,
  getMobilePageSpecs,
  getMobileEdgelessSpecs,
} from '../editor/setup';
import { PeakEditorContainer } from '../editor/editor-container';
import * as noteStore from '../storage/note-store';
import { setSpecProviders } from '../storage/note-store';
import { loadSettings, applySettings } from '../settings/settings';
import { showWelcome } from '../welcome/welcome';
import { isTauri } from '../platform';
import { registerSearchShortcut, openSearchModal } from '../search/search-modal';
import { EdgelessTemplatePanel } from '@blocksuite/affine/gfx/template';
import { peakEdgelessTemplates } from '../templates/edgeless-templates';
import { peakStickerTemplates } from '../templates/sticker-templates';
import type { NoteMeta } from '../types';

// ===== Note List View =====

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
    if (age < oneDay) addToGroup('Today', note);
    else if (age < sevenDays) addToGroup('Previous 7 Days', note);
    else if (age < thirtyDays) addToGroup('Previous 30 Days', note);
    else addToGroup(new Date(note.updatedAt).getFullYear().toString(), note);
  }

  const result: NoteGroup[] = [];
  if (pinned.length > 0) result.push({ label: 'Pinned', notes: pinned });
  for (const label of groupOrder) result.push({ label, notes: groups.get(label)! });
  return result;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  } else {
    return date.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: '2-digit' });
  }
}

function createMobileNoteItem(note: NoteMeta, onSelect: (id: string) => void): HTMLElement {
  const item = document.createElement('div');
  item.className = 'peak-mobile-note-item';
  item.dataset.noteId = note.id;

  const titleEl = document.createElement('div');
  titleEl.className = 'peak-mobile-note-title';
  titleEl.textContent = note.title || 'Untitled';

  const metaEl = document.createElement('div');
  metaEl.className = 'peak-mobile-note-meta';

  const dateEl = document.createElement('span');
  dateEl.className = 'peak-mobile-note-date';
  dateEl.textContent = formatDate(note.updatedAt);

  const previewEl = document.createElement('span');
  previewEl.className = 'peak-mobile-note-preview';
  previewEl.textContent = note.preview || 'No additional text';

  metaEl.appendChild(dateEl);
  metaEl.appendChild(previewEl);

  item.appendChild(titleEl);
  item.appendChild(metaEl);

  item.addEventListener('click', () => onSelect(note.id));

  return item;
}

function renderMobileNoteList(
  container: HTMLElement,
  onSelect: (id: string) => void
) {
  effect(() => {
    const noteList = noteStore.notes.value;
    container.innerHTML = '';

    if (noteList.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'peak-mobile-empty';
      empty.textContent = 'No notes yet';
      container.appendChild(empty);
      return;
    }

    const grouped = groupNotes(noteList);
    for (const group of grouped) {
      const groupEl = document.createElement('div');
      groupEl.className = 'peak-mobile-note-group';

      const headerEl = document.createElement('div');
      headerEl.className = 'peak-mobile-note-group-header';
      headerEl.textContent = group.label;
      groupEl.appendChild(headerEl);

      for (const note of group.notes) {
        groupEl.appendChild(createMobileNoteItem(note, onSelect));
      }

      container.appendChild(groupEl);
    }
  });
}

// ===== Main Mobile App Entry =====

export async function mobileMain() {
  // Load and apply settings
  const settings = await loadSettings();
  applySettings(settings);

  const isFirstLaunch = !settings.onboarded;
  if (isFirstLaunch) {
    await showWelcome(settings);
  }

  // Initialize BlockSuite
  initBlockSuite();
  EdgelessTemplatePanel.templates.extend(peakStickerTemplates);
  EdgelessTemplatePanel.templates.extend(peakEdgelessTemplates);

  const workspace = createWorkspace();

  // Create editor element
  const editor = document.createElement('peak-editor-container') as PeakEditorContainer;
  noteStore.init(workspace, editor);

  // Override spec providers so all note operations use mobile BlockSuite specs
  setSpecProviders(
    (ed) => getMobilePageSpecs(ed as any),
    (ed) => getMobileEdgelessSpecs(ed as any)
  );

  // Build mobile UI
  const app = document.getElementById('app')!;
  app.innerHTML = '';
  app.className = 'peak-mobile-app';

  // ===== Home View (Note List) =====
  const homeView = document.createElement('div');
  homeView.className = 'peak-mobile-view peak-mobile-home';

  // Home header
  const homeHeader = document.createElement('div');
  homeHeader.className = 'peak-mobile-header peak-mobile-home-header';

  const homeTitle = document.createElement('h1');
  homeTitle.className = 'peak-mobile-home-title';
  homeTitle.textContent = 'Notes';

  const homeActions = document.createElement('div');
  homeActions.className = 'peak-mobile-home-actions';

  const settingsBtn = document.createElement('button');
  settingsBtn.className = 'peak-mobile-icon-btn';
  render(SettingsIcon({ width: '22', height: '22' }), settingsBtn);
  settingsBtn.addEventListener('click', () => {
    if ((window as any).__openSettings) (window as any).__openSettings();
  });

  const searchBtn = document.createElement('button');
  searchBtn.className = 'peak-mobile-icon-btn';
  render(SearchIcon({ width: '22', height: '22' }), searchBtn);
  searchBtn.addEventListener('click', () => openSearchModal());

  const newNoteBtn = document.createElement('button');
  newNoteBtn.className = 'peak-mobile-icon-btn peak-mobile-new-note-btn';
  render(NewPageIcon({ width: '22', height: '22' }), newNoteBtn);
  newNoteBtn.addEventListener('click', async () => {
    await noteStore.createNote();
    mountEditor();
    navigateToEditor();
  });

  homeActions.appendChild(settingsBtn);
  homeActions.appendChild(searchBtn);
  homeActions.appendChild(newNoteBtn);

  homeHeader.appendChild(homeTitle);
  homeHeader.appendChild(homeActions);
  homeView.appendChild(homeHeader);

  // Note list container
  const noteListContainer = document.createElement('div');
  noteListContainer.className = 'peak-mobile-note-list';
  homeView.appendChild(noteListContainer);

  app.appendChild(homeView);

  // ===== Editor View =====
  const editorView = document.createElement('div');
  editorView.className = 'peak-mobile-view peak-mobile-editor';

  // Editor header: back button, title, mode switch
  const editorHeader = document.createElement('div');
  editorHeader.className = 'peak-mobile-header peak-mobile-editor-header';

  const backBtn = document.createElement('button');
  backBtn.className = 'peak-mobile-back-btn';
  const backIconSpan = document.createElement('span');
  backIconSpan.className = 'peak-mobile-back-icon';
  render(ArrowLeftBigIcon({ width: '24', height: '24' }), backIconSpan);
  backBtn.appendChild(backIconSpan);
  const backLabel = document.createElement('span');
  backLabel.className = 'peak-mobile-back-label';
  backLabel.textContent = 'Notes';
  backBtn.appendChild(backLabel);
  backBtn.addEventListener('click', navigateToHome);

  const editorTitle = document.createElement('span');
  editorTitle.className = 'peak-mobile-editor-title';
  editorTitle.textContent = 'Untitled';

  // Saving indicator
  const savingIndicator = document.createElement('div');
  savingIndicator.className = 'peak-saving-indicator peak-mobile-saving';

  const modeSwitch = createModeSwitch((mode) => noteStore.setMode(mode));
  modeSwitch.element.classList.add('peak-mobile-mode-switch');

  const editorHeaderLeft = document.createElement('div');
  editorHeaderLeft.className = 'peak-mobile-editor-header-left';
  editorHeaderLeft.appendChild(backBtn);

  const editorHeaderCenter = document.createElement('div');
  editorHeaderCenter.className = 'peak-mobile-editor-header-center';
  editorHeaderCenter.appendChild(editorTitle);
  editorHeaderCenter.appendChild(savingIndicator);

  const editorHeaderRight = document.createElement('div');
  editorHeaderRight.className = 'peak-mobile-editor-header-right';
  editorHeaderRight.appendChild(modeSwitch.element);

  editorHeader.appendChild(editorHeaderLeft);
  editorHeader.appendChild(editorHeaderCenter);
  editorHeader.appendChild(editorHeaderRight);
  editorView.appendChild(editorHeader);

  // Editor container
  const editorWrapper = document.createElement('div');
  editorWrapper.className = 'peak-mobile-editor-container';
  editorView.appendChild(editorWrapper);

  app.appendChild(editorView);

  // ===== Navigation State =====
  let currentView: 'home' | 'editor' = 'home';

  function navigateToEditor() {
    currentView = 'editor';
    app.classList.add('peak-mobile-show-editor');
  }

  function navigateToHome() {
    currentView = 'home';
    app.classList.remove('peak-mobile-show-editor');
  }

  // ===== Editor Mount/Unmount =====
  let editorMounted = false;

  function mountEditor() {
    if (!editorMounted && !editorWrapper.contains(editor)) {
      editorWrapper.appendChild(editor);
      editorMounted = true;
    }
  }

  async function selectAndNavigate(id: string) {
    await noteStore.selectNote(id);
    mountEditor();
    navigateToEditor();
  }

  // ===== Render Note List =====
  renderMobileNoteList(noteListContainer, selectAndNavigate);

  // ===== Load Notes =====
  await noteStore.loadNoteList();

  // Handle first launch
  if (isFirstLaunch && noteStore.notes.value.length === 0) {
    await noteStore.createNote();
    mountEditor();
    navigateToEditor();
  } else {
    // Stay on home view by default, don't auto-select
  }

  // Wire up linked doc navigation
  noteStore.setupLinkedDocNavigation();
  noteStore.setupExternalLinkHandler();

  // Update header title reactively
  effect(() => {
    const id = noteStore.activeNoteId.value;
    const noteList = noteStore.notes.value;
    const meta = noteList.find(n => n.id === id);
    editorTitle.textContent = meta?.title || 'Untitled';
  });

  // React to mode changes
  effect(() => {
    modeSwitch.setMode(noteStore.activeMode.value);
  });

  // React to saving state
  effect(() => {
    savingIndicator.classList.toggle('visible', noteStore.saving.value);
  });

  // Tauri-specific listeners
  if (isTauri()) {
    const { listen } = await import('@tauri-apps/api/event');

    listen('create-note-from-notch', async () => {
      await noteStore.createNote();
      mountEditor();
      navigateToEditor();
    });

    listen<string>('open-note-from-notch', async (event) => {
      const noteId = JSON.parse(event.payload as unknown as string);
      if (noteId && noteStore.notes.value.find(n => n.id === noteId)) {
        await selectAndNavigate(noteId);
      }
    });

    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().show();
  }

  registerSearchShortcut();

  // Handle browser back button
  window.addEventListener('popstate', () => {
    if (currentView === 'editor') {
      navigateToHome();
    }
  });
}
