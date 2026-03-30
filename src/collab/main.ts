import './collab-style.css';
import '../editor/editor-container';

import * as Y from 'yjs'; // needed for Y.Doc temp bootstrap
import { render } from 'lit';
import { PageIcon, EdgelessIcon } from '@blocksuite/icons/lit';
import { initBlockSuite } from '../editor/setup';
import { PeakEditorContainer } from '../editor/editor-container';
import { getCommonExtensions } from '../editor/setup';
import { getTestViewManager } from '@blocksuite/integration-test/view';
import { getTestStoreManager } from '@blocksuite/integration-test/store';
import { TestWorkspace, type DocCollectionOptions } from '@blocksuite/affine/store/test';
import { MemoryBlobSource } from '@blocksuite/affine/sync';
import { Text, type Store, type ExtensionType } from '@blocksuite/affine/store';
import type { DocMode } from '@blocksuite/affine/model';

import { getIdentity, setIdentityName, getFingerprint, type Identity } from './identity';
import { CollabProvider } from './ws-provider';
import type { Participant, SectionLock, Permission, RoomConfig } from '../../server/src/types';

// ===== Configuration =====
const SERVER_URL = import.meta.env.VITE_COLLAB_SERVER_URL || 'http://localhost:8787';

// ===== State =====
let provider: CollabProvider | null = null;
let myPermission: Permission = 'viewer';
let mySessionId = '';
let participants: Participant[] = [];
let sectionLocks: SectionLock[] = [];
let roomConfig: Partial<RoomConfig> = {};
let identity: Identity;
let currentMode: DocMode = 'page';
let store: Store;
let editorEl: PeakEditorContainer;
let workspace: TestWorkspace;

// UI References
let rosterContainer: HTMLElement;
let roomNameEl: HTMLElement;
let statusDot: HTMLElement;
let participantCountEl: HTMLElement;

const viewManager = getTestViewManager();
const storeManager = getTestStoreManager();

// ===== URL Parsing =====
function parseUrl(): { roomId: string; token: string } | null {
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get('room');
  const token = params.get('token');
  if (!roomId || !token) return null;
  return { roomId, token };
}

