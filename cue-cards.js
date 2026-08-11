// =====================================================================
// THE WAYWARD COMPANY — DM CUE CARDS (Update 8)
// ---------------------------------------------------------------------
// Loads /data/cues.json (generated from vault NPC frontmatter by
// tools/generate_cues.py). Renders quick-reference cards for named NPCs
// with voice / opening / wants / secrets / exit.
//
// DM can "pin" cards to the current session's active roster; pinned
// state syncs across devices via Firebase (/cue-active).
//
// Two views:
//   Session Active (pinned, top)  — big cards, fully expanded, easy to scan mid-play
//   All NPCs (bottom)             — condensed list with pin toggle
//
// Public API:
//   CueCards.init(containerId)
//   CueCards.refresh()
// =====================================================================

(function() {
  'use strict';

  const CUES_JSON_URL = 'data/cues.json';
  const CUE_ACTIVE_PATH = 'cue-active';

  const CueCards = {
    _container: null,
    _cues: [],
    _active: {},              // { npcId: true } — Firebase-synced
    _activeRef: null,

    init: function(containerId) {
      this._container = document.getElementById(containerId);
      if (!this._container) return;
      this._loadCues();
      this._initSync();
    },

    refresh: function() {
      this._loadCues();
    },

    _loadCues: function() {
      const self = this;
      fetch(CUES_JSON_URL + '?_=' + Date.now())
        .then(function(r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
        .then(function(data) {
          self._cues = (data && data.cues) || [];
          self._render();
        })
        .catch(function(err) {
          console.warn('[CueCards] Failed to load cues.json:', err);
          if (self._container) self._container.innerHTML = '<div class="cue-empty">Could not load cue cards. Try refreshing.</div>';
        });
    },

    _initSync: function() {
      if (typeof firebase === 'undefined' || !firebase.database) return;
      const self = this;
      try {
        this._activeRef = firebase.database().ref(CUE_ACTIVE_PATH);
        this._activeRef.on('value', function(snap) {
          self._active = snap.val() || {};
          self._render();
        });
      } catch (e) {
        console.warn('[CueCards] Sync init failed:', e);
      }
    },

    _togglePin: function(npcId) {
      if (!this._activeRef) return;
      const currently = !!this._active[npcId];
      this._activeRef.child(npcId).set(currently ? null : true).catch(function(e) {
        console.warn('[CueCards] Pin toggle failed:', e && e.message);
      });
    },

    _clearAll: function() {
      if (!this._activeRef) return;
      if (!confirm('Unpin all cue cards from the active session?')) return;
      this._activeRef.set(null).catch(function(e) {
        console.warn('[CueCards] Clear-all failed:', e && e.message);
      });
    },

    _render: function() {
      if (!this._container || !this._cues.length) return;
      const self = this;

      const active = this._cues.filter(function(c) { return self._active[c.id]; });
      const inactive = this._cues.filter(function(c) { return !self._active[c.id]; });

      // Active session block
      let html = '<div class="cue-active-block">';
      html += '<div class="cue-block-header"><span>Session Active</span>';
      if (active.length) {
        html += '<button class="cue-clear-btn" id="cue-clear-all">Unpin all</button>';
      }
      html += '</div>';
      if (!active.length) {
        html += '<div class="cue-empty-small">No cards pinned. Pin an NPC below to make them appear here during play.</div>';
      } else {
        html += '<div class="cue-active-grid">' + active.map(function(c) { return self._renderActiveCard(c); }).join('') + '</div>';
      }
      html += '</div>';

      // All NPCs list
      html += '<div class="cue-list-block">';
      html += '<div class="cue-block-header"><span>All Cue Cards (' + this._cues.length + ')</span></div>';
      html += '<div class="cue-list">' + inactive.map(function(c) { return self._renderCondensed(c, false); }).join('') + '</div>';
      html += '</div>';

      this._container.innerHTML = html;
      this._wire();
    },

    _renderActiveCard: function(c) {
      const secrets = (c.secrets || []).map(function(s) { return '<li>' + escapeHtml(s) + '</li>'; }).join('');
      return [
        '<div class="cue-card">',
          '<div class="cue-card-header">',
            '<div class="cue-name">' + escapeHtml(c.name) + '</div>',
            '<button class="cue-pin-btn pinned" data-cue="' + escapeAttr(c.id) + '" title="Unpin">📌 pinned</button>',
          '</div>',
          c.role ? '<div class="cue-role">' + escapeHtml(cleanRole(c.role)) + '</div>' : '',
          c.location ? '<div class="cue-location">📍 ' + escapeHtml(c.location) + '</div>' : '',
          c.voice ? '<div class="cue-field"><span class="cue-label">Voice</span><span class="cue-val">' + escapeHtml(c.voice) + '</span></div>' : '',
          c.opening ? '<div class="cue-field"><span class="cue-label">Opening</span><span class="cue-val cue-opening">"' + escapeHtml(c.opening) + '"</span></div>' : '',
          c.wants ? '<div class="cue-field"><span class="cue-label">Wants</span><span class="cue-val">' + escapeHtml(c.wants) + '</span></div>' : '',
          secrets ? '<div class="cue-field"><span class="cue-label">Secrets</span><ul class="cue-secrets">' + secrets + '</ul></div>' : '',
          c.exit ? '<div class="cue-field"><span class="cue-label">Exit</span><span class="cue-val">' + escapeHtml(c.exit) + '</span></div>' : '',
        '</div>'
      ].join('');
    },

    _renderCondensed: function(c) {
      return [
        '<div class="cue-condensed">',
          '<button class="cue-pin-btn" data-cue="' + escapeAttr(c.id) + '" title="Pin to session">📌</button>',
          '<div class="cue-condensed-body">',
            '<div class="cue-name">' + escapeHtml(c.name) + '</div>',
            c.role ? '<div class="cue-role-inline">' + escapeHtml(cleanRole(c.role)) + '</div>' : '',
          '</div>',
        '</div>'
      ].join('');
    },

    _wire: function() {
      const self = this;
      this._container.querySelectorAll('.cue-pin-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          self._togglePin(btn.getAttribute('data-cue'));
        });
      });
      const clearBtn = document.getElementById('cue-clear-all');
      if (clearBtn) clearBtn.addEventListener('click', function() { self._clearAll(); });
    }
  };

  function cleanRole(r) {
    // Strip Obsidian wiki-link syntax [[Foo/Bar|Bar]] → Bar
    return String(r).replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, '$2').trim();
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escapeAttr(s) { return escapeHtml(s).replace(/'/g, '&#39;'); }

  // CSS
  if (!document.getElementById('cue-cards-css')) {
    const style = document.createElement('style');
    style.id = 'cue-cards-css';
    style.textContent = `
      .cue-empty, .cue-empty-small { padding:.85rem 1rem; color:var(--parch3); font-style:italic; text-align:center; }
      .cue-empty-small { font-size:12px; padding:.6rem; }
      .cue-active-block, .cue-list-block { margin-bottom:1.5rem; }
      .cue-block-header { display:flex; justify-content:space-between; align-items:center; font-family:'Cinzel',serif; color:var(--gold2); font-size:12px; letter-spacing:1.8px; text-transform:uppercase; margin-bottom:.6rem; padding-bottom:.4rem; border-bottom:1px solid rgba(160,128,64,0.3); }
      .cue-clear-btn { background:transparent; color:#e0a0a0; border:1px solid rgba(224,160,160,0.4); padding:3px 10px; border-radius:2px; font-family:'Cinzel',serif; font-size:9px; letter-spacing:1px; cursor:pointer; }
      .cue-clear-btn:hover { background:rgba(224,160,160,0.15); }
      .cue-active-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(340px,1fr)); gap:.85rem; }
      .cue-card { background:linear-gradient(135deg,rgba(26,18,8,0.92),rgba(13,10,6,0.98)); border:1px solid rgba(201,168,76,0.5); border-left:4px solid var(--gold2,#c9a84c); border-radius:4px; padding:.85rem 1rem; }
      .cue-card-header { display:flex; justify-content:space-between; align-items:baseline; gap:.5rem; margin-bottom:.35rem; }
      .cue-name { font-family:'Cinzel',serif; color:var(--gold2); font-size:14px; font-weight:700; letter-spacing:.5px; }
      .cue-role { font-size:12px; color:var(--parch3); font-style:italic; margin-bottom:.25rem; }
      .cue-location { font-size:11px; color:var(--parch4,#a89873); margin-bottom:.5rem; }
      .cue-field { margin-top:.5rem; }
      .cue-label { display:block; font-family:'Cinzel',serif; font-size:9px; letter-spacing:1.5px; color:var(--gold2); text-transform:uppercase; margin-bottom:.15rem; opacity:.85; }
      .cue-val { display:block; font-size:12.5px; line-height:1.55; color:var(--parch2,#ebe0c4); }
      .cue-opening { font-style:italic; color:#f4e4a0; }
      .cue-secrets { list-style:disc; padding-left:1.15rem; font-size:12px; line-height:1.55; color:var(--parch2); margin:0; }
      .cue-secrets li { margin-bottom:.2rem; }
      .cue-pin-btn { background:transparent; color:var(--parch3); border:1px solid rgba(160,128,64,0.4); padding:2px 8px; border-radius:3px; font-family:'Cinzel',serif; font-size:10px; letter-spacing:.5px; cursor:pointer; white-space:nowrap; transition:all .12s; }
      .cue-pin-btn:hover { background:rgba(160,128,64,0.15); color:var(--gold2); border-color:var(--gold2); }
      .cue-pin-btn.pinned { background:rgba(201,168,76,0.2); color:var(--gold2); border-color:var(--gold2); }
      .cue-list { display:flex; flex-direction:column; gap:.35rem; }
      .cue-condensed { display:flex; align-items:center; gap:.6rem; background:rgba(26,18,8,0.5); border:1px solid rgba(160,128,64,0.2); border-radius:3px; padding:.45rem .6rem; }
      .cue-condensed:hover { background:rgba(26,18,8,0.7); border-color:rgba(160,128,64,0.4); }
      .cue-condensed-body { flex:1; }
      .cue-role-inline { font-size:11px; color:var(--parch3); font-style:italic; margin-top:.15rem; }
    `;
    document.head.appendChild(style);
  }

  window.CueCards = CueCards;
})();
