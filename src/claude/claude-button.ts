import type { NoteMeta } from '../types';
import {
  openClaudeSessionInTerminal,
  unlinkClaudeSession,
  getClaudeWebUrl,
} from '../storage/note-store';
import { isTauri } from '../platform';
import { openClaudeLinkModal } from './claude-link-modal';

/**
 * Claude-inspired sparkle icon. Uses an 8-pointed star/sparkle, inline and
 * monochrome so it inherits `currentColor` from the button.
 */
function claudeLogoSvg(size: number): string {
  return `
    <svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 2 13.5 9 20.5 10.5 13.5 12 12 19 10.5 12 3.5 10.5 10.5 9z"/>
      <path d="M19 3 19.7 5.3 22 6 19.7 6.7 19 9 18.3 6.7 16 6 18.3 5.3z"/>
    </svg>
  `;
}

let activePopover: HTMLElement | null = null;

function closePopover() {
  if (activePopover) {
    activePopover.remove();
    activePopover = null;
    document.removeEventListener('click', onOutsideClick, true);
    document.removeEventListener('keydown', onPopoverKey, true);
  }
}

function onOutsideClick(e: MouseEvent) {
  if (!activePopover) return;
  const target = e.target as Node | null;
  if (target && activePopover.contains(target)) return;
  const anchor = (activePopover as any)._anchor as HTMLElement | undefined;
  if (anchor && target && anchor.contains(target)) return;
  closePopover();
}

function onPopoverKey(e: KeyboardEvent) {
  if (e.key === 'Escape') closePopover();
}

function formatDate(ts: number): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return '';
  }
}

function shortenId(id: string): string {
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

function openPopover(anchor: HTMLElement, note: NoteMeta) {
  closePopover();
  const session = note.claudeSession;
  if (!session) return;

  const pop = document.createElement('div');
  pop.className = 'peak-claude-popover';
  (pop as any)._anchor = anchor;

  const title = document.createElement('div');
  title.className = 'peak-claude-popover-title';
  title.textContent = 'Claude Code session';
  pop.appendChild(title);

  // Session ID row
  const idRow = document.createElement('div');
  idRow.className = 'peak-claude-popover-row';
  const idLabel = document.createElement('span');
  idLabel.className = 'peak-claude-popover-label';
  idLabel.textContent = 'ID';
  const idValue = document.createElement('span');
  idValue.className = 'peak-claude-popover-value peak-claude-popover-mono';
  idValue.textContent = shortenId(session.id);
  idValue.title = session.id;
  idRow.appendChild(idLabel);
  idRow.appendChild(idValue);
  pop.appendChild(idRow);

  // Linked date
  const dateRow = document.createElement('div');
  dateRow.className = 'peak-claude-popover-row';
  const dateLabel = document.createElement('span');
  dateLabel.className = 'peak-claude-popover-label';
  dateLabel.textContent = 'Linked';
  const dateValue = document.createElement('span');
  dateValue.className = 'peak-claude-popover-value';
  dateValue.textContent = formatDate(session.linkedAt);
  dateRow.appendChild(dateLabel);
  dateRow.appendChild(dateValue);
  pop.appendChild(dateRow);

  // Project path
  if (session.projectPath) {
    const pathRow = document.createElement('div');
    pathRow.className = 'peak-claude-popover-row';
    const pathLabel = document.createElement('span');
    pathLabel.className = 'peak-claude-popover-label';
    pathLabel.textContent = 'Path';
    const pathValue = document.createElement('span');
    pathValue.className = 'peak-claude-popover-value peak-claude-popover-mono';
    pathValue.textContent = session.projectPath;
    pathValue.title = session.projectPath;
    pathRow.appendChild(pathLabel);
    pathRow.appendChild(pathValue);
    pop.appendChild(pathRow);
  }

  const hint = document.createElement('div');
  hint.className = 'peak-claude-popover-hint';
  hint.textContent = isTauri()
    ? 'Resumes with `claude --resume` in your default terminal.'
    : 'Terminal resume is only available in the desktop app.';
  pop.appendChild(hint);

  // Action buttons
  const actions = document.createElement('div');
  actions.className = 'peak-claude-popover-actions';

  function addAction(label: string, onClick: () => void, variant: 'primary' | 'default' | 'danger' = 'default', disabled = false) {
    const btn = document.createElement('button');
    btn.className = `peak-claude-popover-btn ${variant}`;
    btn.textContent = label;
    btn.disabled = disabled;
    btn.addEventListener('click', () => {
      onClick();
    });
    actions.appendChild(btn);
    return btn;
  }

  addAction('Open in Terminal', async () => {
    try {
      await openClaudeSessionInTerminal(note.id);
      closePopover();
    } catch (err) {
      hint.textContent = err instanceof Error ? err.message : String(err);
    }
  }, 'primary', !isTauri());

  addAction('Open on Web', () => {
    window.open(getClaudeWebUrl(session.id), '_blank', 'noopener');
    closePopover();
  });

  addAction('Copy Session ID', async () => {
    try {
      await navigator.clipboard.writeText(session.id);
      hint.textContent = 'Copied to clipboard.';
    } catch {
      hint.textContent = "Couldn't copy — check clipboard permissions.";
    }
  });

  addAction('Change Link', () => {
    closePopover();
    openClaudeLinkModal(note.id);
  });

  addAction('Unlink', async () => {
    await unlinkClaudeSession(note.id);
    closePopover();
  }, 'danger');

  pop.appendChild(actions);

  // Position below the button
  document.body.appendChild(pop);
  const anchorRect = anchor.getBoundingClientRect();
  const popRect = pop.getBoundingClientRect();
  const margin = 8;
  let left = anchorRect.right - popRect.width;
  if (left < margin) left = margin;
  if (left + popRect.width > window.innerWidth - margin) {
    left = window.innerWidth - popRect.width - margin;
  }
  const top = anchorRect.bottom + 6;
  pop.style.position = 'fixed';
  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;

  activePopover = pop;
  // Defer listener so the triggering click doesn't immediately close us
  setTimeout(() => {
    document.addEventListener('click', onOutsideClick, true);
    document.addEventListener('keydown', onPopoverKey, true);
  }, 0);
}

export interface ClaudeButtonHandle {
  element: HTMLElement;
  update(note: NoteMeta | undefined): void;
}

/**
 * Create a button that appears in the note header when a Claude Code session
 * is linked. Click to show an info popover with actions.
 */
export function createClaudeButton(): ClaudeButtonHandle {
  const btn = document.createElement('button');
  btn.className = 'peak-mode-btn peak-claude-header-btn';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Claude Code session');
  btn.innerHTML = claudeLogoSvg(18);

  const tooltip = document.createElement('affine-tooltip');
  tooltip.setAttribute('tip-position', 'bottom-end');
  tooltip.textContent = 'Claude Code session';
  btn.appendChild(tooltip);

  let currentNote: NoteMeta | undefined;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!currentNote?.claudeSession) return;
    if (activePopover) {
      closePopover();
      return;
    }
    openPopover(btn, currentNote);
  });

  function update(note: NoteMeta | undefined) {
    currentNote = note;
    const linked = !!note?.claudeSession;
    btn.classList.toggle('visible', linked);
    if (!linked && activePopover) closePopover();
  }

  update(undefined);

  return { element: btn, update };
}
