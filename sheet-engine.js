// =====================================================================
// ELDORIA 2.0 — CHARACTER SHEET ENGINE
// Renderer, state management, dice rolls, event handlers.
// Loaded by both index.html (modal mode) and sheet.html (standalone).
// Requires sheet-data.js to be loaded first (provides CHARACTERS).
// =====================================================================

const SHEET_SKILL_LABELS = {
  acrobatics: 'Acrobatics', animalHandling: 'Animal Handling', arcana: 'Arcana',
  athletics: 'Athletics', deception: 'Deception', history: 'History',
  insight: 'Insight', intimidation: 'Intimidation', investigation: 'Investigation',
  medicine: 'Medicine', nature: 'Nature', perception: 'Perception',
  performance: 'Performance', persuasion: 'Persuasion', religion: 'Religion',
  sleightOfHand: 'Sleight of Hand', stealth: 'Stealth', survival: 'Survival'
};
const SHEET_SKILL_ABILITY = {
  acrobatics: 'dex', animalHandling: 'wis', arcana: 'int', athletics: 'str',
  deception: 'cha', history: 'int', insight: 'wis', intimidation: 'cha',
  investigation: 'int', medicine: 'wis', nature: 'int', perception: 'wis',
  performance: 'cha', persuasion: 'cha', religion: 'int', sleightOfHand: 'dex',
  stealth: 'dex', survival: 'wis'
};
const SHEET_SKILLS_BY_ABILITY = {
  str: ['athletics'],
  dex: ['acrobatics', 'sleightOfHand', 'stealth'],
  con: [],
  int: ['arcana', 'history', 'investigation', 'nature', 'religion'],
  wis: ['animalHandling', 'insight', 'medicine', 'perception', 'survival'],
  cha: ['deception', 'intimidation', 'performance', 'persuasion']
};
const SHEET_CONDITIONS = ['Blinded','Charmed','Deafened','Frightened','Grappled','Incapacitated','Invisible','Paralyzed','Petrified','Poisoned','Prone','Restrained','Stunned','Unconscious','Concentration'];

function sheetAbilityMod(score) { return Math.floor((score - 10) / 2); }
function sheetFmtMod(n) { return (n >= 0 ? '+' : '') + n; }
function sheetRollD20() { return 1 + Math.floor(Math.random() * 20); }
function sheetRollDice(count, sides) {
  let total = 0;
  for (let i = 0; i < count; i++) total += 1 + Math.floor(Math.random() * sides);
  return total;
}
function sheetGetSkillMod(char, key) {
  const skill = (char.skills || {})[key] || {};
  if (skill.modOverride !== undefined) return skill.modOverride;
  const abil = SHEET_SKILL_ABILITY[key];
  let mod = sheetAbilityMod(char.abilities[abil]);
  if (skill.proficient) mod += char.proficiencyBonus;
  if (skill.expertise) mod += char.proficiencyBonus;
  return mod;
}
function sheetGetSaveMod(char, abil) {
  const save = (char.saves || {})[abil] || {};
  if (save.modOverride !== undefined) return save.modOverride;
  let mod = sheetAbilityMod(char.abilities[abil]);
  if (save.proficient) mod += char.proficiencyBonus;
  return mod;
}

// ----- State management (localStorage + optional Firebase sync) -----
function sheetStateKey(id) { return 'eldoria-char-state-' + id; }
function loadSheetState(id) {
  try { const raw = localStorage.getItem(sheetStateKey(id)); return raw ? JSON.parse(raw) : null; }
  catch (e) { return null; }
}
function saveSheetState(id, state) {
  try { localStorage.setItem(sheetStateKey(id), JSON.stringify(state)); } catch (e) {}
  // Push to Firebase if sync layer is loaded and connected. Fire-and-forget.
  if (window.CharacterSync && window.CharacterSync.ready) {
    window.CharacterSync.push(id, state);
  }
}
// Track which characters we've subscribed to for remote updates.
const _sheetSubscribed = {};
function _subscribeSheetIfPossible(id) {
  if (_sheetSubscribed[id]) return;
  if (!window.CharacterSync || !window.CharacterSync.ready) {
    // Firebase may still be initialising — retry a couple of times.
    if (_subscribeSheetIfPossible._retries === undefined) _subscribeSheetIfPossible._retries = {};
    const retries = _subscribeSheetIfPossible._retries[id] || 0;
    if (retries < 6) {
      _subscribeSheetIfPossible._retries[id] = retries + 1;
      setTimeout(function() { _subscribeSheetIfPossible(id); }, 500);
    }
    return;
  }
  _sheetSubscribed[id] = true;
  window.CharacterSync.subscribe(id, function(remoteState) {
    // Apply remote state to localStorage WITHOUT triggering another Firebase push.
    try { localStorage.setItem(sheetStateKey(id), JSON.stringify(remoteState)); } catch (e) {}
    // Re-render if this character is currently visible.
    if (typeof refreshSheet === 'function') refreshSheet(id);
  });
}
function initSheetState(char) {
  const slots = {};
  (char.spellcasting ? char.spellcasting.slots : []).forEach((n, i) => slots[i+1] = 0);
  const resources = {};
  (char.resources || []).forEach(r => {
    resources[r.id] = (r.default !== undefined) ? r.default : r.max;
  });
  return {
    hp: { current: char.hpMax, temp: 0 },
    hitDiceSpent: 0,
    deathSaves: { successes: 0, failures: 0 },
    slots, resources,
    conditions: {},
    exhaustion: 0,
    inspiration: false,
    notes: ''
  };
}
function getSheetState(id) {
  const char = CHARACTERS[id];
  let state = loadSheetState(id);
  if (!state) state = initSheetState(char);
  if (!state.hp) state.hp = { current: char.hpMax, temp: 0 };
  if (!state.deathSaves) state.deathSaves = { successes: 0, failures: 0 };
  if (!state.slots) state.slots = {};
  if (!state.resources) state.resources = {};
  if (!state.conditions) state.conditions = {};
  if (state.exhaustion === undefined) state.exhaustion = 0;
  if (state.inspiration === undefined) state.inspiration = false;
  if (state.notes === undefined) state.notes = '';
  if (char.spellcasting) {
    char.spellcasting.slots.forEach((n, i) => { if (state.slots[i+1] === undefined) state.slots[i+1] = 0; });
  }
  (char.resources || []).forEach(r => {
    if (state.resources[r.id] === undefined) {
      state.resources[r.id] = (r.default !== undefined) ? r.default : r.max;
    }
  });
  // Phase 4A migration: seed editable equipment + currency + editMode from
  // the sheet-data.js defaults on first load. After that, state is canonical
  // and syncs via Firebase.
  if (!state.equipment) {
    state.equipment = (char.equipment || []).map(function(str, i) {
      return { id: 'seed_' + i, name: str, quantity: 1, notes: '', custom: true, sourceItemId: null };
    });
  }
  // One-time Sylas inventory cleanup — replaces known-bad legacy seed items
  // with properly-split entries and correct quantities. Only touches items
  // that match legacy patterns exactly (so the user's own edits aren't harmed).
  if (id === 'sylas' && !state._sylasInvMigrationV1 && state.equipment) {
    const RULES = [
      {
        // "Poisonous Spider Fang (×2), Spider Venom Sacks (×2) — collected components"
        match: /^Poisonous Spider Fang.*Venom Sac/i,
        replaceWith: [
          { name: 'Poisonous Spider Fang', quantity: 2, notes: 'collected component' },
          { name: 'Spider Venom Sac',      quantity: 2, notes: 'collected component' }
        ]
      },
      {
        // "17 Spears (odd inventory quirk — noted on sheet)"
        match: /^17 Spears?/i,
        replaceWith: [{ name: 'Spear', quantity: 17, notes: 'inventory quirk' }]
      },
      {
        // "17 Longbow (odd inventory quirk — noted on sheet)"
        match: /^17 Longbow/i,
        replaceWith: [{ name: 'Longbow', quantity: 17, notes: 'inventory quirk' }]
      },
      {
        // Necklace / Spirit Jar with Vaeloran mention
        match: /Necklace.*Spirit Jar.*Vaeloran/i,
        replaceWith: [{ name: 'The Necklace / Spirit Jar', quantity: 1, notes: 'Lich Initiate focus.' }]
      }
    ];
    const rebuilt = [];
    const now = Date.now();
    state.equipment.forEach(function(item, i) {
      const name = item.name || '';
      let matched = null;
      for (let r = 0; r < RULES.length; r++) {
        if (RULES[r].match.test(name)) { matched = RULES[r]; break; }
      }
      if (matched) {
        matched.replaceWith.forEach(function(rep, j) {
          rebuilt.push({
            id: 'migrated_v1_' + now + '_' + i + '_' + j,
            name: rep.name,
            quantity: rep.quantity,
            notes: rep.notes,
            custom: true,
            sourceItemId: null,
            equipped: false,
            attuned: false
          });
        });
      } else {
        rebuilt.push(item);
      }
    });
    state.equipment = rebuilt;
    state._sylasInvMigrationV1 = true;
  }
  if (!state.currency) {
    state.currency = Object.assign({ cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }, char.coins || {});
  }
  if (state.editMode === undefined) state.editMode = false;
  // Phase 4B migration: seed editable spells from char.spells on first load.
  if (!state.spells) {
    state.spells = (char.spells || []).map(function(sp, i) {
      const tags = sp.tags || [];
      return {
        id: 'seed_spell_' + i,
        sourceSpellId: null,
        name: sp.name,
        level: sp.level,
        school: (sp.school || '').toLowerCase(),
        castingTime: sp.cast || 'Action',
        range: sp.range || '—',
        components: sp.components || '',
        duration: sp.duration || '',
        concentration: tags.indexOf('concentration') >= 0,
        ritual: tags.indexOf('ritual') >= 0,
        description: sp.desc || '',
        atHigherLevels: sp.atHigherLevels || null,
        prepared: true,
        alwaysPrepared: tags.indexOf('signature') >= 0 || tags.indexOf('mastery') >= 0,
        alwaysPreparedReason: (tags.indexOf('signature') >= 0) ? 'Signature spell' :
                              (tags.indexOf('mastery') >= 0)   ? 'Spell mastery'   : '',
        custom: true
      };
    });
  }
  // Phase 4B rev: ensure alwaysPrepared field on every spell (for older seeded state)
  (state.spells || []).forEach(function(sp) {
    if (sp.alwaysPrepared === undefined) sp.alwaysPrepared = false;
    if (sp.alwaysPreparedReason === undefined) sp.alwaysPreparedReason = '';
  });
  // Phase 4B rev: backfill from spell catalog by name-match.
  // For any state.spells entry that has no atHigherLevels but whose name
  // matches an entry in SPELLS_2024, pull the catalog's richer data
  // (atHigherLevels, concentration, ritual, components, description if
  // empty, school, castingTime, range, duration). Player doesn't need to
  // re-add spells to get the Upcast button / detailed info.
  if (typeof SPELLS_2024 !== 'undefined' && state.spells) {
    const byNameLower = {};
    SPELLS_2024.forEach(function(s) { byNameLower[(s.name || '').toLowerCase()] = s; });
    state.spells.forEach(function(sp) {
      const catalog = byNameLower[(sp.name || '').toLowerCase()];
      if (!catalog) return;
      if (!sp.sourceSpellId) sp.sourceSpellId = catalog.id;
      if (!sp.atHigherLevels && catalog.atHigherLevels) sp.atHigherLevels = catalog.atHigherLevels;
      if (sp.concentration === undefined || sp.concentration === false) sp.concentration = !!catalog.concentration;
      if (sp.ritual === undefined || sp.ritual === false) sp.ritual = !!catalog.ritual;
      if (!sp.components && catalog.components) sp.components = catalog.components;
      if (!sp.duration && catalog.duration) sp.duration = catalog.duration;
      if (!sp.range || sp.range === '—') sp.range = catalog.range || sp.range;
      if (!sp.castingTime || sp.castingTime === 'Action') sp.castingTime = catalog.castingTime || sp.castingTime;
      if (!sp.school && catalog.school) sp.school = catalog.school;
      // Only overwrite description if empty (respect existing text)
      if (!sp.description) sp.description = catalog.description || '';
    });
  }
  // Phase 4B rev: seed alwaysPreparedSpells declared on the character.
  // Each entry: { name: string, reason: string }. On first load (or when a
  // new alwaysPrepared entry is added to sheet-data.js), we look it up in
  // SPELLS_2024, add the full spell to state.spells with alwaysPrepared:true
  // and the reason string. Skips entries already present (matched by name).
  if (char && Array.isArray(char.alwaysPreparedSpells) && typeof SPELLS_2024 !== 'undefined') {
    const byNameLower2 = {};
    SPELLS_2024.forEach(function(s) { byNameLower2[(s.name || '').toLowerCase()] = s; });
    if (!state.spells) state.spells = [];
    const existingNames = {};
    state.spells.forEach(function(sp) { existingNames[(sp.name || '').toLowerCase()] = sp; });
    char.alwaysPreparedSpells.forEach(function(entry, i) {
      const nameLower = (entry.name || '').toLowerCase();
      const existing = existingNames[nameLower];
      if (existing) {
        // Already in state — just flag as alwaysPrepared with the reason.
        if (!existing.alwaysPrepared) {
          existing.alwaysPrepared = true;
          existing.alwaysPreparedReason = entry.reason || existing.alwaysPreparedReason || '';
          existing.prepared = true;
        }
        return;
      }
      const src = byNameLower2[nameLower];
      if (!src) return; // spell not in catalog — silently skip (DM should add to spells-2024.js)
      state.spells.push({
        id: 'alwaysprep_seed_' + i + '_' + (src.id || 'x'),
        sourceSpellId: src.id,
        name: src.name,
        level: src.level,
        school: src.school || '',
        castingTime: src.castingTime || 'Action',
        range: src.range || '—',
        components: src.components || '',
        duration: src.duration || '',
        concentration: !!src.concentration,
        ritual: !!src.ritual,
        description: src.description || '',
        atHigherLevels: src.atHigherLevels || null,
        prepared: true,
        alwaysPrepared: true,
        alwaysPreparedReason: entry.reason || '',
        custom: false
      });
    });
  }
  return state;
}

// Class categorisation for spellcasting UX:
//   'full-list'  — Cleric, Druid, Paladin. Prep from entire class list each long rest.
//   'spellbook'  — Wizard. Prep from personal spellbook (state.spells).
//   'fixed-swap' — Ranger, Artificer. Fixed known list; swap 1 per long rest.
//   'known-only' — Sorcerer, Bard, Warlock. No prep; swap on level-up.
//   'none'       — non-caster.
function getSpellcastingCategory(char) {
  if (!char || !char.spellcasting) return 'none';
  const cls = (char.className || '').toLowerCase();
  if (cls === 'cleric' || cls === 'druid' || cls === 'paladin') return 'full-list';
  if (cls === 'wizard') return 'spellbook';
  if (cls === 'ranger' || cls === 'artificer') return 'fixed-swap';
  if (cls === 'sorcerer' || cls === 'bard' || cls === 'warlock') return 'known-only';
  return 'none';
}

function hasPrepModal(char) {
  const cat = getSpellcastingCategory(char);
  return cat === 'spellbook' || cat === 'full-list' || cat === 'fixed-swap';
}

function getFullClassSpells(className) {
  if (typeof SPELLS_2024 === 'undefined') return [];
  const cls = (className || '').toLowerCase();
  return SPELLS_2024.filter(function(s) {
    return (s.classes || []).indexOf(cls) !== -1;
  });
}

// Prepared spell max derived from class + ability mod + level. Returns null
// for classes with no daily-prep concept (Sorcerer / Bard / Warlock in 2024).
// For Ranger: 2024 uses the class-table count, not a mod-based formula —
// return null and let the sheet render the count from state.spells directly.
function getPreparedMax(char) {
  const cls = (char.className || '').toLowerCase();
  const level = char.level || 1;
  const abil = char.abilities || {};
  const mod = function(score) { return Math.floor(((score || 10) - 10) / 2); };
  if (cls === 'wizard')    return Math.max(1, mod(abil.int) + level);
  if (cls === 'cleric')    return Math.max(1, mod(abil.wis) + level);
  if (cls === 'druid')     return Math.max(1, mod(abil.wis) + level);
  if (cls === 'paladin')   return Math.max(1, mod(abil.cha) + Math.ceil(level / 2));
  if (cls === 'artificer') return Math.max(1, mod(abil.int) + Math.ceil(level / 2));
  return null; // ranger (table-based), sorcerer/bard/warlock (no prep)
}
function withSheetState(charId, fn) {
  const state = getSheetState(charId);
  fn(state);
  saveSheetState(charId, state);
  refreshSheet(charId);
}

