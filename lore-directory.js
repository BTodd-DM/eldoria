// =====================================================================
// THE WAYWARD COMPANY — KNOWN LORE (Update 3)
// ---------------------------------------------------------------------
// Loads /data/lore.json (generated from vault by tools/generate_lore.py)
// and renders one of two views based on identity:
//
//   PLAYER identity → "What You Know" list, grouped by topic, hidden entirely
//                     if the fact isn't flagged known for that identity.
//   DM identity     → "Known Lore" grid, rows=facts, cols=Torren/Sylas/Orin,
//                     click any cell to toggle known state (writes Firebase).
//
// Runtime state lives at Firebase path:
//   /lore-known/<pcId>/<factId>  →  true  (or absent = not known)
//
// If Firebase has no entry for a fact/pc pair, we fall back to the fact's
// initialKnown value from the JSON. That way DM state overrides the seed
// but the seed applies to fresh installs.
//
// Public API:
//   LoreDirectory.init(containerId, identity)
//
// Trust model: same as other Firebase-synced things — open read/write on
// /lore-known, visibility enforced client-side.
// =====================================================================

(function() {
  'use strict';

  const LORE_JSON_URL = 'data/lore.json';
  const LORE_KNOWN_PATH = 'lore-known';
  const PC_IDS = ['torren', 'sylas', 'orin'];
  const PC_LABELS = { torren: 'Torren', sylas: 'Sylas', orin: 'Orin' };

  const LoreDirectory = {
    _identity: null,
    _container: null,
    _facts: [],
    _known: {},           // { pcId: { factId: true } }
    _knownRef: null,

    init: function(containerId, identity) {
      this._container = document.getElementById(containerId);
      if (!this._container) return;
      if (!identity || !identity.id) return;
      this._identity = identity;
      this._loadFacts();
      this._initSync();
    },

    _loadFacts: function() {
      const self = this;
      fetch(LORE_JSON_URL + '?_=' + Date.now())
        .then(function(r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
        .then(function(data) {
          self._facts = (data && data.facts) || [];
          self._render();
        })
        .catch(function(err) {
          console.warn('[LoreDirectory] Failed to load lore.json:', err);
          self._container.innerHTML = '<div class="lore-empty">Could not load lore. Try refreshing.</div>';
        });
    },

    _initSync: function() {
      if (typeof firebase === 'undefined' || !firebase.database) {
        console.warn('[LoreDirectory] Firebase unavailable — using JSON defaults only.');
        return;
      }
      const self = this;
      try {
        this._knownRef = firebase.database().ref(LORE_KNOWN_PATH);
        this._knownRef.on('value', function(snap) {
          self._known = snap.val() || {};
          self._render();
        });
      } catch (e) {
        console.warn('[LoreDirectory] Sync init failed:', e);
      }
    },

    /** Effective known state: Firebase overrides fact.initialKnown seed. */
    _isKnown: function(fact, pcId) {
      const remote = this._known[pcId];
      if (remote && remote[fact.id] !== undefined) return !!remote[fact.id];
      return !!(fact.initialKnown && fact.initialKnown[pcId]);
    },

    _toggle: function(factId, pcId) {
      if (!this._knownRef) return;
      const fact = this._facts.find(function(f) { return f.id === factId; });
      if (!fact) return;
      const current = this._isKnown(fact, pcId);
      this._knownRef.child(pcId).child(factId).set(!current).catch(function(e) {
        console.warn('[LoreDirectory] Toggle failed:', e && e.message);
      });
    },

    _render: function() {
      if (!this._facts.length) return;
      if (this._identity.role === 'dm') this._renderDMGrid();
      else this._renderPlayerList();
    },

    // -------------------- PLAYER VIEW --------------------
    _renderPlayerList: function() {
      const self = this;
      const pcId = this._identity.id;
      const visibleFacts = this._facts.filter(function(f) { return self._isKnown(f, pcId); });

      if (!visibleFacts.length) {
        this._container.innerHTML = '<div class="lore-empty">You don\'t know any facts yet. As your party discovers things in play, they\'ll appear here.</div>';
        return;
      }

      // Group by topic
      const byTopic = {};
      visibleFacts.forEach(function(f) {
        (byTopic[f.topic] = byTopic[f.topic] || []).push(f);
      });
      const topics = Object.keys(byTopic).sort();

      const html = topics.map(function(topic) {
        const items = byTopic[topic].map(function(f) {
          return '<li>' + escapeHtml(f.text) + '</li>';
        }).join('');
        return [
          '<div class="lore-topic">',
            '<div class="lore-topic-name">' + escapeHtml(topic) + '</div>',
            '<ul class="lore-fact-list">' + items + '</ul>',
          '</div>'
        ].join('');
      }).join('');

      this._container.innerHTML = '<div class="lore-player-wrap">' + html + '</div>';
    },

    // -------------------- DM GRID VIEW --------------------
    _renderDMGrid: function() {
      const self = this;
      const byTopic = {};
      this._facts.forEach(function(f) {
        (byTopic[f.topic] = byTopic[f.topic] || []).push(f);
      });
      const topics = Object.keys(byTopic).sort();

      let html = '<table class="lore-grid"><thead><tr><th class="lore-topic-col">Topic</th><th class="lore-fact-col">Fact</th>';
      PC_IDS.forEach(function(pc) {
        html += '<th class="lore-pc-col">' + PC_LABELS[pc] + '</th>';
      });
      html += '</tr></thead><tbody>';

      topics.forEach(function(topic) {
        byTopic[topic].forEach(function(f, i) {
          const topicCell = i === 0 ? '<td class="lore-topic-cell" rowspan="' + byTopic[topic].length + '">' + escapeHtml(topic) + '</td>' : '';
          const spoilerClass = f.spoiler === 'hidden' ? ' lore-hidden' : '';
          html += '<tr class="lore-row' + spoilerClass + '">' + topicCell +
            '<td class="lore-fact-cell">' + escapeHtml(f.text) + '</td>';
          PC_IDS.forEach(function(pc) {
            const known = self._isKnown(f, pc);
            html += '<td class="lore-toggle-cell' + (known ? ' known' : '') + '" ' +
              'data-fact="' + escapeAttr(f.id) + '" data-pc="' + pc + '" ' +
              'title="Click to toggle">' +
              (known ? '✓' : '·') + '</td>';
          });
          html += '</tr>';
        });
      });
      html += '</tbody></table>';

      // Legend
      html += '<div class="lore-legend"><span>· = not known</span><span>✓ = known</span><span class="lore-hidden-legend">Rows dimmed with red bar = spoiler-hidden (party doesn\'t know yet)</span></div>';

      this._container.innerHTML = '<div class="lore-dm-wrap">' + html + '</div>';

      // Wire up cell clicks
      this._container.querySelectorAll('.lore-toggle-cell').forEach(function(cell) {
        cell.addEventListener('click', function() {
          const factId = cell.getAttribute('data-fact');
          const pcId = cell.getAttribute('data-pc');
          self._toggle(factId, pcId);
        });
      });
    }
  };

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, '&#39;');
  }

  // Inject CSS once
  if (!document.getElementById('lore-directory-css')) {
    const style = document.createElement('style');
    style.id = 'lore-directory-css';
    style.textContent = `
      .lore-empty { padding:1.5rem; text-align:center; color:var(--ink3,#5a4020); font-style:italic; }
      /* Player view */
      .lore-player-wrap { display:flex; flex-direction:column; gap:1rem; }
      .lore-topic { background:var(--bg2,#ece0c0); border:1px solid var(--border2,#d0b070); border-radius:3px; padding:.85rem 1rem; }
      .lore-topic-name { font-family:'Cinzel',serif; font-size:12px; letter-spacing:1.5px; color:var(--gold,#8a6a10); text-transform:uppercase; margin-bottom:.5rem; }
      .lore-fact-list { list-style:disc; margin:0; padding-left:1.2rem; color:var(--ink2,#3a2a10); font-size:14px; line-height:1.7; }
      .lore-fact-list li { margin-bottom:.35rem; }
      /* DM grid */
      .lore-dm-wrap { overflow-x:auto; }
      .lore-grid { width:100%; border-collapse:collapse; font-size:12px; }
      .lore-grid th { text-align:left; padding:.5rem .6rem; background:rgba(160,128,64,0.15); color:var(--gold2,#c09030); font-family:'Cinzel',serif; letter-spacing:1px; text-transform:uppercase; font-size:10px; border-bottom:1px solid rgba(160,128,64,0.4); }
      .lore-grid td { padding:.55rem .6rem; border-bottom:1px solid rgba(160,128,64,0.15); vertical-align:top; }
      .lore-topic-cell { font-family:'Cinzel',serif; font-size:11px; color:var(--gold2,#c09030); text-transform:uppercase; letter-spacing:1px; background:rgba(160,128,64,0.05); vertical-align:top; padding-top:.75rem; }
      .lore-fact-cell { color:var(--parch1,#e8d9b4); font-size:12.5px; line-height:1.5; max-width:640px; }
      .lore-pc-col, .lore-toggle-cell { text-align:center; width:70px; }
      .lore-toggle-cell { cursor:pointer; font-family:'Cinzel',serif; font-size:16px; user-select:none; color:rgba(160,128,64,0.4); transition:background .12s; }
      .lore-toggle-cell:hover { background:rgba(160,128,64,0.15); }
      .lore-toggle-cell.known { color:#5db67a; font-weight:700; }
      .lore-row.lore-hidden .lore-fact-cell { opacity:.55; border-left:3px solid #7a1818; padding-left:.6rem; }
      .lore-legend { margin-top:.85rem; font-size:11px; color:var(--parch3,#a89873); display:flex; gap:1rem; flex-wrap:wrap; font-family:'Cinzel',serif; letter-spacing:.5px; }
      .lore-hidden-legend { color:#c07070; }
    `;
    document.head.appendChild(style);
  }

  window.LoreDirectory = LoreDirectory;
})();
