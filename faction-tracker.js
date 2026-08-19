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

    init: function() { this._initSync(); this._initDetailsSync(); this._mountHeader(); },

    _initDetailsSync: function() {
      if (typeof firebase === 'undefined' || !firebase.database) {
        this._details = this._defaultDetails();
        return;
      }
      const self = this;
      try {
        this._detailsRef = firebase.database().ref('faction-details');
        this._detailsRef.on('value', function(snap) {
          const v = snap.val() || {};
          // Merge with defaults so any missing faction still has a skeleton.
          const defaults = self._defaultDetails();
          self._details = Object.assign({}, defaults, v);
        });
      } catch (e) { console.warn('[FactionTracker] Details sync failed:', e); }
    },

    _defaultDetails: function() {
      // Skeletons — Bradley fills tier text + renown from his DMG later.
      // Overview / status pulled from what's currently visible in the vault
      // and DM Working Notes as best I can seed. Edit anything in the DM
      // detail panel and it saves back to /faction-details/<id>.
      return {
        naturus: {
          overview: 'Cult of the Rotting Entropy. Sister Kaelith operates the visible cell in Aeloria. Naturus-corruption bleeds through the Frostwood Marsh interior. Their unfinished child, Vroth-Khorn, lies bound beneath the marsh.',
          currentStatus: 'Active hostile — the party knows about the shrine and Kaelith. Instability Clock 2/8. Rot is spreading.',
          keyMembers: 'Sister Kaelith · gnoll den pack leader (charmed) · marsh cult cells',
          assets: 'Frostwood Marsh interior sites · Aeloria back-alley shrines · Pig\'s Head Inn back room (through the "K" note)',
          perPcReactions: { sylas: '(fill in)', orin: '(fill in)', torren: '(fill in)' },
          tiers: {},   // Bradley fills from DMG
          renown: {}   // Bradley fills from DMG
        },
        guilded_veil: {
          overview: 'Trans-regional criminal / political influence network. Wears the veil of legitimate merchant guilds. Rulden Marr (formerly Merric Underbough, formerly Luminar of Luminos) is a Veilmaster.',
          currentStatus: 'Active hostile — Rulden sent Orin a cold warning; Torren is sworn to their service through Vrass; assassin-couriers active on the Aelorian roads.',
          keyMembers: 'Rulden Marr (Veilmaster, Orin\'s adoptive father) · Vrass (Torren\'s bond-holder) · Wenzel "The Kite" Tosscobble (Stonegate cell leader)',
          assets: 'Cells in every major settlement · courier network · Guilded Veil markers/tokens',
          perPcReactions: {
            sylas: '(fill in — unclear whether they know about Lich Initiate; Vaeloran\'s network may run intel through Veil channels)',
            orin: 'Complex — his adoptive father is a Veilmaster. Personal rather than institutional.',
            torren: 'Owned. Sworn service to Vrass. The Veil pays and protects him — always has.'
          },
          tiers: {},
          renown: {}
        },
        temple: {
          overview: 'Temple of Luminos. Public authority in Aeloria; suppressed in the Aurum Dominion. High Priest Alric Dawnveil senses the city is off but has not identified Vaeloran.',
          currentStatus: 'Cautiously supportive — Orin is a cleric of Luminos, Seraphine has counselled him; Alric knows Orin exists via Seraphine.',
          keyMembers: 'High Priest Alric Dawnveil · Dawnwarden Seraphine Vale · lower clergy in every city',
          assets: 'Temple of Luminos in Aeloria Crossroads · shrines across the Aelorian Territories · sanctuary rights',
          perPcReactions: {
            sylas: '(fill in — Sylas\'s Aurum curse-lines mark him publicly; Temple may treat him with wary compassion)',
            orin: 'One of their own. Trusted by Seraphine, tolerated by Alric until proven otherwise.',
            torren: '(fill in — halfling assassin ex-Watch turned Veil operative; Temple would not extend trust)'
          },
          tiers: {},
          renown: {}
        },
        halvor: {
          overview: 'Halvor\'s Ironhold compound — organised crime front operating out of foundry and warehouse holdings. Front-house legitimate, back-house trafficking, kidnap, extortion. Holds Mira and her children.',
          currentStatus: 'Active hostile — party is coming for Mira. Halvor does not yet know the party is a threat.',
          keyMembers: 'Master Halvor · compound bruisers · assassin contract talent · unknown Ironhold Watch collaborators',
          assets: 'Compound (foundry, warehouse, back-house) · Ironhold Watch patrols on his payroll · northern trade routes',
          perPcReactions: {
            sylas: '(fill in)', orin: '(fill in)', torren: '(fill in — ex-Watch, could be recognised)'
          },
          tiers: {},
          renown: {}
        },
        council: {
          overview: 'Aeloria Council. Nominally the elected/appointed civic body governing Aeloria Crossroads. Vaeloran carries weight here as a respected scholar-mage and patron.',
          currentStatus: 'Neutral — party has had no direct dealings. Council knows nothing of Vaeloran\'s true nature.',
          keyMembers: 'Various councillors (to be developed) · Vaeloran Duskwhisper as major patron / advisor',
          assets: 'Council chamber and clerks · civic writs · relationship with the Watch',
          perPcReactions: { sylas: '(fill in)', orin: '(fill in)', torren: '(fill in)' },
          tiers: {},
          renown: {}
        },
        watch: {
          overview: 'City Watch — Aeloria has an honest core, Ironhold\'s has been substantially compromised by Halvor. Stonegate Watch (Torren\'s former unit) is disciplined but distant from party operations.',
          currentStatus: 'Neutral in Aeloria; hostile / compromised in Ironhold.',
          keyMembers: 'Captain Rikhardt Vall (Stonegate — Torren\'s former CO) · Sergeant Nell Vissen (Stonegate) · Ironhold Watch officers (unnamed, Halvor-tied)',
          assets: 'Uniformed presence in every city · authority to detain · custody of the northern gates',
          perPcReactions: {
            sylas: '(fill in)',
            orin: 'Clergy grants some deference; not automatic trust.',
            torren: 'Discharged in disgrace at Stonegate. Vall did not protect him. Any Watch encounter is fraught.'
          },
          tiers: {},
          renown: {}
        }
      };
    },

    saveDetail: function(factionId, patch) {
      if (!this._detailsRef) { alert('Firebase unavailable.'); return; }
      const cur = Object.assign({}, this._details[factionId] || {}, patch);
      this._detailsRef.child(factionId).set(cur).catch(function(e) {
        alert('Save failed: ' + (e && e.message || e));
      });
    },

    _openFactionDetail: function(factionId) {
      const f = FACTIONS.find(function(x) { return x.id === factionId; });
      if (!f) return;
      const d = (this._details && this._details[factionId]) || {};
      let dlg = document.getElementById('faction-detail-dialog');
      if (!dlg) {
        dlg = document.createElement('dialog');
        dlg.id = 'faction-detail-dialog';
        dlg.style.cssText = 'max-width:760px;width:94vw;max-height:90vh;padding:0;border:1px solid var(--gold2);background:#0d0a06;color:var(--parch1);border-radius:6px';
        dlg.innerHTML = '<div id="faction-detail-body"></div>';
        document.body.appendChild(dlg);
        dlg.addEventListener('click', function(e) { if (e.target === dlg) dlg.close(); });
      }
      const body = document.getElementById('faction-detail-body');
      const rec = d.perPcReactions || {};
      // Tier + renown boxes render whatever the DM has typed in; empty
      // placeholder invites them to paste from the DMG.
      const tierRows = [3,2,1,0,-1,-2,-3].map(function(t) {
        const cur = (d.tiers && d.tiers[t]) || '';
        return '<div style="display:grid;grid-template-columns:60px 1fr;gap:.5rem;margin-bottom:.35rem;align-items:start">' +
          '<div style="font-family:\'Cinzel\',serif;color:' + (t>0?'#7fdb7f':t<0?'#f47070':'#c9c9c9') + ';font-size:12px;padding-top:.35rem">' + (t>0?'+':'') + t + '</div>' +
          '<textarea data-tier="' + t + '" placeholder="(paste DMG tier text here — how NPCs of ' + f.name + ' behave at ' + (t>0?'+':'') + t + ')" style="width:100%;min-height:44px;padding:.35rem .5rem;background:rgba(10,8,5,0.6);border:1px solid rgba(160,128,64,0.4);color:var(--parch);border-radius:2px;font-family:\'Crimson Pro\',serif;font-size:12px;resize:vertical">' + escapeHtml(cur) + '</textarea>' +
        '</div>';
      }).join('');
      body.innerHTML =
        '<div style="padding:.75rem 1rem;border-bottom:1px solid var(--gold2);display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;background:#0d0a06;z-index:2">' +
          '<div style="font-family:\'Cinzel\',serif;color:' + f.color + ';font-size:15px">🤝 ' + escapeHtml(f.name) + '</div>' +
          '<button onclick="this.closest(\'dialog\').close()" style="background:transparent;border:1px solid var(--parch3);color:var(--parch3);padding:4px 10px;border-radius:2px;cursor:pointer;font-family:\'Cinzel\',serif;font-size:11px">Close</button>' +
        '</div>' +
        '<div style="padding:1rem;overflow-y:auto;max-height:80vh">' +
          '<div class="sec-title" style="margin-top:0">Overview</div>' +
          '<textarea id="fd-overview" style="width:100%;min-height:70px;padding:.4rem .5rem;background:rgba(10,8,5,0.6);border:1px solid rgba(160,128,64,0.4);color:var(--parch);border-radius:2px;font-family:\'Crimson Pro\',serif;font-size:13px;resize:vertical">' + escapeHtml(d.overview || '') + '</textarea>' +
          '<div class="sec-title" style="margin-top:.6rem">Current Status</div>' +
          '<textarea id="fd-status" style="width:100%;min-height:50px;padding:.4rem .5rem;background:rgba(10,8,5,0.6);border:1px solid rgba(160,128,64,0.4);color:var(--parch);border-radius:2px;font-family:\'Crimson Pro\',serif;font-size:13px;resize:vertical">' + escapeHtml(d.currentStatus || '') + '</textarea>' +
          '<div class="sec-title" style="margin-top:.6rem">Key Members</div>' +
          '<textarea id="fd-members" style="width:100%;min-height:50px;padding:.4rem .5rem;background:rgba(10,8,5,0.6);border:1px solid rgba(160,128,64,0.4);color:var(--parch);border-radius:2px;font-family:\'Crimson Pro\',serif;font-size:13px;resize:vertical">' + escapeHtml(d.keyMembers || '') + '</textarea>' +
          '<div class="sec-title" style="margin-top:.6rem">Assets / Reach</div>' +
          '<textarea id="fd-assets" style="width:100%;min-height:50px;padding:.4rem .5rem;background:rgba(10,8,5,0.6);border:1px solid rgba(160,128,64,0.4);color:var(--parch);border-radius:2px;font-family:\'Crimson Pro\',serif;font-size:13px;resize:vertical">' + escapeHtml(d.assets || '') + '</textarea>' +
          '<div class="sec-title" style="margin-top:.6rem">Per-PC Reaction</div>' +
          '<div style="display:grid;grid-template-columns:80px 1fr;gap:.4rem .5rem;margin-bottom:.6rem">' +
            ['sylas','orin','torren'].map(function(pc) {
              const name = pc.charAt(0).toUpperCase() + pc.slice(1);
              return '<div style="font-family:\'Cinzel\',serif;color:var(--gold2);padding-top:.35rem">' + name + '</div>' +
                '<textarea data-pc="' + pc + '" style="width:100%;min-height:38px;padding:.35rem .5rem;background:rgba(10,8,5,0.6);border:1px solid rgba(160,128,64,0.4);color:var(--parch);border-radius:2px;font-family:\'Crimson Pro\',serif;font-size:12.5px;resize:vertical">' + escapeHtml(rec[pc] || '') + '</textarea>';
            }).join('') +
          '</div>' +
          '<div class="sec-title" style="margin-top:.6rem">Tier Behaviour (DMG faction attitudes)</div>' +
          '<div class="alert alert-info" style="margin-bottom:.5rem;font-size:11.5px">Paste from your DMG the behavioural descriptor for each attitude tier — you fill; I preserve. Party sees adjusted-per-PC final tier via the reputation tracker.</div>' +
          '<div id="fd-tiers">' + tierRows + '</div>' +
          '<div class="sec-title" style="margin-top:.6rem">Renown Ranks (DMG)</div>' +
          '<textarea id="fd-renown" placeholder="One rank per line, format: threshold — Rank Name — benefits (e.g. &quot;3 — Recognised — free lodging at faction safe-houses&quot;)&#10;Copy the ranks and threshold values from your DMG faction rules." style="width:100%;min-height:120px;padding:.4rem .5rem;background:rgba(10,8,5,0.6);border:1px solid rgba(160,128,64,0.4);color:var(--parch);border-radius:2px;font-family:\'Crimson Pro\',serif;font-size:12.5px;resize:vertical">' + escapeHtml((d.renown && d.renown.raw) || '') + '</textarea>' +
          '<div style="text-align:right;margin-top:.75rem;position:sticky;bottom:0;background:#0d0a06;padding:.5rem 0;border-top:1px solid rgba(160,128,64,0.35)">' +
            '<button class="action-btn" onclick="if(window.FactionTracker) FactionTracker._saveFactionDetail(\'' + factionId + '\')" style="background:var(--gold);color:#0d0a06;border:none;padding:5px 18px;border-radius:2px;cursor:pointer;font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:1px">Save changes</button>' +
          '</div>' +
        '</div>';
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
      dlg._factionId = factionId;
    },

    _saveFactionDetail: function(factionId) {
      const g = function(id) { const el = document.getElementById(id); return el ? el.value : ''; };
      const patch = {
        overview: g('fd-overview'),
        currentStatus: g('fd-status'),
        keyMembers: g('fd-members'),
        assets: g('fd-assets'),
        perPcReactions: {},
        tiers: {},
        renown: { raw: g('fd-renown') }
      };
      document.querySelectorAll('#faction-detail-body textarea[data-pc]').forEach(function(el) {
        patch.perPcReactions[el.getAttribute('data-pc')] = el.value;
      });
      document.querySelectorAll('#fd-tiers textarea[data-tier]').forEach(function(el) {
        const t = el.getAttribute('data-tier');
        if (el.value.trim()) patch.tiers[t] = el.value;
      });
      this.saveDetail(factionId, patch);
      const dlg = document.getElementById('faction-detail-dialog');
      if (dlg && dlg.close) dlg.close();
    },

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
              '<button onclick="if(window.FactionTracker) FactionTracker._openFactionDetail(\'' + f.id + '\')" style="background:transparent;border:1px solid var(--gold2);color:var(--gold2);padding:2px 8px;border-radius:2px;cursor:pointer;font-family:Cinzel,serif;font-size:11px" title="Full detail panel — overview, tiers, renown, per-PC">📖 Details</button>' +
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

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

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
