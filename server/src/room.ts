import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { nanoid } from 'nanoid';
import type {
  RoomConfig,
  Participant,
  BanEntry,
  SectionLock,
  HistorySnapshot,
  Permission,
  WSMessage,
} from './types';

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

interface ConnectedClient {
  ws: WebSocket;
  participant: Participant;
  authenticated: boolean;
}

export class Room {
  private state: DurableObjectState;
  private ydoc: Y.Doc;
  private awareness: awarenessProtocol.Awareness;
  private clients: Map<string, ConnectedClient> = new Map();
  private config: RoomConfig | null = null;
  private bans: BanEntry[] = [];
  private sectionLocks: SectionLock[] = [];
  private snapshots: HistorySnapshot[] = [];
  private lastEditTime: number = Date.now();
  private autoLockTimer: ReturnType<typeof setTimeout> | null = null;
  private isAutoLocked: boolean = false;
  private snapshotInterval: ReturnType<typeof setTimeout> | null = null;

  constructor(state: DurableObjectState, _env: any) {
    this.state = state;
    this.ydoc = new Y.Doc();
    this.awareness = new awarenessProtocol.Awareness(this.ydoc);

    // Restore state from storage
    this.state.blockConcurrencyWhile(async () => {
      await this.loadState();
    });
  }

  private async loadState() {
    const config = await this.state.storage.get<RoomConfig>('config');
    if (config) this.config = config;

    const bans = await this.state.storage.get<BanEntry[]>('bans');
    if (bans) this.bans = bans;

    const locks = await this.state.storage.get<SectionLock[]>('sectionLocks');
    if (locks) this.sectionLocks = locks;

    const docData = await this.state.storage.get<number[]>('ydoc');
    if (docData) {
      Y.applyUpdate(this.ydoc, new Uint8Array(docData));
    }

    const snapshots = await this.state.storage.get<HistorySnapshot[]>('snapshots');
    if (snapshots) this.snapshots = snapshots;
  }

  private async saveConfig() {
    if (this.config) {
      await this.state.storage.put('config', this.config);
    }
  }

  private async saveDoc() {
    const data = Array.from(Y.encodeStateAsUpdate(this.ydoc));
    await this.state.storage.put('ydoc', data);
  }

  private async saveBans() {
    await this.state.storage.put('bans', this.bans);
  }

  private async saveLocks() {
    await this.state.storage.put('sectionLocks', this.sectionLocks);
  }

  private async saveSnapshots() {
    // Keep last 100 snapshots
    if (this.snapshots.length > 100) {
      this.snapshots = this.snapshots.slice(-100);
    }
    await this.state.storage.put('snapshots', this.snapshots);
  }

