/**
 * WebSocket provider for Yjs document sync + awareness + room protocol.
 * Connects to Peak collab server Durable Object.
 *
 * Awareness is bridged into BlockSuite's awareness engine via
 * CollabAwarenessSource (implements AwarenessSource interface).
 */
import * as Y from 'yjs';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import {
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  type Awareness,
} from 'y-protocols/awareness';
import type { AwarenessSource } from '@blocksuite/affine/sync';
import type { Permission, Participant, SectionLock, WSMessage, RoomConfig } from '../../server/src/types';

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

export type CollabEventMap = {
  'auth-ok': { sessionId: string; permission: Permission; roomConfig: Partial<RoomConfig> };
  'auth-fail': { reason: string };
  'participants': { participants: Participant[] };
  'participant-joined': { participant: Participant };
  'participant-left': { sessionId: string };
  'name-change': { sessionId: string; name: string };
  'section-locks': { locks: SectionLock[] };
  'room-config-update': { config: Partial<RoomConfig> };
  'room-locked': { reason: string };
  'kicked': { reason: string };
  'history': { snapshots: any[] };
  'token-updated': { permission: Permission; token: string };
  'passphrase-required': {};
  'error': { message: string };
  'connected': {};
  'disconnected': {};
  'synced': {};
};

type Listener<T> = (data: T) => void;

/**
 * AwarenessSource implementation for BlockSuite's awareness engine.
 * Relays awareness updates over the shared WebSocket connection.
 *
 * Can be created in "dormant" mode (no provider) and activated later
 * via setProvider(). This allows the workspace to be created once with
 * the awareness source, then providers are swapped per-session.
 */
export class CollabAwarenessSource implements AwarenessSource {
  awareness: Awareness | null = null;
  private provider: CollabProvider | null;

  constructor(provider?: CollabProvider) {
    this.provider = provider ?? null;
  }

  /** Swap the active provider (null = dormant, no-op on send) */
  setProvider(provider: CollabProvider | null) {
    this.provider = provider;
  }

  private _onAwarenessChange = (
    changes: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown
  ) => {
    if (origin === 'remote') return;
    if (!this.awareness || !this.provider) return;

    const changedClients = changes.added.concat(changes.updated).concat(changes.removed);
    const update = encodeAwarenessUpdate(this.awareness, changedClients);

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_AWARENESS);
    encoding.writeVarUint8Array(encoder, update);
    this.provider.sendBinary(encoding.toUint8Array(encoder));
  };

  connect(awareness: Awareness): void {
    this.awareness = awareness;
    awareness.on('update', this._onAwarenessChange);
  }

  /** Broadcast full local awareness state (call after auth + user info is set) */
  announcePresence() {
    if (!this.awareness || !this.provider) return;
    const update = encodeAwarenessUpdate(this.awareness, [this.awareness.clientID]);
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_AWARENESS);
    encoding.writeVarUint8Array(encoder, update);
    this.provider.sendBinary(encoding.toUint8Array(encoder));
  }

  disconnect(): void {
    this.awareness?.off('update', this._onAwarenessChange);
    this.awareness = null;
  }

  /** Called by CollabProvider when a binary awareness message arrives from the server */
  handleRemoteUpdate(data: Uint8Array) {
    if (!this.awareness) return;
    applyAwarenessUpdate(this.awareness, data, 'remote');
  }
}

export class CollabProvider {
  private ws: WebSocket | null = null;
  private doc: Y.Doc;
  private serverUrl: string;
  private roomId: string;
  private token: string;
  private fingerprint: string;
  private name: string;
  private color: string;
  private listeners = new Map<string, Set<Listener<any>>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private synced = false;
  private destroyed = false;

  /** Optional external handler for incoming awareness updates (set by collab-store) */
  onAwarenessUpdate: ((data: Uint8Array) => void) | null = null;

  /** The awareness source to pass to TestWorkspace's awarenessSources */
  readonly awarenessSource: CollabAwarenessSource;

  constructor(opts: {
    doc: Y.Doc;
    serverUrl: string;
    roomId: string;
    token: string;
    fingerprint: string;
    name: string;
    color: string;
  }) {
    this.doc = opts.doc;
    this.serverUrl = opts.serverUrl;
    this.roomId = opts.roomId;
    this.token = opts.token;
    this.fingerprint = opts.fingerprint;
    this.name = opts.name;
    this.color = opts.color;
    this.awarenessSource = new CollabAwarenessSource(this);

    // Listen for local doc updates and send to server
    this.doc.on('update', this._onDocUpdate);
  }

  /** Re-bind to a different Y.Doc (e.g. after workspace creates the real spaceDoc) */
  rebindDoc(doc: Y.Doc) {
    // Remove listener from old doc
    this.doc.off('update', this._onDocUpdate);
    this.doc = doc;
    // Attach to new doc
    this.doc.on('update', this._onDocUpdate);
  }

  private _onDocUpdate = (update: Uint8Array, origin: any) => {
    if (origin === this) return;
    this.sendBinaryUpdate(update);
  };

  /** Start WebSocket connection (call after workspace is set up) */
  connect() {
    if (this.destroyed) return;
    this._connect();
  }

