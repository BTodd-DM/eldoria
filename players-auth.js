// =====================================================================
// THE WAYWARD COMPANY — PLAYER SITE IDENTITY
// ---------------------------------------------------------------------
// Login gate on players.html. Four identities: torren, sylas, orin, dm.
// SHA-256 password comparison (same peek-blocker security model as the
// per-character sheet auth).
//
// Once logged in, identity persists in localStorage for 30 days. Other
// scripts can read window.WAYWARD_IDENTITY to adapt UI (which sheet to
// link to, which notes to show, whether to reveal DM-only content, etc.).
//
// Passwords (all case-sensitive, trimmed):
//   torren : Dagger
//   sylas  : Siphon
//   orin   : Luminos
//   dm     : eldoria2dm
//
// Adding / rotating: compute SHA-256 of the new plaintext, replace the
// hash below, and bump WAYWARD_IDENTITY_KEY_PREFIX to force re-login.
// =====================================================================

const WAYWARD_IDENTITIES = {
  torren: {
    id: 'torren',
    label: 'Torren',
    role: 'player',
    sheetId: 'torren',
    passwordHash: '5679daa7c55dde153a0e3f2e5d7c5318f149fa10716a7d874fa97e46639426a3' // Dagger
  },
  sylas: {
    id: 'sylas',
    label: 'Sylas',
    role: 'player',
    sheetId: 'sylas',
    passwordHash: 'b8cf9eccda31d3c1dc28292f078e68ac09e8fcc5457c89b586128ba03678ab79' // Siphon
  },
  orin: {
    id: 'orin',
    label: 'Orin',
    role: 'player',
    sheetId: 'orin',
    passwordHash: '68c01a8e40fe9ec7d8949bdc80513d65a50428ce6d23536588f86376ad78ef15' // Luminos
  },
  dm: {
    id: 'dm',
    label: 'DM',
    role: 'dm',
    sheetId: null, // DM has no assigned character sheet
    passwordHash: '308571afb1a04cd36fb292df93dc287eee97618a0bb573d5d5685be6d2c203ec' // eldoria2dm
  }
};

const WAYWARD_IDENTITY_KEY = 'wayward-player-identity-v1';
const WAYWARD_IDENTITY_DAYS = 30;

async function waywardSha256Hex(str) {
  const buf = new TextEncoder().encode(str);
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

// Public API — read the current identity if any, checking expiry.
function getCurrentIdentity() {
  try {
    const raw = localStorage.getItem(WAYWARD_IDENTITY_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw);
    if (!stored || !stored.id || !stored.expires) return null;
    if (Date.now() >= stored.expires) {
      localStorage.removeItem(WAYWARD_IDENTITY_KEY);
      return null;
    }
    const identity = WAYWARD_IDENTITIES[stored.id];
    return identity || null;
  } catch (e) { return null; }
}

async function checkPlayerPassword(id, password) {
  const identity = WAYWARD_IDENTITIES[id];
  if (!identity) return false;
  const hash = await waywardSha256Hex((password || '').trim());
  return hash === identity.passwordHash;
}

function setPlayerIdentity(id) {
  const identity = WAYWARD_IDENTITIES[id];
  if (!identity) return false;
  try {
    const expires = Date.now() + WAYWARD_IDENTITY_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(WAYWARD_IDENTITY_KEY, JSON.stringify({ id: identity.id, expires: expires }));
    window.WAYWARD_IDENTITY = identity;
    return true;
  } catch (e) { return false; }
}

function clearPlayerIdentity() {
  try { localStorage.removeItem(WAYWARD_IDENTITY_KEY); } catch (e) {}
  window.WAYWARD_IDENTITY = null;
}

function isDmIdentity() {
  const cur = getCurrentIdentity();
  return !!(cur && cur.role === 'dm');
}

// Populate global on load so downstream scripts can read it synchronously.
try { window.WAYWARD_IDENTITY = getCurrentIdentity(); } catch (e) { window.WAYWARD_IDENTITY = null; }
