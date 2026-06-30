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

// ----- State management (localStorage) -----
function sheetStateKey(id) { return 'eldoria-char-state-' + id; }
function loadSheetState(id) {
  try { const raw = localStorage.getItem(sheetStateKey(id)); return raw ? JSON.parse(raw) : null; }
  catch (e) { return null; }
}
function saveSheetState(id, state) {
  try { localStorage.setItem(sheetStateKey(id), JSON.stringify(state)); } catch (e) {}
}
function initSheetState(char) {
  const slots = {};
  (char.spellcasting ? char.spellcasting.slots : []).forEach((n, i) => slots[i+1] = 0);
  const resources = {};
  (char.resources || []).forEach(r => resources[r.id] = r.max);
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
  (char.resources || []).forEach(r => { if (state.resources[r.id] === undefined) state.resources[r.id] = r.max; });
  return state;
}
function withSheetState(charId, fn) {
  const state = getSheetState(charId);
  fn(state);
  saveSheetState(charId, state);
  refreshSheet(charId);
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
      '<button class="sheet-hp-btn dmg" onclick="hpDelta(\'' + charId + '\', -1)">-1</button>' +
      '<button class="sheet-hp-btn dmg" onclick="hpDelta(\'' + charId + '\', -5)">-5</button>' +
      '<button class="sheet-hp-btn dmg" onclick="hpPrompt(\'' + charId + '\', \'dmg\')">-?</button>' +
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
    let dots = '';
    if (r.max > 0) {
      for (let i = 1; i <= r.max; i++) {
        dots += '<span style="display:inline-block;width:11px;height:11px;border:1.5px solid var(--gold2);border-radius:50%;margin-right:3px;background:' + (i<=cur?'var(--gold2)':'transparent') + ';cursor:pointer" onclick="toggleResource(\'' + charId + '\',\'' + r.id + '\',' + i + ')"></span>';
      }
    } else { dots = '<span style="color:var(--parch3);font-style:italic;font-size:11px">tracked manually</span>'; }
    rows += '<div style="display:flex;justify-content:space-between;align-items:center;padding:.3rem .15rem;border-bottom:1px dashed rgba(160,128,64,0.15);gap:.5rem">' +
      '<div style="flex:1"><div style="font-family:\'Cinzel\',serif;font-size:11px;color:var(--gold2);letter-spacing:.5px">' + r.label + '</div>' +
      (r.note ? '<div style="font-size:10.5px;color:var(--parch3);font-style:italic;margin-top:.1rem">' + r.note + '</div>' : '') +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:.4rem">' + dots +
      '<span style="font-size:10px;color:var(--parch3);min-width:28px;text-align:right">' + (r.max > 0 ? (cur + '/' + r.max) : '') + '</span>' +
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
  let boxes = '';
  for (let i = 1; i <= 10; i++) {
    boxes += '<div class="sheet-ex-box ' + (i<=state.exhaustion?'on':'') + '" onclick="setExhaustion(\'' + charId + '\',' + i + ')">' + (i<=state.exhaustion?'✗':'') + '</div>';
  }
  return '<div class="sheet-sub"><div class="sheet-sub-title">Conditions</div><div class="sheet-cond-list">' + rows + '</div>' +
    '<div class="sheet-exhaustion"><strong style="font-family:\'Cinzel\',serif;font-size:10px;letter-spacing:1px;color:var(--parch3)">EXHAUSTION:</strong>' + boxes +
    '<span style="font-size:10.5px;color:var(--parch3);margin-left:.4rem">' + (state.exhaustion === 0 ? 'none' : '−' + state.exhaustion + ' to all d20 rolls') + '</span></div></div>';
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
  const eqList = (char.equipment || []).map(function(e) { return '<li style="margin-bottom:.2rem">' + e + '</li>'; }).join('');
  const attList = (char.attunements || []).map(function(a) { return '<li>' + a + '</li>'; }).join('');
  const langs = (char.languages || []).join(', ');
  const coins = char.coins || {};
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
    '<div class="sheet-sub"><div class="sheet-sub-title">Equipment</div><ul style="margin-left:1rem;color:var(--parch2);font-size:12px">' + eqList + '</ul>' +
      '<div style="margin-top:.5rem"><strong style="font-family:\'Cinzel\',serif;color:var(--parch3);font-size:10px;letter-spacing:1px">ATTUNEMENTS (max 3):</strong>' +
      '<ul style="margin-left:1rem;color:var(--parch2);font-size:12px">' + attList + '</ul></div>' +
      '<div style="display:flex;gap:.5rem;margin-top:.6rem;font-size:11px;color:var(--parch3);font-family:\'Cinzel\',serif"><span>CP ' + (coins.cp||0) + '</span><span>SP ' + (coins.sp||0) + '</span><span>EP ' + (coins.ep||0) + '</span><span>GP ' + (coins.gp||0) + '</span><span>PP ' + (coins.pp||0) + '</span></div>' +
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
