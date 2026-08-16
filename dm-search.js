// =====================================================================
// THE WAYWARD COMPANY — DM Global Search (Cmd-K modal)
// ---------------------------------------------------------------------
// Loads data/search-index.json once on init. Cmd/Ctrl-K opens a modal
// with a search input; typing live-filters entries. Results grouped by
// type. Click a result to open a detail modal with content + "Open in
// Obsidian" deep-link (obsidian:// URL scheme).
//
// Vault only — repo catalogs (spells/items) not indexed in this pass.
//
// Public API:
//   DMSearch.init()   — call once on unlock
//   DMSearch.open()   — programmatic open
// =====================================================================

(function() {
  'use strict';

  const INDEX_URL = 'data/search-index.json';
  const OBSIDIAN_VAULT_NAME = 'Discovery D_D';
  const VAULT_PREFIX = 'Eldoria 2.0/';

  const TYPE_LABELS = {
    npc:            '👤 NPCs',
    pc:             '⚔ Party',
    location:       '🏛 Locations',
    plot:           '🎯 Plot Threads',
    faction:        '🏴 Factions',
    item:           '⚡ Items & Artifacts',
    'lore-fact':    '📜 Lore Facts',
    'session-recap':'📖 Session Recaps',
    'session-prep': '📋 Session Prep',
    monster:        '👹 Bestiary',
    pantheon:       '✨ Pantheon',
    lore:           '📚 Lore & Legends',
    history:        '🕰 History',
    meta:           '⚙ Meta',
  };
  const TYPE_ORDER = [
    'npc', 'pc', 'location', 'plot', 'faction', 'item', 'monster',
    'lore-fact', 'session-recap', 'session-prep', 'pantheon', 'lore', 'history', 'meta'
  ];

  let _index = [];
  let _loaded = false;
  let _dialog = null;
  let _input = null;
  let _resultsEl = null;

  function load() {
    if (_loaded) return Promise.resolve();
    return fetch(INDEX_URL + '?_=' + Date.now())
      .then(r => r.ok ? r.json() : { entries: [] })
      .then(data => {
        _index = data.entries || [];
        _loaded = true;
      })
      .catch(err => {
        console.warn('[DMSearch] Failed to load index:', err);
      });
  }

  function makeDialog() {
    if (_dialog) return;
    const html =
      '<dialog id="dm-search-dialog" style="max-width:820px;width:90vw;max-height:80vh;padding:0;border:1px solid var(--gold2);background:linear-gradient(180deg,#1a1208,#0d0a06);color:var(--parch1);border-radius:6px;box-shadow:0 20px 60px rgba(0,0,0,0.7)">' +
        '<div style="padding:.85rem 1rem;border-bottom:1px solid rgba(160,128,64,0.35);display:flex;align-items:center;gap:.6rem">' +
          '<span style="font-size:16px">🔍</span>' +
          '<input id="dm-search-input" type="text" placeholder="Search everything — NPCs, locations, sessions, lore…" style="flex:1;background:transparent;border:none;color:var(--parch1);font-family:\'Crimson Pro\',serif;font-size:16px;outline:none">' +
          '<span style="font-size:10px;letter-spacing:1px;color:var(--parch4);font-family:\'Cinzel\',serif">Esc to close</span>' +
        '</div>' +
        '<div id="dm-search-results" style="overflow-y:auto;max-height:70vh;padding:.5rem 0"></div>' +
      '</dialog>';
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    document.body.appendChild(wrapper.firstChild);
    _dialog = document.getElementById('dm-search-dialog');
    _input = document.getElementById('dm-search-input');
    _resultsEl = document.getElementById('dm-search-results');
    _input.addEventListener('input', function() { render(_input.value); });
    _dialog.addEventListener('close', function() { _input.value = ''; });
    _dialog.addEventListener('click', function(e) {
      if (e.target === _dialog) _dialog.close();  // click backdrop to close
    });
  }

  function scoreEntry(entry, q) {
    const t = (entry.title || '').toLowerCase();
    const b = (entry.body || '').toLowerCase();
    const tags = (entry.tags || []).join(' ').toLowerCase();
    let score = 0;
    if (t === q) score += 100;
    else if (t.indexOf(q) === 0) score += 60;
    else if (t.indexOf(q) >= 0) score += 40;
    if (tags.indexOf(q) >= 0) score += 15;
    if (b.indexOf(q) >= 0) score += 10;
    return score;
  }

  function render(rawQuery) {
    if (!_resultsEl) return;
    const q = String(rawQuery || '').trim().toLowerCase();
    if (!q) {
      _resultsEl.innerHTML = '<div style="padding:1.5rem;text-align:center;color:var(--parch4);font-style:italic">Type to search across ' + _index.length + ' vault entries.</div>';
      return;
    }
    const matches = [];
    for (let i = 0; i < _index.length; i++) {
      const e = _index[i];
      const s = scoreEntry(e, q);
      if (s > 0) matches.push({ e: e, s: s });
    }
    if (!matches.length) {
      _resultsEl.innerHTML = '<div style="padding:1.5rem;text-align:center;color:var(--parch4);font-style:italic">No matches for "' + escapeHtml(rawQuery) + '".</div>';
      return;
    }
    matches.sort(function(a, b) { return b.s - a.s || a.e.title.localeCompare(b.e.title); });
    // Group by type in TYPE_ORDER order
    const byType = {};
    matches.forEach(function(m) { (byType[m.e.type] = byType[m.e.type] || []).push(m.e); });
    let html = '';
    TYPE_ORDER.forEach(function(t) {
      const list = byType[t];
      if (!list || !list.length) return;
      html += '<div style="padding:.35rem 1rem;font-family:\'Cinzel\',serif;font-size:10px;letter-spacing:1.5px;color:var(--gold2);background:rgba(0,0,0,0.3);border-top:1px solid rgba(160,128,64,0.15)">' + escapeHtml(TYPE_LABELS[t] || t) + ' <span style="opacity:.6">· ' + list.length + '</span></div>';
      list.slice(0, 12).forEach(function(entry) {
        const snippet = entry.body ? entry.body.slice(0, 180) + (entry.body.length > 180 ? '…' : '') : '';
        const obsidianUrl = buildObsidianUrl(entry.path);
        html += '<div class="dm-search-result" data-path="' + escapeAttr(entry.path) + '" style="padding:.6rem 1rem;cursor:pointer;border-bottom:1px solid rgba(160,128,64,0.1);transition:background .12s">' +
          '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:.75rem">' +
            '<div style="font-family:\'Cinzel\',serif;color:var(--gold2);font-size:13px;font-weight:600">' + escapeHtml(entry.title) + '</div>' +
            '<a href="' + escapeAttr(obsidianUrl) + '" onclick="event.stopPropagation()" style="font-size:10px;color:var(--parch3);text-decoration:none;font-family:\'Cinzel\',serif;letter-spacing:.5px;flex-shrink:0" title="Open in Obsidian">🔗 Obsidian</a>' +
          '</div>' +
          (snippet ? '<div style="font-size:11.5px;color:var(--parch3);line-height:1.5;margin-top:.2rem">' + escapeHtml(snippet) + '</div>' : '') +
          '<div style="font-size:10px;color:var(--parch4);margin-top:.2rem;font-style:italic">📄 ' + escapeHtml(entry.path) + '</div>' +
        '</div>';
      });
      if (list.length > 12) {
        html += '<div style="padding:.35rem 1rem;font-size:10px;color:var(--parch4);font-style:italic;text-align:center">+ ' + (list.length - 12) + ' more — refine your query</div>';
      }
    });
    _resultsEl.innerHTML = html;
    _resultsEl.querySelectorAll('.dm-search-result').forEach(function(el) {
      el.addEventListener('mouseover', function() { el.style.background = 'rgba(160,128,64,0.1)'; });
      el.addEventListener('mouseout',  function() { el.style.background = ''; });
      el.addEventListener('click', function() {
        const path = el.getAttribute('data-path');
        openDetailModal(path);
      });
    });
  }

  function buildObsidianUrl(relPath) {
    // Obsidian's URL scheme: obsidian://open?vault=NAME&file=PATH
    // Path is vault-relative WITHOUT the .md extension.
    const p = String(relPath || '').replace(/\.md$/i, '');
    const full = VAULT_PREFIX + p;
    return 'obsidian://open?vault=' + encodeURIComponent(OBSIDIAN_VAULT_NAME) + '&file=' + encodeURIComponent(full);
  }

  function openDetailModal(relPath) {
    const entry = _index.find(function(e) { return e.path === relPath; });
    if (!entry) return;
    // Compact detail overlay — reuses the search dialog by rewriting content
    const obsidianUrl = buildObsidianUrl(entry.path);
    const tags = (entry.tags || []).map(function(t) { return '<span style="background:rgba(160,128,64,0.15);color:var(--gold2);border:1px solid rgba(160,128,64,0.35);padding:2px 8px;border-radius:2px;font-size:10px;font-family:\'Cinzel\',serif;letter-spacing:.5px;margin-right:.25rem">' + escapeHtml(t) + '</span>'; }).join('');
    _resultsEl.innerHTML =
      '<div style="padding:1rem 1.25rem 1.5rem">' +
        '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:.75rem;margin-bottom:.4rem">' +
          '<div style="font-family:\'Cinzel\',serif;color:var(--gold2);font-size:16px;font-weight:700">' + escapeHtml(entry.title) + '</div>' +
          '<a href="' + escapeAttr(obsidianUrl) + '" style="font-size:11px;color:var(--parch2);text-decoration:none;font-family:\'Cinzel\',serif;letter-spacing:1px;border:1px solid var(--gold2);padding:3px 10px;border-radius:2px" title="Open in Obsidian">🔗 Open in Obsidian ↗</a>' +
        '</div>' +
        '<div style="font-size:11px;color:var(--parch4);margin-bottom:.5rem;font-style:italic">📄 ' + escapeHtml(entry.path) + ' &nbsp;·&nbsp; ' + escapeHtml(TYPE_LABELS[entry.type] || entry.type) + '</div>' +
        (tags ? '<div style="margin-bottom:.75rem">' + tags + '</div>' : '') +
        '<div style="font-size:13px;line-height:1.65;color:var(--parch2);white-space:pre-wrap">' + escapeHtml(entry.body || '(no excerpt — open in Obsidian for full content)') + '</div>' +
        '<div style="margin-top:.85rem;text-align:right"><button onclick="DMSearch.backToResults()" style="background:transparent;border:1px solid var(--parch3);color:var(--parch3);padding:4px 12px;border-radius:2px;font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:1px;cursor:pointer">← Back to results</button></div>' +
      '</div>';
  }

  function backToResults() {
    render(_input.value);
    _input.focus();
  }

  function open() {
    load().then(function() {
      makeDialog();
      if (_dialog.showModal) _dialog.showModal();
      else _dialog.setAttribute('open', '');
      _input.value = '';
      render('');
      setTimeout(function() { _input.focus(); }, 30);
    });
  }

  function init() {
    // Load index in the background
    load();
    // Cmd/Ctrl-K to open
    document.addEventListener('keydown', function(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        open();
      }
    });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escapeAttr(s) { return escapeHtml(s).replace(/'/g, '&#39;'); }

  window.DMSearch = { init: init, open: open, backToResults: backToResults };
})();
