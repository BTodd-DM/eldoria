// =====================================================================
// THE WAYWARD COMPANY — FIREBASE CHARACTER-STATE SYNC
// ---------------------------------------------------------------------
// Live-sync character sheet state (HP, spell slots, resources, conditions,
// exhaustion, notes) via Firebase Realtime Database.
//
// Falls back silently to localStorage if Firebase isn't loaded or the DB
// is unreachable — the sheet still works, it just doesn't sync between
// devices.
//
// Depends on:
//   - firebase-app-compat.js  (Firebase JS SDK, compat layer)
//   - firebase-database-compat.js
// Loaded from CDN in sheet.html and index.html BEFORE this file.
//
// Hooks into sheet-engine.js:
//   - saveSheetState() pushes to Firebase after localStorage write
//   - renderSheet() subscribes on first render per character
//   - Remote updates overwrite localStorage + trigger refreshSheet
//
// Data shape at /characters/<charId>:
//   { hp: {...}, slots: {...}, resources: {...}, conditions: {...},
//     exhaustion: n, inspiration: bool, notes: "...",
//     _updatedAt: <server timestamp> }
//
// Security model:
//   Realtime Database rules (published separately in Firebase console)
//   allow open read/write on /characters/*. This is a "friends won't
//   grief" trust model — the database URL is not published, and only
//   your group has it. Not cryptographically secure. Do not store real
//   secrets in this database.
// =====================================================================

