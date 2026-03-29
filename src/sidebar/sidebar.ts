import { render } from 'lit';
import { NewPageIcon, SidebarIcon } from '@blocksuite/icons/lit';
import { createNote, toggleSidebar } from '../storage/note-store';
import { renderNoteList } from './note-list';
import { getCurrentWindow } from '@tauri-apps/api/window';

function createTrafficLights(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'flow-traffic-lights';

  const win = getCurrentWindow();

  const close = document.createElement('button');
  close.className = 'flow-traffic-btn flow-traffic-close';
  close.title = 'Close';
  close.addEventListener('click', () => win.close());

  const minimize = document.createElement('button');
  minimize.className = 'flow-traffic-btn flow-traffic-minimize';
  minimize.title = 'Minimize';
  minimize.addEventListener('click', () => win.minimize());

  const fullscreen = document.createElement('button');
  fullscreen.className = 'flow-traffic-btn flow-traffic-fullscreen';
  fullscreen.title = 'Fullscreen';
  fullscreen.addEventListener('click', () => win.toggleMaximize());

  container.appendChild(close);
  container.appendChild(minimize);
  container.appendChild(fullscreen);

  return container;
}

export function createSidebar(): HTMLElement {
  const sidebar = document.createElement('div');
  sidebar.className = 'flow-sidebar';

  // Top bar
  const topBar = document.createElement('div');
  topBar.className = 'flow-sidebar-topbar';

  // Left group: traffic lights + sidebar toggle
  const leftGroup = document.createElement('div');
  leftGroup.className = 'flow-topbar-left';

  leftGroup.appendChild(createTrafficLights());

  const sidebarBtn = document.createElement('button');
  sidebarBtn.className = 'flow-sidebar-toggle-btn';
  const sidebarIconSpan = document.createElement('span');
  sidebarIconSpan.className = 'flow-new-note-icon';
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
  newNoteBtn.className = 'flow-new-note-btn';
  const iconSpan = document.createElement('span');
  iconSpan.className = 'flow-new-note-icon';
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
  noteListContainer.className = 'flow-note-list';
  noteListContainer.id = 'flow-note-list';
  sidebar.appendChild(noteListContainer);

  // Start rendering the note list reactively
  renderNoteList(noteListContainer);

  return sidebar;
}
