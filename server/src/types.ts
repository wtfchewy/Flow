/** Permission levels for room access */
export type Permission = 'host' | 'editor' | 'viewer';

/** Room configuration stored in Durable Object storage */
export interface RoomConfig {
  id: string;
  name: string;
  createdAt: number;

  /** Secret tokens for each permission level */
  hostToken: string;
  editorToken: string;
  viewerToken: string;

  /** Optional passphrase for room entry */
  passphrase: string | null;

  /** Max simultaneous editors (0 = unlimited) */
  maxEditors: number;

  /** Auto-lock after N minutes of inactivity (0 = disabled) */
  autoLockMinutes: number;

  /** Room expiration timestamp (0 = never) */
  expiresAt: number;

  /** Whether editors can lock sections */
  editorsCanLock: boolean;

  /** Revoked tokens (invalidated links) */
  revokedTokens: string[];
}

/** A connected participant */
export interface Participant {
  sessionId: string;
  name: string;
  color: string;
  permission: Permission;
  fingerprint: string;
  joinedAt: number;
}

/** Banned session fingerprints */
export interface BanEntry {
  fingerprint: string;
  bannedAt: number;
  bannedBy: string;
}

/** Section lock state */
export interface SectionLock {
  blockId: string;
  lockedBy: string; // sessionId
  lockedByName: string;
  lockedAt: number;
}

/** History snapshot */
export interface HistorySnapshot {
  id: string;
  timestamp: number;
  contributorSessionId: string;
  contributorName: string;
  contributorColor: string;
  data: number[]; // Yjs state as array
  description: string;
}

/** WebSocket message types */
export type WSMessage =
  | { type: 'sync'; data: number[] }
  | { type: 'awareness'; data: number[] }
  | { type: 'auth'; token: string; fingerprint: string; name?: string; color?: string }
  | { type: 'auth-ok'; sessionId: string; permission: Permission; roomConfig: Partial<RoomConfig> }
  | { type: 'auth-fail'; reason: string }
  | { type: 'participants'; participants: Participant[] }
  | { type: 'participant-joined'; participant: Participant }
  | { type: 'participant-left'; sessionId: string }
  | { type: 'name-change'; sessionId: string; name: string }
  | { type: 'set-name'; name: string }
  | { type: 'lock-section'; blockId: string }
  | { type: 'unlock-section'; blockId: string }
  | { type: 'section-locks'; locks: SectionLock[] }
  | { type: 'kick'; sessionId: string }
  | { type: 'ban'; sessionId: string }
  | { type: 'kicked'; reason: string }
  | { type: 'room-config-update'; config: Partial<RoomConfig> }
  | { type: 'update-room-config'; config: Partial<RoomConfig> }
  | { type: 'revoke-token'; permission: Permission }
  | { type: 'regenerate-token'; permission: Permission }
  | { type: 'token-updated'; permission: Permission; token: string }
  | { type: 'snapshot-request' }
  | { type: 'history'; snapshots: Omit<HistorySnapshot, 'data'>[] }
  | { type: 'rollback'; snapshotId: string }
  | { type: 'room-locked'; reason: string }
  | { type: 'error'; message: string }
  | { type: 'passphrase-required' }
  | { type: 'passphrase-response'; passphrase: string };