// ===== Entry Point =====
async function main() {
  const app = document.getElementById('collab-app')!;
  const urlInfo = parseUrl();

  if (!urlInfo) {
    showCreateRoom(app);
    return;
  }

  showLoading(app, 'Connecting to room...');

  initBlockSuite();
  identity = getIdentity();

  // Create the provider first (but don't connect yet) so we can get its awarenessSource
  // We need a temporary Y.Doc to bootstrap; the real sync goes through spaceDoc
  const tempDoc = new Y.Doc();
  provider = new CollabProvider({
    doc: tempDoc,
    serverUrl: SERVER_URL,
    roomId: urlInfo.roomId,
    token: urlInfo.token,
    fingerprint: getFingerprint(),
    name: identity.name,
    color: identity.color,
  });

  // Create workspace with the provider's awareness source
  const options: DocCollectionOptions = {
    id: 'collab-workspace',
    blobSources: { main: new MemoryBlobSource(), shadows: [] },
    awarenessSources: [provider.awarenessSource],
  };
  workspace = new TestWorkspace(options);
  workspace.storeExtensions = storeManager.get('store');
  workspace.meta.initialize();
  workspace.start(); // This connects awareness sources

  const doc = workspace.createDoc('collab-doc');
  store = doc.getStore({ id: 'collab-doc' });

  // Now re-bind the provider to the actual spaceDoc (replacing the temp doc)
  provider.rebindDoc(store.spaceDoc);

  // Auth handlers — set user info on BlockSuite awareness store
  provider.on('auth-ok', (data) => {
    mySessionId = data.sessionId;
    myPermission = data.permission;
    roomConfig = data.roomConfig;

    // Set local user info on BlockSuite's awareness store for remote cursor rendering
    workspace.awarenessStore.setLocalStateField('user', { name: identity.name });
    workspace.awarenessStore.setLocalStateField('color', identity.color);

    // Announce our presence so other clients see our cursor
    // Small delay to ensure awareness fields are committed before encoding
    setTimeout(() => provider?.announcePresence(), 100);
  });

  provider.on('auth-fail', (data) => {
    app.innerHTML = '';
    showError(app, data.reason);
  });

  provider.on('passphrase-required', () => {
    app.innerHTML = '';
    showPassphraseGate(app, urlInfo);
  });

  provider.on('kicked', (data) => {
    app.innerHTML = '';
    showKicked(app, data.reason);
  });

  // Wait for sync then build UI
  provider.on('synced', () => {
    // Load doc via Store.load() — this triggers StoreSelectionExtension.loaded()
    // which subscribes to awareness changes for remote cursor rendering
    if (!store.root) {
      store.load(() => {
        const rootId = store.addBlock('affine:page', { title: new Text() });
        store.addBlock('affine:surface', {}, rootId);
        const noteId = store.addBlock('affine:note', {}, rootId);
        store.addBlock('affine:paragraph', {}, noteId);
      });
    } else {
      store.load();
    }

    app.innerHTML = '';
    buildCollabUI(app);

    // Re-announce presence after editor is built so selection extensions are active
    setTimeout(() => provider?.announcePresence(), 500);
  });

  // Presence events
  provider.on('participants', (data) => {
    participants = data.participants;
    updateRoster();
  });

  provider.on('participant-joined', (data) => {
    participants = participants.filter(p => p.sessionId !== data.participant.sessionId);
    participants.push(data.participant);
    updateRoster();
  });

  provider.on('participant-left', (data) => {
    participants = participants.filter(p => p.sessionId !== data.sessionId);
    updateRoster();
  });

  provider.on('name-change', (data) => {
    const p = participants.find(p => p.sessionId === data.sessionId);
    if (p) p.name = data.name;
    updateRoster();
  });

  provider.on('section-locks', (data) => {
    sectionLocks = data.locks;
  });

  provider.on('room-config-update', (data) => {
    Object.assign(roomConfig, data.config);
    if (roomNameEl) roomNameEl.textContent = roomConfig.name || 'Untitled Room';
  });

  provider.on('connected', () => {
    if (statusDot) statusDot.classList.remove('disconnected');
  });

  provider.on('disconnected', () => {
    if (statusDot) statusDot.classList.add('disconnected');
  });

  provider.on('room-locked', (data) => {
    if (data.reason) {
      // Auto-locked — show banner
    }
  });

  // Now connect the WebSocket
  provider.connect();
}

