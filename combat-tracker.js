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
  const PRESETS_PATH = 'encounter-presets';
  const ENCOUNTERS_JSON = 'data/encounters.json';
  const PC_IDS = ['torren', 'sylas', 'orin'];
  // Capitalized to match SHEET_CONDITIONS in sheet-engine.js so two-way
  // sync (tracker ↔ sheet) uses the same keys. Exhaustion is a level 0-6
  // on the sheet, not a boolean condition — keep it here for monster use.
  const CONDITIONS_2024 = [
    'Blinded', 'Charmed', 'Deafened', 'Frightened', 'Grappled',
    'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified',
    'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious', 'Exhaustion'
  ];

  const CT = {
    _container: null,
    _ref: null,
    _state: null,
    _presetsRef: null,
    _presets: {},         // { presetId: { name, description, monsters:[], notes } }
    _vaultEncounters: [], // loaded from data/encounters.json

    init: function(containerId) {
      console.log('[CombatTracker] init(' + containerId + ')');
      this._container = document.getElementById(containerId);
      if (!this._container) {
        console.warn('[CombatTracker] container #' + containerId + ' NOT FOUND in DOM');
        return;
      }
      console.log('[CombatTracker] container found; rendering empty state');
      try { this._render(); } catch (e) { console.error('[CombatTracker] _render threw:', e); this._container.innerHTML = '<div class="alert alert-warn">Combat tracker render error — see console.</div>'; }
      try { this._initSync(); } catch (e) { console.warn('[CombatTracker] _initSync threw:', e); }
      try { this._loadVaultEncounters(); } catch (e) { console.warn('[CombatTracker] _loadVaultEncounters threw:', e); }
      try { this._initPresetsSync(); } catch (e) { console.warn('[CombatTracker] _initPresetsSync threw:', e); }
    },

    _loadVaultEncounters: function() {
      const self = this;
      fetch(ENCOUNTERS_JSON + '?_=' + Date.now())
        .then(r => r.ok ? r.json() : { encounters: [] })
        .then(data => { self._vaultEncounters = data.encounters || []; })
        .catch(function() {});
    },

    _initPresetsSync: function() {
      if (typeof firebase === 'undefined' || !firebase.database) return;
      const self = this;
      try {
        this._presetsRef = firebase.database().ref(PRESETS_PATH);
        this._presetsRef.on('value', function(snap) {
          self._presets = snap.val() || {};
        });
      } catch (e) { console.warn('[CombatTracker] Presets sync failed:', e); }
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
          self._maybeStartAutoSync();
        });
      } catch (e) {
        console.warn('[CombatTracker] Sync failed:', e);
        this._render();
      }
    },

    _maybeStartAutoSync: function() {
      const active = this._state && this._state.active;
      if (active && !this._autoSyncTimer) {
        const self = this;
        this._autoSyncTimer = setInterval(function() {
          if (!self._state || !self._state.active) return;
          self._syncPCsFromSheets(true); // silent — no log spam
        }, 3000);
      } else if (!active && this._autoSyncTimer) {
        clearInterval(this._autoSyncTimer);
        this._autoSyncTimer = null;
      }
    },

    _startCombat: function() {
      if (this._state && this._state.active) {
        if (!confirm('An encounter is already active. Restart?')) return;
      }
      const combatants = [];
      // Auto-add all three PCs
      PC_IDS.forEach(function(pcId) {
        const char = (typeof CHARACTERS !== 'undefined') ? CHARACTERS[pcId] : null;
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

    _syncPCsFromSheets: function(silent) {
      const self = this;
      this._mutate(function(s) {
        if (!s.combatants) return;
        let updates = [];
        s.combatants.forEach(function(c) {
          if (c.kind !== 'pc' || !c.pcId) return;
          const char = (typeof CHARACTERS !== 'undefined') ? CHARACTERS[c.pcId] : null;
          if (!char) return;
          let newHp = c.hp, newHpMax = c.hpMax, newAc = c.ac;
          let newConds = c.conditions || {};
          let condsChanged = false;
          try {
            if (typeof getSheetState === 'function') {
              const ss = getSheetState(c.pcId);
              if (ss && ss.hp && typeof ss.hp.current === 'number') newHp = ss.hp.current;
              if (ss && ss.conditions) {
                const sheetConds = ss.conditions;
                // Sheet is source of truth for PC conditions
                const oldKeys = Object.keys(c.conditions || {}).sort().join(',');
                const newKeys = Object.keys(sheetConds).sort().join(',');
                if (oldKeys !== newKeys) { newConds = Object.assign({}, sheetConds); condsChanged = true; }
              }
            }
          } catch (e) {}
          if (char.hpMax) newHpMax = char.hpMax;
          if (char.ac) newAc = char.ac;
          if (c.hp !== newHp || c.hpMax !== newHpMax || c.ac !== newAc || condsChanged) {
            const parts = [];
            if (c.hp !== newHp) parts.push('HP ' + c.hp + '→' + newHp);
            if (c.ac !== newAc) parts.push('AC ' + c.ac + '→' + newAc);
            if (condsChanged) parts.push('conditions');
            updates.push(c.name + ' ' + parts.join(', '));
            c.hp = newHp; c.hpMax = newHpMax; c.ac = newAc;
            if (condsChanged) c.conditions = newConds;
            if (newHp > 0 && c.dead) c.dead = false;
          }
        });
        if (updates.length && !silent) self._log(s, '🔄 Sync from sheets: ' + updates.join(', '));
      });
    },

    _endCombat: function() {
      if (!confirm('End the current encounter?\n\nA log summary will remain visible until you start a new one.')) return;
      const s = this._state || {};
      this._write({ active: false, round: s.round || 0, combatants: s.combatants || [], log: s.log || [], endedAt: Date.now() });
    },

    _write: function(state) {
      // Firebase rejects undefined. Round-trip through JSON to strip any.
      const clean = JSON.parse(JSON.stringify(state));
      if (!this._ref) { this._state = clean; this._render(); return; }
      this._ref.set(clean).catch(function(e) { console.warn('[CombatTracker] Write failed:', e); });
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
        const willAdd = !c.conditions[cond];
        if (willAdd) c.conditions[cond] = true; else delete c.conditions[cond];
        self._log(s, (willAdd ? '+' : '−') + cond + ' · ' + c.name);
        // Two-way sync to PC sheet
        if (c.kind === 'pc' && c.pcId) {
          try {
            if (typeof withSheetState === 'function') {
              withSheetState(c.pcId, function(ss) {
                ss.conditions = ss.conditions || {};
                if (willAdd) ss.conditions[cond] = true; else delete ss.conditions[cond];
              });
            }
          } catch (e) {}
        }
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
      const dexMod = Math.floor(((m.dex || 10) - 10) / 2);
      this._mutate(function(s) {
        s.combatants = s.combatants || [];
        for (let i = 1; i <= count; i++) {
          const suffix = count > 1 ? ' #' + i : '';
          const roll = Math.floor(Math.random() * 20) + 1;
          const init = roll + dexMod;
          s.combatants.push({
            id: 'monster-' + monsterId + '-' + Date.now() + '-' + i,
            kind: 'monster', name: m.name + suffix,
            monsterId: monsterId,
            initiative: init, ac: m.ac, hp: m.hp, hpMax: m.hp, tempHp: 0,
            conditions: {}, concentrating: '', dead: false
          });
        }
        self._log(s, '+ ' + count + '× ' + m.name + ' (init auto-rolled)');
      });
    },

    _rollMonsterInit: function() {
      const self = this;
      this._mutate(function(s) {
        if (!s.combatants) return;
        const rolls = [];
        s.combatants.forEach(function(c) {
          if (c.kind !== 'monster') return;
          let dexMod = 0;
          if (c.monsterId && typeof MONSTERS_BY_ID !== 'undefined' && MONSTERS_BY_ID[c.monsterId]) {
            dexMod = Math.floor(((MONSTERS_BY_ID[c.monsterId].dex || 10) - 10) / 2);
          }
          const roll = Math.floor(Math.random() * 20) + 1;
          c.initiative = roll + dexMod;
          rolls.push(c.name + ' ' + c.initiative + ' (d20=' + roll + (dexMod ? (dexMod > 0 ? '+' : '') + dexMod : '') + ')');
        });
        if (rolls.length) self._log(s, '🎲 Monster init: ' + rolls.join(', '));
      });
    },

    // -------------------- Encounter Presets --------------------
    _openEncountersModal: function() {
      const dlg = document.getElementById('ct-encounters-dialog');
      if (!dlg) return;
      this._renderEncountersList();
      if (dlg.showModal) dlg.showModal();
      else dlg.setAttribute('open', '');
    },

    _renderEncountersList: function() {
      const listEl = document.getElementById('ct-encounters-list');
      if (!listEl) return;
      const self = this;
      const vault = this._vaultEncounters || [];
      const presetIds = Object.keys(this._presets || {}).sort();
      const monsterName = function(mid) {
        return (typeof MONSTERS_BY_ID !== 'undefined' && MONSTERS_BY_ID[mid])
          ? MONSTERS_BY_ID[mid].name : mid;
      };
      const renderCard = function(e, source, opts) {
        opts = opts || {};
        const monsterList = (e.monsters || []).map(function(m) {
          return (m.count || 1) + '× ' + escapeHtml(monsterName(m.id));
        }).join(', ') || '(no monsters)';
        const editBtn = source === 'preset'
          ? '<button class="ct-preset-edit" data-pid="' + escapeAttr(opts.presetId) + '" style="background:transparent;border:1px solid var(--parch3);color:var(--parch3);padding:2px 8px;border-radius:2px;font-size:10px;font-family:\'Cinzel\',serif;cursor:pointer;margin-right:4px">✎ Edit</button>' +
            '<button class="ct-preset-delete" data-pid="' + escapeAttr(opts.presetId) + '" style="background:transparent;border:1px solid #a04040;color:#e0a0a0;padding:2px 8px;border-radius:2px;font-size:10px;font-family:\'Cinzel\',serif;cursor:pointer;margin-right:4px">✕ Delete</button>'
          : '';
        const cr = e.cr ? ' · CR ' + escapeHtml(String(e.cr)) : '';
        const diff = e.difficulty ? ' · ' + escapeHtml(e.difficulty) : '';
        return '<div class="ct-encounter-card" style="padding:.7rem .85rem;border:1px solid rgba(160,128,64,0.25);border-radius:3px;margin-bottom:.5rem;background:rgba(0,0,0,0.15)">' +
          '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:.5rem">' +
            '<div style="font-family:\'Cinzel\',serif;color:var(--gold2);font-size:13px;font-weight:600">' + escapeHtml(e.title) + '</div>' +
            '<div style="font-size:10px;color:var(--parch3);font-family:\'Cinzel\',serif;letter-spacing:1px">' + escapeHtml(source.toUpperCase()) + cr + diff + '</div>' +
          '</div>' +
          (e.description ? '<div style="font-size:12px;color:var(--parch3);font-style:italic;margin:.2rem 0">' + escapeHtml(e.description) + '</div>' : '') +
          '<div style="font-size:12px;color:var(--parch2);margin-top:.3rem">' + monsterList + '</div>' +
          '<div style="margin-top:.5rem;display:flex;gap:.4rem;justify-content:flex-end;align-items:center">' +
            editBtn +
            '<button class="ct-encounter-load" data-src="' + source + '" data-key="' + escapeAttr(opts.presetId || e.id) + '" style="background:var(--gold);color:#0d0a06;border:none;padding:4px 12px;border-radius:2px;font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:1px;cursor:pointer">📥 Load</button>' +
          '</div>' +
        '</div>';
      };
      let html = '';
      html += '<div style="font-family:\'Cinzel\',serif;color:var(--gold2);font-size:11px;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:.4rem">📚 Prepared (vault) — ' + vault.length + '</div>';
      if (!vault.length) {
        html += '<div style="padding:.5rem;color:var(--parch4);font-style:italic;font-size:12px">No vault encounters. Add .md files to <code>Session Planning/Encounters/</code> and regenerate.</div>';
      } else {
        vault.forEach(function(e) { html += renderCard(e, 'vault'); });
      }
      html += '<div style="font-family:\'Cinzel\',serif;color:var(--gold2);font-size:11px;letter-spacing:1.5px;text-transform:uppercase;margin:1rem 0 .4rem">🗂 My Presets (site-created) — ' + presetIds.length + '</div>';
      if (!presetIds.length) {
        html += '<div style="padding:.5rem;color:var(--parch4);font-style:italic;font-size:12px">No saved presets yet. Use "+ Create new" below to make one.</div>';
      } else {
        presetIds.forEach(function(pid) {
          const p = self._presets[pid];
          if (p) html += renderCard(p, 'preset', { presetId: pid });
        });
      }
      listEl.innerHTML = html;
      listEl.querySelectorAll('.ct-encounter-load').forEach(function(b) {
        b.addEventListener('click', function() {
          const src = b.getAttribute('data-src');
          const key = b.getAttribute('data-key');
          self._loadEncounter(src, key);
        });
      });
      listEl.querySelectorAll('.ct-preset-edit').forEach(function(b) {
        b.addEventListener('click', function() { self._openPresetEditor(b.getAttribute('data-pid')); });
      });
      listEl.querySelectorAll('.ct-preset-delete').forEach(function(b) {
        b.addEventListener('click', function() {
          const pid = b.getAttribute('data-pid');
          const p = self._presets[pid];
          if (!p) return;
          if (!confirm('Delete preset "' + (p.name || pid) + '"?')) return;
          if (self._presetsRef) self._presetsRef.child(pid).remove().then(function() { self._renderEncountersList(); });
        });
      });
    },

    _loadEncounter: function(source, key) {
      const encounter = source === 'vault'
        ? (this._vaultEncounters || []).find(function(e) { return e.id === key; })
        : this._presets[key];
      if (!encounter) return;
      // If no active combat, start one first (auto-adds PCs)
      const self = this;
      const doAdd = function() {
        (encounter.monsters || []).forEach(function(m) {
          self._addMonsterFromCatalog(m.id, m.count || 1);
        });
        const dlg = document.getElementById('ct-encounters-dialog');
        if (dlg) dlg.close();
      };
      if (!this._state || !this._state.active) {
        this._startCombat();
        // Wait for Firebase to settle before adding monsters
        setTimeout(doAdd, 400);
      } else {
        doAdd();
      }
    },

    _openPresetEditor: function(presetIdOrNull) {
      const dlg = document.getElementById('ct-preset-editor');
      if (!dlg) return;
      const existing = presetIdOrNull ? this._presets[presetIdOrNull] : null;
      document.getElementById('ct-preset-editor-title').textContent = existing ? 'Edit Preset' : 'Create Preset';
      document.getElementById('ct-preset-id').value = presetIdOrNull || '';
      document.getElementById('ct-preset-name').value = existing ? (existing.name || '') : '';
      document.getElementById('ct-preset-desc').value = existing ? (existing.description || '') : '';
      document.getElementById('ct-preset-notes').value = existing ? (existing.notes || '') : '';
      this._presetEditorMonsters = existing ? (existing.monsters || []).slice() : [];
      this._renderPresetEditorMonsters();
      if (dlg.showModal) dlg.showModal();
      else dlg.setAttribute('open', '');
    },

    _renderPresetEditorMonsters: function() {
      const listEl = document.getElementById('ct-preset-monster-list');
      if (!listEl) return;
      const self = this;
      const rows = (this._presetEditorMonsters || []).map(function(m, i) {
        const name = (typeof MONSTERS_BY_ID !== 'undefined' && MONSTERS_BY_ID[m.id])
          ? MONSTERS_BY_ID[m.id].name : m.id;
        return '<div style="display:flex;gap:.4rem;align-items:center;padding:.3rem 0;border-bottom:1px dashed rgba(160,128,64,0.15)">' +
          '<div style="flex:1;font-size:12.5px;color:var(--parch2)">' + escapeHtml(name) + '</div>' +
          '<input type="number" min="1" value="' + (m.count || 1) + '" data-pm-idx="' + i + '" style="width:60px;background:rgba(10,8,5,0.6);border:1px solid rgba(160,128,64,0.35);color:var(--parch);padding:2px 4px;border-radius:2px;text-align:center;font-size:12px">' +
          '<button data-pm-remove="' + i + '" style="background:transparent;border:1px solid #a04040;color:#e0a0a0;padding:2px 6px;border-radius:2px;font-size:10px;cursor:pointer">✕</button>' +
          '</div>';
      }).join('');
      listEl.innerHTML = rows || '<div style="padding:.4rem;color:var(--parch4);font-style:italic;font-size:12px">No monsters. Click "+ Add monster" below.</div>';
      listEl.querySelectorAll('[data-pm-idx]').forEach(function(el) {
        el.addEventListener('change', function() {
          const idx = parseInt(el.getAttribute('data-pm-idx'), 10);
          const n = parseInt(el.value, 10) || 1;
          if (self._presetEditorMonsters[idx]) self._presetEditorMonsters[idx].count = n;
        });
      });
      listEl.querySelectorAll('[data-pm-remove]').forEach(function(el) {
        el.addEventListener('click', function() {
          const idx = parseInt(el.getAttribute('data-pm-remove'), 10);
          self._presetEditorMonsters.splice(idx, 1);
          self._renderPresetEditorMonsters();
        });
      });
    },

    _addMonsterToPresetEditor: function() {
      if (typeof MONSTERS_2024 === 'undefined') { alert('Monster catalog not loaded.'); return; }
      const names = MONSTERS_2024.map(function(m, i) { return (i + 1) + '. ' + m.name + ' (CR ' + m.cr + ')'; }).join('\n');
      const answer = prompt('Add monster — enter number:\n\n' + names);
      if (!answer) return;
      const n = parseInt(answer, 10);
      if (isNaN(n) || n < 1 || n > MONSTERS_2024.length) return;
      const m = MONSTERS_2024[n - 1];
      const countRaw = prompt('Count?', '1');
      const count = Math.max(1, parseInt(countRaw, 10) || 1);
      this._presetEditorMonsters = this._presetEditorMonsters || [];
      this._presetEditorMonsters.push({ id: m.id, count: count });
      this._renderPresetEditorMonsters();
    },

    _savePreset: function() {
      const name = document.getElementById('ct-preset-name').value.trim();
      if (!name) { alert('Name required.'); return; }
      const id = document.getElementById('ct-preset-id').value || ('preset-' + Date.now() + '-' + Math.floor(Math.random() * 1000));
      const preset = {
        name: name,
        description: document.getElementById('ct-preset-desc').value.trim(),
        notes: document.getElementById('ct-preset-notes').value.trim(),
        monsters: this._presetEditorMonsters || [],
        updatedAt: Date.now()
      };
      if (!this._presets[id]) preset.createdAt = Date.now();
      if (!this._presetsRef) { alert('Firebase not ready.'); return; }
      const self = this;
      this._presetsRef.child(id).set(preset).then(function() {
        const dlg = document.getElementById('ct-preset-editor');
        if (dlg) dlg.close();
        self._renderEncountersList();
      }).catch(function(e) {
        alert('Save failed: ' + (e && e.message));
      });
    },

    _saveCurrentAsPreset: function() {
      if (!this._state || !this._state.active) { alert('No active encounter to save.'); return; }
      const monsters = {};
      (this._state.combatants || []).forEach(function(c) {
        if (c.kind !== 'monster' || !c.monsterId) return; // skip PCs + ad-hoc (no catalog id)
        monsters[c.monsterId] = (monsters[c.monsterId] || 0) + 1;
      });
      const monsterArr = Object.keys(monsters).map(function(id) { return { id: id, count: monsters[id] }; });
      if (!monsterArr.length) { alert('No catalog monsters in the current encounter (only PCs / ad-hoc). Add from catalog first.'); return; }
      this._presetEditorMonsters = monsterArr;
      // Open editor with current encounter as starting state
      const dlg = document.getElementById('ct-preset-editor');
      document.getElementById('ct-preset-editor-title').textContent = 'Save Current Encounter as Preset';
      document.getElementById('ct-preset-id').value = '';
      document.getElementById('ct-preset-name').value = '';
      document.getElementById('ct-preset-desc').value = '';
      document.getElementById('ct-preset-notes').value = '';
      this._renderPresetEditorMonsters();
      if (dlg.showModal) dlg.showModal();
      else dlg.setAttribute('open', '');
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
          '<div class="alert alert-info">No active encounter. Start from scratch (auto-adds the party) or load a prepared encounter.</div>' +
          '<div style="display:flex;gap:.5rem;flex-wrap:wrap">' +
            '<button class="action-btn" style="background:var(--gold);color:#0d0a06;border:none" onclick="if(window.CombatTracker) CombatTracker._startCombat()">⚔ Start combat</button>' +
            '<button class="action-btn" onclick="if(window.CombatTracker) CombatTracker._openEncountersModal()">📋 Encounter presets</button>' +
          '</div>' +
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
            '<button class="action-btn" onclick="if(window.CombatTracker) CombatTracker._addAdhocMonster()">+ Ad-hoc</button>' +
            '<button class="action-btn" onclick="if(window.CombatTracker) CombatTracker._openEncountersModal()">📋 Presets</button>' +
            '<button class="action-btn" onclick="if(window.CombatTracker) CombatTracker._saveCurrentAsPreset()" title="Save current encounter as a preset for later">💾 Save preset</button>' +
            '<button class="action-btn" onclick="if(window.CombatTracker) CombatTracker._syncPCsFromSheets()" title="Re-pull HP/AC from each PC sheet (use after long rest or manual sheet edit)">🔄 Sync PCs</button>' +
            '<button class="action-btn" onclick="if(window.CombatTracker) CombatTracker._rollMonsterInit()" title="Reroll initiative for every monster (PCs untouched — you enter theirs manually)">🎲 Roll monster init</button>' +
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
      if (!document.getElementById('ct-encounters-dialog')) {
        const d3 = document.createElement('dialog');
        d3.id = 'ct-encounters-dialog';
        d3.style.cssText = 'max-width:720px;width:92vw;max-height:85vh;padding:0;border:1px solid var(--gold2);background:#0d0a06;color:var(--parch1);border-radius:6px';
        d3.innerHTML =
          '<div style="padding:.75rem 1rem;border-bottom:1px solid var(--gold2);display:flex;justify-content:space-between;align-items:center">' +
            '<div style="font-family:\'Cinzel\',serif;color:var(--gold2)">📋 Encounter Presets</div>' +
            '<div style="display:flex;gap:.4rem">' +
              '<button onclick="if(window.CombatTracker) CombatTracker._openPresetEditor(null)" style="background:var(--gold);color:#0d0a06;border:none;padding:4px 10px;border-radius:2px;cursor:pointer;font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:1px">+ Create new</button>' +
              '<button onclick="this.closest(\'dialog\').close()" style="background:transparent;border:1px solid var(--parch3);color:var(--parch3);padding:4px 10px;border-radius:2px;cursor:pointer;font-family:\'Cinzel\',serif;font-size:11px">Close</button>' +
            '</div>' +
          '</div>' +
          '<div id="ct-encounters-list" style="overflow-y:auto;max-height:75vh;padding:1rem"></div>';
        document.body.appendChild(d3);
        d3.addEventListener('click', function(e) { if (e.target === d3) d3.close(); });
      }
      if (!document.getElementById('ct-preset-editor')) {
        const d4 = document.createElement('dialog');
        d4.id = 'ct-preset-editor';
        d4.style.cssText = 'max-width:560px;width:92vw;max-height:85vh;padding:0;border:1px solid var(--gold2);background:#0d0a06;color:var(--parch1);border-radius:6px';
        d4.innerHTML =
          '<div style="padding:.75rem 1rem;border-bottom:1px solid var(--gold2);display:flex;justify-content:space-between;align-items:center">' +
            '<div id="ct-preset-editor-title" style="font-family:\'Cinzel\',serif;color:var(--gold2)">Create Preset</div>' +
            '<button onclick="this.closest(\'dialog\').close()" style="background:transparent;border:1px solid var(--parch3);color:var(--parch3);padding:4px 10px;border-radius:2px;cursor:pointer;font-family:\'Cinzel\',serif;font-size:11px">Close</button>' +
          '</div>' +
          '<div style="padding:1rem;overflow-y:auto;max-height:75vh">' +
            '<input type="hidden" id="ct-preset-id">' +
            '<label style="display:block;font-family:\'Cinzel\',serif;font-size:10px;color:var(--gold2);letter-spacing:1.5px;margin-bottom:.2rem">NAME</label>' +
            '<input id="ct-preset-name" type="text" style="width:100%;padding:.4rem .6rem;background:rgba(10,8,5,0.6);border:1px solid var(--gold2);color:var(--parch);border-radius:2px;font-size:13px;margin-bottom:.75rem">' +
            '<label style="display:block;font-family:\'Cinzel\',serif;font-size:10px;color:var(--gold2);letter-spacing:1.5px;margin-bottom:.2rem">DESCRIPTION</label>' +
            '<input id="ct-preset-desc" type="text" placeholder="Short description of when this triggers" style="width:100%;padding:.4rem .6rem;background:rgba(10,8,5,0.6);border:1px solid rgba(160,128,64,0.35);color:var(--parch);border-radius:2px;font-size:13px;margin-bottom:.75rem">' +
            '<label style="display:block;font-family:\'Cinzel\',serif;font-size:10px;color:var(--gold2);letter-spacing:1.5px;margin-bottom:.2rem">MONSTERS</label>' +
            '<div id="ct-preset-monster-list" style="margin-bottom:.5rem"></div>' +
            '<button onclick="if(window.CombatTracker) CombatTracker._addMonsterToPresetEditor()" style="background:rgba(201,168,76,0.15);border:1px dashed var(--gold2);color:var(--gold2);padding:.4rem .8rem;border-radius:2px;cursor:pointer;font-family:\'Cinzel\',serif;font-size:11px;margin-bottom:.75rem">+ Add monster</button>' +
            '<label style="display:block;font-family:\'Cinzel\',serif;font-size:10px;color:var(--gold2);letter-spacing:1.5px;margin-bottom:.2rem">NOTES (tactics, terrain, adjustments)</label>' +
            '<textarea id="ct-preset-notes" style="width:100%;min-height:100px;padding:.5rem .6rem;background:rgba(10,8,5,0.6);border:1px solid rgba(160,128,64,0.35);color:var(--parch);border-radius:2px;font-family:\'Crimson Pro\',serif;font-size:12.5px;resize:vertical"></textarea>' +
            '<div style="margin-top:1rem;text-align:right">' +
              '<button onclick="this.closest(\'dialog\').close()" style="background:transparent;border:1px solid var(--parch3);color:var(--parch3);padding:5px 14px;border-radius:2px;cursor:pointer;font-family:\'Cinzel\',serif;font-size:11px;margin-right:.5rem">Cancel</button>' +
              '<button onclick="if(window.CombatTracker) CombatTracker._savePreset()" style="background:var(--gold);color:#0d0a06;border:none;padding:5px 16px;border-radius:2px;cursor:pointer;font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:1px">💾 Save</button>' +
            '</div>' +
          '</div>';
        document.body.appendChild(d4);
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

  // Self-init fallback: if unlockApp's init call was missed or errored,
  // watch for the container to appear and initialize ourselves.
  function trySelfInit() {
    if (CT._container) return true;
    const el = document.getElementById('combat-tracker-container');
    if (el) {
      console.log('[CombatTracker] self-init triggered (unlockApp path did not run me)');
      CT.init('combat-tracker-container');
      return true;
    }
    return false;
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(trySelfInit, 100);
      setTimeout(trySelfInit, 1000);
      setTimeout(trySelfInit, 3000);
    });
  } else {
    setTimeout(trySelfInit, 100);
    setTimeout(trySelfInit, 1000);
    setTimeout(trySelfInit, 3000);
  }
})();
