// =====================================================================
// THE WAYWARD COMPANY — PLAYER CARD NOTES (Update 57)
// ---------------------------------------------------------------------
// A private "My notes" box for any card a player can see: quests, map
// places, and (via npc-directory.js) People Met. Plus the 📓 My Notes
// tab and "📌 Save to my notes" for handouts and messages.
//
// Firebase path (shared with npc-directory.js, no new rules):
//   /npc-notes/<identityId>/<key>  →  { body, updatedAt, title, kind, where }
//   key = '<npcId>' for People Met, 'quest:<slug>', 'place:<map>:<id>'
//
// Public API:
//   PlayerNotes.init(identity)            → subscribes; no-op for the DM
//   PlayerNotes.box(key, title, kind, where) → HTML for a notes expander
//   PlayerNotes.renderAll(containerId)    → the My Notes tab
//   PlayerNotes.saveFrom(title, text)     → pop-up: add a quote to a note
// Trust model: same as npc-directory.js (private on screen, open path).
// =====================================================================

(function() {
  'use strict';

  const PATH = 'npc-notes';
  const SAVE_DEBOUNCE_MS = 600;
  const KIND_LABELS = { npc: 'People', quest: 'Quests', place: 'Places' };

  const esc = function(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  const slug = function(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); };

  const PlayerNotes = {
    ready: false,
    _identity: null,
    _ref: null,
    _cache: {},
    _timers: {},
    _listeners: [],
    _allContainer: null,

    init: function(identity) {
      if (this._ref || !identity || !identity.id || identity.role === 'dm') return;
      if (typeof firebase === 'undefined' || !firebase.database) return;
      if ((!firebase.apps || !firebase.apps.length) && window.CharacterSync) CharacterSync.init();
      const self = this;
      this._identity = identity;
      try {
        this._ref = firebase.database().ref(PATH + '/' + identity.id);
        this._ref.on('value', function(snap) {
          self._cache = snap.val() || {};
          self.ready = true;
          self._fillBoxes();
          if (self._allContainer) self.renderAll(self._allContainer);
          self._listeners.forEach(function(fn) { fn(self._cache); });
        });
      } catch (e) { console.warn('[PlayerNotes] subscribe failed:', e); }
      document.body.classList.add('pn-on');
    },

    onChange: function(fn) { this._listeners.push(fn); },

    box: function(key, title, kind, where) {
      return '<details class="pn-wrap" data-pn-box="' + esc(key) + '">' +
        '<summary>📝 My notes</summary>' +
        '<textarea class="pn-area" data-pn-key="' + esc(key) + '" data-pn-title="' + esc(title) + '" data-pn-kind="' + esc(kind) + '" data-pn-where="' + esc(where || '') + '" placeholder="Private notes about ' + esc(title) + '…"></textarea>' +
        '<div class="pn-saved" data-pn-saved="' + esc(key) + '"></div></details>';
    },

    // Add a notes box to every quest card (data-quest, or a slug of its title).
    attachQuests: function(panelId) {
      const panel = document.getElementById(panelId);
      if (!panel) return;
      const self = this;
      panel.querySelectorAll('.card').forEach(function(card) {
        if (card.querySelector('.pn-wrap')) return;
        const t = card.querySelector('.card-title');
        if (!t) return;
        const title = t.textContent.trim();
        const key = 'quest:' + (card.getAttribute('data-quest') || slug(title));
        card.setAttribute('data-pn-card', key);
        card.insertAdjacentHTML('beforeend', self.box(key, title, 'quest', 'Quests'));
      });
      this._fillBoxes();
    },

    // Add a notes box to every place panel on a map page (player view only).
    attachMapPanels: function(mapId, mapLabel) {
      const self = this;
      document.querySelectorAll('.panel-card[id^="loc-"]').forEach(function(card) {
        if (card.querySelector('.pn-wrap')) return;
        const n = card.querySelector('.panel-name');
        const title = n ? n.textContent.trim() : card.id.slice(4);
        const key = 'place:' + mapId + ':' + card.id.slice(4);
        card.insertAdjacentHTML('beforeend', '<div style="padding:0 1rem 1rem">' + self.box(key, title, 'place', mapLabel) + '</div>');
      });
      this._fillBoxes();
    },

    _fillBoxes: function() {
      const self = this;
      document.querySelectorAll('textarea[data-pn-key]').forEach(function(ta) {
        if (document.activeElement === ta) return;
        const e = self._cache[ta.getAttribute('data-pn-key')] || {};
        ta.value = e.body || '';
        self._savedLabel(ta.getAttribute('data-pn-key'), e.updatedAt);
      });
    },

    _savedLabel: function(key, at) {
      document.querySelectorAll('[data-pn-saved="' + CSS.escape(key) + '"]').forEach(function(el) {
        if (!at) { el.textContent = ''; return; }
        const d = new Date(at);
        el.textContent = '✓ saved ' + (d.toDateString() === new Date().toDateString()
          ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString());
      });
    },

    _write: function(key, body, meta) {
      if (!this._ref) return Promise.resolve();
      const prev = this._cache[key] || {};
      return this._ref.child(key).set({
        body: String(body || ''),
        updatedAt: firebase.database.ServerValue.TIMESTAMP,
        title: meta.title || prev.title || '',
        kind: meta.kind || prev.kind || 'npc',
        where: meta.where || prev.where || ''
      }).catch(function(e) { console.warn('[PlayerNotes] save failed for', key, e && e.message); });
    },

    _onInput: function(ta) {
      const self = this;
      const key = ta.getAttribute('data-pn-key');
      clearTimeout(this._timers[key]);
      this._timers[key] = setTimeout(function() {
        self._write(key, ta.value, { title: ta.getAttribute('data-pn-title'), kind: ta.getAttribute('data-pn-kind'), where: ta.getAttribute('data-pn-where') });
      }, SAVE_DEBOUNCE_MS);
    },

    // Every note with text, as { key, title, kind, where, body, updatedAt }.
    // People Met notes saved before Update 57 have no title; look it up.
    entries: function() {
      const npcs = (window.NPCDirectory && NPCDirectory._npcs) || [];
      const self = this;
      return Object.keys(this._cache).map(function(k) {
        const e = self._cache[k] || {};
        let title = e.title;
        if (!title) { const n = npcs.find(function(x) { return x.id === k; }); title = n ? n.name : k; }
        return { key: k, title: title, kind: e.kind || (/^quest:/.test(k) ? 'quest' : /^place:/.test(k) ? 'place' : 'npc'), where: e.where || '', body: e.body || '', updatedAt: e.updatedAt || 0 };
      }).filter(function(e) { return e.body.trim(); });
    },

    renderAll: function(containerId) {
      this._allContainer = containerId;
      const c = document.getElementById(containerId);
      if (!c) return;
      if (!this._ref) { c.innerHTML = '<div class="pn-empty">Log in as a player to keep notes.</div>'; return; }
      // Don't redraw under the cursor while someone is typing in this tab.
      if (c.contains(document.activeElement) && document.activeElement.tagName === 'TEXTAREA') return;
      const list = this.entries();
      if (!list.length) {
        c.innerHTML = '<div class="pn-empty">No notes yet. Open "📝 My notes" on any person, quest or map place, or use "📌 Save to my notes" on a handout or message.</div>';
        return;
      }
      const self = this;
      let h = '';
      ['npc', 'quest', 'place'].forEach(function(kind) {
        const group = list.filter(function(e) { return e.kind === kind; }).sort(function(a, b) { return a.title.localeCompare(b.title); });
        if (!group.length) return;
        h += '<div class="sec-title" style="margin-top:1rem">' + KIND_LABELS[kind] + '</div><div class="pn-grid">';
        group.forEach(function(e) {
          h += '<div class="card"><div class="card-title" style="display:flex;justify-content:space-between;gap:.5rem;align-items:baseline">' +
            '<span>' + esc(e.title) + '</span>' +
            '<button class="pn-go" onclick="PlayerNotes.goTo(\'' + esc(e.key) + '\')">' + (kind === 'place' ? 'Open map ↗' : 'Go to card →') + '</button></div>' +
            (e.where ? '<div class="card-sub">' + esc(e.where) + '</div>' : '') +
            self.box(e.key, e.title, e.kind, e.where).replace('<details ', '<details open ') + '</div>';
        });
        h += '</div>';
      });
      c.innerHTML = h;
      this._fillBoxes();
    },

    goTo: function(key) {
      const nav = function(tab) {
        const b = Array.prototype.find.call(document.querySelectorAll('.nav-btn'), function(x) { return (x.getAttribute('onclick') || '').indexOf("show('" + tab + "'") !== -1; });
        if (b) b.click();
      };
      let card = null;
      if (/^quest:/.test(key)) { nav('quests'); card = document.querySelector('[data-pn-card="' + CSS.escape(key) + '"]'); }
      else if (/^place:/.test(key)) {
        const map = key.split(':')[1];
        window.open((map === 'aeloria' ? 'aeloria_map.html' : 'world_map.html') + '?player#' + key.split(':').slice(2).join(':'), '_blank');
        return;
      } else { nav('npcs'); card = document.querySelector('.card[data-npc-id="' + CSS.escape(key) + '"]'); }
      if (card) {
        const d = card.querySelector('details'); if (d) d.open = true;
        setTimeout(function() { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60);
      }
    },

    // Pop-up: pick a person / quest / place, then append a dated quote.
    saveFrom: function(title, text) {
      if (!this._ref) return;
      const self = this;
      const opts = [];
      ((window.NPCDirectory && NPCDirectory._npcs) || []).forEach(function(n) { opts.push({ key: n.id, title: n.name, kind: 'npc', where: 'People Met' }); });
      document.querySelectorAll('#panel-quests .card .card-title').forEach(function(t) {
        const card = t.closest('.card');
        const key = card.getAttribute('data-pn-card') || ('quest:' + (card.getAttribute('data-quest') || slug(t.textContent)));
        opts.push({ key: key, title: t.textContent.trim(), kind: 'quest', where: 'Quests' });
      });
      this.entries().filter(function(e) { return e.kind === 'place'; }).forEach(function(e) { opts.push(e); });
      const group = function(kind) {
        const g = opts.filter(function(o) { return o.kind === kind; }).sort(function(a, b) { return a.title.localeCompare(b.title); });
        return g.length ? '<optgroup label="' + KIND_LABELS[kind] + '">' + g.map(function(o) { return '<option value="' + esc(o.key) + '">' + esc(o.title) + '</option>'; }).join('') + '</optgroup>' : '';
      };
      const ov = document.createElement('div');
      ov.className = 'pn-pop';
      ov.innerHTML = '<div class="pn-pop-box"><div class="sec-title" style="margin:0 0 .5rem">📌 Save to my notes</div>' +
        '<div style="font-size:13px;color:var(--ink3);margin-bottom:.5rem">Adds “' + esc(title) + '” to the end of your note on:</div>' +
        '<select class="pn-pick"><option value="">— choose —</option>' + group('npc') + group('quest') + group('place') + '</select>' +
        '<div style="font-size:11.5px;color:var(--ink3);font-style:italic;margin-top:.35rem">Map places appear here once you have a note on them.</div>' +
        '<div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:.8rem"><button class="pn-btn" data-x="cancel">Cancel</button><button class="pn-btn pn-primary" data-x="ok">Save</button></div></div>';
      document.body.appendChild(ov);
      const close = function() { ov.remove(); };
      ov.addEventListener('click', function(ev) {
        const x = ev.target.getAttribute && ev.target.getAttribute('data-x');
        if (x === 'cancel' || ev.target === ov) return close();
        if (x !== 'ok') return;
        const key = ov.querySelector('.pn-pick').value;
        if (!key) return;
        const o = opts.find(function(z) { return z.key === key; });
        const prev = (self._cache[key] || {}).body || '';
        const stamp = new Date().toLocaleDateString();
        const quote = '— ' + title + ' (' + stamp + '):\n' + String(text || '').trim();
        self._write(key, (prev.trim() ? prev.replace(/\s+$/, '') + '\n\n' : '') + quote, o).then(function() {
          ov.querySelector('.pn-pop-box').innerHTML = '<div style="padding:.5rem 0;text-align:center">✓ Saved to your note on <strong>' + esc(o.title) + '</strong>.</div>';
          setTimeout(close, 1100);
        });
      });
    }
  };

  document.addEventListener('input', function(e) {
    if (e.target && e.target.matches && e.target.matches('textarea[data-pn-key]')) PlayerNotes._onInput(e.target);
  });

  if (!document.getElementById('player-notes-css')) {
    const style = document.createElement('style');
    style.id = 'player-notes-css';
    style.textContent = [
      '.pn-wrap { display:none; margin-top:.75rem; padding-top:.6rem; border-top:1px dashed var(--border2,#d0b070); }',
      'body.pn-on .pn-wrap { display:block; }',
      '.pn-wrap summary { cursor:pointer; font-family:"Cinzel",serif; font-size:11px; letter-spacing:1.5px; color:var(--gold,#8a6a10); text-transform:uppercase; }',
      '.pn-area { width:100%; min-height:80px; margin-top:.4rem; padding:.5rem .6rem; background:#fff8e8; border:1px solid var(--border2,#d0b070); border-radius:3px; font-family:"Crimson Pro",serif; font-size:13px; color:#1a1208; line-height:1.55; resize:vertical; outline:none; box-sizing:border-box; }',
      '.pn-saved { font-size:11px; color:var(--teal,#0d3d30); font-style:italic; margin-top:.25rem; min-height:14px; }',
      '.pn-empty { padding:1.5rem; text-align:center; color:var(--ink3,#5a4020); font-style:italic; }',
      '.pn-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:.75rem; }',
      '.pn-go, .pn-btn { background:transparent; border:1px solid var(--border,#a88240); color:var(--gold,#8a6a10); padding:2px 8px; border-radius:3px; font-family:"Cinzel",serif; font-size:10px; letter-spacing:.5px; cursor:pointer; white-space:nowrap; }',
      '.pn-btn { font-size:11px; padding:.35rem .9rem; }',
      '.pn-primary { background:var(--gold,#8a6a10); color:#fff8e8; border-color:var(--gold,#8a6a10); }',
      '.pn-pop { position:fixed; inset:0; background:rgba(0,0,0,0.55); display:flex; align-items:center; justify-content:center; z-index:10000; padding:16px; }',
      '.pn-pop-box { background:#f4ead4; color:#2a1a08; border:2px solid #8a6a10; border-radius:6px; padding:1rem 1.1rem; width:100%; max-width:420px; }',
      '.pn-pick { width:100%; padding:.4rem .5rem; font-family:"Crimson Pro",serif; font-size:15px; }',
      '@media (max-width:600px) { .pn-grid { grid-template-columns:1fr; } }'
    ].join('\n');
    document.head.appendChild(style);
  }

  window.PlayerNotes = PlayerNotes;
})();
