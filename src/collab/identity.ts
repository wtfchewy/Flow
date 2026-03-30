/** Random identity generator - adjective + animal combos with session-stable colors */

const ADJECTIVES = [
  'Coral', 'Mint', 'Amber', 'Slate', 'Azure', 'Ruby', 'Sage', 'Plum',
  'Teal', 'Ivory', 'Peach', 'Indigo', 'Olive', 'Crimson', 'Cobalt', 'Jade',
  'Mauve', 'Topaz', 'Cedar', 'Frost', 'Blush', 'Storm', 'Dusk', 'Dawn',
  'Solar', 'Lunar', 'Misty', 'Rustic', 'Velvet', 'Crystal', 'Ember', 'Breeze',
  'Golden', 'Silver', 'Vivid', 'Gentle', 'Bold', 'Swift', 'Calm', 'Wild',
];

const ANIMALS = [
  'Falcon', 'Otter', 'Fox', 'Owl', 'Wolf', 'Hawk', 'Bear', 'Lynx',
  'Crane', 'Heron', 'Panda', 'Tiger', 'Raven', 'Seal', 'Dove', 'Eagle',
  'Finch', 'Bison', 'Koala', 'Whale', 'Robin', 'Stork', 'Manta', 'Viper',
  'Gecko', 'Ibis', 'Moose', 'Quail', 'Newt', 'Wren', 'Swan', 'Elk',
  'Lark', 'Puma', 'Drake', 'Moth', 'Hare', 'Jay', 'Pike', 'Carp',
];

const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD',
  '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9', '#F0B27A', '#82E0AA',
  '#F1948A', '#85929E', '#73C6B6', '#F8C471', '#AED6F1', '#D7BDE2',
  '#A3E4D7', '#FAD7A0', '#ABEBC6', '#D2B4DE', '#A9CCE3', '#F9E79F',
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export interface Identity {
  name: string;
  color: string;
  sessionId: string;
}

const STORAGE_KEY = 'peak-collab-identity';

/** Get or create a session identity. Color is fixed per session. */
export function getIdentity(): Identity {
  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch { /* regenerate */ }
  }

  const identity: Identity = {
    name: `${randomFrom(ADJECTIVES)} ${randomFrom(ANIMALS)}`,
    color: randomFrom(COLORS),
    sessionId: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
  };

  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  return identity;
}

/** Update display name (color stays the same) */
export function setIdentityName(name: string): Identity {
  const identity = getIdentity();
  identity.name = name.trim().slice(0, 30) || identity.name;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  return identity;
}

/** Get fingerprint for ban tracking */
export function getFingerprint(): string {
  let fp = localStorage.getItem('peak-collab-fingerprint');
  if (!fp) {
    fp = crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('peak-collab-fingerprint', fp);
  }
  return fp;
}