// ===================================================================
// PHASE 4A — EDITABLE INVENTORY + CURRENCY + EDIT MODE + ITEM PICKER
// ===================================================================
function _sheetEscapeAttr(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---- Edit mode toggle -------------------------------------------------
function renderEditModeToggle(charId, state) {
  const on = !!state.editMode;
  const btnBg = on ? 'var(--gold)' : 'rgba(160,128,64,0.15)';
  const btnFg = on ? '#0d0a06' : 'var(--gold2)';
  const label = on ? '🔓 EDITING — click to lock' : '🔒 LOCKED — click to edit';
  return '<div style="display:flex;justify-content:flex-end;padding:.3rem 0 .5rem;margin-bottom:.5rem;border-bottom:1px dashed rgba(160,128,64,0.2)">' +
    '<button onclick="toggleEditMode(\'' + charId + '\')" style="background:' + btnBg + ';color:' + btnFg + ';border:1px solid var(--gold2);border-radius:2px;padding:.35rem .8rem;font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:1.5px;cursor:pointer">' +
    label + '</button>' +
    '</div>';
}
function toggleEditMode(charId) {
  withSheetState(charId, function(s) { s.editMode = !s.editMode; });
}

// ---- Currency section -------------------------------------------------
function renderCurrencySection(charId, state) {
  // Currency is always editable (no lock/unlock — per user preference).
  const editing = true;
  const c = state.currency || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
  const totalGp = ((c.pp||0)*10) + (c.gp||0) + ((c.ep||0)*0.5) + ((c.sp||0)*0.1) + ((c.cp||0)*0.01);
  const denoms = [
    { key: 'cp', label: 'CP' },
    { key: 'sp', label: 'SP' },
    { key: 'ep', label: 'EP' },
    { key: 'gp', label: 'GP' },
    { key: 'pp', label: 'PP' }
  ];
  const cells = denoms.map(function(d) {
    const val = c[d.key] || 0;
    const inner = editing
      ? '<input type="number" min="0" step="1" value="' + val + '" onchange="updateCurrency(\'' + charId + '\',\'' + d.key + '\',this.value)" onkeydown="if(event.key===\'Enter\')this.blur()" style="width:100%;text-align:center;font-family:\'Cinzel\',serif;font-size:14px;color:var(--gold3);background:rgba(10,8,5,0.7);border:1px solid rgba(160,128,64,0.4);border-radius:2px;padding:2px;font-weight:600">'
      : '<div style="font-family:\'Cinzel\',serif;font-size:14px;color:var(--gold3);font-weight:600;text-align:center">' + val + '</div>';
    return '<div><div style="font-family:\'Cinzel\',serif;font-size:9px;color:var(--parch3);letter-spacing:1px;margin-bottom:.15rem;text-align:center">' + d.label + '</div>' + inner + '</div>';
  }).join('');
  return '<div class="sheet-sub"><div class="sheet-sub-title">Currency</div>' +
    '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:.4rem;margin-bottom:.35rem">' + cells + '</div>' +
    '<div style="font-size:10px;color:var(--parch4);text-align:right;font-family:\'Cinzel\',serif;letter-spacing:.5px">≈ ' + totalGp.toFixed(2) + ' gp total</div>' +
    '</div>';
}
function updateCurrency(charId, denom, raw) {
  const n = Math.max(0, parseInt(raw, 10) || 0);
  withSheetState(charId, function(s) {
    if (!s.currency) s.currency = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
    s.currency[denom] = n;
  });
}

// ---- Inventory section -----------------------------------------------
// Inventory row expand-on-click state (client-only, one row expanded at a time).
let _expandedInventoryItemId = null;
function toggleInventoryDetail(charId, itemId) {
  _expandedInventoryItemId = (_expandedInventoryItemId === itemId) ? null : itemId;
  if (typeof refreshSheet === 'function') refreshSheet(charId);
}
function saveInventoryExpandedNotes(charId, idx, val) {
  withSheetState(charId, function(s) {
    if (!s.equipment || !s.equipment[idx]) return;
    s.equipment[idx].notes = val;
  });
}
function renameInventoryItem(charId, idx) {
  const state = getSheetState(charId);
  if (!state.equipment || !state.equipment[idx]) return;
  const current = state.equipment[idx].name || '';
  const next = prompt('Rename item:', current);
  if (next === null) return;
  const trimmed = next.trim();
  if (!trimmed) return;
  withSheetState(charId, function(s) {
    if (!s.equipment || !s.equipment[idx]) return;
    s.equipment[idx].name = trimmed;
  });
}

// Update 18b — Attunement Box (3 slots, gated by equipped)
function renderAttunementSection(charId, state) {
  const items = state.equipment || [];
  const attuned = items.filter(function(x) { return x.attuned; });
  const count = attuned.length;
  const bulletStyle = 'display:inline-block;width:9px;height:9px;border:1.5px solid #a070c0;border-radius:50%;margin-right:4px';
  let bullets = '';
  for (let i = 0; i < 3; i++) {
    bullets += '<span style="' + bulletStyle + (i < count ? ';background:#a070c0' : '') + '"></span>';
  }
  let rows = '';
  if (!count) {
    rows = '<div style="padding:.4rem .6rem;color:var(--parch4);font-style:italic;font-size:12px">No items attuned. 3 slots available.</div>';
  } else {
    attuned.forEach(function(item) {
      const equipped = !!item.equipped;
      const badge = equipped
        ? '<span style="background:rgba(13,61,48,0.4);color:#a0d4c4;border:1px solid rgba(13,61,48,0.5);font-family:\'Cinzel\',serif;font-size:9px;letter-spacing:.5px;padding:1px 6px;border-radius:2px">✓ ACTIVE</span>'
        : '<span style="background:rgba(122,26,26,0.3);color:#e0a0a0;border:1px solid rgba(122,26,26,0.5);font-family:\'Cinzel\',serif;font-size:9px;letter-spacing:.5px;padding:1px 6px;border-radius:2px" title="Attuned but not equipped — bonuses not applied">⚠ UNEQUIPPED</span>';
      rows += '<div style="display:flex;justify-content:space-between;align-items:center;padding:.35rem .5rem;border-bottom:1px dashed rgba(160,128,64,0.15);gap:.5rem">' +
        '<div style="flex:1;font-size:12.5px;color:var(--parch2)">◉ ' + _sheetEscapeAttr(item.name || 'Item') + '</div>' +
        '<div>' + badge + '</div>' +
        '</div>';
    });
  }
  return '<div class="sheet-sub"><div class="sheet-sub-title">Attunement <span style="float:right;color:var(--parch4);font-size:10px;font-weight:400">' + bullets + ' ' + count + '/3</span></div>' + rows + '</div>';
}

function renderInventorySection(charId, char, state) {
  // Inventory is always editable (no lock/unlock — per user preference).
  const editing = true;
  const items = state.equipment || [];
  const catalogLoaded = (typeof ITEMS_BY_ID !== 'undefined');
  let rows = '';
  if (items.length === 0) {
    rows = '<tr><td colspan="' + (editing ? 4 : 3) + '" style="text-align:center;padding:.5rem;color:var(--parch4);font-style:italic;font-size:12px">' +
      (editing ? 'No items. Use the buttons below to add.' : 'No items. Enable edit mode to add.') +
      '</td></tr>';
  } else {
    items.forEach(function(item, i) {
      const isExpanded = _expandedInventoryItemId === item.id;
      const chevron = isExpanded ? '▾' : '▸';
      const nameToggle = 'onclick="toggleInventoryDetail(\'' + charId + '\',\'' + _sheetEscapeAttr(item.id) + '\')"';
      let nameInner;
      if (!item.custom && catalogLoaded && ITEMS_BY_ID[item.sourceItemId]) {
        nameInner = _sheetEscapeAttr(item.name);
      } else {
        nameInner = _sheetEscapeAttr(item.name);
      }
      const nameHtml = '<span style="cursor:pointer;user-select:none" ' + nameToggle + ' title="Click for details">' +
        '<span style="color:var(--gold2);margin-right:.3rem;font-size:10px">' + chevron + '</span>' + nameInner + '</span>';
      const qty = editing
        ? '<input type="number" min="1" step="1" value="' + (item.quantity || 1) + '" onchange="updateInventoryItem(\'' + charId + '\',' + i + ',\'quantity\',this.value)" onkeydown="if(event.key===\'Enter\')this.blur()" style="width:5ch;text-align:center;background:rgba(10,8,5,0.7);border:1px solid rgba(160,128,64,0.3);color:var(--parch);padding:2px;border-radius:2px;font-size:11px">'
        : String(item.quantity || 1);
      // Notes preview only — full editing happens in the expanded panel.
      const notesPreview = item.notes
        ? '<span style="font-style:italic;color:var(--parch3);font-size:11px">' + _sheetEscapeAttr(item.notes.length > 60 ? item.notes.slice(0, 60) + '…' : item.notes) + '</span>'
        : '<span style="color:var(--parch4);font-size:10.5px;font-style:italic">click for details</span>';
      const notes = notesPreview;
      const removeCell = editing
        ? '<button onclick="removeInventoryItem(\'' + charId + '\',' + i + ')" style="background:transparent;border:1px solid var(--red2);color:var(--red2);border-radius:2px;padding:1px 6px;cursor:pointer;font-size:10px;margin-left:2px" title="Remove">✕</button>'
        : '';
      // Update 18a — primary action per item type (equip weapons/armor/worn magic, use consumables, nothing for gear)
      const actionType = itemActionType(item);
      let primaryBtn = '';
      if (actionType === 'equip') {
        primaryBtn = '<button onclick="toggleEquipped(\'' + charId + '\',' + i + ')" style="background:' + (item.equipped ? 'var(--gold2)' : 'transparent') + ';border:1px solid var(--gold2);color:' + (item.equipped ? '#0d0a06' : 'var(--gold2)') + ';border-radius:2px;padding:1px 6px;cursor:pointer;font-size:10px;font-family:\'Cinzel\',serif;letter-spacing:.5px" title="' + (item.equipped ? 'Currently equipped (click to unequip)' : 'Equip (1 free interaction/turn — more cost an action)') + '">' + (item.equipped ? '⚔ Equipped' : '⚔ Equip') + '</button>';
      } else if (actionType === 'use') {
        primaryBtn = '<button onclick="useInventoryItem(\'' + charId + '\',' + i + ')" style="background:transparent;border:1px solid #6ba46b;color:#6ba46b;border-radius:2px;padding:1px 6px;cursor:pointer;font-size:10px;font-family:\'Cinzel\',serif;letter-spacing:.5px" title="Use one (consume — quantity decrements)">✦ Use</button>';
      }
      const equipBtn = primaryBtn;
      // Update 18b — attune toggle
      const canAttune = isItemAttunable(item);
      const attuneBtn = canAttune
        ? '<button onclick="toggleAttuned(\'' + charId + '\',' + i + ')" style="background:' + (item.attuned ? '#5a2a7a' : 'transparent') + ';border:1px solid #a070c0;color:' + (item.attuned ? '#fff' : '#a070c0') + ';border-radius:2px;padding:1px 6px;cursor:pointer;font-size:10px;font-family:\'Cinzel\',serif;letter-spacing:.5px;margin-left:2px" title="' + (item.attuned ? 'Attuned (click to break)' : 'Attune (needs Short Rest concentration; effects require Equipped too)') + '">' + (item.attuned ? '◉ Attuned' : '◉ Attune') + '</button>'
        : '';
      const actionCell = editing
        ? '<td style="text-align:right;padding:.15rem;white-space:nowrap">' + equipBtn + attuneBtn + removeCell + '</td>'
        : '';
      rows += '<tr style="border-bottom:' + (isExpanded ? 'none' : '1px dashed rgba(160,128,64,0.1)') + '">' +
        '<td style="font-size:12px;color:var(--parch2);padding:.2rem .3rem .2rem 0">' + nameHtml + '</td>' +
        '<td style="text-align:center;font-size:12px;color:var(--parch2);padding:.2rem;width:5ch">' + qty + '</td>' +
        '<td style="font-size:11px;color:var(--parch3);padding:.2rem">' + notes + '</td>' +
        actionCell + '</tr>';
      if (isExpanded) {
        // Detail panel — full description, big notes textarea, rename button.
        let catDesc = '';
        if (!item.custom && catalogLoaded && ITEMS_BY_ID[item.sourceItemId]) {
          const catItem = ITEMS_BY_ID[item.sourceItemId];
          const source = catItem.source ? '<div style="font-size:10px;color:var(--parch4);margin-top:.35rem;font-style:italic">' + _sheetEscapeAttr(catItem.source) + '</div>' : '';
          catDesc = '<div style="font-size:11.5px;line-height:1.55;color:var(--parch2);margin-bottom:.5rem;padding:.5rem .65rem;background:rgba(0,0,0,0.2);border-left:2px solid var(--gold2);border-radius:2px">' +
            _sheetEscapeAttr(catItem.description || '') + source +
          '</div>';
        }
        const bigNotes = '<textarea onchange="saveInventoryExpandedNotes(\'' + charId + '\',' + i + ',this.value)" placeholder="Your notes on this item…" style="width:100%;min-height:70px;padding:.4rem .55rem;background:rgba(10,8,5,0.55);border:1px solid rgba(160,128,64,0.3);border-radius:2px;color:var(--parch1);font-family:\'Crimson Pro\',serif;font-size:12.5px;line-height:1.5;resize:vertical;outline:none">' + _sheetEscapeAttr(item.notes || '') + '</textarea>';
        const renameBtn = '<button onclick="renameInventoryItem(\'' + charId + '\',' + i + ')" style="background:transparent;border:1px solid var(--parch3);color:var(--parch3);border-radius:2px;padding:2px 8px;cursor:pointer;font-size:10px;font-family:\'Cinzel\',serif;letter-spacing:.5px;margin-top:.4rem">✎ Rename</button>';
        rows += '<tr style="border-bottom:1px dashed rgba(160,128,64,0.15)">' +
          '<td colspan="4" style="padding:.15rem .5rem .6rem 1.5rem">' +
            catDesc +
            '<div style="font-size:9px;color:var(--gold2);letter-spacing:1px;font-family:\'Cinzel\',serif;margin-bottom:.3rem">YOUR NOTES</div>' +
            bigNotes +
            renameBtn +
          '</td></tr>';
      }
    });
  }
  const header = '<tr style="border-bottom:1px solid rgba(160,128,64,0.3)">' +
    '<th style="text-align:left;font-family:\'Cinzel\',serif;font-size:10px;color:var(--gold2);padding:.2rem .3rem .2rem 0;letter-spacing:1px">Item</th>' +
    '<th style="text-align:center;font-family:\'Cinzel\',serif;font-size:10px;color:var(--gold2);padding:.2rem;letter-spacing:1px">Qty</th>' +
    '<th style="text-align:left;font-family:\'Cinzel\',serif;font-size:10px;color:var(--gold2);padding:.2rem;letter-spacing:1px">Notes</th>' +
    (editing ? '<th style="width:auto;text-align:right;font-family:\'Cinzel\',serif;font-size:10px;color:var(--gold2);padding:.2rem;letter-spacing:1px">Actions</th>' : '') +
    '</tr>';
  const addRow = editing
    ? '<div style="margin-top:.5rem;display:flex;gap:.4rem;flex-wrap:wrap">' +
        (catalogLoaded
          ? '<button onclick="openItemPicker(\'' + charId + '\')" style="background:var(--gold);color:#0d0a06;border:none;border-radius:2px;padding:.35rem .8rem;font-family:\'Cinzel\',serif;font-size:10px;letter-spacing:1px;cursor:pointer">+ Add from Catalog</button>'
          : '') +
        '<button onclick="addCustomInventoryPrompt(\'' + charId + '\')" style="background:rgba(160,128,64,0.15);color:var(--gold2);border:1px solid var(--gold2);border-radius:2px;padding:.35rem .8rem;font-family:\'Cinzel\',serif;font-size:10px;letter-spacing:1px;cursor:pointer">+ Add Custom</button>' +
      '</div>'
    : '';
  return '<div class="sheet-sub"><div class="sheet-sub-title">Inventory</div>' +
    '<table style="width:100%;border-collapse:collapse">' + header + rows + '</table>' +
    addRow +
    '</div>';
}
function addInventoryFromCatalog(charId, itemId) {
  if (typeof ITEMS_BY_ID === 'undefined' || !ITEMS_BY_ID[itemId]) return;
  const item = ITEMS_BY_ID[itemId];
  withSheetState(charId, function(s) {
    if (!s.equipment) s.equipment = [];
    s.equipment.push({
      id: 'inv_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      name: item.name,
      quantity: 1,
      notes: '',
      custom: false,
      sourceItemId: itemId
    });
  });
  closeItemPicker();
}
function addCustomInventoryPrompt(charId) {
  const name = prompt('Item name:');
  if (!name || !name.trim()) return;
  const qtyRaw = prompt('Quantity (default 1):', '1');
  if (qtyRaw === null) return; // user cancelled
  const qty = Math.max(1, parseInt(qtyRaw, 10) || 1);
  const notes = prompt('Notes (optional):', '') || '';
  withSheetState(charId, function(s) {
    if (!s.equipment) s.equipment = [];
    s.equipment.push({
      id: 'custom_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      name: name.trim(),
      quantity: qty,
      notes: notes.trim(),
      custom: true,
      sourceItemId: null
    });
  });
}
function updateInventoryItem(charId, idx, field, value) {
  withSheetState(charId, function(s) {
    if (!s.equipment || !s.equipment[idx]) return;
    if (field === 'quantity') s.equipment[idx].quantity = Math.max(1, parseInt(value, 10) || 1);
    else s.equipment[idx][field] = value;
  });
}
function removeInventoryItem(charId, idx) {
  withSheetState(charId, function(s) {
    if (!s.equipment || !s.equipment[idx]) return;
    if (!confirm('Remove "' + (s.equipment[idx].name || 'item') + '" from inventory?')) return;
    s.equipment.splice(idx, 1);
  });
}

// ---- Update 18a — Equip / Attune toggles ---------------------------
function toggleEquipped(charId, idx) {
  withSheetState(charId, function(s) {
    if (!s.equipment || !s.equipment[idx]) return;
    s.equipment[idx].equipped = !s.equipment[idx].equipped;
  });
}

function useInventoryItem(charId, idx) {
  withSheetState(charId, function(s) {
    if (!s.equipment || !s.equipment[idx]) return;
    const item = s.equipment[idx];
    const qty = item.quantity || 1;
    if (qty > 1) {
      if (!confirm('Use one "' + (item.name || 'item') + '"?\nQuantity will drop to ' + (qty - 1) + '.')) return;
      item.quantity = qty - 1;
    } else {
      if (!confirm('Use "' + (item.name || 'item') + '"?\nIt will be consumed and removed from inventory.')) return;
      s.equipment.splice(idx, 1);
    }
  });
}

function toggleAttuned(charId, idx) {
  withSheetState(charId, function(s) {
    if (!s.equipment || !s.equipment[idx]) return;
    const item = s.equipment[idx];
    if (!item.attuned) {
      const attunedCount = s.equipment.filter(function(x) { return x.attuned; }).length;
      if (attunedCount >= 3) {
        alert('Attunement slots full (3/3). Unattune another item first.');
        return;
      }
      if (!confirm('Attune "' + (item.name || 'this item') + '"?\n\n2024 rule: requires a Short Rest of concentration on the item.\n\nAttunement persists once set, but its bonuses only apply while the item is also EQUIPPED.')) return;
      item.attuned = true;
    } else {
      if (!confirm('Break attunement with "' + (item.name || 'this item') + '"?')) return;
      item.attuned = false;
    }
  });
}

// Helper: does the catalog say this item is attunable?
function isItemAttunable(item) {
  if (!item) return false;
  if (item.custom) return false;
  if (typeof ITEMS_BY_ID === 'undefined') return false;
  const catItem = ITEMS_BY_ID[item.sourceItemId];
  return !!(catItem && catItem.attunement);
}

// Which action button (if any) belongs on this inventory row?
//   'equip'  → Equip toggle (weapons, armor, worn magic items)
//   'use'    → Use button (consumables: potions, scrolls, ammo-esque one-shots)
//   null     → no primary action (gear, tools, quest items, ambiguous custom items)
//
// Custom items get a heuristic based on the name (potion → use). Otherwise
// they get no action button — user should re-add from the catalog for
// proper linkage, or ignore.
function itemActionType(item) {
  if (!item) return null;
  const nameLow = String(item.name || '').toLowerCase();
  // Catalog-linked path
  if (!item.custom && typeof ITEMS_BY_ID !== 'undefined') {
    const catItem = ITEMS_BY_ID[item.sourceItemId];
    if (catItem) {
      const cat = String(catItem.category || '').toLowerCase();
      const catName = String(catItem.name || '').toLowerCase();
      if (cat === 'consumable') return 'use';
      if (cat === 'weapon' || cat === 'armor') return 'equip';
      if (cat === 'magic') {
        if (catName.indexOf('potion') >= 0 || catName.indexOf('scroll') >= 0 || catName.indexOf('elixir') >= 0) return 'use';
        return 'equip';
      }
      return null;
    }
  }
  // Custom item heuristics — only strong signals
  if (/^potion\b|\bpotion of\b|\belixir\b|\bscroll of\b/.test(nameLow)) return 'use';
  return null;
}

// Legacy alias kept for backwards compat with the render row.
function isItemEquippable(item) { return itemActionType(item) === 'equip'; }

// Extract weapon combat info for an equipped inventory item (name, damage, notes).
// Returns null if we can't get useful attack data.
function inventoryItemToAttack(item) {
  if (!item) return null;
  let name = item.name || 'Item';
  let damage = '—';
  let notes = item.notes || '';
  if (!item.custom && typeof ITEMS_BY_ID !== 'undefined') {
    const catItem = ITEMS_BY_ID[item.sourceItemId];
    if (catItem) {
      if (catItem.damage) damage = catItem.damage;
      if (catItem.properties && catItem.properties.length) {
        notes = catItem.properties.join(', ') + (notes ? ' · ' + notes : '');
      }
      if (catItem.category !== 'weapon') return null; // armor equipped but not an attack
    }
  }
  return { name: name, damage: damage, notes: notes };
}

// ---- Item picker modal ------------------------------------------------
let _pickerCharId = null;
let _pickerFilter = '';
let _pickerCategory = 'all';

function openItemPicker(charId) {
  if (typeof ITEMS_2024 === 'undefined') {
    alert('Item catalog (items-2024.js) not loaded — falling back to custom entry.');
    addCustomInventoryPrompt(charId);
    return;
  }
  _pickerCharId = charId;
  _pickerFilter = '';
  _pickerCategory = 'all';
  let modal = document.getElementById('sheet-item-picker');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'sheet-item-picker';
    // Massive z-index for safety in every non-top-layer parent; when reparented
    // into an open <dialog>, z-index stops mattering (dialog is top layer).
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(5,3,2,0.85);z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:1rem;font-family:\'Crimson Pro\',Georgia,serif';
    modal.addEventListener('click', function(e) {
      if (e.target === modal) closeItemPicker();
    });
  }
  // Reparent every time the picker opens: if the DM's sheet-dialog is open,
  // append the picker INSIDE it (so we render in the same browser top layer
  // and don't get hidden behind the dialog's backdrop). Otherwise the picker
  // lives on <body> for standalone sheet.html.
  const dialog = document.getElementById('sheet-dialog');
  const desiredParent = (dialog && dialog.open) ? dialog : document.body;
  if (modal.parentNode !== desiredParent) {
    desiredParent.appendChild(modal);
  }
  modal.style.display = 'flex';
  renderItemPicker();
}
function closeItemPicker() {
  const modal = document.getElementById('sheet-item-picker');
  if (modal) modal.style.display = 'none';
  _pickerCharId = null;
}
function setPickerFilter(text) { _pickerFilter = text; renderItemPicker(); }
function setPickerCategory(cat) { _pickerCategory = cat; renderItemPicker(); }
function renderItemPicker() {
  const modal = document.getElementById('sheet-item-picker');
  if (!modal || typeof ITEMS_2024 === 'undefined') return;
  const filter = (_pickerFilter || '').toLowerCase();
  const cat = _pickerCategory;
  const filtered = ITEMS_2024.filter(function(it) {
    if (cat !== 'all') {
      // Weapon tab also includes magic weapons (+1/+2/+3 variants and named
      // magic weapons like Flame Tongue) so a player browsing "weapons"
      // sees everything wieldable, not just mundane ones.
      const isMagicWeapon = it.subcategory === 'magic_weapon';
      const matches = it.category === cat || (cat === 'weapon' && isMagicWeapon);
      if (!matches) return false;
    }
    if (!filter) return true;
    return it.name.toLowerCase().indexOf(filter) !== -1 ||
           (it.subcategory || '').toLowerCase().indexOf(filter) !== -1;
  });
  const categories = ['all', 'weapon', 'armor', 'gear', 'consumable', 'magic'];
  const catTabs = categories.map(function(c) {
    const active = c === _pickerCategory;
    const bg = active ? 'var(--gold)' : 'rgba(160,128,64,0.15)';
    const fg = active ? '#0d0a06' : 'var(--gold2)';
    return '<button onclick="setPickerCategory(\'' + c + '\')" style="background:' + bg + ';color:' + fg + ';border:1px solid var(--gold2);border-radius:2px;padding:.25rem .6rem;font-family:\'Cinzel\',serif;font-size:9px;letter-spacing:1px;cursor:pointer">' + c.toUpperCase() + '</button>';
  }).join(' ');
  const rows = filtered.slice(0, 200).map(function(it) {
    return '<div style="padding:.5rem;border-bottom:1px solid rgba(160,128,64,0.15);cursor:pointer" onclick="addInventoryFromCatalog(\'' + _pickerCharId + '\',\'' + it.id + '\')" onmouseover="this.style.background=\'rgba(160,128,64,0.1)\'" onmouseout="this.style.background=\'transparent\'">' +
      '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:.5rem;margin-bottom:.15rem">' +
      '<strong style="font-family:\'Cinzel\',serif;color:var(--gold3);font-size:13px">' + _sheetEscapeAttr(it.name) + '</strong>' +
      '<span style="font-size:10px;color:var(--parch4);white-space:nowrap">' + _sheetEscapeAttr(it.cost || '') + (it.weight ? ' · ' + it.weight + ' lb' : '') + '</span>' +
      '</div>' +
      '<div style="font-size:11px;color:var(--parch2);line-height:1.4">' + _sheetEscapeAttr(it.description || '') + '</div>' +
      '<div style="font-size:9px;color:var(--parch4);margin-top:.2rem;font-style:italic">' + _sheetEscapeAttr(it.source || '') + (it.attunement ? ' · requires attunement' : '') + '</div>' +
      '</div>';
  }).join('');
  const body = rows || '<div style="padding:2rem;text-align:center;color:var(--parch4);font-style:italic">No items match. Use "Add Custom" for anything not in the catalog.</div>';
  modal.innerHTML =
    '<div style="background:#1a1208;border:1px solid var(--gold2);border-radius:4px;width:100%;max-width:640px;max-height:90vh;display:flex;flex-direction:column;color:var(--parch)">' +
      '<div style="padding:.75rem 1rem;border-bottom:1px solid rgba(160,128,64,0.3);display:flex;justify-content:space-between;align-items:center;background:rgba(20,15,8,0.9)">' +
        '<div style="font-family:\'Cinzel Decorative\',serif;color:var(--gold3);font-size:15px;letter-spacing:1.5px">Add to Inventory</div>' +
        '<button onclick="closeItemPicker()" style="background:transparent;border:1px solid var(--gold2);color:var(--gold2);border-radius:2px;padding:.2rem .6rem;cursor:pointer;font-family:\'Cinzel\',serif;font-size:11px">✕ Close</button>' +
      '</div>' +
      '<div style="padding:.6rem 1rem;background:rgba(20,15,8,0.7);border-bottom:1px solid rgba(160,128,64,0.15)">' +
        '<input type="text" id="sheet-picker-search" value="' + _sheetEscapeAttr(_pickerFilter) + '" placeholder="Search…" oninput="setPickerFilter(this.value)" style="width:100%;background:rgba(10,8,5,0.8);border:1px solid rgba(160,128,64,0.4);color:var(--parch);padding:.4rem .6rem;border-radius:2px;font-size:13px;margin-bottom:.4rem;font-family:inherit">' +
        '<div style="display:flex;flex-wrap:wrap;gap:.3rem">' + catTabs + '</div>' +
      '</div>' +
      '<div style="flex:1;overflow-y:auto">' + body + '</div>' +
      '<div style="padding:.6rem 1rem;border-top:1px solid rgba(160,128,64,0.3);background:rgba(20,15,8,0.9);display:flex;justify-content:space-between;align-items:center">' +
        '<span style="font-size:10px;color:var(--parch4)">' + filtered.length + ' items' + (filtered.length > 200 ? ' (showing 200)' : '') + '</span>' +
        '<button onclick="closeItemPicker();addCustomInventoryPrompt(\'' + _pickerCharId + '\')" style="background:rgba(160,128,64,0.15);color:var(--gold2);border:1px solid var(--gold2);border-radius:2px;padding:.35rem .8rem;font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:1px;cursor:pointer">+ Add Custom Item</button>' +
      '</div>' +
    '</div>';
  const searchInput = document.getElementById('sheet-picker-search');
  if (searchInput) {
    searchInput.focus();
    const l = searchInput.value.length;
    searchInput.setSelectionRange(l, l);
  }
}

