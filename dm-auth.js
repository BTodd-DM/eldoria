// =====================================================================
// THE WAYWARD COMPANY — DM SIGN-IN (Update 65c)
// ---------------------------------------------------------------------
// The database's DM-only sections (DM notes, draft handouts, XP ledger,
// lich / faction / downtime trackers, encounter presets, homebrew monsters)
// can only be read or written by the DM's Google account — the rule is in
// firebase-rules.json. This file adds a small "Sign in as DM" chip to DM
// pages and tells other scripts when the DM is signed in.
//
// Load AFTER the Firebase app + auth + database SDKs and firebase-sync.js,
// BEFORE scripts that read DM-only sections. Players' pages don't load it.
//
//   DMAuth.ready     → Promise<boolean> (resolves once the saved sign-in,
//                      if any, has been restored)
//   DMAuth.isSignedIn()
//   DMAuth.signIn() / DMAuth.signOut()
// =====================================================================
(function() {
  'use strict';
  if (window.DMAuth) return;

  let auth = null;
  let user = null;
  let resolveReady;
  const ready = new Promise(function(res) { resolveReady = res; });

  function start() {
    if (typeof firebase === 'undefined' || !firebase.auth) { resolveReady(false); return; }
    if (window.CharacterSync && !CharacterSync.ready && typeof CharacterSync.init === 'function') CharacterSync.init();
    if (!firebase.apps || !firebase.apps.length) { resolveReady(false); return; }
    auth = firebase.auth();
    let first = true;
    auth.onAuthStateChanged(function(u) {
      user = u || null;
      if (first) { first = false; resolveReady(!!user); }
      renderChip();
      if (user) checkIsDM();
    });
  }

  // If the signed-in account isn't the DM's, the rules refuse DM sections.
  let wrongAccount = false;
  function checkIsDM() {
    firebase.database().ref('notes-dm').limitToFirst(1).once('value')
      .then(function() { wrongAccount = false; renderChip(); })
      .catch(function() { wrongAccount = true; renderChip(); });
  }

  function renderChip() {
    if (!document.body) { document.addEventListener('DOMContentLoaded', renderChip); return; }
    let chip = document.getElementById('dm-auth-chip');
    if (!chip) {
      chip = document.createElement('div');
      chip.id = 'dm-auth-chip';
      chip.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:9999;font:12px Georgia,serif;background:rgba(20,15,8,0.92);' +
        'border:1px solid #a08040;border-radius:16px;padding:.35rem .75rem;color:#f2e8d0;box-shadow:0 2px 8px rgba(0,0,0,.5)';
      document.body.appendChild(chip);
    }
    const linkStyle = 'color:#e8c96a;cursor:pointer;text-decoration:underline;margin-left:.4rem';
    if (!user) {
      chip.innerHTML = '🔑 DM data is locked — <span style="' + linkStyle + '" onclick="DMAuth.signIn()">Sign in as DM</span>';
    } else if (wrongAccount) {
      chip.innerHTML = '⚠ ' + esc(user.email || 'This account') + ' isn\'t the DM account <span style="' + linkStyle + '" onclick="DMAuth.signOut()">Sign out</span>';
    } else {
      chip.innerHTML = '✓ DM signed in <span style="' + linkStyle + ';opacity:.8" onclick="DMAuth.signOut()">sign out</span>';
    }
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  const DMAuth = {
    ready: ready,
    isSignedIn: function() { return !!user && !wrongAccount; },
    uid: function() { return user ? user.uid : null; },
    signIn: function() {
      if (!auth) { alert('Sign-in is not available on this page.'); return; }
      auth.signInWithPopup(new firebase.auth.GoogleAuthProvider())
        .then(function() { location.reload(); })   // re-open DM sections with the new sign-in
        .catch(function(e) { if (e && e.code !== 'auth/popup-closed-by-user') alert('Sign-in failed: ' + (e.message || e)); });
    },
    signOut: function() {
      if (!auth) return;
      auth.signOut().then(function() { location.reload(); });
    }
  };
  window.DMAuth = DMAuth;
  start();
})();