// ===== Create Room Screen =====
function showCreateRoom(container: HTMLElement) {
  container.innerHTML = `
    <div class="collab-gate">
      <div class="collab-gate-title">Peak Collaborate</div>
      <div class="collab-gate-subtitle">Create a new room to start collaborating</div>
      <div class="collab-gate-form">
        <input class="collab-gate-input" id="room-name-input" placeholder="Room name (optional)" />
        <button class="collab-gate-btn" id="create-room-btn">Create Room</button>
      </div>
      <div class="collab-gate-error" id="create-error"></div>
    </div>
  `;

  const btn = document.getElementById('create-room-btn')!;
  const input = document.getElementById('room-name-input') as HTMLInputElement;
  const error = document.getElementById('create-error')!;

  btn.addEventListener('click', async () => {
    btn.textContent = 'Creating...';
    try {
      const res = await fetch(`${SERVER_URL}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: input.value || 'Untitled Room' }),
      });
      const data = await res.json() as any;
      // Navigate to host link
      const hostUrl = `${window.location.origin}${window.location.pathname}?room=${data.roomId}&token=${data.hostToken}`;
      window.location.href = hostUrl;
    } catch (e: any) {
      error.textContent = 'Failed to create room. Is the server running?';
      btn.textContent = 'Create Room';
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btn.click();
  });
}

// ===== Passphrase Gate =====
function showPassphraseGate(container: HTMLElement, urlInfo: { roomId: string; token: string }) {
  container.innerHTML = `
    <div class="collab-gate">
      <div class="collab-gate-title">This room requires a passphrase</div>
      <div class="collab-gate-subtitle">Enter the passphrase to join</div>
      <div class="collab-gate-form">
        <input class="collab-gate-input" id="passphrase-input" type="text" placeholder="Passphrase" autocomplete="off" />
        <button class="collab-gate-btn" id="passphrase-btn">Enter</button>
      </div>
      <div class="collab-gate-error" id="passphrase-error"></div>
    </div>
  `;

  const btn = document.getElementById('passphrase-btn')!;
  const input = document.getElementById('passphrase-input') as HTMLInputElement;

  const submit = () => {
    const passphrase = input.value.trim();
    if (!passphrase) return;
    provider?.submitPassphrase(passphrase);
  };

  btn.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  input.focus();

  provider?.on('auth-fail', (data) => {
    document.getElementById('passphrase-error')!.textContent = data.reason;
  });
}

// ===== Loading Screen =====
function showLoading(container: HTMLElement, text: string) {
  container.innerHTML = `
    <div class="collab-loading">
      <div class="collab-loading-spinner"></div>
      <div class="collab-loading-text">${text}</div>
    </div>
  `;
}

// ===== Error Screen =====
function showError(container: HTMLElement, message: string) {
  container.innerHTML = `
    <div class="collab-gate">
      <div class="collab-gate-title">Cannot join room</div>
      <div class="collab-gate-error">${message}</div>
    </div>
  `;
}

// ===== Kicked Screen =====
function showKicked(container: HTMLElement, reason: string) {
  container.innerHTML = `
    <div class="collab-kicked">
      <div class="collab-kicked-title">Disconnected</div>
      <div class="collab-kicked-message">${reason}</div>
    </div>
  `;
}

// ===== Main Collaboration UI =====
function buildCollabUI(container: HTMLElement) {
  // Top bar
  const topbar = document.createElement('div');
  topbar.className = 'collab-topbar';

  // Left: room name + connection status
  const topLeft = document.createElement('div');
  topLeft.className = 'collab-topbar-left';

  statusDot = document.createElement('div');
  statusDot.className = 'collab-status-dot';
  topLeft.appendChild(statusDot);

  roomNameEl = document.createElement('div');
  roomNameEl.className = 'collab-room-name';
  roomNameEl.textContent = roomConfig.name || 'Untitled Room';
  topLeft.appendChild(roomNameEl);

  topbar.appendChild(topLeft);

  // Center: mode toggle
  const topCenter = document.createElement('div');
  topCenter.className = 'collab-topbar-center';

  const modeToggle = document.createElement('div');
  modeToggle.className = 'collab-mode-toggle';

  const modeSlider = document.createElement('div');
  modeSlider.className = 'collab-mode-slider';
  modeToggle.appendChild(modeSlider);

  const pageBtn = document.createElement('button');
  pageBtn.className = 'collab-mode-btn active';
  pageBtn.title = 'Page mode';
  render(PageIcon({ width: '16', height: '16' }), pageBtn);

  const edgelessBtn = document.createElement('button');
  edgelessBtn.className = 'collab-mode-btn';
  edgelessBtn.title = 'Edgeless mode';
  render(EdgelessIcon({ width: '16', height: '16' }), edgelessBtn);

  pageBtn.addEventListener('click', () => switchMode('page'));
  edgelessBtn.addEventListener('click', () => switchMode('edgeless'));

  modeToggle.appendChild(pageBtn);
  modeToggle.appendChild(edgelessBtn);
  topCenter.appendChild(modeToggle);
  topbar.appendChild(topCenter);

  // Right: roster + buttons
  const topRight = document.createElement('div');
  topRight.className = 'collab-topbar-right';

  // My name (editable)
  const nameEdit = document.createElement('div');
  nameEdit.className = 'collab-name-edit';
  nameEdit.innerHTML = `
    <div class="collab-name-color-dot" style="background:${identity.color}"></div>
    <span class="collab-name-text">${identity.name}</span>
  `;
  nameEdit.addEventListener('click', () => {
    const newName = prompt('Change your display name:', identity.name);
    if (newName && newName.trim()) {
      identity = setIdentityName(newName);
      nameEdit.querySelector('.collab-name-text')!.textContent = identity.name;
      provider?.setName(identity.name);
      // Update BlockSuite awareness so remote cursors show new name
      workspace.awarenessStore.setLocalStateField('user', { name: identity.name });
    }
  });
  topRight.appendChild(nameEdit);

  // Roster
  rosterContainer = document.createElement('div');
  rosterContainer.className = 'collab-roster';
  topRight.appendChild(rosterContainer);

  // Share button (host/editor)
  if (myPermission === 'host') {
    const shareBtn = document.createElement('button');
    shareBtn.className = 'collab-btn';
    shareBtn.textContent = 'Share';
    shareBtn.addEventListener('click', () => showSharePanel());
    topRight.appendChild(shareBtn);

    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'collab-btn';
    settingsBtn.textContent = 'Settings';
    settingsBtn.addEventListener('click', () => showSettingsPanel());
    topRight.appendChild(settingsBtn);

    const historyBtn = document.createElement('button');
    historyBtn.className = 'collab-btn';
    historyBtn.textContent = 'History';
    historyBtn.addEventListener('click', () => {
      provider?.requestHistory();
    });
    topRight.appendChild(historyBtn);
  } else if (myPermission === 'editor') {
    const historyBtn = document.createElement('button');
    historyBtn.className = 'collab-btn';
    historyBtn.textContent = 'History';
    historyBtn.addEventListener('click', () => {
      provider?.requestHistory();
    });
    topRight.appendChild(historyBtn);
  }

  topbar.appendChild(topRight);
  container.appendChild(topbar);

  // Read-only banner for viewers
  if (myPermission === 'viewer') {
    const banner = document.createElement('div');
    banner.className = 'collab-readonly-banner';
    banner.textContent = 'You have view-only access to this document';
    container.appendChild(banner);
  }

  // Editor
  const editorWrap = document.createElement('div');
  editorWrap.className = 'collab-editor-wrap';

  editorEl = document.createElement('peak-editor-container') as PeakEditorContainer;
  editorEl.doc = store;
  editorEl.pageSpecs = [...viewManager.get('page'), ...getCommonExtensions(editorEl)];
  editorEl.edgelessSpecs = [...viewManager.get('edgeless'), ...getCommonExtensions(editorEl)];
  editorEl.mode = 'page';

  editorWrap.appendChild(editorEl);
  container.appendChild(editorWrap);

  // Update roster
  updateRoster();

  // History panel listener
  provider?.on('history', (data) => {
    showHistoryPanel(data.snapshots);
  });

  // Mode switch helper
  function switchMode(mode: DocMode) {
    currentMode = mode;
    editorEl.switchEditor(mode);
    if (mode === 'edgeless') {
      edgelessBtn.classList.add('active');
      pageBtn.classList.remove('active');
      modeToggle.classList.add('edgeless');
    } else {
      pageBtn.classList.add('active');
      edgelessBtn.classList.remove('active');
      modeToggle.classList.remove('edgeless');
    }
  }
}

// ===== Roster Update =====
function updateRoster() {
  if (!rosterContainer) return;
  rosterContainer.innerHTML = '';

  for (const p of participants) {
    const pill = document.createElement('div');
    pill.className = 'collab-avatar-pill';
    pill.style.background = p.color;
    pill.textContent = p.name.charAt(0).toUpperCase();

    const tooltip = document.createElement('div');
    tooltip.className = 'collab-avatar-tooltip';
    tooltip.textContent = `${p.name} (${p.permission})`;
    pill.appendChild(tooltip);

    rosterContainer.appendChild(pill);
  }

  if (participantCountEl) {
    participantCountEl.textContent = `${participants.length}`;
  }
}

// ===== Share Panel =====
function showSharePanel() {
  const overlay = document.createElement('div');
  overlay.className = 'collab-panel-overlay';
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  const panel = document.createElement('div');
  panel.className = 'collab-panel';

  const baseUrl = `${window.location.origin}${window.location.pathname}`;
  const roomId = new URLSearchParams(window.location.search).get('room')!;

  panel.innerHTML = `
    <div class="collab-panel-header">
      <div class="collab-panel-title">Share Links</div>
      <button class="collab-panel-close">&times;</button>
    </div>
    <div class="collab-panel-section">
      <div class="collab-panel-section-title">Access Links</div>
      <div class="collab-link-row">
        <div class="collab-link-label">Host</div>
        <div class="collab-link-url" id="share-host-url">${baseUrl}?room=${roomId}&token=${(roomConfig as any).hostToken || '...'}</div>
        <button class="collab-btn" data-copy="share-host-url">Copy</button>
      </div>
      <div class="collab-link-row">
        <div class="collab-link-label">Editor</div>
        <div class="collab-link-url" id="share-editor-url">${baseUrl}?room=${roomId}&token=${(roomConfig as any).editorToken || '...'}</div>
        <button class="collab-btn" data-copy="share-editor-url">Copy</button>
        <button class="collab-btn collab-btn-danger" data-revoke="editor">Revoke</button>
      </div>
      <div class="collab-link-row">
        <div class="collab-link-label">Viewer</div>
        <div class="collab-link-url" id="share-viewer-url">${baseUrl}?room=${roomId}&token=${(roomConfig as any).viewerToken || '...'}</div>
        <button class="collab-btn" data-copy="share-viewer-url">Copy</button>
        <button class="collab-btn collab-btn-danger" data-revoke="viewer">Revoke</button>
      </div>
    </div>
    <div class="collab-panel-section">
      <div class="collab-panel-section-title">People in Room</div>
      <div id="share-participants"></div>
    </div>
  `;

  // Wire up copy buttons
  panel.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = (btn as HTMLElement).dataset.copy!;
      const text = document.getElementById(targetId)!.textContent!;
      navigator.clipboard.writeText(text);
      (btn as HTMLElement).textContent = 'Copied!';
      setTimeout(() => { (btn as HTMLElement).textContent = 'Copy'; }, 1500);
    });
  });

  // Wire up revoke buttons
  panel.querySelectorAll('[data-revoke]').forEach(btn => {
    btn.addEventListener('click', () => {
      const perm = (btn as HTMLElement).dataset.revoke as 'editor' | 'viewer';
      if (confirm(`Revoke all ${perm} links? Current ${perm}s will be disconnected.`)) {
        provider?.revokeToken(perm);
        overlay.remove();
      }
    });
  });

  // Close button
  panel.querySelector('.collab-panel-close')!.addEventListener('click', () => overlay.remove());

  // Populate participants
  const participantsDiv = panel.querySelector('#share-participants')!;
  for (const p of participants) {
    const row = document.createElement('div');
    row.className = 'collab-participant-row';

    const avatar = document.createElement('div');
    avatar.className = 'collab-participant-avatar';
    avatar.style.background = p.color;
    avatar.textContent = p.name.charAt(0).toUpperCase();

    const info = document.createElement('div');
    info.className = 'collab-participant-info';
    info.innerHTML = `
      <div class="collab-participant-name">${p.name}${p.sessionId === mySessionId ? ' (you)' : ''}</div>
      <div class="collab-participant-role">${p.permission}</div>
    `;

    row.appendChild(avatar);
    row.appendChild(info);

    // Kick/Ban buttons (host only, not for self)
    if (myPermission === 'host' && p.sessionId !== mySessionId) {
      const kickBtn = document.createElement('button');
      kickBtn.className = 'collab-btn collab-btn-danger';
      kickBtn.textContent = 'Kick';
      kickBtn.addEventListener('click', () => {
        provider?.kick(p.sessionId);
        row.remove();
      });

      const banBtn = document.createElement('button');
      banBtn.className = 'collab-btn collab-btn-danger';
      banBtn.textContent = 'Ban';
      banBtn.addEventListener('click', () => {
        if (confirm(`Ban ${p.name}? They won't be able to rejoin with this browser.`)) {
          provider?.ban(p.sessionId);
          row.remove();
        }
      });

      row.appendChild(kickBtn);
      row.appendChild(banBtn);
    }

    participantsDiv.appendChild(row);
  }

  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}

