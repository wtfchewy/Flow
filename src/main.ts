import './style.css';
import './editor/editor-container';

import { render } from 'lit';
import {
  PageIcon,
  EdgelessIcon,
  SidebarIcon,
  ArrowDownSmallIcon,
  OpenInNewIcon,
  PinIcon,
  PinedIcon,
  DuplicateIcon,
  DeleteIcon,
  ExportIcon,
  ExportToMarkdownIcon,
  ExportToHtmlIcon,
  ExportToPdfIcon,
} from '@blocksuite/icons/lit';
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

function makeDraggable(el: HTMLElement) {
  el.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    // Don't drag if clicking on an interactive element
    const target = e.target as HTMLElement;
    if (target.closest('button, input, textarea, select, a, [contenteditable], .peak-note-item, .peak-editor-container, .peak-sidebar-resize, .peak-traffic-lights')) return;
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

  // Start with sidebar collapsed in new-window mode (before creating DOM)
  if (openNoteId) {
    noteStore.sidebarVisible.value = false;
  }

  // Build the UI
  const app = document.getElementById('app')!;

  // Sidebar
  const sidebar = createSidebar();
  makeDraggable(sidebar);
  app.appendChild(sidebar);

  // Resize handle between sidebar and editor
  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'peak-sidebar-resize';
  app.appendChild(resizeHandle);

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
  editorArea.className = 'peak-editor-area';

  // Drag region for titlebar (transparent, over top of editor)
  const dragRegion = document.createElement('div');
  dragRegion.className = 'peak-editor-drag-region';
  editorArea.appendChild(dragRegion);

  // ===== Editor Header Bar =====
  const headerBar = document.createElement('div');
  headerBar.className = 'peak-editor-header';

  // Left section
  const headerLeft = document.createElement('div');
  headerLeft.className = 'peak-editor-header-left';

  // Sidebar toggle button (only when sidebar hidden)
  const sidebarBtn = document.createElement('button');
  sidebarBtn.className = 'peak-mode-btn sidebar-btn peak-header-sidebar-btn';
  render(SidebarIcon({ width: '20', height: '20' }), sidebarBtn);
  const sidebarTooltip = document.createElement('affine-tooltip');
  sidebarTooltip.setAttribute('tip-position', 'bottom-start');
  sidebarTooltip.textContent = 'Show Sidebar';
  sidebarBtn.appendChild(sidebarTooltip);
  sidebarBtn.addEventListener('click', () => noteStore.toggleSidebar());
  headerLeft.appendChild(sidebarBtn);

  // Saving indicator
  const savingIndicator = document.createElement('div');
  savingIndicator.className = 'peak-saving-indicator';

  // Center section - mode toggle + title
  const headerCenter = document.createElement('div');
  headerCenter.className = 'peak-editor-header-center';

  // Mode toggle (page/edgeless)
  const modeToggle = document.createElement('div');
  modeToggle.className = 'peak-mode-toggle';

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

  modeToggle.appendChild(pageBtn);
  modeToggle.appendChild(edgelessBtn);
  headerCenter.appendChild(modeToggle);

  // Title button with dropdown
  const titleBtn = document.createElement('button');
  titleBtn.className = 'peak-editor-header-title-btn';

  const headerTitle = document.createElement('span');
  headerTitle.className = 'peak-editor-header-title';
  headerTitle.textContent = 'Untitled';

  const headerChevron = document.createElement('span');
  headerChevron.className = 'peak-editor-header-chevron';
  render(ArrowDownSmallIcon({ width: '16', height: '16' }), headerChevron);

  titleBtn.appendChild(headerTitle);
  titleBtn.appendChild(headerChevron);
  headerCenter.appendChild(titleBtn);

  // Title options dropdown (context menu style)
  let titleMenu: HTMLElement | null = null;

  function closeTitleMenu() {
    if (titleMenu) {
      titleMenu.remove();
      titleMenu = null;
    }
    headerChevron.classList.remove('open');
    document.removeEventListener('click', closeTitleMenu);
  }

  titleBtn.addEventListener('click', () => {
    if (titleMenu) {
      closeTitleMenu();
      return;
    }

    const noteId = noteStore.activeNoteId.value;
    if (!noteId) return;
    const noteMeta = noteStore.notes.value.find(n => n.id === noteId);
    if (!noteMeta) return;

    const menu = document.createElement('div');
    menu.className = 'peak-context-menu peak-title-dropdown';

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
        closeTitleMenu();
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
      arrow.textContent = '\u203A';
      trigger.appendChild(iconEl);
      trigger.appendChild(labelEl);
      trigger.appendChild(arrow);
      const sub = document.createElement('div');
      sub.className = 'peak-context-submenu';
      for (const si of items) {
        const subItem = document.createElement('div');
        subItem.className = 'peak-context-menu-item';
        const subIcon = document.createElement('span');
        subIcon.className = 'peak-context-menu-icon';
        render(si.icon({ width: '18', height: '18' }), subIcon);
        const subLabel = document.createElement('span');
        subLabel.textContent = si.label;
        subItem.appendChild(subIcon);
        subItem.appendChild(subLabel);
        subItem.addEventListener('click', (ev) => {
          ev.stopPropagation();
          closeTitleMenu();
          si.onClick();
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

    addItem(OpenInNewIcon, 'Open in New Window', () => noteStore.openNoteInNewWindow(noteId));
    addItem(
      noteMeta.pinned ? PinedIcon : PinIcon,
      noteMeta.pinned ? 'Unpin Note' : 'Pin Note',
      () => noteStore.togglePinNote(noteId)
    );
    addItem(DuplicateIcon, 'Duplicate Note', () => noteStore.duplicateNote(noteId));
    addSeparator();
    addSubmenu(ExportIcon, 'Export', [
      { icon: ExportToMarkdownIcon, label: 'Markdown', onClick: () => noteStore.exportNoteAsMarkdown(noteId) },
      { icon: ExportToHtmlIcon, label: 'HTML', onClick: () => noteStore.exportNoteAsHtml(noteId) },
      { icon: ExportToPdfIcon, label: 'PDF', onClick: () => noteStore.exportNoteAsPdf(noteId) },
    ]);
    addSeparator();
    addItem(DeleteIcon, 'Delete Note', () => noteStore.deleteNote(noteId), true);

    // Position below the title button
    const btnRect = titleBtn.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.left = `${btnRect.left + btnRect.width / 2}px`;
    menu.style.top = `${btnRect.bottom + 4}px`;
    menu.style.transform = 'translateX(-50%)';

    document.body.appendChild(menu);
    titleMenu = menu;
    headerChevron.classList.add('open');

    // Adjust if off-screen
    const menuRect = menu.getBoundingClientRect();
    if (menuRect.right > window.innerWidth) {
      menu.style.left = `${window.innerWidth - menuRect.width - 8}px`;
      menu.style.transform = 'none';
    }
    if (menuRect.left < 0) {
      menu.style.left = '8px';
      menu.style.transform = 'none';
    }

    setTimeout(() => document.addEventListener('click', closeTitleMenu), 0);
  });

  // Right section (placeholder for balance)
  const headerRight = document.createElement('div');
  headerRight.className = 'peak-editor-header-right';
  headerRight.appendChild(savingIndicator);

  headerBar.appendChild(headerLeft);
  headerBar.appendChild(headerCenter);
  headerBar.appendChild(headerRight);
  editorArea.appendChild(headerBar);

  // ===== Original floating overlays (shown when header bar is off) =====
  const floatSidebarPill = document.createElement('div');
  floatSidebarPill.className = 'peak-editor-sidebar-pill';
  const floatSidebarBtn = document.createElement('button');
  floatSidebarBtn.className = 'peak-mode-btn sidebar-btn';
  render(SidebarIcon({ width: '20', height: '20' }), floatSidebarBtn);
  floatSidebarBtn.addEventListener('click', () => noteStore.toggleSidebar());
  floatSidebarPill.appendChild(floatSidebarBtn);
  editorArea.appendChild(floatSidebarPill);

  const floatSavingIndicator = document.createElement('div');
  floatSavingIndicator.className = 'peak-saving-indicator peak-float-saving-indicator';
  editorArea.appendChild(floatSavingIndicator);

  const floatModeToggle = document.createElement('div');
  floatModeToggle.className = 'peak-mode-toggle peak-float-mode-toggle';
  const floatSlider = document.createElement('div');
  floatSlider.className = 'peak-mode-slider';
  floatModeToggle.appendChild(floatSlider);
  const floatPageBtn = document.createElement('button');
  floatPageBtn.className = 'peak-mode-btn active';
  floatPageBtn.title = 'Page mode';
  render(PageIcon({ width: '20', height: '20' }), floatPageBtn);
  floatPageBtn.addEventListener('click', () => noteStore.setMode('page'));
  const floatEdgelessBtn = document.createElement('button');
  floatEdgelessBtn.className = 'peak-mode-btn';
  floatEdgelessBtn.title = 'Edgeless mode';
  render(EdgelessIcon({ width: '20', height: '20' }), floatEdgelessBtn);
  floatEdgelessBtn.addEventListener('click', () => noteStore.setMode('edgeless'));
  floatModeToggle.appendChild(floatPageBtn);
  floatModeToggle.appendChild(floatEdgelessBtn);
  editorArea.appendChild(floatModeToggle);

  effect(() => {
    savingIndicator.classList.toggle('visible', noteStore.saving.value);
    floatSavingIndicator.classList.toggle('visible', noteStore.saving.value);
  });

  // React to sidebar visibility
  effect(() => {
    const visible = noteStore.sidebarVisible.value;
    if (!visible) {
      const width = sidebar.getBoundingClientRect().width;
      sidebar.style.marginLeft = `-${width}px`;
    } else {
      sidebar.style.marginLeft = '';
    }
    resizeHandle.classList.toggle('collapsed', !visible);
    editorArea.classList.toggle('sidebar-hidden', !visible);
    sidebarBtn.classList.toggle('visible', !visible);
    floatSidebarPill.classList.toggle('visible', !visible);
  });

  // React to mode changes
  effect(() => {
    const mode = noteStore.activeMode.value;
    if (mode === 'edgeless') {
      edgelessBtn.classList.add('active');
      pageBtn.classList.remove('active');
      modeToggle.classList.add('edgeless');
      floatEdgelessBtn.classList.add('active');
      floatPageBtn.classList.remove('active');
      floatModeToggle.classList.add('edgeless');
    } else {
      pageBtn.classList.add('active');
      edgelessBtn.classList.remove('active');
      modeToggle.classList.remove('edgeless');
      floatPageBtn.classList.add('active');
      floatEdgelessBtn.classList.remove('active');
      floatModeToggle.classList.remove('edgeless');
    }
  });

  // React to active note changes to update header title
  effect(() => {
    const id = noteStore.activeNoteId.value;
    const noteList = noteStore.notes.value;
    const meta = noteList.find(n => n.id === id);
    headerTitle.textContent = meta?.title || 'Untitled';
  });

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

  // Listen for "create note" from the notch widget (same app, direct event)
  listen('create-note-from-notch', async () => {
    await noteStore.createNote();
  });

  // Listen for "open note" from the notch widget
  listen<string>('open-note-from-notch', async (event) => {
    const noteId = JSON.parse(event.payload as unknown as string);
    if (noteId && noteStore.notes.value.find(n => n.id === noteId)) {
      await noteStore.selectNote(noteId);
    }
  });

  // Listen for markdown drop from the notch widget
  listen<string>('import-markdown-from-notch', async (event) => {
    const data = JSON.parse(JSON.parse(event.payload as unknown as string));
    if (data?.markdown) {
      const file = new File([data.markdown], `${data.fileName || 'Untitled'}.md`, { type: 'text/markdown' });
      await noteStore.importMarkdownFile(file);
    }
  });

  // Show the main window now that the UI is fully ready
  await getCurrentWindow().show();

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
