import { render } from 'lit';
import { NewPageIcon, SidebarIcon } from '@blocksuite/icons/lit';
import { createNote, toggleSidebar } from '../storage/note-store';
import { renderNoteList } from './note-list';
import { isTauri } from '../platform/platform';

async function createTrafficLights(): Promise<HTMLElement> {
  const container = document.createElement('div');
  container.className = 'peak-traffic-lights';

  if (!isTauri) {
    // On web, just return an empty spacer for layout consistency
    return container;
  }

  const { getCurrentWindow } = await import('@tauri-apps/api/window');
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

export async function createSidebar(): Promise<HTMLElement> {
  const sidebar = document.createElement('div');
  sidebar.className = 'peak-sidebar';

  // Top bar
  const topBar = document.createElement('div');
  topBar.className = 'peak-sidebar-topbar';

  // Left group: traffic lights + sidebar toggle
  const leftGroup = document.createElement('div');
  leftGroup.className = 'peak-topbar-left';

  leftGroup.appendChild(await createTrafficLights());

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

  return sidebar;
}