// ----- Roll toast -----
let _sheetToastTimer;
function showRollToast(label, formula, result, opts) {
  opts = opts || {};
  const toast = document.getElementById('sheet-roll-toast');
  if (!toast) return;
  let cls = '';
  if (opts.crit) cls = 'crit';
  else if (opts.fumble) cls = 'fumble';
  toast.className = 'sheet-roll-toast show ' + cls;
  toast.innerHTML = '<span class="roll-label">' + label + '</span>' +
    '<span style="font-size:24px;display:block">' + result + '</span>' +
    '<span class="roll-formula">' + formula + '</span>';
  // If the DM sheet-dialog is open (top-layer <dialog>), reparent the toast
  // into it so we render in the same browser top layer and don't disappear
  // behind the dialog's backdrop. Same fix pattern as the item picker.
  const dialog = document.getElementById('sheet-dialog');
  const desiredParent = (dialog && dialog.open) ? dialog : document.body;
  if (toast.parentNode !== desiredParent) {
    desiredParent.appendChild(toast);
  }
  clearTimeout(_sheetToastTimer);
  _sheetToastTimer = setTimeout(function() { toast.classList.remove('show'); }, 3800);
}

// ----- Open / close / refresh -----
let _currentSheetId = null;

// Used by index.html dashboard — opens the modal. Standalone page just calls renderSheet directly.
function openCharacterSheet(charId) {
  const char = CHARACTERS[charId];
  if (!char) { alert('Character sheet not found: ' + charId); return; }
  _currentSheetId = charId;
  const titleEl = document.getElementById('sheet-title');
  if (titleEl) titleEl.textContent = char.name + ' — Character Sheet';
  // Update the dynamic pop-out link in the modal topbar to point to this character.
  const popoutLink = document.getElementById('sheet-popout-link');
  if (popoutLink) popoutLink.href = 'sheet.html?id=' + encodeURIComponent(charId);
  renderSheet(charId);
  const dialog = document.getElementById('sheet-dialog');
  if (dialog) {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }
}
function closeSheet() {
  const dialog = document.getElementById('sheet-dialog');
  if (!dialog) return;
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
  _currentSheetId = null;
}
function refreshSheet(charId) {
  const body = document.getElementById('sheet-body');
  if (!body) return;
  const scrollTop = body.scrollTop;
  renderSheet(charId);
  body.scrollTop = scrollTop;
}

// Multi-tab live sync: when any tab changes a character's state, refresh any open
// sheet in this tab that's currently showing the same character.
window.addEventListener('storage', function(e) {
  if (!e.key) return;
  if (e.key.startsWith('eldoria-char-state-')) {
    const updatedId = e.key.replace('eldoria-char-state-', '');
    if (_currentSheetId === updatedId) refreshSheet(updatedId);
  }
  // Cross-tab sync for the Lich Progress clock (shared between Now tab and
  // Vaeloran's sheet, also across browser tabs).
  if (e.key === 'eldoria-lich') {
    if (e.newValue !== null) lichFilled = parseInt(e.newValue, 10) || 0;
    renderLichClock();
  }
});

// ----- LICH PROGRESS CLOCK (shared: Now tab + Vaeloran's sheet + standalone) ---
// Renders into every element with class .lich-clock-display (and updates every
// .lich-count). State is persisted in localStorage key `eldoria-lich`.
let lichFilled = 2;
const LICH_LABELS = ['Self-Severance','Shard Acquired','Shard Attunement','Memories Extracted','Gate Node Corrupted','100 Souls','Valdris Formula','The Dark Rite','Willing Death','Lich Ascension'];
const LICH_COLORS = ['#2d6a30','#2d6a30','#8a6010','#555','#555','#555','#555','#7a1a1a','#7a1a1a','#7a1a1a'];
function initLichClock() {
  try {
    const saved = localStorage.getItem('eldoria-lich');
    if (saved !== null) lichFilled = parseInt(saved, 10) || 0;
  } catch (e) {}
  renderLichClock();
}
function renderLichClock() {
  // Always re-read from localStorage so cross-context renders are never stale.
  try {
    const saved = localStorage.getItem('eldoria-lich');
    if (saved !== null) lichFilled = parseInt(saved, 10) || 0;
  } catch (e) {}
  const displays = document.querySelectorAll('.lich-clock-display');
  displays.forEach(function(d) {
    d.innerHTML = '';
    for (let i = 0; i < 10; i++) {
      const seg = document.createElement('div');
      seg.style.cssText = 'min-width:80px;padding:6px 8px;border-radius:3px;font-family:\'Cinzel\',serif;font-size:9px;letter-spacing:.3px;cursor:pointer;transition:all .2s;border:1px solid rgba(160,128,64,0.3);text-align:center;line-height:1.3;';
      if (i < lichFilled) {
        seg.style.background = LICH_COLORS[i];
        seg.style.color = '#f4edd8';
        seg.style.borderColor = LICH_COLORS[i];
      } else {
        seg.style.background = 'rgba(20,15,8,0.6)';
        seg.style.color = 'rgba(160,128,64,0.4)';
      }
      seg.innerHTML = '<div style="font-size:11px;margin-bottom:2px">' + (i < lichFilled ? '✓' : (i+1)) + '</div>' + LICH_LABELS[i];
      const idx = i;
      seg.onclick = function() { advanceLichTo(idx); };
      d.appendChild(seg);
    }
  });
  document.querySelectorAll('.lich-count').forEach(function(c) { c.textContent = lichFilled; });
  if (typeof updateStatusBar === 'function') { try { updateStatusBar(); } catch (e) {} }
}
function advanceLichTo(idx) {
  // Click logic: if clicking a filled segment, retreat to that index; otherwise advance to idx+1.
  lichFilled = idx < lichFilled ? idx : idx + 1;
  try { localStorage.setItem('eldoria-lich', lichFilled); } catch (e) {}
  renderLichClock();
}

