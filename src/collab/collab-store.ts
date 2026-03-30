/**
 * Central reactive state management for real-time collaboration sessions.
 * Each shared note maps to a CollabSession with its own CollabProvider.
 */
import { signal, computed } from '@preact/signals-core';
import * as Y from 'yjs';
import type { Permission, Participant, RoomConfig } from '../../server/src/types';
import { CollabProvider, type CollabAwarenessSource } from './ws-provider';
import { getIdentity, getFingerprint } from './identity';
import { activeNoteId } from '../storage/note-store';

export interface CollabSession {
  noteId: string;
  roomId: string;
  token: string;
  permission: Permission;
  provider: CollabProvider;
  participants: Participant[];
  connected: boolean;
  synced: boolean;
  roomConfig: Partial<RoomConfig>;
  sessionId: string;
  isHost: boolean;
}

/** All active collab sessions keyed by noteId */
export const collabSessions = signal<Map<string, CollabSession>>(new Map());

/** The collab session for the currently active note (if any) */
export const activeCollabSession = computed<CollabSession | null>(() => {
  const id = activeNoteId.value;
  if (!id) return null;
  return collabSessions.value.get(id) ?? null;
});

const SERVER_URL = (import.meta as any).env?.VITE_COLLAB_SERVER_URL || 'http://localhost:8787';

/** Shared awareness source — set from main.ts at workspace creation */
let sharedAwarenessSource: CollabAwarenessSource | null = null;

export function setSharedAwarenessSource(source: CollabAwarenessSource) {
  sharedAwarenessSource = source;
}

/** Create a room for an existing note (host action) */
export async function createRoom(
  noteId: string,
  doc: Y.Doc,
): Promise<{ roomId: string; hostToken: string; editorToken: string; viewerToken: string }> {
  const identity = getIdentity();

  // Create room on server
  const res = await fetch(`${SERVER_URL}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Peak Room' }),
  });

  if (!res.ok) throw new Error('Failed to create room');
  const { roomId, hostToken, editorToken, viewerToken } = await res.json() as any;

  // Create provider
  const provider = new CollabProvider({
    doc,
    serverUrl: SERVER_URL,
    roomId,
    token: hostToken,
    fingerprint: getFingerprint(),
    name: identity.name,
    color: identity.color,
  });

  const session: CollabSession = {
    noteId,
    roomId,
    token: hostToken,
    permission: 'host',
    provider,
    participants: [],
    connected: false,
    synced: false,
    roomConfig: {},
    sessionId: '',
    isHost: true,
  };

  wireSessionEvents(session);

  // Route awareness updates through the shared workspace source
  if (sharedAwarenessSource) {
    sharedAwarenessSource.setProvider(provider);
    provider.onAwarenessUpdate = (data) => sharedAwarenessSource!.handleRemoteUpdate(data);
    provider.externalAwarenessSource = sharedAwarenessSource;
  }

  provider.connect();

  updateSession(noteId, session);
  return { roomId, hostToken, editorToken, viewerToken };
}

/** Join an existing room (non-host action) */
export function joinRoom(
  noteId: string,
  roomId: string,
  token: string,
  doc: Y.Doc,
): CollabSession {
  const identity = getIdentity();

  const provider = new CollabProvider({
    doc,
    serverUrl: SERVER_URL,
    roomId,
    token,
    fingerprint: getFingerprint(),
    name: identity.name,
    color: identity.color,
  });

  const session: CollabSession = {
    noteId,
    roomId,
    token,
    permission: 'editor', // Will be updated on auth-ok
    provider,
    participants: [],
    connected: false,
    synced: false,
    roomConfig: {},
    sessionId: '',
    isHost: false,
  };

  wireSessionEvents(session);

  // Route awareness updates through the shared workspace source
  if (sharedAwarenessSource) {
    sharedAwarenessSource.setProvider(provider);
    provider.onAwarenessUpdate = (data) => sharedAwarenessSource!.handleRemoteUpdate(data);
    provider.externalAwarenessSource = sharedAwarenessSource;
  }

  provider.connect();

  updateSession(noteId, session);
  return session;
}

/** Activate awareness for a specific session (when switching notes) */
export function activateSession(noteId: string) {
  const session = collabSessions.value.get(noteId);
  if (session && sharedAwarenessSource) {
    sharedAwarenessSource.setProvider(session.provider);
    session.provider.onAwarenessUpdate = (data) => sharedAwarenessSource!.handleRemoteUpdate(data);
    session.provider.externalAwarenessSource = sharedAwarenessSource;
  }
}

/** Deactivate awareness (when switching to a non-shared note) */
export function deactivateAwareness() {
  if (sharedAwarenessSource) {
    sharedAwarenessSource.setProvider(null);
  }
}

/** Leave a room (non-host) */
export function leaveRoom(noteId: string) {
  const session = collabSessions.value.get(noteId);
  if (!session) return;

  session.provider.destroy();
  if (sharedAwarenessSource) {
    sharedAwarenessSource.setProvider(null);
  }

  const next = new Map(collabSessions.value);
  next.delete(noteId);
  collabSessions.value = next;
}

/** Close a room (host action — server will kick everyone) */
export function closeRoom(noteId: string) {
  // For now, leaving as host triggers server cleanup when WS disconnects
  leaveRoom(noteId);
}

/** Get a session by noteId */
export function getSession(noteId: string): CollabSession | undefined {
  return collabSessions.value.get(noteId);
}

/** Disconnect all sessions */
export function disconnectAll() {
  for (const session of collabSessions.value.values()) {
    session.provider.destroy();
  }
  collabSessions.value = new Map();
  if (sharedAwarenessSource) {
    sharedAwarenessSource.setProvider(null);
  }
}

// --- Internal helpers ---

function updateSession(noteId: string, session: CollabSession) {
  const next = new Map(collabSessions.value);
  next.set(noteId, { ...session });
  collabSessions.value = next;
}

function wireSessionEvents(session: CollabSession) {
  const { provider, noteId } = session;

  provider.on('connected', () => {
    session.connected = true;
    updateSession(noteId, session);
  });

  provider.on('disconnected', () => {
    session.connected = false;
    updateSession(noteId, session);
  });

  provider.on('synced', () => {
    session.synced = true;
    updateSession(noteId, session);
    // Announce presence after sync
    provider.announcePresence();
  });

  provider.on('auth-ok', (data) => {
    session.sessionId = data.sessionId;
    session.permission = data.permission;
    session.roomConfig = data.roomConfig;
    session.isHost = data.permission === 'host';
    updateSession(noteId, session);
  });

  provider.on('participants', (data) => {
    session.participants = data.participants;
    updateSession(noteId, session);
  });

  provider.on('participant-joined', (data) => {
    session.participants = [...session.participants, data.participant];
    updateSession(noteId, session);
  });

  provider.on('participant-left', (data) => {
    session.participants = session.participants.filter(p => p.sessionId !== data.sessionId);
    updateSession(noteId, session);
  });

  provider.on('room-config-update', (data) => {
    session.roomConfig = { ...session.roomConfig, ...data.config };
    updateSession(noteId, session);
  });

  provider.on('kicked', () => {
    // Clean up session — the note-store will handle removing the note
    if (sharedAwarenessSource) {
      sharedAwarenessSource.setProvider(null);
    }
    const next = new Map(collabSessions.value);
    next.delete(noteId);
    collabSessions.value = next;
  });
}
