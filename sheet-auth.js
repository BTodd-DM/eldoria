// =====================================================================
// ELDORIA 2.0 — CHARACTER SHEET AUTH (peek-blocker)
// ---------------------------------------------------------------------
// Per-character password gate for sheet.html. SHA-256 hash comparison.
// Passwords are case-sensitive and trimmed of leading/trailing spaces.
// This is a SOCIAL peek-blocker, not a vault: anyone who reads the
// site source can see character data directly in sheet-data.js. It
// stops the players from casually opening each other's sheet via URL.
//
// To add / change a password:
//   1. Compute SHA-256 hash of the new plaintext password
//      (e.g. echo -n 'MyPassword' | shasum -a 256)
//   2. Replace the hex string below.
//   3. Bump SHEET_AUTH_KEY_PREFIX (add a suffix like '-v2') if you want
//      to force everyone to re-enter the new password immediately;
//      otherwise 30-day localStorage sessions carry over as long as the
//      OLD password was previously entered.
//
// Characters NOT listed in SHEET_PASSWORDS render without a prompt
// (used for DM-only IDs like vaeloran / kaelith that are only reached
// through the password-gated DM dashboard anyway).
// =====================================================================

const SHEET_PASSWORDS = {
  torren: '5679daa7c55dde153a0e3f2e5d7c5318f149fa10716a7d874fa97e46639426a3', // Dagger
  sylas:  'b8cf9eccda31d3c1dc28292f078e68ac09e8fcc5457c89b586128ba03678ab79', // Siphon
  orin:   '68c01a8e40fe9ec7d8949bdc80513d65a50428ce6d23536588f86376ad78ef15'  // Luminos
};

// v2 — bumped from 'eldoria-sheet-auth-' when Sylas's password changed
// (Syphon → Siphon). Old localStorage sessions become invalid, forcing
// re-entry with the new password.
const SHEET_AUTH_KEY_PREFIX = 'eldoria-sheet-auth-v2-';
const SHEET_AUTH_DAYS = 30;

async function sheetAuthSha256Hex(str) {
  const buf = new TextEncoder().encode(str);
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

function sheetIsGated(id) {
  return Object.prototype.hasOwnProperty.call(SHEET_PASSWORDS, id);
}

function sheetIsUnlocked(id) {
  try {
    const stored = localStorage.getItem(SHEET_AUTH_KEY_PREFIX + id);
    return !!(stored && Date.now() < parseInt(stored, 10));
  } catch (e) { return false; }
}

async function sheetCheckPassword(id, pw) {
  const expected = SHEET_PASSWORDS[id];
  if (!expected) return false;
  const hash = await sheetAuthSha256Hex(pw.trim());
  return hash === expected;
}

function sheetMarkUnlocked(id) {
  try {
    const expiry = Date.now() + SHEET_AUTH_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(SHEET_AUTH_KEY_PREFIX + id, String(expiry));
  } catch (e) { /* localStorage unavailable */ }
}

function sheetLock(id) {
  try { localStorage.removeItem(SHEET_AUTH_KEY_PREFIX + id); } catch (e) {}
}
