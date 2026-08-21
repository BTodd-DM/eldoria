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
  const HOMEBREW_PATH = 'monster-homebrew';
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
      try { this._diceHistory = JSON.parse(localStorage.getItem('ct-dice-history') || '[]') || []; } catch (e) { this._diceHistory = []; }
      try { this._render(); } catch (e) { console.error('[CombatTracker] _render threw:', e); this._container.innerHTML = '<div class="alert alert-warn">Combat tracker render error — see console.</div>'; }
      try { this._initSync(); } catch (e) { console.warn('[CombatTracker] _initSync threw:', e); }
      try { this._loadVaultEncounters(); } catch (e) { console.warn('[CombatTracker] _loadVaultEncounters threw:', e); }
      try { this._initPresetsSync(); } catch (e) { console.warn('[CombatTracker] _initPresetsSync threw:', e); }
      try { this._initHomebrewSync(); } catch (e) { console.warn('[CombatTracker] _initHomebrewSync threw:', e); }
    },

    _loadVaultEncounters: function() {
      const self = this;
      fetch(ENCOUNTERS_JSON + '?_=' + Date.now())
        .then(r => r.ok ? r.json() : { encounters: [] })
        .then(data => { self._vaultEncounters = data.encounters || []; })
        .catch(function() {});
      // Also load random encounter tables.
      fetch('data/random-encounters.json?_=' + Date.now())
        .then(r => r.ok ? r.json() : { tables: [] })
        .then(data => { self._randomTables = data.tables || []; })
        .catch(function() { self._randomTables = []; });
      // Also load homebrew monsters — merge into MONSTERS_2024 / MONSTERS_BY_ID.
      fetch('data/homebrew-monsters.json?_=' + Date.now())
        .then(r => r.ok ? r.json() : { monsters: [] })
        .then(data => {
          const hb = data.monsters || [];
          if (typeof MONSTERS_2024 !== 'undefined' && typeof MONSTERS_BY_ID !== 'undefined') {
            hb.forEach(function(m) {
              if (!MONSTERS_BY_ID[m.id]) {
                MONSTERS_2024.push(m);
                MONSTERS_BY_ID[m.id] = m;
              }
            });
            if (hb.length) console.log('[CombatTracker] Merged ' + hb.length + ' homebrew monsters.');
          }
        })
        .catch(function() {});
    },

    _openRandomEncounter: function() {
      if (!this._randomTables || !this._randomTables.length) {
        alert('No random encounter tables loaded. Add .md files to Session Planning/Random Encounters/ in the vault, then re-run tools/generate_random_encounters.py.');
        return;
      }
      const tables = this._randomTables;
      // Simple picker via prompt
      const opts = tables.map(function(t, i) { return (i+1) + '. ' + t.region + ' (' + t.entries.length + ' entries)'; }).join('\n');
      const raw = prompt('Pick a region to roll on:\n\n' + opts + '\n\nEnter number:');
      const idx = parseInt(raw, 10) - 1;
      if (isNaN(idx) || idx < 0 || idx >= tables.length) return;
      const table = tables[idx];
      this._rollRandomEncounter(table);
    },

    _rollRandomEncounter: function(table) {
      const die = table.die || 'd100';
      const sides = parseInt(die.replace(/^d/i, ''), 10) || 100;
      const roll = Math.ceil(Math.random() * sides);
      const hit = (table.entries || []).find(function(e) {
        if (!e.range) return false;
        return roll >= e.range[0] && roll <= e.range[1];
      });
      if (!hit) {
        alert('Rolled ' + roll + ' on ' + table.region + ' — no matching entry (table has gaps). Roll again or fill the range.');
        return;
      }
      const monstersDesc = (hit.monsters || []).map(function(m) { return m.count + '× ' + (m.label || m.id); }).join(', ') || 'no combat';
      const msg = '🎲 ' + table.region + ' — rolled ' + roll + ' on ' + die + '\n\n' +
                  '“' + hit.description + '”\n\n' +
                  'Monsters: ' + monstersDesc + '\n\n' +
                  ((hit.monsters || []).length ? 'OK = load monsters into combat.\nCancel = keep just the description.' : 'OK = acknowledge.');
      if (!confirm(msg)) return;
      if (!(hit.monsters || []).length) return;
      // Load monsters
      const self = this;
      const startFresh = !this._state || !this._state.active;
      if (startFresh) this._startCombat();
      setTimeout(function() {
        (hit.monsters || []).forEach(function(m) {
          if (typeof MONSTERS_BY_ID !== 'undefined' && MONSTERS_BY_ID[m.id]) {
            self._addMonsterFromCatalog(m.id, m.count || 1);
          }
        });
        setTimeout(function() {
          if (self._state && self._state.active) self._log(JSON.parse(JSON.stringify(self._state)), '🎲 Random: ' + table.region + ' → ' + roll + ' — ' + monstersDesc);
        }, 300);
      }, startFresh ? 400 : 0);
    },

    _initHomebrewSync: function() {
      if (typeof firebase === 'undefined' || !firebase.database) return;
      const self = this;
      try {
        this._homebrewRef = firebase.database().ref(HOMEBREW_PATH);
        this._homebrewRef.on('value', function(snap) {
          const data = snap.val() || {};
          self._customMonsters = data;
          // Cache the originals of any base monsters overridden by custom
          // entries, so deleting the override restores the base.
          if (!self._baseMonsterBackup) self._baseMonsterBackup = {};
          if (typeof MONSTERS_2024 !== 'undefined' && typeof MONSTERS_BY_ID !== 'undefined') {
            // 1. Remove any previously-merged custom entries (undo prior overrides).
            for (let i = MONSTERS_2024.length - 1; i >= 0; i--) {
              const m = MONSTERS_2024[i];
              if (m._custom || m._override) {
                delete MONSTERS_BY_ID[m.id];
                MONSTERS_2024.splice(i, 1);
              }
            }
            // 2. Restore backed-up bases (if a previous override was removed).
            Object.keys(self._baseMonsterBackup).forEach(function(id) {
              if (!MONSTERS_BY_ID[id]) {
                MONSTERS_2024.push(self._baseMonsterBackup[id]);
                MONSTERS_BY_ID[id] = self._baseMonsterBackup[id];
              }
            });
            // 3. Merge current custom data. Same-ID = override, new-ID = custom.
            Object.keys(data).forEach(function(id) {
              const base = MONSTERS_BY_ID[id];
              if (base && !base._custom && !base._override) {
                // Override — cache the base first, then swap in the custom.
                self._baseMonsterBackup[id] = base;
                const idx = MONSTERS_2024.indexOf(base);
                if (idx >= 0) MONSTERS_2024.splice(idx, 1);
                delete MONSTERS_BY_ID[id];
              }
              const m = Object.assign({}, data[id], { id: id });
              if (self._baseMonsterBackup[id]) { m._override = true; m._overrideOf = self._baseMonsterBackup[id].name; }
              else { m._custom = true; }
              MONSTERS_2024.push(m);
              MONSTERS_BY_ID[id] = m;
            });
            console.log('[CombatTracker] Loaded ' + Object.keys(data).length + ' custom entries (' + MONSTERS_2024.filter(function(x){return x._override;}).length + ' overrides).');
          }
        });
      } catch (e) { console.warn('[CombatTracker] Homebrew sync failed:', e); }
    },

    _openMonsterForm: function(existingId) {
      const dlg = document.getElementById('ct-monster-form');
      if (!dlg) return;
      // Look up existing entry: prefer custom/override, else fall back to
      // the merged catalog (fork a base or homebrew monster into an override).
      let existing = null;
      let isForkFromBase = false;
      if (existingId) {
        existing = (this._customMonsters || {})[existingId];
        if (!existing && typeof MONSTERS_BY_ID !== 'undefined' && MONSTERS_BY_ID[existingId]) {
          existing = MONSTERS_BY_ID[existingId];
          isForkFromBase = !existing._custom && !existing._override;
        }
      }
      document.getElementById('ct-mf-title').textContent = existing
        ? (isForkFromBase ? 'Edit — creates override of "' + (existing.name || existingId) + '"' : 'Edit Custom Monster')
        : 'Create Custom Monster';
      document.getElementById('ct-mf-oldid').value = existingId || '';
      const set = function(field, val) { const el = document.getElementById('ct-mf-' + field); if (el) el.value = val == null ? '' : val; };
      const m = existing || {};
      set('id', existingId || '');
      set('name', m.name);
      set('size', m.size || 'Medium');
      set('type', m.type);
      set('alignment', m.alignment);
      set('ac', m.ac);
      set('hp', m.hp);
      set('hpFormula', m.hpFormula);
      set('speed', m.speed || '30 ft.');
      set('str', m.str || 10); set('dex', m.dex || 10); set('con', m.con || 10);
      set('int', m.int || 10); set('wis', m.wis || 10); set('cha', m.cha || 10);
      set('saves', m.saves ? JSON.stringify(m.saves) : '');
      set('skills', m.skills ? JSON.stringify(m.skills) : '');
      set('senses', m.senses);
      set('languages', m.languages);
      set('cr', m.cr);
      set('xp', m.xp);
      set('damageResist', m.damageResist);
      set('damageImmune', m.damageImmune);
      set('damageVuln', m.damageVuln);
      set('conditionImmune', m.conditionImmune);
      set('traits', (m.traits || []).map(function(t) { return t.name + ' :: ' + t.desc; }).join('\n'));
      set('actions', (m.actions || []).map(function(t) { return t.name + ' :: ' + t.desc; }).join('\n'));
      set('bonusActions', (m.bonusActions || []).map(function(t) { return t.name + ' :: ' + t.desc; }).join('\n'));
      set('reactions', (m.reactions || []).map(function(t) { return t.name + ' :: ' + t.desc; }).join('\n'));
      set('legendaryActions', (m.legendaryActions || []).map(function(t) { return t.name + ' :: ' + t.desc; }).join('\n'));
      set('source', m.source);
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    },

    _saveMonsterForm: function() {
      const get = function(field) { const el = document.getElementById('ct-mf-' + field); return el ? String(el.value || '').trim() : ''; };
      const getNum = function(field) { const v = parseInt(get(field), 10); return isNaN(v) ? null : v; };
      const parseBlocks = function(field) {
        const raw = get(field);
        if (!raw) return [];
        return raw.split('\n').map(function(line) {
          const parts = line.split('::');
          if (parts.length < 2) return null;
          return { name: parts[0].trim(), desc: parts.slice(1).join('::').trim() };
        }).filter(function(x) { return x && x.name; });
      };
      const parseJson = function(field) {
        const raw = get(field);
        if (!raw) return null;
        try { return JSON.parse(raw); } catch (e) { return null; }
      };
      const id = get('id').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      if (!id) { alert('ID is required (kebab-case, letters/numbers/-/_)'); return; }
      const name = get('name');
      if (!name) { alert('Name is required.'); return; }
      const oldId = get('oldid');
      // Same-ID as a base catalog entry is allowed — it becomes an
      // OVERRIDE (base is preserved, restorable via ✕ Revert).
      const m = {
        name: name, size: get('size') || 'Medium', type: get('type'),
        alignment: get('alignment'),
        ac: getNum('ac'), hp: getNum('hp'), hpFormula: get('hpFormula'),
        speed: get('speed') || '30 ft.',
        str: getNum('str') || 10, dex: getNum('dex') || 10, con: getNum('con') || 10,
        int: getNum('int') || 10, wis: getNum('wis') || 10, cha: getNum('cha') || 10,
        senses: get('senses'), languages: get('languages'),
        cr: get('cr'), xp: getNum('xp'),
        damageResist: get('damageResist'), damageImmune: get('damageImmune'),
        damageVuln: get('damageVuln'), conditionImmune: get('conditionImmune'),
        traits: parseBlocks('traits'),
        actions: parseBlocks('actions'),
        bonusActions: parseBlocks('bonusActions'),
        reactions: parseBlocks('reactions'),
        legendaryActions: parseBlocks('legendaryActions'),
        source: get('source') || 'Custom',
        _custom: true, updatedAt: Date.now()
      };
      const savesJson = parseJson('saves'); if (savesJson) m.saves = savesJson;
      const skillsJson = parseJson('skills'); if (skillsJson) m.skills = skillsJson;
      if (m.ac == null || m.hp == null || !m.cr) { alert('AC, HP, and CR are required.'); return; }
      if (!this._homebrewRef) { alert('Firebase unavailable — cannot save.'); return; }
      const self = this;
      // If renaming, delete old ID first.
      const writes = [];
      if (oldId && oldId !== id) writes.push(this._homebrewRef.child(oldId).remove());
      writes.push(this._homebrewRef.child(id).set(m));
      Promise.all(writes).then(function() {
        document.getElementById('ct-monster-form').close();
        // If picker is open, refresh it.
        const picker = document.getElementById('ct-monster-picker');
        if (picker && picker.open) self._openMonsterPicker();
      }).catch(function(e) { alert('Save failed: ' + (e && e.message || e)); });
    },

    _deleteCustomMonster: function(id) {
      if (!confirm('Delete custom monster "' + id + '"?\n\nThis cannot be undone.')) return;
      if (!this._homebrewRef) return;
      this._homebrewRef.child(id).remove().then(function() {
        const picker = document.getElementById('ct-monster-picker');
        if (picker && picker.open && window.CombatTracker) CombatTracker._openMonsterPicker();
      });
    },

    _duplicateCustomMonster: function(id) {
      const src = (this._customMonsters || {})[id];
      if (!src) return;
      // Open form pre-populated with source data but blank ID for user to name.
      this._openMonsterForm(id);
      // Then clear the ID field so user must pick a new one.
      setTimeout(function() {
        const idEl = document.getElementById('ct-mf-id');
        const oldIdEl = document.getElementById('ct-mf-oldid');
        if (idEl) idEl.value = id + '_copy';
        if (oldIdEl) oldIdEl.value = '';
      }, 50);
    },

    _exportCustomMonsterMd: function(id) {
      const m = (this._customMonsters || {})[id];
      if (!m) return;
      // Build a homebrew-monster .md file for the vault.
      const yamlLines = ['---'];
      yamlLines.push('id: ' + id);
      ['name','size','type','alignment','ac','hp','hpFormula','speed','str','dex','con','int','wis','cha','senses','languages','cr','xp','damageResist','damageImmune','damageVuln','conditionImmune','source'].forEach(function(k) {
        if (m[k] != null && m[k] !== '') yamlLines.push(k + ': ' + (typeof m[k] === 'string' ? JSON.stringify(m[k]) : m[k]));
      });
      if (m.saves) yamlLines.push('saves: ' + JSON.stringify(m.saves));
      if (m.skills) yamlLines.push('skills: ' + JSON.stringify(m.skills));
      ['traits','actions','bonusActions','reactions','legendaryActions'].forEach(function(k) {
        if (!m[k] || !m[k].length) return;
        yamlLines.push(k + ':');
        m[k].forEach(function(t) {
          yamlLines.push('  - name: ' + JSON.stringify(t.name));
          yamlLines.push('    desc: ' + JSON.stringify(t.desc));
        });
      });
      yamlLines.push('---');
      yamlLines.push('');
      yamlLines.push('# ' + (m.name || id));
      yamlLines.push('');
      yamlLines.push('Custom monster — exported from combat tracker.');
      const content = yamlLines.join('\n');
      const blob = new Blob([content], { type: 'text/markdown' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (m.name || id).replace(/[^a-zA-Z0-9]+/g, ' ').trim() + '.md';
      a.click();
      setTimeout(function() { URL.revokeObjectURL(a.href); }, 1000);
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
      const s = this._state || {};
      const combatants = s.combatants || [];
      // Compute XP from dead monsters
      const xpBreakdown = this._computeXpBreakdown(combatants);
      const totalXp = xpBreakdown.reduce(function(a, b) { return a + b.xp; }, 0);
      const alivePcs = combatants.filter(function(c) { return c.kind === 'pc' && !c.dead; });
      let msg = 'End the current encounter?\n\n';
      if (xpBreakdown.length) {
        msg += 'Monsters defeated:\n';
        xpBreakdown.forEach(function(b) { msg += '  · ' + b.count + '× ' + b.name + ' — ' + (b.xp || 0) + ' XP\n'; });
        msg += '\nTotal: ' + totalXp + ' XP';
        if (alivePcs.length) {
          const share = Math.floor(totalXp / alivePcs.length);
          msg += ' → ' + share + ' XP each to ' + alivePcs.length + ' surviving PC' + (alivePcs.length === 1 ? '' : 's') + '.';
        }
        msg += '\n\nOK = end combat AND award XP.\nCancel = keep encounter open.';
      } else {
        msg += 'No monsters defeated (no XP to award).\n\nOK = end combat.\nCancel = keep encounter open.';
      }
      if (!confirm(msg)) return;
      // Award XP
      if (totalXp > 0 && alivePcs.length) {
        this._awardXp(totalXp, alivePcs, xpBreakdown);
      }
      this._write({ active: false, round: s.round || 0, combatants: combatants, log: s.log || [], endedAt: Date.now(), lastXpAward: totalXp });
    },

    // Encounter difficulty per 2024 DMG guidance (approximate).
    // Party XP budget per PC by level: easy/medium/hard/deadly.
    // These are per-PC single-encounter budgets.
    _pcBudgets: [
      null, {e:25,m:50,h:75,d:100},{e:50,m:100,h:150,d:200},{e:75,m:150,h:225,d:400},
      {e:125,m:250,h:375,d:500},{e:250,m:500,h:750,d:1100},{e:300,m:600,h:900,d:1400},
      {e:350,m:750,h:1100,d:1700},{e:450,m:900,h:1400,d:2100},{e:550,m:1100,h:1600,d:2400},
      {e:600,m:1200,h:1900,d:2800},{e:800,m:1600,h:2400,d:3600},{e:1000,m:2000,h:3000,d:4500},
      {e:1100,m:2200,h:3400,d:5100},{e:1250,m:2500,h:3800,d:5700},{e:1400,m:2800,h:4300,d:6400},
      {e:1600,m:3200,h:4800,d:7200},{e:2000,m:3900,h:5900,d:8800},{e:2100,m:4200,h:6300,d:9500},
      {e:2400,m:4900,h:7300,d:10900},{e:2800,m:5700,h:8500,d:12700}
    ],
    _encounterMult: function(count) {
      // 2024 uses simpler flat multipliers; 2014 had a table. This is a
      // reasonable middle ground.
      if (count <= 1) return 1;
      if (count === 2) return 1.5;
      if (count <= 6) return 2;
      if (count <= 10) return 2.5;
      return 3;
    },
    _computeEncounterDifficulty: function(combatants, opts) {
      opts = opts || {};
      const partyLevel = opts.partyLevel || 6;
      const partySize = opts.partySize || 3;
      let rawXp = 0, monsterCount = 0;
      combatants.forEach(function(c) {
        if (c.kind !== 'monster') return;
        let xp = 0;
        if (c.monsterId && typeof MONSTERS_BY_ID !== 'undefined' && MONSTERS_BY_ID[c.monsterId]) {
          xp = MONSTERS_BY_ID[c.monsterId].xp || 0;
        }
        rawXp += xp;
        monsterCount++;
      });
      const mult = this._encounterMult(monsterCount);
      const adjXp = Math.floor(rawXp * mult);
      const budget = this._pcBudgets[Math.min(20, Math.max(1, partyLevel))];
      if (!budget) return { rawXp: rawXp, adjXp: adjXp, mult: mult, tier: 'trivial', count: monsterCount };
      const easy = budget.e * partySize;
      const med = budget.m * partySize;
      const hard = budget.h * partySize;
      const deadly = budget.d * partySize;
      let tier = 'trivial';
      if (adjXp >= deadly) tier = 'deadly';
      else if (adjXp >= hard) tier = 'hard';
      else if (adjXp >= med) tier = 'medium';
      else if (adjXp >= easy) tier = 'easy';
      return { rawXp: rawXp, adjXp: adjXp, mult: mult, tier: tier, count: monsterCount,
               budgets: { easy: easy, medium: med, hard: hard, deadly: deadly } };
    },

    _renderDifficultyBadge: function(combatants) {
      const d = this._computeEncounterDifficulty(combatants);
      if (!d.count) return '';
      const colors = { trivial: '#7f7f7f', easy: '#7fdb7f', medium: '#e0c060', hard: '#e08040', deadly: '#f47070' };
      const tierLabel = d.tier.charAt(0).toUpperCase() + d.tier.slice(1);
      return ' &nbsp;·&nbsp; <span title="Adjusted XP ' + d.adjXp + ' (raw ' + d.rawXp + ' × ' + d.mult + '). Assumes party level 6 × 3." style="color:' + colors[d.tier] + '">' + tierLabel + ' · ' + d.adjXp + ' XP</span>';
    },

    _computeXpBreakdown: function(combatants) {
      const groups = {};
      combatants.forEach(function(c) {
        if (c.kind !== 'monster' || !c.dead) return;
        // Strip trailing " #N" number so multiples group.
        const baseName = (c.name || '').replace(/\s+#\d+$/, '').trim();
        const key = c.monsterId || baseName;
        if (!groups[key]) {
          let xp = 0;
          if (c.monsterId && typeof MONSTERS_BY_ID !== 'undefined' && MONSTERS_BY_ID[c.monsterId]) {
            xp = MONSTERS_BY_ID[c.monsterId].xp || 0;
          }
          groups[key] = { name: baseName, xp: 0, unit: xp, count: 0 };
        }
        groups[key].count += 1;
        groups[key].xp += groups[key].unit;
      });
      return Object.keys(groups).map(function(k) { return groups[k]; }).sort(function(a, b) { return b.xp - a.xp; });
    },

    _awardXp: function(totalXp, alivePcs, breakdown) {
      if (typeof firebase === 'undefined' || !firebase.database) return;
      const share = Math.floor(totalXp / alivePcs.length);
      const now = Date.now();
      const entry = {
        amount: share, total: totalXp, when: now,
        source: breakdown.map(function(b) { return b.count + '× ' + b.name; }).join(', ')
      };
      const ledger = firebase.database().ref('xp-ledger');
      alivePcs.forEach(function(pc) {
        const pcRef = ledger.child(pc.pcId || pc.id);
        pcRef.child('entries').push(entry);
        pcRef.child('total').transaction(function(cur) { return (cur || 0) + share; });
      });
    },

    _openXpLedger: function() {
      const dlg = document.getElementById('ct-xp-ledger-dialog');
      if (!dlg) return;
      const body = document.getElementById('ct-xp-ledger-body');
      if (!body) return;
      body.innerHTML = '<div style="text-align:center;color:var(--parch3);padding:1rem">Loading…</div>';
      if (typeof firebase === 'undefined' || !firebase.database) { body.innerHTML = '<div style="color:var(--parch3)">Firebase unavailable.</div>'; }
      else {
        firebase.database().ref('xp-ledger').once('value').then(function(snap) {
          const data = snap.val() || {};
          const pcIds = PC_IDS.slice();
          let html = '';
          pcIds.forEach(function(pcId) {
            const pcData = data[pcId] || {};
            const total = pcData.total || 0;
            const name = (typeof CHARACTERS !== 'undefined' && CHARACTERS[pcId] && CHARACTERS[pcId].name) || pcId;
            const entriesObj = pcData.entries || {};
            const entries = Object.keys(entriesObj).map(function(k) { return entriesObj[k]; }).sort(function(a, b) { return (b.when || 0) - (a.when || 0); });
            html += '<div style="border:1px solid var(--gold2);border-radius:4px;padding:.6rem .75rem;margin-bottom:.75rem;background:rgba(20,14,6,0.4)">';
            html += '<div style="display:flex;justify-content:space-between;align-items:baseline"><div style="font-family:\'Cinzel\',serif;color:var(--gold2);font-size:14px">' + escapeHtml(name) + '</div>';
            html += '<div style="font-family:\'Cinzel\',serif;color:var(--gold);font-size:16px">' + total.toLocaleString() + ' XP</div></div>';
            if (entries.length) {
              html += '<div style="margin-top:.5rem;font-size:11.5px;color:var(--parch2);max-height:180px;overflow-y:auto">';
              entries.slice(0, 20).forEach(function(e) {
                const d = new Date(e.when || 0);
                const when = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                html += '<div style="padding:.25rem 0;border-top:1px dashed rgba(160,128,64,0.2)">' +
                  '<span style="color:var(--gold)">+' + (e.amount || 0) + '</span> · <span style="color:var(--parch3)">' + when + '</span><br>' +
                  '<span style="font-style:italic;color:var(--parch3)">' + escapeHtml(e.source || '') + '</span></div>';
              });
              html += '</div>';
            } else {
              html += '<div style="margin-top:.4rem;font-size:11px;color:var(--parch3);font-style:italic">No XP awarded yet.</div>';
            }
            html += '</div>';
          });
          html += '<div style="text-align:center;margin-top:.5rem"><button class="action-btn" onclick="if(window.CombatTracker) CombatTracker._resetXpLedger()" style="border-color:#a02020;color:#e0a0a0">Reset ledger</button></div>';
          body.innerHTML = html;
        }).catch(function(e) { body.innerHTML = '<div style="color:var(--parch3)">Load failed: ' + escapeHtml(e && e.message || String(e)) + '</div>'; });
      }
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    },

    _openDiceRoller: function() {
      const dlg = document.getElementById('ct-dice-dialog');
      if (!dlg) return;
      this._renderDiceRoller();
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    },

    _renderDiceRoller: function() {
      const body = document.getElementById('ct-dice-body');
      if (!body) return;
      const history = this._diceHistory || [];
      const btnRow = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'].map(function(d) {
        return '<button class="action-btn" onclick="if(window.CombatTracker) CombatTracker._rollDice(\'' + d + '\')" style="min-width:52px">' + d + '</button>';
      }).join('');
      const advRow = '<button class="action-btn" onclick="if(window.CombatTracker) CombatTracker._rollDice(\'d20\',{adv:true})">🌟 d20 adv</button>' +
                     '<button class="action-btn" onclick="if(window.CombatTracker) CombatTracker._rollDice(\'d20\',{dis:true})" style="border-color:#a02020;color:#e0a0a0">💀 d20 dis</button>';
      body.innerHTML =
        '<div style="display:flex;gap:.35rem;flex-wrap:wrap;margin-bottom:.5rem">' + btnRow + '</div>' +
        '<div style="display:flex;gap:.35rem;flex-wrap:wrap;margin-bottom:.75rem">' + advRow + '</div>' +
        '<div style="display:flex;gap:.5rem;align-items:center;margin-bottom:.75rem">' +
          '<label style="font-family:\'Cinzel\',serif;font-size:11px;color:var(--gold2)">Custom:</label>' +
          '<input id="ct-dice-custom" type="text" placeholder="2d6+3" value="1d20" style="width:110px;padding:.3rem .5rem;background:rgba(10,8,5,0.6);border:1px solid var(--gold2);color:var(--parch);border-radius:2px" onkeydown="if(event.key===\'Enter\')CombatTracker._rollCustom()">' +
          '<button class="action-btn" onclick="if(window.CombatTracker) CombatTracker._rollCustom()">🎲 Roll</button>' +
          '<button class="action-btn" onclick="if(window.CombatTracker) CombatTracker._clearDiceHistory()" style="margin-left:auto">Clear log</button>' +
        '</div>' +
        '<div style="font-family:\'Cinzel\',serif;font-size:10px;color:var(--gold2);letter-spacing:1.5px;margin-bottom:.4rem">HISTORY (last 20)</div>' +
        '<div style="max-height:280px;overflow-y:auto;font-size:12.5px">' +
          (history.length
            ? history.slice(0, 20).map(function(h) {
                const d = new Date(h.t);
                const when = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                return '<div style="padding:.3rem 0;border-top:1px dashed rgba(160,128,64,0.2)">' +
                  '<span style="color:var(--parch3)">' + when + '</span> · <span style="color:var(--gold)">' + escapeHtml(h.expr) + '</span> → <strong style="color:' + (h.crit === 20 ? '#7fdb7f' : h.crit === 1 ? '#f47070' : 'var(--parch1)') + '">' + h.total + '</strong>' +
                  (h.detail ? ' <span style="color:var(--parch3);font-size:11px">[' + escapeHtml(h.detail) + ']</span>' : '') +
                  '</div>';
              }).join('')
            : '<div style="color:var(--parch3);font-style:italic">No rolls yet.</div>') +
        '</div>';
    },

    _rollDice: function(die, opts) {
      opts = opts || {};
      const sides = parseInt(die.replace('d', ''), 10);
      if (!sides) return;
      let expr = '1' + die, total = 0, detail = '';
      if (opts.adv || opts.dis) {
        const r1 = Math.ceil(Math.random() * sides);
        const r2 = Math.ceil(Math.random() * sides);
        total = opts.adv ? Math.max(r1, r2) : Math.min(r1, r2);
        expr = die + (opts.adv ? ' (adv)' : ' (dis)');
        detail = r1 + ', ' + r2;
      } else {
        total = Math.ceil(Math.random() * sides);
      }
      this._pushDiceHistory({ t: Date.now(), expr: expr, total: total, detail: detail, crit: (sides === 20 && !opts.adv && !opts.dis) ? total : null });
      this._renderDiceRoller();
    },

    _rollCustom: function() {
      const el = document.getElementById('ct-dice-custom');
      if (!el) return;
      const expr = String(el.value || '').trim();
      const m = expr.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
      if (!m) { alert('Format: NdM or NdM+K (e.g. 2d6+3)'); return; }
      const n = parseInt(m[1], 10), sides = parseInt(m[2], 10), mod = parseInt(m[3] || '0', 10);
      if (n < 1 || n > 100 || sides < 2 || sides > 1000) { alert('Out of range.'); return; }
      const rolls = [];
      let sum = 0;
      for (let i = 0; i < n; i++) { const r = Math.ceil(Math.random() * sides); rolls.push(r); sum += r; }
      const total = sum + mod;
      this._pushDiceHistory({ t: Date.now(), expr: expr, total: total, detail: rolls.join(', ') + (mod ? ' (' + (mod > 0 ? '+' : '') + mod + ')' : ''), crit: null });
      this._renderDiceRoller();
    },

    _pushDiceHistory: function(entry) {
      this._diceHistory = this._diceHistory || [];
      this._diceHistory.unshift(entry);
      if (this._diceHistory.length > 50) this._diceHistory = this._diceHistory.slice(0, 50);
      try { localStorage.setItem('ct-dice-history', JSON.stringify(this._diceHistory.slice(0, 50))); } catch (e) {}
    },

    _clearDiceHistory: function() {
      if (!confirm('Clear dice history?')) return;
      this._diceHistory = [];
      try { localStorage.removeItem('ct-dice-history'); } catch (e) {}
      this._renderDiceRoller();
    },

    _resetXpLedger: function() {
      if (!confirm('Reset the ENTIRE XP ledger for all PCs?\n\nThis cannot be undone.')) return;
      if (typeof firebase === 'undefined' || !firebase.database) return;
      firebase.database().ref('xp-ledger').remove().then(function() {
        alert('XP ledger reset.');
        if (window.CombatTracker) CombatTracker._openXpLedger();
      });
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

    // ------------------------------------------------------------
    // 📚 Full monster catalog browser — search / sort / filter / encounter calc
    // ------------------------------------------------------------
    _browserState: { search: '', sort: 'name', typeFilter: null, crBand: null, sourceFilter: null, envFilter: null, roleFilter: null, selected: {} },

    _openBrowser: function() {
      const dlg = document.getElementById('ct-browser-dialog');
      if (!dlg) return;
      this._browserState.selected = {}; // reset encounter-calc selection each open
      this._renderBrowser();
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    },

    _renderBrowser: function() {
      const body = document.getElementById('ct-browser-body');
      if (!body || typeof MONSTERS_2024 === 'undefined') return;
      const st = this._browserState;
      const self = this;
      const search = (st.search || '').toLowerCase();

      // Filter
      function crBandMatch(cr, band) {
        if (!band) return true;
        const n = parseFloat(String(cr).replace('1/8','0.125').replace('1/4','0.25').replace('1/2','0.5'));
        if (isNaN(n)) return false;
        if (band === '0-1')   return n <= 1;
        if (band === '2-4')   return n >= 2 && n <= 4;
        if (band === '5-9')   return n >= 5 && n <= 9;
        if (band === '10-14') return n >= 10 && n <= 14;
        if (band === '15-20') return n >= 15 && n <= 20;
        if (band === '21+')   return n >= 21;
        return true;
      }
      function sourceOf(m) {
        if (m._override) return 'override';
        if (m._custom)   return 'custom';
        if (m.homebrew)  return 'homebrew';
        return 'base';
      }
      const filtered = MONSTERS_2024.slice().filter(function(m) {
        if (search && (m.name || '').toLowerCase().indexOf(search) === -1) return false;
        if (st.typeFilter && (m.type || '').toLowerCase().indexOf(st.typeFilter) === -1) return false;
        if (!crBandMatch(m.cr, st.crBand)) return false;
        if (st.sourceFilter && sourceOf(m) !== st.sourceFilter) return false;
        if (st.envFilter) {
          const envs = Array.isArray(m.environment) ? m.environment.map(function(e){return String(e).toLowerCase();}) : [];
          if (envs.indexOf(st.envFilter) === -1) return false;
        }
        if (st.roleFilter && String(m.role || '').toLowerCase() !== st.roleFilter) return false;
        return true;
      });

      // Sort
      function crNum(m) { return parseFloat(String(m.cr).replace('1/8','0.125').replace('1/4','0.25').replace('1/2','0.5')) || 0; }
      const SIZE_ORD = { 'Tiny':0, 'Small':1, 'Medium':2, 'Large':3, 'Huge':4, 'Gargantuan':5 };
      if (st.sort === 'name')      filtered.sort(function(a,b){ return (a.name||'').localeCompare(b.name||''); });
      else if (st.sort === 'cr-asc')  filtered.sort(function(a,b){ return crNum(a) - crNum(b) || (a.name||'').localeCompare(b.name||''); });
      else if (st.sort === 'cr-desc') filtered.sort(function(a,b){ return crNum(b) - crNum(a) || (a.name||'').localeCompare(b.name||''); });
      else if (st.sort === 'xp')      filtered.sort(function(a,b){ return (b.xp||0) - (a.xp||0); });
      else if (st.sort === 'size')    filtered.sort(function(a,b){ return (SIZE_ORD[a.size]||0) - (SIZE_ORD[b.size]||0); });

      // Encounter-budget calc from selected checkboxes
      const selected = Object.keys(st.selected).map(function(id) { return { id: id, qty: st.selected[id] }; }).filter(function(x){ return x.qty > 0; });
      let calcHtml = '';
      if (selected.length) {
        const combatants = [];
        selected.forEach(function(s) {
          const m = MONSTERS_BY_ID[s.id];
          if (!m) return;
          for (let i = 0; i < s.qty; i++) combatants.push({ kind: 'monster', monsterId: s.id });
        });
        const d = self._computeEncounterDifficulty(combatants);
        const colors = { trivial: '#7f7f7f', easy: '#7fdb7f', medium: '#e0c060', hard: '#e08040', deadly: '#f47070' };
        const tierLabel = d.tier.charAt(0).toUpperCase() + d.tier.slice(1);
        const detail = selected.map(function(s){ const m=MONSTERS_BY_ID[s.id]; return s.qty+'× '+(m?m.name:s.id); }).join(', ');
        calcHtml = '<div style="margin-top:.5rem;padding:.5rem .75rem;background:rgba(20,14,6,0.5);border:1px solid var(--gold2);border-radius:3px;font-size:12px">' +
          '<div style="font-family:\'Cinzel\',serif;color:var(--gold2);font-size:11px;letter-spacing:1px;margin-bottom:.25rem">ENCOUNTER CALC (party level 6 × 3)</div>' +
          '<div>' + detail + '</div>' +
          '<div style="margin-top:.3rem">Raw XP: <strong>' + d.rawXp + '</strong> &nbsp;·&nbsp; Adjusted: <strong>' + d.adjXp + '</strong> (×' + d.mult + ') &nbsp;·&nbsp; <strong style="color:' + colors[d.tier] + '">' + tierLabel + '</strong></div>' +
          '<div style="margin-top:.35rem;display:flex;gap:.4rem;flex-wrap:wrap">' +
            '<button class="action-btn" onclick="if(window.CombatTracker) CombatTracker._loadBrowserSelectionIntoCombat()" style="background:var(--gold);color:var(--ink);border-color:var(--gold)">⚔ Load selection into combat</button>' +
            '<button class="action-btn" onclick="if(window.CombatTracker){CombatTracker._browserState.selected={};CombatTracker._renderBrowser();}">Clear selection</button>' +
          '</div>' +
        '</div>';
      }

      function chip(label, active, onclick) {
        return '<button onclick="' + onclick + '" style="background:' + (active ? 'var(--gold)' : 'transparent') + ';color:' + (active ? 'var(--ink)' : 'var(--parch)') + ';border:1px solid var(--gold2);padding:2px 8px;border-radius:10px;font-family:\'Cinzel\',serif;font-size:9.5px;letter-spacing:.5px;cursor:pointer;margin-right:3px;margin-bottom:3px">' + label + '</button>';
      }
      function tf(v) { return 'if(window.CombatTracker){CombatTracker._browserState.typeFilter=' + (v?"'"+v+"'":null) + ';CombatTracker._renderBrowser();}'; }
      function bf(v) { return 'if(window.CombatTracker){CombatTracker._browserState.crBand=' + (v?"'"+v+"'":null) + ';CombatTracker._renderBrowser();}'; }
      function sf(v) { return 'if(window.CombatTracker){CombatTracker._browserState.sourceFilter=' + (v?"'"+v+"'":null) + ';CombatTracker._renderBrowser();}'; }
      function ef(v) { return 'if(window.CombatTracker){CombatTracker._browserState.envFilter=' + (v?"'"+v+"'":null) + ';CombatTracker._renderBrowser();}'; }
      function rf(v) { return 'if(window.CombatTracker){CombatTracker._browserState.roleFilter=' + (v?"'"+v+"'":null) + ';CombatTracker._renderBrowser();}'; }

      const types = ['humanoid','beast','fiend','undead','dragon','fey','elemental','plant','ooze','construct','aberration','monstrosity','giant'];
      const crBands = ['0-1','2-4','5-9','10-14','15-20','21+'];
      const sources = ['base','homebrew','custom','override'];
      const envs = ['urban','forest','marsh','underground','mountain','arctic','ruins','planar','any'];
      const roles = ['brute','skirmisher','ambusher','caster','controller','soldier','support','boss','other'];

      let html = '<div style="padding:.6rem .75rem;border-bottom:1px solid rgba(160,128,64,0.35)">' +
        '<div style="display:flex;gap:.4rem;align-items:center;margin-bottom:.4rem">' +
          '<input type="text" placeholder="Search…" value="' + escapeAttr(st.search) + '" oninput="if(window.CombatTracker){CombatTracker._browserState.search=this.value;CombatTracker._renderBrowser();this.focus();}" style="flex:1;padding:.35rem .6rem;background:rgba(10,8,5,0.6);border:1px solid var(--gold2);color:var(--parch);border-radius:2px" autofocus>' +
          '<label style="font-size:10px;color:var(--parch3)">Sort:</label>' +
          '<select onchange="if(window.CombatTracker){CombatTracker._browserState.sort=this.value;CombatTracker._renderBrowser();}" style="padding:.3rem .5rem;background:rgba(10,8,5,0.6);border:1px solid var(--gold2);color:var(--parch);border-radius:2px;font-size:11px">' +
            ['name','cr-asc','cr-desc','xp','size'].map(function(s){ const sel = st.sort===s?' selected':''; const lbl = {name:'Name',['cr-asc']:'CR ↑',['cr-desc']:'CR ↓',xp:'XP',size:'Size'}[s]; return '<option value="'+s+'"'+sel+'>'+lbl+'</option>'; }).join('') +
          '</select>' +
        '</div>' +
        '<div style="font-size:10px;color:var(--parch4);margin:.25rem 0 .15rem;font-family:\'Cinzel\',serif;letter-spacing:1px">TYPE</div><div>' +
          chip('All', !st.typeFilter, tf(null)) + types.map(function(t){ return chip(t, st.typeFilter===t, tf(t)); }).join('') + '</div>' +
        '<div style="font-size:10px;color:var(--parch4);margin:.25rem 0 .15rem;font-family:\'Cinzel\',serif;letter-spacing:1px">CR</div><div>' +
          chip('All', !st.crBand, bf(null)) + crBands.map(function(b){ return chip(b, st.crBand===b, bf(b)); }).join('') + '</div>' +
        '<div style="font-size:10px;color:var(--parch4);margin:.25rem 0 .15rem;font-family:\'Cinzel\',serif;letter-spacing:1px">SOURCE</div><div>' +
          chip('All', !st.sourceFilter, sf(null)) + sources.map(function(s){ return chip(s, st.sourceFilter===s, sf(s)); }).join('') + '</div>' +
        '<div style="font-size:10px;color:var(--parch4);margin:.25rem 0 .15rem;font-family:\'Cinzel\',serif;letter-spacing:1px">ENVIRONMENT</div><div>' +
          chip('All', !st.envFilter, ef(null)) + envs.map(function(e){ return chip(e, st.envFilter===e, ef(e)); }).join('') + '</div>' +
        '<div style="font-size:10px;color:var(--parch4);margin:.25rem 0 .15rem;font-family:\'Cinzel\',serif;letter-spacing:1px">ROLE</div><div>' +
          chip('All', !st.roleFilter, rf(null)) + roles.map(function(r){ return chip(r, st.roleFilter===r, rf(r)); }).join('') + '</div>' +
        '<div style="margin-top:.4rem;font-size:11px;color:var(--parch3);font-style:italic">' + filtered.length + ' of ' + MONSTERS_2024.length + ' monsters</div>' +
        calcHtml +
      '</div>';

      // List
      html += '<div style="overflow-y:auto;flex:1;padding:.35rem .75rem">';
      if (!filtered.length) {
        html += '<div style="text-align:center;color:var(--parch3);padding:1rem;font-style:italic">No monsters match your filters.</div>';
      } else {
        filtered.forEach(function(m) {
          const src = sourceOf(m);
          const badge = (src !== 'base') ? '<span style="background:rgba(160,128,64,0.15);color:var(--parch3);font-size:9px;padding:1px 5px;border-radius:2px;font-family:\'Cinzel\',serif;letter-spacing:1px;margin-left:.35rem">' + src.toUpperCase() + '</span>' : '';
          const envLine = Array.isArray(m.environment) && m.environment.length ? ' · ' + m.environment.join(', ') : '';
          const roleLine = m.role ? ' · ' + m.role : '';
          const qty = self._browserState.selected[m.id] || 0;
          html += '<div data-mid="' + escapeAttr(m.id) + '" style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;padding:.4rem .5rem;border-bottom:1px dashed rgba(160,128,64,0.2);cursor:pointer" onclick="if(window.CombatTracker) CombatTracker._openStatBlock(\'' + escapeAttr(m.id) + '\')">' +
            '<div style="flex:1;min-width:0">' +
              '<div style="font-family:\'Cinzel\',serif;color:var(--gold2);font-size:12.5px">' + escapeHtml(m.name) + badge + '</div>' +
              '<div style="font-size:10.5px;color:var(--parch3)">' + escapeHtml((m.size||'') + ' ' + (m.type||'')) + envLine + roleLine + ' · AC ' + (m.ac||'?') + ' · HP ' + (m.hp||'?') + '</div>' +
            '</div>' +
            '<div style="font-family:\'Cinzel\',serif;font-size:10px;color:var(--parch3);letter-spacing:1px;min-width:60px;text-align:right">CR ' + (m.cr||'?') + '<br><span style="font-size:9px">' + (m.xp||0) + ' XP</span></div>' +
            '<div style="display:flex;gap:.25rem;align-items:center" onclick="event.stopPropagation()">' +
              '<button onclick="if(window.CombatTracker) CombatTracker._browserSelect(\'' + escapeAttr(m.id) + '\',-1)" style="background:transparent;border:1px solid var(--parch3);color:var(--parch3);width:22px;height:22px;border-radius:2px;cursor:pointer">−</button>' +
              '<span style="min-width:20px;text-align:center;font-family:\'Cinzel\',serif;color:var(--gold3)">' + qty + '</span>' +
              '<button onclick="if(window.CombatTracker) CombatTracker._browserSelect(\'' + escapeAttr(m.id) + '\',1)" style="background:transparent;border:1px solid var(--gold2);color:var(--gold2);width:22px;height:22px;border-radius:2px;cursor:pointer">+</button>' +
              '<button onclick="if(window.CombatTracker) CombatTracker._openMonsterForm(\'' + escapeAttr(m.id) + '\')" style="background:transparent;border:1px solid var(--parch3);color:var(--parch3);padding:2px 6px;border-radius:2px;font-size:10px;cursor:pointer">✎</button>' +
            '</div>' +
          '</div>';
        });
      }
      html += '</div>';
      body.innerHTML = html;
    },

    _browserSelect: function(id, delta) {
      const s = this._browserState.selected;
      s[id] = Math.max(0, (s[id] || 0) + delta);
      if (s[id] === 0) delete s[id];
      this._renderBrowser();
    },

    _loadBrowserSelectionIntoCombat: function() {
      const s = this._browserState.selected;
      const self = this;
      if (!this._state || !this._state.active) {
        // Start combat first
        this._startCombat();
      }
      setTimeout(function() {
        Object.keys(s).forEach(function(id) {
          if (typeof MONSTERS_BY_ID !== 'undefined' && MONSTERS_BY_ID[id]) {
            self._addMonsterFromCatalog(id, s[id]);
          }
        });
        self._browserState.selected = {};
        const dlg = document.getElementById('ct-browser-dialog');
        if (dlg && dlg.close) dlg.close();
      }, 400);
    },

    _openMonsterPicker: function() {
      if (typeof MONSTERS_2024 === 'undefined') { alert('Monster catalog not loaded.'); return; }
      const dlg = document.getElementById('ct-monster-picker');
      if (!dlg) return;
      const listEl = document.getElementById('ct-picker-list');
      const self = this;
      listEl.innerHTML = MONSTERS_2024.slice().sort(function(a, b) {
        return String(a.cr).localeCompare(String(b.cr)) || a.name.localeCompare(b.name);
      }).map(function(m) {
        const isCustom = !!m._custom;
        const isOverride = !!m._override;
        const isHomebrew = !!m.homebrew;
        const badge = isOverride
          ? '<span style="background:rgba(224,128,64,0.25);color:#e0a860;font-size:9px;padding:1px 5px;border-radius:2px;font-family:\'Cinzel\',serif;letter-spacing:1px;margin-left:.4rem" title="Custom override of a base monster">OVERRIDE</span>'
          : isCustom
          ? '<span style="background:rgba(160,80,201,0.25);color:#c07adf;font-size:9px;padding:1px 5px;border-radius:2px;font-family:\'Cinzel\',serif;letter-spacing:1px;margin-left:.4rem">CUSTOM</span>'
          : isHomebrew
            ? '<span style="background:rgba(64,168,120,0.25);color:#7fdbaf;font-size:9px;padding:1px 5px;border-radius:2px;font-family:\'Cinzel\',serif;letter-spacing:1px;margin-left:.4rem">HOMEBREW</span>'
            : '';
        // Universal ✎ Edit for every monster. Base monsters get a Fork-as-
        // Override on save; custom/override entries edit in place. Homebrew
        // (vault-sourced) also editable — save creates an override.
        const editBtn = '<button onclick="event.stopPropagation();if(window.CombatTracker) CombatTracker._openMonsterForm(\'' + escapeAttr(m.id) + '\')" style="background:transparent;border:1px solid var(--parch3);color:var(--parch3);padding:1px 6px;border-radius:2px;font-size:10px;cursor:pointer" title="' + (isCustom || isOverride ? 'Edit this custom entry' : 'Fork this monster into a custom override') + '">✎ Edit</button>';
        const dupBtn = '<button onclick="event.stopPropagation();if(window.CombatTracker) CombatTracker._duplicateCustomMonster(\'' + escapeAttr(m.id) + '\')" style="background:transparent;border:1px solid var(--parch3);color:var(--parch3);padding:1px 6px;border-radius:2px;font-size:10px;cursor:pointer">⿻ Duplicate</button>';
        const expBtn = '<button onclick="event.stopPropagation();if(window.CombatTracker) CombatTracker._exportCustomMonsterMd(\'' + escapeAttr(m.id) + '\')" style="background:transparent;border:1px solid var(--parch3);color:var(--parch3);padding:1px 6px;border-radius:2px;font-size:10px;cursor:pointer">⬇ Export .md</button>';
        const delBtn = (isCustom || isOverride)
          ? '<button onclick="event.stopPropagation();if(window.CombatTracker) CombatTracker._deleteCustomMonster(\'' + escapeAttr(m.id) + '\')" style="background:transparent;border:1px solid #a02020;color:#e0a0a0;padding:1px 6px;border-radius:2px;font-size:10px;cursor:pointer" title="' + (isOverride ? 'Delete override (restores the base)' : 'Delete this custom monster') + '">✕ ' + (isOverride ? 'Revert' : 'Delete') + '</button>'
          : '';
        const controls = '<div style="display:flex;gap:.25rem;margin-top:.3rem;flex-wrap:wrap">' + editBtn + dupBtn + expBtn + delBtn + '</div>';
        return '<div class="ct-picker-row" data-mid="' + escapeAttr(m.id) + '" style="padding:.5rem .75rem;border-bottom:1px solid rgba(160,128,64,0.15);cursor:pointer">' +
          '<div style="display:flex;justify-content:space-between;gap:.75rem;align-items:baseline">' +
            '<div><div style="font-family:\'Cinzel\',serif;font-size:12.5px;color:var(--gold2)">' + escapeHtml(m.name) + badge + '</div>' +
            '<div style="font-size:11px;color:var(--parch3)">' + escapeHtml((m.size || '') + ' ' + (m.type || '')) + ' · AC ' + (m.ac || '?') + ' · HP ' + (m.hp || '?') + '</div></div>' +
            '<div style="font-family:\'Cinzel\',serif;font-size:10px;color:var(--parch3);letter-spacing:1px">CR ' + (m.cr || '?') + '</div>' +
          '</div>' +
          controls +
          '</div>';
      }).join('');
      document.getElementById('ct-picker-search').value = '';
      if (dlg.showModal) dlg.showModal();
      else dlg.setAttribute('open', '');
      // Attach click handlers — clicking the row (not the sub-buttons) adds monster.
      listEl.querySelectorAll('.ct-picker-row').forEach(function(row) {
        row.addEventListener('click', function(e) {
          if (e.target.tagName === 'BUTTON') return; // sub-button handled
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
        (legendary ? '<h3 style="font-family:\'Cinzel\',serif;color:#e0a0e0;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;margin:.5rem 0 .3rem;border-bottom:1px solid rgba(200,160,200,0.35)">Legendary Actions</h3><div style="font-size:12.5px;line-height:1.55">' + legendary + '</div>' : '') +
        '<div style="margin-top:.75rem;padding-top:.5rem;border-top:1px solid rgba(160,128,64,0.35);display:flex;gap:.4rem;flex-wrap:wrap">' +
          '<button class="action-btn" onclick="if(window.CombatTracker) CombatTracker._openMonsterForm(\'' + escapeAttr(m.id) + '\')" title="' + ((m._custom || m._override) ? 'Edit this custom entry' : 'Fork this monster into a custom override — the base stays intact') + '">✎ Edit</button>' +
          '<button class="action-btn" onclick="if(window.CombatTracker) CombatTracker._duplicateCustomMonster(\'' + escapeAttr(m.id) + '\')">⿻ Duplicate</button>' +
          (m.source ? '<div style="margin-left:auto;font-size:10px;color:var(--parch4);font-style:italic;align-self:center">' + escapeHtml(m.source) + '</div>' : '') +
        '</div>';
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
            '<button class="action-btn" onclick="if(window.CombatTracker) CombatTracker._openXpLedger()">🏆 XP ledger</button>' +
            '<button class="action-btn" onclick="if(window.CombatTracker) CombatTracker._openDiceRoller()">🎲 Dice roller</button>' +
            '<button class="action-btn" onclick="if(window.CombatTracker) CombatTracker._openRandomEncounter()">🎯 Random encounter</button>' +
            '<button class="action-btn" onclick="if(window.CombatTracker) CombatTracker._openBrowser()">📚 Browse catalog</button>' +
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
          '<div style="font-family:\'Cinzel\',serif;color:var(--gold2);font-size:14px">Round ' + (s.round || 1) + ' &nbsp;·&nbsp; ' + combatants.length + ' combatant' + (combatants.length === 1 ? '' : 's') + this._renderDifficultyBadge(combatants) + '</div>' +
          '<div style="display:flex;gap:.4rem;flex-wrap:wrap">' +
            '<button class="action-btn" onclick="if(window.CombatTracker) CombatTracker._openMonsterPicker()">📖 Add from catalog</button>' +
            '<button class="action-btn" onclick="if(window.CombatTracker) CombatTracker._openBrowser()" title="Full catalog browser — search, sort, filter, encounter calc">📚 Browse catalog</button>' +
            '<button class="action-btn" onclick="if(window.CombatTracker) CombatTracker._addAdhocMonster()">+ Ad-hoc</button>' +
            '<button class="action-btn" onclick="if(window.CombatTracker) CombatTracker._openEncountersModal()">📋 Presets</button>' +
            '<button class="action-btn" onclick="if(window.CombatTracker) CombatTracker._saveCurrentAsPreset()" title="Save current encounter as a preset for later">💾 Save preset</button>' +
            '<button class="action-btn" onclick="if(window.CombatTracker) CombatTracker._syncPCsFromSheets()" title="Re-pull HP/AC from each PC sheet (use after long rest or manual sheet edit)">🔄 Sync PCs</button>' +
            '<button class="action-btn" onclick="if(window.CombatTracker) CombatTracker._rollMonsterInit()" title="Reroll initiative for every monster (PCs untouched — you enter theirs manually)">🎲 Roll monster init</button>' +
            '<button class="action-btn" onclick="if(window.CombatTracker) CombatTracker._openXpLedger()" title="View XP ledger for all PCs">🏆 XP</button>' +
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
            '<div style="display:flex;gap:.4rem">' +
              '<button onclick="if(window.CombatTracker) CombatTracker._openMonsterForm(null)" style="background:var(--gold);color:#0d0a06;border:none;padding:4px 10px;border-radius:2px;cursor:pointer;font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:1px">+ Create custom</button>' +
              '<button onclick="this.closest(\'dialog\').close()" style="background:transparent;border:1px solid var(--parch3);color:var(--parch3);padding:2px 10px;border-radius:2px;cursor:pointer;font-family:\'Cinzel\',serif;font-size:11px">Close</button>' +
            '</div>' +
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
      if (!document.getElementById('ct-xp-ledger-dialog')) {
        const d5 = document.createElement('dialog');
        d5.id = 'ct-xp-ledger-dialog';
        d5.style.cssText = 'max-width:560px;width:92vw;max-height:85vh;padding:0;border:1px solid var(--gold2);background:#0d0a06;color:var(--parch1);border-radius:6px';
        d5.innerHTML =
          '<div style="padding:.75rem 1rem;border-bottom:1px solid var(--gold2);display:flex;justify-content:space-between;align-items:center">' +
            '<div style="font-family:\'Cinzel\',serif;color:var(--gold2)">🏆 XP Ledger</div>' +
            '<button onclick="this.closest(\'dialog\').close()" style="background:transparent;border:1px solid var(--parch3);color:var(--parch3);padding:4px 10px;border-radius:2px;cursor:pointer;font-family:\'Cinzel\',serif;font-size:11px">Close</button>' +
          '</div>' +
          '<div id="ct-xp-ledger-body" style="padding:1rem;overflow-y:auto;max-height:75vh"></div>';
        document.body.appendChild(d5);
        d5.addEventListener('click', function(e) { if (e.target === d5) d5.close(); });
      }
      if (!document.getElementById('ct-browser-dialog')) {
        const db = document.createElement('dialog');
        db.id = 'ct-browser-dialog';
        db.style.cssText = 'max-width:800px;width:96vw;height:90vh;padding:0;border:1px solid var(--gold2);background:#0d0a06;color:var(--parch1);border-radius:6px;display:flex;flex-direction:column';
        db.innerHTML =
          '<div style="padding:.75rem 1rem;border-bottom:1px solid var(--gold2);display:flex;justify-content:space-between;align-items:center;flex-shrink:0">' +
            '<div style="font-family:\'Cinzel\',serif;color:var(--gold2)">📚 Monster Catalog Browser</div>' +
            '<div style="display:flex;gap:.4rem">' +
              '<button onclick="if(window.CombatTracker) CombatTracker._openMonsterForm(null)" style="background:var(--gold);color:#0d0a06;border:none;padding:4px 10px;border-radius:2px;cursor:pointer;font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:1px">+ Create custom</button>' +
              '<button onclick="this.closest(\'dialog\').close()" style="background:transparent;border:1px solid var(--parch3);color:var(--parch3);padding:4px 10px;border-radius:2px;cursor:pointer;font-family:\'Cinzel\',serif;font-size:11px">Close</button>' +
            '</div>' +
          '</div>' +
          '<div id="ct-browser-body" style="display:flex;flex-direction:column;flex:1;overflow:hidden"></div>';
        document.body.appendChild(db);
        db.addEventListener('click', function(e) { if (e.target === db) db.close(); });
      }
      if (!document.getElementById('ct-monster-form')) {
        const d7 = document.createElement('dialog');
        d7.id = 'ct-monster-form';
        d7.style.cssText = 'max-width:720px;width:94vw;max-height:90vh;padding:0;border:1px solid var(--gold2);background:#0d0a06;color:var(--parch1);border-radius:6px';
        // Small helpers to build the form
        const lbl = function(text) { return '<label style="display:block;font-family:\'Cinzel\',serif;font-size:10px;color:var(--gold2);letter-spacing:1.5px;margin:.5rem 0 .2rem">' + text + '</label>'; };
        const inp = function(id, ph, w) { return '<input id="ct-mf-' + id + '" type="text" placeholder="' + (ph||'') + '" style="width:' + (w||'100%') + ';padding:.35rem .5rem;background:rgba(10,8,5,0.6);border:1px solid rgba(160,128,64,0.5);color:var(--parch);border-radius:2px;font-size:12.5px">'; };
        const num = function(id, ph, w) { return '<input id="ct-mf-' + id + '" type="number" placeholder="' + (ph||'') + '" style="width:' + (w||'70px') + ';padding:.35rem .5rem;background:rgba(10,8,5,0.6);border:1px solid rgba(160,128,64,0.5);color:var(--parch);border-radius:2px;font-size:12.5px">'; };
        const ta  = function(id, ph, h) { return '<textarea id="ct-mf-' + id + '" placeholder="' + (ph||'') + '" style="width:100%;min-height:' + (h||'80px') + ';padding:.4rem .5rem;background:rgba(10,8,5,0.6);border:1px solid rgba(160,128,64,0.5);color:var(--parch);border-radius:2px;font-family:\'Crimson Pro\',serif;font-size:12.5px;resize:vertical"></textarea>'; };
        d7.innerHTML =
          '<div style="padding:.75rem 1rem;border-bottom:1px solid var(--gold2);display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;background:#0d0a06;z-index:2">' +
            '<div id="ct-mf-title" style="font-family:\'Cinzel\',serif;color:var(--gold2)">Create Custom Monster</div>' +
            '<button onclick="this.closest(\'dialog\').close()" style="background:transparent;border:1px solid var(--parch3);color:var(--parch3);padding:4px 10px;border-radius:2px;cursor:pointer;font-family:\'Cinzel\',serif;font-size:11px">Close</button>' +
          '</div>' +
          '<div style="padding:1rem;overflow-y:auto;max-height:78vh">' +
            '<input type="hidden" id="ct-mf-oldid">' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">' +
              '<div>' + lbl('ID (unique, kebab-case)') + inp('id', 'e.g. mind_flayer') + '</div>' +
              '<div>' + lbl('Name') + inp('name', 'e.g. Mind Flayer') + '</div>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:1fr 2fr 1fr;gap:.75rem">' +
              '<div>' + lbl('Size') + '<select id="ct-mf-size" style="width:100%;padding:.35rem .5rem;background:rgba(10,8,5,0.6);border:1px solid rgba(160,128,64,0.5);color:var(--parch);border-radius:2px;font-size:12.5px">' + ['Tiny','Small','Medium','Large','Huge','Gargantuan'].map(function(s) { return '<option>' + s + '</option>'; }).join('') + '</select></div>' +
              '<div>' + lbl('Type (e.g. humanoid (elf), aberration)') + inp('type') + '</div>' +
              '<div>' + lbl('Alignment') + inp('alignment', 'e.g. lawful evil') + '</div>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.75rem">' +
              '<div>' + lbl('AC *') + num('ac', '15', '100%') + '</div>' +
              '<div>' + lbl('HP (avg) *') + num('hp', '75', '100%') + '</div>' +
              '<div>' + lbl('HP formula') + inp('hpFormula', '10d8+30') + '</div>' +
              '<div>' + lbl('Speed') + inp('speed', '30 ft.') + '</div>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:.5rem">' +
              '<div>' + lbl('STR') + num('str', '10', '100%') + '</div>' +
              '<div>' + lbl('DEX') + num('dex', '10', '100%') + '</div>' +
              '<div>' + lbl('CON') + num('con', '10', '100%') + '</div>' +
              '<div>' + lbl('INT') + num('int', '10', '100%') + '</div>' +
              '<div>' + lbl('WIS') + num('wis', '10', '100%') + '</div>' +
              '<div>' + lbl('CHA') + num('cha', '10', '100%') + '</div>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">' +
              '<div>' + lbl('Saves (JSON, e.g. {"con":6})') + inp('saves', '{"con":6}') + '</div>' +
              '<div>' + lbl('Skills (JSON, e.g. {"perception":5})') + inp('skills', '{"perception":5}') + '</div>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">' +
              '<div>' + lbl('Senses') + inp('senses', 'darkvision 60 ft., passive Perception 12') + '</div>' +
              '<div>' + lbl('Languages') + inp('languages', 'Common, Elvish') + '</div>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">' +
              '<div>' + lbl('CR * (string, e.g. "1/2", "5")') + inp('cr', '5') + '</div>' +
              '<div>' + lbl('XP *') + num('xp', '1800', '100%') + '</div>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">' +
              '<div>' + lbl('Damage resistances') + inp('damageResist', 'necrotic') + '</div>' +
              '<div>' + lbl('Damage immunities') + inp('damageImmune', 'poison') + '</div>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">' +
              '<div>' + lbl('Damage vulnerabilities') + inp('damageVuln', 'radiant') + '</div>' +
              '<div>' + lbl('Condition immunities') + inp('conditionImmune', 'poisoned, charmed') + '</div>' +
            '</div>' +
            lbl('Traits (one per line: Name :: Description)') +
            ta('traits', 'Magic Resistance :: Advantage on saves vs spells.\\nRegeneration :: Regains 10 HP at start of its turn.', '80px') +
            lbl('Actions (one per line: Name :: Description) — put "Multiattack" first if present') +
            ta('actions', 'Multiattack :: Makes two attacks.\\nBite :: Melee +7 to hit, reach 5 ft. Hit: 2d6+4 piercing plus 3d6 poison.', '100px') +
            lbl('Bonus actions (one per line: Name :: Description)') +
            ta('bonusActions', '', '60px') +
            lbl('Reactions (one per line: Name :: Description)') +
            ta('reactions', '', '60px') +
            lbl('Legendary actions (one per line: Name :: Description)') +
            ta('legendaryActions', '', '60px') +
            lbl('Source (your reference — e.g. "MM 2024 p.150" or "custom")') +
            inp('source', 'MM 2024') +
            '<div style="margin-top:1rem;text-align:right;position:sticky;bottom:0;background:#0d0a06;padding:.5rem 0;border-top:1px solid rgba(160,128,64,0.35)">' +
              '<button onclick="this.closest(\'dialog\').close()" style="background:transparent;border:1px solid var(--parch3);color:var(--parch3);padding:5px 14px;border-radius:2px;cursor:pointer;font-family:\'Cinzel\',serif;font-size:11px;margin-right:.5rem">Cancel</button>' +
              '<button onclick="if(window.CombatTracker) CombatTracker._saveMonsterForm()" style="background:var(--gold);color:#0d0a06;border:none;padding:5px 18px;border-radius:2px;cursor:pointer;font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:1px">Save monster</button>' +
            '</div>' +
          '</div>';
        document.body.appendChild(d7);
      }
      if (!document.getElementById('ct-dice-dialog')) {
        const d6 = document.createElement('dialog');
        d6.id = 'ct-dice-dialog';
        d6.style.cssText = 'max-width:520px;width:92vw;max-height:85vh;padding:0;border:1px solid var(--gold2);background:#0d0a06;color:var(--parch1);border-radius:6px';
        d6.innerHTML =
          '<div style="padding:.75rem 1rem;border-bottom:1px solid var(--gold2);display:flex;justify-content:space-between;align-items:center">' +
            '<div style="font-family:\'Cinzel\',serif;color:var(--gold2)">🎲 Dice Roller</div>' +
            '<button onclick="this.closest(\'dialog\').close()" style="background:transparent;border:1px solid var(--parch3);color:var(--parch3);padding:4px 10px;border-radius:2px;cursor:pointer;font-family:\'Cinzel\',serif;font-size:11px">Close</button>' +
          '</div>' +
          '<div id="ct-dice-body" style="padding:1rem;overflow-y:auto;max-height:75vh"></div>';
        document.body.appendChild(d6);
        d6.addEventListener('click', function(e) { if (e.target === d6) d6.close(); });
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