// ===== Settings Panel =====
function showSettingsPanel() {
  const overlay = document.createElement('div');
  overlay.className = 'collab-panel-overlay';
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  const panel = document.createElement('div');
  panel.className = 'collab-panel';

  panel.innerHTML = `
    <div class="collab-panel-header">
      <div class="collab-panel-title">Room Settings</div>
      <button class="collab-panel-close">&times;</button>
    </div>

    <div class="collab-setting-row">
      <div>
        <div class="collab-setting-label">Room Name</div>
      </div>
      <input class="collab-input" id="setting-room-name" value="${roomConfig.name || ''}" style="width:160px" />
    </div>

    <div class="collab-setting-row">
      <div>
        <div class="collab-setting-label">Passphrase</div>
        <div class="collab-setting-desc">Require a phrase to join (not for hosts)</div>
      </div>
      <input class="collab-input" id="setting-passphrase" value="${roomConfig.passphrase || ''}" placeholder="None" style="width:140px" />
    </div>

    <div class="collab-setting-row">
      <div>
        <div class="collab-setting-label">Max Editors</div>
        <div class="collab-setting-desc">0 = unlimited</div>
      </div>
      <select class="collab-select" id="setting-max-editors">
        <option value="0" ${roomConfig.maxEditors === 0 ? 'selected' : ''}>Unlimited</option>
        <option value="2" ${roomConfig.maxEditors === 2 ? 'selected' : ''}>2</option>
        <option value="5" ${roomConfig.maxEditors === 5 ? 'selected' : ''}>5</option>
        <option value="10" ${roomConfig.maxEditors === 10 ? 'selected' : ''}>10</option>
      </select>
    </div>

    <div class="collab-setting-row">
      <div>
        <div class="collab-setting-label">Auto-Lock (minutes)</div>
        <div class="collab-setting-desc">Lock to view-only after inactivity</div>
      </div>
      <select class="collab-select" id="setting-autolock">
        <option value="0" ${roomConfig.autoLockMinutes === 0 ? 'selected' : ''}>Disabled</option>
        <option value="5" ${roomConfig.autoLockMinutes === 5 ? 'selected' : ''}>5 min</option>
        <option value="15" ${roomConfig.autoLockMinutes === 15 ? 'selected' : ''}>15 min</option>
        <option value="30" ${roomConfig.autoLockMinutes === 30 ? 'selected' : ''}>30 min</option>
        <option value="60" ${roomConfig.autoLockMinutes === 60 ? 'selected' : ''}>1 hour</option>
      </select>
    </div>

    <div class="collab-setting-row">
      <div>
        <div class="collab-setting-label">Expiration</div>
        <div class="collab-setting-desc">Room self-destructs after</div>
      </div>
      <select class="collab-select" id="setting-expiration">
        <option value="0" ${!roomConfig.expiresAt ? 'selected' : ''}>Never</option>
        <option value="3600000">1 hour</option>
        <option value="86400000">24 hours</option>
        <option value="604800000">7 days</option>
      </select>
    </div>

    <div class="collab-setting-row">
      <div>
        <div class="collab-setting-label">Editors Can Lock Sections</div>
      </div>
      <button class="collab-switch ${roomConfig.editorsCanLock ? 'on' : ''}" id="setting-editors-lock">
        <div class="collab-switch-knob"></div>
      </button>
    </div>

    <div style="margin-top:16px; display:flex; justify-content:flex-end;">
      <button class="collab-btn collab-btn-primary" id="setting-save-btn">Save</button>
    </div>
  `;

  panel.querySelector('.collab-panel-close')!.addEventListener('click', () => overlay.remove());

  // Toggle switch
  const editorsLockBtn = panel.querySelector('#setting-editors-lock')!;
  editorsLockBtn.addEventListener('click', () => {
    editorsLockBtn.classList.toggle('on');
  });

  // Save
  panel.querySelector('#setting-save-btn')!.addEventListener('click', () => {
    const name = (panel.querySelector('#setting-room-name') as HTMLInputElement).value;
    const passphrase = (panel.querySelector('#setting-passphrase') as HTMLInputElement).value;
    const maxEditors = parseInt((panel.querySelector('#setting-max-editors') as HTMLSelectElement).value);
    const autoLockMinutes = parseInt((panel.querySelector('#setting-autolock') as HTMLSelectElement).value);
    const expirationMs = parseInt((panel.querySelector('#setting-expiration') as HTMLSelectElement).value);
    const editorsCanLock = editorsLockBtn.classList.contains('on');

    const expiresAt = expirationMs > 0 ? Date.now() + expirationMs : 0;

    provider?.updateRoomConfig({
      name,
      passphrase: passphrase || null,
      maxEditors,
      autoLockMinutes,
      expiresAt,
      editorsCanLock,
    } as any);

    roomConfig.name = name;
    if (roomNameEl) roomNameEl.textContent = name;

    overlay.remove();
  });

  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}

