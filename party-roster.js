// =====================================================================
// THE WAYWARD COMPANY — PARTY ROSTER (Update 61a)
// ---------------------------------------------------------------------
// Single list of player characters. Every script that needs "all the
// PCs" (combat tracker, handouts, notes, knowledge buckets, sheet
// history, downtime, faction reactions, long rest) reads it from here,
// so a new player is a one-line addition.
//
// `built: true` means the character comes from the player-site
// character builder rather than sheet-data.js. Its definition lives in
// Firebase at /characters/<id>-definition (a sibling of the live sheet
// state at /characters/<id>, which the sheet overwrites on every save).
// loadBuiltCharacters() fetches those definitions into CHARACTERS so
// the sheet engine and combat tracker treat them like any other PC.
//
// Load AFTER the Firebase SDK and sheet-data.js (if the page has it),
// BEFORE any script that reads the roster.
// =====================================================================

const PARTY_ROSTER = [
  { id: 'torren',  label: 'Torren' },
  { id: 'sylas',   label: 'Sylas' },
  { id: 'orin',    label: 'Orin' },
  { id: 'tristan', label: 'Tristan', built: true }
];

const PartyRoster = {
  list: function() { return PARTY_ROSTER.slice(); },
  ids: function() { return PARTY_ROSTER.map(function(p) { return p.id; }); },

  // Display name: the character's name once one exists, else the roster label.
  label: function(id) {
    if (typeof CHARACTERS !== 'undefined' && CHARACTERS[id] && CHARACTERS[id].name) return CHARACTERS[id].name;
    const p = PARTY_ROSTER.find(function(x) { return x.id === id; });
    return p ? p.label : id;
  },

  labels: function() {
    const out = {};
    PARTY_ROSTER.forEach(function(p) { out[p.id] = PartyRoster.label(p.id); });
    return out;
  },

  isBuilt: function(id) {
    const p = PARTY_ROSTER.find(function(x) { return x.id === id; });
    return !!(p && p.built);
  },

  definitionPath: function(id) { return 'characters/' + id + '-definition'; },
  buildPath: function(id) { return 'characters/' + id + '-build'; },

  _db: function() {
    if (typeof firebase === 'undefined' || !firebase.database) return null;
    if (window.CharacterSync && !CharacterSync.ready && typeof CharacterSync.init === 'function') CharacterSync.init();
    if (!firebase.apps || !firebase.apps.length) return null;
    try { return firebase.database(); } catch (e) { return null; }
  },

  // Fetch builder-made characters into CHARACTERS. Resolves with the ids
  // loaded. Never rejects — a missing definition just means "not built yet".
  _loading: null,
  loadBuiltCharacters: function() {
    if (this._loading) return this._loading;
    const self = this;
    const db = this._db();
    if (!db || typeof CHARACTERS === 'undefined') { this._loading = Promise.resolve([]); return this._loading; }
    const wanted = PARTY_ROSTER.filter(function(p) { return p.built && !CHARACTERS[p.id]; });
    this._loading = Promise.all(wanted.map(function(p) {
      return db.ref(self.definitionPath(p.id)).once('value').then(function(snap) {
        const def = snap.val();
        if (def && def.id === p.id) { CHARACTERS[p.id] = def; return p.id; }
        return null;
      }).catch(function(e) {
        console.warn('[PartyRoster] Could not load definition for', p.id, e && e.message);
        return null;
      });
    })).then(function(ids) {
      const loaded = ids.filter(Boolean);
      if (loaded.length) document.dispatchEvent(new CustomEvent('party-roster-loaded', { detail: loaded }));
      return loaded;
    });
    return this._loading;
  }
};

window.PARTY_ROSTER = PARTY_ROSTER;
window.PartyRoster = PartyRoster;
