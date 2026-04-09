import { render } from 'lit';
import { NewPageIcon, SidebarIcon, SettingsIcon, OpenInNewIcon, DownloadIcon } from '@blocksuite/icons/lit';
import { createNote, importMarkdownFile, importHtmlFile, importMarkdownZip, importNotionZip, toggleSidebar, openNoteInNewWindow, activeNoteId } from '../storage/note-store';
import { openSettings, loadSettings, saveSettingsImmediate } from '../settings/settings';
import { renderNoteList } from './note-list';
import { isTauri } from '../platform';
import { checkForUpdate } from '../updater';

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

  // Download App button (browser) / Update button (desktop)
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

    initStarfield(canvas, downloadBtn); // return value unused for download btn
    sidebar.appendChild(downloadBtn);
  } else {
    // Desktop: show update button when an update is available
    const updateWrap = document.createElement('div');
    updateWrap.className = 'peak-update-wrap';
    updateWrap.style.display = 'none';

    const updateBtn = document.createElement('button');
    updateBtn.className = 'peak-download-btn peak-update-btn';

    const canvas = document.createElement('canvas');
    canvas.className = 'peak-download-stars';
    updateBtn.appendChild(canvas);

    const icon = document.createElement('span');
    icon.className = 'peak-download-icon';
    render(DownloadIcon({ width: '22', height: '22' }), icon);
    updateBtn.appendChild(icon);

    const label = document.createElement('span');
    label.className = 'peak-download-label';
    updateBtn.appendChild(label);

    // Dismiss X button
    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'peak-update-dismiss';
    dismissBtn.title = 'Skip this update';
    dismissBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
    let skippableVersion = '';
    dismissBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      updateWrap.style.display = 'none';
      if (skippableVersion) {
        const settings = await loadSettings();
        settings.skippedUpdateVersion = skippableVersion;
        await saveSettingsImmediate(settings);
      }
    });

    updateWrap.appendChild(updateBtn);
    updateWrap.appendChild(dismissBtn);

    const starfield = initStarfield(canvas, updateBtn);
    sidebar.appendChild(updateWrap);

    /** Map starfield progress (0-100 over full button) to the label's local clip % */
    function updateLabelColor(progressPct: number) {
      const btnRect = updateBtn.getBoundingClientRect();
      const labelRect = label.getBoundingClientRect();
      if (!btnRect.width || !labelRect.width) return;
      const progressX = (progressPct / 100) * btnRect.width;
      const labelLeft = labelRect.left - btnRect.left;
      const labelWidth = labelRect.width;
      const localPct = Math.max(0, Math.min(100, ((progressX - labelLeft) / labelWidth) * 100));
      label.style.setProperty('--pct', `${localPct}%`);
      label.classList.add('peak-progress-text');
    }

    function resetLabelColor() {
      label.classList.remove('peak-progress-text');
      label.style.removeProperty('--pct');
    }

    // Check for updates and show button if available
    checkForUpdate().then(async update => {
      if (update) {
        const settings = await loadSettings();
        if (settings.skippedUpdateVersion === update.version) return;
        skippableVersion = update.version;
        updateWrap.style.display = '';
        label.textContent = `Update to v${update.version}`;
        updateBtn.addEventListener('click', async () => {
          if (updateBtn.disabled) return;
          updateBtn.disabled = true;
          dismissBtn.style.display = 'none';
          icon.style.display = 'none';
          label.textContent = 'Downloading';
          updateBtn.classList.add('downloading');
          starfield.setAlwaysOn(true);
          // Smoothly animate progress with easing
          let displayProgress = 0;
          let targetProgress = 0;
          let rafId = 0;
          function easeInOutCubic(t: number): number {
            return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
          }
          function animateProgress() {
            const diff = targetProgress - displayProgress;
            if (Math.abs(diff) < 0.1) {
              displayProgress = targetProgress;
            } else {
              displayProgress += diff * 0.08;
            }
            const eased = easeInOutCubic(displayProgress / 100) * 100;
            starfield.setProgress(eased);
            updateLabelColor(eased);
            if (displayProgress < targetProgress || Math.abs(diff) > 0.1) {
              rafId = requestAnimationFrame(animateProgress);
            }
          }
          starfield.setProgress(0);
          updateLabelColor(0);
          try {
            let downloaded = 0;
            let total = 0;
            await update.downloadAndInstall((event: any) => {
              if (event.event === 'Started' && event.data?.contentLength) {
                total = event.data.contentLength;
              } else if (event.event === 'Progress') {
                downloaded += event.data?.chunkLength ?? 0;
                if (total > 0) {
                  targetProgress = Math.min((downloaded / total) * 100, 100);
                  cancelAnimationFrame(rafId);
                  animateProgress();
                }
              } else if (event.event === 'Finished') {
                targetProgress = 100;
                cancelAnimationFrame(rafId);
                animateProgress();
                label.textContent = 'Installing';
              }
            });
            cancelAnimationFrame(rafId);
            resetLabelColor();
            label.textContent = 'Restarting';
            label.style.setProperty('-webkit-text-fill-color', '#60a5fa');
            label.style.color = '#60a5fa';
            const { relaunch } = await import('@tauri-apps/plugin-process');
            await relaunch();
          } catch {
            cancelAnimationFrame(rafId);
            resetLabelColor();
            label.textContent = 'Update Failed';
            updateBtn.disabled = false;
            updateBtn.classList.remove('downloading');
            icon.style.display = '';
            dismissBtn.style.display = '';
            starfield.setAlwaysOn(false);
          }
        });
      }
    });
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

  // Drag-and-drop files to import (.md, .html, .htm, .zip)
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

    for (const file of files) {
      const name = file.name.toLowerCase();
      if (name.endsWith('.md')) {
        await importMarkdownFile(file);
      } else if (name.endsWith('.html') || name.endsWith('.htm')) {
        await importHtmlFile(file);
      } else if (name.endsWith('.zip')) {
        await importMarkdownZip(file);
      }
    }
  });

  return sidebar;
}