// ===== History Panel =====
function showHistoryPanel(snapshots: any[]) {
  const existing = document.querySelector('.collab-panel-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'collab-panel-overlay';
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  const panel = document.createElement('div');
  panel.className = 'collab-panel';

  const header = document.createElement('div');
  header.className = 'collab-panel-header';
  header.innerHTML = `
    <div class="collab-panel-title">Edit History</div>
    <button class="collab-panel-close">&times;</button>
  `;
  header.querySelector('.collab-panel-close')!.addEventListener('click', () => overlay.remove());
  panel.appendChild(header);

  if (snapshots.length === 0) {
    panel.innerHTML += `<div style="color:var(--affine-text-secondary-color); text-align:center; padding:20px;">No history yet</div>`;
  } else {
    const list = document.createElement('div');
    for (const snap of snapshots.reverse()) {
      const item = document.createElement('div');
      item.className = 'collab-history-item';

      const dot = document.createElement('div');
      dot.className = 'collab-history-dot';
      dot.style.background = snap.contributorColor || '#888';

      const info = document.createElement('div');
      info.className = 'collab-history-info';

      const time = new Date(snap.timestamp);
      info.innerHTML = `
        <div class="collab-history-author">${snap.contributorName}</div>
        <div class="collab-history-time">${time.toLocaleString()} — ${snap.description}</div>
      `;

      item.appendChild(dot);
      item.appendChild(info);

      // Rollback button
      const canRollback =
        myPermission === 'host' ||
        (myPermission === 'editor' && snap.contributorSessionId === mySessionId);

      if (canRollback) {
        const rollbackBtn = document.createElement('button');
        rollbackBtn.className = 'collab-btn';
        rollbackBtn.textContent = 'Restore';
        rollbackBtn.addEventListener('click', () => {
          if (confirm('Restore document to this point? Current state will be saved as a backup.')) {
            provider?.rollback(snap.id);
            overlay.remove();
          }
        });
        item.appendChild(rollbackBtn);
      }

      list.appendChild(item);
    }
    panel.appendChild(list);
  }

  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}

// ===== Bootstrap =====
main().catch(console.error);