(function() {
  'use strict';

  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyArXWCwH5_H8jl14FC1zAq6E3F1L7bUcuE",
    authDomain: "wayward-company.firebaseapp.com",
    databaseURL: "https://wayward-company-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "wayward-company",
    storageBucket: "wayward-company.firebasestorage.app",
    messagingSenderId: "533275024888",
    appId: "1:533275024888:web:602951c3bcbcf52edc4a0d",
    measurementId: "G-5WS38Z9BCF"
  };

  const CHARACTER_PATH_PREFIX = 'characters/';
  const HISTORY_PATH_PREFIX = 'character-history/';
  const HISTORY_KEEP = 20;          // most recent snapshots per character

  const CharacterSync = {
    ready: false,
    _db: null,
    _subscribed: {},                // { charId: refHandle }
    _lastPushed: {},                // { charId: JSON string } — dedupe echoes
    _lastKnown: {},                 // { charId: state object } — most recent Firebase state, used for history snapshots

    init: function() {
      if (typeof firebase === 'undefined' || !firebase.initializeApp) {
        console.warn('[CharacterSync] Firebase SDK not loaded — sync disabled, localStorage only.');
        return false;
      }
      try {
        if (!firebase.apps || !firebase.apps.length) {
          firebase.initializeApp(FIREBASE_CONFIG);
        }
        this._db = firebase.database();
        this.ready = true;
        console.log('[CharacterSync] Connected to Firebase RTDB.');
        return true;
      } catch (e) {
        console.warn('[CharacterSync] Failed to initialise Firebase:', e);
        this.ready = false;
        return false;
      }
    },

    // Fire-and-forget push. Called after every local edit.
    push: function(charId, state) {
      if (!this.ready || !charId || !state) return;
      // Dedupe: if we just pushed identical state, skip.
      try {
        const serialised = JSON.stringify(state);
        if (this._lastPushed[charId] === serialised) return;

        // === History snapshot: preserve the CURRENT known state before overwriting.
        // Skipped silently on the very first push for a char (nothing yet to preserve).
        try { this._snapshotBeforeWrite(charId); } catch (e) { console.warn('[CharacterSync] History snapshot failed:', e); }

        this._lastPushed[charId] = serialised;
        const payload = Object.assign({}, state, {
          _updatedAt: firebase.database.ServerValue.TIMESTAMP
        });
        this._db.ref(CHARACTER_PATH_PREFIX + charId).set(payload).catch(function(e) {
          console.warn('[CharacterSync] Push rejected for', charId, e && e.message);
        });
      } catch (e) {
        console.warn('[CharacterSync] Push threw for', charId, e);
      }
    },

    // Write current cached state to /character-history/<charId>/<timestamp>
    // Then prune to keep only the most recent HISTORY_KEEP entries.
    _snapshotBeforeWrite: function(charId) {
      const prev = this._lastKnown[charId];
      if (!prev) return;                                    // first-ever push, nothing to snapshot
      const now = Date.now();
      const historyRef = this._db.ref(HISTORY_PATH_PREFIX + charId);
      const self = this;
      historyRef.child(String(now)).set({
        state: prev,
        savedAt: now
      }).then(function() {
        // Prune: keep newest HISTORY_KEEP entries
        historyRef.once('value').then(function(snap) {
          const raw = snap.val() || {};
          const keys = Object.keys(raw).sort(function(a, b) { return Number(b) - Number(a); });
          const toDelete = keys.slice(HISTORY_KEEP);
          toDelete.forEach(function(k) {
            historyRef.child(k).remove().catch(function() {});
          });
        }).catch(function() {});
      }).catch(function(e) {
        console.warn('[CharacterSync] History write failed:', e && e.message);
      });
    },

    // Load all history entries for a character. Returns Promise resolving to
    //   [{ ts: number, savedAt: number, state: {...} }, ...] sorted newest-first.
    listHistory: function(charId) {
      if (!this.ready || !charId) return Promise.resolve([]);
      return this._db.ref(HISTORY_PATH_PREFIX + charId).once('value').then(function(snap) {
        const raw = snap.val() || {};
        const entries = Object.keys(raw).map(function(k) {
          return { ts: Number(k), savedAt: raw[k].savedAt || Number(k), state: raw[k].state || {} };
        });
        entries.sort(function(a, b) { return b.ts - a.ts; });
        return entries;
      });
    },

    // Restore a character to a historical snapshot. Fires normal push flow,
    // which will itself snapshot the current (pre-restore) state first —
    // meaning the "undo the undo" is preserved automatically.
    restoreFromHistory: function(charId, ts) {
      if (!this.ready || !charId || !ts) return Promise.reject(new Error('Missing charId/ts'));
      const self = this;
      return this._db.ref(HISTORY_PATH_PREFIX + charId + '/' + ts).once('value').then(function(snap) {
        const entry = snap.val();
        if (!entry || !entry.state) throw new Error('History entry not found');
        // Also write into localStorage so refreshSheet has correct data if it reads local first.
        try {
          if (typeof window.loadSheetState === 'function' && typeof window.saveSheetState === 'function') {
            // saveSheetState will localStorage-write AND call this.push, which will snapshot then write.
            window.saveSheetState(charId, entry.state);
          } else {
            // Fallback: push directly.
            self.push(charId, entry.state);
          }
        } catch (e) {
          self.push(charId, entry.state);
        }
        return entry;
      });
    },

    // Subscribe once per character. Callback fires on every remote change.
    // If Firebase has no state yet, seeds it from local (bootstrap).
    subscribe: function(charId, callback) {
      if (!this.ready || !charId) return;
      if (this._subscribed[charId]) return;

      const self = this;
      const ref = this._db.ref(CHARACTER_PATH_PREFIX + charId);
      let firstCall = true;

      const handler = function(snap) {
        const remote = snap.val();
        if (remote) {
          // Strip metadata before returning state
          const state = Object.assign({}, remote);
          delete state._updatedAt;
          // Cache the most recent known state so the next push() can snapshot it into history.
          self._lastKnown[charId] = state;
          // Dedupe our own echo (state we just pushed)
          const serialised = JSON.stringify(state);
          if (self._lastPushed[charId] === serialised) {
            firstCall = false;
            return;
          }
          try { callback(state); } catch (e) {
            console.warn('[CharacterSync] Subscribe callback threw for', charId, e);
          }
        } else if (firstCall) {
          // Firebase empty for this character. Seed with local if we have it.
          if (typeof window.loadSheetState === 'function') {
            const local = window.loadSheetState(charId);
            if (local) {
              console.log('[CharacterSync] Seeding Firebase from local for', charId);
              self.push(charId, local);
            }
          }
        }
        firstCall = false;
      };

      try {
        ref.on('value', handler);
        this._subscribed[charId] = { ref: ref, handler: handler };
      } catch (e) {
        console.warn('[CharacterSync] Subscribe failed for', charId, e);
      }
    },

    unsubscribe: function(charId) {
      const sub = this._subscribed[charId];
      if (!sub) return;
      try { sub.ref.off('value', sub.handler); } catch (e) {}
      delete this._subscribed[charId];
    }
  };

  window.CharacterSync = CharacterSync;

  // Auto-init as soon as the SDK is available.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { CharacterSync.init(); });
  } else {
    CharacterSync.init();
  }
})();
