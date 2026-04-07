import { render } from 'lit';
import { NewPageIcon, SidebarIcon, SettingsIcon, OpenInNewIcon, DownloadIcon } from '@blocksuite/icons/lit';
import { createNote, importMarkdownFile, toggleSidebar, openNoteInNewWindow, activeNoteId } from '../storage/note-store';
import { openSettings } from '../settings/settings';
import { renderNoteList } from './note-list';
import { isTauri } from '../platform';

function createTrafficLights(): HTMLElement | null {
  if (!isTauri()) return null; // No traffic lights in browser

  const container = document.createElement('div');
  container.className = 'peak-traffic-lights';

  // Lazy-load Tauri window API
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

export function createSidebar(): HTMLElement {
  const sidebar = document.createElement('div');
  sidebar.className = 'peak-sidebar';

  // Top bar
  const topBar = document.createElement('div');
  topBar.className = 'peak-sidebar-topbar';

  // Left group: traffic lights + sidebar toggle
  const leftGroup = document.createElement('div');
  leftGroup.className = 'peak-topbar-left';

  const trafficLights = createTrafficLights();
  if (trafficLights) {
    leftGroup.appendChild(trafficLights);
  }

  const sidebarBtn = document.createElement('button');
  sidebarBtn.className = 'peak-sidebar-toggle-btn';
  const sidebarIconSpan = document.createElement('span');
  sidebarIconSpan.className = 'peak-new-note-icon';
  render(SidebarIcon({ width: '20', height: '20' }), sidebarIconSpan);
  sidebarBtn.appendChild(sidebarIconSpan);
  const sidebarTooltip = document.createElement('affine-tooltip');
  sidebarTooltip.setAttribute('tip-position', isTauri() ? 'bottom' : 'bottom-start');
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

  // Download App button (browser only) — overlays bottom of sidebar
  if (!isTauri()) {
    const downloadBtn = document.createElement('a');
    downloadBtn.className = 'peak-download-btn';
    downloadBtn.href = 'https://github.com/wtfchewy/peak/releases/latest';
    downloadBtn.target = '_blank';
    downloadBtn.rel = 'noopener noreferrer';

    const canvas = document.createElement('canvas');
    canvas.className = 'peak-download-stars';
    downloadBtn.appendChild(canvas);

    const icon = document.createElement('span');
    icon.className = 'peak-download-icon';
    render(DownloadIcon({ width: '22', height: '22' }), icon);
    downloadBtn.appendChild(icon);

    const label = document.createElement('span');
    label.className = 'peak-download-label';
    label.textContent = 'Download App';
    downloadBtn.appendChild(label);

    // Upgrade to direct .dmg link
    fetch('https://api.github.com/repos/wtfchewy/peak/releases/latest')
      .then(r => r.json())
      .then(data => {
        const dmg = data.assets?.find((a: any) => a.name.endsWith('.dmg'));
        if (dmg) downloadBtn.href = dmg.browser_download_url;
      })
      .catch(() => {});

    initStarfield(canvas, downloadBtn);
    sidebar.appendChild(downloadBtn);
  }

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
    if (isTauri()) {
      const noteId = activeNoteId.value;
      if (noteId) {
        addItem(OpenInNewIcon, 'Open in New Window', () => openNoteInNewWindow(noteId));
      }
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

function initStarfield(canvas: HTMLCanvasElement, trigger: HTMLElement) {
  const ctx = canvas.getContext('2d')!;
  let animId = 0;
  let active = false;

  interface Star { x: number; y: number; z: number }
  const STAR_COUNT = 80;
  const stars: Star[] = [];

  function resetStar(s: Star) {
    s.x = (Math.random() - 0.5) * 2;
    s.y = (Math.random() - 0.5) * 2;
    s.z = Math.random() * 0.8 + 0.2;
  }

  for (let i = 0; i < STAR_COUNT; i++) {
    const s = { x: 0, y: 0, z: 0 };
    resetStar(s);
    s.z = Math.random(); // spread initial depth
    stars.push(s);
  }

  function draw() {
    const dpr = devicePixelRatio;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const cx = w / 2;
    const cy = h / 2;

    ctx.clearRect(0, 0, w, h);

    for (const s of stars) {
      const prevZ = s.z;
      s.z -= 0.02;
      if (s.z <= 0) { resetStar(s); continue; }

      const scale = 1 / s.z;
      const sx = cx + s.x * scale * cx * 0.5;
      const sy = cy + s.y * scale * cy * 0.5;
      const r = Math.max(0.5, (1 - s.z) * 2.5);
      const alpha = 1 - s.z;

      // Motion blur streak
      const prevScale = 1 / prevZ;
      const px = cx + s.x * prevScale * cx * 0.5;
      const py = cy + s.y * prevScale * cy * 0.5;

      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(sx, sy);
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
      ctx.lineWidth = r * 0.7;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fill();
    }

    if (active) animId = requestAnimationFrame(draw);
  }

  trigger.addEventListener('mouseenter', () => {
    active = true;
    const rect = canvas.getBoundingClientRect();
    const dpr = devicePixelRatio;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    draw();
  });

  trigger.addEventListener('mouseleave', () => {
    active = false;
    cancelAnimationFrame(animId);
    const dpr = devicePixelRatio;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
  });
}
