import { render } from 'lit';
import { NewPageIcon, SidebarIcon, SettingsIcon, OpenInNewIcon } from '@blocksuite/icons/lit';
import { createNote, importMarkdownFile, toggleSidebar, openNoteInNewWindow, activeNoteId } from '../storage/note-store';
import { openSettings } from '../settings/settings';
import { renderNoteList } from './note-list';
import { getCurrentWindow } from '@tauri-apps/api/window';

function createTrafficLights(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'peak-traffic-lights';

  const win = getCurrentWindow();

  const close = document.createElement('button');
  close.className = 'peak-traffic-btn peak-traffic-close';
  close.title = 'Close';
  close.addEventListener('click', () => win.close());

  const minimize = document.createElement('button');
  minimize.className = 'peak-traffic-btn peak-traffic-minimize';
  minimize.title = 'Minimize';
  minimize.addEventListener('click', () => win.minimize());

  const fullscreen = document.createElement('button');
  fullscreen.className = 'peak-traffic-btn peak-traffic-fullscreen';
  fullscreen.title = 'Fullscreen';
  fullscreen.addEventListener('click', () => win.toggleMaximize());

  container.appendChild(close);
  container.appendChild(minimize);
  container.appendChild(fullscreen);

  return container;
}

export function createSidebar(): HTMLElement {
  const sidebar = document.createElement('div');
  sidebar.className = 'peak-sidebar';

  // Top bar
  const topBar = document.createElement('div');
  topBar.className = 'peak-sidebar-topbar';

  // Left group: traffic lights + sidebar toggle
  const leftGroup = document.createElement('div');
  leftGroup.className = 'peak-topbar-left';

  leftGroup.appendChild(createTrafficLights());

  const sidebarBtn = document.createElement('button');
  sidebarBtn.className = 'peak-sidebar-toggle-btn';
  const sidebarIconSpan = document.createElement('span');
  sidebarIconSpan.className = 'peak-new-note-icon';
  render(SidebarIcon({ width: '20', height: '20' }), sidebarIconSpan);
  sidebarBtn.appendChild(sidebarIconSpan);
  const sidebarTooltip = document.createElement('affine-tooltip');
  sidebarTooltip.setAttribute('tip-position', 'bottom');
  sidebarTooltip.textContent = 'Hide Sidebar';
  sidebarBtn.appendChild(sidebarTooltip);
  sidebarBtn.addEventListener('click', () => toggleSidebar());

  leftGroup.appendChild(sidebarBtn);
  topBar.appendChild(leftGroup);

  // Right: new note button
  const newNoteBtn = document.createElement('button');
  newNoteBtn.className = 'peak-new-note-btn';
  const iconSpan = document.createElement('span');
  iconSpan.className = 'peak-new-note-icon';
  render(NewPageIcon({ width: '20', height: '20' }), iconSpan);
  newNoteBtn.appendChild(iconSpan);
  const newNoteTooltip = document.createElement('affine-tooltip');
  newNoteTooltip.setAttribute('tip-position', 'bottom');
  newNoteTooltip.textContent = 'New Note';
  newNoteBtn.appendChild(newNoteTooltip);
  newNoteBtn.addEventListener('click', () => createNote());

  topBar.appendChild(newNoteBtn);
  sidebar.appendChild(topBar);

  // Note list container
  const noteListContainer = document.createElement('div');
  noteListContainer.className = 'peak-note-list';
  noteListContainer.id = 'peak-note-list';
  sidebar.appendChild(noteListContainer);

  // Start rendering the note list reactively
  renderNoteList(noteListContainer);

  // Right-click context menu on blank sidebar area
  sidebar.addEventListener('contextmenu', (e) => {
    // Don't override note-item context menus
    if ((e.target as HTMLElement).closest('.peak-note-item')) return;
    e.preventDefault();

    // Remove any existing menu
    document.querySelector('.peak-sidebar-context-menu')?.remove();

    const menu = document.createElement('div');
    menu.className = 'peak-context-menu peak-sidebar-context-menu';
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;

    function addItem(
      iconFn: (opts: any) => any,
      label: string,
      onClick: () => void,
    ) {
      const item = document.createElement('div');
      item.className = 'peak-context-menu-item';
      const iconEl = document.createElement('span');
      iconEl.className = 'peak-context-menu-icon';
      render(iconFn({ width: '18', height: '18' }), iconEl);
      const labelEl = document.createElement('span');
      labelEl.textContent = label;
      item.appendChild(iconEl);
      item.appendChild(labelEl);
      item.addEventListener('click', (ev) => {
        ev.stopPropagation();
        menu.remove();
        onClick();
      });
      menu.appendChild(item);
    }

    addItem(NewPageIcon, 'New Note', () => createNote());
    const noteId = activeNoteId.value;
    if (noteId) {
      addItem(OpenInNewIcon, 'Open in New Window', () => openNoteInNewWindow(noteId));
    }
    addItem(SettingsIcon, 'Settings', () => openSettings());

    document.body.appendChild(menu);

    const dismiss = (ev: MouseEvent) => {
      if (!menu.contains(ev.target as Node)) {
        menu.remove();
        document.removeEventListener('mousedown', dismiss);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', dismiss));
  });

  // Drag-and-drop markdown files to import
  sidebar.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    sidebar.classList.add('peak-sidebar-dragover');
  });

  sidebar.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    sidebar.classList.remove('peak-sidebar-dragover');
  });

  sidebar.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    sidebar.classList.remove('peak-sidebar-dragover');

    const files = Array.from(e.dataTransfer?.files ?? []);
    const mdFiles = files.filter(f => f.name.toLowerCase().endsWith('.md'));

    for (const file of mdFiles) {
      await importMarkdownFile(file);
    }
  });

  return sidebar;
}
