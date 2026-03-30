import './notch-style.css';
import { emit } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

const widget = document.getElementById('notch-widget')!;

// The Dynamic Island pill
const island = document.createElement('div');
island.className = 'notch-island';

// Content (visible only when opened)
const content = document.createElement('div');
content.className = 'notch-content';

const btn = document.createElement('button');
btn.className = 'notch-btn';
btn.title = 'New note';
btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;

const label = document.createElement('span');
label.className = 'notch-label';
label.textContent = 'New Note';

content.appendChild(btn);
content.appendChild(label);
island.appendChild(content);
widget.appendChild(island);

// --- State ---
let opened = false;
let outsideCount = 0; // how many consecutive polls cursor was outside

function setInteractive(interactive: boolean) {
  invoke('notch_set_interactive', { interactive }).catch(() => {});
}

function open() {
  if (opened) return;
  opened = true;
  outsideCount = 0;
  island.classList.add('opened');
  setInteractive(true);
  // Focus the notch window after the animation completes so clicks register
  setTimeout(() => {
    if (opened) getCurrentWindow().setFocus().catch(() => {});
  }, 500);
}

function close() {
  if (!opened) return;
  opened = false;
  island.classList.remove('opened');
  setInteractive(false);
}

// Click "+" → create note in main window
btn.addEventListener('click', async () => {
  await emit('notch-create-note');
  close();
});

// --- Cursor polling (drives all state) ---
// Poll NSEvent.mouseLocation from Rust every 50ms.
// Returns [inHoverZone, inWindow]:
//   inHoverZone = cursor in the top 48px (notch trigger area)
//   inWindow = cursor anywhere in the 440x120 window frame
//
// When closed: if cursor enters hover zone → open + make interactive
// When opened: if cursor leaves window for ~300ms → close + make non-interactive
setInterval(async () => {
  try {
    const [inHoverZone, inWindow]: [boolean, boolean] = await invoke('notch_poll_cursor');

    if (!opened) {
      // Closed: watch for cursor entering the hover zone
      if (inHoverZone) {
        open();
      }
    } else {
      // Opened: watch for cursor leaving the entire window
      if (inWindow) {
        outsideCount = 0;
      } else {
        outsideCount++;
        // ~300ms (6 polls at 50ms) outside the window → collapse
        if (outsideCount >= 6) {
          close();
        }
      }
    }
  } catch {
    // ignore errors during shutdown
  }
}, 50);
