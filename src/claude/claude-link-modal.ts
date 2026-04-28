import { render } from 'lit';
import { CloseIcon } from '@blocksuite/icons/lit';
import {
  linkClaudeSession,
  parseClaudeSessionInput,
  notes,
} from '../storage/note-store';

let overlay: HTMLElement | null = null;

export function closeClaudeLinkModal() {
  if (overlay) {
    overlay.remove();
    overlay = null;
  }
}

export function openClaudeLinkModal(noteId: string) {
  if (overlay) return;

  const existing = notes.value.find(n => n.id === noteId)?.claudeSession;

  overlay = document.createElement('div');
  overlay.className = 'peak-import-overlay';
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeClaudeLinkModal();
  });

  const panel = document.createElement('div');
  panel.className = 'peak-import-panel peak-claude-link-panel';

  // Header
  const header = document.createElement('div');
  header.className = 'peak-import-header';

  const headerText = document.createElement('span');
  headerText.textContent = existing ? 'Change Claude Code Session' : 'Link Claude Code Session';
  header.appendChild(headerText);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'peak-import-close';
  render(CloseIcon({ width: '20', height: '20' }), closeBtn);
  closeBtn.addEventListener('click', closeClaudeLinkModal);
  header.appendChild(closeBtn);

  panel.appendChild(header);

  // Description
  const desc = document.createElement('div');
  desc.className = 'peak-claude-link-desc';
  desc.innerHTML = `
    Paste a session ID or a <code>claude.ai/code/session_…</code> URL.
    In the terminal, run <code>claude --resume</code> to list your sessions.
  `;
  panel.appendChild(desc);

  // Session ID input
  const idLabel = document.createElement('label');
  idLabel.className = 'peak-claude-link-label';
  idLabel.textContent = 'Session ID or URL';
  panel.appendChild(idLabel);

  const idInput = document.createElement('input');
  idInput.className = 'peak-claude-link-input';
  idInput.type = 'text';
  idInput.placeholder = 'e.g. 01LB22d1Cn2ivjghdBDLSbVp';
  idInput.autocomplete = 'off';
  idInput.spellcheck = false;
  if (existing?.id) idInput.value = existing.id;
  panel.appendChild(idInput);

  // Project path input (optional)
  const pathLabel = document.createElement('label');
  pathLabel.className = 'peak-claude-link-label';
  pathLabel.textContent = 'Project path (optional — runs cd before claude)';
  panel.appendChild(pathLabel);

  const pathInput = document.createElement('input');
  pathInput.className = 'peak-claude-link-input';
  pathInput.type = 'text';
  pathInput.placeholder = '~/code/my-project';
  pathInput.autocomplete = 'off';
  pathInput.spellcheck = false;
  if (existing?.projectPath) pathInput.value = existing.projectPath;
  panel.appendChild(pathInput);

  // Error line
  const errorEl = document.createElement('div');
  errorEl.className = 'peak-claude-link-error';
  panel.appendChild(errorEl);

  // Actions row
  const actions = document.createElement('div');
  actions.className = 'peak-claude-link-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'peak-claude-link-btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', closeClaudeLinkModal);
  actions.appendChild(cancelBtn);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'peak-claude-link-btn primary';
  saveBtn.textContent = existing ? 'Update link' : 'Link session';

  async function submit() {
    const parsedId = parseClaudeSessionInput(idInput.value);
    if (!parsedId) {
      errorEl.textContent = "Couldn't find a session ID in that input.";
      idInput.focus();
      return;
    }
    const projectPath = pathInput.value.trim() || undefined;
    saveBtn.disabled = true;
    try {
      await linkClaudeSession(noteId, parsedId, projectPath);
      closeClaudeLinkModal();
    } catch (err) {
      errorEl.textContent = err instanceof Error ? err.message : String(err);
      saveBtn.disabled = false;
    }
  }

  saveBtn.addEventListener('click', submit);
  actions.appendChild(saveBtn);

  panel.appendChild(actions);

  // Enter submits from either input
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    } else if (e.key === 'Escape') {
      closeClaudeLinkModal();
    }
  };
  idInput.addEventListener('keydown', onKey);
  pathInput.addEventListener('keydown', onKey);

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  // Autofocus
  setTimeout(() => idInput.focus(), 0);
}
