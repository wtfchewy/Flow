/**
 * Share modal — opens from the lock/share icon in the mode toggle.
 * Three tabs when sharing: Links, People, History.
 * Not-sharing state: "Start Sharing" button.
 */
import { render } from 'lit';
import { CloseIcon, CopyIcon, DeleteIcon } from '@blocksuite/icons/lit';
import { effect } from '@preact/signals-core';
import {
  activeCollabSession,
  createRoom,
  leaveRoom,
  closeRoom,
  type CollabSession,
} from './collab-store';
import { activeNoteId, notes, getActiveStore, getWorkspaceRef } from '../storage/note-store';
import { getYDoc } from '../editor/setup';
import { saveNote } from '../storage/persistence';
import { getIdentity } from './identity';
import type { Participant, Permission } from '../../server/src/types';

let overlay: HTMLElement | null = null;
let disposeEffect: (() => void) | null = null;

export function openShareModal() {
  if (overlay) return;

  overlay = document.createElement('div');
  overlay.className = 'peak-share-overlay';
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeShareModal();
  });

  const panel = document.createElement('div');
  panel.className = 'peak-share-panel';
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  // Reactively re-render panel contents based on session state
  disposeEffect = effect(() => {
    const session = activeCollabSession.value;
    renderPanel(panel, session);
  });
}

export function closeShareModal() {
  if (disposeEffect) {
    disposeEffect();
    disposeEffect = null;
  }
  if (overlay) {
    overlay.remove();
    overlay = null;
  }
}

function renderPanel(panel: HTMLElement, session: CollabSession | null) {
  panel.innerHTML = '';

  // Header
  const header = document.createElement('div');
  header.className = 'peak-share-header';

  const title = document.createElement('span');
  title.className = 'peak-share-title';
  title.textContent = session ? 'Sharing' : 'Share';
  header.appendChild(title);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'peak-share-close';
  render(CloseIcon({ width: '18', height: '18' }), closeBtn);
  closeBtn.addEventListener('click', closeShareModal);
  header.appendChild(closeBtn);

  panel.appendChild(header);

  if (!session) {
    renderNotSharing(panel);
  } else {
    renderSharing(panel, session);
  }
}

function renderNotSharing(panel: HTMLElement) {
  const body = document.createElement('div');
  body.className = 'peak-share-body';

  const desc = document.createElement('div');
  desc.className = 'peak-share-desc';
  desc.textContent = 'Start sharing to collaborate in real-time with others.';
  body.appendChild(desc);

  const identity = getIdentity();
  const preview = document.createElement('div');
  preview.className = 'peak-share-identity-preview';

  const dot = document.createElement('span');
  dot.className = 'peak-share-color-dot';
  dot.style.background = identity.color;
  preview.appendChild(dot);

  const nameSpan = document.createElement('span');
  nameSpan.textContent = `Sharing as ${identity.name}`;
  nameSpan.className = 'peak-share-identity-name';
  preview.appendChild(nameSpan);

  body.appendChild(preview);

  const startBtn = document.createElement('button');
  startBtn.className = 'peak-share-start-btn';
  startBtn.textContent = 'Start Sharing';
  startBtn.addEventListener('click', async () => {
    const noteId = activeNoteId.value;
    if (!noteId) return;

    startBtn.textContent = 'Creating room...';
    startBtn.disabled = true;

    try {
      const store = getActiveStore();
      if (!store) return;
      const doc = getYDoc(store);

      const { roomId, hostToken, editorToken, viewerToken } = await createRoom(noteId, doc);

      // Set awareness user info on the workspace so cursors show
      const ws = getWorkspaceRef();
      const identity = getIdentity();
      if (ws.awarenessStore) {
        ws.awarenessStore.setLocalStateField('user', { name: identity.name });
        ws.awarenessStore.setLocalStateField('color', identity.color);
      }

      // Update note meta with collab fields
      const noteList = notes.value;
      const noteMeta = noteList.find(n => n.id === noteId);
      if (noteMeta) {
        const updated = noteList.map(n =>
          n.id === noteId ? { ...n, shared: true, roomId, roomToken: hostToken, isHost: true } : n
        );
        notes.value = updated;

        // Persist updated meta
        await saveNote(noteId, noteMeta.title, noteMeta.preview, noteMeta.mode || 'page', doc, noteMeta.pinned || false);
      }
    } catch (e) {
      console.error('Failed to create room:', e);
      startBtn.textContent = 'Failed — Retry';
      startBtn.disabled = false;
    }
  });

  body.appendChild(startBtn);
  panel.appendChild(body);
}