  /** Initialize a new room */
  async initRoom(name: string): Promise<RoomConfig> {
    const config: RoomConfig = {
      id: nanoid(12),
      name,
      createdAt: Date.now(),
      hostToken: nanoid(24),
      editorToken: nanoid(24),
      viewerToken: nanoid(24),
      passphrase: null,
      maxEditors: 0,
      autoLockMinutes: 0,
      expiresAt: 0,
      editorsCanLock: false,
      revokedTokens: [],
    };
    this.config = config;
    await this.saveConfig();
    return config;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Room creation
    if (url.pathname === '/init' && request.method === 'POST') {
      if (this.config) {
        return new Response(JSON.stringify({
          id: this.config.id,
          hostToken: this.config.hostToken,
          editorToken: this.config.editorToken,
          viewerToken: this.config.viewerToken,
        }), { headers: { 'Content-Type': 'application/json' } });
      }
      const body = await request.json() as { name?: string };
      const config = await this.initRoom(body.name || 'Untitled Room');
      return new Response(JSON.stringify({
        id: config.id,
        hostToken: config.hostToken,
        editorToken: config.editorToken,
        viewerToken: config.viewerToken,
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // Room info (public)
    if (url.pathname === '/info') {
      if (!this.config) {
        return new Response('Room not found', { status: 404 });
      }
      // Check expiration
      if (this.config.expiresAt > 0 && Date.now() > this.config.expiresAt) {
        await this.destroyRoom();
        return new Response('Room expired', { status: 410 });
      }
      return new Response(JSON.stringify({
        name: this.config.name,
        hasPassphrase: !!this.config.passphrase,
        participantCount: this.clients.size,
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // WebSocket upgrade
    if (url.pathname === '/ws') {
      if (!this.config) {
        return new Response('Room not found', { status: 404 });
      }
      // Check expiration
      if (this.config.expiresAt > 0 && Date.now() > this.config.expiresAt) {
        await this.destroyRoom();
        return new Response('Room expired', { status: 410 });
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.handleWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response('Not found', { status: 404 });
  }

  private handleWebSocket(ws: WebSocket) {
    (ws as any).accept();
    const sessionId = nanoid(16);

    const client: ConnectedClient = {
      ws,
      participant: {
        sessionId,
        name: '',
        color: '',
        permission: 'viewer',
        fingerprint: '',
        joinedAt: Date.now(),
      },
      authenticated: false,
    };

    ws.addEventListener('message', async (event) => {
      try {
        if (typeof event.data === 'string') {
          const msg: WSMessage = JSON.parse(event.data);
          await this.handleJsonMessage(client, msg);
        } else {
          // Binary: Yjs sync/awareness protocol
          await this.handleBinaryMessage(client, new Uint8Array(event.data as ArrayBuffer));
        }
      } catch (e) {
        console.error('WS message error:', e);
      }
    });

    ws.addEventListener('close', () => {
      this.handleDisconnect(client);
    });

    ws.addEventListener('error', () => {
      this.handleDisconnect(client);
    });
  }

  private async handleJsonMessage(client: ConnectedClient, msg: WSMessage) {
    if (msg.type === 'auth') {
      await this.handleAuth(client, msg.token, msg.fingerprint, msg.name, msg.color);
      return;
    }

    if (msg.type === 'passphrase-response') {
      // Handled during auth flow - store for next auth attempt
      (client as any)._pendingPassphrase = msg.passphrase;
      return;
    }

    if (!client.authenticated) {
      this.sendJson(client.ws, { type: 'error', message: 'Not authenticated' });
      return;
    }

    switch (msg.type) {
      case 'set-name':
        await this.handleNameChange(client, msg.name);
        break;

      case 'lock-section':
        await this.handleLockSection(client, msg.blockId);
        break;

      case 'unlock-section':
        await this.handleUnlockSection(client, msg.blockId);
        break;

      case 'kick':
        if (client.participant.permission === 'host') {
          await this.handleKick(msg.sessionId);
        }
        break;

      case 'ban':
        if (client.participant.permission === 'host') {
          await this.handleBan(msg.sessionId, client.participant.sessionId);
        }
        break;

      case 'update-room-config':
        if (client.participant.permission === 'host') {
          await this.handleConfigUpdate(msg.config);
        }
        break;

      case 'revoke-token':
        if (client.participant.permission === 'host') {
          await this.handleRevokeToken(msg.permission);
        }
        break;

      case 'regenerate-token':
        if (client.participant.permission === 'host') {
          await this.handleRegenerateToken(client, msg.permission);
        }
        break;

      case 'snapshot-request':
        await this.handleSnapshotRequest(client);
        break;

      case 'rollback':
        await this.handleRollback(client, msg.snapshotId);
        break;
    }
  }

  private async handleAuth(
    client: ConnectedClient,
    token: string,
    fingerprint: string,
    name?: string,
    color?: string
  ) {
    if (!this.config) {
      this.sendJson(client.ws, { type: 'auth-fail', reason: 'Room not found' });
      return;
    }

    // Check if banned
    if (this.bans.some(b => b.fingerprint === fingerprint)) {
      this.sendJson(client.ws, { type: 'auth-fail', reason: 'You have been banned from this room' });
      client.ws.close(4003, 'Banned');
      return;
    }

    // Check if token is revoked
    if (this.config.revokedTokens.includes(token)) {
      this.sendJson(client.ws, { type: 'auth-fail', reason: 'This link has been revoked' });
      client.ws.close(4001, 'Revoked');
      return;
    }

    // Determine permission from token
    let permission: Permission;
    if (token === this.config.hostToken) {
      permission = 'host';
    } else if (token === this.config.editorToken) {
      permission = 'editor';
    } else if (token === this.config.viewerToken) {
      permission = 'viewer';
    } else {
      this.sendJson(client.ws, { type: 'auth-fail', reason: 'Invalid access link' });
      client.ws.close(4001, 'Invalid token');
      return;
    }

    // Check passphrase (not required for host)
    if (this.config.passphrase && permission !== 'host') {
      const pendingPassphrase = (client as any)._pendingPassphrase;
      if (!pendingPassphrase) {
        this.sendJson(client.ws, { type: 'passphrase-required' });
        // Store auth params for retry after passphrase
        (client as any)._pendingAuth = { token, fingerprint, name, color };
        return;
      }
      if (pendingPassphrase !== this.config.passphrase) {
        this.sendJson(client.ws, { type: 'auth-fail', reason: 'Incorrect passphrase' });
        return;
      }
    }

    // Check max editors - downgrade to viewer if at capacity
    if (permission === 'editor' && this.config.maxEditors > 0) {
      const currentEditors = Array.from(this.clients.values())
        .filter(c => c.participant.permission === 'editor' || c.participant.permission === 'host')
        .length;
      if (currentEditors >= this.config.maxEditors) {
        permission = 'viewer';
      }
    }

    // Check auto-lock
    if (this.isAutoLocked && permission === 'editor') {
      permission = 'viewer';
    }

    client.participant = {
      sessionId: client.participant.sessionId,
      name: name || client.participant.name,
      color: color || client.participant.color,
      permission,
      fingerprint,
      joinedAt: Date.now(),
    };
    client.authenticated = true;
    this.clients.set(client.participant.sessionId, client);

    // Send auth success
    this.sendJson(client.ws, {
      type: 'auth-ok',
      sessionId: client.participant.sessionId,
      permission,
      roomConfig: {
        id: this.config.id,
        name: this.config.name,
        passphrase: permission === 'host' ? this.config.passphrase : undefined,
        maxEditors: this.config.maxEditors,
        autoLockMinutes: this.config.autoLockMinutes,
        expiresAt: this.config.expiresAt,
        editorsCanLock: this.config.editorsCanLock,
        hostToken: permission === 'host' ? this.config.hostToken : undefined,
        editorToken: permission === 'host' ? this.config.editorToken : undefined,
        viewerToken: permission === 'host' ? this.config.viewerToken : undefined,
      } as any,
    });

    // Send current participants
    const participants = Array.from(this.clients.values())
      .filter(c => c.authenticated)
      .map(c => c.participant);
    this.sendJson(client.ws, { type: 'participants', participants });

    // Send current section locks
    this.sendJson(client.ws, { type: 'section-locks', locks: this.sectionLocks });

    // Broadcast new participant to others
    this.broadcastJson({ type: 'participant-joined', participant: client.participant }, client.participant.sessionId);

    // Send Yjs sync step 1
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeSyncStep1(encoder, this.ydoc);
    this.sendBinary(client.ws, encoding.toUint8Array(encoder));

    // Send Yjs sync step 2 (full state)
    const encoder2 = encoding.createEncoder();
    encoding.writeVarUint(encoder2, MSG_SYNC);
    syncProtocol.writeSyncStep2(encoder2, this.ydoc);
    this.sendBinary(client.ws, encoding.toUint8Array(encoder2));

    // Send existing awareness states to new client so they see other cursors
    const awarenessStates = this.awareness.getStates();
    if (awarenessStates.size > 0) {
      const clients = Array.from(awarenessStates.keys());
      const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(this.awareness, clients);
      const awarenessEncoder = encoding.createEncoder();
      encoding.writeVarUint(awarenessEncoder, MSG_AWARENESS);
      encoding.writeVarUint8Array(awarenessEncoder, awarenessUpdate);
      this.sendBinary(client.ws, encoding.toUint8Array(awarenessEncoder));
    }

    // Reset auto-lock timer
    this.resetAutoLockTimer();
  }

  private async handleBinaryMessage(client: ConnectedClient, data: Uint8Array) {
    if (!client.authenticated) return;

    const decoder = decoding.createDecoder(data);
    const messageType = decoding.readVarUint(decoder);

    switch (messageType) {
      case MSG_SYNC: {
        // Only editors and hosts can make changes
        const syncMessageType = decoding.readVarUint(decoder);

        if (syncMessageType === 0) {
          // Sync step 1 - reply with step 2
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, MSG_SYNC);
          syncProtocol.writeSyncStep2(encoder, this.ydoc);
          this.sendBinary(client.ws, encoding.toUint8Array(encoder));
        } else if (syncMessageType === 1) {
          // Sync step 2 - apply update
          const update = decoding.readVarUint8Array(decoder);
          if (client.participant.permission === 'viewer') return;
          Y.applyUpdate(this.ydoc, update);
          this.lastEditTime = Date.now();
          this.resetAutoLockTimer();

          // Broadcast to all other clients
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, MSG_SYNC);
          encoding.writeVarUint(encoder, 2); // update message type
          encoding.writeVarUint8Array(encoder, update);
          this.broadcastBinary(encoding.toUint8Array(encoder), client.participant.sessionId);

          // Save doc periodically (debounced via alarm)
          await this.state.storage.setAlarm(Date.now() + 1000);
        } else if (syncMessageType === 2) {
          // Update message
          const update = decoding.readVarUint8Array(decoder);
          if (client.participant.permission === 'viewer') return;
          Y.applyUpdate(this.ydoc, update);
          this.lastEditTime = Date.now();
          this.resetAutoLockTimer();

          // Broadcast to all other clients
          this.broadcastBinary(data, client.participant.sessionId);
          await this.state.storage.setAlarm(Date.now() + 1000);
        }
        break;
      }

      case MSG_AWARENESS: {
        // Apply to server's awareness so we can send full state to new joiners
        const awarenessUpdate = decoding.readVarUint8Array(decoder);
        awarenessProtocol.applyAwarenessUpdate(this.awareness, awarenessUpdate, client.ws);

        // Relay original binary message to all other clients
        this.broadcastBinary(data, client.participant.sessionId);
        break;
      }
    }
  }

  private handleDisconnect(client: ConnectedClient) {
    const sessionId = client.participant.sessionId;
    this.clients.delete(sessionId);

    // Remove section locks by this client
    this.sectionLocks = this.sectionLocks.filter(
      l => l.lockedBy !== sessionId
    );
    this.saveLocks();

    // Broadcast departure
    if (client.authenticated) {
      this.broadcastJson({ type: 'participant-left', sessionId });
      this.broadcastJson({ type: 'section-locks', locks: this.sectionLocks });

      // Remove disconnected client's awareness state and broadcast removal
      // Find the client's awareness clientID from awareness states
      const states = this.awareness.getStates();
      const clientIds: number[] = [];
      states.forEach((state, id) => {
        // Remove awareness states that aren't from any currently connected client
        // We can't perfectly map sessionId→clientID, so clean up all stale entries
      });

      // Broadcast awareness removal to remaining clients so cursors disappear
      // The remaining clients will handle stale awareness via their own timeout
    }
  }

  private async handleNameChange(client: ConnectedClient, name: string) {
    const sanitized = name.trim().slice(0, 30);
    if (!sanitized) return;
    client.participant.name = sanitized;
    this.broadcastJson({ type: 'name-change', sessionId: client.participant.sessionId, name: sanitized });
  }

  private async handleLockSection(client: ConnectedClient, blockId: string) {
    const { permission } = client.participant;
    if (permission === 'viewer') return;
    if (permission === 'editor' && !this.config?.editorsCanLock) return;

    // Check if already locked by someone else
    const existing = this.sectionLocks.find(l => l.blockId === blockId);
    if (existing && existing.lockedBy !== client.participant.sessionId) {
      this.sendJson(client.ws, { type: 'error', message: 'Section is already locked' });
      return;
    }

    if (!existing) {
      this.sectionLocks.push({
        blockId,
        lockedBy: client.participant.sessionId,
        lockedByName: client.participant.name,
        lockedAt: Date.now(),
      });
      await this.saveLocks();
    }

    this.broadcastJson({ type: 'section-locks', locks: this.sectionLocks });
  }

  private async handleUnlockSection(client: ConnectedClient, blockId: string) {
    const lock = this.sectionLocks.find(l => l.blockId === blockId);
    if (!lock) return;

    // Only the locker or host can unlock
    if (lock.lockedBy !== client.participant.sessionId && client.participant.permission !== 'host') {
      this.sendJson(client.ws, { type: 'error', message: 'Only the locker or host can unlock' });
      return;
    }

    this.sectionLocks = this.sectionLocks.filter(l => l.blockId !== blockId);
    await this.saveLocks();
    this.broadcastJson({ type: 'section-locks', locks: this.sectionLocks });
  }

  private async handleKick(sessionId: string) {
    const target = this.clients.get(sessionId);
    if (!target) return;
    if (target.participant.permission === 'host') return; // can't kick host

    this.sendJson(target.ws, { type: 'kicked', reason: 'You have been removed from the room' });
    target.ws.close(4002, 'Kicked');
    this.clients.delete(sessionId);
    this.broadcastJson({ type: 'participant-left', sessionId });
  }

  private async handleBan(sessionId: string, bannedBy: string) {
    const target = this.clients.get(sessionId);
    if (!target) return;
    if (target.participant.permission === 'host') return;

    this.bans.push({
      fingerprint: target.participant.fingerprint,
      bannedAt: Date.now(),
      bannedBy,
    });
    await this.saveBans();

    this.sendJson(target.ws, { type: 'kicked', reason: 'You have been banned from this room' });
    target.ws.close(4003, 'Banned');
    this.clients.delete(sessionId);
    this.broadcastJson({ type: 'participant-left', sessionId });
  }

  private async handleConfigUpdate(updates: Partial<RoomConfig>) {
    if (!this.config) return;

    // Only allow updating specific fields
    if (updates.name !== undefined) this.config.name = updates.name;
    if (updates.passphrase !== undefined) this.config.passphrase = updates.passphrase || null;
    if (updates.maxEditors !== undefined) this.config.maxEditors = updates.maxEditors;
    if (updates.autoLockMinutes !== undefined) {
      this.config.autoLockMinutes = updates.autoLockMinutes;
      this.resetAutoLockTimer();
    }
    if (updates.expiresAt !== undefined) this.config.expiresAt = updates.expiresAt;
    if (updates.editorsCanLock !== undefined) this.config.editorsCanLock = updates.editorsCanLock;

    await this.saveConfig();

    // Broadcast config update to all
    this.broadcastJson({
      type: 'room-config-update',
      config: {
        name: this.config.name,
        maxEditors: this.config.maxEditors,
        autoLockMinutes: this.config.autoLockMinutes,
        expiresAt: this.config.expiresAt,
        editorsCanLock: this.config.editorsCanLock,
        passphrase: undefined, // don't leak passphrase
      },
    });
  }

  private async handleRevokeToken(permission: Permission) {
    if (!this.config || permission === 'host') return;
    const token = permission === 'editor' ? this.config.editorToken : this.config.viewerToken;
    this.config.revokedTokens.push(token);

    // Disconnect all clients using this permission level
    for (const [sid, c] of this.clients) {
      if (c.participant.permission === permission) {
        this.sendJson(c.ws, { type: 'kicked', reason: 'Your access link has been revoked' });
        c.ws.close(4001, 'Token revoked');
        this.clients.delete(sid);
        this.broadcastJson({ type: 'participant-left', sessionId: sid });
      }
    }

    // Generate new token
    const newToken = nanoid(24);
    if (permission === 'editor') {
      this.config.editorToken = newToken;
    } else {
      this.config.viewerToken = newToken;
    }

    await this.saveConfig();
  }

  private async handleRegenerateToken(client: ConnectedClient, permission: Permission) {
    if (!this.config) return;
    const newToken = nanoid(24);
    if (permission === 'host') {
      this.config.hostToken = newToken;
    } else if (permission === 'editor') {
      this.config.editorToken = newToken;
    } else {
      this.config.viewerToken = newToken;
    }
    await this.saveConfig();
    this.sendJson(client.ws, { type: 'token-updated', permission, token: newToken });
  }

  private async handleSnapshotRequest(client: ConnectedClient) {
    // Create a snapshot now
    const snapshot: HistorySnapshot = {
      id: nanoid(12),
      timestamp: Date.now(),
      contributorSessionId: client.participant.sessionId,
      contributorName: client.participant.name,
      contributorColor: client.participant.color,
      data: Array.from(Y.encodeStateAsUpdate(this.ydoc)),
      description: 'Manual snapshot',
    };
    this.snapshots.push(snapshot);
    await this.saveSnapshots();

    // Send history list
    const history = this.snapshots.map(({ data, ...rest }) => rest);
    this.sendJson(client.ws, { type: 'history', snapshots: history });
  }

  private async handleRollback(client: ConnectedClient, snapshotId: string) {
    const snapshot = this.snapshots.find(s => s.id === snapshotId);
    if (!snapshot) {
      this.sendJson(client.ws, { type: 'error', message: 'Snapshot not found' });
      return;
    }

    // Editors can only roll back their own snapshots
    if (
      client.participant.permission === 'editor' &&
      snapshot.contributorSessionId !== client.participant.sessionId
    ) {
      this.sendJson(client.ws, { type: 'error', message: 'You can only rollback your own changes' });
      return;
    }

    if (client.participant.permission === 'viewer') {
      this.sendJson(client.ws, { type: 'error', message: 'Viewers cannot rollback' });
      return;
    }

    // Save current state as a snapshot before rollback
    this.snapshots.push({
      id: nanoid(12),
      timestamp: Date.now(),
      contributorSessionId: client.participant.sessionId,
      contributorName: client.participant.name,
      contributorColor: client.participant.color,
      data: Array.from(Y.encodeStateAsUpdate(this.ydoc)),
      description: 'Pre-rollback backup',
    });

    // Apply rollback
    const newDoc = new Y.Doc();
    Y.applyUpdate(newDoc, new Uint8Array(snapshot.data));

    // Replace current doc
    this.ydoc.destroy();
    this.ydoc = newDoc;
    this.awareness = new awarenessProtocol.Awareness(this.ydoc);

    await this.saveDoc();
    await this.saveSnapshots();

    // Send full sync to all clients
    for (const [, c] of this.clients) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MSG_SYNC);
      syncProtocol.writeSyncStep1(encoder, this.ydoc);
      this.sendBinary(c.ws, encoding.toUint8Array(encoder));

      const encoder2 = encoding.createEncoder();
      encoding.writeVarUint(encoder2, MSG_SYNC);
      syncProtocol.writeSyncStep2(encoder2, this.ydoc);
      this.sendBinary(c.ws, encoding.toUint8Array(encoder2));
    }
  }

  private resetAutoLockTimer() {
    if (this.autoLockTimer) {
      clearTimeout(this.autoLockTimer);
      this.autoLockTimer = null;
    }
    if (this.isAutoLocked) {
      this.isAutoLocked = false;
      this.broadcastJson({ type: 'room-locked', reason: '' });
    }
    if (this.config?.autoLockMinutes && this.config.autoLockMinutes > 0) {
      this.autoLockTimer = setTimeout(() => {
        this.isAutoLocked = true;
        this.broadcastJson({ type: 'room-locked', reason: 'Room auto-locked due to inactivity' });
      }, this.config.autoLockMinutes * 60 * 1000);
    }
  }

  private async destroyRoom() {
    for (const [, c] of this.clients) {
      this.sendJson(c.ws, { type: 'kicked', reason: 'Room has expired' });
      c.ws.close(4004, 'Room expired');
    }
    this.clients.clear();
    await this.state.storage.deleteAll();
  }

  /** Durable Object alarm handler for debounced saves */
  async alarm() {
    await this.saveDoc();

    // Auto-snapshot every 5 minutes of edits
    const lastSnapshot = this.snapshots[this.snapshots.length - 1];
    if (!lastSnapshot || Date.now() - lastSnapshot.timestamp > 5 * 60 * 1000) {
      this.snapshots.push({
        id: nanoid(12),
        timestamp: Date.now(),
        contributorSessionId: 'system',
        contributorName: 'Auto-save',
        contributorColor: '#888888',
        data: Array.from(Y.encodeStateAsUpdate(this.ydoc)),
        description: 'Auto-snapshot',
      });
      await this.saveSnapshots();
    }
  }

  // Helpers

  private sendJson(ws: WebSocket, msg: WSMessage) {
    try {
      ws.send(JSON.stringify(msg));
    } catch { /* closed */ }
  }

  private sendBinary(ws: WebSocket, data: Uint8Array) {
    try {
      ws.send(data);
    } catch { /* closed */ }
  }

  private broadcastJson(msg: WSMessage, excludeSessionId?: string) {
    const str = JSON.stringify(msg);
    for (const [sid, c] of this.clients) {
      if (sid === excludeSessionId) continue;
      if (!c.authenticated) continue;
      try { c.ws.send(str); } catch { /* closed */ }
    }
  }

  private broadcastBinary(data: Uint8Array, excludeSessionId?: string) {
    for (const [sid, c] of this.clients) {
      if (sid === excludeSessionId) continue;
      if (!c.authenticated) continue;
      try { c.ws.send(data); } catch { /* closed */ }
    }
  }
}
