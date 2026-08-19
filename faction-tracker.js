// =====================================================================
// THE WAYWARD COMPANY — FACTION REPUTATION TRACKER (Update 23)
// ---------------------------------------------------------------------
// Firebase-synced reputation scores for the six major campaign factions.
// Scale: -3 (Hostile) to +3 (Allied), 0 = Neutral.
//
// Rendered as a compact widget in the DM header + a full detail panel
// under the Clock tab with click-to-adjust and history log.
//
// State at Firebase /faction-reputation:
//   {
//     scores: { naturus: -2, guilded_veil: -3, ... },
//     history: [ { faction, delta, reason, when } ],
//     updatedAt: ts
//   }
// =====================================================================
(function() {
  'use strict';

  const PATH = 'faction-reputation';

  const FACTIONS = [
    { id: 'naturus',      name: 'Naturus Cult',        color: '#7fb069', short: 'NAT'  },
    { id: 'guilded_veil', name: 'Guilded Veil',        color: '#b48ec3', short: 'VEIL' },
    { id: 'temple',       name: 'Temple of Luminos',   color: '#e0c060', short: 'LUM'  },
    { id: 'halvor',       name: 'Halvor Compound',     color: '#c67f3f', short: 'HALV' },
    { id: 'council',      name: 'Aeloria Council',     color: '#7fa8d0', short: 'COUN' },
    { id: 'watch',        name: 'City Watch',          color: '#a89060', short: 'WATCH'}
  ];

  const TIER_LABELS = {
    '-3': 'Hostile',    '-2': 'Suspicious', '-1': 'Wary',
     '0': 'Neutral',
     '1': 'Warming',    '2': 'Friendly',    '3': 'Allied'
  };
  const TIER_COLORS = {
    '-3': '#f47070', '-2': '#e08a5a', '-1': '#e0c060',
     '0': '#a0a0a0',
     '1': '#c0d980', '2': '#7fdb7f', '3': '#5fbfff'
  };

  const FT = {
    _ref: null,
    _state: null,

    init: function() { this._initSync(); this._mountHeader(); },

    _initSync: function() {
      const self = this;
      if (typeof firebase === 'undefined' || !firebase.database) {
        this._state = this._defaultState();
        this._render();
        return;
      }
      try {
        this._ref = firebase.database().ref(PATH);
        this._ref.on('value', function(snap) {
          const val = snap.val();
          self._state = val || self._defaultState();
          if (!self._state.scores) self._state.scores = self._defaultState().scores;
          self._render();
        });
      } catch (e) { console.warn('[FactionTracker] Sync failed:', e); }
    },

    _defaultState: function() {
      // Sensible defaults given Session 5 party state.
      return {
        scores: { naturus: -2, guilded_veil: -3, temple: 1, halvor: -2, council: 0, watch: 0 },
        history: [], updatedAt: 0
      };
    },

    _mountHeader: function() {
      // Insert compact widget after #status-lich in the top status bar.
      const lich = document.getElementById('status-lich');
      if (!lich) return;
      const container = lich.closest('.status-bar, .status-row, div') || lich.parentElement;
      if (!container) return;
      if (document.getElementById('faction-header-widget')) return;
      const w = document.createElement('span');
      w.id = 'faction-header-widget';
      w.style.cssText = 'display:inline-flex;gap:4px;align-items:center;margin-left:1rem;cursor:pointer';
      w.title = 'Click to open faction reputation panel';
      w.addEventListener('click', function() { FT._openPanel(); });
      lich.insertAdjacentElement('afterend', w);
      this._renderHeader();
    },

    _renderHeader: function() {
      const w = document.getElementById('faction-header-widget');
      if (!w || !this._state) return;
      const scores = this._state.scores || {};
      w.innerHTML = FACTIONS.map(function(f) {
        const s = scores[f.id] || 0;
        const c = TIER_COLORS[String(s)] || '#a0a0a0';
        return '<span title="' + f.name + ' — ' + (TIER_LABELS[String(s)] || 'Neutral') + ' (' + (s>0?'+':'') + s + ')" ' +
          'style="display:inline-block;padding:1px 5px;background:' + c + '20;color:' + c + ';border:1px solid ' + c + ';border-radius:2px;font-family:Cinzel,serif;font-size:9px;letter-spacing:1px">' + f.short + ' ' + (s>0?'+':'') + s + '</span>';
      }).join('');
    },

    _render: function() {
      this._renderHeader();
      const panel = document.getElementById('faction-panel-body');
      if (panel) this._renderPanel();
    },

    _openPanel: function() {
      let dlg = document.getElementById('faction-dialog');
      if (!dlg) {
        dlg = document.createElement('dialog');
        dlg.id = 'faction-dialog';
        dlg.style.cssText = 'max-width:640px;width:92vw;max-height:88vh;padding:0;border:1px solid var(--gold2);background:#0d0a06;color:var(--parch1);border-radius:6px';
        dlg.innerHTML =
          '<div style="padding:.75rem 1rem;border-bottom:1px solid var(--gold2);display:flex;justify-content:space-between;align-items:center">' +
            '<div style="font-family:Cinzel,serif;color:var(--gold2)">🤝 Faction Reputation</div>' +
            '<button onclick="this.closest(\'dialog\').close()" style="background:transparent;border:1px solid var(--parch3);color:var(--parch3);padding:4px 10px;border-radius:2px;cursor:pointer;font-family:Cinzel,serif;font-size:11px">Close</button>' +
          '</div>' +
          '<div id="faction-panel-body" style="padding:1rem;overflow-y:auto;max-height:78vh"></div>';
        document.body.appendChild(dlg);
        dlg.addEventListener('click', function(e) { if (e.target === dlg) dlg.close(); });
      }
      this._renderPanel();
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    },

    _renderPanel: function() {
      const body = document.getElementById('faction-panel-body');
      if (!body || !this._state) return;
      const scores = this._state.scores || {};
      const history = (this._state.history || []).slice().reverse();
      let html = '<div style="display:grid;grid-template-columns:1fr;gap:.6rem">';
      FACTIONS.forEach(function(f) {
        const s = scores[f.id] || 0;
        const c = TIER_COLORS[String(s)] || '#a0a0a0';
        const label = TIER_LABELS[String(s)] || 'Neutral';
        html += '<div style="border:1px solid var(--gold2);border-radius:4px;padding:.5rem .75rem;background:rgba(20,14,6,0.4)">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem">' +
            '<div><div style="font-family:Cinzel,serif;color:' + f.color + ';font-size:13px">' + f.name + '</div>' +
            '<div style="font-size:11px;color:var(--parch3)">' + label + '</div></div>' +
            '<div style="display:flex;gap:.35rem;align-items:center">' +
              '<button onclick="if(window.FactionTracker) FactionTracker._promptAdjust(\'' + f.id + '\', -1)" style="background:transparent;border:1px solid #a02020;color:#e0a0a0;padding:2px 10px;border-radius:2px;cursor:pointer;font-family:Cinzel,serif;font-size:11px">−1</button>' +
              '<div style="min-width:60px;text-align:center;font-family:Cinzel,serif;color:' + c + ';font-size:16px">' + (s>0?'+':'') + s + '</div>' +
              '<button onclick="if(window.FactionTracker) FactionTracker._promptAdjust(\'' + f.id + '\', 1)" style="background:transparent;border:1px solid #40a040;color:#a0e0a0;padding:2px 10px;border-radius:2px;cursor:pointer;font-family:Cinzel,serif;font-size:11px">+1</button>' +
            '</div>' +
          '</div>' +
          // Bar
          '<div style="margin-top:.5rem;display:flex;gap:2px">' +
            [-3,-2,-1,0,1,2,3].map(function(t) {
              const active = (t <= s && s >= 0 && t >= 0) || (t >= s && s <= 0 && t <= 0);
              const clr = TIER_COLORS[String(t)];
              return '<div style="flex:1;height:6px;background:' + (active ? clr : 'rgba(160,128,64,0.15)') + ';border-radius:1px" title="' + (t>0?'+':'') + t + ' — ' + TIER_LABELS[String(t)] + '"></div>';
            }).join('') +
          '</div>' +
        '</div>';
      });
      html += '</div>';
      html += '<div style="margin-top:1rem;font-family:Cinzel,serif;font-size:10px;color:var(--gold2);letter-spacing:1.5px">RECENT HISTORY (last 15)</div>';
      if (history.length) {
        html += '<div style="max-height:220px;overflow-y:auto;margin-top:.4rem;font-size:11.5px">';
        history.slice(0, 15).forEach(function(h) {
          const f = FACTIONS.find(function(x) { return x.id === h.faction; }) || { name: h.faction, color: '#a0a0a0' };
          const d = new Date(h.when || 0);
          const when = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          html += '<div style="padding:.3rem 0;border-top:1px dashed rgba(160,128,64,0.2)">' +
            '<span style="color:' + f.color + '">' + f.name + '</span> ' +
            '<span style="color:' + (h.delta > 0 ? '#7fdb7f' : '#f47070') + ';font-family:Cinzel,serif">' + (h.delta > 0 ? '+' : '') + h.delta + '</span> · ' +
            '<span style="color:var(--parch3)">' + when + '</span><br>' +
            '<span style="color:var(--parch2);font-style:italic">' + (h.reason || '(no reason given)') + '</span></div>';
        });
        html += '</div>';
      } else {
        html += '<div style="margin-top:.4rem;font-size:11px;color:var(--parch3);font-style:italic">No adjustments yet.</div>';
      }
      body.innerHTML = html;
    },

    _promptAdjust: function(factionId, delta) {
      const f = FACTIONS.find(function(x) { return x.id === factionId; });
      const reason = prompt('Reason for ' + (delta > 0 ? '+' : '') + delta + ' to ' + f.name + '?\n\n(e.g. "helped Sera find Mira", "attacked Watch officer")', '');
      if (reason === null) return;
      const cur = this._state ? JSON.parse(JSON.stringify(this._state)) : this._defaultState();
      cur.scores = cur.scores || {};
      const current = cur.scores[factionId] || 0;
      const next = Math.max(-3, Math.min(3, current + delta));
      if (next === current) { alert('Already at ' + (current > 0 ? '+' : '') + current + ' (max/min).'); return; }
      cur.scores[factionId] = next;
      cur.history = cur.history || [];
      cur.history.push({ faction: factionId, delta: delta, reason: reason, when: Date.now() });
      if (cur.history.length > 100) cur.history = cur.history.slice(-100);
      cur.updatedAt = Date.now();
      this._write(cur);
    },

    _write: function(state) {
      const clean = JSON.parse(JSON.stringify(state));
      if (!this._ref) { this._state = clean; this._render(); return; }
      this._ref.set(clean).catch(function(e) { console.warn('[FactionTracker] Write failed:', e); });
    }
  };

  window.FactionTracker = FT;

  function trySelf() {
    if (document.getElementById('status-lich')) { FT.init(); return true; }
    return false;
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(trySelf, 300); setTimeout(trySelf, 1500);
    });
  } else {
    setTimeout(trySelf, 300); setTimeout(trySelf, 1500);
  }
})();
