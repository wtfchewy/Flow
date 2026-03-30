/** Random identity generator - adjective + animal combos with persistent colors */

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

const PERSIST_KEY = 'peak-collab-identity-persist'; // localStorage — name + color
const SESSION_KEY = 'peak-collab-identity';          // sessionStorage — full identity with sessionId

/** Get or create a session identity. Name and color persist across sessions. */
export function getIdentity(): Identity {
  // Check session cache first
  const sessionStored = sessionStorage.getItem(SESSION_KEY);
  if (sessionStored) {
    try {
      return JSON.parse(sessionStored);
    } catch { /* regenerate */ }
  }

  // Load persisted name/color from localStorage
  let name: string | undefined;
  let color: string | undefined;
  try {
    const persisted = localStorage.getItem(PERSIST_KEY);
    if (persisted) {
      const parsed = JSON.parse(persisted);
      name = parsed.name;
      color = parsed.color;
    }
  } catch { /* use random */ }

  const identity: Identity = {
    name: name || `${randomFrom(ADJECTIVES)} ${randomFrom(ANIMALS)}`,
    color: color || randomFrom(COLORS),
    sessionId: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
  };

  // Persist to both stores
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(identity));
  localStorage.setItem(PERSIST_KEY, JSON.stringify({ name: identity.name, color: identity.color }));
  return identity;
}

/** Update display name */
export function setIdentityName(name: string): Identity {
  const identity = getIdentity();
  identity.name = name.trim().slice(0, 30) || identity.name;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(identity));
  localStorage.setItem(PERSIST_KEY, JSON.stringify({ name: identity.name, color: identity.color }));
  return identity;
}

/** Update cursor color */
export function setIdentityColor(color: string): Identity {
  const identity = getIdentity();
  identity.color = color;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(identity));
  localStorage.setItem(PERSIST_KEY, JSON.stringify({ name: identity.name, color: identity.color }));
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
