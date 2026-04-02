import './style.css';
import './editor/editor-container';

import { render } from 'lit';
import { PageIcon, EdgelessIcon, SidebarIcon } from '@blocksuite/icons/lit';
import {
  initBlockSuite,
  createWorkspace,
} from './editor/setup';
import { PeakEditorContainer } from './editor/editor-container';
import { createSidebar } from './sidebar/sidebar';
import * as noteStore from './storage/note-store';
import { effect } from '@preact/signals-core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { loadSettings, applySettings } from './settings/settings'; // also registers window.__openSettings
import { showWelcome } from './welcome/welcome';
import { isMobile } from './platform';

function makeDraggable(el: HTMLElement) {
  if (isMobile) return; // No window dragging on mobile
  el.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    // Don't drag if clicking on an interactive element
    const target = e.target as HTMLElement;
    if (target.closest('button, input, textarea, select, a, [contenteditable], .peak-note-item, .peak-editor-area, .peak-sidebar-resize, .peak-traffic-lights')) return;
    e.preventDefault();
    getCurrentWindow().startDragging();
  });
}

async function main() {
  // Load and apply saved settings (theme, vibrancy)
  const settings = await loadSettings();
  applySettings(settings);

  // Show welcome screen on first launch
  const isFirstLaunch = !settings.onboarded;
  if (isFirstLaunch) {
    await showWelcome(settings);
  }

  // Initialize BlockSuite (register custom elements)
  initBlockSuite();

  // Create workspace
  const workspace = createWorkspace();

  // Create the editor element
  const editor = document.createElement(
    'peak-editor-container'
  ) as PeakEditorContainer;

  // Initialize note store
  noteStore.init(workspace, editor);

  // Check if opened as a secondary window for a specific note
  const urlParams = new URLSearchParams(window.location.search);
  const openNoteId = urlParams.get('noteId');

  // Build the UI
  const app = document.getElementById('app')!;

  // Tag the root for mobile-specific CSS
  if (isMobile) {
    document.documentElement.classList.add('mobile');
  }

  // Sidebar
  const sidebar = createSidebar();
  if (!isMobile) makeDraggable(sidebar);
  app.appendChild(sidebar);

  // Mobile overlay backdrop — click to close sidebar
  let mobileBackdrop: HTMLElement | null = null;
  if (isMobile) {
    mobileBackdrop = document.createElement('div');
    mobileBackdrop.className = 'peak-mobile-backdrop';
    mobileBackdrop.addEventListener('click', () => {
      noteStore.sidebarVisible.value = false;
    });
    app.appendChild(mobileBackdrop);
  }

  // Resize handle between sidebar and editor (desktop only)
  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'peak-sidebar-resize';
  if (isMobile) resizeHandle.style.display = 'none';
  app.appendChild(resizeHandle);

  // Start with sidebar collapsed in new-window mode or on mobile
  if (openNoteId || isMobile) {
    noteStore.sidebarVisible.value = false;
  }

  // Sidebar resize handle (desktop only)
  if (!isMobile) {
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
  }

  // Editor area
  const editorArea = document.createElement('div');
  editorArea.className = 'peak-editor-area';

  // Drag region for titlebar (transparent, over top of editor)
  const dragRegion = document.createElement('div');
  dragRegion.className = 'peak-editor-drag-region';
  editorArea.appendChild(dragRegion);

  // Sidebar toggle button (top-left, only when sidebar hidden)
  const sidebarPill = document.createElement('div');
  sidebarPill.className = 'peak-editor-sidebar-pill';

  const sidebarBtn = document.createElement('button');
  sidebarBtn.className = 'peak-mode-btn sidebar-btn';
  render(SidebarIcon({ width: '20', height: '20' }), sidebarBtn);
  sidebarBtn.addEventListener('click', () => noteStore.toggleSidebar());

  sidebarPill.appendChild(sidebarBtn);
  editorArea.appendChild(sidebarPill);

  // Saving indicator (top-left, next to sidebar pill or standalone)
  const savingText = document.createElement('span');
  savingText.className = 'peak-saving-text';
  savingText.textContent = 'Saving';
  editorArea.appendChild(savingText);

  effect(() => {
    savingText.classList.toggle('visible', noteStore.saving.value);
  });

  // React to sidebar visibility
  effect(() => {
    const visible = noteStore.sidebarVisible.value;

    if (isMobile) {
      // Mobile: sidebar overlays as a full-width panel
      sidebar.classList.toggle('open', visible);
      if (mobileBackdrop) {
        mobileBackdrop.classList.toggle('visible', visible);
      }
      sidebarPill.classList.toggle('visible', !visible);
    } else {
      // Desktop: sidebar slides via negative margin
      if (!visible) {
        const width = sidebar.getBoundingClientRect().width;
        sidebar.style.marginLeft = `-${width}px`;
      } else {
        sidebar.style.marginLeft = '';
      }
      resizeHandle.classList.toggle('collapsed', !visible);
      editorArea.classList.toggle('sidebar-hidden', !visible);
      sidebarPill.classList.toggle('visible', !visible);
    }
  });

  // Floating mode toggle (top-right overlay)
  const modeToggle = document.createElement('div');
  modeToggle.className = 'peak-mode-toggle';

  // Sliding background indicator
  const slider = document.createElement('div');
  slider.className = 'peak-mode-slider';
  modeToggle.appendChild(slider);

  const pageBtn = document.createElement('button');
  pageBtn.className = 'peak-mode-btn active';
  pageBtn.title = 'Page mode';
  render(PageIcon({ width: '20', height: '20' }), pageBtn);
  pageBtn.addEventListener('click', () => {
    noteStore.setMode('page');
  });

  const edgelessBtn = document.createElement('button');
  edgelessBtn.className = 'peak-mode-btn';
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
  editorWrapper.className = 'peak-editor-container';

  const emptyState = document.createElement('div');
  emptyState.className = 'peak-editor-empty';
  emptyState.id = 'peak-editor-empty';
  emptyState.textContent = 'Select a note or create a new one';
  editorWrapper.appendChild(emptyState);

  // Outline viewer will be created once the editor host is available
  let outlineViewer: HTMLElement | null = null;

  editorArea.appendChild(editorWrapper);

  // Wrap editor area in a draggable region (the margin/border area)
  const editorDragWrap = document.createElement('div');
  editorDragWrap.className = 'peak-editor-drag-wrap';
  makeDraggable(editorDragWrap);
  editorDragWrap.appendChild(editorArea);
  app.appendChild(editorDragWrap);

  // Load existing notes
  await noteStore.loadNoteList();

  // On first launch, create the first note automatically
  if (isFirstLaunch && noteStore.notes.value.length === 0) {
    await noteStore.createNote();
    mountEditor(editorWrapper, editor);
  } else {
    // Select the target note (priority: URL param > last opened > first note)
    const lastNoteId = localStorage.getItem('peak-last-note');
    const noteToOpen = openNoteId
      || (lastNoteId && noteStore.notes.value.find(n => n.id === lastNoteId) ? lastNoteId : null)
      || (noteStore.notes.value.length > 0 ? noteStore.notes.value[0].id : null);

    if (noteToOpen) {
      await noteStore.selectNote(noteToOpen);
      mountEditor(editorWrapper, editor);
    }
  }

  // Wire up linked doc navigation
  noteStore.setupLinkedDocNavigation();

  // Open external links (hyperlinks, bookmarks, embeds) in system browser
  noteStore.setupExternalLinkHandler();

  // Listen for notch widget events (desktop only)
  if (!isMobile) {
    listen('create-note-from-notch', async () => {
      await noteStore.createNote();
    });

    listen<string>('open-note-from-notch', async (event) => {
      const noteId = JSON.parse(event.payload as unknown as string);
      if (noteId && noteStore.notes.value.find(n => n.id === noteId)) {
        await noteStore.selectNote(noteId);
      }
    });

    listen<string>('import-markdown-from-notch', async (event) => {
      const data = JSON.parse(JSON.parse(event.payload as unknown as string));
      if (data?.markdown) {
        const file = new File([data.markdown], `${data.fileName || 'Untitled'}.md`, { type: 'text/markdown' });
        await noteStore.importMarkdownFile(file);
      }
    });
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

    // Update outline viewer when editor host is available for the current note
    if (id) {
      // Remove stale viewer immediately on note switch
      if (outlineViewer) {
        outlineViewer.remove();
        outlineViewer = null;
      }
      const targetId = id;
      const tryAttach = () => {
        // Bail if user already switched to a different note
        if (noteStore.activeNoteId.peek() !== targetId) return;
        const host = editor.host;
        if (host && host.store?.id === targetId) {
          outlineViewer = document.createElement('affine-outline-viewer');
          outlineViewer.className = 'peak-outline-viewer';
          (outlineViewer as any).editor = host;
          editorWrapper.appendChild(outlineViewer);
        } else {
          requestAnimationFrame(tryAttach);
        }
      };
      // Wait a frame for the editor to update its std/host
      requestAnimationFrame(tryAttach);
    } else {
      if (outlineViewer) {
        outlineViewer.remove();
        outlineViewer = null;
      }
    }
  });
}

function mountEditor(
  container: HTMLElement,
  editor: PeakEditorContainer
) {
  const empty = document.getElementById('peak-editor-empty');
  if (empty) empty.remove();
  if (!container.contains(editor)) {
    container.appendChild(editor);
  }
}

function unmountEditor(container: HTMLElement) {
  container.innerHTML = '';
  const emptyState = document.createElement('div');
  emptyState.className = 'peak-editor-empty';
  emptyState.id = 'peak-editor-empty';
  emptyState.textContent = 'Select a note or create a new one';
  container.appendChild(emptyState);
}

main().catch(console.error);
