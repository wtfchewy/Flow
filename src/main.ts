import './style.css';
import './editor/editor-container';

import { render } from 'lit';
import {
  SidebarIcon,
  ArrowDownSmallIcon,
  OpenInNewIcon,
  PinIcon,
  PinedIcon,
  DuplicateIcon,
  DeleteIcon,
  ExportIcon,
  ImportIcon,
  PresentationIcon,
} from '@blocksuite/icons/lit';
import { createModeSwitch } from './mode-switch/mode-switch';
import {
  initBlockSuite,
  createWorkspace,
} from './editor/setup';
import { PeakEditorContainer } from './editor/editor-container';
import { createSidebar } from './sidebar/sidebar';
import * as noteStore from './storage/note-store';
import { effect } from '@preact/signals-core';
import { loadSettings, applySettings } from './settings/settings'; // also registers window.__openSettings
import { showWelcome } from './welcome/welcome';
import { isTauri, applyPlatformClasses } from './platform';
import { openImportModal } from './import/import-modal';
import { openExportModal } from './export/export-modal';
import { registerSearchShortcut } from './search/search-modal';
import { GfxControllerIdentifier } from '@blocksuite/affine/std/gfx';
import { PresentTool } from '@blocksuite/affine/blocks/frame';
import { EdgelessTemplatePanel } from '@blocksuite/affine/gfx/template';
import { peakEdgelessTemplates } from './templates/edgeless-templates';
import { peakStickerTemplates } from './templates/sticker-templates';

function makeDraggable(el: HTMLElement) {
  if (!isTauri()) return; // No custom dragging in browser
  el.addEventListener('mousedown', async (e) => {
    if (e.button !== 0) return;
    // Don't drag if clicking on an interactive element
    const target = e.target as HTMLElement;
    if (target.closest('button, input, textarea, select, a, [contenteditable], .peak-note-item, .peak-editor-container, .peak-sidebar-resize, .peak-traffic-lights')) return;
    e.preventDefault();
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    getCurrentWindow().startDragging();
  });
}

function createHeaderTrafficLights(): HTMLElement | null {
  if (!isTauri()) return null;

  const container = document.createElement('div');
  container.className = 'peak-traffic-lights peak-header-traffic';

  const winPromise = import('@tauri-apps/api/window').then(m => m.getCurrentWindow());

  const close = document.createElement('button');
  close.className = 'peak-traffic-btn peak-traffic-close';
  close.title = 'Close';
  close.addEventListener('click', async () => (await winPromise).close());

  const minimize = document.createElement('button');
  minimize.className = 'peak-traffic-btn peak-traffic-minimize';
  minimize.title = 'Minimize';
  minimize.addEventListener('click', async () => (await winPromise).minimize());

  const fullscreen = document.createElement('button');
  fullscreen.className = 'peak-traffic-btn peak-traffic-fullscreen';
  fullscreen.title = 'Fullscreen';
  fullscreen.addEventListener('click', async () => (await winPromise).toggleMaximize());

  container.appendChild(close);
  container.appendChild(minimize);
  container.appendChild(fullscreen);

  return container;
}

async function main() {
  // Apply platform classes (peak-browser or peak-desktop) immediately
  applyPlatformClasses();

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

  // Register edgeless templates and stickers
  EdgelessTemplatePanel.templates.extend(peakStickerTemplates);
  EdgelessTemplatePanel.templates.extend(peakEdgelessTemplates);

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

  // Traffic lights in header (shown when sidebar is hidden, if setting enabled)
  const headerTrafficLights = createHeaderTrafficLights();
  if (headerTrafficLights) {
    headerLeft.appendChild(headerTrafficLights);
  }

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

  // Mode toggle (page/edgeless) — animated Lottie switcher
  const headerModeSwitch = createModeSwitch((mode) => noteStore.setMode(mode));
  headerCenter.appendChild(headerModeSwitch.element);

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

    // Only show "Open in New Window" in Tauri
    if (isTauri()) {
      addItem(OpenInNewIcon, 'Open in New Window', () => noteStore.openNoteInNewWindow(noteId));
    }
    addItem(
      noteMeta.pinned ? PinedIcon : PinIcon,
      noteMeta.pinned ? 'Unpin Note' : 'Pin Note',
      () => noteStore.togglePinNote(noteId)
    );
    addItem(DuplicateIcon, 'Duplicate Note', () => noteStore.duplicateNote(noteId));
    addSeparator();
    addItem(PresentationIcon, 'Present', async () => {
      // Switch to edgeless mode first if not already
      if (noteStore.activeMode.value !== 'edgeless') {
        noteStore.setMode('edgeless');
        // Wait for the editor to switch modes
        await new Promise(r => setTimeout(r, 200));
      }
      const std = editor.std;
      if (!std) return;
      const gfx = std.get(GfxControllerIdentifier);
      gfx.tool.setTool(PresentTool, { mode: 'fit' });
    });
    addSeparator();
    addItem(ImportIcon, 'Import', () => openImportModal());
    addItem(ExportIcon, 'Export', () => openExportModal(noteId));
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

  const floatModeSwitch = createModeSwitch((mode) => noteStore.setMode(mode));
  floatModeSwitch.element.classList.add('peak-float-mode-toggle');
  editorArea.appendChild(floatModeSwitch.element);

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
    headerModeSwitch.setMode(mode);
    floatModeSwitch.setMode(mode);
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

  // Open external links in system browser (Tauri) or new tab (browser)
  noteStore.setupExternalLinkHandler();

  // Tauri-specific event listeners
  if (isTauri()) {
    const { listen } = await import('@tauri-apps/api/event');

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

    // Listen for file drops from the notch widget
    listen<string>('import-markdown-from-notch', async (event) => {
      const data = JSON.parse(JSON.parse(event.payload as unknown as string));
      if (data?.markdown) {
        const file = new File([data.markdown], `${data.fileName || 'Untitled'}.md`, { type: 'text/markdown' });
        await noteStore.importMarkdownFile(file);
      }
    });

    listen<string>('import-html-from-notch', async (event) => {
      const data = JSON.parse(JSON.parse(event.payload as unknown as string));
      if (data?.html) {
        const file = new File([data.html], `${data.fileName || 'Untitled'}.html`, { type: 'text/html' });
        await noteStore.importHtmlFile(file);
      }
    });

    listen<string>('import-zip-from-notch', async (event) => {
      const data = JSON.parse(JSON.parse(event.payload as unknown as string));
      if (data?.base64) {
        const binary = atob(data.base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const file = new File([bytes], data.fileName || 'import.zip', { type: 'application/zip' });
        await noteStore.importMarkdownZip(file);
      }
    });

    // Listen for quick-append submissions sent directly from the popup window.
    listen<{ noteId: string; text: string }>('quick-append-submit', async (event) => {
      const data = event.payload;
      if (!data?.noteId || !data?.text) return;
      try {
        await noteStore.appendTextToNote(data.noteId, data.text);
      } catch (err) {
        console.error('Quick append failed:', err);
      }
    });

    // Show the main window now that the UI is fully ready
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().show();
  }

  // Register global search shortcut (Cmd+S / Ctrl+S)
  registerSearchShortcut();

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
