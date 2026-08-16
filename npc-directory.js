// =====================================================================
// THE WAYWARD COMPANY — NPC DIRECTORY (auto-generated + per-identity notes)
// ---------------------------------------------------------------------
// Loads /data/npcs.json (generated from the vault by tools/generate_npcs.py)
// and renders visible NPCs into a container. Adds a per-identity per-NPC
// private notes area to each card, synced via Firebase Realtime Database.
//
// Public API:
//   NPCDirectory.init(containerId, identity)
//
// Firebase paths:
//   /npc-notes/<identityId>/<npcId>  →  { body, updatedAt }
//
// Trust model: same as notes-sync.js and characters — open read/write
// on /npc-notes, client filters by identity. No auth-level per-identity
// isolation (see security notes in Working Notes).
// =====================================================================

(function() {
  'use strict';

  const NPC_JSON_URL = 'data/npcs.json';
  const NPC_JSON_URL_DM = 'data/npcs-dm.json';
  const NPC_NOTES_PATH = 'npc-notes';
  const NPC_PINNED_PATH = 'npc-pinned';
  const SAVE_DEBOUNCE_MS = 600;

  const NPCDirectory = {
    _identity: null,
    _container: null,
    _npcs: [],
    _notesRef: null,
    _notesCache: {},          // { npcId: { body, updatedAt } }
    _saveTimers: {},
    _dmMode: false,
    _pinnedRef: null,
    _pinned: {},              // { npcId: true } — per-identity Firebase-synced
    _searchQuery: '',

    // Update 13 — opts.dm = true fetches the full DM list (all NPCs incl. hidden).
    init: function(containerId, identity, opts) {
      this._container = document.getElementById(containerId);
      if (!this._container) {
        console.warn('[NPCDirectory] Container not found:', containerId);
        return;
      }
      if (!identity || !identity.id) {
        console.warn('[NPCDirectory] Identity required (with .id)');
        return;
      }
      this._identity = identity;
      this._dmMode = !!(opts && opts.dm);
      this._loadNPCs();
      this._initNotesSync();
      this._initPinSync();
    },

    _loadNPCs: function() {
      const self = this;
      const url = this._dmMode ? NPC_JSON_URL_DM : NPC_JSON_URL;
      fetch(url + '?_=' + Date.now())
        .then(function(r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
        .then(function(data) {
          self._npcs = (data && data.npcs) || [];
          self._render();
        })
        .catch(function(err) {
          console.warn('[NPCDirectory] Failed to load npcs.json:', err);
          self._container.innerHTML = '<div class="npc-empty">Could not load NPC directory. Try refreshing.</div>';
        });
    },

    _initNotesSync: function() {
      if (typeof firebase === 'undefined' || !firebase.database) {
        console.warn('[NPCDirectory] Firebase unavailable — notes will not sync.');
        return;
      }
      const self = this;
      try {
        const db = firebase.database();
        this._notesRef = db.ref(NPC_NOTES_PATH + '/' + this._identity.id);
        this._notesRef.on('value', function(snap) {
          self._notesCache = snap.val() || {};
          self._refreshAllNoteAreas();
        });
      } catch (e) {
        console.warn('[NPCDirectory] Notes subscribe failed:', e);
      }
    },

    _initPinSync: function() {
      if (typeof firebase === 'undefined' || !firebase.database) return;
      const self = this;
      try {
        this._pinnedRef = firebase.database().ref(NPC_PINNED_PATH + '/' + this._identity.id);
        this._pinnedRef.on('value', function(snap) {
          self._pinned = snap.val() || {};
          self._applyPinAndFilter();
        });
      } catch (e) {
        console.warn('[NPCDirectory] Pin subscribe failed:', e);
      }
    },

    _togglePin: function(npcId) {
      if (!this._pinnedRef) return;
      const currently = !!this._pinned[npcId];
      this._pinnedRef.child(npcId).set(currently ? null : true).catch(function(e) {
        console.warn('[NPCDirectory] Pin toggle failed:', e && e.message);
      });
    },

    _onSearchInput: function(val) {
      this._searchQuery = String(val || '').trim().toLowerCase();
      this._applyPinAndFilter();
    },

    _applyPinAndFilter: function() {
      const container = this._container;
      if (!container) return;
      const q = this._searchQuery;
      let visible = 0;
      const self = this;
      container.querySelectorAll('.card[data-npc-id]').forEach(function(card) {
        const npcId = card.getAttribute('data-npc-id');
        const pinned = !!self._pinned[npcId];
        const text = card.textContent.toLowerCase();
        const matchSearch = !q || text.indexOf(q) >= 0;
        card.style.display = matchSearch ? '' : 'none';
        card.style.order = pinned ? '-1' : '';
        const pinBtn = card.querySelector('.npc-pin-btn');
        if (pinBtn) {
          pinBtn.textContent = pinned ? '📌 pinned' : '📌 pin';
          pinBtn.classList.toggle('pinned', pinned);
        }
        card.style.boxShadow = pinned ? '0 0 0 2px var(--gold2)' : '';
        if (matchSearch) visible++;
      });
      // Hide region headers whose cards are all filter-hidden.
      container.querySelectorAll('.npc-region-header').forEach(function(h) {
        let el = h.nextElementSibling;
        let hasVisible = false;
        while (el && !el.classList.contains('npc-region-header')) {
          if (el.classList.contains('card') && el.style.display !== 'none') { hasVisible = true; break; }
          el = el.nextElementSibling;
        }
        h.style.display = hasVisible ? '' : 'none';
      });
      const counter = document.getElementById('npc-search-count-player');
      if (counter) counter.textContent = q ? (visible + ' of ' + self._npcs.length) : (self._npcs.length + ' NPCs');
    },

    _refreshAllNoteAreas: function() {
      const self = this;
      Object.keys(this._notesCache).forEach(function(npcId) {
        const ta = document.getElementById('npc-note-' + npcId);
        if (ta && document.activeElement !== ta) {
          const entry = self._notesCache[npcId] || {};
          ta.value = entry.body || '';
          self._updateSavedLabel(npcId, entry.updatedAt);
        }
      });
    },

    _updateSavedLabel: function(npcId, updatedAt) {
      const label = document.getElementById('npc-note-saved-' + npcId);
      if (!label) return;
      if (!updatedAt) { label.textContent = ''; return; }
      const d = new Date(updatedAt);
      const now = new Date();
      const sameDay = d.toDateString() === now.toDateString();
      label.textContent = '✓ saved ' + (sameDay
        ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString());
    },

    _saveNote: function(npcId, body) {
      const self = this;
      clearTimeout(this._saveTimers[npcId]);
      this._saveTimers[npcId] = setTimeout(function() {
        if (!self._notesRef) return;
        self._notesRef.child(npcId).set({
          body: String(body || ''),
          updatedAt: firebase.database.ServerValue.TIMESTAMP
        }).catch(function(e) {
          console.warn('[NPCDirectory] Note save failed for', npcId, e && e.message);
        });
      }, SAVE_DEBOUNCE_MS);
    },

    _render: function() {
      if (!this._npcs.length) {
        this._container.innerHTML = '<div class="npc-empty">No NPCs yet. Your party hasn\'t met anyone visible on this directory.</div>';
        return;
      }
      const self = this;
      // Prominent top search bar — centered, wide, big.
      const searchBar =
        '<div class="npc-search-hero" style="max-width:640px;margin:0 auto 1.5rem;text-align:center">' +
          '<div style="display:flex;gap:.5rem;align-items:stretch">' +
            '<input type="text" id="npc-search-player" placeholder="🔍  Search NPCs by name, role, keyword…" ' +
              'oninput="if(window.NPCDirectory) NPCDirectory._onSearchInput(this.value)" ' +
              'style="flex:1;padding:.7rem 1rem;background:#fff8e8;border:2px solid var(--border);border-radius:4px;color:var(--ink);font-family:\'Crimson Pro\',serif;font-size:16px;outline:none;box-shadow:0 2px 8px rgba(138,106,16,0.1)">' +
            '<button onclick="document.getElementById(\'npc-search-player\').value=\'\';if(window.NPCDirectory) NPCDirectory._onSearchInput(\'\')" ' +
              'style="background:transparent;color:var(--ink3);border:2px solid var(--border);border-radius:4px;padding:.4rem 1rem;font-family:\'Cinzel\',serif;font-size:10px;letter-spacing:1px;cursor:pointer">✕ Clear</button>' +
          '</div>' +
          '<div id="npc-search-count-player" style="font-size:11px;color:var(--ink3);font-style:italic;margin-top:.4rem">' + this._npcs.length + ' NPCs</div>' +
        '</div>';

      // Group by region.
      const REGION_ORDER = ['Aeloria Crossroads', 'Ironhold', 'On the Road', 'Aurora Peaks', 'Frostwood Marsh', 'Verdant Expanse', 'Northern Reaches', 'Ember Wastes', 'Serpent Isles', 'Celestial Plateau'];
      const buckets = {};
      this._npcs.forEach(function(n) {
        const r = n.region || 'On the Road';
        (buckets[r] = buckets[r] || []).push(n);
      });

      let cardsHtml = '<div class="npc-grid-inner">';
      REGION_ORDER.forEach(function(region) {
        const list = buckets[region];
        if (!list || !list.length) return;
        cardsHtml += '<div class="npc-region-header" data-region="' + escapeAttr(region) + '">' + escapeHtml(region) + ' <span style="font-size:11px;color:var(--ink3);font-weight:400;margin-left:.4rem">' + list.length + ' NPC' + (list.length === 1 ? '' : 's') + '</span></div>';
        list.forEach(function(npc) { cardsHtml += self._renderCard(npc); });
      });
      cardsHtml += '</div>';

      this._container.innerHTML = searchBar + cardsHtml;

      // Wire up textareas
      this._npcs.forEach(function(npc) {
        const ta = document.getElementById('npc-note-' + npc.id);
        if (ta) {
          const cached = self._notesCache[npc.id];
          if (cached) {
            ta.value = cached.body || '';
            self._updateSavedLabel(npc.id, cached.updatedAt);
          }
          ta.addEventListener('input', function() { self._saveNote(npc.id, ta.value); });
        }
      });
      this._applyPinAndFilter();
    },

    _renderCard: function(npc) {
      const avatarBg = npc.avatarBg ? ' style="background:' + this._esc(npc.avatarBg) + '"' : '';
      const badges = (npc.badges || []).map(function(b) {
        const cls = 'b-' + (b.color || 'grey');
        return '<span class="badge ' + cls + '">' + escapeHtml(b.text) + '</span>';
      }).join('');
      return [
        '<div class="card" data-npc-id="' + escapeAttr(npc.id) + '" style="position:relative">',
          '<button class="npc-pin-btn" onclick="if(window.NPCDirectory) NPCDirectory._togglePin(\'' + escapeAttr(npc.id) + '\')" title="Pin to top" style="position:absolute;top:6px;right:6px;background:transparent;border:1px solid var(--border);color:var(--ink3);padding:2px 8px;border-radius:3px;font-family:\'Cinzel\',serif;font-size:10px;letter-spacing:.5px;cursor:pointer;transition:all .12s;z-index:2">📌 pin</button>',
          '<div class="npc-header">',
            '<div class="npc-avatar"' + avatarBg + '>' + escapeHtml(npc.avatar || '?') + '</div>',
            '<div>',
              '<div class="card-title" style="margin:0">' + escapeHtml(npc.name) + '</div>',
              '<div class="card-sub" style="margin:0">' + escapeHtml(npc.role) + '</div>',
            '</div>',
          '</div>',
          '<div class="card-body" style="font-size:13px">' + escapeHtml(npc.summary) + '</div>',
          badges ? '<div style="margin-top:.4rem">' + badges + '</div>' : '',
          '<details class="npc-notes-wrap">',
            '<summary>📝 My notes</summary>',
            '<textarea id="npc-note-' + escapeAttr(npc.id) + '" class="npc-note-area" placeholder="Private notes about ' + escapeAttr(npc.name) + '…"></textarea>',
            '<div class="npc-note-saved" id="npc-note-saved-' + escapeAttr(npc.id) + '"></div>',
          '</details>',
        '</div>'
      ].join('');
    },

    _esc: function(s) { return String(s).replace(/"/g, '&quot;'); }
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

  // Inject CSS for note area if not already present
  if (!document.getElementById('npc-directory-css')) {
    const style = document.createElement('style');
    style.id = 'npc-directory-css';
    style.textContent = [
      '.npc-notes-wrap { margin-top:.75rem; padding-top:.6rem; border-top: 1px dashed var(--border2, #d0b070); }',
      '.npc-notes-wrap summary { cursor:pointer; font-family:"Cinzel",serif; font-size:11px; letter-spacing:1.5px; color:var(--gold,#8a6a10); text-transform:uppercase; }',
      '.npc-note-area { width:100%; min-height:80px; margin-top:.4rem; padding:.5rem .6rem; background:#fff8e8; border:1px solid var(--border2,#d0b070); border-radius:3px; font-family:"Crimson Pro",serif; font-size:13px; color:var(--ink,#1a1208); line-height:1.55; resize:vertical; outline:none; }',
      '.npc-note-area:focus { border-color: var(--gold,#8a6a10); box-shadow: 0 0 0 2px rgba(138,106,16,0.12); }',
      '.npc-note-saved { font-size:11px; color:var(--teal,#0d3d30); font-style:italic; margin-top:.25rem; min-height:14px; }',
      '.npc-empty { padding:1.5rem; text-align:center; color:var(--ink3,#5a4020); font-style:italic; }',
      '.npc-pin-btn:hover { background:rgba(138,106,16,0.1); color:var(--gold); border-color:var(--gold); }',
      '.npc-pin-btn.pinned { background:rgba(138,106,16,0.25); color:var(--gold); border-color:var(--gold); }',
      '.npc-grid-inner { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:.75rem; }',
      '.npc-region-header { grid-column:1/-1; font-family:\'Cinzel\',serif; font-size:12px; letter-spacing:2px; text-transform:uppercase; color:var(--gold); border-bottom:1px solid var(--border2); padding:.6rem 0 .35rem; margin-top:.5rem; }',
      '.npc-region-header:first-child { margin-top:0; }',
      '@media (min-width:1000px) { .npc-grid-inner { grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); } }',
      '@media (max-width:600px)  { .npc-grid-inner { grid-template-columns:1fr; } }'
    ].join('\n');
    document.head.appendChild(style);
  }

  window.NPCDirectory = NPCDirectory;
})();
