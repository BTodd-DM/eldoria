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
  if (!state.currency) {
    state.currency = Object.assign({ cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }, char.coins || {});
  }
  if (state.editMode === undefined) state.editMode = false;
  return state;
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
      let nameHtml;
      if (!item.custom && catalogLoaded && ITEMS_BY_ID[item.sourceItemId]) {
        const catItem = ITEMS_BY_ID[item.sourceItemId];
        nameHtml = '<span title="' + _sheetEscapeAttr(catItem.description + '\n\n' + (catItem.source || '')) + '" style="cursor:help;border-bottom:1px dotted var(--gold2)">' + _sheetEscapeAttr(item.name) + '</span>';
      } else {
        nameHtml = _sheetEscapeAttr(item.name);
      }
      const qty = editing
        ? '<input type="number" min="1" step="1" value="' + (item.quantity || 1) + '" onchange="updateInventoryItem(\'' + charId + '\',' + i + ',\'quantity\',this.value)" onkeydown="if(event.key===\'Enter\')this.blur()" style="width:5ch;text-align:center;background:rgba(10,8,5,0.7);border:1px solid rgba(160,128,64,0.3);color:var(--parch);padding:2px;border-radius:2px;font-size:11px">'
        : String(item.quantity || 1);
      const notes = editing
        ? '<input type="text" value="' + _sheetEscapeAttr(item.notes || '') + '" onchange="updateInventoryItem(\'' + charId + '\',' + i + ',\'notes\',this.value)" placeholder="notes" style="width:100%;background:rgba(10,8,5,0.7);border:1px solid rgba(160,128,64,0.3);color:var(--parch);padding:2px 4px;border-radius:2px;font-size:11px">'
        : (item.notes ? '<span style="font-style:italic;color:var(--parch3)">' + _sheetEscapeAttr(item.notes) + '</span>' : '');
      const removeCell = editing
        ? '<td style="text-align:center;padding:.15rem"><button onclick="removeInventoryItem(\'' + charId + '\',' + i + ')" style="background:transparent;border:1px solid var(--red2);color:var(--red2);border-radius:2px;padding:1px 6px;cursor:pointer;font-size:10px" title="Remove">✕</button></td>'
        : '';
      rows += '<tr style="border-bottom:1px dashed rgba(160,128,64,0.1)">' +
        '<td style="font-size:12px;color:var(--parch2);padding:.2rem .3rem .2rem 0">' + nameHtml + '</td>' +
        '<td style="text-align:center;font-size:12px;color:var(--parch2);padding:.2rem;width:5ch">' + qty + '</td>' +
        '<td style="font-size:11px;color:var(--parch3);padding:.2rem">' + notes + '</td>' +
        removeCell + '</tr>';
    });
  }
  const header = '<tr style="border-bottom:1px solid rgba(160,128,64,0.3)">' +
    '<th style="text-align:left;font-family:\'Cinzel\',serif;font-size:10px;color:var(--gold2);padding:.2rem .3rem .2rem 0;letter-spacing:1px">Item</th>' +
    '<th style="text-align:center;font-family:\'Cinzel\',serif;font-size:10px;color:var(--gold2);padding:.2rem;letter-spacing:1px">Qty</th>' +
    '<th style="text-align:left;font-family:\'Cinzel\',serif;font-size:10px;color:var(--gold2);padding:.2rem;letter-spacing:1px">Notes</th>' +
    (editing ? '<th style="width:3ch"></th>' : '') +
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
  html += '<div class="sheet-rest-row">';
  html += '<button class="sheet-rest-btn" onclick="shortRest(\'' + charId + '\')">Short Rest</button>';
  html += '<button class="sheet-rest-btn" onclick="longRest(\'' + charId + '\')">Long Rest</button>';
  html += '</div>';
  html += '</div>';

  html += '<div>';
  html += renderWeaponsSection(charId, char);
  html += renderResourcesSection(charId, char, state);
  html += renderFeaturesSection(char);
  html += renderConditionsSection(charId, state);
  html += '</div>';

  html += '<div>';
  if (char.spellcasting) html += renderSpellsSection(charId, char, state);
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
  let rows = '';
  (char.weapons || []).forEach(function(w, i) {
    rows += '<tr><td>' + w.name + '</td><td>' + sheetFmtMod(w.atk) + '</td><td>' + w.damage + '</td><td>' + (w.notes||'') + '</td><td><button class="sheet-weapon-roll" onclick="rollWeapon(\'' + charId + '\',' + i + ')">Roll</button></td></tr>';
  });
  return '<div class="sheet-sub"><div class="sheet-sub-title">Weapons & Damage Cantrips</div><table class="sheet-weapon-table"><thead><tr><th>Name</th><th>Atk</th><th>Damage</th><th>Notes</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
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
  let spellHtml = '';
  (char.spells || []).forEach(function(sp, i) {
    const tags = sp.tags || [];
    let tagSpans = '';
    if (tags.indexOf('concentration') >= 0) tagSpans += '<span class="spell-tag conc">C</span>';
    if (tags.indexOf('ritual') >= 0) tagSpans += '<span class="spell-tag">R</span>';
    if (tags.indexOf('reaction') >= 0) tagSpans += '<span class="spell-tag">React</span>';
    if (tags.indexOf('mastery') >= 0) tagSpans += '<span class="spell-tag">Mastery</span>';
    if (tags.indexOf('signature') >= 0) tagSpans += '<span class="spell-tag sig">Signature</span>';
    const sigRow = tags.indexOf('signature') >= 0 ? 'signature' : '';
    const isCantrip = sp.level === 0;
    const isFree = tags.indexOf('signature') >= 0 || tags.indexOf('mastery') >= 0;
    const canCast = isCantrip || isFree || ((sc.slots[sp.level-1] || 0) - (state.slots[sp.level] || 0)) > 0;
    spellHtml += '<div class="sheet-spell-row ' + sigRow + '" onclick="toggleSpellDetail(' + i + ')">' +
      '<div class="sheet-spell-level">' + (isCantrip ? '0' : sp.level) + '</div>' +
      '<div class="sheet-spell-name">' + sp.name + tagSpans + '</div>' +
      (isCantrip ? '<span style="font-size:9.5px;color:var(--parch4);font-style:italic">at will</span>' :
        '<button class="sheet-spell-cast" onclick="event.stopPropagation();castSpell(\'' + charId + '\',' + i + ')" ' + (canCast?'':'disabled') + '>Cast L' + sp.level + '</button>') +
    '</div>' +
    '<div class="sheet-spell-detail" id="spell-detail-' + i + '" style="display:none">' +
      '<strong>' + (sp.school||'') + ' · ' + (isCantrip ? 'Cantrip' : 'L' + sp.level) + ' · ' + (sp.cast||'') + ' · Range ' + (sp.range||'—') + '</strong><br>' +
      sp.desc +
    '</div>';
  });
  return '<div class="sheet-sub"><div class="sheet-sub-title">Spellcasting — ' + sc.ability + ' · Save DC ' + sc.saveDC + ' · Atk ' + sheetFmtMod(sc.attackBonus) + '</div>' +
    '<div class="sheet-slots-row">' + slotHtml + '</div>' +
    '<div class="sheet-spell-list">' + spellHtml + '</div></div>';
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
  return '<div class="sheet-sub"><div class="sheet-sub-title">Languages</div><div style="font-size:12px;color:var(--parch2)">' + langs + '</div></div>' +
    '<div class="sheet-sub"><div class="sheet-sub-title">Equipment Training & Proficiencies</div>' + trainHtml + '</div>' +
    '<div class="sheet-sub"><div class="sheet-sub-title">Attunements (max 3)</div>' +
      '<ul style="margin-left:1rem;color:var(--parch2);font-size:12px">' + attList + '</ul>' +
      '<div style="font-size:10px;color:var(--parch4);font-style:italic;margin-top:.3rem">Attunement management arrives in a later update.</div>' +
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
    '<div class="sheet-sub"><div class="sheet-sub-title">DM Notes</div><textarea class="sheet-notes-area" oninput="setSheetNotes(\'' + charId + '\', this.value)" placeholder="Combat notes, observations, anything…">' + (state.notes || '') + '</textarea></div>';
}