// ----- PLAGUE SYMPTOM ROLLER (Kaelith) -----
const PLAGUE_SYMPTOMS = [
  'Drained of all colour — appears in monochromatic grays.',
  'Sheds metallic rust-hued flakes and creaks while moving.',
  'Secretes foul-smelling mucus.',
  'Surrounded by a cloud of buzzing insects.',
  'Sprouts fungi or foliage from their flesh.',
  'Covered in glowing pustules.'
];
function rollPlagueSymptom(targetId) {
  targetId = targetId || 'plague-out';
  const el = document.getElementById(targetId);
  if (!el) return;
  const idx = Math.floor(Math.random() * PLAGUE_SYMPTOMS.length);
  el.textContent = '1d6 (' + (idx + 1) + ') → ' + PLAGUE_SYMPTOMS[idx];
}
// Backwards-compat alias used by any legacy callers
function genPlague() { rollPlagueSymptom('plague-out'); }

// ----- Character-specific extras: rendered at the end of each sheet -----
function renderCharacterExtras(char) {
  if (char.id === 'vaeloran') return renderVaeloranExtras();
  if (char.id === 'kaelith')  return renderKaelithExtras();
  return '';
}
function renderVaeloranExtras() {
  return '<div class="sheet-sub">' +
    '<div class="sheet-sub-title">Lich Progress — 10 Stages</div>' +
    '<div style="font-size:11px;color:var(--parch3);font-style:italic;margin-bottom:.4rem">Click a segment to set the stage. Live-synced with the Now tab.</div>' +
    '<div class="lich-clock-display" style="display:flex;flex-wrap:wrap;gap:6px;margin:.4rem 0"></div>' +
    '<div style="font-size:11.5px;color:var(--parch3);font-style:italic;margin-top:.3rem">Stages complete: <span class="lich-count">0</span> / 10 — see Now tab for stage details</div>' +
  '</div>';
}
function renderKaelithExtras() {
  return '<div class="sheet-sub">' +
    '<div class="sheet-sub-title">DM Tools — Plague Symptom Roller</div>' +
    '<div style="font-size:11.5px;color:var(--parch3);font-style:italic;margin-bottom:.4rem">Roll the 1d6 manifestation table for Plague Blessing effects on victims.</div>' +
    '<div id="plague-out" style="background:rgba(20,15,8,0.7);border:1px solid rgba(160,128,64,0.3);border-radius:3px;padding:.6rem .75rem;font-size:12.5px;color:var(--parch2);min-height:2.5rem;margin-bottom:.5rem;line-height:1.5">Click to roll...</div>' +
    '<button class="sheet-rest-btn" style="width:auto;padding:.4rem 1rem" onclick="rollPlagueSymptom()">🎲 Roll Symptom</button>' +
  '</div>';
}

// ----- Renderer -----
function renderSheet(charId) {
  // Subscribe to Firebase updates for this character (once per session).
  _subscribeSheetIfPossible(charId);
  const char = CHARACTERS[charId];
  const state = getSheetState(charId);
  const body = document.getElementById('sheet-body');
  if (!body) return;
  let html = '';

  // Rest buttons at the very top of the sheet (Phase 4B rev — user preference)
  html += '<div style="display:flex;justify-content:flex-end;gap:.5rem;padding:.3rem 0 .6rem;margin-bottom:.5rem;border-bottom:1px dashed rgba(160,128,64,0.25)">' +
    '<button onclick="shortRest(\'' + charId + '\')" style="background:rgba(160,128,64,0.15);color:var(--gold2);border:1px solid var(--gold2);border-radius:3px;padding:.45rem 1rem;font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:1.5px;cursor:pointer">🛏 Short Rest</button>' +
    '<button onclick="longRest(\'' + charId + '\')" style="background:var(--gold);color:#0d0a06;border:none;border-radius:3px;padding:.45rem 1rem;font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:1.5px;cursor:pointer">🌙 Long Rest</button>' +
    '</div>';

  html += '<div class="sheet-header">';
  html += '<div class="sheet-id-block">';
  html += '<div class="sheet-id-name">' + char.name + '</div>';
  html += '<div class="sheet-id-meta">';
  html += '<strong>Class:</strong> ' + char.className + ' ' + char.level + ' (' + char.subclass + ')<br>';
  html += '<strong>Species:</strong> ' + char.species + ' &nbsp; <strong>Background:</strong> ' + char.background + '<br>';
  html += '<strong>Alignment:</strong> ' + char.alignment;
  if (char.alias) html += '<br><strong>Alias:</strong> ' + char.alias;
  html += '</div></div>';
  html += '<div class="sheet-hex"><div class="sheet-hex-label">Armor Class</div><div class="sheet-hex-value">' + char.ac + '</div><div class="sheet-hex-sub">' + (char.acNote || '') + '</div></div>';
  html += renderHpBlock(charId, char, state);
  html += renderHitDiceBlock(charId, char, state);
  html += renderDeathSavesBlock(charId, state);
  html += '</div>';

  html += '<div class="sheet-strip">';
  html += '<div class="sheet-hex"><div class="sheet-hex-label">Proficiency</div><div class="sheet-hex-value">+' + char.proficiencyBonus + '</div></div>';
  html += '<div class="sheet-hex" onclick="rollInitiative(\'' + charId + '\')" style="cursor:pointer"><div class="sheet-hex-label">Initiative</div><div class="sheet-hex-value">' + sheetFmtMod(char.initiative) + '</div><div class="sheet-hex-sub" style="font-size:9px">click to roll</div></div>';
  html += '<div class="sheet-hex"><div class="sheet-hex-label">Speed</div><div class="sheet-hex-value">' + char.speed + '</div><div class="sheet-hex-sub">ft</div></div>';
  html += '<div class="sheet-hex"><div class="sheet-hex-label">Size</div><div class="sheet-hex-value" style="font-size:14px">' + char.size + '</div></div>';
  html += '<div class="sheet-hex"><div class="sheet-hex-label">Passive Perception</div><div class="sheet-hex-value">' + char.passivePerception + '</div></div>';
  html += '<div class="sheet-inspiration ' + (state.inspiration ? 'on' : '') + '" onclick="toggleInspiration(\'' + charId + '\')"><div class="sheet-inspiration-star">★</div><div style="flex:1;text-align:center;font-family:\'Cinzel\',serif;font-size:10px;letter-spacing:1px">Heroic Inspiration</div></div>';
  html += '</div>';

  html += '<div class="sheet-grid">';

  html += '<div>';
  ['str','dex','con','int','wis','cha'].forEach(function(a) { html += renderAbilityCard(charId, char, a); });
  // Rest buttons now live at the top of the sheet (Phase 4B rev). No middle-column row.
  html += '</div>';

  html += '<div>';
  html += renderWeaponsSection(charId, char);
  html += renderResourcesSection(charId, char, state);
  html += renderFeaturesSection(char);
  html += renderConditionsSection(charId, state);
  html += '</div>';

  html += '<div>';
  if (char.spellcasting) html += renderSpellsSection(charId, char, state);
  html += renderAttunementSection(charId, state);
  html += renderInventorySection(charId, char, state);
  html += renderCurrencySection(charId, state);
  html += renderEquipmentSection(char);
  html += renderBioSection(charId, char, state);
  html += renderCharacterExtras(char);
  html += '</div>';

  html += '</div>';
  body.innerHTML = html;

  // Keep _currentSheetId in sync (in case renderSheet is called directly by a standalone page)
  _currentSheetId = charId;

  // If this character includes a lich clock section, populate it from the saved state.
  if (body.querySelector('.lich-clock-display')) {
    if (typeof renderLichClock === 'function') renderLichClock();
  }
}