function renderSharing(panel: HTMLElement, session: CollabSession) {
  // Tab bar
  const tabs = document.createElement('div');
  tabs.className = 'peak-share-tabs';

  const tabNames = ['Links', 'People'] as const;
  const tabContents: HTMLElement[] = [];

  tabNames.forEach((name, i) => {
    const tab = document.createElement('button');
    tab.className = `peak-share-tab ${i === 0 ? 'active' : ''}`;
    tab.textContent = name;
    if (name === 'People' && session.participants.length > 0) {
      tab.textContent = `${name} (${session.participants.length})`;
    }
    tab.addEventListener('click', () => {
      tabs.querySelectorAll('.peak-share-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      tabContents.forEach((c, j) => {
        c.style.display = j === i ? 'block' : 'none';
      });
    });
    tabs.appendChild(tab);
  });
  panel.appendChild(tabs);

  // Tab content containers
  const linksContent = createLinksTab(session);
  const peopleContent = createPeopleTab(session);

  linksContent.style.display = 'block';
  peopleContent.style.display = 'none';

  tabContents.push(linksContent, peopleContent);

  panel.appendChild(linksContent);
  panel.appendChild(peopleContent);

  // Footer: Stop Sharing / Leave Room
  const footer = document.createElement('div');
  footer.className = 'peak-share-footer';

  const actionBtn = document.createElement('button');
  actionBtn.className = 'peak-share-stop-btn';

  if (session.isHost) {
    actionBtn.textContent = 'Stop Sharing';
    actionBtn.addEventListener('click', () => {
      closeRoom(session.noteId);
      // Update note meta
      const updated = notes.value.map(n =>
        n.id === session.noteId ? { ...n, shared: false, roomId: undefined, roomToken: undefined, isHost: undefined } : n
      );
      notes.value = updated;
      closeShareModal();
    });
  } else {
    actionBtn.textContent = 'Leave Room';
    actionBtn.addEventListener('click', () => {
      leaveRoom(session.noteId);
      closeShareModal();
    });
  }

  footer.appendChild(actionBtn);
  panel.appendChild(footer);
}

function createLinksTab(session: CollabSession): HTMLElement {
  const container = document.createElement('div');
  container.className = 'peak-share-tab-content';

  if (!session.isHost) {
    const msg = document.createElement('div');
    msg.className = 'peak-share-desc';
    msg.textContent = 'Only the host can manage share links.';
    container.appendChild(msg);
    return container;
  }

  const config = session.roomConfig as any;
  const baseUrl = `${window.location.origin}${window.location.pathname}`;
  const roomId = session.roomId;

  const links: { label: string; token: string; permission: string; revocable: boolean }[] = [
    { label: 'Host', token: config.hostToken || session.token, permission: 'host', revocable: false },
    { label: 'Editor', token: config.editorToken || '', permission: 'editor', revocable: true },
    { label: 'Viewer', token: config.viewerToken || '', permission: 'viewer', revocable: true },
  ];

  for (const link of links) {
    if (!link.token) continue;
    const url = `${baseUrl}?room=${roomId}&token=${link.token}&docId=${session.noteId}`;

    const row = document.createElement('div');
    row.className = 'peak-share-link-row';

    const label = document.createElement('span');
    label.className = 'peak-share-link-label';
    label.textContent = link.label;
    row.appendChild(label);

    const urlEl = document.createElement('span');
    urlEl.className = 'peak-share-link-url';
    urlEl.textContent = url;
    row.appendChild(urlEl);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'peak-share-icon-btn';
    copyBtn.title = 'Copy link';
    render(CopyIcon({ width: '16', height: '16' }), copyBtn);
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(url);
      copyBtn.title = 'Copied!';
      setTimeout(() => { copyBtn.title = 'Copy link'; }, 1500);
    });
    row.appendChild(copyBtn);

    if (link.revocable) {
      const revokeBtn = document.createElement('button');
      revokeBtn.className = 'peak-share-icon-btn danger';
      revokeBtn.title = `Revoke ${link.label.toLowerCase()} links`;
      render(DeleteIcon({ width: '16', height: '16' }), revokeBtn);
      revokeBtn.addEventListener('click', () => {
        if (confirm(`Revoke all ${link.label.toLowerCase()} links? They will be disconnected.`)) {
          session.provider.revokeToken(link.permission as 'editor' | 'viewer');
        }
      });
      row.appendChild(revokeBtn);
    }

    container.appendChild(row);
  }

  return container;
}

function createPeopleTab(session: CollabSession): HTMLElement {
  const container = document.createElement('div');
  container.className = 'peak-share-tab-content';

  if (session.participants.length === 0) {
    const msg = document.createElement('div');
    msg.className = 'peak-share-desc';
    msg.textContent = 'No one else is here yet.';
    container.appendChild(msg);
    return container;
  }

  for (const p of session.participants) {
    const row = document.createElement('div');
    row.className = 'peak-share-participant-row';

    const avatar = document.createElement('div');
    avatar.className = 'peak-share-avatar';
    avatar.style.background = p.color;
    avatar.textContent = p.name.charAt(0).toUpperCase();
    row.appendChild(avatar);

    const info = document.createElement('div');
    info.className = 'peak-share-participant-info';

    const name = document.createElement('div');
    name.className = 'peak-share-participant-name';
    name.textContent = p.sessionId === session.sessionId ? `${p.name} (you)` : p.name;
    info.appendChild(name);

    const role = document.createElement('div');
    role.className = 'peak-share-participant-role';
    role.textContent = p.permission;
    info.appendChild(role);

    row.appendChild(info);

    // Kick/Ban for host (not self)
    if (session.isHost && p.sessionId !== session.sessionId) {
      const kickBtn = document.createElement('button');
      kickBtn.className = 'peak-share-icon-btn danger';
      kickBtn.title = 'Kick';
      kickBtn.textContent = 'Kick';
      kickBtn.addEventListener('click', () => {
        session.provider.kick(p.sessionId);
      });
      row.appendChild(kickBtn);

      const banBtn = document.createElement('button');
      banBtn.className = 'peak-share-icon-btn danger';
      banBtn.title = 'Ban';
      banBtn.textContent = 'Ban';
      banBtn.addEventListener('click', () => {
        if (confirm(`Ban ${p.name}? They won't be able to rejoin.`)) {
          session.provider.ban(p.sessionId);
        }
      });
      row.appendChild(banBtn);
    }

    container.appendChild(row);
  }

  return container;
}

