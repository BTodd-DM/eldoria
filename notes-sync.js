// =====================================================================
// THE WAYWARD COMPANY — NOTES SYNC (Phase 6)
// ---------------------------------------------------------------------
// Firebase Realtime Database notes with four visibility scopes:
//   private    — author only
//   dm-only    — author + DM
//   dm-party   — everyone (author + DM + all players)
//   party-only — everyone except DM
//
// Depends on:
//   firebase-app-compat.js  (already loaded by pages using this)
//   firebase-database-compat.js
//   firebase-sync.js        (initialises the Firebase app; NotesSync piggy-backs)
//
// Public API:
//   NotesSync.init()                       → boolean
//   NotesSync.ready                        → boolean
//   NotesSync.subscribe(callback)          → callback receives full notes array on every update
//   NotesSync.create(note)                 → Promise<noteId>
//   NotesSync.update(noteId, patch)        → Promise<void>
//   NotesSync.delete(noteId)               → Promise<void>
//   NotesSync.isVisible(note, identity)    → boolean (client-side visibility filter)
//   NotesSync.filterVisible(notes, id)     → filtered array (newest first)
//
// Security model: RTDB rules allow open read/write on /notes/*.
// Visibility is enforced CLIENT-SIDE only. Same trust model as characters.
// =====================================================================

(function() {
  'use strict';

  const NOTES_PATH = 'notes';
  const VALID_SCOPES = ['private', 'dm-only', 'dm-party', 'party-only', 'to-player'];

  const NotesSync = {
    ready: false,
    _db: null,
    _ref: null,
    _cache: {},          // { noteId: note }
    _subscribed: false,
    _callbacks: [],

    init: function() {
      if (typeof firebase === 'undefined' || !firebase.database) {
        console.warn('[NotesSync] Firebase SDK not loaded — notes disabled.');
        return false;
      }
      try {
        this._db = firebase.database();
        this._ref = this._db.ref(NOTES_PATH);
        this.ready = true;
        this._startSubscribe();
        console.log('[NotesSync] Connected to Firebase RTDB /notes.');
        return true;
      } catch (e) {
        console.warn('[NotesSync] Init failed:', e);
        return false;
      }
    },

    _startSubscribe: function() {
      if (this._subscribed) return;
      const self = this;
      this._ref.on('value', function(snap) {
        const raw = snap.val() || {};
        self._cache = raw;
        self._fireCallbacks();
      });
      this._subscribed = true;
    },

    _fireCallbacks: function() {
      const notes = this.getAllNotes();
      this._callbacks.forEach(function(cb) {
        try { cb(notes); } catch (e) { console.warn('[NotesSync] Subscriber threw:', e); }
      });
    },

    subscribe: function(callback) {
      if (typeof callback !== 'function') return;
      this._callbacks.push(callback);
      // Fire once immediately with current state
      if (this.ready) {
        try { callback(this.getAllNotes()); } catch (e) {}
      }
    },

    getAllNotes: function() {
      const raw = this._cache || {};
      const notes = Object.keys(raw).map(function(id) {
        const n = Object.assign({}, raw[id], { id: id });
        return n;
      });
      // Newest first (by updatedAt or createdAt)
      notes.sort(function(a, b) {
        const at = a.updatedAt || a.createdAt || 0;
        const bt = b.updatedAt || b.createdAt || 0;
        return bt - at;
      });
      return notes;
    },

    create: function(note) {
      if (!this.ready) return Promise.reject(new Error('NotesSync not ready'));
      if (!note || !note.author || VALID_SCOPES.indexOf(note.scope) === -1) {
        return Promise.reject(new Error('Note requires author + valid scope'));
      }
      if (note.scope === 'to-player' && !note.recipient) {
        return Promise.reject(new Error('to-player scope requires recipient'));
      }
      const newRef = this._ref.push();
      const payload = {
        author: note.author,
        scope: note.scope,
        recipient: note.recipient || null,
        title: String(note.title || '').slice(0, 200),
        body: String(note.body || ''),
        tags: Array.isArray(note.tags) ? note.tags.filter(Boolean).map(String).slice(0, 20) : [],
        readBy: {},   // { identityId: true }
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        updatedAt: firebase.database.ServerValue.TIMESTAMP
      };
      return newRef.set(payload).then(function() { return newRef.key; });
    },

    update: function(noteId, patch) {
      if (!this.ready) return Promise.reject(new Error('NotesSync not ready'));
      if (!noteId || !patch) return Promise.reject(new Error('noteId + patch required'));
      const cleanPatch = {};
      if (patch.title !== undefined) cleanPatch.title = String(patch.title).slice(0, 200);
      if (patch.body !== undefined) cleanPatch.body = String(patch.body);
      if (patch.scope !== undefined) {
        if (VALID_SCOPES.indexOf(patch.scope) === -1) return Promise.reject(new Error('invalid scope'));
        cleanPatch.scope = patch.scope;
      }
      if (patch.recipient !== undefined) cleanPatch.recipient = patch.recipient || null;
      if (patch.tags !== undefined) cleanPatch.tags = Array.isArray(patch.tags) ? patch.tags.filter(Boolean).map(String).slice(0, 20) : [];
      cleanPatch.updatedAt = firebase.database.ServerValue.TIMESTAMP;
      return this._ref.child(noteId).update(cleanPatch);
    },

    markRead: function(noteId, identityId, isRead) {
      if (!this.ready || !noteId || !identityId) return Promise.resolve();
      const val = isRead ? true : null;
      return this._ref.child(noteId).child('readBy').child(identityId).set(val);
    },

    getAllTags: function(identity) {
      const notes = identity ? this.filterVisible(this.getAllNotes(), identity) : this.getAllNotes();
      const set = {};
      notes.forEach(function(n) { (n.tags || []).forEach(function(t) { if (t) set[t] = (set[t] || 0) + 1; }); });
      return Object.keys(set).sort().map(function(t) { return { tag: t, count: set[t] }; });
    },

    hasTag: function(note, tag) {
      return !!(note && note.tags && note.tags.indexOf(tag) >= 0);
    },

    isReadBy: function(note, identityId) {
      return !!(note && note.readBy && note.readBy[identityId]);
    },

    delete: function(noteId) {
      if (!this.ready) return Promise.reject(new Error('NotesSync not ready'));
      if (!noteId) return Promise.reject(new Error('noteId required'));
      return this._ref.child(noteId).remove();
    },

    // Client-side visibility filter. Given an identity ({id, role}),
    // return whether the note should be visible to them.
    isVisible: function(note, identity) {
      if (!note || !identity) return false;
      const isAuthor = note.author === identity.id;
      const isDM = identity.role === 'dm';
      switch (note.scope) {
        case 'private':    return isAuthor;
        case 'dm-only':    return isAuthor || isDM;
        case 'dm-party':   return true;
        case 'party-only': return !isDM;
        case 'to-player':  return isAuthor || identity.id === note.recipient;
        default:           return false;
      }
    },

    filterVisible: function(notes, identity) {
      const self = this;
      return (notes || []).filter(function(n) { return self.isVisible(n, identity); });
    }
  };

  window.NotesSync = NotesSync;

  // Auto-init once Firebase is available. Firebase SDK loads before this
  // script so the app initialisation from firebase-sync.js should already
  // have run by now — but defer a beat to be safe.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { NotesSync.init(); });
  } else {
    setTimeout(function() { NotesSync.init(); }, 50);
  }
})();
