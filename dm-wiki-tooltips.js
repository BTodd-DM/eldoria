// =====================================================================
// THE WAYWARD COMPANY — DM Wiki-link tooltips
// ---------------------------------------------------------------------
// Scans DM-site text nodes for known names (NPCs, Locations, Factions,
// Items, Plot Threads, Monsters) from data/search-index.json. Wraps
// matches in a small interactive span. Hover pops a tooltip with the
// entity's type + brief body + "Open in Obsidian" link.
//
// Skip zones: form inputs, buttons, textareas, existing links, script
// output, and any element with class `no-wiki`.
//
// Public API:
//   DMWikiTips.init()
//   DMWikiTips.scan(rootEl)  — call after any innerHTML re-render
// =====================================================================

(function() {
  'use strict';

  const INDEX_URL = 'data/search-index.json';
  const OBSIDIAN_VAULT_NAME = 'Discovery D_D';
  const VAULT_PREFIX = 'Eldoria 2.0/';
  // Which types are worth tooltipping. Lore-facts / session-recaps have long
  // title strings that are unlikely to appear in prose — skip.
  const ELIGIBLE_TYPES = new Set(['npc', 'location', 'faction', 'item', 'plot', 'monster', 'pc']);
  const TYPE_ICONS = {
    npc: '👤', pc: '⚔', location: '🏛', faction: '🏴',
    item: '⚡', plot: '🎯', monster: '👹'
  };

  // Names shorter than this are ignored (too ambiguous — "Bram", "Cor").
  const MIN_NAME_LEN = 4;

  let _entries = [];
  let _byTitle = {};        // { titleLower: entry }
  let _names = [];          // sorted longest-first for greedy matching
  let _tooltip = null;
  let _hoverTimer = null;
  let _loaded = false;

  function load() {
    if (_loaded) return Promise.resolve();
    return fetch(INDEX_URL + '?_=' + Date.now())
      .then(r => r.ok ? r.json() : { entries: [] })
      .then(data => {
        _entries = (data.entries || []).filter(e => ELIGIBLE_TYPES.has(e.type));
        _entries.forEach(e => { _byTitle[e.title.toLowerCase()] = e; });
        _names = _entries
          .map(e => e.title)
          .filter(t => t.length >= MIN_NAME_LEN)
          .sort((a, b) => b.length - a.length);
        _loaded = true;
      })
      .catch(err => console.warn('[WikiTips] Failed to load index:', err));
  }

  function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // Build one big regex from all names, honouring word boundaries where possible.
  let _namesRegex = null;
  function ensureRegex() {
    if (_namesRegex || !_names.length) return _namesRegex;
    const alt = _names.map(escapeRegex).join('|');
    // Word-boundary on each side. Names with punctuation still work via alt list.
    _namesRegex = new RegExp('\\b(' + alt + ')\\b', 'g');
    return _namesRegex;
  }

  // Recursively walk text nodes, replacing name mentions with wiki-tip spans.
  function scanNode(root) {
    if (!root || !ensureRegex()) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function(n) {
        if (!n.nodeValue || n.nodeValue.length < MIN_NAME_LEN) return NodeFilter.FILTER_REJECT;
        const p = n.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        // Skip zones
        const tag = p.tagName;
        if (tag === 'A' || tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA' ||
            tag === 'SCRIPT' || tag === 'STYLE' || tag === 'CODE' || tag === 'PRE' ||
            tag === 'OPTION' || tag === 'SUMMARY') return NodeFilter.FILTER_REJECT;
        if (p.classList && (p.classList.contains('no-wiki') || p.classList.contains('wiki-tip'))) return NodeFilter.FILTER_REJECT;
        if (p.closest && p.closest('.wiki-tip, .no-wiki, input, textarea, button, a')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const toReplace = [];
    let n;
    while ((n = walker.nextNode())) {
      if (_namesRegex.test(n.nodeValue)) {
        _namesRegex.lastIndex = 0;
        toReplace.push(n);
      }
    }
    toReplace.forEach(replaceInTextNode);
  }

  function replaceInTextNode(textNode) {
    const text = textNode.nodeValue;
    const parent = textNode.parentNode;
    if (!parent) return;
    _namesRegex.lastIndex = 0;
    let lastIndex = 0;
    let m;
    const frag = document.createDocumentFragment();
    let hits = 0;
    while ((m = _namesRegex.exec(text))) {
      if (m.index > lastIndex) frag.appendChild(document.createTextNode(text.slice(lastIndex, m.index)));
      const span = document.createElement('span');
      span.className = 'wiki-tip';
      span.setAttribute('data-title', m[1]);
      span.textContent = m[1];
      frag.appendChild(span);
      lastIndex = m.index + m[1].length;
      hits++;
      if (hits > 40) break;  // safety: don't blow up on huge blobs
    }
    if (!hits) return;
    if (lastIndex < text.length) frag.appendChild(document.createTextNode(text.slice(lastIndex)));
    parent.replaceChild(frag, textNode);
  }

  function ensureTooltipEl() {
    if (_tooltip) return _tooltip;
    _tooltip = document.createElement('div');
    _tooltip.className = 'wiki-tooltip';
    _tooltip.style.cssText = 'position:fixed;z-index:9999;max-width:360px;background:linear-gradient(180deg,#1a1208,#0d0a06);border:1px solid var(--gold2,#c9a84c);border-radius:4px;padding:.7rem .85rem;color:var(--parch1,#f4edd8);box-shadow:0 8px 24px rgba(0,0,0,0.6);font-family:\'Crimson Pro\',serif;font-size:12.5px;line-height:1.55;pointer-events:none;display:none';
    document.body.appendChild(_tooltip);
    return _tooltip;
  }

  function showTip(target) {
    const title = target.getAttribute('data-title');
    if (!title) return;
    const entry = _byTitle[title.toLowerCase()];
    if (!entry) return;
    const el = ensureTooltipEl();
    const icon = TYPE_ICONS[entry.type] || '·';
    const obsidianUrl = 'obsidian://open?vault=' + encodeURIComponent(OBSIDIAN_VAULT_NAME) +
      '&file=' + encodeURIComponent(VAULT_PREFIX + entry.path.replace(/\.md$/i, ''));
    const body = (entry.body || '').slice(0, 220) + ((entry.body || '').length > 220 ? '…' : '');
    el.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:.5rem;margin-bottom:.3rem">' +
        '<div><span style="font-size:14px;margin-right:.3rem">' + icon + '</span>' +
        '<strong style="font-family:\'Cinzel\',serif;color:var(--gold2,#c9a84c);font-size:13px">' + escapeHtml(entry.title) + '</strong></div>' +
        '<span style="font-size:9px;letter-spacing:1px;color:var(--parch4,#a89873);font-family:\'Cinzel\',serif;text-transform:uppercase">' + escapeHtml(entry.type) + '</span>' +
      '</div>' +
      (body ? '<div style="color:var(--parch2,#ebe0c4)">' + escapeHtml(body) + '</div>' : '') +
      '<div style="margin-top:.35rem;font-size:10px;color:var(--parch4,#a89873);font-style:italic">📄 ' + escapeHtml(entry.path) + ' &nbsp;·&nbsp; Cmd/Ctrl-K to search</div>';
    el.style.display = 'block';
    positionTip(target);
  }

  function positionTip(target) {
    if (!_tooltip) return;
    const rect = target.getBoundingClientRect();
    const tw = _tooltip.offsetWidth;
    const th = _tooltip.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = rect.left;
    let top = rect.bottom + 6;
    if (left + tw > vw - 12) left = vw - tw - 12;
    if (top + th > vh - 12) top = rect.top - th - 6;
    if (left < 8) left = 8;
    if (top < 8) top = 8;
    _tooltip.style.left = left + 'px';
    _tooltip.style.top = top + 'px';
  }

  function hideTip() {
    if (_tooltip) _tooltip.style.display = 'none';
  }

  function wireHover() {
    document.addEventListener('mouseover', function(e) {
      const target = e.target.closest ? e.target.closest('.wiki-tip') : null;
      if (!target) return;
      clearTimeout(_hoverTimer);
      _hoverTimer = setTimeout(function() { showTip(target); }, 150);
    });
    document.addEventListener('mouseout', function(e) {
      const target = e.target.closest ? e.target.closest('.wiki-tip') : null;
      if (!target) return;
      clearTimeout(_hoverTimer);
      _hoverTimer = setTimeout(hideTip, 100);
    });
  }

  function scan(root) {
    if (!_loaded) return;
    scanNode(root || document.getElementById('app') || document.body);
  }

  function init() {
    // Inject CSS once
    if (!document.getElementById('wiki-tips-css')) {
      const s = document.createElement('style');
      s.id = 'wiki-tips-css';
      s.textContent = '.wiki-tip { border-bottom: 1px dotted var(--gold2, #c9a84c); cursor: help; }';
      document.head.appendChild(s);
    }
    wireHover();
    load().then(function() {
      // Initial full-page scan
      scan(document.getElementById('app') || document.body);
    });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  window.DMWikiTips = { init: init, scan: scan };
})();