interface StarfieldControls {
  setProgress: (pct: number) => void;
  setAlwaysOn: (on: boolean) => void;
}

function initStarfield(canvas: HTMLCanvasElement, trigger: HTMLElement): StarfieldControls {
  const ctx = canvas.getContext('2d')!;
  let animId = 0;
  let active = false;
  let alwaysOn = false;
  let progress = -1; // -1 = no progress, 0-100 = download progress

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
    s.z = Math.random();
    stars.push(s);
  }

  function ensureSize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = devicePixelRatio;
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  function starColor(sx: number, w: number, alpha: number): { fill: string; stroke: string } {
    if (progress < 0) {
      return {
        fill: `rgba(255, 255, 255, ${alpha})`,
        stroke: `rgba(255, 255, 255, ${alpha * 0.5})`,
      };
    }
    // Stars left of the progress line turn blue
    const threshold = (progress / 100) * w;
    if (sx <= threshold) {
      return {
        fill: `rgba(96, 165, 250, ${alpha})`,
        stroke: `rgba(96, 165, 250, ${alpha * 0.5})`,
      };
    }
    return {
      fill: `rgba(255, 255, 255, ${alpha})`,
      stroke: `rgba(255, 255, 255, ${alpha * 0.5})`,
    };
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

      const prevScale = 1 / prevZ;
      const px = cx + s.x * prevScale * cx * 0.5;
      const py = cy + s.y * prevScale * cy * 0.5;

      const colors = starColor(sx, w, alpha);

      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(sx, sy);
      ctx.strokeStyle = colors.stroke;
      ctx.lineWidth = r * 0.7;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fillStyle = colors.fill;
      ctx.fill();
    }

    if (active || alwaysOn) animId = requestAnimationFrame(draw);
  }

  function start() {
    if (active || alwaysOn) return;
    active = true;
    ensureSize();
    draw();
  }

  function stop() {
    if (alwaysOn) return;
    active = false;
    cancelAnimationFrame(animId);
    const dpr = devicePixelRatio;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
  }

  trigger.addEventListener('mouseenter', start);
  trigger.addEventListener('mouseleave', stop);

  return {
    setProgress(pct: number) {
      progress = pct;
    },
    setAlwaysOn(on: boolean) {
      alwaysOn = on;
      if (on) {
        canvas.style.opacity = '1';
        ensureSize();
        if (!active) { active = true; draw(); }
      } else {
        canvas.style.opacity = '';
        progress = -1;
      }
    },
  };
}
