// =====================================================================
// THE WAYWARD COMPANY — SHARED SPELL WORDING (Update 67)
// ---------------------------------------------------------------------
// When a player edits a catalog spell (✎ Edit on the sheet), the new
// wording is saved once at Firebase /spell-text/<key> and every sheet
// shows it. Custom spells a player creates are NOT shared — they live in
// that character's own sheet state.
//
// Shape at /spell-text/<key>:
//   { name, castingTime, range, components, duration, concentration,
//     ritual, school, description, atHigherLevels, updatedBy, updatedAt }
//
// Needs the Firebase rule:  "spell-text": { ".read": true, ".write": true }
// =====================================================================
(function() {
  'use strict';

  const PATH = 'spell-text';

  const SpellText = {
    _ref: null,
    _data: {},
    _subs: [],
    ready: false,

    // Firebase-safe key from a spell name: "Enlarge/Reduce" → "enlarge_reduce".
    key: function(name) {
      return String(name || '').toLowerCase().replace(/\s*\(.*\)\s*$/, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    },

    init: function() {
      if (this._ref) return;
      if (typeof firebase === 'undefined' || !firebase.database) return;
      if (window.CharacterSync && !CharacterSync.ready && typeof CharacterSync.init === 'function') CharacterSync.init();
      if (!firebase.apps || !firebase.apps.length) return;
      const self = this;
      try {
        this._ref = firebase.database().ref(PATH);
        this._ref.on('value', function(snap) {
          self._data = snap.val() || {};
          self.ready = true;
          self._subs.forEach(function(fn) { try { fn(); } catch (e) {} });
        }, function(err) {
          console.warn('[SpellText] Read failed — is the /spell-text rule published?', err && err.message);
        });
      } catch (e) { console.warn('[SpellText] init failed:', e); }
    },

    get: function(name) { return this._data[this.key(name)] || null; },

    save: function(name, fields, by) {
      if (!this._ref) return Promise.reject(new Error('Not connected to the database.'));
      const rec = Object.assign({}, fields, {
        name: name,
        updatedBy: by || 'Someone',
        updatedAt: firebase.database.ServerValue.TIMESTAMP
      });
      return this._ref.child(this.key(name)).set(JSON.parse(JSON.stringify(rec)));
    },

    reset: function(name) {
      if (!this._ref) return Promise.reject(new Error('Not connected to the database.'));
      return this._ref.child(this.key(name)).remove();
    },

    onChange: function(fn) { if (typeof fn === 'function') this._subs.push(fn); }
  };

  window.SpellText = SpellText;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { SpellText.init(); });
  } else {
    SpellText.init();
  }
})();
