import './style.css';
import './editor/editor-container';

import { render } from 'lit';
import { PageIcon, EdgelessIcon, SidebarIcon } from '@blocksuite/icons/lit';
import {
  initBlockSuite,
  createWorkspace,
} from './editor/setup';
import { FlowEditorContainer } from './editor/editor-container';
import { createSidebar } from './sidebar/sidebar';
import * as noteStore from './storage/note-store';
import { effect } from '@preact/signals-core';

async function main() {
  // Set dark theme
  document.documentElement.setAttribute('data-theme', 'dark');

  // Initialize BlockSuite (register custom elements)
  initBlockSuite();

  // Create workspace
  const workspace = createWorkspace();

  // Create the editor element
  const editor = document.createElement(
    'flow-editor-container'
  ) as FlowEditorContainer;

  // Initialize note store
  noteStore.init(workspace, editor);

  // Check if opened as a secondary window for a specific note
  const urlParams = new URLSearchParams(window.location.search);
  const openNoteId = urlParams.get('noteId');

  // Build the UI
  const app = document.getElementById('app')!;

  // Sidebar
  const sidebar = createSidebar();
  app.appendChild(sidebar);

  // Resize handle between sidebar and editor
  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'flow-sidebar-resize';
  app.appendChild(resizeHandle);

  // Start with sidebar collapsed in new-window mode
  if (openNoteId) {
    noteStore.sidebarVisible.value = false;
  }

  let isResizing = false;
  resizeHandle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    isResizing = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const width = Math.min(500, Math.max(200, e.clientX));
    sidebar.style.width = width + 'px';
    sidebar.style.minWidth = width + 'px';
    sidebar.style.maxWidth = width + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!isResizing) return;
    isResizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  // Editor area
  const editorArea = document.createElement('div');
  editorArea.className = 'flow-editor-area';

  // Drag region for titlebar (transparent, over top of editor)
  const dragRegion = document.createElement('div');
  dragRegion.className = 'flow-editor-drag-region';
  editorArea.appendChild(dragRegion);

  // Top-left toolbar pill (sidebar icon + saving text)
  const leftToolbar = document.createElement('div');
  leftToolbar.className = 'flow-editor-toolbar-left';

  const sidebarBtn = document.createElement('button');
  sidebarBtn.className = 'flow-mode-btn sidebar-btn';
  sidebarBtn.title = 'Toggle Sidebar';
  render(SidebarIcon({ width: '20', height: '20' }), sidebarBtn);
  sidebarBtn.addEventListener('click', () => noteStore.toggleSidebar());

  const savingText = document.createElement('span');
  savingText.className = 'flow-saving-text';
  savingText.textContent = 'Saving';

  leftToolbar.appendChild(sidebarBtn);
  leftToolbar.appendChild(savingText);
  editorArea.appendChild(leftToolbar);

  effect(() => {
    savingText.classList.toggle('visible', noteStore.saving.value);
  });

  // React to sidebar visibility
  effect(() => {
    const visible = noteStore.sidebarVisible.value;
    sidebar.classList.toggle('collapsed', !visible);
    resizeHandle.classList.toggle('collapsed', !visible);
    editorArea.classList.toggle('sidebar-hidden', !visible);
    leftToolbar.classList.toggle('sidebar-hidden', !visible);
  });

  // Floating mode toggle (top-right overlay)
  const modeToggle = document.createElement('div');
  modeToggle.className = 'flow-mode-toggle';

  // Sliding background indicator
  const slider = document.createElement('div');
  slider.className = 'flow-mode-slider';
  modeToggle.appendChild(slider);

  const pageBtn = document.createElement('button');
  pageBtn.className = 'flow-mode-btn active';
  pageBtn.title = 'Page mode';
  render(PageIcon({ width: '20', height: '20' }), pageBtn);
  pageBtn.addEventListener('click', () => {
    noteStore.setMode('page');
  });

  const edgelessBtn = document.createElement('button');
  edgelessBtn.className = 'flow-mode-btn';
  edgelessBtn.title = 'Edgeless mode';
  render(EdgelessIcon({ width: '20', height: '20' }), edgelessBtn);
  edgelessBtn.addEventListener('click', () => {
    noteStore.setMode('edgeless');
  });

  // React to mode changes (from toggle clicks or note selection restoring mode)
  effect(() => {
    const mode = noteStore.activeMode.value;
    if (mode === 'edgeless') {
      edgelessBtn.classList.add('active');
      pageBtn.classList.remove('active');
      modeToggle.classList.add('edgeless');
    } else {
      pageBtn.classList.add('active');
      edgelessBtn.classList.remove('active');
      modeToggle.classList.remove('edgeless');
    }
  });

  modeToggle.appendChild(pageBtn);
  modeToggle.appendChild(edgelessBtn);
  editorArea.appendChild(modeToggle);

  // Editor container (full height)
  const editorWrapper = document.createElement('div');
  editorWrapper.className = 'flow-editor-container';

  const emptyState = document.createElement('div');
  emptyState.className = 'flow-editor-empty';
  emptyState.id = 'flow-editor-empty';
  emptyState.textContent = 'Select a note or create a new one';
  editorWrapper.appendChild(emptyState);

  editorArea.appendChild(editorWrapper);

  // Wrap editor area in a draggable region (the margin/border area)
  const editorDragWrap = document.createElement('div');
  editorDragWrap.className = 'flow-editor-drag-wrap';
  editorDragWrap.appendChild(editorArea);
  app.appendChild(editorDragWrap);

  // Load existing notes
  await noteStore.loadNoteList();

  // Select the target note
  if (openNoteId) {
    await noteStore.selectNote(openNoteId);
    mountEditor(editorWrapper, editor);
  } else if (noteStore.notes.value.length > 0) {
    await noteStore.selectNote(noteStore.notes.value[0].id);
    mountEditor(editorWrapper, editor);
  }

  // Watch for active note changes to mount/unmount editor
  let editorMounted = noteStore.notes.value.length > 0;

  effect(() => {
    const id = noteStore.activeNoteId.value;
    if (id && !editorMounted) {
      mountEditor(editorWrapper, editor);
      editorMounted = true;
    } else if (!id && editorMounted) {
      unmountEditor(editorWrapper);
      editorMounted = false;
    }
  });
}

function mountEditor(
  container: HTMLElement,
  editor: FlowEditorContainer
) {
  const empty = document.getElementById('flow-editor-empty');
  if (empty) empty.remove();
  if (!container.contains(editor)) {
    container.appendChild(editor);
  }
}

function unmountEditor(container: HTMLElement) {
  container.innerHTML = '';
  const emptyState = document.createElement('div');
  emptyState.className = 'flow-editor-empty';
  emptyState.id = 'flow-editor-empty';
  emptyState.textContent = 'Select a note or create a new one';
  container.appendChild(emptyState);
}

main().catch(console.error);