function renderHpBlock(charId, char, state) {
  return '<div class="sheet-hp">' +
    '<div class="sheet-hp-label">Hit Points</div>' +
    '<div class="sheet-hp-row">' +
      '<input type="number" value="' + state.hp.current + '" onchange="setHpCurrent(\'' + charId + '\', this.value)">' +
      '<span class="sheet-hp-max">/ ' + char.hpMax + '</span>' +
    '</div>' +
    '<div class="sheet-temp-row">Temp: <input type="number" value="' + (state.hp.temp||0) + '" onchange="setHpTemp(\'' + charId + '\', this.value)"></div>' +
    '<div class="sheet-hp-btns">' +
      '<button class="sheet-hp-btn dmg" onclick="hpPrompt(\'' + charId + '\', \'dmg\')">-?</button>' +
      '<button class="sheet-hp-btn dmg" onclick="hpDelta(\'' + charId + '\', -5)">-5</button>' +
      '<button class="sheet-hp-btn dmg" onclick="hpDelta(\'' + charId + '\', -1)">-1</button>' +
      '<button class="sheet-hp-btn heal" onclick="hpDelta(\'' + charId + '\', 1)">+1</button>' +
      '<button class="sheet-hp-btn heal" onclick="hpDelta(\'' + charId + '\', 5)">+5</button>' +
      '<button class="sheet-hp-btn heal" onclick="hpPrompt(\'' + charId + '\', \'heal\')">+?</button>' +
    '</div>' +
  '</div>';
}
function renderHitDiceBlock(charId, char, state) {
  return '<div class="sheet-hex">' +
    '<div class="sheet-hex-label">Hit Dice</div>' +
    '<div class="sheet-hex-value" style="font-size:18px">' + (char.hitDice.max - state.hitDiceSpent) + '<span style="font-size:11px;color:var(--parch3)">/' + char.hitDice.max + '</span></div>' +
    '<div class="sheet-hex-sub">' + char.hitDice.die + '</div>' +
    '<div class="sheet-hd-row"><button class="sheet-hd-roll" onclick="rollHitDie(\'' + charId + '\')" ' + (state.hitDiceSpent >= char.hitDice.max ? 'disabled' : '') + '>Spend</button></div>' +
  '</div>';
}
function renderDeathSavesBlock(charId, state) {
  let succHtml = '', failHtml = '';
  for (let i = 1; i <= 3; i++) {
    succHtml += '<div class="sheet-ds-circle success ' + (i<=state.deathSaves.successes?'on':'') + '" onclick="toggleDeathSave(\'' + charId + '\',\'successes\',' + i + ')"></div>';
    failHtml += '<div class="sheet-ds-circle failure ' + (i<=state.deathSaves.failures?'on':'') + '" onclick="toggleDeathSave(\'' + charId + '\',\'failures\',' + i + ')"></div>';
  }
  return '<div class="sheet-hex"><div class="sheet-hex-label">Death Saves</div><div class="sheet-deathsaves" style="margin-top:.3rem"><div class="sheet-ds-row">Succ ' + succHtml + '</div><div class="sheet-ds-row">Fail ' + failHtml + '</div></div></div>';
}
function renderAbilityCard(charId, char, abil) {
  const score = char.abilities[abil];
  const mod = sheetAbilityMod(score);
  const label = { str:'Strength', dex:'Dexterity', con:'Constitution', int:'Intelligence', wis:'Wisdom', cha:'Charisma' }[abil];
  const save = (char.saves || {})[abil];
  const saveMod = sheetGetSaveMod(char, abil);
  let rows = '<div class="sheet-skill-row sheet-skill-save" onclick="rollSave(\'' + charId + '\',\'' + abil + '\')">';
  rows += '<div class="sheet-skill-prof ' + (save && save.proficient ? 'on' : '') + '"></div>';
  rows += '<div class="sheet-skill-mod">' + sheetFmtMod(saveMod) + '</div>';
  rows += '<div class="sheet-skill-name">Saving Throw</div></div>';
  (SHEET_SKILLS_BY_ABILITY[abil] || []).forEach(function(sk) {
    const skObj = (char.skills || {})[sk] || {};
    const skMod = sheetGetSkillMod(char, sk);
    let profCls = '';
    if (skObj.expertise) profCls = 'on expertise';
    else if (skObj.proficient) profCls = 'on';
    rows += '<div class="sheet-skill-row" onclick="rollSkill(\'' + charId + '\',\'' + sk + '\')">';
    rows += '<div class="sheet-skill-prof ' + profCls + '"></div>';
    rows += '<div class="sheet-skill-mod">' + sheetFmtMod(skMod) + '</div>';
    rows += '<div class="sheet-skill-name">' + SHEET_SKILL_LABELS[sk] + '</div></div>';
  });
  return '<div class="sheet-ability"><div class="sheet-ability-head"><div class="sheet-ability-name">' + label + '</div><div class="sheet-ability-mod" onclick="rollAbility(\'' + charId + '\',\'' + abil + '\')" title="Roll ability check">' + sheetFmtMod(mod) + '</div><div class="sheet-ability-score">' + score + '</div></div><div class="sheet-ability-list">' + rows + '</div></div>';
}
function renderWeaponsSection(charId, char) {
  const state = getSheetState(charId);
  let rows = '';
  // 1. Curated weapons/cantrips from char definition (unarmed, damaging cantrips, class-feature attacks).
  (char.weapons || []).forEach(function(w, i) {
    rows += '<tr><td>' + w.name + '</td><td>' + sheetFmtMod(w.atk) + '</td><td>' + w.damage + '</td><td>' + (w.notes||'') + '</td><td><button class="sheet-weapon-roll" onclick="rollWeapon(\'' + charId + '\',' + i + ')">Roll</button></td></tr>';
  });
  // 2. Equipped inventory weapons (from state.equipment where equipped && weapon).
  (state.equipment || []).forEach(function(item) {
    if (!item.equipped) return;
    const atk = inventoryItemToAttack(item);
    if (!atk) return; // e.g., equipped armor — not an attack
    const bonus = computeInventoryAtkBonus(char, item);
    rows += '<tr style="background:rgba(201,168,76,0.05)">' +
      '<td>' + _sheetEscapeAttr(atk.name) + ' <span style="font-size:9px;color:var(--parch4);letter-spacing:.5px;font-family:\'Cinzel\',serif">⚔ EQ</span></td>' +
      '<td>' + sheetFmtMod(bonus) + '</td>' +
      '<td>' + _sheetEscapeAttr(atk.damage) + '</td>' +
      '<td style="font-size:11px">' + _sheetEscapeAttr(atk.notes) + '</td>' +
      '<td><button class="sheet-weapon-roll" onclick="rollInventoryWeapon(\'' + charId + '\',\'' + _sheetEscapeAttr(item.id) + '\')">Roll</button></td></tr>';
  });
  return '<div class="sheet-sub"><div class="sheet-sub-title">Attacks — Weapons, Cantrips &amp; Equipped Gear</div><table class="sheet-weapon-table"><thead><tr><th>Name</th><th>Atk</th><th>Damage</th><th>Notes</th><th></th></tr></thead><tbody>' + rows + '</tbody></table><div style="font-size:10px;color:var(--parch4);font-style:italic;margin-top:.35rem">Equipped inventory weapons appear here automatically. Drawing/stowing a weapon is 1 free interaction per turn; more cost an Action.</div></div>';
}
function renderFeaturesSection(char) {
  function buildList(items) {
    return (items || []).map(function(f) {
      return '<div class="sheet-feature"><div class="sheet-feature-name">' + f.name + '</div><div class="sheet-feature-desc">' + f.desc + '</div></div>';
    }).join('');
  }
  return '<div class="sheet-sub"><div class="sheet-sub-title">Class Features</div><div class="sheet-feature-list">' + buildList(char.classFeatures) + '</div></div>' +
    '<div class="sheet-sub"><div class="sheet-sub-title">Species Traits</div><div class="sheet-feature-list">' + buildList(char.speciesTraits) + '</div></div>' +
    '<div class="sheet-sub"><div class="sheet-sub-title">Feats</div><div class="sheet-feature-list">' + buildList(char.feats) + '</div></div>';
}
function renderResourcesSection(charId, char, state) {
  if (!char.resources || !char.resources.length) return '';
  let rows = '';
  char.resources.forEach(function(r) {
    const cur = state.resources[r.id] || 0;
    let control = '';
    let numberDisplay = '';
    if (r.display === 'counter') {
      // Numeric counter with − / typeable input / + buttons. Better than 999 dots.
      const btnStyle = 'background:rgba(160,128,64,0.15);border:1px solid var(--gold2);color:var(--gold2);width:22px;height:22px;border-radius:2px;cursor:pointer;font-size:14px;line-height:1;font-family:\'Cinzel\',serif;padding:0';
      const inputStyle = 'width:4.5ch;text-align:center;font-family:\'Cinzel\',serif;font-size:14px;color:var(--gold3);font-weight:600;background:rgba(10,8,5,0.6);border:1px solid rgba(160,128,64,0.4);border-radius:2px;padding:1px 2px;-moz-appearance:textfield';
      control =
        '<button type="button" style="' + btnStyle + '" onclick="bumpResource(\'' + charId + '\',\'' + r.id + '\',-1)">−</button>' +
        '<input type="number" min="0" max="' + (r.max || 999) + '" step="1" value="' + cur + '" style="' + inputStyle + '"' +
        ' onchange="setResourceValue(\'' + charId + '\',\'' + r.id + '\',this.value)"' +
        ' onkeydown="if(event.key===\'Enter\'){this.blur();}">' +
        '<button type="button" style="' + btnStyle + '" onclick="bumpResource(\'' + charId + '\',\'' + r.id + '\',1)">+</button>';
      numberDisplay = '';
    } else if (r.max > 0) {
      for (let i = 1; i <= r.max; i++) {
        control += '<span style="display:inline-block;width:11px;height:11px;border:1.5px solid var(--gold2);border-radius:50%;margin-right:3px;background:' + (i<=cur?'var(--gold2)':'transparent') + ';cursor:pointer" onclick="toggleResource(\'' + charId + '\',\'' + r.id + '\',' + i + ')"></span>';
      }
      numberDisplay = cur + '/' + r.max;
    } else {
      control = '<span style="color:var(--parch3);font-style:italic;font-size:11px">tracked manually</span>';
    }
    rows += '<div style="display:flex;justify-content:space-between;align-items:center;padding:.3rem .15rem;border-bottom:1px dashed rgba(160,128,64,0.15);gap:.5rem">' +
      '<div style="flex:1"><div style="font-family:\'Cinzel\',serif;font-size:11px;color:var(--gold2);letter-spacing:.5px">' + r.label + '</div>' +
      (r.note ? '<div style="font-size:10.5px;color:var(--parch3);font-style:italic;margin-top:.1rem">' + r.note + '</div>' : '') +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:.4rem">' + control +
      '<span style="font-size:10px;color:var(--parch3);min-width:28px;text-align:right">' + numberDisplay + '</span>' +
      '<span style="font-size:9px;color:var(--parch4);background:rgba(160,128,64,0.15);padding:1px 4px;border-radius:2px;letter-spacing:.5px">' + r.recharge[0].toUpperCase() + r.recharge.slice(1) + '</span>' +
      '</div></div>';
  });
  return '<div class="sheet-sub"><div class="sheet-sub-title">Resources & Per-Rest Pools</div>' + rows + '</div>';
}
function renderConditionsSection(charId, state) {
  let rows = '';
  SHEET_CONDITIONS.forEach(function(c) {
    const on = !!state.conditions[c];
    rows += '<div class="sheet-cond-row ' + (on?'on':'') + '" onclick="toggleCondition(\'' + charId + '\',\'' + c + '\')"><input type="checkbox" ' + (on?'checked':'') + ' onclick="event.stopPropagation();toggleCondition(\'' + charId + '\',\'' + c + '\')"> ' + c + '</div>';
  });
  // 2024 PHB Exhaustion: six levels total. Levels 1–5 each stack: −2 to
  // every d20 test and −5 ft Speed per level. Level 6 = death. The 6th
  // box is styled as DEATH to make the terminal state visually distinct.
  let boxes = '';
  for (let i = 1; i <= 6; i++) {
    const filled = i <= state.exhaustion;
    const isDeath = i === 6;
    const deathStyle = isDeath
      ? 'border-color:var(--red2)!important;' + (filled ? 'background:var(--red2)!important;color:#fff!important;' : 'color:var(--red2)!important;')
      : '';
    const label = isDeath ? (filled ? '☠' : '6') : (filled ? '✗' : '');
    boxes += '<div class="sheet-ex-box ' + (filled?'on':'') + '" style="' + deathStyle + '" title="' + (isDeath ? 'Level 6 — DEATH' : 'Level ' + i) + '" onclick="setExhaustion(\'' + charId + '\',' + i + ')">' + label + '</div>';
  }
  let statusText;
  if (state.exhaustion === 0) {
    statusText = 'none';
  } else if (state.exhaustion >= 6) {
    statusText = '<strong style="color:var(--red2)">DEAD</strong>';
  } else {
    const d20Pen = state.exhaustion * 2;
    const spdPen = state.exhaustion * 5;
    statusText = '−' + d20Pen + ' to d20 Tests · Speed −' + spdPen + ' ft';
  }
  return '<div class="sheet-sub"><div class="sheet-sub-title">Conditions</div><div class="sheet-cond-list">' + rows + '</div>' +
    '<div class="sheet-exhaustion"><strong style="font-family:\'Cinzel\',serif;font-size:10px;letter-spacing:1px;color:var(--parch3)">EXHAUSTION:</strong>' + boxes +
    '<span style="font-size:10.5px;color:var(--parch3);margin-left:.4rem">' + statusText + '</span></div></div>';
}
function renderSpellsSection(charId, char, state) {
  const sc = char.spellcasting;
  const cat = getSpellcastingCategory(char);
  const prepMax = getPreparedMax(char);

  // ---- Slot diamonds (unchanged) ----
  let slotHtml = '';
  for (let lvl = 1; lvl <= 9; lvl++) {
    const max = sc.slots[lvl-1] || 0;
    const expended = state.slots[lvl] || 0;
    let diamonds = '';
    for (let i = 1; i <= max; i++) {
      diamonds += '<div class="sheet-slot-diamond ' + (i<=expended?'expended':'') + '" onclick="toggleSlot(\'' + charId + '\',' + lvl + ',' + i + ')"></div>';
    }
    slotHtml += '<div class="sheet-slot-block"><div class="sheet-slot-level">L' + lvl + '</div><div class="sheet-slot-diamonds">' + diamonds + '</div><div class="sheet-slot-count">' + (max > 0 ? (max-expended) + '/' + max : '—') + '</div></div>';
  }

  const spells = state.spells || [];
  const cantrips = spells.filter(function(sp) { return sp.level === 0; });
  const alwaysPrepared = spells.filter(function(sp) { return sp.level > 0 && sp.alwaysPrepared; });

  // What's shown as "the prepared list" depends on category:
  // - full-list, spellbook, fixed-swap: only prepared:true (non-always)
  // - known-only: show all non-cantrip spells (no prep concept)
  let mainSpells;
  if (cat === 'known-only' || cat === 'none') {
    mainSpells = spells.filter(function(sp) { return sp.level > 0 && !sp.alwaysPrepared; });
  } else {
    mainSpells = spells.filter(function(sp) { return sp.level > 0 && sp.prepared && !sp.alwaysPrepared; });
  }
  const preparedCount = mainSpells.length; // always-prepared don't count

  // ---- Prep counter + Prepare button ----
  let headerRow = '';
  if (prepMax !== null && cat !== 'known-only') {
    const over = preparedCount > prepMax;
    headerRow = '<div style="display:flex;justify-content:space-between;align-items:center;margin:.3rem 0 .5rem;padding:.3rem .5rem;background:rgba(20,15,8,0.4);border-radius:3px">' +
      '<span style="font-size:11px;font-family:\'Cinzel\',serif;letter-spacing:.5px;color:' + (over ? 'var(--red2)' : 'var(--parch3)') + '">' +
      'Prepared: <strong style="color:' + (over ? 'var(--red2)' : 'var(--gold3)') + '">' + preparedCount + ' / ' + prepMax + '</strong>' +
      (over ? ' &nbsp;⚠ OVER LIMIT' : '') +
      '</span>' +
      '<button onclick="openPrepModal(\'' + charId + '\')" style="background:var(--gold);color:#0d0a06;border:none;border-radius:2px;padding:.3rem .7rem;font-family:\'Cinzel\',serif;font-size:10px;letter-spacing:1px;cursor:pointer">Prepare Spells</button>' +
      '</div>';
  } else if (cat === 'fixed-swap') {
    headerRow = '<div style="display:flex;justify-content:space-between;align-items:center;margin:.3rem 0 .5rem;padding:.3rem .5rem;background:rgba(20,15,8,0.4);border-radius:3px">' +
      '<span style="font-size:11px;font-family:\'Cinzel\',serif;color:var(--parch3)">Prepared list — swap one per long rest</span>' +
      '<button onclick="openPrepModal(\'' + charId + '\')" style="background:var(--gold);color:#0d0a06;border:none;border-radius:2px;padding:.3rem .7rem;font-family:\'Cinzel\',serif;font-size:10px;letter-spacing:1px;cursor:pointer">Manage Spells</button>' +
      '</div>';
  }

  // ---- Cantrips ----
  let cantripsHtml = '';
  if (cantrips.length) {
    cantripsHtml = '<div class="sheet-spell-level-group">' +
      '<div class="sheet-spell-level-header">Cantrips <span style="font-size:9px;color:var(--parch4);font-style:italic;font-weight:normal;letter-spacing:0">— always available</span></div>';
    cantrips.slice().sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); }).forEach(function(sp) {
      cantripsHtml += _renderSpellRow(charId, sp, { showRemove: cat !== 'full-list' });
    });
    cantripsHtml += '</div>';
  }

  // ---- Always-prepared subsection ----
  let alwaysHtml = '';
  if (alwaysPrepared.length) {
    alwaysHtml = '<div class="sheet-spell-level-group" style="border:1px dashed rgba(201,168,76,0.4);border-radius:3px;padding:.3rem .4rem;background:rgba(154,122,26,0.06)">' +
      '<div class="sheet-spell-level-header" style="color:var(--gold3)">★ Always Prepared <span style="font-size:9px;color:var(--parch4);font-style:italic;font-weight:normal;letter-spacing:0">— granted by class / race / feature; don\'t count against prep limit</span></div>';
    alwaysPrepared.slice().sort(function(a, b) { return a.level - b.level || (a.name || '').localeCompare(b.name || ''); }).forEach(function(sp) {
      alwaysHtml += _renderSpellRow(charId, sp, { showRemove: true, alwaysBadge: true });
    });
    alwaysHtml += '</div>';
  }

  // ---- Main prepared list (grouped by level) ----
  const byLevel = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [], 9: [] };
  mainSpells.forEach(function(sp) { if (byLevel[sp.level]) byLevel[sp.level].push(sp); });
  Object.keys(byLevel).forEach(function(k) { byLevel[k].sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); }); });
  let mainHtml = '';
  for (let lvl = 1; lvl <= 9; lvl++) {
    const list = byLevel[lvl];
    if (list.length === 0) continue;
    mainHtml += '<div class="sheet-spell-level-group"><div class="sheet-spell-level-header">Level ' + lvl + '</div>';
    list.forEach(function(sp) { mainHtml += _renderSpellRow(charId, sp, { showRemove: cat !== 'full-list' }); });
    mainHtml += '</div>';
  }
  if (!mainHtml && !alwaysHtml && !cantripsHtml) {
    mainHtml = '<div style="padding:.6rem;text-align:center;color:var(--parch4);font-style:italic;font-size:12px">' +
      (cat === 'full-list' ? 'No spells prepared. Click <strong>Prepare Spells</strong> above to choose from the full ' + _sheetEscapeAttr(char.className) + ' list.'
       : cat === 'spellbook' ? 'No spells known. Add spells to your spellbook using the buttons below, then click <strong>Prepare Spells</strong>.'
       : 'No spells. Use the buttons below to add.') +
      '</div>';
  }

  // ---- Category footer + Add buttons ----
  const catalogLoaded = (typeof SPELLS_2024 !== 'undefined');
  let footerHtml = '';
  if (cat === 'spellbook') {
    // Wizard: show a collapsible spellbook (all known spells)
    const knownCount = spells.filter(function(sp) { return sp.level > 0; }).length;
    footerHtml = '<details style="margin-top:.6rem;border:1px solid rgba(160,128,64,0.3);border-radius:3px;padding:.4rem .5rem;background:rgba(20,15,8,0.3)">' +
      '<summary style="cursor:pointer;font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:1px;color:var(--gold2)">📖 Spellbook — ' + knownCount + ' spells known (click to expand)</summary>' +
      '<div style="margin-top:.5rem">' + _renderSpellbookList(charId, spells) + '</div>' +
      '</details>';
  } else if (cat === 'full-list') {
    footerHtml = '<div style="margin-top:.5rem;padding:.4rem .6rem;background:rgba(20,15,8,0.3);border-radius:3px;font-size:11px;color:var(--parch3);font-style:italic">' +
      _sheetEscapeAttr(char.className) + 's have access to their entire class spell list. Prepare from the full list via the button above. Custom (homebrew) spells you add via the buttons below are included in the prep modal too.' +
      '</div>';
  }
  const addRow = '<div style="margin-top:.5rem;display:flex;gap:.4rem;flex-wrap:wrap">' +
    (catalogLoaded
      ? '<button onclick="openSpellPicker(\'' + charId + '\')" style="background:var(--gold);color:#0d0a06;border:none;border-radius:2px;padding:.35rem .8rem;font-family:\'Cinzel\',serif;font-size:10px;letter-spacing:1px;cursor:pointer">+ Add from Catalog</button>'
      : '') +
    '<button onclick="addCustomSpellPrompt(\'' + charId + '\')" style="background:rgba(160,128,64,0.15);color:var(--gold2);border:1px solid var(--gold2);border-radius:2px;padding:.35rem .8rem;font-family:\'Cinzel\',serif;font-size:10px;letter-spacing:1px;cursor:pointer">+ Add Custom</button>' +
    '</div>';

  // Update 12 — Concentration badge
  let concentrationBadge = '';
  if (state.concentration) {
    concentrationBadge = '<div style="margin:.4rem 0 .6rem;padding:.4rem .65rem;background:rgba(90,60,150,0.15);border:1px solid rgba(160,120,200,0.5);border-left:3px solid #a070c0;border-radius:3px;display:flex;justify-content:space-between;align-items:center;gap:.5rem">' +
      '<div style="font-size:12.5px;color:#d0b8e8"><span style="font-family:\'Cinzel\',serif;font-size:10px;letter-spacing:1.5px;color:#a070c0;margin-right:.4rem">🌀 CONCENTRATING</span>' + _sheetEscapeAttr(state.concentration.spellName) + '</div>' +
      '<button onclick="breakConcentration(\'' + charId + '\')" style="background:transparent;border:1px solid #a070c0;color:#a070c0;padding:2px 10px;border-radius:2px;font-family:\'Cinzel\',serif;font-size:10px;letter-spacing:.8px;cursor:pointer">Break</button>' +
      '</div>';
  }
  // Update 16 — Effective Save DC + spell attack when exhausted (2024: −2 per level).
  const exhPenalty = (state.exhaustion || 0) * 2;
  const effDC = sc.saveDC - exhPenalty;
  const effAtk = sc.attackBonus - exhPenalty;
  const dcDisplay = exhPenalty > 0
    ? sc.saveDC + ' <span style="color:#e0a0a0;font-size:10px">(effective ' + effDC + ' · exh −' + exhPenalty + ')</span>'
    : String(sc.saveDC);
  const atkDisplay = exhPenalty > 0
    ? sheetFmtMod(sc.attackBonus) + ' <span style="color:#e0a0a0;font-size:10px">(eff ' + sheetFmtMod(effAtk) + ')</span>'
    : sheetFmtMod(sc.attackBonus);
  return '<div class="sheet-sub"><div class="sheet-sub-title">Spellcasting — ' + sc.ability + ' · Save DC ' + dcDisplay + ' · Atk ' + atkDisplay + '</div>' +
    concentrationBadge +
    '<div class="sheet-slots-row">' + slotHtml + '</div>' +
    headerRow +
    cantripsHtml +
    alwaysHtml +
    mainHtml +
    footerHtml +
    addRow +
    '</div>';
}

function _renderSpellRow(charId, sp, opts) {
  opts = opts || {};
  const isCantrip = sp.level === 0;
  let tagSpans = '';
  if (sp.concentration) tagSpans += '<span class="spell-tag conc" title="Concentration">C</span>';
  if (sp.ritual)        tagSpans += '<span class="spell-tag" title="Ritual">R</span>';
  const schoolBadge = sp.school ? '<span style="font-size:9px;color:var(--parch4);text-transform:capitalize;letter-spacing:.5px;margin-left:.4rem">' + _sheetEscapeAttr(sp.school) + '</span>' : '';
  const alwaysBadge = opts.alwaysBadge && sp.alwaysPreparedReason
    ? '<span style="font-size:9px;color:var(--gold3);font-style:italic;letter-spacing:.3px;margin-left:.4rem">★ ' + _sheetEscapeAttr(sp.alwaysPreparedReason) + '</span>'
    : '';
  const castBtn = '<button onclick="event.stopPropagation();castSpell(\'' + charId + '\',\'' + sp.id + '\')" style="background:var(--gold);color:#0d0a06;border:none;border-radius:2px;padding:3px 12px;cursor:pointer;font-size:10px;font-family:\'Cinzel\',serif;letter-spacing:1px;font-weight:600;white-space:nowrap" title="' + (isCantrip ? 'Cast (no slot expended)' : 'Cast at base level (' + sp.level + ') — expends a slot') + '">Cast</button>';
  // Upcast is always available for non-cantrips (any leveled spell can be cast
  // from a higher slot, even without special upcast text — you might just be
  // out of base-level slots). Cantrips can't be upcast.
  const upcastBtn = isCantrip
    ? ''
    : '<button onclick="event.stopPropagation();toggleUpcast(\'' + sp.id + '\')" style="background:rgba(160,128,64,0.15);border:1px solid var(--gold2);color:var(--gold2);border-radius:2px;padding:3px 12px;cursor:pointer;font-size:10px;font-family:\'Cinzel\',serif;letter-spacing:1px;white-space:nowrap" title="Cast at a higher slot level' + (sp.atHigherLevels ? ' — this spell scales' : '') + '">Upcast</button>';
  // Update 13 — Ritual button on ritual-tagged non-cantrips (cantrips can't be ritual).
  const ritualBtn = (sp.ritual && !isCantrip)
    ? '<button onclick="event.stopPropagation();ritualCast(\'' + charId + '\',\'' + sp.id + '\')" style="background:rgba(90,60,150,0.15);border:1px solid #a070c0;color:#c8a8e0;border-radius:2px;padding:3px 10px;cursor:pointer;font-size:10px;font-family:\'Cinzel\',serif;letter-spacing:1px;white-space:nowrap" title="Ritual cast — no slot, +10 min casting time">📜 Ritual</button>'
    : '';
  // Override the .sheet-spell-row grid (which expects 3 cells) with an explicit
  // flex layout: name/info on the left (flex:1), Cast + Upcast pinned right.
  return '<div class="sheet-spell-row" style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.6rem;grid-template-columns:none">' +
    '<div style="flex:1;min-width:0;cursor:pointer" onclick="toggleSpellDetail(\'' + sp.id + '\')">' +
      '<div class="sheet-spell-name">' + _sheetEscapeAttr(sp.name) + tagSpans + schoolBadge + alwaysBadge + '</div>' +
    '</div>' +
    '<div style="display:flex;align-items:center;gap:.35rem;flex-shrink:0">' + castBtn + upcastBtn + ritualBtn + '</div>' +
    '<div class="sheet-spell-detail" id="spell-detail-' + sp.id + '" style="display:none;flex-basis:100%;margin-top:.3rem;padding:.4rem .6rem;background:rgba(20,15,8,0.5);border-left:2px solid var(--gold2);font-size:11.5px;line-height:1.5;color:var(--parch2)">' +
      '<div style="font-size:10px;color:var(--parch3);letter-spacing:.5px;margin-bottom:.3rem"><strong>' + (isCantrip ? 'Cantrip' : 'Level ' + sp.level) + ' · ' + _sheetEscapeAttr(sp.school || '—') + '</strong> · ' + _sheetEscapeAttr(sp.castingTime || 'Action') + ' · Range ' + _sheetEscapeAttr(sp.range || '—') + ' · ' + _sheetEscapeAttr(sp.duration || '') + '</div>' +
      (sp.components ? '<div style="font-size:10px;color:var(--parch4);margin-bottom:.3rem"><em>Components:</em> ' + _sheetEscapeAttr(sp.components) + '</div>' : '') +
      _sheetEscapeAttr(sp.description || '') +
    '</div>' +
    (isCantrip ? '' :
      '<div class="sheet-spell-upcast" id="spell-upcast-' + sp.id + '" style="display:none;flex-basis:100%;margin-top:.3rem;padding:.4rem .6rem;background:rgba(154,122,26,0.15);border-left:2px solid var(--gold3);font-size:11.5px;line-height:1.5;color:var(--parch)">' +
        (sp.atHigherLevels
          ? '<strong style="font-family:\'Cinzel\',serif;font-size:10px;letter-spacing:1px;color:var(--gold3)">AT HIGHER LEVELS —</strong> ' + _sheetEscapeAttr(sp.atHigherLevels)
          : '<em style="color:var(--parch3);font-size:10.5px">This spell has no additional scaling text at higher levels — casting from a higher slot still works if you\'re out of the base slot.</em>') +
        _renderUpcastCastButtons(charId, sp) +
        '</div>') +
    '</div>';
}

