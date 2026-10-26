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
  // Heal corrupted equipment: earlier broken migration stored each
  // char.equipment object literally in the .name field, so state has
  // entries like { name: { name: 'Chain Shirt', wt: 20, ... }, ... }.
  // The UI stringifies these as "[object Object]". Detect any entry
  // whose name isn't a proper string (or IS the literal fallback
  // "[object Object]") and re-seed from char.equipment.
  if (state.equipment && state.equipment.some(function(it) {
    return it && (typeof it.name !== 'string' || it.name === '[object Object]' || it.name === '' || it.name === undefined);
  })) {
    state.equipment = null;
  }
  if (!state.equipment) {
    state.equipment = (char.equipment || []).map(function(item, i) {
      // Accepts either a plain string (legacy Sylas seeding) OR a structured
      // object (new Orin / Torren shape with name/qty/wt/desc/equipped/etc).
      if (typeof item === 'string') {
        return { id: 'seed_' + i, name: item, quantity: 1, notes: '', custom: true, sourceItemId: null };
      }
      return {
        id: 'seed_' + i,
        name: item.name || '(unnamed)',
        quantity: item.qty || item.quantity || 1,
        notes: item.desc || item.notes || '',
        weight: item.wt,
        cost: item.cost,
        slot: item.slot,
        equipped: !!item.equipped,
        attuned: !!item.attuned,
        // Builder-made characters link starting gear to items-2024.js so
        // weapons show damage and armor/shield behave as catalog items.
        custom: !item.sourceItemId,
        sourceItemId: item.sourceItemId || null
      };
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
  // Sylas Animate Dead seed — start with the 2 zombies he had at the
  // current campaign moment. Uses a dedicated `minionsInitialized` flag
  // rather than checking the array (Firebase drops empty arrays as
  // null, which would otherwise re-seed on every reload after End All).
  if (id === 'sylas' && !state.minionsInitialized) {
    if (!state.minions) {
      const z = (typeof MONSTERS_BY_ID !== 'undefined' && MONSTERS_BY_ID['zombie']) ? MONSTERS_BY_ID['zombie'] : null;
      state.minions = [
        { id: 'zombie_1_' + Date.now(),     kind: 'zombie', name: 'Zombie #1', hp: (z && z.hp) || 22, hpMax: (z && z.hp) || 22, notes: '' },
        { id: 'zombie_2_' + (Date.now()+1), kind: 'zombie', name: 'Zombie #2', hp: (z && z.hp) || 22, hpMax: (z && z.hp) || 22, notes: '' }
      ];
      state.lastReassert = null;
    }
    // Whether we seeded or the user already had minions from an earlier
    // session, mark initialised so we never re-seed.
    state.minionsInitialized = true;
  }
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
    // Additional seed: if char.spellcasting.prepared is present (name-only
    // list by level, e.g. Orin's format), turn each entry into a state spell.
    // Look up mechanical fields from the SPELLS_2024 catalog by name — we
    // never fabricate spell rules text; if the catalog doesn't know the
    // spell, the entry appears with just the name and level, and Bradley
    // can fill in details in edit mode.
    if (char.spellcasting && char.spellcasting.prepared) {
      const prep = char.spellcasting.prepared;
      const byNameLower = {};
      if (typeof SPELLS_2024 !== 'undefined') {
        SPELLS_2024.forEach(function(s) { byNameLower[(s.name || '').toLowerCase()] = s; });
      }
      const existingNames = {};
      state.spells.forEach(function(s) { existingNames[(s.name || '').toLowerCase()] = true; });
      const buckets = [
        { key: 'cantrips', level: 0 },
        { key: '1',        level: 1 },
        { key: '2',        level: 2 },
        { key: '3',        level: 3 },
        { key: '4',        level: 4 },
        { key: '5',        level: 5 },
        { key: '6',        level: 6 },
        { key: '7',        level: 7 },
        { key: '8',        level: 8 },
        { key: '9',        level: 9 }
      ];
      let seq = 0;
      buckets.forEach(function(b) {
        const list = prep[b.key];
        if (!Array.isArray(list)) return;
        list.forEach(function(name) {
          const key = String(name || '').toLowerCase();
          if (!name || existingNames[key]) return;
          const cat = byNameLower[key];
          existingNames[key] = true;
          state.spells.push({
            id: 'seed_prep_' + (seq++),
            sourceSpellId: cat ? cat.id : null,
            name: cat ? cat.name : name,
            level: cat ? cat.level : b.level,
            school: cat ? (cat.school || '') : '',
            castingTime: cat ? (cat.castingTime || 'Action') : 'Action',
            range: cat ? (cat.range || '—') : '—',
            components: cat ? (cat.components || '') : '',
            duration: cat ? (cat.duration || '') : '',
            concentration: cat ? !!cat.concentration : false,
            ritual: cat ? !!cat.ritual : false,
            description: cat ? (cat.description || '') : '',
            atHigherLevels: cat ? (cat.atHigherLevels || null) : null,
            prepared: true,
            alwaysPrepared: false,
            alwaysPreparedReason: '',
            custom: !cat
          });
        });
      });
    }
    // Tag always-prepared spells (domain, racial, feat, item-granted)
    // so they don't count against the prepared-spell cap. Reasons
    // surface in the prep-modal badge.
    if (char.spellcasting && Array.isArray(char.spellcasting.alwaysPrepared)) {
      const alwaysMap = {};
      char.spellcasting.alwaysPrepared.forEach(function(entry) {
        if (entry && entry.name) alwaysMap[entry.name.toLowerCase()] = entry.reason || 'Always prepared';
      });
      state.spells.forEach(function(sp) {
        const reason = alwaysMap[(sp.name || '').toLowerCase()];
        if (reason) {
          sp.alwaysPrepared = true;
          sp.alwaysPreparedReason = reason;
          sp.prepared = true;
        }
      });
    }
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
  // Circle of the Land (Update 61b): apply the build-time land the first time.
  // Re-applied after a level-up too, so new Circle spells (levels 5/7/9) appear.
  if (char && char.landCircle && (!state.circleLand || state.circleLevel !== char.level)) _applyCircleLand(char, state, state.circleLand || char.landCircle.land);
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
  // Builder-made characters carry the 2024 class-table count directly.
  if (char.spellcasting && typeof char.spellcasting.preparedMax === 'number') return char.spellcasting.preparedMax;
  const cls = (char.className || '').toLowerCase();
  const level = char.level || 1;
  const abil = char.abilities || {};
  const mod = function(score) { return Math.floor(((score || 10) - 10) / 2); };
  // 2024 PHB class tables (Update 71), index = level - 1.
  const PREPARED_2024 = {
    cleric:  [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22],
    druid:   [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22],
    wizard:  [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 18, 19, 21, 22, 23, 24, 25],
    paladin: [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15]
  };
  if (PREPARED_2024[cls]) return PREPARED_2024[cls][Math.min(20, Math.max(1, level)) - 1];
  if (cls === 'artificer') return Math.max(1, mod(abil.int) + Math.ceil(level / 2));
  return null; // ranger (fixed-swap), sorcerer/bard/warlock (no prep)
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
  // Update 59 — small −/+ buttons under each coin, and a Receive / Pay row
  // that makes change automatically from bigger coins when paying.
  const btn = 'background:rgba(160,128,64,0.12);border:1px solid rgba(160,128,64,0.45);color:var(--gold2);border-radius:2px;cursor:pointer;font-size:12px;line-height:1;padding:2px 0;width:100%';
  const steppers = denoms.map(function(d) {
    return '<div style="display:flex;gap:2px;margin-top:2px">' +
      '<button title="−1 ' + d.label + '" onclick="bumpCurrency(\'' + charId + '\',\'' + d.key + '\',-1)" style="' + btn + '">−</button>' +
      '<button title="+1 ' + d.label + '" onclick="bumpCurrency(\'' + charId + '\',\'' + d.key + '\',1)" style="' + btn + '">+</button></div>';
  }).join('');
  const fld = 'background:rgba(10,8,5,0.6);border:1px solid rgba(160,128,64,0.5);color:var(--parch);border-radius:2px;padding:.2rem .35rem;font-size:12px';
  const txRow = '<div style="display:flex;gap:.3rem;align-items:center;flex-wrap:wrap;margin-top:.45rem">' +
    '<input id="cur-amt-' + charId + '" type="number" min="1" step="1" placeholder="Amount" style="' + fld + ';width:5.5rem" onkeydown="if(event.key===\'Enter\')payCurrency(\'' + charId + '\',1)">' +
    '<select id="cur-den-' + charId + '" style="' + fld + '">' + denoms.map(function(d) { return '<option value="' + d.key + '"' + (d.key === 'gp' ? ' selected' : '') + '>' + d.label + '</option>'; }).join('') + '</select>' +
    '<button onclick="payCurrency(\'' + charId + '\',1)" style="' + btn + ';width:auto;padding:.25rem .6rem;color:#9fd09f;border-color:#6a9a5a">＋ Receive</button>' +
    '<button onclick="payCurrency(\'' + charId + '\',-1)" style="' + btn + ';width:auto;padding:.25rem .6rem;color:#e0a0a0;border-color:#a04040">− Pay</button>' +
    '</div>';
  return '<div class="sheet-sub"><div class="sheet-sub-title">Currency</div>' +
    '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:.4rem;margin-bottom:.35rem">' + cells + '</div>' +
    '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:.4rem">' + steppers + '</div>' +
    txRow +
    '<div style="font-size:10px;color:var(--parch4);text-align:right;font-family:\'Cinzel\',serif;letter-spacing:.5px;margin-top:.3rem">≈ ' + totalGp.toFixed(2) + ' gp total</div>' +
    '</div>';
}
const _COIN_CP = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 };
const _COIN_ORDER = ['cp', 'sp', 'ep', 'gp', 'pp'];
function bumpCurrency(charId, denom, delta) {
  withSheetState(charId, function(s) {
    if (!s.currency) s.currency = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
    s.currency[denom] = Math.max(0, (s.currency[denom] || 0) + delta);
  });
}
// sign = +1 receive, −1 pay. Paying more of a coin than you hold breaks
// bigger coins into change (e.g. pay 3 gp with 1 gp + 1 pp → 8 gp left).
function payCurrency(charId, sign) {
  const amtEl = document.getElementById('cur-amt-' + charId);
  const denEl = document.getElementById('cur-den-' + charId);
  const amount = Math.max(0, parseInt(amtEl && amtEl.value, 10) || 0);
  const denom = (denEl && denEl.value) || 'gp';
  if (!amount) { if (amtEl) amtEl.focus(); return; }
  const state = getSheetState(charId);
  const c = Object.assign({ cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }, state.currency || {});
  if (sign > 0) {
    c[denom] += amount;
  } else {
    const totalCp = _COIN_ORDER.reduce(function(sum, k) { return sum + (c[k] || 0) * _COIN_CP[k]; }, 0);
    if (totalCp < amount * _COIN_CP[denom]) { alert('Not enough money — that costs ' + amount + ' ' + denom.toUpperCase() + '.'); return; }
    c[denom] -= amount;
    // Break bigger coins until this denomination is no longer negative.
    let i = _COIN_ORDER.indexOf(denom) + 1;
    while (c[denom] < 0 && i < _COIN_ORDER.length) {
      const big = _COIN_ORDER[i];
      if (c[big] > 0) { c[big] -= 1; c[denom] += _COIN_CP[big] / _COIN_CP[denom]; }
      else i++;
    }
    // Still short (only smaller coins left): pay the rest from smaller coins.
    if (c[denom] < 0) {
      let owedCp = -c[denom] * _COIN_CP[denom];
      c[denom] = 0;
      for (let j = _COIN_ORDER.indexOf(denom) - 1; j >= 0 && owedCp > 0; j--) {
        const small = _COIN_ORDER[j];
        const take = Math.min(c[small], Math.ceil(owedCp / _COIN_CP[small]));
        c[small] -= take; owedCp -= take * _COIN_CP[small];
      }
      if (owedCp < 0) { // overpaid with small coins → give change back in cp
        c.cp += -owedCp;
      }
    }
  }
  withSheetState(charId, function(s) { s.currency = c; });
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
      // Update: pull effect summary from catalog if present (first ~110 chars of description).
      let effect = '';
      if (!item.custom && typeof ITEMS_BY_ID !== 'undefined') {
        const catItem = ITEMS_BY_ID[item.sourceItemId];
        if (catItem && catItem.description) {
          const raw = String(catItem.description);
          if (raw.length > 110) {
            const cut = raw.slice(0, 110);
            const lastSpace = cut.lastIndexOf(' ');
            effect = (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + '…';
          } else {
            effect = raw;
          }
        }
      }
      rows += '<div style="padding:.4rem .5rem;border-bottom:1px dashed rgba(160,128,64,0.15)">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem">' +
          '<div style="flex:1;font-size:12.5px;color:var(--parch2)">◉ ' + _sheetEscapeAttr(item.name || 'Item') + '</div>' +
          '<div>' + badge + '</div>' +
        '</div>' +
        (effect ? '<div style="font-size:11px;color:var(--parch3);font-style:italic;margin-top:.2rem;line-height:1.4">' + _sheetEscapeAttr(effect) + '</div>' : '') +
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
  // Slot hint (new structured seed format used by Orin/Torren)
  const slot = String(item.slot || '').toLowerCase();
  if (slot === 'weapon' || slot === 'armor' || slot === 'shield') return 'equip';
  if (slot === 'consumable') return 'use';
  return null;
}

// Legacy alias kept for backwards compat with the render row.
function isItemEquippable(item) { return itemActionType(item) === 'equip'; }

// Extract weapon combat info for an equipped inventory item (name, damage, notes).
// Returns null if we can't get useful attack data.
function inventoryItemToAttack(item) {
  if (!item) return null;
  // Slot-based filter for custom seeded items (Orin/Torren format) —
  // armor and shields are equipped but they aren't attacks. Only weapons
  // (or magic that acts as an attack) belong in the Attacks table.
  const slot = String(item.slot || '').toLowerCase();
  if (slot === 'armor' || slot === 'shield') return null;
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
  } else if (item.custom && slot !== 'weapon') {
    // Custom items with no weapon-slot hint aren't attacks either.
    return null;
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
  if (!char) {
    // Builder-made PCs load from Firebase (party-roster.js). Try once, then retry.
    if (window.PartyRoster && PartyRoster.isBuilt(charId) && !openCharacterSheet._retried) {
      openCharacterSheet._retried = true;
      PartyRoster._loading = null;
      PartyRoster.loadBuiltCharacters().then(function() {
        if (CHARACTERS[charId]) openCharacterSheet(charId);
        else alert(PartyRoster.label(charId) + ' has not been built yet. The player builds them from the player site.');
        openCharacterSheet._retried = false;
      });
      return;
    }
    alert('Character sheet not found: ' + charId); return;
  }
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
// ---------- Sheet readability preferences (per charId, localStorage) ----------
function _sheetPrefKey(charId, k) { return 'eldoria-sheet-pref-' + charId + '-' + k; }
function _sheetGetPref(charId, k, dflt) {
  try { const v = localStorage.getItem(_sheetPrefKey(charId, k)); return v == null ? dflt : v; }
  catch (e) { return dflt; }
}
function _sheetSetPref(charId, k, v) {
  try { localStorage.setItem(_sheetPrefKey(charId, k), String(v)); } catch (e) {}
}
// Custom theme presets — bg / fg / accent. Users can pick any hex too.
const _SHEET_PRESETS = [
  { name: 'Dark Parchment',  bg: '#100a05', fg: '#f2e8d0', accent: '#c9a84c' },
  { name: 'Paper',           bg: '#f4ead4', fg: '#2a1a08', accent: '#8a6a10' },
  { name: 'Sepia',           bg: '#2b1f10', fg: '#e8d0a8', accent: '#d4a05a' },
  { name: 'Blue Ink',        bg: '#f0f4ff', fg: '#0d1a3a', accent: '#3050a0' },
  { name: 'Forest',          bg: '#0f1a10', fg: '#d0e0c8', accent: '#7fbf6a' },
  { name: 'High Contrast',   bg: '#000000', fg: '#ffffff', accent: '#ffd700' },
  { name: 'Night Owl',       bg: '#1a1a2e', fg: '#e0e8f0', accent: '#a080e0' },
  { name: 'Rose',            bg: '#fff0f2', fg: '#3a1020', accent: '#c04070' }
];

function _renderSheetOptionsBar(charId, ts, th) {
  const state = getSheetState(charId);
  const editOn = !!state.editLayout;
  const tsBtn = function(val, label) {
    const active = (val === ts) ? ' active' : '';
    return '<button class="opt-btn' + active + '" onclick="setSheetTextSize(\'' + charId + '\',\'' + val + '\')">' + label + '</button>';
  };
  const thBtn = function(val, label) {
    const active = (val === th) ? ' active' : '';
    return '<button class="opt-btn' + active + '" onclick="setSheetTheme(\'' + charId + '\',\'' + val + '\')">' + label + '</button>';
  };
  let html = '<div class="sheet-options-bar">' +
    '<span class="opt-label">TEXT</span>' +
    '<div class="opt-group">' + tsBtn('sm', 'A') + tsBtn('lg', 'A+') + tsBtn('xl', 'A++') + '</div>' +
    '<span class="opt-label" style="margin-left:.6rem">THEME</span>' +
    '<div class="opt-group">' + thBtn('dark', '🌙 Dark') + thBtn('paper', '📜 Paper') + thBtn('custom', '🎨 Custom') + '</div>' +
    '<span class="opt-label" style="margin-left:.6rem">SECTIONS</span>' +
    '<div class="opt-group">' +
      '<button class="opt-btn" onclick="toggleAllSheetSections(true)">Expand all</button>' +
      '<button class="opt-btn" onclick="toggleAllSheetSections(false)">Collapse all</button>' +
    '</div>' +
    '<span class="opt-label" style="margin-left:.6rem">LAYOUT</span>' +
    '<div class="opt-group">' +
      '<button class="opt-btn' + (editOn ? ' active' : '') + '" onclick="toggleSheetEditLayout(\'' + charId + '\')" title="Toggle drag-and-drop reordering of sections">' + (editOn ? '✓ Editing layout' : '🔀 Edit layout') + '</button>' +
      (editOn ? '<button class="opt-btn" onclick="resetSheetLayout(\'' + charId + '\')" title="Restore the default section order">🔄 Reset</button>' : '') +
    '</div>';

  if (th === 'custom') {
    const bg = _sheetGetPref(charId, 'customBg', '#100a05');
    const fg = _sheetGetPref(charId, 'customFg', '#f2e8d0');
    const ac = _sheetGetPref(charId, 'customAccent', '#c9a84c');
    html += '<div class="theme-custom-row">' +
      '<label>Bg <input type="color" value="' + bg + '" onchange="setSheetCustomColor(\'' + charId + '\',\'bg\',this.value)"></label>' +
      '<label>Text <input type="color" value="' + fg + '" onchange="setSheetCustomColor(\'' + charId + '\',\'fg\',this.value)"></label>' +
      '<label>Accent <input type="color" value="' + ac + '" onchange="setSheetCustomColor(\'' + charId + '\',\'accent\',this.value)"></label>' +
      '<span class="opt-label" style="margin-left:.4rem">PRESETS</span>';
    _SHEET_PRESETS.forEach(function(p) {
      html += '<span class="preset-swatch" title="' + p.name + '" ' +
        'style="background:linear-gradient(135deg,' + p.bg + ' 0%,' + p.bg + ' 55%,' + p.accent + ' 55%,' + p.accent + ' 100%)" ' +
        'onclick="applySheetPreset(\'' + charId + '\',\'' + p.bg + '\',\'' + p.fg + '\',\'' + p.accent + '\')"></span>';
    });
    html += '</div>';
  }

  html += '</div>';
  return html;
}
function setSheetTextSize(charId, val) {
  _sheetSetPref(charId, 'textSize', val);
  const body = document.getElementById('sheet-body');
  if (body) body.setAttribute('data-text-size', val);
  refreshSheet(charId);
}
function setSheetTheme(charId, val) {
  _sheetSetPref(charId, 'theme', val);
  const body = document.getElementById('sheet-body');
  if (body) body.setAttribute('data-theme', val);
  refreshSheet(charId);
}
function setSheetCustomColor(charId, which, hex) {
  const key = which === 'bg' ? 'customBg' : which === 'fg' ? 'customFg' : 'customAccent';
  _sheetSetPref(charId, key, hex);
  _applySheetCustomVars(charId);
}
function applySheetPreset(charId, bg, fg, accent) {
  _sheetSetPref(charId, 'customBg', bg);
  _sheetSetPref(charId, 'customFg', fg);
  _sheetSetPref(charId, 'customAccent', accent);
  _sheetSetPref(charId, 'theme', 'custom');
  const body = document.getElementById('sheet-body');
  if (body) body.setAttribute('data-theme', 'custom');
  refreshSheet(charId);
}
function _applySheetCustomVars(charId) {
  const body = document.getElementById('sheet-body');
  if (!body) return;
  body.style.setProperty('--sheet-custom-bg',     _sheetGetPref(charId, 'customBg', '#100a05'));
  body.style.setProperty('--sheet-custom-fg',     _sheetGetPref(charId, 'customFg', '#f2e8d0'));
  body.style.setProperty('--sheet-custom-accent', _sheetGetPref(charId, 'customAccent', '#c9a84c'));
}
function toggleAllSheetSections(open) {
  document.querySelectorAll('#sheet-body details.sheet-collapsible').forEach(function(d) {
    if (open) d.setAttribute('open', ''); else d.removeAttribute('open');
    // Persist per section
    const key = d.getAttribute('data-collapse-key');
    if (key) { try { localStorage.setItem(key, open ? '1' : '0'); } catch (e) {} }
  });
}
// Wraps a rendered section in a collapsible details element. Persists
// open/closed state per (charId, sectionId) in localStorage.
function _wrapCollapsible(charId, sectionId, label, contentHtml, defaultOpen, editMode) {
  const key = 'eldoria-sheet-sec-' + charId + '-' + sectionId;
  let openAttr = defaultOpen === false ? '' : ' open';
  try {
    const saved = localStorage.getItem(key);
    if (saved === '1') openAttr = ' open';
    else if (saved === '0') openAttr = '';
  } catch (e) {}
  const dragAttr = editMode ? ' draggable="true"' : '';
  const dragHandlers = editMode
    ? ' ondragstart="_sheetDragStart(event,\'' + charId + '\',\'' + sectionId + '\')"' +
      ' ondragover="_sheetDragOver(event)"' +
      ' ondragleave="_sheetDragLeave(event)"' +
      ' ondrop="_sheetDrop(event,\'' + charId + '\',\'' + sectionId + '\')"' +
      ' ondragend="_sheetDragEnd(event)"'
    : '';
  const controls =
    '<span class="sheet-section-controls">' +
      '<button class="move-btn" onclick="event.preventDefault();event.stopPropagation();moveSheetSection(\'' + charId + '\',\'' + sectionId + '\',-1)" title="Move up">⬆</button>' +
      '<button class="move-btn" onclick="event.preventDefault();event.stopPropagation();moveSheetSection(\'' + charId + '\',\'' + sectionId + '\',1)" title="Move down">⬇</button>' +
      '<span class="grip" title="Drag to reorder">⋮⋮</span>' +
    '</span>';
  return '<details class="sheet-collapsible" data-collapse-key="' + key + '" data-section="' + sectionId + '"' + dragAttr + openAttr + dragHandlers +
    ' ontoggle="try{localStorage.setItem(this.getAttribute(\'data-collapse-key\'), this.open?\'1\':\'0\')}catch(e){}">' +
    '<summary><span class="section-label">' + label + '</span>' + controls + '</summary>' +
    '<div class="sheet-collapsible-body">' + contentHtml + '</div>' +
    '</details>';
}

// ----- Section reorder helpers (two-column model, independent stacks) -----
const _SHEET_DEFAULT_COLUMNS = {
  left:  ['weapons','resources','wildshape','features','conditions','spells','attunement'],
  right: ['minions','inventory','currency','equipment','bio','extras']
};
function _getSheetSectionColumns(state, availableIds) {
  const availSet = {};
  availableIds.forEach(function(id) { availSet[id] = true; });
  // New format
  if (state.sectionColumns && typeof state.sectionColumns === 'object') {
    const left  = (state.sectionColumns.left  || []).filter(function(s) { return availSet[s]; });
    const right = (state.sectionColumns.right || []).filter(function(s) { return availSet[s]; });
    const placed = {};
    left.forEach(function(s)  { placed[s] = true; });
    right.forEach(function(s) { placed[s] = true; });
    _SHEET_DEFAULT_COLUMNS.left.forEach(function(s)  { if (availSet[s] && !placed[s]) { left.push(s);  placed[s] = true; } });
    _SHEET_DEFAULT_COLUMNS.right.forEach(function(s) { if (availSet[s] && !placed[s]) { right.push(s); placed[s] = true; } });
    return { left: left, right: right };
  }
  // v1 → v2 migration: split the old flat order in half
  if (Array.isArray(state.sectionOrder) && state.sectionOrder.length) {
    const flat = state.sectionOrder.filter(function(s) { return availSet[s]; });
    _SHEET_DEFAULT_COLUMNS.left.concat(_SHEET_DEFAULT_COLUMNS.right).forEach(function(s) {
      if (availSet[s] && flat.indexOf(s) === -1) flat.push(s);
    });
    const half = Math.ceil(flat.length / 2);
    return { left: flat.slice(0, half), right: flat.slice(half) };
  }
  // Fresh default
  return {
    left:  _SHEET_DEFAULT_COLUMNS.left.filter(function(s)  { return availSet[s]; }),
    right: _SHEET_DEFAULT_COLUMNS.right.filter(function(s) { return availSet[s]; })
  };
}
function _computeSheetSectionColumnsForChar(charId) {
  const char = CHARACTERS[charId];
  const state = getSheetState(charId);
  const avail = ['weapons','resources'];
  if (char.wildShape) avail.push('wildshape');
  avail.push('features','conditions');
  if (char.spellcasting) avail.push('spells');
  avail.push('attunement');
  if (_hasMinions(charId, char, state)) avail.push('minions');
  avail.push('inventory','currency','equipment','bio','extras');
  return _getSheetSectionColumns(state, avail);
}
function _findSectionColumn(cols, sectionId) {
  if (cols.left.indexOf(sectionId)  !== -1) return 'left';
  if (cols.right.indexOf(sectionId) !== -1) return 'right';
  return null;
}
function _saveSheetSectionColumns(charId, cols) {
  const state = getSheetState(charId);
  state.sectionColumns = cols;
  saveSheetState(charId, state);
}
function moveSheetSection(charId, sectionId, delta) {
  const cols = _computeSheetSectionColumnsForChar(charId);
  const which = _findSectionColumn(cols, sectionId);
  if (!which) return;
  const arr = cols[which];
  const idx = arr.indexOf(sectionId);
  const to = idx + delta;
  if (to < 0 || to >= arr.length) return;
  const tmp = arr[to]; arr[to] = arr[idx]; arr[idx] = tmp;
  _saveSheetSectionColumns(charId, cols);
  refreshSheet(charId);
}
let _sheetDragging = null;
function _sheetDragStart(e, charId, sectionId) {
  _sheetDragging = { charId: charId, sectionId: sectionId };
  try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', sectionId); } catch (_) {}
  if (e.currentTarget && e.currentTarget.classList) e.currentTarget.classList.add('dragging');
}
function _sheetDragOver(e) {
  if (!_sheetDragging) return;
  e.preventDefault();
  e.stopPropagation();
  try { e.dataTransfer.dropEffect = 'move'; } catch (_) {}
  if (e.currentTarget && e.currentTarget.classList) e.currentTarget.classList.add('drop-target');
}
function _sheetDragLeave(e) {
  if (e.currentTarget && e.currentTarget.classList) e.currentTarget.classList.remove('drop-target');
}
function _sheetDrop(e, charId, targetSectionId) {
  e.preventDefault();
  e.stopPropagation();
  if (!_sheetDragging || _sheetDragging.charId !== charId) { _sheetDragging = null; return; }
  const fromId = _sheetDragging.sectionId;
  _sheetDragging = null;
  if (fromId === targetSectionId) { refreshSheet(charId); return; }
  const cols = _computeSheetSectionColumnsForChar(charId);
  const fromCol = _findSectionColumn(cols, fromId);
  const toCol   = _findSectionColumn(cols, targetSectionId);
  if (!fromCol || !toCol) return;
  const fromIdx = cols[fromCol].indexOf(fromId);
  cols[fromCol].splice(fromIdx, 1);
  const toIdx = cols[toCol].indexOf(targetSectionId);
  cols[toCol].splice(toIdx, 0, fromId);
  _saveSheetSectionColumns(charId, cols);
  refreshSheet(charId);
}
// Column-level drop: append to end of the column (empty column or dropped below all sections)
function _sheetColDragOver(e) {
  if (!_sheetDragging) return;
  e.preventDefault();
  try { e.dataTransfer.dropEffect = 'move'; } catch (_) {}
  if (e.currentTarget && e.currentTarget.classList) e.currentTarget.classList.add('col-drop-target');
}
function _sheetColDragLeave(e) {
  if (e.currentTarget && e.currentTarget.classList) e.currentTarget.classList.remove('col-drop-target');
}
function _sheetDropCol(e, charId, colName) {
  e.preventDefault();
  if (!_sheetDragging || _sheetDragging.charId !== charId) { _sheetDragging = null; return; }
  const fromId = _sheetDragging.sectionId;
  _sheetDragging = null;
  const cols = _computeSheetSectionColumnsForChar(charId);
  const fromCol = _findSectionColumn(cols, fromId);
  if (!fromCol) return;
  const fromIdx = cols[fromCol].indexOf(fromId);
  cols[fromCol].splice(fromIdx, 1);
  cols[colName].push(fromId);
  _saveSheetSectionColumns(charId, cols);
  refreshSheet(charId);
}
function _sheetDragEnd(e) {
  _sheetDragging = null;
  document.querySelectorAll('#sheet-body .sheet-collapsible.dragging').forEach(function(d) { d.classList.remove('dragging'); });
  document.querySelectorAll('#sheet-body .sheet-collapsible.drop-target').forEach(function(d) { d.classList.remove('drop-target'); });
  document.querySelectorAll('#sheet-body .sheet-reorder-col.col-drop-target').forEach(function(d) { d.classList.remove('col-drop-target'); });
}
function toggleSheetEditLayout(charId) {
  const state = getSheetState(charId);
  state.editLayout = !state.editLayout;
  saveSheetState(charId, state);
  refreshSheet(charId);
}
function resetSheetLayout(charId) {
  if (typeof confirm === 'function' && !confirm('Reset section order to the default layout?')) return;
  const state = getSheetState(charId);
  state.sectionOrder = null;
  state.sectionColumns = null;
  saveSheetState(charId, state);
  refreshSheet(charId);
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
  if (e.key === 'eldoria-lich' && typeof dmLichStorageChanged === 'function') dmLichStorageChanged(e.newValue);
});

// Lich clock, Kaelith's plague roller and the NPC sheet extras are DM-only
// and live in sheet-data-dm.js (Update 65b). These hooks call them only
// when that file is loaded (DM dashboard, or a DM-unlocked sheet page).
function renderLichClock() { if (typeof dmRenderLichClock === 'function') dmRenderLichClock(); }
function initLichClock() { if (typeof dmInitLichClock === 'function') dmInitLichClock(); }

// ----- Character-specific extras: rendered at the end of each sheet -----
function renderCharacterExtras(char) {
  if (typeof dmCharacterExtras === 'function') return dmCharacterExtras(char) || '';
  return '';
}
// ----- Renderer -----

function renderSheet(charId) {
  // Update 67 — re-render when anyone edits shared spell wording.
  if (window.SpellText && !renderSheet._spellTextHooked) {
    renderSheet._spellTextHooked = true;
    SpellText.init();
    SpellText.onChange(function() { if (_currentSheetId && document.getElementById('sheet-body')) refreshSheet(_currentSheetId); });
  }
  // Subscribe to Firebase updates for this character (once per session).
  _subscribeSheetIfPossible(charId);
  const char = CHARACTERS[charId];
  const state = getSheetState(charId);
  const body = document.getElementById('sheet-body');
  if (!body) return;

  // Apply saved readability preferences to #sheet-body (persisted per charId).
  const prefTs = _sheetGetPref(charId, 'textSize', 'sm');
  const prefTh = _sheetGetPref(charId, 'theme', 'dark');
  body.setAttribute('data-text-size', prefTs);
  body.setAttribute('data-theme', prefTh);
  body.setAttribute('data-edit-layout', state.editLayout ? '1' : '0');
  if (prefTh === 'custom') _applySheetCustomVars(charId);

  let html = '';

  // Sheet Options toolbar — text size, theme, collapse-all/expand-all.
  html += _renderSheetOptionsBar(charId, prefTs, prefTh);

  // Rest buttons at the very top of the sheet (Phase 4B rev — user preference)
  // Update 15: Arcane Recovery button appears for characters whose classFeatures include it.
  const hasArcaneRecovery = (char.classFeatures || []).some(f => /arcane recovery/i.test(f.name));
  const recoveryBtn = hasArcaneRecovery
    ? '<button onclick="arcaneRecovery(\'' + charId + '\')" style="background:rgba(90,60,150,0.2);color:#c8a8e0;border:1px solid #a070c0;border-radius:3px;padding:.45rem 1rem;font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:1.5px;cursor:pointer" title="Wizard Arcane Recovery — after Short Rest, recover slots totalling ½ Wizard level (rounded up), no L6+, once per Long Rest">🔮 Arcane Recovery</button>'
    : '';
  html += '<div style="display:flex;justify-content:flex-end;gap:.5rem;padding:.3rem 0 .6rem;margin-bottom:.5rem;border-bottom:1px dashed rgba(160,128,64,0.25);flex-wrap:wrap">' +
    '<button onclick="shortRest(\'' + charId + '\')" style="background:rgba(160,128,64,0.15);color:var(--gold2);border:1px solid var(--gold2);border-radius:3px;padding:.45rem 1rem;font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:1.5px;cursor:pointer">🛏 Short Rest</button>' +
    recoveryBtn +
    '<button onclick="longRest(\'' + charId + '\')" style="background:var(--gold);color:#0d0a06;border:none;border-radius:3px;padding:.45rem 1rem;font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:1.5px;cursor:pointer">🌙 Long Rest</button>' +
    '</div>';

  // Sylas Soul Siphon rider banner — shows only when siphonCharged is true.
  if (charId === 'sylas' && state.siphonCharged) {
    html += '<div style="margin:.4rem 0 .75rem;padding:.55rem .85rem;border:1px solid #c04040;background:linear-gradient(90deg, rgba(192,64,64,0.20), rgba(192,64,64,0.06));border-radius:4px;display:flex;justify-content:space-between;align-items:center;gap:.75rem;flex-wrap:wrap">' +
      '<div style="font-family:\'Cinzel\',serif;color:#f4b0b0;font-size:12px;letter-spacing:1px">⚡ SIPHON CHARGED &nbsp;·&nbsp; next hit deals <strong style="color:#ffdada">+1d6+5</strong> damage</div>' +
      '<div style="display:flex;gap:.4rem">' +
        '<button onclick="rollSiphonBonus(\'' + charId + '\')" style="background:#a02828;color:#fff;border:none;border-radius:3px;padding:.35rem .9rem;font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:1px;cursor:pointer">🎲 Roll & consume</button>' +
        '<button onclick="clearSiphonCharge(\'' + charId + '\')" style="background:transparent;color:#d0a0a0;border:1px solid #a02828;border-radius:3px;padding:.35rem .7rem;font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:1px;cursor:pointer" title="Dismiss without rolling (e.g. missed the attack)">✕ Dismiss</button>' +
      '</div>' +
    '</div>';
  }

  // Circle of Spores bar (Update 69): Halo of Spores + Symbiotic Entity.
  if (char.spores) {
    const symOn = !!state.symbiotic && (state.hp.temp || 0) > 0;
    const btn = 'border-radius:3px;padding:.35rem .8rem;font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:1px;cursor:pointer';
    html += '<div style="margin:.4rem 0 .75rem;padding:.5rem .8rem;border:1px solid #6a9a5a;background:linear-gradient(90deg, rgba(60,110,50,' + (symOn ? '0.32' : '0.16') + '), rgba(60,110,50,0.04));border-radius:4px;display:flex;justify-content:space-between;align-items:center;gap:.6rem;flex-wrap:wrap">' +
      '<div style="font-family:\'Cinzel\',serif;color:#b8e0b0;font-size:12px;letter-spacing:1px">🍄 ' + (symOn ? 'SYMBIOTIC ENTITY ACTIVE — Halo rolls twice · melee +1d6 Necrotic · ends when temp HP run out (10 min)' : 'CIRCLE OF SPORES — Halo of Spores ' + _sheetEscapeAttr(char.spores.haloDie)) + '</div>' +
      '<div style="display:flex;gap:.4rem">' +
        '<button onclick="rollHaloOfSpores(\'' + charId + '\')" style="background:#4a7a3a;color:#fff;border:none;' + btn + '">🎲 Halo of Spores</button>' +
        '<button onclick="toggleSymbioticEntity(\'' + charId + '\')" style="background:transparent;color:#b8e0b0;border:1px solid #6a9a5a;' + btn + '">' + (symOn ? 'End Symbiotic Entity' : 'Symbiotic Entity (1 Wild Shape)') + '</button>' +
      '</div></div>';
  }

  html += '<div class="sheet-header">';
  html += '<div class="sheet-id-block" style="display:flex;gap:.75rem;align-items:flex-start">';
  const portraitSrc = (state.portraitUrl || char.portraitUrl || '').trim();
  if (portraitSrc) {
    html += '<div class="sheet-portrait" style="flex:0 0 auto"><img src="' + portraitSrc.replace(/"/g, '&quot;') + '" alt="' + char.name + '" style="width:88px;height:88px;object-fit:cover;border-radius:6px;border:2px solid var(--gold2,#c9a84c);background:#0d0a06" onerror="this.style.display=\'none\'"></div>';
  }
  html += '<div style="flex:1 1 auto">';
  html += '<div class="sheet-id-name">' + char.name + '</div>';
  html += '<div class="sheet-id-meta">';
  html += '<strong>Class:</strong> ' + char.className + ' ' + char.level + ' (' + char.subclass + ')<br>';
  html += '<strong>Species:</strong> ' + char.species + ' &nbsp; <strong>Background:</strong> ' + char.background + '<br>';
  html += '<strong>Alignment:</strong> ' + char.alignment;
  if (char.alias) html += '<br><strong>Alias:</strong> ' + char.alias;
  html += '</div>';
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

  // Col 1: ability score cards (unchanged, not part of reorder zone)
  html += '<div>';
  ['str','dex','con','int','wis','cha'].forEach(function(a) { html += renderAbilityCard(charId, char, a); });
  html += '</div>';

  // Reorder zone: merged former cols 2 + 3, auto-flowing 2-column grid.
  // Sections are rendered in state.sectionOrder (with sensible defaults).
  const em = !!state.editLayout;
  const sections = {};
  sections.weapons    = _wrapCollapsible(charId, 'weapons',    '⚔ Weapons',            renderWeaponsSection(charId, char),         true,  em);
  sections.resources  = _wrapCollapsible(charId, 'resources',  '⚡ Resources',          renderResourcesSection(charId, char, state),true,  em);
  if (char.wildShape) sections.wildshape = _wrapCollapsible(charId, 'wildshape', '🐾 Wild Shape', renderWildShapeSection(charId, char, state), false, em);
  sections.features   = _wrapCollapsible(charId, 'features',   '★ Features & Traits',  renderFeaturesSection(char),                false, em);
  sections.conditions = _wrapCollapsible(charId, 'conditions', '⊗ Conditions',         renderConditionsSection(charId, state),     false, em);
  if (char.spellcasting) sections.spells = _wrapCollapsible(charId, 'spells', '✦ Spells', renderSpellsSection(charId, char, state), true, em);
  sections.attunement = _wrapCollapsible(charId, 'attunement', '◈ Attunement',        renderAttunementSection(charId, state),     false, em);
  if (_hasMinions(charId, char, state)) sections.minions = _wrapCollapsible(charId, 'minions', '🧟 Undead Minions', renderMinionsSection(charId, state), false, em);
  sections.inventory  = _wrapCollapsible(charId, 'inventory',  '🎒 Inventory',         renderInventorySection(charId, char, state),false, em);
  sections.currency   = _wrapCollapsible(charId, 'currency',   '💰 Currency',          renderCurrencySection(charId, state),       false, em);
  sections.equipment  = _wrapCollapsible(charId, 'equipment',  '🛡 Equipment',         renderEquipmentSection(char),               false, em);
  sections.bio        = _wrapCollapsible(charId, 'bio',        '📖 Biography',         renderBioSection(charId, char, state),      false, em);
  sections.extras     = _wrapCollapsible(charId, 'extras',     '✧ Character Extras',   renderCharacterExtras(char),                false, em);
  const cols = _computeSheetSectionColumnsForChar(charId);
  const colAttrs = em
    ? ' ondragover="_sheetColDragOver(event)" ondragleave="_sheetColDragLeave(event)"'
    : '';
  html += '<div class="sheet-reorder-zone">';
  html += '<div class="sheet-reorder-col" data-col="left"' + colAttrs + (em ? ' ondrop="_sheetDropCol(event,\'' + charId + '\',\'left\')"' : '') + '>';
  cols.left.forEach(function(sid)  { if (sections[sid]) html += sections[sid]; });
  html += '</div>';
  html += '<div class="sheet-reorder-col" data-col="right"' + colAttrs + (em ? ' ondrop="_sheetDropCol(event,\'' + charId + '\',\'right\')"' : '') + '>';
  cols.right.forEach(function(sid) { if (sections[sid]) html += sections[sid]; });
  html += '</div>';
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
// ---- Wild Shape (Update 61b) --------------------------------------------
// char.wildShape = { maxCR, knownCount, forms: [beast stat blocks], note }
function renderWildShapeSection(charId, char, state) {
  const ws = char.wildShape || {};
  const forms = ws.forms || [];
  const mod = function(n) { return sheetFmtMod(sheetAbilityMod(n)); };
  let html = '<div style="font-size:11.5px;color:var(--parch3);margin-bottom:.5rem;line-height:1.5">' +
    'Known forms: <strong style="color:var(--gold3)">' + forms.length + ' / ' + (ws.knownCount || forms.length) + '</strong> &nbsp;·&nbsp; max CR ' + (ws.maxCR || '—') + ', no Fly speed. ' +
    'Bonus Action to transform; temp HP = druid level (' + char.level + '). Lasts ' + Math.floor(char.level / 2) + ' hours. Uses are tracked under Resources.' +
    (ws.note ? '<br><em>' + ws.note + '</em>' : '') + '</div>';
  forms.forEach(function(b) {
    const traits = (b.traits || []).map(function(x) { return '<div><strong>' + x.name + '.</strong> ' + x.desc + '</div>'; }).join('');
    const actions = (b.actions || []).map(function(x) { return '<div><strong>' + x.name + '.</strong> ' + x.desc + '</div>'; }).join('');
    html += '<details class="sheet-feature" style="margin-bottom:.35rem">' +
      '<summary style="cursor:pointer"><span class="sheet-feature-name">' + b.name + '</span> <span style="font-size:10.5px;color:var(--parch4)">' + b.size + ' · CR ' + b.cr + ' · AC ' + b.ac + ' · HP ' + b.hp + ' · ' + b.speed + '</span></summary>' +
      '<div class="sheet-feature-desc" style="margin-top:.3rem">' +
        '<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:.2rem;text-align:center;font-size:10.5px;margin-bottom:.35rem">' +
          ['str','dex','con','int','wis','cha'].map(function(k) { return '<div><div style="color:var(--parch4)">' + k.toUpperCase() + '</div>' + b[k] + ' (' + mod(b[k]) + ')</div>'; }).join('') +
        '</div>' +
        '<div style="font-size:10.5px;color:var(--parch4);margin-bottom:.3rem">' + (b.senses || '') + ' · Your Int, Wis and Cha stay your own.</div>' +
        traits + actions +
      '</div></details>';
  });
  return html;
}

// ---- Circle of the Land terrain picker (Update 61b) ----------------------
// char.landCircle = { land, labels{}, spellsByLand{ land: [{name, minLevel}] } }
// state.circleLand overrides the build-time land. Circle spells added by the
// picker carry circleAdded:true so a switch removes only those.
function _circleReason(char, land) { return 'Circle of the Land (' + ((char.landCircle.labels || {})[land] || land) + ')'; }
function _renderLandPicker(charId, char, state) {
  const lc = char.landCircle;
  const cur = state.circleLand || lc.land;
  const opts = Object.keys(lc.spellsByLand).map(function(k) {
    return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + ((lc.labels || {})[k] || k) + '</option>';
  }).join('');
  const names = (lc.spellsByLand[cur] || []).filter(function(s) { return s.minLevel <= char.level; }).map(function(s) { return s.name; }).join(', ');
  return '<div style="margin:.3rem 0 .5rem;padding:.35rem .5rem;background:rgba(40,70,40,0.18);border:1px solid rgba(110,160,90,0.35);border-radius:3px;font-size:11px">' +
    '<span style="font-family:\'Cinzel\',serif;color:var(--gold3);letter-spacing:.5px">Circle land:</span> ' +
    '<select onchange="setCircleLand(\'' + charId + '\', this.value)" style="background:rgba(10,8,5,0.6);color:var(--parch);border:1px solid rgba(160,128,64,0.5);border-radius:2px;font-size:11px">' + opts + '</select>' +
    ' <span style="color:var(--parch4);font-style:italic">change after a Long Rest</span>' +
    '<div style="color:var(--parch3);margin-top:.2rem">Always prepared: ' + (names || '—') + '</div></div>';
}
function setCircleLand(charId, land) {
  const char = CHARACTERS[charId];
  if (!char || !char.landCircle || !char.landCircle.spellsByLand[land]) return;
  withSheetState(charId, function(s) { _applyCircleLand(char, s, land); });
}
// Pure state change: drop the old land's Circle spells, add the new land's.
// Spells the player prepared themselves are kept (just un-flagged).
function _applyCircleLand(char, s, land) {
  const byName = {};
  if (typeof SPELLS_2024 !== 'undefined') SPELLS_2024.forEach(function(sp) { byName[(sp.name || '').toLowerCase()] = sp; });
  s.spells = (s.spells || []).filter(function(sp) {
    if (!/^Circle of the Land/.test(sp.alwaysPreparedReason || '')) return true;
    if (sp.circleAdded) return false;
    sp.alwaysPrepared = false; sp.alwaysPreparedReason = '';
    return true;
  });
  const have = {};
  s.spells.forEach(function(sp) { have[(sp.name || '').toLowerCase()] = sp; });
  char.landCircle.spellsByLand[land].forEach(function(entry, i) {
    if (entry.minLevel > char.level) return;
    const key = entry.name.toLowerCase();
    if (have[key]) { have[key].alwaysPrepared = true; have[key].alwaysPreparedReason = _circleReason(char, land); have[key].prepared = true; return; }
    const src = byName[key];
    if (!src) return;
    s.spells.push({
      id: 'circle_' + land + '_' + i, sourceSpellId: src.id, name: src.name, level: src.level,
      school: src.school || '', castingTime: src.castingTime || 'Action', range: src.range || '—', components: src.components || '',
      duration: src.duration || '', concentration: !!src.concentration, ritual: !!src.ritual, description: src.description || '',
      atHigherLevels: src.atHigherLevels || null, prepared: true, alwaysPrepared: true,
      alwaysPreparedReason: _circleReason(char, land), circleAdded: true, custom: false
    });
  });
  s.circleLand = land;
  s.circleLevel = char.level;
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

  // Circle of the Land — terrain picker (Update 61b)
  if (char.landCircle) headerRow = _renderLandPicker(charId, char, state) + headerRow;

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
    '<button onclick="openSpellEditor(\'' + charId + '\', null)" style="background:rgba(160,128,64,0.15);color:var(--gold2);border:1px solid var(--gold2);border-radius:2px;padding:.35rem .8rem;font-family:\'Cinzel\',serif;font-size:10px;letter-spacing:1px;cursor:pointer">＋ Create spell</button>' +
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

// Update 64 — link to the official spell text on D&D Beyond (players who own
// the books see the full wording there). Uses the catalog's direct 2024 page
// when known; otherwise D&D Beyond's spell search for the name.
let _spellUrlByName = null;
function spellOfficialUrl(name) {
  const clean = String(name || '').replace(/\s*\(.*\)\s*$/, '');
  if (!_spellUrlByName && typeof SPELLS_2024 !== 'undefined') {
    _spellUrlByName = {};
    SPELLS_2024.forEach(function(s) { if (s.officialUrl) _spellUrlByName[s.name.toLowerCase()] = s.officialUrl; });
  }
  const direct = _spellUrlByName && _spellUrlByName[clean.toLowerCase()];
  return direct || ('https://www.dndbeyond.com/spells?filter-search=' + encodeURIComponent(clean));
}
function _spellOfficialLink(name, compact) {
  return '<a href="' + spellOfficialUrl(name) + '" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="Official text on D&D Beyond" ' +
    'style="font-size:10px;color:var(--gold3);text-decoration:none;border:1px solid rgba(201,168,76,0.5);border-radius:2px;padding:0 5px;margin-left:.4rem;white-space:nowrap">' +
    (compact ? '↗' : 'Official text ↗') + '</a>';
}
// ---- Update 67 — shared spell wording + spell editor ------------------
// Catalog spells (any spell whose name is in SPELLS_2024, unless the player
// created it with ＋ Create spell) take their wording from the shared
// /spell-text store when someone has edited it. Custom spells stay per sheet.
const _SPELL_TEXT_FIELDS = ['school', 'castingTime', 'range', 'components', 'duration', 'concentration', 'ritual', 'description', 'atHigherLevels'];
let _catalogNames = null;
function _isCatalogName(name) {
  if (!_catalogNames) {
    _catalogNames = {};
    if (typeof SPELLS_2024 !== 'undefined') SPELLS_2024.forEach(function(s) { _catalogNames[s.name.toLowerCase()] = true; });
  }
  return !!_catalogNames[String(name || '').toLowerCase()];
}
function _isSharedSpell(sp) {
  return !!sp && !/^custom_spell_/.test(sp.id || '') && _isCatalogName(sp.name);
}
function _effectiveSpell(sp) {
  if (!_isSharedSpell(sp) || !window.SpellText) return sp;
  const o = SpellText.get(sp.name);
  if (!o) return sp;
  const out = Object.assign({}, sp);
  _SPELL_TEXT_FIELDS.forEach(function(k) { if (o[k] !== undefined && o[k] !== null) out[k] = o[k]; });
  if (o.atHigherLevels === undefined || o.atHigherLevels === '') out.atHigherLevels = null;
  out._sharedEdit = o;
  return out;
}
function _spellTextHtml(s) { return _sheetEscapeAttr(s || '').replace(/\n/g, '<br>'); }
function _spellEditorWho(charId) {
  const id = (typeof getCurrentIdentity === 'function') ? getCurrentIdentity() : null;
  if (id && id.label) return id.label;
  if (document.getElementById('sheet-dm-badge') && !window.__SHEET_IS_PLAYER_VIEW) return 'DM';
  return (CHARACTERS[charId] && CHARACTERS[charId].name) || 'Someone';
}

let _spellEd = null; // { charId, spellId, shared, name }
function openSpellEditor(charId, spellId) {
  const state = getSheetState(charId);
  const raw = spellId ? (state.spells || []).find(function(s) { return s.id === spellId; }) : null;
  if (spellId && !raw) return;
  const shared = !!raw && _isSharedSpell(raw);
  const sp = raw ? _effectiveSpell(raw) : { name: '', level: 1, school: '', castingTime: 'Action', range: '', components: '', duration: 'Instantaneous', concentration: false, ritual: false, description: '', atHigherLevels: '' };
  _spellEd = { charId: charId, spellId: spellId, shared: shared, name: raw ? raw.name : '' };
  let modal = document.getElementById('spell-editor-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'spell-editor-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:10050;display:flex;align-items:flex-start;justify-content:center;padding:4vh 12px;overflow-y:auto';
    modal.addEventListener('click', function(e) { if (e.target === modal) closeSpellEditor(); });
    document.body.appendChild(modal);
  }
  const inp = 'width:100%;padding:.35rem .5rem;background:rgba(10,8,5,0.7);border:1px solid rgba(160,128,64,0.5);color:#f2e8d0;border-radius:2px;font-family:inherit;font-size:13px';
  const lbl = function(t) { return '<div style="font-family:\'Cinzel\',serif;font-size:10px;letter-spacing:1px;color:#c0aa7a;margin:.55rem 0 .15rem">' + t + '</div>'; };
  const v = function(k) { return _sheetEscapeAttr(sp[k] == null ? '' : sp[k]); };
  const lockName = shared; // catalog names stay fixed so every sheet still matches
  const schools = ['abjuration', 'conjuration', 'divination', 'enchantment', 'evocation', 'illusion', 'necromancy', 'transmutation'];
  const o = raw ? sp._sharedEdit : null;
  let when = '';
  if (o && o.updatedAt) { try { when = new Date(o.updatedAt).toLocaleDateString(); } catch (e) {} }
  modal.innerHTML =
    '<div style="background:#14100a;border:1px solid #a08040;border-radius:4px;max-width:640px;width:100%;padding:1rem 1.1rem;color:#f2e8d0;font-family:\'Crimson Pro\',Georgia,serif">' +
      '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:.5rem">' +
        '<div style="font-family:\'Cinzel\',serif;color:#e8c96a;font-size:15px;letter-spacing:1px">' + (raw ? '✎ Edit spell' : '＋ Create spell') + '</div>' +
        '<button onclick="closeSpellEditor()" style="background:none;border:none;color:#c0aa7a;font-size:20px;cursor:pointer" aria-label="Close">×</button>' +
      '</div>' +
      '<div style="font-size:12px;color:#d4c49a;margin-top:.25rem;line-height:1.45">' +
        (shared ? 'This is a <strong>shared</strong> spell: your changes show on <strong>every character\'s sheet</strong>.' + (o ? ' Last edited by ' + _sheetEscapeAttr(o.updatedBy || '?') + (when ? ' on ' + when : '') + '.' : '')
                : raw ? 'This spell is yours alone — changes only affect this sheet.' : 'Your own spell — it is saved on this character\'s sheet only.') +
      '</div>' +
      lbl('NAME') + '<input id="se-name" type="text" value="' + v('name') + '" style="' + inp + '"' + (lockName ? ' disabled title="Catalog spell names stay fixed"' : '') + '>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 .6rem">' +
        '<div>' + lbl('LEVEL') + '<select id="se-level" style="' + inp + '"' + (shared ? ' disabled' : '') + '>' + [0,1,2,3,4,5,6,7,8,9].map(function(l) { return '<option value="' + l + '"' + (+sp.level === l ? ' selected' : '') + '>' + (l === 0 ? 'Cantrip' : 'Level ' + l) + '</option>'; }).join('') + '</select></div>' +
        '<div>' + lbl('SCHOOL') + '<select id="se-school" style="' + inp + '"><option value="">—</option>' + schools.map(function(s) { return '<option' + (String(sp.school || '').toLowerCase() === s ? ' selected' : '') + ' value="' + s + '">' + s.charAt(0).toUpperCase() + s.slice(1) + '</option>'; }).join('') + '</select></div>' +
        '<div>' + lbl('CASTING TIME') + '<input id="se-castingTime" type="text" value="' + v('castingTime') + '" style="' + inp + '"></div>' +
        '<div>' + lbl('RANGE') + '<input id="se-range" type="text" value="' + v('range') + '" style="' + inp + '"></div>' +
        '<div>' + lbl('COMPONENTS') + '<input id="se-components" type="text" value="' + v('components') + '" style="' + inp + '"></div>' +
        '<div>' + lbl('DURATION') + '<input id="se-duration" type="text" value="' + v('duration') + '" style="' + inp + '"></div>' +
      '</div>' +
      '<div style="display:flex;gap:1rem;margin-top:.5rem;font-size:13px">' +
        '<label><input id="se-concentration" type="checkbox"' + (sp.concentration ? ' checked' : '') + '> Concentration</label>' +
        '<label><input id="se-ritual" type="checkbox"' + (sp.ritual ? ' checked' : '') + '> Ritual</label>' +
      '</div>' +
      lbl('DESCRIPTION') + '<textarea id="se-description" style="' + inp + ';min-height:180px;line-height:1.45">' + v('description') + '</textarea>' +
      lbl('AT HIGHER LEVELS / CANTRIP UPGRADE') + '<textarea id="se-atHigherLevels" style="' + inp + ';min-height:60px">' + v('atHigherLevels') + '</textarea>' +
      (raw && _isCatalogName(raw.name) ? '<div style="margin-top:.4rem">' + _spellOfficialLink(raw.name) + ' <span style="font-size:11px;color:#c0aa7a">— open the official wording to copy from</span></div>' : '') +
      '<div style="display:flex;justify-content:space-between;gap:.5rem;margin-top:.9rem;flex-wrap:wrap">' +
        '<div>' + (shared && o ? '<button onclick="resetSpellEditor()" style="background:transparent;color:#e08080;border:1px solid #a04040;border-radius:3px;padding:.4rem .8rem;font-family:\'Cinzel\',serif;font-size:11px;cursor:pointer">↺ Reset for everyone</button>' : '') +
          (raw && !shared ? '<button onclick="deleteSpellFromEditor()" style="background:transparent;color:#e08080;border:1px solid #a04040;border-radius:3px;padding:.4rem .8rem;font-family:\'Cinzel\',serif;font-size:11px;cursor:pointer">🗑 Delete spell</button>' : '') + '</div>' +
        '<div style="display:flex;gap:.4rem">' +
          '<button onclick="closeSpellEditor()" style="background:transparent;color:#c9a84c;border:1px solid #c9a84c;border-radius:3px;padding:.4rem .9rem;font-family:\'Cinzel\',serif;font-size:11px;cursor:pointer">Cancel</button>' +
          '<button id="se-save" onclick="saveSpellEditor()" style="background:#9a7a1a;color:#0d0a06;border:none;border-radius:3px;padding:.4rem 1rem;font-family:\'Cinzel\',serif;font-size:11px;cursor:pointer">' + (shared ? 'Save for everyone' : 'Save') + '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  modal.style.display = 'flex';
  setTimeout(function() { const f = document.getElementById(lockName ? 'se-description' : 'se-name'); if (f) f.focus(); }, 30);
}
function closeSpellEditor() {
  const m = document.getElementById('spell-editor-modal');
  if (m) m.style.display = 'none';
  _spellEd = null;
}
function _readSpellEditor() {
  const g = function(id) { const el = document.getElementById('se-' + id); return el ? el.value : ''; };
  const c = function(id) { const el = document.getElementById('se-' + id); return !!(el && el.checked); };
  return {
    name: g('name').trim(), level: parseInt(g('level'), 10) || 0, school: g('school'),
    castingTime: g('castingTime').trim(), range: g('range').trim(), components: g('components').trim(), duration: g('duration').trim(),
    concentration: c('concentration'), ritual: c('ritual'),
    description: g('description').trim(), atHigherLevels: g('atHigherLevels').trim()
  };
}
function saveSpellEditor() {
  if (!_spellEd) return;
  const ed = _spellEd, f = _readSpellEditor();
  if (ed.shared) {
    if (!window.SpellText) { alert('Shared spell wording is not available on this page.'); return; }
    const fields = {};
    _SPELL_TEXT_FIELDS.forEach(function(k) { fields[k] = f[k]; });
    const btn = document.getElementById('se-save'); if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    SpellText.save(ed.name, fields, _spellEditorWho(ed.charId)).then(function() {
      closeSpellEditor();
      refreshSheet(ed.charId);
    }).catch(function(e) {
      if (btn) { btn.disabled = false; btn.textContent = 'Save for everyone'; }
      alert('Could not save: ' + (e && e.message || e));
    });
    return;
  }
  if (!f.name) { alert('Give the spell a name.'); return; }
  withSheetState(ed.charId, function(s) {
    if (!s.spells) s.spells = [];
    if (ed.spellId) {
      const sp = s.spells.find(function(x) { return x.id === ed.spellId; });
      if (sp) Object.assign(sp, f, { atHigherLevels: f.atHigherLevels || null });
    } else {
      s.spells.push(Object.assign({
        id: 'custom_spell_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        sourceSpellId: null, prepared: true, alwaysPrepared: false, alwaysPreparedReason: '', custom: true
      }, f, { atHigherLevels: f.atHigherLevels || null }));
    }
  });
  closeSpellEditor();
}
function resetSpellEditor() {
  if (!_spellEd || !_spellEd.shared) return;
  if (!confirm('Reset "' + _spellEd.name + '" to the site\'s version for EVERY character?')) return;
  const ed = _spellEd;
  SpellText.reset(ed.name).then(function() { closeSpellEditor(); refreshSheet(ed.charId); })
    .catch(function(e) { alert('Could not reset: ' + (e && e.message || e)); });
}
function deleteSpellFromEditor() {
  if (!_spellEd || _spellEd.shared || !_spellEd.spellId) return;
  if (!confirm('Delete this spell from your sheet?')) return;
  const ed = _spellEd;
  withSheetState(ed.charId, function(s) { s.spells = (s.spells || []).filter(function(x) { return x.id !== ed.spellId; }); });
  closeSpellEditor();
}

function _renderSpellRow(charId, sp, opts) {
  sp = _effectiveSpell(sp);
  opts = opts || {};
  const isCantrip = sp.level === 0;
  let tagSpans = '';
  if (sp.concentration) tagSpans += '<span class="spell-tag conc" title="Concentration">C</span>';
  if (sp.ritual)        tagSpans += '<span class="spell-tag" title="Ritual">R</span>';
  // Update 14 — Reaction spells: any spell whose casting time contains "reaction"
  if (sp.castingTime && /reaction/i.test(sp.castingTime)) tagSpans += '<span class="spell-tag" style="background:rgba(122,26,26,0.4);color:#f4c4c4;border:1px solid #a04040" title="Reaction — cast on trigger, not your turn">⚡R</span>';
  const schoolBadge = sp.school ? '<span style="font-size:9px;color:var(--parch4);text-transform:capitalize;letter-spacing:.5px;margin-left:.4rem">' + _sheetEscapeAttr(sp.school) + '</span>' : '';
  const alwaysBadge = opts.alwaysBadge && sp.alwaysPreparedReason
    ? '<span style="font-size:9px;color:var(--gold3);font-style:italic;letter-spacing:.3px;margin-left:.4rem">★ ' + _sheetEscapeAttr(sp.alwaysPreparedReason) + '</span>'
    : '';
  const editedBadge = sp._sharedEdit
    ? '<span title="Shared wording edited by ' + _sheetEscapeAttr(sp._sharedEdit.updatedBy || '?') + '" style="font-size:9px;color:#9fd09f;letter-spacing:.3px;margin-left:.4rem">✎ edited</span>'
    : (/^custom_spell_/.test(sp.id || '') ? '<span style="font-size:9px;color:#c8a8e0;letter-spacing:.3px;margin-left:.4rem">✦ custom</span>' : '');
  const editBtn = '<button onclick="event.stopPropagation();openSpellEditor(\'' + charId + '\',\'' + sp.id + '\')" title="Edit this spell" style="background:transparent;border:1px solid rgba(160,128,64,0.5);color:var(--parch3);border-radius:2px;padding:2px 7px;cursor:pointer;font-size:11px">✎</button>';
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
      '<div class="sheet-spell-name">' + _sheetEscapeAttr(sp.name) + tagSpans + schoolBadge + alwaysBadge + editedBadge + '</div>' +
    '</div>' +
    '<div style="display:flex;align-items:center;gap:.35rem;flex-shrink:0">' + castBtn + upcastBtn + ritualBtn + editBtn + '</div>' +
    '<div class="sheet-spell-detail" id="spell-detail-' + sp.id + '" style="display:none;flex-basis:100%;margin-top:.3rem;padding:.4rem .6rem;background:rgba(20,15,8,0.5);border-left:2px solid var(--gold2);font-size:11.5px;line-height:1.5;color:var(--parch2)">' +
      '<div style="font-size:10px;color:var(--parch3);letter-spacing:.5px;margin-bottom:.3rem"><strong>' + (isCantrip ? 'Cantrip' : 'Level ' + sp.level) + ' · ' + _sheetEscapeAttr(sp.school || '—') + '</strong> · ' + _sheetEscapeAttr(sp.castingTime || 'Action') + ' · Range ' + _sheetEscapeAttr(sp.range || '—') + ' · ' + _sheetEscapeAttr(sp.duration || '') + '</div>' +
      (sp.components ? '<div style="font-size:10px;color:var(--parch4);margin-bottom:.3rem"><em>Components:</em> ' + _sheetEscapeAttr(sp.components) + '</div>' : '') +
      _spellTextHtml(sp.description) +
      '<div style="margin-top:.35rem">' + (_isCatalogName(sp.name) ? _spellOfficialLink(sp.name) : '') + '</div>' +
    '</div>' +
    (isCantrip ? '' :
      '<div class="sheet-spell-upcast" id="spell-upcast-' + sp.id + '" style="display:none;flex-basis:100%;margin-top:.3rem;padding:.4rem .6rem;background:rgba(154,122,26,0.15);border-left:2px solid var(--gold3);font-size:11.5px;line-height:1.5;color:var(--parch)">' +
        (sp.atHigherLevels
          ? '<strong style="font-family:\'Cinzel\',serif;font-size:10px;letter-spacing:1px;color:var(--gold3)">AT HIGHER LEVELS —</strong> ' + _spellTextHtml(sp.atHigherLevels)
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

// Update 58 — "what does this spell do?" panel under each row of the
// Prepare Spells window (shared wording from Update 67 included).
const _prepInfoOpen = {};
function _prepInfoHtml(e) {
  let src = null;
  if (typeof SPELLS_2024 !== 'undefined') src = SPELLS_2024.find(function(s) { return s.name.toLowerCase() === String(e.name || '').toLowerCase(); }) || null;
  const sp = _effectiveSpell(Object.assign({ id: 'prep_' + e.key }, src || {}, { name: e.name, description: e.description || (src && src.description) || '', atHigherLevels: e.atHigherLevels || (src && src.atHigherLevels) || null, castingTime: e.castingTime || (src && src.castingTime) || '' }));
  const meta = [sp.castingTime, sp.range && ('Range ' + sp.range), sp.duration, sp.components].filter(Boolean).map(_sheetEscapeAttr).join(' · ');
  return '<div id="prep-info-' + _sheetEscapeAttr(e.key) + '" style="display:' + (_prepInfoOpen[e.key] ? 'block' : 'none') + ';margin:.1rem 0 .4rem 1.6rem;padding:.4rem .55rem;border-left:2px solid var(--gold2);background:rgba(20,15,8,0.5);font-size:11.5px;line-height:1.45;color:var(--parch2)">' +
    (meta ? '<div style="font-size:10px;color:var(--parch4);margin-bottom:.25rem">' + meta + '</div>' : '') +
    (sp.description ? _spellTextHtml(sp.description) : '<em style="color:var(--parch4)">No description yet — use ✎ Edit on your sheet, or the ↗ link for the official text.</em>') +
    (sp.atHigherLevels ? '<div style="margin-top:.25rem;color:var(--gold3);font-style:italic"><strong>Higher levels:</strong> ' + _spellTextHtml(sp.atHigherLevels) + '</div>' : '') +
    '</div>';
}
function _togglePrepInfo(key) {
  _prepInfoOpen[key] = !_prepInfoOpen[key];
  const el = document.getElementById('prep-info-' + key);
  if (el) el.style.display = _prepInfoOpen[key] ? 'block' : 'none';
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

  // Max castable spell level — cap the prep list. Read from
  // char.spellcasting.slots length (e.g. [4,3,3] = up to L3). Fallback 9.
  const maxSlot = (char.spellcasting && Array.isArray(char.spellcasting.slots))
    ? char.spellcasting.slots.length
    : 9;

  // Filter
  const filter = (_prepModalFilter || '').toLowerCase();
  const filtered = entries.filter(function(e) {
    // Hide spells above the character's max slot level (unless the entry is
    // already always-prepared for some campaign-specific reason — never hide
    // those).
    if (e.level > maxSlot && !e.alwaysPrepared) return false;
    if (_prepModalLevel !== 'all' && e.level !== _prepModalLevel) return false;
    if (!filter) return true;
    return (e.name || '').toLowerCase().indexOf(filter) !== -1;
  }).sort(function(a, b) { return a.level - b.level || (a.name || '').localeCompare(b.name || ''); });

  // Prep count (excluding always-prepared)
  const preparedCount = entries.filter(function(e) { return e.prepared && !e.alwaysPrepared; }).length;
  const alwaysCount = entries.filter(function(e) { return e.alwaysPrepared; }).length;
  const over = prepMax !== null && preparedCount > prepMax;

  // Level filter buttons — only include levels the character can actually cast.
  const allLevels = ['all', 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const levels = allLevels.filter(function(l) { return l === 'all' || l <= maxSlot; });
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
      '<span style="flex:1;font-size:12px;color:var(--parch2)">' + _sheetEscapeAttr(e.name) + _spellOfficialLink(e.name, true) + badge + '</span>' +
      '<button type="button" title="What does this spell do?" onclick="event.preventDefault();event.stopPropagation();_togglePrepInfo(\'' + e.key + '\')" ' +
        'style="background:transparent;border:1px solid rgba(160,128,64,0.5);color:var(--gold3);border-radius:50%;width:20px;height:20px;line-height:16px;font-size:11px;cursor:pointer;padding:0;flex-shrink:0">i</button>' +
      '<span style="font-size:10px;color:var(--parch4);text-transform:capitalize">' + _sheetEscapeAttr(e.school || '') + '</span>' +
      '</label>' +
      _prepInfoHtml(e);
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
// Update 69 — the minions section shows for Sylas, builder characters flagged
// with minions (Circle of Spores), and anyone with Animate Dead on their sheet.
function _hasMinions(charId, char, state) {
  if (charId === 'sylas' || (char && char.minions)) return true;
  return (state && state.spells || []).some(function(sp) { return /^animate dead$/i.test(sp.name || ''); });
}
function renderMinionsSection(charId, state) {
  const minions = state.minions || [];
  const zStats = (typeof MONSTERS_BY_ID !== 'undefined' && MONSTERS_BY_ID['zombie']) ? MONSTERS_BY_ID['zombie'] : null;
  const sStats = (typeof MONSTERS_BY_ID !== 'undefined' && MONSTERS_BY_ID['skeleton']) ? MONSTERS_BY_ID['skeleton'] : null;
  const zAc = zStats ? zStats.ac : '?';
  const sAc = sStats ? sStats.ac : '?';
  const alive = minions.filter(function(m) { return m.hp > 0; });
  const zombieCount   = alive.filter(function(m) { return m.kind === 'zombie'; }).length;
  const skeletonCount = alive.filter(function(m) { return m.kind === 'skeleton'; }).length;
  const fungalCount   = alive.filter(function(m) { return m.kind === 'fungal'; }).length;
  const charM = CHARACTERS[charId] || {};
  const fungalLeft = (state.resources || {}).fungal_infestation;
  const reassert = state.lastReassert ? new Date(state.lastReassert).toLocaleString() : 'never';
  let rows = '';
  if (!minions.length) {
    rows = '<div style="padding:.5rem;text-align:center;color:var(--parch4);font-style:italic;font-size:12px">No active minions. Cast Animate Dead to raise some.</div>';
  } else {
    rows = minions.map(function(m, idx) {
      const ac = m.kind === 'skeleton' ? sAc : zAc;   // fungal minions use the Zombie block
      const dead = m.hp <= 0;
      const style = dead ? 'opacity:.5;text-decoration:line-through' : '';
      return '<div style="display:flex;gap:.4rem;align-items:center;padding:.3rem .2rem;border-bottom:1px dashed rgba(160,128,64,0.2);' + style + '">' +
        '<input type="text" value="' + _sheetEscapeAttr(m.name) + '" onchange="renameMinion(\'' + charId + '\', ' + idx + ', this.value)" style="flex:1;padding:2px 6px;background:rgba(10,8,5,0.6);border:1px solid rgba(160,128,64,0.4);color:var(--parch);border-radius:2px;font-size:12px">' +
        '<span style="font-size:10px;color:var(--parch3);letter-spacing:1px;font-family:\'Cinzel\',serif">' + m.kind.toUpperCase() + '</span>' +
        '<span style="font-size:10.5px;color:var(--parch3)">AC ' + ac + '</span>' +
        '<button onclick="minionHp(\'' + charId + '\', ' + idx + ', -1)" style="background:rgba(139,26,26,0.4);color:var(--parch);border:1px solid rgba(160,128,64,0.3);border-radius:2px;padding:1px 6px;font-size:10px;cursor:pointer">−</button>' +
        '<input type="number" value="' + m.hp + '" onchange="setMinionHp(\'' + charId + '\', ' + idx + ', this.value)" style="width:3.5ch;text-align:center;padding:1px 2px;background:rgba(10,8,5,0.6);border:1px solid rgba(160,128,64,0.4);color:var(--gold3);font-family:\'Cinzel\',serif;font-size:12px;border-radius:2px;-moz-appearance:textfield">' +
        '<span style="font-size:10px;color:var(--parch4)">/ ' + m.hpMax + '</span>' +
        '<button onclick="minionHp(\'' + charId + '\', ' + idx + ', 1)" style="background:rgba(13,74,42,0.4);color:var(--parch);border:1px solid rgba(160,128,64,0.3);border-radius:2px;padding:1px 6px;font-size:10px;cursor:pointer">+</button>' +
        '<button onclick="removeMinion(\'' + charId + '\', ' + idx + ')" style="background:transparent;color:var(--red2);border:1px solid var(--red2);border-radius:2px;padding:1px 6px;font-size:10px;cursor:pointer">✕</button>' +
      '</div>';
    }).join('');
  }
  return '<div class="sheet-sub"><div class="sheet-sub-title">Undead Minions ' +
      '<span style="font-family:\'Crimson Pro\',serif;font-weight:400;font-size:11px;color:var(--parch3);text-transform:none;letter-spacing:0;margin-left:.4rem">' +
        'Active: ' + alive.length + ' &nbsp;·&nbsp; ' + zombieCount + ' zombie' + (zombieCount === 1 ? '' : 's') + ' + ' + skeletonCount + ' skeleton' + (skeletonCount === 1 ? '' : 's') +
        (fungalCount ? ' + ' + fungalCount + ' fungal' : '') +
      '</span></div>' +
    '<div style="font-size:11px;color:var(--parch4);font-style:italic;margin-bottom:.35rem">Last reassert: ' + reassert + '</div>' +
    '<div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.5rem">' +
      '<button onclick="castAnimateDead(\'' + charId + '\')" style="background:rgba(90,60,150,0.2);color:#c8a8e0;border:1px solid #a070c0;border-radius:2px;padding:.35rem .75rem;font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:1px;cursor:pointer">✨ Cast Animate Dead</button>' +
      ((charM.spores && charM.spores.fungalInfestation) ? '<button onclick="useFungalInfestation(\'' + charId + '\')" title="Reaction when a Small/Medium Beast or Humanoid dies within 10 ft" style="background:rgba(60,110,50,0.2);color:#a8d8a0;border:1px solid #6a9a5a;border-radius:2px;padding:.35rem .75rem;font-family:\'Cinzel\',serif;font-size:10px;letter-spacing:1px;cursor:pointer">🍄 Fungal Infestation (' + (fungalLeft == null ? '?' : fungalLeft) + ' left)</button>' : '') +
      '<button onclick="reassertControl(\'' + charId + '\')" style="background:rgba(160,128,64,0.15);color:var(--gold2);border:1px solid var(--gold2);border-radius:2px;padding:.35rem .75rem;font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:1px;cursor:pointer">🔁 Reassert Control</button>' +
      (minions.length ? '<button onclick="refreshMinionStats(\'' + charId + '\')" title="Re-pull HP max from the catalog for every minion. Use after editing the base zombie/skeleton stat block." style="background:transparent;color:var(--parch3);border:1px solid var(--parch3);border-radius:2px;padding:.35rem .75rem;font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:1px;cursor:pointer">🔄 Refresh stats</button>' : '') +
      (zombieCount   ? '<button onclick="if(window.CombatTracker) CombatTracker._openStatBlock(\'zombie\')"   title="View the Zombie stat block" style="background:transparent;color:var(--parch3);border:1px solid var(--parch3);border-radius:2px;padding:.35rem .75rem;font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:1px;cursor:pointer">📖 Zombie stats</button>' : '') +
      (skeletonCount ? '<button onclick="if(window.CombatTracker) CombatTracker._openStatBlock(\'skeleton\')" title="View the Skeleton stat block" style="background:transparent;color:var(--parch3);border:1px solid var(--parch3);border-radius:2px;padding:.35rem .75rem;font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:1px;cursor:pointer">📖 Skeleton stats</button>' : '') +
      (minions.length ? '<button onclick="endAllMinions(\'' + charId + '\')" style="background:transparent;color:var(--red2);border:1px solid var(--red2);border-radius:2px;padding:.35rem .75rem;font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:1px;cursor:pointer">End All</button>' : '') +
    '</div>' +
    rows +
    '<div style="font-size:10.5px;color:var(--parch4);font-style:italic;margin-top:.4rem">Stats pull from the catalog (edit &quot;zombie&quot; or &quot;skeleton&quot; via the Custom Monster form to change their base HP/AC).</div>' +
  '</div>';
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
    ((typeof CHARACTER_DM_NOTES !== 'undefined' && CHARACTER_DM_NOTES[charId]) ?
      '<div class="sheet-sub"><div class="sheet-sub-title" style="color:#f4c4c4">DM Notes (DM only)</div><div style="font-size:12px;color:#f4c4c4;line-height:1.5">' +
      CHARACTER_DM_NOTES[charId].join('<br><br>') + '</div></div>' : '') +
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

// ---------- Sylas Animate Dead — minion handlers ----------
function castAnimateDead(charId) {
  const zStats = (typeof MONSTERS_BY_ID !== 'undefined' && MONSTERS_BY_ID['zombie'])   ? MONSTERS_BY_ID['zombie']   : null;
  const sStats = (typeof MONSTERS_BY_ID !== 'undefined' && MONSTERS_BY_ID['skeleton']) ? MONSTERS_BY_ID['skeleton'] : null;
  const zHp = (zStats && zStats.hp) || 22;
  const sHp = (sStats && sStats.hp) || 13;
  const raw = prompt('Cast Animate Dead at what spell level? (3-9)', '3');
  const lvl = parseInt(raw, 10);
  if (isNaN(lvl) || lvl < 3 || lvl > 9) return;
  const total = 1 + 2 * (lvl - 3);   // 3rd level = 1 creature; +2 per slot level above (Update 69 fix)
  const zRaw = prompt('Total ' + total + ' minions this casting.\n\nHow many ZOMBIES? (rest will be skeletons)', total);
  const zombies = Math.max(0, Math.min(total, parseInt(zRaw, 10) || 0));
  const skeletons = total - zombies;
  withSheetState(charId, function(s) {
    if (!s.minions) s.minions = [];
    let seq = s.minions.length + 1;
    for (let i = 0; i < zombies; i++) {
      s.minions.push({ id: 'z_' + Date.now() + '_' + i, kind: 'zombie', name: 'Zombie #' + (seq++), hp: zHp, hpMax: zHp, notes: '' });
    }
    for (let i = 0; i < skeletons; i++) {
      s.minions.push({ id: 's_' + Date.now() + '_' + i, kind: 'skeleton', name: 'Skeleton #' + (seq++), hp: sHp, hpMax: sHp, notes: '' });
    }
    s.lastReassert = Date.now();
  });
  if (typeof showRollToast === 'function') {
    showRollToast('Animate Dead', 'Level ' + lvl + ' — raised ' + zombies + ' zombie(s), ' + skeletons + ' skeleton(s)', '🧟');
  }
}
function renameMinion(charId, idx, name) {
  withSheetState(charId, function(s) { if (s.minions && s.minions[idx]) s.minions[idx].name = String(name || ''); });
}
function minionHp(charId, idx, delta) {
  withSheetState(charId, function(s) {
    if (!s.minions || !s.minions[idx]) return;
    const m = s.minions[idx];
    m.hp = Math.max(0, Math.min(m.hpMax, m.hp + delta));
  });
}
function setMinionHp(charId, idx, val) {
  const n = parseInt(val, 10); if (isNaN(n)) return;
  withSheetState(charId, function(s) {
    if (!s.minions || !s.minions[idx]) return;
    s.minions[idx].hp = Math.max(0, Math.min(s.minions[idx].hpMax, n));
  });
}
function removeMinion(charId, idx) {
  withSheetState(charId, function(s) { if (s.minions) s.minions.splice(idx, 1); });
}
function reassertControl(charId) {
  const raw = prompt('Reassert control — cast Animate Dead at what slot level? (3-9)\n\nOne casting keeps up to 4 creatures under control at 3rd level, +2 per slot level above, for another 24 hours.', '3');
  if (raw === null) return;
  const lvl = Math.max(3, Math.min(9, parseInt(raw, 10) || 3));
  const limit = 4 + 2 * (lvl - 3);
  withSheetState(charId, function(s) { s.lastReassert = Date.now(); });
  if (typeof showRollToast === 'function') showRollToast('Reassert Control', 'Level ' + lvl + ' casting: up to ' + limit + ' creatures stay under control for 24 hours', '🔁');
}
// Circle of Spores (Update 69): raise a fallen Small/Medium Beast or Humanoid
// as a 1-HP zombie for 1 hour. Spends one Fungal Infestation use.
function useFungalInfestation(charId) {
  const state = getSheetState(charId);
  const left = (state.resources || {}).fungal_infestation || 0;
  if (left <= 0) { alert('No Fungal Infestation uses left — they come back after a Long Rest.'); return; }
  const name = prompt('Fungal Infestation — what died? (name for the new zombie)', 'Fungal zombie');
  if (name === null) return;
  withSheetState(charId, function(s) {
    s.resources.fungal_infestation = Math.max(0, (s.resources.fungal_infestation || 0) - 1);
    if (!s.minions) s.minions = [];
    s.minions.push({ id: 'f_' + Date.now(), kind: 'fungal', name: String(name || 'Fungal zombie'), hp: 1, hpMax: 1, notes: 'Lasts 1 hour; acts right after you.', createdAt: Date.now() });
  });
  if (typeof showRollToast === 'function') showRollToast('Fungal Infestation', 'A 1-HP zombie rises for 1 hour', '🍄');
}
// Circle of Spores: Halo of Spores roll and the Symbiotic Entity switch.
function rollHaloOfSpores(charId) {
  const char = CHARACTERS[charId], state = getSheetState(charId);
  const m = /^(\d+)d(\d+)$/.exec((char.spores || {}).haloDie || '1d4');
  const n = parseInt(m[1], 10), sides = parseInt(m[2], 10);
  const sym = !!state.symbiotic;
  const rolls = [];
  for (let i = 0; i < (sym ? 2 : 1) * n; i++) rolls.push(1 + Math.floor(Math.random() * sides));
  const total = rolls.reduce(function(a, b) { return a + b; }, 0);
  if (typeof showRollToast === 'function') showRollToast('Halo of Spores' + (sym ? ' (Symbiotic ×2)' : ''), (sym ? '2×' : '') + char.spores.haloDie + ' Necrotic — target makes a Con save (DC ' + (char.spellcasting ? char.spellcasting.saveDc : '?') + ')', String(total) + ' [' + rolls.join('+') + ']');
}
function toggleSymbioticEntity(charId) {
  const char = CHARACTERS[charId], state = getSheetState(charId);
  if (state.symbiotic) { withSheetState(charId, function(s) { s.symbiotic = false; }); return; }
  if ((state.resources.wild_shape || 0) <= 0) { alert('No Wild Shape uses left.'); return; }
  const thp = (char.spores || {}).symbioticTempHp || 0;
  withSheetState(charId, function(s) {
    s.resources.wild_shape = Math.max(0, (s.resources.wild_shape || 0) - 1);
    s.symbiotic = true;
    s.hp.temp = Math.max(s.hp.temp || 0, thp);
  });
  if (typeof showRollToast === 'function') showRollToast('Symbiotic Entity', '+' + thp + ' temp HP · Halo rolls twice · melee +1d6 Necrotic · 10 minutes', '🍄');
}
function endAllMinions(charId) {
  if (!confirm('End all active minions?\n\nRemoves every entry from the minions list.')) return;
  withSheetState(charId, function(s) { s.minions = []; s.minionsInitialized = true; });
}
function refreshMinionStats(charId) {
  const zStats = (typeof MONSTERS_BY_ID !== 'undefined' && MONSTERS_BY_ID['zombie'])   ? MONSTERS_BY_ID['zombie']   : null;
  const sStats = (typeof MONSTERS_BY_ID !== 'undefined' && MONSTERS_BY_ID['skeleton']) ? MONSTERS_BY_ID['skeleton'] : null;
  if (!zStats && !sStats) { alert('Monster catalog not loaded. Cannot refresh.'); return; }
  let updated = 0;
  withSheetState(charId, function(s) {
    if (!s.minions) return;
    s.minions.forEach(function(m) {
      if (m.kind === 'fungal') return;   // fungal zombies always have 1 HP
      const stats = m.kind === 'skeleton' ? sStats : zStats;
      if (!stats || stats.hp == null) return;
      const newMax = stats.hp;
      if (m.hpMax !== newMax) {
        m.hpMax = newMax;
        m.hp = Math.min(m.hp, newMax);
        updated++;
      }
    });
    s.minionsInitialized = true;
  });
  if (typeof showRollToast === 'function') {
    showRollToast('Refresh stats', updated ? updated + ' minion(s) updated from catalog' : 'All minions already up-to-date', '🔄');
  }
}

// Sylas Soul Siphon rider — rolls +1d6+5 bonus and clears the charge.
function rollSiphonBonus(charId) {
  const roll = 1 + Math.floor(Math.random() * 6);
  const total = roll + 5;
  withSheetState(charId, function(s) { s.siphonCharged = false; });
  if (typeof showRollToast === 'function') {
    showRollToast('Siphon Bonus', '1d6 (' + roll + ') + 5', '+' + total + ' damage');
  } else {
    alert('Siphon bonus: 1d6 (' + roll + ') + 5 = +' + total + ' damage');
  }
}
function clearSiphonCharge(charId) {
  withSheetState(charId, function(s) { s.siphonCharged = false; });
}
function toggleSiphonCharge(charId) {
  withSheetState(charId, function(s) { s.siphonCharged = !s.siphonCharged; });
}
function bumpResource(charId, rid, delta) {
  withSheetState(charId, function(s) {
    const char = CHARACTERS[charId];
    const res = (char.resources || []).find(function(r) { return r.id === rid; });
    const max = res && typeof res.max === 'number' ? res.max : 999;
    const cur = s.resources[rid] || 0;
    s.resources[rid] = Math.max(0, Math.min(max, cur + delta));
    // Sylas homebrew: incrementing the Soul Siphon counter charges the
    // "next hit +1d6+5" rider automatically.
    if (charId === 'sylas' && rid === 'soul_siphon' && delta > 0) {
      s.siphonCharged = true;
    }
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
function setSheetPortrait(charId, url) {
  const v = String(url || '').trim();
  withSheetState(charId, function(s) { s.portraitUrl = v; });
}
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
  // Update 67 — replaced by the full ＋ Create spell form.
  if (typeof openSpellEditor === 'function') { openSpellEditor(charId, null); return; }
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
    sp = _effectiveSpell(sp);
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
      '<div style="margin-top:.25rem">' + _spellOfficialLink(sp.name) + '</div>' +
      '</div>';
  }).join('');
  const body = rows || '<div style="padding:2rem;text-align:center;color:var(--parch4);font-style:italic">No spells match. Use "＋ Create spell" for anything not in the catalog.</div>';

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
        '<button onclick="closeSpellPicker();addCustomSpellPrompt(\'' + _spellPickerCharId + '\')" style="background:rgba(160,128,64,0.15);color:var(--gold2);border:1px solid var(--gold2);border-radius:2px;padding:.35rem .8rem;font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:1px;cursor:pointer">＋ Create spell</button>' +
      '</div>' +
    '</div>';
  const s = document.getElementById('sheet-spell-picker-search');
  if (s) { s.focus(); const l = s.value.length; s.setSelectionRange(l, l); }
}
// Update 15 — Wizard Arcane Recovery. Once per Long Rest, after a Short Rest.
// Recovers slots totalling half Wizard level rounded up. No level 6+ slots.
function arcaneRecovery(charId) {
  const char = CHARACTERS[charId];
  const state = getSheetState(charId);
  if (state.arcaneRecoveryUsed) {
    alert('Arcane Recovery already used this Long Rest. Take a Long Rest to reset it.');
    return;
  }
  const wizLevel = char.level || 1;
  const budget = Math.ceil(wizLevel / 2);
  let remaining = budget;
  const slots = (char.spellcasting && char.spellcasting.slots) || [];
  const restored = {};
  while (remaining > 0) {
    const answer = prompt(
      '🔮 ARCANE RECOVERY\n\n' +
      'Budget: ' + budget + ' point(s) total (½ Wizard level, rounded up).\n' +
      'Points remaining: ' + remaining + '\n' +
      'Rule: no slot of level 6 or higher.\n\n' +
      'Which slot level to restore? (enter 1–5, or leave blank to finish)'
    );
    if (answer === null || answer.trim() === '') break;
    const lvl = parseInt(answer, 10);
    if (!lvl || lvl < 1 || lvl > 5) { alert('Invalid — must be 1 through 5.'); continue; }
    if (lvl > remaining) { alert('You only have ' + remaining + ' point(s) left; can\'t restore an L' + lvl + ' slot.'); continue; }
    const maxAtLevel = slots[lvl - 1] || 0;
    if (maxAtLevel <= 0) { alert('You don\'t have any L' + lvl + ' slots at all.'); continue; }
    const expended = state.slots[lvl] || 0;
    if (expended <= 0) { alert('No L' + lvl + ' slots are currently expended.'); continue; }
    withSheetState(charId, function(s) { s.slots[lvl] = Math.max(0, (s.slots[lvl] || 0) - 1); });
    restored[lvl] = (restored[lvl] || 0) + 1;
    remaining -= lvl;
  }
  const summary = Object.keys(restored).sort().map(l => restored[l] + '× L' + l).join(' + ') || '(nothing)';
  withSheetState(charId, function(s) { s.arcaneRecoveryUsed = true; });
  showRollToast('Arcane Recovery', 'Restored: ' + summary, '🔮');
}

function shortRest(charId) {
  const char = CHARACTERS[charId];
  const state = getSheetState(charId);
  const available = char.hitDice.max - (state.hitDiceSpent || 0);
  const currentHp = state.hp.current;
  const maxHp = char.hpMax;
  const missing = maxHp - currentHp;
  const conMod = sheetAbilityMod(char.abilities.con);

  const msg = 'Take a short rest?\n\n' +
    'This restores short-rest resources (Warlock slots, Fighter Second Wind, etc.).\n\n' +
    'Current HP: ' + currentHp + ' / ' + maxHp + (missing > 0 ? ' (missing ' + missing + ')' : ' (full)') + '\n' +
    'Hit dice available: ' + available + ' × ' + char.hitDice.die + ' (avg ~' +
    Math.max(1, Math.floor((parseInt(char.hitDice.die.slice(1), 10) + 1) / 2) + conMod) + ' HP each with CON ' + (conMod >= 0 ? '+' : '') + conMod + ')\n\n' +
    'Click OK to proceed.';
  if (!confirm(msg)) return;

  let toSpend = 0;
  if (available > 0 && missing > 0) {
    const raw = prompt('How many hit dice would you like to spend?\n\n0 = none, ' + available + ' = spend all available.', '0');
    if (raw === null) return; // cancelled
    toSpend = Math.max(0, Math.min(available, parseInt(raw, 10) || 0));
  }

  const rollDetails = [];
  let totalHealed = 0;
  const sides = parseInt(char.hitDice.die.slice(1), 10);
  withSheetState(charId, function(s) {
    // Roll each hit die
    for (let i = 0; i < toSpend; i++) {
      const roll = 1 + Math.floor(Math.random() * sides);
      const gain = Math.max(1, roll + conMod);
      rollDetails.push(char.hitDice.die + ' (' + roll + ')' + (conMod ? ' + ' + (conMod > 0 ? '+' : '') + conMod : '') + ' = ' + gain);
      s.hp.current = Math.min(char.hpMax, s.hp.current + gain);
      s.hitDiceSpent = (s.hitDiceSpent || 0) + 1;
      totalHealed += gain;
      // Stop early if already at max
      if (s.hp.current >= char.hpMax) break;
    }
    // Fungal zombies (1 hour) and Symbiotic Entity (10 minutes) are over by the end of any rest.
    if (s.minions) s.minions = s.minions.filter(function(m) { return m.kind !== 'fungal'; });
    s.symbiotic = false;
    // Restore short-rest resources
    (char.resources || []).forEach(function(r) {
      if (r.recharge === 'short') s.resources[r.id] = r.max;
      // 'shortOne' — regain one use on a Short Rest, all on a Long Rest (e.g. Wild Shape).
      if (r.recharge === 'shortOne') s.resources[r.id] = Math.min(r.max, (s.resources[r.id] || 0) + 1);
    });
  });

  const finalState = getSheetState(charId);
  const summary = toSpend > 0
    ? 'Spent ' + rollDetails.length + ' hit dice → +' + totalHealed + ' HP\n(' + rollDetails.join(', ') + ')\n\nHP now ' + finalState.hp.current + ' / ' + maxHp + '.\nShort-rest resources restored.'
    : 'No hit dice spent. Short-rest resources restored.';
  showRollToast('Short Rest', summary, toSpend > 0 ? '+' + totalHealed + ' HP' : '✦');
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
      if (r.recharge === 'short' || r.recharge === 'long' || r.recharge === 'shortOne') {
        s.resources[r.id] = r.max;
      }
    });
    const hdRecovered = Math.max(1, Math.floor(char.hitDice.max / 2));
    s.hitDiceSpent = Math.max(0, s.hitDiceSpent - hdRecovered);
    if (s.exhaustion > 0) s.exhaustion -= 1;
    // Update 12 — concentration always ends on a long rest (unconscious for hours).
    s.concentration = null;
    // Update 15 — Arcane Recovery resets on long rest.
    s.arcaneRecoveryUsed = false;
    if (s.minions) s.minions = s.minions.filter(function(m) { return m.kind !== 'fungal'; });
    s.symbiotic = false;
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
