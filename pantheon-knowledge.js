// =====================================================================
// THE WAYWARD COMPANY — PANTHEON KNOWLEDGE TRACKER
// ---------------------------------------------------------------------
// Firebase-synced per-god knowledge level. DM controls what the party
// currently knows; player site renders accordingly.
//
// Levels:
//   0 — Unknown        (hidden entirely on player site)
//   1 — Name only      (name card, no other info)
//   2 — Basic          (name + alignment/domain hint)
//   3 — Full           (name + alignment + full description)
//
// Firebase path /pantheon-knowledge:
//   { <godId>: <level 0-3> }
// =====================================================================
(function() {
  'use strict';

  const PATH = 'pantheon-knowledge';
  const LEVEL_LABELS = { 0: 'Unknown', 1: 'Name only', 2: 'Basic', 3: 'Full' };
  const LEVEL_COLORS = { 0: '#606060', 1: '#a08050', 2: '#c9a84c', 3: '#7fdb7f' };

  const PK = {
    _ref: null,
    _state: {},
    _subs: [],

    init: function() {
      const self = this;
      if (typeof firebase === 'undefined' || !firebase.database) {
        this._state = this._defaults();
        this._fire();
        return;
      }
      try {
        this._ref = firebase.database().ref(PATH);
        this._ref.on('value', function(snap) {
          const v = snap.val();
          if (v && typeof v === 'object') {
            self._state = v;
          } else {
            self._state = self._defaults();
          }
          self._fire();
        });
      } catch (e) { console.warn('[PantheonKnowledge] Sync failed:', e); }
    },

    _defaults: function() {
      // Sensible starting knowledge for Session 5-6: Creators known in full
      // (temple-taught), Children known by name only. Betrayers unknown.
      const d = {};
      (window.PANTHEON_GODS || []).forEach(function(g) {
        if (g.category === 'creator') d[g.id] = 3;
        else if (g.category === 'child') d[g.id] = 1;
        else d[g.id] = 0; // betrayer hidden
      });
      return d;
    },

    subscribe: function(cb) {
      if (typeof cb !== 'function') return;
      this._subs.push(cb);
      try { cb(this._state); } catch (e) {}
    },

    _fire: function() {
      const self = this;
      this._subs.forEach(function(cb) { try { cb(self._state); } catch (e) {} });
    },

    getLevel: function(godId) {
      return (this._state && typeof this._state[godId] === 'number') ? this._state[godId] : 0;
    },

    setLevel: function(godId, level) {
      const n = Math.max(0, Math.min(3, parseInt(level, 10) || 0));
      if (!this._ref) { this._state[godId] = n; this._fire(); return; }
      this._ref.child(godId).set(n).catch(function(e) { console.warn('[PantheonKnowledge] Write failed:', e); });
    },

    cycleLevel: function(godId) {
      const cur = this.getLevel(godId);
      const next = (cur + 1) % 4;
      this.setLevel(godId, next);
    },

    // -------- DM view: renders the knowledge tracker into a container --------
    renderDM: function(containerId) {
      const container = document.getElementById(containerId);
      if (!container) return;
      const gods = window.PANTHEON_GODS || [];
      const self = this;

      function paint(state) {
        let html = '<div class="alert alert-info" style="margin-bottom:.5rem">Click any god to cycle knowledge: <strong>Unknown → Name only → Basic → Full → Unknown</strong>. Player site updates live.</div>';
        ['creator', 'child', 'betrayer'].forEach(function(cat) {
          const bucket = gods.filter(function(g) { return g.category === cat; });
          if (!bucket.length) return;
          const heading = cat === 'creator' ? 'Creator Gods' : cat === 'child' ? 'The Children' : 'The Betrayers';
          html += '<div class="sec-title" style="margin-top:.75rem">' + heading + '</div>';
          html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:.4rem;margin-bottom:.5rem">';
          bucket.forEach(function(g) {
            const lvl = state[g.id] || 0;
            const col = LEVEL_COLORS[lvl];
            html += '<div onclick="if(window.PantheonKnowledge) PantheonKnowledge.cycleLevel(\'' + g.id + '\')" style="cursor:pointer;border:1px solid ' + col + ';border-left:4px solid ' + g.color + ';border-radius:3px;padding:.4rem .6rem;background:rgba(20,14,6,0.3);transition:all .12s" onmouseover="this.style.background=\'rgba(40,28,12,0.5)\'" onmouseout="this.style.background=\'rgba(20,14,6,0.3)\'">' +
              '<div style="font-family:\'Cinzel\',serif;color:' + g.color + ';font-size:12px">' + g.name + '</div>' +
              '<div style="font-size:10px;color:' + col + ';font-family:\'Cinzel\',serif;letter-spacing:1px;margin-top:2px">● ' + LEVEL_LABELS[lvl] + '</div>' +
            '</div>';
          });
          html += '</div>';
        });
        // Bulk actions
        html += '<div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.75rem">' +
          '<button class="action-btn" onclick="if(window.PantheonKnowledge) PantheonKnowledge.setAll(0)">Reset all → Unknown</button>' +
          '<button class="action-btn" onclick="if(window.PantheonKnowledge) PantheonKnowledge.setAll(1)">All → Name only</button>' +
          '<button class="action-btn" onclick="if(window.PantheonKnowledge) PantheonKnowledge.setAll(3)">All → Full</button>' +
          '<button class="action-btn" onclick="if(window.PantheonKnowledge) PantheonKnowledge.applyDefaults()">Reset to campaign defaults</button>' +
        '</div>';
        container.innerHTML = html;
      }
      this.subscribe(paint);
      // Fire immediately in case sub hadn't populated state yet.
      paint(this._state || {});
    },

    setAll: function(level) {
      const self = this;
      (window.PANTHEON_GODS || []).forEach(function(g) { self.setLevel(g.id, level); });
    },

    applyDefaults: function() {
      const d = this._defaults();
      const self = this;
      Object.keys(d).forEach(function(id) { self.setLevel(id, d[id]); });
    },

    // -------- Player view: renders the pantheon into a container --------
    renderPlayer: function(containerId) {
      const container = document.getElementById(containerId);
      if (!container) return;
      const gods = window.PANTHEON_GODS || [];
      function paint(state) {
        const visible = gods.filter(function(g) { return (state[g.id] || 0) >= 1; });
        if (!visible.length) {
          container.innerHTML = '<div class="card-body" style="color:var(--ink3);font-style:italic">Your knowledge of the gods is limited to a few whispered names in old prayers. Nothing more.</div>';
          return;
        }
        function cardFor(g, lvl) {
          const parts = ['<div class="card" style="border-left:3px solid ' + g.color + '">',
            '<div class="card-title" style="color:' + g.color + '">' + g.name + '</div>'];
          if (lvl >= 2) parts.push('<div class="card-sub">' + g.align + '</div>');
          if (lvl >= 3) parts.push('<div class="card-body">' + g.body + '</div>');
          parts.push('</div>');
          return parts.join('');
        }
        function renderBucket(cat, heading, note) {
          const bucket = gods.filter(function(g) { return g.category === cat && (state[g.id] || 0) >= 1; });
          if (!bucket.length) return '';
          let block = '<div class="sec-title" style="margin-top:1rem">' + heading + '</div>';
          if (note) block += '<div class="card-body" style="margin-bottom:.5rem;font-size:13px">' + note + '</div>';
          const minWidth = cat === 'creator' ? 260 : 200;
          block += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(' + minWidth + 'px,1fr));gap:.5rem">';
          bucket.forEach(function(g) { block += cardFor(g, state[g.id] || 0); });
          block += '</div>';
          return block;
        }
        let html = '';
        html += renderBucket('creator', 'The Creator Gods', 'Two gods shaped the world together at the beginning of time.');
        html += renderBucket('child', 'The Children', 'Gods born of the Creators, each holding a domain of the world.');
        html += renderBucket('betrayer', 'The Betrayer Gods', 'Names spoken quietly, with a warding gesture. Their worship is forbidden throughout the civilised lands.');
        container.innerHTML = html;
      }
      this.subscribe(paint);
      paint(this._state || {});
    }
  };

  window.PantheonKnowledge = PK;

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(function() { PK.init(); }, 200); });
  } else {
    setTimeout(function() { PK.init(); }, 200);
  }
})();