// Render "Cast at L4 / L5 / …" buttons inside the upcast panel — only slot
// levels the character actually has and that are higher than the spell's
// base level.
function _renderUpcastCastButtons(charId, sp) {
  if (sp.level === 0) return ''; // cantrips can't upcast
  const char = CHARACTERS[charId];
  const slots = (char.spellcasting && char.spellcasting.slots) || [];
  let btns = '';
  for (let lvl = sp.level + 1; lvl <= 9; lvl++) {
    const max = slots[lvl - 1] || 0;
    if (max <= 0) continue;
    btns += '<button onclick="castSpell(\'' + charId + '\',\'' + sp.id + '\',' + lvl + ')" style="background:var(--gold);color:#0d0a06;border:none;border-radius:2px;padding:2px 8px;cursor:pointer;font-size:10px;font-family:\'Cinzel\',serif;letter-spacing:.5px;margin-right:.3rem">⚡ Cast at L' + lvl + '</button>';
  }
  if (!btns) return '';
  return '<div style="margin-top:.4rem;display:flex;flex-wrap:wrap;gap:.2rem">' + btns + '</div>';
}

// Spellbook list (Wizard's collapsible section) — flat list with always-prepared toggle
function _renderSpellbookList(charId, spells) {
  const nonCantrips = spells.filter(function(sp) { return sp.level > 0; })
    .sort(function(a, b) { return a.level - b.level || (a.name || '').localeCompare(b.name || ''); });
  if (nonCantrips.length === 0) return '<div style="font-size:11px;color:var(--parch4);font-style:italic">Spellbook empty. Add spells with the buttons below.</div>';
  let html = '<table style="width:100%;border-collapse:collapse;font-size:11px">' +
    '<tr style="border-bottom:1px solid rgba(160,128,64,0.3)"><th style="text-align:left;font-family:\'Cinzel\',serif;font-size:9px;color:var(--gold2);padding:.2rem;letter-spacing:.5px">Spell</th><th style="width:4ch;font-family:\'Cinzel\',serif;font-size:9px;color:var(--gold2);padding:.2rem">Lvl</th><th style="width:6ch;font-family:\'Cinzel\',serif;font-size:9px;color:var(--gold2);padding:.2rem;text-align:center">Always</th><th style="width:3ch"></th></tr>';
  nonCantrips.forEach(function(sp) {
    html += '<tr style="border-bottom:1px dashed rgba(160,128,64,0.15)">' +
      '<td style="padding:.2rem;color:var(--parch2)">' + _sheetEscapeAttr(sp.name) + (sp.prepared && !sp.alwaysPrepared ? ' <span style="font-size:9px;color:var(--gold3)">✓prep</span>' : '') + '</td>' +
      '<td style="padding:.2rem;text-align:center;color:var(--parch3)">' + sp.level + '</td>' +
      '<td style="padding:.2rem;text-align:center"><input type="checkbox" ' + (sp.alwaysPrepared ? 'checked' : '') + ' onchange="toggleAlwaysPrepared(\'' + charId + '\',\'' + sp.id + '\')"></td>' +
      '<td style="padding:.2rem;text-align:center"><button onclick="removeSpell(\'' + charId + '\',\'' + sp.id + '\')" style="background:transparent;border:1px solid var(--red2);color:var(--red2);border-radius:2px;padding:0 4px;cursor:pointer;font-size:9px">✕</button></td>' +
      '</tr>';
  });
  html += '</table>';
  return html;
}

function toggleAlwaysPrepared(charId, spellId) {
  const state = getSheetState(charId);
  const sp = (state.spells || []).find(function(x) { return x.id === spellId; });
  if (!sp) return;
  if (sp.alwaysPrepared) {
    // Unmark — no prompt needed.
    withSheetState(charId, function(s) {
      const t = (s.spells || []).find(function(x) { return x.id === spellId; });
      if (t) { t.alwaysPrepared = false; t.alwaysPreparedReason = ''; }
    });
    return;
  }
  // Two-step prompt: category, then specific.
  const catRaw = prompt(
    'Why is this spell always prepared?\n\n' +
    '1. Class feature (e.g. Domain, Oath, Subclass)\n' +
    '2. Feat\n' +
    '3. Race / Species\n' +
    '4. Background\n' +
    '5. Magic item\n' +
    '6. Other\n\n' +
    'Type 1-6:',
    '1'
  );
  if (catRaw === null) return;
  const catNum = parseInt(catRaw, 10);
  const categories = ['Class feature', 'Feat', 'Race', 'Background', 'Magic item', 'Other'];
  const category = (catNum >= 1 && catNum <= 6) ? categories[catNum - 1] : 'Other';
  const detail = prompt(
    category + ' — specific name?\n' +
    '(e.g. "Life Domain", "Magic Initiate", "Chthonic Legacy", "Acolyte", "Wand of Web")',
    ''
  );
  if (detail === null) return;
  const reason = detail.trim() ? (category + ': ' + detail.trim()) : category;
  withSheetState(charId, function(s) {
    const t = (s.spells || []).find(function(x) { return x.id === spellId; });
    if (!t) return;
    t.alwaysPrepared = true;
    t.alwaysPreparedReason = reason;
    t.prepared = true;
  });
}

// =====================================================================
// PREP MODAL (Phase 4B rev)
// Full-list casters (Cleric/Druid/Paladin): shows the entire class list
// from SPELLS_2024 plus custom entries in state.spells. Toggling checks a
// spell adds/updates the state.spells entry with prepared:true.
//
// Spellbook casters (Wizard): shows the spellbook (state.spells with level>0).
//
// Fixed-swap (Ranger, Artificer): shows their known list (state.spells).
// =====================================================================
let _prepModalCharId = null;
let _prepModalFilter = '';
let _prepModalLevel = 'all';

function openPrepModal(charId) {
  const char = CHARACTERS[charId];
  if (!hasPrepModal(char)) { alert('This class does not use daily spell preparation.'); return; }
  if (typeof SPELLS_2024 === 'undefined' && getSpellcastingCategory(char) === 'full-list') {
    alert('Spell catalog not loaded — cannot open prep modal for full-list casters.');
    return;
  }
  _prepModalCharId = charId;
  _prepModalFilter = '';
  _prepModalLevel = 'all';
  let modal = document.getElementById('sheet-prep-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'sheet-prep-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(5,3,2,0.85);z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:1rem;font-family:\'Crimson Pro\',Georgia,serif';
    modal.addEventListener('click', function(e) { if (e.target === modal) closePrepModal(); });
  }
  const dialog = document.getElementById('sheet-dialog');
  const desiredParent = (dialog && dialog.open) ? dialog : document.body;
  if (modal.parentNode !== desiredParent) desiredParent.appendChild(modal);
  modal.style.display = 'flex';
  renderPrepModal();
}
function closePrepModal() {
  const modal = document.getElementById('sheet-prep-modal');
  if (modal) modal.style.display = 'none';
  _prepModalCharId = null;
}
function setPrepModalFilter(text) { _prepModalFilter = text; renderPrepModal(); }
function setPrepModalLevel(lvl)   { _prepModalLevel = (lvl === 'all') ? 'all' : parseInt(lvl, 10); renderPrepModal(); }

// Called from checkbox onchange inside the prep modal.
// spellKey is either 'stateId:<id>' (existing state entry) or 'catalog:<id>' (from SPELLS_2024, add on prep)
function togglePrepFromModal(spellKey, checked) {
  const charId = _prepModalCharId;
  if (!charId) return;
  withSheetState(charId, function(s) {
    if (!s.spells) s.spells = [];
    if (spellKey.indexOf('stateId:') === 0) {
      const id = spellKey.slice(8);
      const sp = s.spells.find(function(x) { return x.id === id; });
      if (sp) sp.prepared = checked;
    } else if (spellKey.indexOf('catalog:') === 0) {
      const catalogId = spellKey.slice(8);
      const src = SPELLS_BY_ID[catalogId];
      if (!src) return;
      const existing = s.spells.find(function(x) { return x.sourceSpellId === catalogId; });
      if (existing) {
        existing.prepared = checked;
      } else if (checked) {
        s.spells.push({
          id: 'spell_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
          sourceSpellId: catalogId,
          name: src.name,
          level: src.level,
          school: src.school || '',
          castingTime: src.castingTime || 'Action',
          range: src.range || '—',
          components: src.components || '',
          duration: src.duration || '',
          concentration: !!src.concentration,
          ritual: !!src.ritual,
          description: src.description || '',
          atHigherLevels: src.atHigherLevels || null,
          prepared: true,
          alwaysPrepared: false,
          alwaysPreparedReason: '',
          custom: false
        });
      }
    }
  });
  renderPrepModal();
}