  on<K extends keyof CollabEventMap>(event: K, listener: Listener<CollabEventMap[K]>) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
  }

  off<K extends keyof CollabEventMap>(event: K, listener: Listener<CollabEventMap[K]>) {
    this.listeners.get(event)?.delete(listener);
  }

  private emit<K extends keyof CollabEventMap>(event: K, data: CollabEventMap[K]) {
    this.listeners.get(event)?.forEach(fn => fn(data));
  }

  private _connect() {
    if (this.destroyed) return;

    const wsUrl = this.serverUrl.replace(/^http/, 'ws') + `/api/rooms/${this.roomId}/ws`;
    this.ws = new WebSocket(wsUrl);
    this.ws.binaryType = 'arraybuffer';

    this.ws.addEventListener('open', () => {
      this.emit('connected', {});
      // Authenticate
      this.sendJson({
        type: 'auth',
        token: this.token,
        fingerprint: this.fingerprint,
        name: this.name,
        color: this.color,
      });
    });

    this.ws.addEventListener('message', (event) => {
      if (typeof event.data === 'string') {
        this.handleJsonMessage(JSON.parse(event.data));
      } else {
        this.handleBinaryMessage(new Uint8Array(event.data));
      }
    });

    this.ws.addEventListener('close', () => {
      this.emit('disconnected', {});
      this.scheduleReconnect();
    });

    this.ws.addEventListener('error', () => {
      this.ws?.close();
    });
  }

  private scheduleReconnect() {
    if (this.destroyed || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this._connect();
    }, 2000);
  }

  private handleJsonMessage(msg: WSMessage) {
    switch (msg.type) {
      case 'auth-ok':
        this.emit('auth-ok', msg as any);
        break;
      case 'auth-fail':
        this.emit('auth-fail', msg);
        break;
      case 'participants':
        this.emit('participants', msg);
        break;
      case 'participant-joined':
        this.emit('participant-joined', msg);
        break;
      case 'participant-left':
        this.emit('participant-left', msg);
        break;
      case 'name-change':
        this.emit('name-change', msg);
        break;
      case 'section-locks':
        this.emit('section-locks', msg);
        break;
      case 'room-config-update':
        this.emit('room-config-update', msg);
        break;
      case 'room-locked':
        this.emit('room-locked', msg);
        break;
      case 'kicked':
        this.emit('kicked', msg);
        this.destroyed = true;
        this.ws?.close();
        break;
      case 'history':
        this.emit('history', msg as any);
        break;
      case 'token-updated':
        this.emit('token-updated', msg);
        break;
      case 'passphrase-required':
        this.emit('passphrase-required', {});
        break;
      case 'error':
        this.emit('error', msg);
        break;
    }
  }

  private handleBinaryMessage(data: Uint8Array) {
    const decoder = decoding.createDecoder(data);
    const messageType = decoding.readVarUint(decoder);

    switch (messageType) {
      case MSG_SYNC: {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MSG_SYNC);
        const syncType = syncProtocol.readSyncMessage(decoder, encoder, this.doc, this);
        if (encoding.length(encoder) > 1) {
          this.ws?.send(encoding.toUint8Array(encoder));
        }
        if (syncType === 2 || syncType === 1) {
          if (!this.synced) {
            this.synced = true;
            this.emit('synced', {});
          }
        }
        break;
      }
      case MSG_AWARENESS: {
        // Forward awareness to the external handler (shared awareness source)
        // or fall back to the provider's own awareness source
        const awarenessData = decoding.readVarUint8Array(decoder);
        if (this.onAwarenessUpdate) {
          this.onAwarenessUpdate(awarenessData);
        } else {
          this.awarenessSource.handleRemoteUpdate(awarenessData);
        }
        break;
      }
    }
  }

  /** Send a binary Yjs update to the server */
  private sendBinaryUpdate(update: Uint8Array) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    encoding.writeVarUint(encoder, 2); // update message
    encoding.writeVarUint8Array(encoder, update);
    this.ws.send(encoding.toUint8Array(encoder));
  }

  /** Send raw binary data to the server (used by CollabAwarenessSource) */
  sendBinary(data: Uint8Array) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  /** Send a JSON message to the server */
  sendJson(msg: WSMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  /** Submit passphrase then retry auth */
  submitPassphrase(passphrase: string) {
    this.sendJson({ type: 'passphrase-response', passphrase });
    this.sendJson({
      type: 'auth',
      token: this.token,
      fingerprint: this.fingerprint,
      name: this.name,
      color: this.color,
    });
  }

  /** Change display name */
  setName(name: string) {
    this.name = name;
    this.sendJson({ type: 'set-name', name });
  }

  /** Optional external awareness source for announcing presence (set by collab-store) */
  externalAwarenessSource: CollabAwarenessSource | null = null;

  /** Broadcast local awareness state to announce presence to other clients */
  announcePresence() {
    // Prefer the external (workspace-connected) awareness source over the internal one
    if (this.externalAwarenessSource) {
      this.externalAwarenessSource.announcePresence();
    } else {
      this.awarenessSource.announcePresence();
    }
  }

  lockSection(blockId: string) { this.sendJson({ type: 'lock-section', blockId }); }
  unlockSection(blockId: string) { this.sendJson({ type: 'unlock-section', blockId }); }
  kick(sessionId: string) { this.sendJson({ type: 'kick', sessionId }); }
  ban(sessionId: string) { this.sendJson({ type: 'ban', sessionId }); }
  updateRoomConfig(config: Partial<RoomConfig>) { this.sendJson({ type: 'update-room-config', config }); }
  revokeToken(permission: 'editor' | 'viewer') { this.sendJson({ type: 'revoke-token', permission }); }
  regenerateToken(permission: 'host' | 'editor' | 'viewer') { this.sendJson({ type: 'regenerate-token', permission }); }
  requestHistory() { this.sendJson({ type: 'snapshot-request' }); }
  rollback(snapshotId: string) { this.sendJson({ type: 'rollback', snapshotId }); }

  destroy() {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.awarenessSource.disconnect();
    this.ws?.close();
  }
}
