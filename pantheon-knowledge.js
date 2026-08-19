// =====================================================================
// THE WAYWARD COMPANY — PANTHEON KNOWLEDGE TRACKER (per-character)
// ---------------------------------------------------------------------
// Firebase-synced per-god knowledge level, tracked per PC plus a shared
// "party" bucket for common-knowledge stuff.
//
// Levels:
//   0 — Unknown        (hidden entirely on player site)
//   1 — Name only      (name card, no other info)
//   2 — Basic          (name + alignment/domain hint)
//   3 — Full           (name + alignment + full description)
//
// Firebase path /pantheon-knowledge:
//   { <bucketId>: { <godId>: <level 0-3> } }
//   bucketId is 'party' or a pcId ('sylas', 'torren', 'orin').
//
// Player display resolves to max(partyLevel, pcSpecificLevel).
//
// Migration: if the sync ever sees the old flat shape
//   { godId: level, ... } (numeric leaves), it is migrated into party.
// =====================================================================
(function() {
  'use strict';

  const PATH = 'pantheon-knowledge';
  const LEVEL_LABELS = { 0: 'Unknown', 1: 'Name only', 2: 'Basic', 3: 'Full' };
  const LEVEL_COLORS = { 0: '#606060', 1: '#a08050', 2: '#c9a84c', 3: '#7fdb7f' };
  const BUCKETS = ['party', 'sylas', 'torren', 'orin'];
  const BUCKET_LABELS = { party: 'Party (shared)', sylas: 'Sylas', torren: 'Torren', orin: 'Orin' };

  const PK = {
    _ref: null,
    _state: {},         // { bucketId: { godId: level } }
    _dmBucket: 'party', // currently-edited bucket on DM side
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
          self._state = self._normalise(v);
          self._fire();
        });
      } catch (e) { console.warn('[PantheonKnowledge] Sync failed:', e); }
    },

    _normalise: function(raw) {
      if (!raw || typeof raw !== 'object') return this._defaults();
      // Detect old flat shape (values are numbers keyed by godId).
      const keys = Object.keys(raw);
      const looksFlat = keys.length > 0 && keys.every(function(k) {
        return typeof raw[k] === 'number';
      });
      if (looksFlat) {
        const migrated = this._defaults();
        migrated.party = Object.assign({}, raw);
        // Auto-persist migration on next tick if we have a live ref.
        const self = this;
        if (this._ref) setTimeout(function() { self._ref.set(migrated); }, 200);
        return migrated;
      }
      // Ensure all buckets exist.
      const out = this._defaults();
      BUCKETS.forEach(function(b) {
        if (raw[b] && typeof raw[b] === 'object') {
          Object.keys(raw[b]).forEach(function(g) {
            const lvl = parseInt(raw[b][g], 10);
            if (!isNaN(lvl)) out[b][g] = Math.max(0, Math.min(3, lvl));
          });
        }
      });
      return out;
    },

    _defaults: function() {
      // Party bucket: Creators Full, Children Name-only, Betrayers Unknown.
      // Per-PC buckets: empty (they inherit from party unless bumped).
      const party = {};
      (window.PANTHEON_GODS || []).forEach(function(g) {
        if (g.category === 'creator') party[g.id] = 3;
        else if (g.category === 'child') party[g.id] = 1;
        else party[g.id] = 0;
      });
      return { party: party, sylas: {}, torren: {}, orin: {} };
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

    // Raw per-bucket level (not resolved).
    getBucketLevel: function(bucketId, godId) {
      const b = this._state[bucketId];
      return (b && typeof b[godId] === 'number') ? b[godId] : 0;
    },

    // Effective level for a PC = max(party, PC-specific).
    getEffectiveLevel: function(pcId, godId) {
      const p = this.getBucketLevel('party', godId);
      const s = pcId ? this.getBucketLevel(pcId, godId) : 0;
      return Math.max(p, s);
    },

    setBucketLevel: function(bucketId, godId, level) {
      const n = Math.max(0, Math.min(3, parseInt(level, 10) || 0));
      if (!this._ref) {
        if (!this._state[bucketId]) this._state[bucketId] = {};
        this._state[bucketId][godId] = n;
        this._fire();
        return;
      }
      this._ref.child(bucketId).child(godId).set(n).catch(function(e) { console.warn('[PantheonKnowledge] Write failed:', e); });
    },

    cycleBucketLevel: function(bucketId, godId) {
      const cur = this.getBucketLevel(bucketId, godId);
      this.setBucketLevel(bucketId, godId, (cur + 1) % 4);
    },

    setAllInBucket: function(bucketId, level) {
      const self = this;
      (window.PANTHEON_GODS || []).forEach(function(g) { self.setBucketLevel(bucketId, g.id, level); });
    },

    applyDefaults: function() {
      const d = this._defaults();
      const self = this;
      Object.keys(d).forEach(function(bucket) {
        Object.keys(d[bucket]).forEach(function(id) {
          self.setBucketLevel(bucket, id, d[bucket][id]);
        });
      });
    },

    // -------- DM view --------
    renderDM: function(containerId) {
      const container = document.getElementById(containerId);
      if (!container) return;
      const self = this;

      function paint(state) {
        const bucket = self._dmBucket;
        const gods = window.PANTHEON_GODS || [];
        let html = '';
        // Bucket picker
        html += '<div style="display:flex;gap:.35rem;flex-wrap:wrap;margin-bottom:.5rem;align-items:center">' +
          '<span style="font-family:\'Cinzel\',serif;font-size:10px;color:var(--parch3);letter-spacing:1.5px;margin-right:.3rem">EDITING:</span>';
        BUCKETS.forEach(function(b) {
          const active = (b === bucket);
          html += '<button class="action-btn' + (active ? ' active' : '') + '" onclick="if(window.PantheonKnowledge){PantheonKnowledge._dmBucket=\'' + b + '\';PantheonKnowledge.renderDM(\'' + containerId + '\');}" style="' +
            (active ? 'background:var(--gold);color:#0d0a06;border-color:var(--gold)' : '') + '">' + BUCKET_LABELS[b] + '</button>';
        });
        html += '</div>';

        html += '<div class="alert alert-info" style="margin-bottom:.5rem">' +
          (bucket === 'party'
            ? 'Party knowledge — everyone knows this. Click a god to cycle: <strong>Unknown → Name only → Basic → Full → Unknown</strong>.'
            : '<strong>' + BUCKET_LABELS[bucket] + '</strong> knows this <em>in addition to</em> what the whole party knows. Each PC sees the higher of their own level or the party level. Lich Initiate Sylas may know more about the Betrayers than the party does; Cleric Orin may know more about Luminos and the Children.') +
          '</div>';

        ['creator', 'child', 'betrayer'].forEach(function(cat) {
          const gs = gods.filter(function(g) { return g.category === cat; });
          if (!gs.length) return;
          const heading = cat === 'creator' ? 'Creator Gods' : cat === 'child' ? 'The Children' : 'The Betrayers';
          html += '<div class="sec-title" style="margin-top:.6rem">' + heading + '</div>';
          html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:.4rem;margin-bottom:.4rem">';
          gs.forEach(function(g) {
            const own = self.getBucketLevel(bucket, g.id);
            const partyLvl = self.getBucketLevel('party', g.id);
            const effective = Math.max(partyLvl, own);
            const col = LEVEL_COLORS[own];
            const overrideNote = (bucket !== 'party' && own > partyLvl)
              ? '<div style="font-size:9px;color:var(--parch4);margin-top:1px">party ' + LEVEL_LABELS[partyLvl] + ' → this PC ' + LEVEL_LABELS[own] + '</div>'
              : (bucket !== 'party' && partyLvl > 0)
                ? '<div style="font-size:9px;color:var(--parch4);margin-top:1px">inherits ' + LEVEL_LABELS[effective] + ' from party</div>'
                : '';
            html += '<div onclick="if(window.PantheonKnowledge) PantheonKnowledge.cycleBucketLevel(\'' + bucket + '\',\'' + g.id + '\')" style="cursor:pointer;border:1px solid ' + col + ';border-left:4px solid ' + g.color + ';border-radius:3px;padding:.4rem .6rem;background:rgba(20,14,6,0.3);transition:all .12s" onmouseover="this.style.background=\'rgba(40,28,12,0.5)\'" onmouseout="this.style.background=\'rgba(20,14,6,0.3)\'">' +
              '<div style="font-family:\'Cinzel\',serif;color:' + g.color + ';font-size:12px">' + g.name + '</div>' +
              '<div style="font-size:10px;color:' + col + ';font-family:\'Cinzel\',serif;letter-spacing:1px;margin-top:2px">● ' + LEVEL_LABELS[own] + '</div>' +
              overrideNote +
            '</div>';
          });
          html += '</div>';
        });
        // Bulk actions for the current bucket
        html += '<div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.75rem">' +
          '<button class="action-btn" onclick="if(window.PantheonKnowledge) PantheonKnowledge.setAllInBucket(\'' + bucket + '\',0)">Reset ' + BUCKET_LABELS[bucket] + ' → Unknown</button>' +
          '<button class="action-btn" onclick="if(window.PantheonKnowledge) PantheonKnowledge.setAllInBucket(\'' + bucket + '\',1)">→ Name only</button>' +
          '<button class="action-btn" onclick="if(window.PantheonKnowledge) PantheonKnowledge.setAllInBucket(\'' + bucket + '\',3)">→ Full</button>' +
          (bucket === 'party' ? '<button class="action-btn" onclick="if(window.PantheonKnowledge) PantheonKnowledge.applyDefaults()">Reset ALL buckets to campaign defaults</button>' : '') +
        '</div>';
        container.innerHTML = html;
      }
      this.subscribe(paint);
      paint(this._state || {});
    },

    // -------- Player view --------
    renderPlayer: function(containerId, identity) {
      const container = document.getElementById(containerId);
      if (!container) return;
      const self = this;
      const pcId = (identity && identity.id) || null;

      function paint() {
        const gods = window.PANTHEON_GODS || [];
        const visible = gods.filter(function(g) { return self.getEffectiveLevel(pcId, g.id) >= 1; });
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
        function bucketBlock(cat, heading, note) {
          const bs = gods.filter(function(g) { return g.category === cat && self.getEffectiveLevel(pcId, g.id) >= 1; });
          if (!bs.length) return '';
          let block = '<div class="sec-title" style="margin-top:1rem">' + heading + '</div>';
          if (note) block += '<div class="card-body" style="margin-bottom:.5rem;font-size:13px">' + note + '</div>';
          const minW = cat === 'creator' ? 260 : 200;
          block += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(' + minW + 'px,1fr));gap:.5rem">';
          bs.forEach(function(g) { block += cardFor(g, self.getEffectiveLevel(pcId, g.id)); });
          block += '</div>';
          return block;
        }
        let html = '';
        html += bucketBlock('creator',  'The Creator Gods', 'Two gods shaped the world together at the beginning of time.');
        html += bucketBlock('child',    'The Children',     'Gods born of the Creators, each holding a domain of the world.');
        html += bucketBlock('betrayer', 'The Betrayer Gods', 'Names spoken quietly, with a warding gesture. Their worship is forbidden throughout the civilised lands.');
        container.innerHTML = html;
      }
      this.subscribe(paint);
      paint();
    }
  };

  window.PantheonKnowledge = PK;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(function() { PK.init(); }, 200); });
  } else {
    setTimeout(function() { PK.init(); }, 200);
  }
})();