// ----- State mutators -----
function hpDelta(charId, amt) {
  withSheetState(charId, function(s) {
    const max = CHARACTERS[charId].hpMax;
    if (amt < 0 && s.hp.temp > 0) {
      const tempLoss = Math.min(s.hp.temp, -amt);
      s.hp.temp -= tempLoss; amt += tempLoss;
    }
    s.hp.current = Math.max(0, Math.min(max, s.hp.current + amt));
  });
}
function hpPrompt(charId, kind) {
  const amt = parseInt(prompt(kind === 'dmg' ? 'Damage amount?' : 'Healing amount?'));
  if (!isNaN(amt) && amt > 0) hpDelta(charId, kind === 'dmg' ? -amt : amt);
}
function setHpCurrent(charId, val) { const n = parseInt(val); if (!isNaN(n)) withSheetState(charId, function(s) { s.hp.current = Math.max(0, Math.min(CHARACTERS[charId].hpMax, n)); }); }
function setHpTemp(charId, val) { const n = parseInt(val); if (!isNaN(n)) withSheetState(charId, function(s) { s.hp.temp = Math.max(0, n); }); }
function toggleDeathSave(charId, kind, n) { withSheetState(charId, function(s) { if (s.deathSaves[kind] >= n) s.deathSaves[kind] = n - 1; else s.deathSaves[kind] = n; }); }
function toggleSlot(charId, lvl, n) { withSheetState(charId, function(s) { if ((s.slots[lvl] || 0) >= n) s.slots[lvl] = n - 1; else s.slots[lvl] = n; }); }
function castSpell(charId, idx) {
  const char = CHARACTERS[charId];
  const sp = char.spells[idx];
  if (sp.level === 0) { showRollToast('Cantrip cast', sp.name, '✦'); return; }
  const tags = sp.tags || [];
  if (tags.indexOf('signature') >= 0 || tags.indexOf('mastery') >= 0) {
    showRollToast('Cast (free use)', sp.name + ' — uses signature/mastery slot', '✦');
    return;
  }
  const state = getSheetState(charId);
  const max = char.spellcasting.slots[sp.level - 1] || 0;
  const expended = state.slots[sp.level] || 0;
  if (expended >= max) { alert('No L' + sp.level + ' slots remaining.'); return; }
  withSheetState(charId, function(s) { s.slots[sp.level] = (s.slots[sp.level] || 0) + 1; });
  showRollToast('Cast L' + sp.level, sp.name, '✦');
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
function toggleSpellDetail(idx) { const el = document.getElementById('spell-detail-' + idx); if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none'; }
function shortRest(charId) {
  withSheetState(charId, function(s) {
    (CHARACTERS[charId].resources || []).forEach(function(r) { if (r.recharge === 'short') s.resources[r.id] = r.max; });
  });
  showRollToast('Short Rest', 'Short-rest resources restored', '✦');
}
function longRest(charId) {
  const char = CHARACTERS[charId];
  withSheetState(charId, function(s) {
    s.hp.current = char.hpMax;
    s.hp.temp = 0;
    s.deathSaves = { successes: 0, failures: 0 };
    Object.keys(s.slots).forEach(function(k) { s.slots[k] = 0; });
    (char.resources || []).forEach(function(r) { s.resources[r.id] = r.max; });
    const hdRecovered = Math.max(1, Math.floor(char.hitDice.max / 2));
    s.hitDiceSpent = Math.max(0, s.hitDiceSpent - hdRecovered);
    if (s.exhaustion > 0) s.exhaustion -= 1;
  });
  showRollToast('Long Rest', 'HP, slots, resources restored', '✦');
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
function rollAbility(charId, abil) {
  const char = CHARACTERS[charId];
  const mod = sheetAbilityMod(char.abilities[abil]);
  const exh = getSheetState(charId).exhaustion || 0;
  const roll = sheetRollD20();
  const total = roll + mod - exh;
  const label = { str:'Strength', dex:'Dexterity', con:'Constitution', int:'Intelligence', wis:'Wisdom', cha:'Charisma' }[abil] + ' Check';
  showRollToast(label, 'd20 (' + roll + ') ' + sheetFmtMod(mod) + (exh ? ' − ' + exh + ' exh' : ''), total, { crit: roll === 20, fumble: roll === 1 });
}
function rollSave(charId, abil) {
  const char = CHARACTERS[charId];
  const mod = sheetGetSaveMod(char, abil);
  const exh = getSheetState(charId).exhaustion || 0;
  const roll = sheetRollD20();
  const total = roll + mod - exh;
  showRollToast(abil.toUpperCase() + ' Saving Throw', 'd20 (' + roll + ') ' + sheetFmtMod(mod) + (exh ? ' − ' + exh + ' exh' : ''), total, { crit: roll === 20, fumble: roll === 1 });
}
function rollSkill(charId, sk) {
  const char = CHARACTERS[charId];
  const mod = sheetGetSkillMod(char, sk);
  const exh = getSheetState(charId).exhaustion || 0;
  const roll = sheetRollD20();
  const total = roll + mod - exh;
  showRollToast(SHEET_SKILL_LABELS[sk] + ' Check', 'd20 (' + roll + ') ' + sheetFmtMod(mod) + (exh ? ' − ' + exh + ' exh' : ''), total, { crit: roll === 20, fumble: roll === 1 });
}
function rollInitiative(charId) {
  const char = CHARACTERS[charId];
  const roll = sheetRollD20();
  const total = roll + char.initiative;
  showRollToast('Initiative', 'd20 (' + roll + ') ' + sheetFmtMod(char.initiative), total, { crit: roll === 20, fumble: roll === 1 });
}
function rollWeapon(charId, idx) {
  const char = CHARACTERS[charId];
  const w = char.weapons[idx];
  const atkRoll = sheetRollD20();
  const atkTotal = atkRoll + w.atk;
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
  showRollToast(w.name + ' Attack', 'Atk d20 (' + atkRoll + ') ' + sheetFmtMod(w.atk) + ' = ' + atkTotal + ' · Dmg: ' + dmgStr, atkTotal + ' hit / ' + dmgStr, { crit: atkRoll === 20, fumble: atkRoll === 1 });
}
