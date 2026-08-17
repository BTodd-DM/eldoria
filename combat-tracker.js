// =====================================================================
// THE WAYWARD COMPANY — COMBAT TRACKER (Updates 17 + 25)
// ---------------------------------------------------------------------
// Firebase-synced encounter state. DM starts an encounter → all three
// PCs auto-added from CHARACTERS (uses each PC's live HP/AC from
// state via CharacterSync). DM adds monsters via ad-hoc or catalog
// picker (uses MONSTERS_2024). Sort by initiative. Track HP (two-way
// sync for PCs), conditions, concentration. Advance turn. End combat.
//
// State shape (at Firebase /combat):
//   {
//     active: bool, round: int, turnIdx: int, startedAt: ts,
//     combatants: [
//       { id, kind: 'pc'|'monster', name, initiative, ac, hp,
//         hpMax, tempHp, conditions: {}, concentrating: '',
//         monsterId, count, notes, dead }
//     ]
//   }
//
// Firebase rules: /combat open r/w (add to firebase-rules.json).
//
// Public API:
//   CombatTracker.init(containerId)
//   CombatTracker.refresh()
// =====================================================================

(function() {
  'use strict';

  const COMBAT_PATH = 'combat';
  const PC_IDS = ['torren', 'sylas', 'orin'];
  const CONDITIONS_2024 = [
    'blinded', 'charmed', 'deafened', 'frightened', 'grappled',
    'incapacitated', 'invisible', 'paralyzed', 'petrified',
    'poisoned', 'prone', 'restrained', 'stunned', 'unconscious', 'exhaustion'
  ];

  const CT = {
    _container: null,
    _ref: null,
    _state: null,

    init: function(containerId) {
      this._container = document.getElementById(containerId);
      if (!this._container) return;
      this._initSync();
    },

    refresh: function() { this._render(); },

    _initSync: function() {
      if (typeof firebase === 'undefined' || !firebase.database) {
        this._render();
        return;
      }
      const self = this;
      try {
        this._ref = firebase.database().ref(COMBAT_PATH);
        this._ref.on('value', function(snap) {
          self._state = snap.val() || null;
          self._render();
        });
      } catch (e) {
        console.warn('[CombatTracker] Sync failed:', e);
        this._render();
      }
    },

    _startCombat: function() {
      if (this._state && this._state.active) {
        if (!confirm('An encounter is already active. Restart?')) return;
      }
      const combatants = [];
      // Auto-add all three PCs
      PC_IDS.forEach(function(pcId) {
        const char = window.CHARACTERS ? CHARACTERS[pcId] : null;
        if (!char) {
          // Placeholder card if sheet not built
          combatants.push({
            id: 'pc-' + pcId + '-' + Date.now(),
            kind: 'pc', pcId: pcId,
            name: pcId.charAt(0).toUpperCase() + pcId.slice(1),
            initiative: 0, ac: '?', hp: 30, hpMax: 30, tempHp: 0,
            conditions: {}, concentrating: '', dead: false
          });
          return;
        }
        // Pull live HP if available
        let hp = char.hpMax || 30;
        try {
          if (typeof getSheetState === 'function') {
            const s = getSheetState(pcId);
            if (s && s.hp && typeof s.hp.current === 'number') hp = s.hp.current;
          }
        } catch (e) {}
        combatants.push({
          id: 'pc-' + pcId + '-' + Date.now(),
          kind: 'pc', pcId: pcId,
          name: char.name || pcId,
          initiative: 0, ac: char.ac || '?', hp: hp, hpMax: char.hpMax || hp,
          tempHp: 0, conditions: {}, concentrating: '', dead: false
        });
      });
      const state = {
        active: true, round: 1, turnIdx: 0, startedAt: Date.now(),
        combatants: combatants, log: []
      };
      this._write(state);
    },

    _endCombat: function() {
      if (!confirm('End the current encounter?\n\nA log summary will remain visible until you start a new one.')) return;
      this._write({ active: false, round: this._state ? this._state.round : 0, combatants: this._state ? this._state.combatants : [], log: this._state ? this._state.log : [], endedAt: Date.now() });
    },

    _write: function(state) {
      if (!this._ref) { this._state = state; this._render(); return; }
      this._ref.set(state).catch(function(e) { console.warn('[CombatTracker] Write failed:', e); });
    },

    _mutate: function(fn) {
      if (!this._state) return;
      // Deep-ish clone
      const next = JSON.parse(JSON.stringify(this._state));
      fn(next);
      this._write(next);
    },

    _log: function(state, msg) {
      if (!state.log) state.log = [];
      state.log.push({ t: Date.now(), r: state.round, msg: msg });
      if (state.log.length > 200) state.log = state.log.slice(-200);
    },

    _sortByInit: function(combatants) {
      combatants.sort(function(a, b) {
        const ai = Number(a.initiative || 0);
        const bi = Number(b.initiative || 0);
        if (bi !== ai) return bi - ai;
        // PCs win ties over monsters
        if (a.kind === 'pc' && b.kind !== 'pc') return -1;
        if (b.kind === 'pc' && a.kind !== 'pc') return 1;
        return 0;
      });
    },

    _advanceTurn: function() {
      const self = this;
      this._mutate(function(s) {
        if (!s.combatants || !s.combatants.length) return;
        self._sortByInit(s.combatants);
        let n = s.combatants.length;
        for (let step = 1; step <= n; step++) {
          const next = (s.turnIdx + step) % n;
          if (!s.combatants[next].dead) {
            if (next <= s.turnIdx) { s.round = (s.round || 1) + 1; self._log(s, '⏭ Round ' + s.round); }
            s.turnIdx = next;
            self._log(s, "▶ " + s.combatants[next].name + "'s turn");
            return;
          }
        }
      });
    },

    _setInitiative: function(id, val) {
      const self = this;
      const n = parseInt(val, 10);
      this._mutate(function(s) {
        const c = (s.combatants || []).find(function(x) { return x.id === id; });
        if (c) c.initiative = isNaN(n) ? 0 : n;
      });
    },

    _setHp: function(id, val) {
      const n = parseInt(val, 10);
      if (isNaN(n)) return;
      const self = this;
      this._mutate(function(s) {
        const c = (s.combatants || []).find(function(x) { return x.id === id; });
        if (!c) return;
        const prev = c.hp;
        c.hp = Math.max(0, Math.min(c.hpMax, n));
        if (c.hp <= 0 && !c.dead) { c.dead = true; self._log(s, '💀 ' + c.name + ' drops to 0'); }
        if (c.hp > 0 && c.dead) { c.dead = false; }
        if (c.kind === 'pc' && c.pcId) {
          // Two-way sync back to PC sheet
          try {
            if (typeof withSheetState === 'function') {
              withSheetState(c.pcId, function(ss) { ss.hp.current = c.hp; });
            }
          } catch (e) {}
        }
        if (prev !== c.hp) self._log(s, (c.hp > prev ? '❤' : '💥') + ' ' + c.name + ' HP ' + prev + '→' + c.hp);
      });
    },

    _damage: function(id) {
      const raw = prompt('Damage amount (positive number):');
      const dmg = parseInt(raw, 10);
      if (isNaN(dmg) || dmg <= 0) return;
      const c = (this._state.combatants || []).find(function(x) { return x.id === id; });
      if (!c) return;
      this._setHp(id, Math.max(0, c.hp - dmg));
    },

    _heal: function(id) {
      const raw = prompt('Healing amount (positive number):');
      const h = parseInt(raw, 10);
      if (isNaN(h) || h <= 0) return;
      const c = (this._state.combatants || []).find(function(x) { return x.id === id; });
      if (!c) return;
      this._setHp(id, Math.min(c.hpMax, c.hp + h));
    },

    _toggleCondition: function(id, cond) {
      const self = this;
      this._mutate(function(s) {
        const c = (s.combatants || []).find(function(x) { return x.id === id; });
        if (!c) return;
        c.conditions = c.conditions || {};
        if (c.conditions[cond]) { delete c.conditions[cond]; self._log(s, '−' + cond + ' · ' + c.name); }
        else { c.conditions[cond] = true; self._log(s, '+' + cond + ' · ' + c.name); }
      });
    },

    _setConcentration: function(id, spell) {
      const self = this;
      this._mutate(function(s) {
        const c = (s.combatants || []).find(function(x) { return x.id === id; });
        if (!c) return;
        c.concentrating = spell;
        if (spell) self._log(s, '🌀 ' + c.name + ' concentrating on ' + spell);
        else       self._log(s, '🌀 ' + c.name + ' concentration ended');
      });
    },

    _removeCombatant: function(id) {
      if (!confirm('Remove combatant?')) return;
      const self = this;
      this._mutate(function(s) {
        const idx = (s.combatants || []).findIndex(function(x) { return x.id === id; });
        if (idx < 0) return;
        self._log(s, '✕ ' + s.combatants[idx].name + ' removed');
        s.combatants.splice(idx, 1);
        if (s.turnIdx >= s.combatants.length) s.turnIdx = 0;
      });
    },

    _addAdhocMonster: function() {
      const name = prompt('Monster name:');
      if (!name || !name.trim()) return;
      const hpRaw = prompt('HP (max):', '10');
      const hp = parseInt(hpRaw, 10) || 10;
      const acRaw = prompt('AC:', '12');
      const ac = parseInt(acRaw, 10) || 12;
      const self = this;
      this._mutate(function(s) {
        s.combatants = s.combatants || [];
        s.combatants.push({
          id: 'monster-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
          kind: 'monster', name: name.trim(),
          initiative: 0, ac: ac, hp: hp, hpMax: hp, tempHp: 0,
          conditions: {}, concentrating: '', dead: false, adhoc: true
        });
        self._log(s, '+ ' + name.trim() + ' (ad-hoc, HP ' + hp + ', AC ' + ac + ')');
      });
    },

    _openMonsterPicker: function() {
      if (typeof MONSTERS_2024 === 'undefined') { alert('Monster catalog not loaded.'); return; }
      const dlg = document.getElementById('ct-monster-picker');
      if (!dlg) return;
      const listEl = document.getElementById('ct-picker-list');
      listEl.innerHTML = MONSTERS_2024.slice().sort(function(a, b) {
        return String(a.cr).localeCompare(String(b.cr)) || a.name.localeCompare(b.name);
      }).map(function(m) {
        return '<div class="ct-picker-row" data-mid="' + m.id + '" style="padding:.5rem .75rem;border-bottom:1px solid rgba(160,128,64,0.15);cursor:pointer;display:flex;justify-content:space-between;gap:.75rem;align-items:baseline">' +
          '<div><div style="font-family:\'Cinzel\',serif;font-size:12.5px;color:var(--gold2)">' + escapeHtml(m.name) + '</div>' +
          '<div style="font-size:11px;color:var(--parch3)">' + escapeHtml(m.size + ' ' + m.type) + ' · AC ' + m.ac + ' · HP ' + m.hp + '</div></div>' +
          '<div style="font-family:\'Cinzel\',serif;font-size:10px;color:var(--parch3);letter-spacing:1px">CR ' + m.cr + '</div>' +
          '</div>';
      }).join('');
      document.getElementById('ct-picker-search').value = '';
      if (dlg.showModal) dlg.showModal();
      else dlg.setAttribute('open', '');
      // Attach click handlers
      const self = this;
      listEl.querySelectorAll('.ct-picker-row').forEach(function(row) {
        row.addEventListener('click', function() {
          const mid = row.getAttribute('data-mid');
          const countRaw = prompt('How many "' + MONSTERS_BY_ID[mid].name + '"?', '1');
          const count = Math.max(1, parseInt(countRaw, 10) || 1);
          self._addMonsterFromCatalog(mid, count);
          dlg.close();
        });
      });
    },

    _addMonsterFromCatalog: function(monsterId, count) {
      const m = MONSTERS_BY_ID[monsterId];
      if (!m) return;
      const self = this;
      this._mutate(function(s) {
        s.combatants = s.combatants || [];
        for (let i = 1; i <= count; i++) {
          const suffix = count > 1 ? ' #' + i : '';
          s.combatants.push({
            id: 'monster-' + monsterId + '-' + Date.now() + '-' + i,
            kind: 'monster', name: m.name + suffix,
            monsterId: monsterId,
            initiative: 0, ac: m.ac, hp: m.hp, hpMax: m.hp, tempHp: 0,
            conditions: {}, concentrating: '', dead: false
          });
        }
        self._log(s, '+ ' + count + '× ' + m.name);
      });
    },

    _openStatBlock: function(monsterId) {
      const m = MONSTERS_BY_ID[monsterId];
      if (!m) return;
      const dlg = document.getElementById('ct-statblock-dialog');
      if (!dlg) return;
      const body = document.getElementById('ct-statblock-body');
      const abils = ['str', 'dex', 'con', 'int', 'wis', 'cha'].map(function(a) {
        const v = m[a] || 10;
        const mod = Math.floor((v - 10) / 2);
        return '<div style="text-align:center"><div style="font-family:\'Cinzel\',serif;font-size:10px;color:var(--gold2);letter-spacing:1px">' + a.toUpperCase() + '</div><div style="font-size:15px">' + v + '</div><div style="font-size:11px;color:var(--parch3)">' + (mod >= 0 ? '+' : '') + mod + '</div></div>';
      }).join('');
      const traits = (m.traits || []).map(function(t) { return '<div style="margin-bottom:.35rem"><strong style="color:var(--gold2)">' + escapeHtml(t.name) + '.</strong> ' + escapeHtml(t.desc) + '</div>'; }).join('');
      const actions = (m.actions || []).map(function(t) { return '<div style="margin-bottom:.35rem"><strong style="color:var(--gold2)">' + escapeHtml(t.name) + '.</strong> ' + escapeHtml(t.desc) + '</div>'; }).join('');
      const legendary = (m.legendaryActions || []).map(function(t) { return '<div style="margin-bottom:.35rem"><strong style="color:#e0a0e0">' + escapeHtml(t.name) + '.</strong> ' + escapeHtml(t.desc) + '</div>'; }).join('');
      body.innerHTML =
        '<h2 style="margin:0 0 .2rem;font-family:\'Cinzel\',serif;color:var(--gold2);font-size:18px">' + escapeHtml(m.name) + '</h2>' +
        '<div style="font-size:11px;font-style:italic;color:var(--parch3);margin-bottom:.5rem">' + escapeHtml(m.size + ' ' + m.type + ', ' + m.alignment) + '</div>' +
        '<div style="border-top:1px solid var(--gold2);border-bottom:1px solid var(--gold2);padding:.5rem 0;margin-bottom:.6rem;font-size:12.5px">' +
          '<div><strong>AC</strong> ' + m.ac + (m.acNote ? ' (' + escapeHtml(m.acNote) + ')' : '') + '</div>' +
          '<div><strong>HP</strong> ' + m.hp + (m.hpFormula ? ' (' + m.hpFormula + ')' : '') + '</div>' +
          '<div><strong>Speed</strong> ' + escapeHtml(m.speed || '30 ft') + '</div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:.4rem;border-bottom:1px solid var(--gold2);padding-bottom:.5rem;margin-bottom:.6rem">' + abils + '</div>' +
        (m.senses    ? '<div style="font-size:12px;margin-bottom:.25rem"><strong>Senses</strong> ' + escapeHtml(m.senses) + '</div>' : '') +
        (m.languages ? '<div style="font-size:12px;margin-bottom:.25rem"><strong>Languages</strong> ' + escapeHtml(m.languages) + '</div>' : '') +
        (m.cr        ? '<div style="font-size:12px;margin-bottom:.5rem"><strong>CR</strong> ' + m.cr + ' (XP ' + (m.xp || 0) + ')</div>' : '') +
        (traits    ? '<div style="margin-bottom:.5rem;font-size:12.5px;line-height:1.55">' + traits + '</div>' : '') +
        (actions   ? '<h3 style="font-family:\'Cinzel\',serif;color:var(--gold2);font-size:12px;letter-spacing:1.5px;text-transform:uppercase;margin:.5rem 0 .3rem;border-bottom:1px solid rgba(160,128,64,0.35)">Actions</h3><div style="font-size:12.5px;line-height:1.55">' + actions + '</div>' : '') +
        (legendary ? '<h3 style="font-family:\'Cinzel\',serif;color:#e0a0e0;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;margin:.5rem 0 .3rem;border-bottom:1px solid rgba(200,160,200,0.35)">Legendary Actions</h3><div style="font-size:12.5px;line-height:1.55">' + legendary + '</div>' : '');
      if (dlg.showModal) dlg.showModal();
      else dlg.setAttribute('open', '');
    },

    _render: function() {
      if (!this._container) return;
      const s = this._state;
      if (!s || !s.active) {
        this._container.innerHTML =
          '<div class="alert alert-info">No active encounter. Click "Start combat" to auto-add the party and begin.</div>' +
          '<button class="action-btn" style="background:var(--gold);color:#0d0a06;border:none" onclick="if(window.CombatTracker) CombatTracker._startCombat()">⚔ Start combat</button>' +
          (s && s.log && s.log.length ? this._renderLog(s) : '');
        this._ensureDialogs();
        return;
      }
      const self = this;
      const combatants = (s.combatants || []).slice();
      this._sortByInit(combatants);
      const html =
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:.75rem;flex-wrap:wrap;margin-bottom:.75rem">' +
          '<div style="font-family:\'Cinzel\',serif;color:var(--gold2);font-size:14px">Round ' + (s.round || 1) + ' &nbsp;·&nbsp; ' + combatants.length + ' combatant' + (combatants.length === 1 ? '' : 's') + '</div>' +
          '<div style="display:flex;gap:.4rem;flex-wrap:wrap">' +
            '<button class="action-btn" onclick="if(window.CombatTracker) CombatTracker._openMonsterPicker()">📖 Add from catalog</button>' +
            '<button class="action-btn" onclick="if(window.CombatTracker) CombatTracker._addAdhocMonster()">+ Ad-hoc monster</button>' +
            '<button class="action-btn" style="background:var(--gold);color:#0d0a06;border:none" onclick="if(window.CombatTracker) CombatTracker._advanceTurn()">⏭ Next turn</button>' +
            '<button class="action-btn" style="border-color:#a02020;color:#e0a0a0" onclick="if(window.CombatTracker) CombatTracker._endCombat()">End combat</button>' +
          '</div>' +
        '</div>' +
        '<div style="overflow-x:auto"><table class="ct-table" style="width:100%;border-collapse:collapse;font-size:12.5px">' +
          '<thead><tr><th style="width:32px"></th><th>Combatant</th><th style="width:60px">Init</th><th style="width:60px">AC</th><th style="width:110px">HP</th><th>Conditions</th><th style="width:140px">Concentration</th><th style="width:170px">Actions</th></tr></thead><tbody>' +
          combatants.map(function(c, idx) { return self._renderRow(c, idx); }).join('') +
        '</tbody></table></div>' +
        this._renderLog(s);
      this._container.innerHTML = html;
      this._wireRows();
      this._ensureDialogs();
    },

    _renderRow: function(c, sortedIdx) {
      const active = this._state.combatants[this._state.turnIdx] && this._state.combatants[this._state.turnIdx].id === c.id;
      const kindTag = c.kind === 'pc'
        ? '<span style="background:rgba(13,61,48,0.35);color:#a0d4c4;font-family:\'Cinzel\',serif;font-size:9px;padding:1px 5px;border-radius:2px;letter-spacing:.5px">PC</span>'
        : '<span style="background:rgba(90,60,150,0.3);color:#c4a0f4;font-family:\'Cinzel\',serif;font-size:9px;padding:1px 5px;border-radius:2px;letter-spacing:.5px">MON</span>';
      const conditions = (c.conditions && Object.keys(c.conditions)) || [];
      const condTags = conditions.map(function(k) {
        return '<span style="background:rgba(122,26,26,0.3);color:#e0a0a0;border:1px solid rgba(122,26,26,0.4);font-size:9px;font-family:\'Cinzel\',serif;padding:1px 5px;border-radius:2px;margin-right:2px" data-remove-cond="' + k + '" data-cid="' + escapeAttr(c.id) + '" title="Click to remove">' + escapeHtml(k) + ' ✕</span>';
      }).join('');
      const rowStyle = 'border-bottom:1px solid rgba(160,128,64,0.15);' +
        (active ? 'background:rgba(201,168,76,0.12);border-left:3px solid var(--gold2);' : '') +
        (c.dead ? 'opacity:.5;text-decoration:line-through;' : '');
      const monsterBtn = (c.kind === 'monster' && c.monsterId)
        ? '<button class="ct-statblock-btn" data-mid="' + c.monsterId + '" title="View stat block" style="background:transparent;border:1px solid var(--gold2);color:var(--gold2);padding:1px 6px;border-radius:2px;font-size:10px;cursor:pointer;margin-right:2px">📖</button>'
        : '';
      return '<tr style="' + rowStyle + '">' +
        '<td style="text-align:center;padding:.4rem .3rem">' + kindTag + '</td>' +
        '<td style="padding:.4rem .5rem;font-family:\'Cinzel\',serif;font-size:13px;color:var(--parch1)">' + escapeHtml(c.name) + '</td>' +
        '<td><input type="number" value="' + (c.initiative || 0) + '" data-init-id="' + escapeAttr(c.id) + '" style="width:50px;padding:2px;background:rgba(10,8,5,0.6);border:1px solid rgba(160,128,64,0.35);color:var(--parch);border-radius:2px;text-align:center;font-size:12px"></td>' +
        '<td style="text-align:center">' + escapeHtml(String(c.ac || '?')) + '</td>' +
        '<td><input type="number" min="0" max="' + (c.hpMax || 999) + '" value="' + (c.hp || 0) + '" data-hp-id="' + escapeAttr(c.id) + '" style="width:50px;padding:2px;background:rgba(10,8,5,0.6);border:1px solid rgba(160,128,64,0.35);color:var(--parch);border-radius:2px;text-align:center;font-size:12px"> <span style="font-size:10px;color:var(--parch3)">/ ' + (c.hpMax || 0) + '</span></td>' +
        '<td style="padding:.3rem;font-size:11px">' +
          condTags +
          '<button class="ct-add-cond-btn" data-cid="' + escapeAttr(c.id) + '" style="background:transparent;border:1px dashed rgba(160,128,64,0.35);color:var(--parch3);padding:1px 5px;border-radius:2px;font-size:10px;cursor:pointer">+ cond</button>' +
        '</td>' +
        '<td>' +
          '<input type="text" value="' + escapeAttr(c.concentrating || '') + '" data-conc-id="' + escapeAttr(c.id) + '" placeholder="—" style="width:130px;padding:2px 4px;background:rgba(10,8,5,0.6);border:1px solid rgba(160,128,64,0.35);color:var(--parch);border-radius:2px;font-size:11px">' +
        '</td>' +
        '<td style="white-space:nowrap;padding:.3rem;text-align:right">' +
          monsterBtn +
          '<button class="ct-dmg-btn" data-cid="' + escapeAttr(c.id) + '" style="background:transparent;border:1px solid #a05050;color:#e0a0a0;padding:1px 6px;border-radius:2px;font-size:10px;cursor:pointer;margin-right:2px">−dmg</button>' +
          '<button class="ct-heal-btn" data-cid="' + escapeAttr(c.id) + '" style="background:transparent;border:1px solid #5a9a70;color:#a0d4b8;padding:1px 6px;border-radius:2px;font-size:10px;cursor:pointer;margin-right:2px">+heal</button>' +
          '<button class="ct-remove-btn" data-cid="' + escapeAttr(c.id) + '" title="Remove" style="background:transparent;border:1px solid rgba(160,128,64,0.35);color:var(--parch3);padding:1px 6px;border-radius:2px;font-size:10px;cursor:pointer">✕</button>' +
        '</td>' +
        '</tr>';
    },

    _wireRows: function() {
      const self = this;
      this._container.querySelectorAll('[data-init-id]').forEach(function(el) {
        el.addEventListener('change', function() { self._setInitiative(el.getAttribute('data-init-id'), el.value); });
      });
      this._container.querySelectorAll('[data-hp-id]').forEach(function(el) {
        el.addEventListener('change', function() { self._setHp(el.getAttribute('data-hp-id'), el.value); });
      });
      this._container.querySelectorAll('[data-conc-id]').forEach(function(el) {
        el.addEventListener('change', function() { self._setConcentration(el.getAttribute('data-conc-id'), el.value.trim()); });
      });
      this._container.querySelectorAll('.ct-dmg-btn').forEach(function(b) { b.addEventListener('click', function() { self._damage(b.getAttribute('data-cid')); }); });
      this._container.querySelectorAll('.ct-heal-btn').forEach(function(b) { b.addEventListener('click', function() { self._heal(b.getAttribute('data-cid')); }); });
      this._container.querySelectorAll('.ct-remove-btn').forEach(function(b) { b.addEventListener('click', function() { self._removeCombatant(b.getAttribute('data-cid')); }); });
      this._container.querySelectorAll('.ct-add-cond-btn').forEach(function(b) {
        b.addEventListener('click', function() {
          const cid = b.getAttribute('data-cid');
          const menu = CONDITIONS_2024.map(function(c, i) { return (i + 1) + ') ' + c; }).join('\n');
          const answer = prompt('Add condition (number 1-' + CONDITIONS_2024.length + ' or free text):\n\n' + menu);
          if (!answer) return;
          const n = parseInt(answer, 10);
          const cond = (!isNaN(n) && n >= 1 && n <= CONDITIONS_2024.length) ? CONDITIONS_2024[n - 1] : answer.trim().toLowerCase();
          if (cond) self._toggleCondition(cid, cond);
        });
      });
      this._container.querySelectorAll('[data-remove-cond]').forEach(function(el) {
        el.addEventListener('click', function() { self._toggleCondition(el.getAttribute('data-cid'), el.getAttribute('data-remove-cond')); });
      });
      this._container.querySelectorAll('.ct-statblock-btn').forEach(function(b) {
        b.addEventListener('click', function() { self._openStatBlock(b.getAttribute('data-mid')); });
      });
    },

    _renderLog: function(s) {
      const log = (s && s.log) || [];
      if (!log.length) return '';
      const rows = log.slice(-40).reverse().map(function(e) {
        const t = new Date(e.t);
        const stamp = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return '<div style="font-size:11px;color:var(--parch2);padding:.15rem .5rem;border-bottom:1px dashed rgba(160,128,64,0.1)"><span style="color:var(--parch4);font-family:monospace">' + stamp + ' · R' + (e.r || '?') + '</span> &nbsp; ' + escapeHtml(e.msg) + '</div>';
      }).join('');
      return '<details style="margin-top:.85rem" open><summary style="cursor:pointer;font-family:\'Cinzel\',serif;color:var(--gold2);font-size:11px;letter-spacing:1.5px;text-transform:uppercase">Combat log &nbsp;<span style="opacity:.6;font-weight:400">' + log.length + ' entries · newest first</span></summary><div style="max-height:280px;overflow-y:auto;margin-top:.5rem">' + rows + '</div></details>';
    },

    _ensureDialogs: function() {
      if (!document.getElementById('ct-monster-picker')) {
        const d1 = document.createElement('dialog');
        d1.id = 'ct-monster-picker';
        d1.style.cssText = 'max-width:640px;width:90vw;max-height:80vh;padding:0;border:1px solid var(--gold2);background:#0d0a06;color:var(--parch1);border-radius:6px';
        d1.innerHTML =
          '<div style="padding:.75rem 1rem;border-bottom:1px solid var(--gold2);display:flex;justify-content:space-between;align-items:center">' +
            '<div style="font-family:\'Cinzel\',serif;color:var(--gold2)">📖 Monster Catalog</div>' +
            '<button onclick="this.closest(\'dialog\').close()" style="background:transparent;border:1px solid var(--parch3);color:var(--parch3);padding:2px 10px;border-radius:2px;cursor:pointer;font-family:\'Cinzel\',serif;font-size:11px">Close</button>' +
          '</div>' +
          '<div style="padding:.5rem 1rem;border-bottom:1px solid rgba(160,128,64,0.35)">' +
            '<input id="ct-picker-search" type="text" placeholder="Filter…" style="width:100%;padding:.4rem .6rem;background:rgba(10,8,5,0.6);border:1px solid var(--gold2);color:var(--parch);border-radius:2px" oninput="var q=this.value.toLowerCase();document.querySelectorAll(\'#ct-picker-list .ct-picker-row\').forEach(function(r){r.style.display=r.textContent.toLowerCase().indexOf(q)>=0?\'\':\'none\'})">' +
          '</div>' +
          '<div id="ct-picker-list" style="overflow-y:auto;max-height:60vh"></div>';
        document.body.appendChild(d1);
        d1.addEventListener('click', function(e) { if (e.target === d1) d1.close(); });
      }
      if (!document.getElementById('ct-statblock-dialog')) {
        const d2 = document.createElement('dialog');
        d2.id = 'ct-statblock-dialog';
        d2.style.cssText = 'max-width:600px;width:90vw;max-height:85vh;padding:0;border:1px solid var(--gold2);background:#0d0a06;color:var(--parch1);border-radius:6px';
        d2.innerHTML =
          '<div style="padding:.5rem 1rem;border-bottom:1px solid var(--gold2);display:flex;justify-content:flex-end">' +
            '<button onclick="this.closest(\'dialog\').close()" style="background:transparent;border:1px solid var(--parch3);color:var(--parch3);padding:2px 10px;border-radius:2px;cursor:pointer;font-family:\'Cinzel\',serif;font-size:11px">Close</button>' +
          '</div>' +
          '<div id="ct-statblock-body" style="padding:1rem 1.25rem;overflow-y:auto;max-height:75vh"></div>';
        document.body.appendChild(d2);
        d2.addEventListener('click', function(e) { if (e.target === d2) d2.close(); });
      }
    }
  };

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escapeAttr(s) { return escapeHtml(s).replace(/'/g, '&#39;'); }

  window.CombatTracker = CT;
})();