function renderPrepModal() {
  const modal = document.getElementById('sheet-prep-modal');
  if (!modal || !_prepModalCharId) return;
  const charId = _prepModalCharId;
  const char = CHARACTERS[charId];
  const state = getSheetState(charId);
  const cat = getSpellcastingCategory(char);
  const prepMax = getPreparedMax(char);

  // Build the union list of spells to show in the modal
  const stateSpells = (state.spells || []).filter(function(sp) { return sp.level > 0; });
  let entries = []; // { key, name, level, school, castingTime, description, atHigherLevels, prepared, alwaysPrepared, alwaysPreparedReason, source: 'state' | 'catalog' }
  const seenCatalogIds = {};
  stateSpells.forEach(function(sp) {
    if (sp.sourceSpellId) seenCatalogIds[sp.sourceSpellId] = true;
    entries.push({
      key: 'stateId:' + sp.id,
      name: sp.name, level: sp.level, school: sp.school,
      castingTime: sp.castingTime, description: sp.description, atHigherLevels: sp.atHigherLevels,
      prepared: !!sp.prepared, alwaysPrepared: !!sp.alwaysPrepared, alwaysPreparedReason: sp.alwaysPreparedReason || '',
      source: 'state', custom: !!sp.custom
    });
  });
  if (cat === 'full-list') {
    // Add class list spells not already in state
    const classSpells = getFullClassSpells(char.className);
    classSpells.forEach(function(sp) {
      if (sp.level === 0) return;
      if (seenCatalogIds[sp.id]) return;
      entries.push({
        key: 'catalog:' + sp.id,
        name: sp.name, level: sp.level, school: sp.school,
        castingTime: sp.castingTime, description: sp.description, atHigherLevels: sp.atHigherLevels,
        prepared: false, alwaysPrepared: false, alwaysPreparedReason: '',
        source: 'catalog', custom: false
      });
    });
  }

  // Filter
  const filter = (_prepModalFilter || '').toLowerCase();
  const filtered = entries.filter(function(e) {
    if (_prepModalLevel !== 'all' && e.level !== _prepModalLevel) return false;
    if (!filter) return true;
    return (e.name || '').toLowerCase().indexOf(filter) !== -1;
  }).sort(function(a, b) { return a.level - b.level || (a.name || '').localeCompare(b.name || ''); });

  // Prep count (excluding always-prepared)
  const preparedCount = entries.filter(function(e) { return e.prepared && !e.alwaysPrepared; }).length;
  const alwaysCount = entries.filter(function(e) { return e.alwaysPrepared; }).length;
  const over = prepMax !== null && preparedCount > prepMax;

  // Level filter buttons
  const levels = ['all', 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const levelBtns = levels.map(function(l) {
    const active = _prepModalLevel === l;
    const bg = active ? 'var(--gold)' : 'rgba(160,128,64,0.15)';
    const fg = active ? '#0d0a06' : 'var(--gold2)';
    const label = (l === 'all') ? 'All' : String(l);
    return '<button onclick="setPrepModalLevel(\'' + l + '\')" style="background:' + bg + ';color:' + fg + ';border:1px solid var(--gold2);border-radius:2px;padding:.2rem .5rem;font-family:\'Cinzel\',serif;font-size:9px;letter-spacing:.5px;cursor:pointer">' + label + '</button>';
  }).join(' ');

  // Rows
  let rowsHtml = '';
  let currentLevel = -1;
  filtered.forEach(function(e) {
    if (e.level !== currentLevel) {
      currentLevel = e.level;
      rowsHtml += '<div style="font-family:\'Cinzel\',serif;font-size:10px;letter-spacing:1px;color:var(--gold3);padding:.4rem 0 .2rem;border-bottom:1px solid rgba(160,128,64,0.2);margin-top:.5rem">Level ' + currentLevel + '</div>';
    }
    const disabled = e.alwaysPrepared ? 'disabled' : '';
    const badge = e.alwaysPrepared
      ? '<span style="font-size:9px;color:var(--gold3);margin-left:.4rem">★ Always (' + _sheetEscapeAttr(e.alwaysPreparedReason) + ')</span>'
      : (e.source === 'catalog' ? '<span style="font-size:9px;color:var(--parch4);margin-left:.4rem;font-style:italic">from class list</span>' : '');
    rowsHtml += '<label style="display:flex;align-items:center;gap:.5rem;padding:.3rem .3rem;border-bottom:1px dashed rgba(160,128,64,0.1);cursor:pointer">' +
      '<input type="checkbox" ' + (e.prepared || e.alwaysPrepared ? 'checked' : '') + ' ' + disabled + ' onchange="togglePrepFromModal(\'' + e.key + '\', this.checked)" style="cursor:pointer">' +
      '<span style="flex:1;font-size:12px;color:var(--parch2)">' + _sheetEscapeAttr(e.name) + badge + '</span>' +
      '<span style="font-size:10px;color:var(--parch4);text-transform:capitalize">' + _sheetEscapeAttr(e.school || '') + '</span>' +
      '</label>';
  });

  const prepHeader = (prepMax !== null)
    ? '<div style="font-size:12px;color:' + (over ? 'var(--red2)' : 'var(--parch)') + ';font-family:\'Cinzel\',serif;letter-spacing:.5px">Prepared: <strong style="color:' + (over ? 'var(--red2)' : 'var(--gold3)') + ';font-size:16px">' + preparedCount + ' / ' + prepMax + '</strong>' + (over ? ' ⚠ OVER LIMIT' : '') + (alwaysCount ? ' &nbsp;<span style="font-size:10px;color:var(--parch4)">+ ' + alwaysCount + ' always-prepared</span>' : '') + '</div>'
    : '<div style="font-size:12px;color:var(--parch);font-family:\'Cinzel\',serif">Prepared: <strong style="color:var(--gold3);font-size:16px">' + preparedCount + '</strong>' + (alwaysCount ? ' &nbsp;<span style="font-size:10px;color:var(--parch4)">+ ' + alwaysCount + ' always-prepared</span>' : '') + '</div>';

  const catNote = cat === 'full-list'
    ? '<div style="font-size:10.5px;color:var(--parch3);font-style:italic;margin-top:.2rem">Showing the entire ' + _sheetEscapeAttr(char.className) + ' class list. Toggle to prepare for the day. Always-prepared spells (★) are locked.</div>'
    : cat === 'spellbook'
    ? '<div style="font-size:10.5px;color:var(--parch3);font-style:italic;margin-top:.2rem">Showing spells in your spellbook. Toggle to prepare for the day. Always-prepared spells (★) are locked.</div>'
    : '<div style="font-size:10.5px;color:var(--parch3);font-style:italic;margin-top:.2rem">Showing your prepared list.</div>';

  modal.innerHTML =
    '<div style="background:#1a1208;border:1px solid var(--gold2);border-radius:4px;width:100%;max-width:640px;max-height:90vh;display:flex;flex-direction:column;color:var(--parch)">' +
      '<div style="padding:.75rem 1rem;border-bottom:1px solid rgba(160,128,64,0.3);background:rgba(20,15,8,0.9)">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.35rem">' +
          '<div style="font-family:\'Cinzel Decorative\',serif;color:var(--gold3);font-size:15px;letter-spacing:1.5px">Prepare Spells — ' + _sheetEscapeAttr(char.name) + '</div>' +
          '<button onclick="closePrepModal()" style="background:transparent;border:1px solid var(--gold2);color:var(--gold2);border-radius:2px;padding:.2rem .6rem;cursor:pointer;font-family:\'Cinzel\',serif;font-size:11px">✕ Done</button>' +
        '</div>' +
        prepHeader +
        catNote +
      '</div>' +
      '<div style="padding:.5rem 1rem;background:rgba(20,15,8,0.7);border-bottom:1px solid rgba(160,128,64,0.15)">' +
        '<input type="text" id="prep-modal-search" value="' + _sheetEscapeAttr(_prepModalFilter) + '" placeholder="Search spells…" oninput="setPrepModalFilter(this.value)" style="width:100%;background:rgba(10,8,5,0.8);border:1px solid rgba(160,128,64,0.4);color:var(--parch);padding:.35rem .55rem;border-radius:2px;font-size:13px;margin-bottom:.35rem;font-family:inherit">' +
        '<div style="display:flex;flex-wrap:wrap;gap:.2rem"><span style="font-size:10px;color:var(--parch4);align-self:center;margin-right:.2rem">Level:</span>' + levelBtns + '</div>' +
      '</div>' +
      '<div style="flex:1;overflow-y:auto;padding:0 1rem .5rem">' + (rowsHtml || '<div style="padding:2rem;text-align:center;color:var(--parch4);font-style:italic">No spells match.</div>') + '</div>' +
      '<div style="padding:.6rem 1rem;border-top:1px solid rgba(160,128,64,0.3);background:rgba(20,15,8,0.9);display:flex;justify-content:flex-end;align-items:center;gap:.5rem">' +
        '<button onclick="closePrepModal()" style="background:var(--gold);color:#0d0a06;border:none;border-radius:2px;padding:.4rem 1rem;font-family:\'Cinzel\',serif;font-size:12px;letter-spacing:1.5px;cursor:pointer">Done</button>' +
      '</div>' +
    '</div>';
  const s = document.getElementById('prep-modal-search');
  if (s && !filter) { s.focus(); }
}
function renderEquipmentSection(char) {
  // Phase 4A: this section is now static reference only (Languages,
  // Proficiencies, Attunements — the read-only class/species/background
  // material). Inventory and Currency are their own editable sections
  // rendered separately.
  const attList = (char.attunements || []).map(function(a) { return '<li>' + a + '</li>'; }).join('');
  const langs = (char.languages || []).join(', ');
  let trainHtml = '';
  if (char.equipmentProf) {
    const ep = char.equipmentProf;
    trainHtml = '<div style="font-size:11.5px;color:var(--parch2);margin-bottom:.4rem">' +
      '<strong style="font-family:\'Cinzel\',serif;color:var(--parch3);font-size:10px;letter-spacing:1px">ARMOR:</strong> ' + ((ep.armor||[]).length ? ep.armor.join(', ') : 'None') + '<br>' +
      '<strong style="font-family:\'Cinzel\',serif;color:var(--parch3);font-size:10px;letter-spacing:1px">WEAPONS:</strong> ' + (ep.weapons||[]).join(', ') + '<br>' +
      '<strong style="font-family:\'Cinzel\',serif;color:var(--parch3);font-size:10px;letter-spacing:1px">TOOLS:</strong> ' + ((ep.tools||[]).length ? ep.tools.join(', ') : 'None') +
    '</div>';
  }
  // Attunement is now live via renderAttunementSection (Update 18b) — the static list is retired.
  return '<div class="sheet-sub"><div class="sheet-sub-title">Languages</div><div style="font-size:12px;color:var(--parch2)">' + langs + '</div></div>' +
    '<div class="sheet-sub"><div class="sheet-sub-title">Equipment Training & Proficiencies</div>' + trainHtml + '</div>';
}
function renderBioSection(charId, char, state) {
  return '<div class="sheet-sub"><div class="sheet-sub-title">Appearance · Backstory · Personality</div><div style="font-size:12px;color:var(--parch2);line-height:1.5">' +
    (char.appearance ? '<strong>Appearance:</strong> ' + char.appearance + '<br><br>' : '') +
    (char.backstory ? '<strong>Backstory:</strong> ' + char.backstory + '<br><br>' : '') +
    (char.personality ? '<strong>Personality:</strong> ' + char.personality + '<br>' : '') +
    (char.ideal ? '<strong>Ideal:</strong> ' + char.ideal + '<br>' : '') +
    (char.bond ? '<strong>Bond:</strong> ' + char.bond + '<br>' : '') +
    (char.flaw ? '<strong>Flaw:</strong> ' + char.flaw : '') +
    '</div></div>' +
    '<div class="sheet-sub"><div class="sheet-sub-title">DM Notes</div><textarea class="sheet-notes-area" oninput="setSheetNotes(\'' + charId + '\', this.value)" placeholder="Combat notes, observations, anything…">' + (state.notes || '') + '</textarea></div>';
}

// ----- State mutators -----
function hpDelta(charId, amt) {
  const damageTaken = amt < 0 ? -amt : 0;
  withSheetState(charId, function(s) {
    const max = CHARACTERS[charId].hpMax;
    if (amt < 0 && s.hp.temp > 0) {
      const tempLoss = Math.min(s.hp.temp, -amt);
      s.hp.temp -= tempLoss; amt += tempLoss;
    }
    s.hp.current = Math.max(0, Math.min(max, s.hp.current + amt));
  });
  // Update 12 — Concentration check on damage (fires only if concentrating).
  if (damageTaken > 0) _checkConcentrationOnDamage(charId, damageTaken);
}
function hpPrompt(charId, kind) {
  const amt = parseInt(prompt(kind === 'dmg' ? 'Damage amount?' : 'Healing amount?'));
  if (!isNaN(amt) && amt > 0) hpDelta(charId, kind === 'dmg' ? -amt : amt);
}
function setHpCurrent(charId, val) {
  const n = parseInt(val);
  if (isNaN(n)) return;
  const state = getSheetState(charId);
  const prevHp = state.hp.current;
  withSheetState(charId, function(s) { s.hp.current = Math.max(0, Math.min(CHARACTERS[charId].hpMax, n)); });
  const damageTaken = Math.max(0, prevHp - n);
  if (damageTaken > 0) _checkConcentrationOnDamage(charId, damageTaken);
}
function setHpTemp(charId, val) { const n = parseInt(val); if (!isNaN(n)) withSheetState(charId, function(s) { s.hp.temp = Math.max(0, n); }); }
function toggleDeathSave(charId, kind, n) { withSheetState(charId, function(s) { if (s.deathSaves[kind] >= n) s.deathSaves[kind] = n - 1; else s.deathSaves[kind] = n; }); }
function toggleSlot(charId, lvl, n) { withSheetState(charId, function(s) { if ((s.slots[lvl] || 0) >= n) s.slots[lvl] = n - 1; else s.slots[lvl] = n; }); }
// Cast a spell by state.spells id, optionally at an upcast level.
// - Cantrips: no slot expended; just show a toast.
// - Non-cantrips: expend a slot at castLvl (defaults to spell's base level).
//   If no slot available at that level, alert and do nothing.
function castSpell(charId, spellId, upcastLevel) {
  const char = CHARACTERS[charId];
  const state = getSheetState(charId);
  const sp = (state.spells || []).find(function(x) { return x.id === spellId; });
  if (!sp) return;
  if (sp.level === 0) {
    // Update 12 — cantrips can still be concentration (Guidance, True Strike, etc.)
    if (sp.concentration) {
      _setConcentration(charId, sp, 0);
    }
    showRollToast('Cantrip', sp.name, '✦');
    return;
  }
  const castLvl = upcastLevel ? parseInt(upcastLevel, 10) : sp.level;
  if (castLvl < sp.level) { alert('Cannot cast below the spell\'s base level.'); return; }
  const slots = (char.spellcasting && char.spellcasting.slots) || [];
  const max = slots[castLvl - 1] || 0;
  const expended = state.slots[castLvl] || 0;
  if (max <= 0) { alert('No L' + castLvl + ' slots exist for this character.'); return; }
  if (expended >= max) { alert('No L' + castLvl + ' slots remaining.'); return; }
  withSheetState(charId, function(s) { s.slots[castLvl] = (s.slots[castLvl] || 0) + 1; });
  // Update 12 — if this is a concentration spell, take it (dropping any prior).
  if (sp.concentration) {
    _setConcentration(charId, sp, castLvl);
  }
  const label = (castLvl > sp.level) ? ('Upcast L' + castLvl) : ('Cast L' + castLvl);
  showRollToast(label, sp.name, '✦');
}

// Update 13 — Ritual cast (no slot expended, +10 min casting time)
function ritualCast(charId, spellId) {
  const state = getSheetState(charId);
  const sp = (state.spells || []).find(function(x) { return x.id === spellId; });
  if (!sp) return;
  if (!sp.ritual) { alert('This spell does not have the Ritual tag.'); return; }
  if (sp.level === 0) { alert('Cantrips cannot be ritual cast.'); return; }
  // Ritual cast doesn't expend a slot. If concentration, still takes it.
  if (sp.concentration) _setConcentration(charId, sp, sp.level);
  showRollToast('Ritual cast', sp.name + ' (no slot, +10 min)', '📜');
}

// Update 12 — Concentration tracker
function _setConcentration(charId, spell, castLvl) {
  const state = getSheetState(charId);
  const prev = state.concentration;
  if (prev && prev.spellId !== spell.id) {
    showRollToast('Concentration dropped', prev.spellName + ' → ' + spell.name, '🌀');
  }
  withSheetState(charId, function(s) {
    s.concentration = { spellId: spell.id, spellName: spell.name, castLvl: castLvl, at: Date.now() };
  });
}
function breakConcentration(charId) {
  const state = getSheetState(charId);
  if (!state.concentration) return;
  if (!confirm('Break concentration on ' + state.concentration.spellName + '?')) return;
  withSheetState(charId, function(s) { s.concentration = null; });
  showRollToast('Concentration', 'Broken manually', '🌀');
}
// Prompt a Con save when concentrating and damage is taken.
// DC = max(10, floor(damage / 2)) per 2024 rule.
function _checkConcentrationOnDamage(charId, damageAmount) {
  const state = getSheetState(charId);
  if (!state.concentration || damageAmount <= 0) return;
  const dc = Math.max(10, Math.floor(damageAmount / 2));
  const spellName = state.concentration.spellName;
  // Non-blocking prompt: use setTimeout to let the HP change render first.
  setTimeout(function() {
    const rollResult = prompt(
      '🌀 CONCENTRATION CHECK\n\n' +
      'Concentrating on: ' + spellName + '\n' +
      'Damage taken: ' + damageAmount + '\n' +
      'DC: ' + dc + ' (higher of 10 or half damage)\n\n' +
      'Roll a Constitution save. Enter your total (leave blank to skip):'
    );
    if (rollResult === null || rollResult.trim() === '') return;
    const total = parseInt(rollResult, 10);
    if (isNaN(total)) return;
    if (total >= dc) {
      showRollToast('Con save: PASS', spellName + ' held (' + total + ' vs DC ' + dc + ')', '✓');
    } else {
      withSheetState(charId, function(s) { s.concentration = null; });
      showRollToast('Con save: FAIL', spellName + ' dropped (' + total + ' vs DC ' + dc + ')', '✗');
    }
  }, 150);
}
function toggleResource(charId, rid, n) { withSheetState(charId, function(s) { if ((s.resources[rid] || 0) >= n) s.resources[rid] = n - 1; else s.resources[rid] = n; }); }
function bumpResource(charId, rid, delta) {
  withSheetState(charId, function(s) {
    const char = CHARACTERS[charId];
    const res = (char.resources || []).find(function(r) { return r.id === rid; });
    const max = res && typeof res.max === 'number' ? res.max : 999;
    const cur = s.resources[rid] || 0;
    s.resources[rid] = Math.max(0, Math.min(max, cur + delta));
  });
}
function setResourceValue(charId, rid, raw) {
  const n = parseInt(raw, 10);
  if (isNaN(n)) return;
  withSheetState(charId, function(s) {
    const char = CHARACTERS[charId];
    const res = (char.resources || []).find(function(r) { return r.id === rid; });
    const max = res && typeof res.max === 'number' ? res.max : 999;
    s.resources[rid] = Math.max(0, Math.min(max, n));
  });
}
function toggleCondition(charId, c) { withSheetState(charId, function(s) { if (s.conditions[c]) delete s.conditions[c]; else s.conditions[c] = true; }); }
function setExhaustion(charId, n) { withSheetState(charId, function(s) { if (s.exhaustion === n) s.exhaustion = n - 1; else s.exhaustion = n; }); }
function toggleInspiration(charId) { withSheetState(charId, function(s) { s.inspiration = !s.inspiration; }); }
function setSheetNotes(charId, val) { const state = getSheetState(charId); state.notes = val; saveSheetState(charId, state); }
function toggleSpellDetail(spellId) { const el = document.getElementById('spell-detail-' + spellId); if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none'; }
function toggleUpcast(spellId) { const el = document.getElementById('spell-upcast-' + spellId); if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none'; }
function toggleSpellPrepared(charId, spellId) {
  withSheetState(charId, function(s) {
    const sp = (s.spells || []).find(function(x) { return x.id === spellId; });
    if (sp) sp.prepared = !sp.prepared;
  });
}
function removeSpell(charId, spellId) {
  withSheetState(charId, function(s) {
    if (!s.spells) return;
    const idx = s.spells.findIndex(function(x) { return x.id === spellId; });
    if (idx < 0) return;
    if (!confirm('Remove "' + (s.spells[idx].name || 'spell') + '" from your spells?')) return;
    s.spells.splice(idx, 1);
  });
}
function addSpellFromCatalog(charId, spellId) {
  if (typeof SPELLS_BY_ID === 'undefined' || !SPELLS_BY_ID[spellId]) return;
  const src = SPELLS_BY_ID[spellId];
  withSheetState(charId, function(s) {
    if (!s.spells) s.spells = [];
    // Skip if already present (by sourceSpellId)
    if (s.spells.some(function(x) { return x.sourceSpellId === spellId; })) {
      showRollToast('Already in spellbook', src.name, '↻');
      return;
    }
    s.spells.push({
      id: 'spell_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      sourceSpellId: spellId,
      name: src.name,
      level: src.level,
      school: src.school || '',
      castingTime: src.castingTime || 'Action',
      range: src.range || '—',
      components: src.components || '',
      duration: src.duration || '',
      concentration: !!src.concentration,
      ritual: !!src.ritual,
      description: src.description || '',
      atHigherLevels: src.atHigherLevels || null,
      prepared: src.level === 0, // cantrips auto-prepared; higher levels default to unprepared
      custom: false
    });
  });
  closeSpellPicker();
}
function addCustomSpellPrompt(charId) {
  const name = prompt('Spell name:');
  if (!name || !name.trim()) return;
  const lvlRaw = prompt('Spell level (0 = cantrip, 1-9):', '1');
  if (lvlRaw === null) return;
  const level = Math.max(0, Math.min(9, parseInt(lvlRaw, 10) || 0));
  const school = prompt('School (e.g. evocation, illusion, necromancy):', '') || '';
  const description = prompt('Description:', '') || '';
  withSheetState(charId, function(s) {
    if (!s.spells) s.spells = [];
    s.spells.push({
      id: 'custom_spell_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      sourceSpellId: null,
      name: name.trim(),
      level: level,
      school: school.toLowerCase().trim(),
      castingTime: 'Action',
      range: '',
      components: '',
      duration: '',
      concentration: false,
      ritual: false,
      description: description.trim(),
      atHigherLevels: null,
      prepared: level === 0,
      custom: true
    });
  });
}

// ---- Spell picker modal (parallels the item picker) ----
let _spellPickerCharId = null;
let _spellPickerFilter = '';
let _spellPickerLevel = 'all';    // 'all' or 0..9
let _spellPickerClass = 'all';    // 'all' or class name (auto-defaulted to char's class)

function openSpellPicker(charId) {
  if (typeof SPELLS_2024 === 'undefined') {
    alert('Spell catalog not loaded — falling back to custom entry.');
    addCustomSpellPrompt(charId);
    return;
  }
  _spellPickerCharId = charId;
  _spellPickerFilter = '';
  _spellPickerLevel = 'all';
  const char = CHARACTERS[charId];
  _spellPickerClass = char && char.className ? char.className.toLowerCase() : 'all';
  let modal = document.getElementById('sheet-spell-picker');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'sheet-spell-picker';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(5,3,2,0.85);z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:1rem;font-family:\'Crimson Pro\',Georgia,serif';
    modal.addEventListener('click', function(e) { if (e.target === modal) closeSpellPicker(); });
  }
  const dialog = document.getElementById('sheet-dialog');
  const desiredParent = (dialog && dialog.open) ? dialog : document.body;
  if (modal.parentNode !== desiredParent) desiredParent.appendChild(modal);
  modal.style.display = 'flex';
  renderSpellPicker();
}
function closeSpellPicker() {
  const modal = document.getElementById('sheet-spell-picker');
  if (modal) modal.style.display = 'none';
  _spellPickerCharId = null;
}
function setSpellPickerFilter(text) { _spellPickerFilter = text; renderSpellPicker(); }
function setSpellPickerLevel(lvl)   { _spellPickerLevel = (lvl === 'all') ? 'all' : parseInt(lvl, 10); renderSpellPicker(); }
function setSpellPickerClass(cls)   { _spellPickerClass = cls; renderSpellPicker(); }

function renderSpellPicker() {
  const modal = document.getElementById('sheet-spell-picker');
  if (!modal || typeof SPELLS_2024 === 'undefined') return;
  const filter = (_spellPickerFilter || '').toLowerCase();
  const filtered = SPELLS_2024.filter(function(sp) {
    if (_spellPickerLevel !== 'all' && sp.level !== _spellPickerLevel) return false;
    if (_spellPickerClass !== 'all' && (sp.classes || []).indexOf(_spellPickerClass) === -1) return false;
    if (!filter) return true;
    return sp.name.toLowerCase().indexOf(filter) !== -1 ||
           (sp.school || '').toLowerCase().indexOf(filter) !== -1;
  }).sort(function(a, b) {
    if (a.level !== b.level) return a.level - b.level;
    return (a.name || '').localeCompare(b.name || '');
  });

  const levelBtns = ['all', 0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(function(l) {
    const active = _spellPickerLevel === l;
    const label = (l === 'all') ? 'All' : (l === 0 ? 'Cant' : String(l));
    const bg = active ? 'var(--gold)' : 'rgba(160,128,64,0.15)';
    const fg = active ? '#0d0a06' : 'var(--gold2)';
    return '<button onclick="setSpellPickerLevel(\'' + l + '\')" style="background:' + bg + ';color:' + fg + ';border:1px solid var(--gold2);border-radius:2px;padding:.2rem .5rem;font-family:\'Cinzel\',serif;font-size:9px;letter-spacing:.5px;cursor:pointer">' + label + '</button>';
  }).join(' ');
  const classBtns = ['all', 'wizard', 'cleric', 'sorcerer', 'bard', 'druid', 'warlock', 'paladin', 'ranger', 'artificer'].map(function(c) {
    const active = _spellPickerClass === c;
    const bg = active ? 'var(--gold)' : 'rgba(160,128,64,0.15)';
    const fg = active ? '#0d0a06' : 'var(--gold2)';
    const label = (c === 'all') ? 'All' : (c[0].toUpperCase() + c.slice(1, 4));
    return '<button onclick="setSpellPickerClass(\'' + c + '\')" style="background:' + bg + ';color:' + fg + ';border:1px solid var(--gold2);border-radius:2px;padding:.2rem .5rem;font-family:\'Cinzel\',serif;font-size:9px;letter-spacing:.5px;cursor:pointer">' + label + '</button>';
  }).join(' ');

  const rows = filtered.slice(0, 200).map(function(sp) {
    const tagSpans = (sp.concentration ? '<span style="background:rgba(160,32,32,0.6);color:#fff;padding:1px 5px;border-radius:2px;font-size:8px;margin-left:.3rem">C</span>' : '') +
                     (sp.ritual ? '<span style="background:rgba(120,60,160,0.6);color:#fff;padding:1px 5px;border-radius:2px;font-size:8px;margin-left:.3rem">R</span>' : '');
    return '<div style="padding:.5rem;border-bottom:1px solid rgba(160,128,64,0.15);cursor:pointer" onclick="addSpellFromCatalog(\'' + _spellPickerCharId + '\',\'' + sp.id + '\')" onmouseover="this.style.background=\'rgba(160,128,64,0.1)\'" onmouseout="this.style.background=\'transparent\'">' +
      '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:.5rem;margin-bottom:.15rem">' +
      '<strong style="font-family:\'Cinzel\',serif;color:var(--gold3);font-size:13px">' + _sheetEscapeAttr(sp.name) + tagSpans + '</strong>' +
      '<span style="font-size:10px;color:var(--parch4);white-space:nowrap">' + (sp.level === 0 ? 'Cantrip' : 'Level ' + sp.level) + ' · ' + _sheetEscapeAttr(sp.school || '') + '</span>' +
      '</div>' +
      '<div style="font-size:10.5px;color:var(--parch3);margin-bottom:.2rem"><em>' + _sheetEscapeAttr(sp.castingTime || '') + ' · Range ' + _sheetEscapeAttr(sp.range || '—') + ' · ' + _sheetEscapeAttr(sp.duration || '') + '</em></div>' +
      '<div style="font-size:11px;color:var(--parch2);line-height:1.4">' + _sheetEscapeAttr(sp.description || '') + '</div>' +
      (sp.atHigherLevels ? '<div style="font-size:10px;color:var(--gold3);margin-top:.25rem;font-style:italic"><strong>Higher levels:</strong> ' + _sheetEscapeAttr(sp.atHigherLevels) + '</div>' : '') +
      '</div>';
  }).join('');
  const body = rows || '<div style="padding:2rem;text-align:center;color:var(--parch4);font-style:italic">No spells match. Use "Add Custom" for anything not in the catalog.</div>';

  modal.innerHTML =
    '<div style="background:#1a1208;border:1px solid var(--gold2);border-radius:4px;width:100%;max-width:680px;max-height:90vh;display:flex;flex-direction:column;color:var(--parch)">' +
      '<div style="padding:.75rem 1rem;border-bottom:1px solid rgba(160,128,64,0.3);display:flex;justify-content:space-between;align-items:center;background:rgba(20,15,8,0.9)">' +
        '<div style="font-family:\'Cinzel Decorative\',serif;color:var(--gold3);font-size:15px;letter-spacing:1.5px">Add Spell</div>' +
        '<button onclick="closeSpellPicker()" style="background:transparent;border:1px solid var(--gold2);color:var(--gold2);border-radius:2px;padding:.2rem .6rem;cursor:pointer;font-family:\'Cinzel\',serif;font-size:11px">✕ Close</button>' +
      '</div>' +
      '<div style="padding:.6rem 1rem;background:rgba(20,15,8,0.7);border-bottom:1px solid rgba(160,128,64,0.15)">' +
        '<input type="text" id="sheet-spell-picker-search" value="' + _sheetEscapeAttr(_spellPickerFilter) + '" placeholder="Search spells…" oninput="setSpellPickerFilter(this.value)" style="width:100%;background:rgba(10,8,5,0.8);border:1px solid rgba(160,128,64,0.4);color:var(--parch);padding:.4rem .6rem;border-radius:2px;font-size:13px;margin-bottom:.4rem;font-family:inherit">' +
        '<div style="display:flex;flex-wrap:wrap;gap:.2rem;margin-bottom:.3rem"><span style="font-size:10px;color:var(--parch4);align-self:center;margin-right:.2rem">Level:</span>' + levelBtns + '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:.2rem"><span style="font-size:10px;color:var(--parch4);align-self:center;margin-right:.2rem">Class:</span>' + classBtns + '</div>' +
      '</div>' +
      '<div style="flex:1;overflow-y:auto">' + body + '</div>' +
      '<div style="padding:.6rem 1rem;border-top:1px solid rgba(160,128,64,0.3);background:rgba(20,15,8,0.9);display:flex;justify-content:space-between;align-items:center">' +
        '<span style="font-size:10px;color:var(--parch4)">' + filtered.length + ' spells' + (filtered.length > 200 ? ' (showing 200)' : '') + '</span>' +
        '<button onclick="closeSpellPicker();addCustomSpellPrompt(\'' + _spellPickerCharId + '\')" style="background:rgba(160,128,64,0.15);color:var(--gold2);border:1px solid var(--gold2);border-radius:2px;padding:.35rem .8rem;font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:1px;cursor:pointer">+ Add Custom Spell</button>' +
      '</div>' +
    '</div>';
  const s = document.getElementById('sheet-spell-picker-search');
  if (s) { s.focus(); const l = s.value.length; s.setSelectionRange(l, l); }
}
function shortRest(charId) {
  if (!confirm('Take a short rest?\n\nThis restores short-rest resources (Warlock slots, Fighter Second Wind, etc.). It does NOT restore HP or spell slots.')) return;
  withSheetState(charId, function(s) {
    (CHARACTERS[charId].resources || []).forEach(function(r) { if (r.recharge === 'short') s.resources[r.id] = r.max; });
  });
  showRollToast('Short Rest', 'Short-rest resources restored', '✦');
}
function longRest(charId) {
  const char = CHARACTERS[charId];
  if (!confirm('Take a long rest?\n\nThis restores HP, spell slots, per-rest resources, half your Hit Dice, and removes one level of exhaustion.')) return;
  withSheetState(charId, function(s) {
    s.hp.current = char.hpMax;
    s.hp.temp = 0;
    s.deathSaves = { successes: 0, failures: 0 };
    Object.keys(s.slots).forEach(function(k) { s.slots[k] = 0; });
    // Reset short- and long-rest resources only. `recharge: 'never'` resources
    // (e.g. Soul Siphon — a permanent tally) must not be touched.
    (char.resources || []).forEach(function(r) {
      if (r.recharge === 'short' || r.recharge === 'long') {
        s.resources[r.id] = r.max;
      }
    });
    const hdRecovered = Math.max(1, Math.floor(char.hitDice.max / 2));
    s.hitDiceSpent = Math.max(0, s.hitDiceSpent - hdRecovered);
    if (s.exhaustion > 0) s.exhaustion -= 1;
    // Update 12 — concentration always ends on a long rest (unconscious for hours).
    s.concentration = null;
  });
  showRollToast('Long Rest', 'HP, slots, resources restored', '✦');
  // If this character has a prep-modal flow, ask if they want to change prepared spells.
  if (hasPrepModal(char)) {
    setTimeout(function() {
      if (confirm('Long rest complete.\n\nWould you like to change your prepared spells?')) {
        openPrepModal(charId);
      }
    }, 120);
  }
}
function rollHitDie(charId) {
  const char = CHARACTERS[charId];
  const state = getSheetState(charId);
  if (state.hitDiceSpent >= char.hitDice.max) return;
  const sides = parseInt(char.hitDice.die.slice(1));
  const conMod = sheetAbilityMod(char.abilities.con);
  const roll = 1 + Math.floor(Math.random() * sides);
  const total = Math.max(1, roll + conMod);
  state.hitDiceSpent += 1;
  state.hp.current = Math.min(char.hpMax, state.hp.current + total);
  saveSheetState(charId, state);
  refreshSheet(charId);
  showRollToast('Hit Die spent', char.hitDice.die + ' (' + roll + ') + CON (' + conMod + ')', '+' + total + ' HP');
}

// ----- Roll handlers -----
// Update 16 — Exhaustion penalty helper. 2024 rule: -2 to d20 tests and
// save DCs per level of exhaustion (cumulative). Returns { penalty, label }.
function exhPen(charId) {
  const exh = (getSheetState(charId).exhaustion || 0);
  const penalty = exh * 2;
  return { penalty: penalty, label: penalty ? ' − ' + penalty + ' (exh ' + exh + ')' : '' };
}

function rollAbility(charId, abil) {
  const char = CHARACTERS[charId];
  const mod = sheetAbilityMod(char.abilities[abil]);
  const e = exhPen(charId);
  const roll = sheetRollD20();
  const total = roll + mod - e.penalty;
  const label = { str:'Strength', dex:'Dexterity', con:'Constitution', int:'Intelligence', wis:'Wisdom', cha:'Charisma' }[abil] + ' Check';
  showRollToast(label, 'd20 (' + roll + ') ' + sheetFmtMod(mod) + e.label, total, { crit: roll === 20, fumble: roll === 1 });
}
function rollSave(charId, abil) {
  const char = CHARACTERS[charId];
  const mod = sheetGetSaveMod(char, abil);
  const e = exhPen(charId);
  const roll = sheetRollD20();
  const total = roll + mod - e.penalty;
  showRollToast(abil.toUpperCase() + ' Saving Throw', 'd20 (' + roll + ') ' + sheetFmtMod(mod) + e.label, total, { crit: roll === 20, fumble: roll === 1 });
}
function rollSkill(charId, sk) {
  const char = CHARACTERS[charId];
  const mod = sheetGetSkillMod(char, sk);
  const e = exhPen(charId);
  const roll = sheetRollD20();
  const total = roll + mod - e.penalty;
  showRollToast(SHEET_SKILL_LABELS[sk] + ' Check', 'd20 (' + roll + ') ' + sheetFmtMod(mod) + e.label, total, { crit: roll === 20, fumble: roll === 1 });
}
function rollInitiative(charId) {
  const char = CHARACTERS[charId];
  const e = exhPen(charId);
  const roll = sheetRollD20();
  const total = roll + char.initiative - e.penalty;
  showRollToast('Initiative', 'd20 (' + roll + ') ' + sheetFmtMod(char.initiative) + e.label, total, { crit: roll === 20, fumble: roll === 1 });
}
// Roll an equipped inventory weapon by its item id.
// Computes attack bonus from char abilities + proficiency + weapon properties
// (Finesse → best of STR/DEX; Ranged → DEX; default STR).
function rollInventoryWeapon(charId, itemId) {
  const char = CHARACTERS[charId];
  const state = getSheetState(charId);
  const item = (state.equipment || []).find(function(x) { return x.id === itemId; });
  if (!item) return;
  const catItem = (!item.custom && typeof ITEMS_BY_ID !== 'undefined') ? ITEMS_BY_ID[item.sourceItemId] : null;
  const name = item.name || 'Weapon';
  const damage = (catItem && catItem.damage) ? catItem.damage : (item.notes || '');
  const properties = (catItem && catItem.properties) || [];
  const isFinesse = properties.some(function(p) { return /finesse/i.test(p); });
  const isRanged  = properties.some(function(p) { return /ranged|thrown|ammunition/i.test(p); });
  const abils = char.abilities || {};
  const strMod = Math.floor((abils.str - 10) / 2);
  const dexMod = Math.floor((abils.dex - 10) / 2);
  const abilityMod = isRanged ? dexMod : (isFinesse ? Math.max(strMod, dexMod) : strMod);
  const profBonus = char.proficiencyBonus || 2;
  const atkBonus = profBonus + abilityMod;
  const e = exhPen(charId);
  const atkRoll = sheetRollD20();
  const atkTotal = atkRoll + atkBonus - e.penalty;
  const dmgMatch = damage.match(/^(\d+)d(\d+)(.*)$/);
  let dmgStr = damage || '—';
  if (dmgMatch) {
    const count = parseInt(dmgMatch[1], 10);
    const sides = parseInt(dmgMatch[2], 10);
    const rest = (dmgMatch[3] || '').trim();
    const isCrit = atkRoll === 20;
    const dmg = sheetRollDice(isCrit ? count * 2 : count, sides) + abilityMod;
    dmgStr = dmg + ' ' + rest + (isCrit ? ' (crit doubled)' : '') + ' [+' + abilityMod + ' mod]';
  }
  showRollToast(name + ' Attack', 'Atk d20 (' + atkRoll + ') ' + sheetFmtMod(atkBonus) + e.label + ' = ' + atkTotal + ' · Dmg: ' + dmgStr, atkTotal + ' hit / ' + dmgStr, { crit: atkRoll === 20, fumble: atkRoll === 1 });
}

// Compute attack bonus for display in the Attack table row.
function computeInventoryAtkBonus(char, item) {
  const catItem = (!item.custom && typeof ITEMS_BY_ID !== 'undefined') ? ITEMS_BY_ID[item.sourceItemId] : null;
  const properties = (catItem && catItem.properties) || [];
  const isFinesse = properties.some(function(p) { return /finesse/i.test(p); });
  const isRanged  = properties.some(function(p) { return /ranged|thrown|ammunition/i.test(p); });
  const abils = char.abilities || {};
  const strMod = Math.floor((abils.str - 10) / 2);
  const dexMod = Math.floor((abils.dex - 10) / 2);
  const abilityMod = isRanged ? dexMod : (isFinesse ? Math.max(strMod, dexMod) : strMod);
  const profBonus = char.proficiencyBonus || 2;
  return profBonus + abilityMod;
}

function rollWeapon(charId, idx) {
  const char = CHARACTERS[charId];
  const w = char.weapons[idx];
  const e = exhPen(charId);
  const atkRoll = sheetRollD20();
  const atkTotal = atkRoll + w.atk - e.penalty;
  const dmgMatch = w.damage.match(/^(\d+)d(\d+)(?:\s*\+\s*(\d+))?(.*)$/);
  let dmgStr = w.damage;
  if (dmgMatch) {
    const count = parseInt(dmgMatch[1]);
    const sides = parseInt(dmgMatch[2]);
    const bonus = dmgMatch[3] ? parseInt(dmgMatch[3]) : 0;
    const rest = (dmgMatch[4] || '').trim();
    const isCrit = atkRoll === 20;
    const dmg = sheetRollDice(isCrit ? count * 2 : count, sides) + bonus;
    dmgStr = dmg + ' ' + rest + (isCrit ? ' (crit doubled)' : '');
  }
  showRollToast(w.name + ' Attack', 'Atk d20 (' + atkRoll + ') ' + sheetFmtMod(w.atk) + e.label + ' = ' + atkTotal + ' · Dmg: ' + dmgStr, atkTotal + ' hit / ' + dmgStr, { crit: atkRoll === 20, fumble: atkRoll === 1 });
}
