// =====================================================================
// THE WAYWARD COMPANY — CHARACTER BUILDER (Update 61b; levels 1–20 + Level up mode in Update 66)
// ---------------------------------------------------------------------
// Player-site builder. Steps (2024 PHB order): class → background →
// species → ability scores → level 1 → each level up to the target →
// prepared spells → equipment → details → review.
//
// Finish writes three Firebase nodes (all covered by the existing
// /characters/$charId rule):
//   /characters/<id>-definition  — CHARACTERS-shaped block the sheet reads
//   /characters/<id>-build       — the raw choices (for the level-up wizard)
//   /characters/<id>             — a fresh live sheet state
// The previous definition, if any, is kept at /characters/<id>-definition-prev.
//
// Data: classes-2024.js, origins-2024.js, beasts-2024.js, spells-2024.js,
// items-2024.js. All rules text is our own summary.
// =====================================================================
(function() {
  'use strict';

  const CLS = CLASSES_2024.druid;
  const SUB = CLS.subclasses.land;
  const app = document.getElementById('app');

  let TARGET = null;      // character id being built (e.g. 'tristan')
  let IDENT = null;       // logged-in identity
  let hasExisting = false;
  let savedBuild = null;   // choices from /characters/<id>-build, if any
  let MODE = 'new';        // 'new' or 'levelup'
  let step = 0;
  let saving = false;

  // ---- Builder state (persisted as a per-device draft) ----------------
  const PARTY_LEVEL = 6;   // new characters default to the party's level
  const B = {
    level: PARTY_LEVEL,
    bg: null, bgMode: '2-1', bgPlus2: null, bgPlus1: null,
    species: null, size: null, speciesChoice: {}, speciesAbility: 'wis', speciesSkill: null,
    humanFeat: null,
    fc: {},                       // feat choices keyed by slot: 'bg', 'human', 'asi4', 'asi8', … 'asi19'
    rolls: ['', '', '', '', '', ''], assign: {},
    order: null, classSkills: [], cantrips1: [],
    cantripsAt: {},               // level → [cantrip names] (levels 4 and 10)
    hp: {},                       // level → { mode: 'avg'|'roll', roll }
    formsAt: {},                  // level → [beast ids] (levels 2, 4, 8)
    land: null,
    asi: {},                      // level → { feat, asiMode, a1, a2, asi } (4, 8, 12, 16, and 19 = Epic Boon)
    fury: null,                   // level 7 Elemental Fury choice
    builtLevel: 0,                // > 0 in Level up mode: the level already built
    prepared: [],
    equipClass: 'a', equipBg: 'a',
    languages: ['', ''],
    name: '', age: '', alignment: '', appearance: '', personality: '', backstory: ''
  };

  // ---- Small helpers ---------------------------------------------------
  const esc = function(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); };
  const mod = function(n) { return Math.floor((n - 10) / 2); };
  const fmt = function(n) { return (n >= 0 ? '+' : '') + n; };
  const tbl = function(l) { return CLS.table[l || B.level]; };
  const pb = function() { return tbl().pb; };
  const species = function() { return B.species ? SPECIES_2024[B.species] : null; };
  const bg = function() { return B.bg ? BACKGROUNDS_2024[B.bg] : null; };
  const spellByName = {};
  SPELLS_2024.forEach(function(s) { spellByName[s.name.toLowerCase()] = s; });
  const classSpells = function(list) { return SPELLS_2024.filter(function(s) { return (s.classes || []).indexOf(list) !== -1; }); };
  const crLabel = function(n) { return n === 0.125 ? '1/8' : n === 0.25 ? '1/4' : n === 0.5 ? '1/2' : String(n); };

  function draftKey() { return 'eldoria-builder-draft-' + TARGET; }
  function saveDraft() { try { localStorage.setItem(draftKey(), JSON.stringify({ B: B, step: step, mode: MODE })); } catch (e) {} }
  function loadDraft() {
    try {
      const raw = localStorage.getItem(draftKey());
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d && d.B) { applyChoices(d.B); step = d.step || 0; if (d.mode) MODE = d.mode; }
    } catch (e) {}
  }
  // Copy saved choices into B, upgrading the level-1–6 format from Update 61b.
  function applyChoices(src) {
    Object.keys(src).forEach(function(k) { if (k in B) B[k] = src[k]; });
    if (src.l4) { B.asi = B.asi || {}; if (!B.asi[4]) B.asi[4] = src.l4; if (B.fc && B.fc.l4 && !B.fc.asi4) B.fc.asi4 = B.fc.l4; }
    if (src.cantrips4 && !(B.cantripsAt && B.cantripsAt[4])) { B.cantripsAt = B.cantripsAt || {}; B.cantripsAt[4] = src.cantrips4; }
    if (src.forms2 || src.forms4) { B.formsAt = B.formsAt || {}; if (src.forms2 && !B.formsAt[2]) B.formsAt[2] = src.forms2; if (src.forms4 && !B.formsAt[4]) B.formsAt[4] = src.forms4; }
    ['cantripsAt', 'formsAt', 'asi', 'hp', 'fc', 'speciesChoice', 'assign'].forEach(function(k) {
      if (!B[k] || typeof B[k] !== 'object' || Array.isArray(B[k]) && k !== 'rolls') B[k] = B[k] && typeof B[k] === 'object' ? Object.assign({}, B[k]) : {};
    });
  }
  // Path helper for nested arrays such as 'cantripsAt.10' or 'formsAt.8'.
  function arrAt(path) {
    const parts = String(path).split('.');
    let o = B;
    for (let i = 0; i < parts.length - 1; i++) { if (!o[parts[i]] || typeof o[parts[i]] !== 'object') o[parts[i]] = {}; o = o[parts[i]]; }
    const last = parts[parts.length - 1];
    if (!Array.isArray(o[last])) o[last] = [];
    return o[last];
  }
  const asiLevels = function() { return CLS.asiLevels.concat([CLS.epicBoonLevel]).filter(function(l) { return l <= B.level; }); };
  const asiOf = function(l) { return B.asi[l] || (B.asi[l] = { feat: null, asiMode: '2', a1: null, a2: null, asi: null }); };
  const formsUpTo = function(L) { return Object.keys(CLS.formLevels).map(Number).filter(function(l) { return l <= L; }).reduce(function(a, l) { return a.concat(B.formsAt[l] || []); }, []); };
  const cantripsUpTo = function(L) { return Object.keys(CLS.cantripLevels).map(Number).filter(function(l) { return l <= L; }).reduce(function(a, l) { return a.concat(B.cantripsAt[l] || []); }, B.cantrips1.slice()); };

  // ---- Derived values --------------------------------------------------
  function featSlots() {
    const out = [];
    const b = bg();
    if (b) out.push({ slot: 'bg', key: b.feat, list: b.featList || null, label: b.name + ' background' });
    const s = species();
    if (s && s.originFeat && B.humanFeat) out.push({ slot: 'human', key: B.humanFeat, list: null, label: 'Human — Versatile' });
    asiLevels().forEach(function(l) {
      const a = B.asi[l];
      if (a && a.feat && a.feat !== 'abilityScoreImprovement') out.push({ slot: 'asi' + l, key: a.feat, list: null, label: (l === CLS.epicBoonLevel ? 'Epic Boon, level ' : 'Level ') + l, level: l });
    });
    return out;
  }
  function hasFeat(key) { return featSlots().some(function(f) { return f.key === key; }); }

  function baseScores() {
    const out = {};
    ABILITY_KEYS.forEach(function(a) {
      const i = B.assign[a];
      const v = (i !== undefined && i !== null && i !== '') ? parseInt(B.rolls[i], 10) : NaN;
      out[a] = isNaN(v) ? null : v;
    });
    return out;
  }
  function bonuses() {
    const b = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
    const g = bg();
    if (g) {
      if (B.bgMode === '1-1-1') g.abilities.forEach(function(a) { b[a] += 1; });
      else { if (B.bgPlus2) b[B.bgPlus2] += 2; if (B.bgPlus1) b[B.bgPlus1] += 1; }
    }
    asiLevels().forEach(function(l) {
      if (l === CLS.epicBoonLevel) return;                 // Epic Boon counted separately (cap 30)
      const a = B.asi[l]; if (!a || !a.feat) return;
      if (a.feat === 'abilityScoreImprovement') {
        if (a.asiMode === '2' && a.a1) b[a.a1] += 2;
        if (a.asiMode === '1-1') { if (a.a1) b[a.a1] += 1; if (a.a2) b[a.a2] += 1; }
      } else {
        const f = FEATS_2024[a.feat];
        if (f && (f.asiFrom || f.asiFromChoice) && a.asi) b[a.asi] += 1;
      }
    });
    return b;
  }
  function epicBonus() {
    const e = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
    const a = B.level >= CLS.epicBoonLevel ? B.asi[CLS.epicBoonLevel] : null;
    if (a && a.feat && a.asi) e[a.asi] += 1;
    return e;
  }
  function scores() {
    const base = baseScores(), bon = bonuses(), out = {};
    const epic = epicBonus();
    ABILITY_KEYS.forEach(function(a) { out[a] = base[a] === null ? null : Math.min(30, Math.min(20, base[a] + bon[a]) + epic[a]); });
    return out;
  }
  function conMod() { const s = scores(); return s.con === null ? 0 : mod(s.con); }

  function hpMax() {
    const c = conMod();
    let total = CLS.hitDie + c;
    for (let l = 2; l <= B.level; l++) {
      const h = B.hp[l] || { mode: 'avg' };
      const v = h.mode === 'roll' ? Math.max(1, Math.min(CLS.hitDie, parseInt(h.roll, 10) || 0)) : (CLS.hitDie / 2 + 1);
      total += Math.max(1, v + c);
    }
    const s = species();
    if (s && s.hpPerLevel) total += s.hpPerLevel * B.level;
    if (hasFeat('tough')) total += 2 * B.level;
    return total;
  }

  function skillMap() {
    // skill → source label (first source wins)
    const m = {};
    const add = function(k, src) { if (k && !m[k]) m[k] = src; };
    const g = bg(); if (g) g.skills.forEach(function(k) { add(k, g.name); });
    const s = species();
    if (s && s.skillChoice && B.speciesSkill) add(B.speciesSkill, s.name);
    B.classSkills.forEach(function(k) { add(k, 'Druid'); });
    featSlots().forEach(function(f) {
      const c = B.fc[f.slot] || {};
      if (f.key === 'skilled') (c.skills || []).forEach(function(k) { add(k, 'Skilled'); });
      if (f.key === 'observant' && c.pick) add(c.pick, 'Observant');
    });
    return m;
  }

  function landSpellNames() {
    if (B.level < 3 || !B.land) return [];
    return SUB.spellsByLand[B.land].filter(function(s) { return s.minLevel <= B.level; }).map(function(s) { return s.name; });
  }
  // Spells that are free (always prepared or known from origin/feat) — excluded from the prepare list.
  function alwaysPreparedList() {
    const out = [{ name: 'Speak with Animals', reason: 'Druidic' }];
    landSpellNames().forEach(function(n) { out.push({ name: n, reason: 'Circle of the Land (' + SUB.landLabels[B.land] + ')' }); });
    const s = species();
    if (s) {
      (s.cantrips || []).forEach(function(n) { out.push({ name: n, reason: s.name }); });
      (s.choices || []).forEach(function(ch) {
        const o = ch.options[B.speciesChoice[ch.id]];
        if (!o) return;
        const why = s.name + ' — ' + o.name;
        if (o.cantrip) out.push({ name: o.cantrip, reason: why });
        if (o.cantrip2) out.push({ name: o.cantrip2, reason: why });
        Object.keys(o.spells || {}).forEach(function(lv) { if (B.level >= +lv) out.push({ name: o.spells[lv], reason: why }); });
        (o.alwaysPrepared || []).forEach(function(n) { out.push({ name: n, reason: why }); });
      });
    }
    featSlots().forEach(function(f) {
      const feat = FEATS_2024[f.key]; const c = B.fc[f.slot] || {};
      if (f.key === 'magicInitiate') {
        const why = 'Magic Initiate (' + cap(c.list || f.list || '') + ')';
        (c.cantrips || []).forEach(function(n) { out.push({ name: n, reason: why }); });
        if (c.spell) out.push({ name: c.spell, reason: why });
      }
      (feat.alwaysPrepared || []).forEach(function(n) { out.push({ name: n, reason: feat.name }); });
    });
    // One entry per spell (e.g. Forest Gnome + Druidic both grant Speak with Animals).
    const seen = {};
    return out.filter(function(x) { const k = x.name.toLowerCase(); if (seen[k]) return false; seen[k] = true; return true; });
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  // ---- Steps -------------------------------------------------------------
  function stepList() {
    if (MODE === 'levelup') {
      const s = [{ id: 'class', label: 'Level up' }];
      for (let l = B.builtLevel + 1; l <= B.level; l++) s.push({ id: 'L' + l, label: 'Level ' + l });
      s.push({ id: 'spells', label: 'Spells' }, { id: 'review', label: 'Review' });
      return s;
    }
    const s = [
      { id: 'class', label: 'Class' }, { id: 'background', label: 'Background' }, { id: 'species', label: 'Species' },
      { id: 'abilities', label: 'Ability Scores' }, { id: 'L1', label: 'Level 1' }
    ];
    for (let l = 2; l <= B.level; l++) s.push({ id: 'L' + l, label: 'Level ' + l });
    s.push({ id: 'spells', label: 'Spells' }, { id: 'equipment', label: 'Equipment' }, { id: 'details', label: 'Details' }, { id: 'review', label: 'Review' });
    return s;
  }

  // Missing-items check per step. Empty array = complete.
  function missing(id) {
    const m = [];
    const s = species(), g = bg();
    if (id === 'class') { /* druid preselected */ }
    if (id === 'background') {
      if (!g) m.push('Pick a background');
      else {
        if (B.bgMode === '2-1' && (!B.bgPlus2 || !B.bgPlus1 || B.bgPlus2 === B.bgPlus1)) m.push('Choose which score gets +2 and which gets +1');
        m.push.apply(m, featMissing('bg', g.feat, g.featList));
      }
    }
    if (id === 'species') {
      if (!s) m.push('Pick a species');
      else {
        if (s.sizes.length > 1 && !B.size) m.push('Choose a size');
        (s.choices || []).forEach(function(ch) { if (!B.speciesChoice[ch.id]) m.push('Choose: ' + ch.label); });
        if (s.skillChoice && !B.speciesSkill) m.push('Choose: ' + s.skillChoice.label);
        if (s.originFeat) { if (!B.humanFeat) m.push('Choose an Origin feat'); else m.push.apply(m, featMissing('human', B.humanFeat, null)); }
      }
    }
    if (id === 'abilities') {
      const nums = B.rolls.map(function(r) { return parseInt(r, 10); });
      if (nums.some(function(n) { return isNaN(n) || n < 3 || n > 18; })) m.push('Enter all six rolled numbers (3–18)');
      const used = ABILITY_KEYS.map(function(a) { return B.assign[a]; }).filter(function(v) { return v !== undefined && v !== null && v !== ''; });
      if (used.length < 6) m.push('Assign every number to an ability');
      else if (new Set(used.map(String)).size < 6) m.push('Use each rolled number once');
    }
    if (id === 'L1') {
      if (!B.order) m.push('Choose a Primal Order');
      if (B.classSkills.length !== CLS.skillChoices.count) m.push('Choose ' + CLS.skillChoices.count + ' Druid skills');
      const need = CLS.table[1].cantrips + (B.order === 'magician' ? 1 : 0);
      if (B.cantrips1.length !== need) m.push('Choose ' + need + ' cantrips');
    }
    if (/^L\d+$/.test(id) && id !== 'L1') m.push.apply(m, levelMissing(parseInt(id.slice(1), 10)));
    if (id === 'class' && MODE === 'levelup' && B.level <= B.builtLevel) m.push('Choose a higher level');
    if (id === 'spells') {
      const need = tbl().prepared;
      if (B.prepared.length !== need) m.push('Prepare ' + need + ' spells (' + B.prepared.length + ' chosen)');
    }
    if (id === 'details') {
      if (!B.name.trim()) m.push('Give your character a name');
      if (!B.alignment) m.push('Choose an alignment');
      if (!B.languages[0] || !B.languages[1] || B.languages[0] === B.languages[1]) m.push('Choose two different languages');
    }
    if (id === 'review') {
      stepList().forEach(function(st) { if (st.id !== 'review' && missing(st.id).length) m.push('Finish the ' + st.label + ' step'); });
    }
    return m;
  }

  function levelMissing(l) {
    const m = [];
    const h = B.hp[l];
    if (h && h.mode === 'roll') { const r = parseInt(h.roll, 10); if (isNaN(r) || r < 1 || r > CLS.hitDie) m.push('Enter your HP roll (1–' + CLS.hitDie + ')'); }
    if (CLS.formLevels[l] && (B.formsAt[l] || []).length !== CLS.formLevels[l]) m.push('Choose ' + CLS.formLevels[l] + ' Wild Shape form' + (CLS.formLevels[l] > 1 ? 's' : ''));
    if (l === SUB.level && !B.land) m.push('Choose a land');
    if (l === 7 && !B.fury) m.push('Choose an Elemental Fury');
    if (CLS.cantripLevels[l] && (B.cantripsAt[l] || []).length !== CLS.cantripLevels[l]) m.push('Choose ' + CLS.cantripLevels[l] + ' new cantrip');
    if (CLS.asiLevels.indexOf(l) !== -1 || l === CLS.epicBoonLevel) {
      const a = asiOf(l);
      if (!a.feat) m.push(l === CLS.epicBoonLevel ? 'Choose an Epic Boon' : 'Choose Ability Score Improvement or a feat');
      else if (a.feat === 'abilityScoreImprovement') {
        if (!a.a1 || (a.asiMode === '1-1' && (!a.a2 || a.a2 === a.a1))) m.push('Choose which scores increase');
      } else {
        const f = FEATS_2024[a.feat];
        if (f && (f.asiFrom || f.asiFromChoice) && !a.asi) m.push('Choose the +1 ability for ' + f.name);
        m.push.apply(m, featMissing('asi' + l, a.feat, null));
      }
    }
    return m;
  }
  function featMissing(slot, key, fixedList) {
    const f = FEATS_2024[key]; const c = B.fc[slot] || {}; const m = [];
    if (!f || !f.choice) return m;
    const t = f.choice.type;
    if (t === 'text' && !(c.text || '').trim()) m.push(f.name + ': ' + f.choice.label);
    if (t === 'skills' && (c.skills || []).length !== f.choice.count) m.push(f.name + ': choose ' + f.choice.count + ' skills');
    if (t === 'pick' && !c.pick) m.push(f.name + ': ' + f.choice.label);
    if (t === 'custom' && (!(c.name || '').trim() || !(c.desc || '').trim())) m.push('Type the feat name and summary');
    if (t === 'magicInitiate') {
      if (!(fixedList || c.list)) m.push('Magic Initiate: choose a spell list');
      if ((c.cantrips || []).length !== 2) m.push('Magic Initiate: choose 2 cantrips');
      if (!c.spell) m.push('Magic Initiate: choose a level 1 spell');
    }
    return m;
  }

  // ---- Rendering primitives --------------------------------------------
  function cardHtml(on, title, sub, attrs, off) {
    return '<div class="card' + (on ? ' on' : '') + (off ? ' off' : '') + '" ' + (attrs || '') + '><div class="t">' + title + '</div>' + (sub ? '<div class="s">' + sub + '</div>' : '') + '</div>';
  }
  function chk(on, label, attrs, dis) {
    return '<span class="chk' + (on ? ' on' : '') + (dis ? ' dis' : '') + '" ' + (dis ? '' : (attrs || '')) + '>' + (on ? '☑' : '☐') + ' ' + label + '</span>';
  }
  function abilitySelect(attr, val, from, placeholder) {
    return '<select ' + attr + '><option value="">' + (placeholder || '—') + '</option>' + (from || ABILITY_KEYS).map(function(a) {
      return '<option value="' + a + '"' + (val === a ? ' selected' : '') + '>' + ABILITY_NAMES[a] + '</option>';
    }).join('') + '</select>';
  }
  function featureHtml(name, desc) { return '<div class="feature"><div class="n">' + name + '</div><div class="d">' + desc + '</div></div>'; }
  function spellChip(sp, on, dis, attrs) {
    if (typeof _effectiveSpell === 'function') sp = _effectiveSpell(sp);
    return '<span class="spell' + (on ? ' on' : '') + (dis ? ' dis' : '') + '" ' + (dis ? '' : attrs) + ' title="' + esc(sp.description || '') + '">' +
      (on ? '☑' : '☐') + ' ' + esc(sp.name) + ' <small>' + (sp.concentration ? 'C ' : '') + (sp.ritual ? 'R' : '') + '</small>' +
      (typeof _spellOfficialLink === 'function' ? _spellOfficialLink(sp.name, true) : '') + '</span>';
  }

  function featChoiceHtml(slot, key, fixedList) {
    const f = FEATS_2024[key]; if (!f) return '';
    const c = B.fc[slot] || (B.fc[slot] = {});
    let h = featureHtml(f.name, f.desc);
    if (!f.choice) return h;
    const t = f.choice.type;
    if (t === 'text') h += '<div class="row"><label class="lbl">' + f.choice.label + '</label><input type="text" data-fc="' + slot + '" data-k="text" value="' + esc(c.text || '') + '" style="flex:1"></div>';
    if (t === 'custom') h += '<div class="row"><input type="text" data-fc="' + slot + '" data-k="name" placeholder="Feat name" value="' + esc(c.name || '') + '"><input type="text" data-fc="' + slot + '" data-k="desc" placeholder="One-line summary" value="' + esc(c.desc || '') + '" style="flex:1"></div>';
    if (t === 'pick') {
      h += '<div class="row"><label class="lbl">' + f.choice.label + '</label><select data-fc="' + slot + '" data-k="pick"><option value="">—</option>' + f.choice.options.map(function(o) {
        const lbl = f.choice.skill ? SKILL_NAMES[o] : o;
        return '<option value="' + o + '"' + (c.pick === o ? ' selected' : '') + '>' + lbl + '</option>';
      }).join('') + '</select></div>';
    }
    if (t === 'skills') {
      const chosen = c.skills || [];
      h += '<div class="row">' + Object.keys(SKILL_NAMES).map(function(k) {
        const on = chosen.indexOf(k) !== -1;
        return chk(on, SKILL_NAMES[k], 'data-fcskill="' + slot + '" data-v="' + k + '" data-max="' + f.choice.count + '"', !on && chosen.length >= f.choice.count);
      }).join('') + '</div>';
    }
    if (t === 'magicInitiate') {
      const list = fixedList || c.list;
      if (!fixedList) {
        h += '<div class="row"><label class="lbl">Spell list</label><select data-fc="' + slot + '" data-k="list" data-reset="cantrips,spell"><option value="">—</option>' +
          ['cleric', 'druid', 'wizard'].map(function(l) { return '<option value="' + l + '"' + (c.list === l ? ' selected' : '') + '>' + cap(l) + '</option>'; }).join('') + '</select></div>';
      } else {
        h += '<p class="help">Spell list: <strong>' + cap(fixedList) + '</strong> (set by your background).</p>';
      }
      h += '<div class="row"><label class="lbl">Spellcasting ability</label>' + abilitySelect('data-fc="' + slot + '" data-k="ability"', c.ability || '', ['int', 'wis', 'cha'], 'Wisdom (default)') + '</div>';
      if (list) {
        const ls = classSpells(list);
        const cc = c.cantrips || [];
        h += '<h3>Two ' + cap(list) + ' cantrips</h3><div>' + ls.filter(function(s) { return s.level === 0; }).map(function(sp) {
          const on = cc.indexOf(sp.name) !== -1;
          return spellChip(sp, on, !on && cc.length >= 2, 'data-mic="' + slot + '" data-v="' + esc(sp.name) + '"');
        }).join('') + '</div>';
        h += '<h3>One level 1 ' + cap(list) + ' spell</h3><div>' + ls.filter(function(s) { return s.level === 1; }).map(function(sp) {
          const on = c.spell === sp.name;
          return spellChip(sp, on, false, 'data-mis="' + slot + '" data-v="' + esc(sp.name) + '"');
        }).join('') + '</div>';
      }
    }
    return h;
  }

  function hpRow(l) {
    const h = B.hp[l] || (B.hp[l] = { mode: 'avg', roll: '' });
    const c = conMod();
    return '<h3>Hit points</h3><div class="row">' +
      '<label class="chk' + (h.mode === 'avg' ? ' on' : '') + '" data-hp="' + l + '" data-mode="avg">' + (h.mode === 'avg' ? '◉' : '○') + ' Take the average (5)</label>' +
      '<label class="chk' + (h.mode === 'roll' ? ' on' : '') + '" data-hp="' + l + '" data-mode="roll">' + (h.mode === 'roll' ? '◉' : '○') + ' I rolled a d8:</label>' +
      '<input type="number" min="1" max="8" data-hproll="' + l + '" value="' + esc(h.roll) + '"' + (h.mode === 'roll' ? '' : ' disabled') + '>' +
      '<span class="tip">+ Con ' + fmt(c) + ' this level. Running total: <strong>' + hpMax() + '</strong></span></div>';
  }

  function beastPicker(listKey, max, maxCR, exclude) {
    const chosen = arrAt(listKey);
    return '<div class="grid">' + WILD_SHAPE_BEASTS.filter(function(b) { return b.crNum <= maxCR && exclude.indexOf(b.id) === -1; }).map(function(b) {
      const on = chosen.indexOf(b.id) !== -1;
      const off = !on && chosen.length >= max;
      return cardHtml(on, b.name + ' <span style="font-size:11px;color:var(--parch4)">CR ' + b.cr + '</span>',
        b.size + ' · AC ' + b.ac + ' · HP ' + b.hp + ' · ' + b.speed, off ? '' : 'data-beast="' + listKey + '" data-v="' + b.id + '" data-max="' + max + '"', off);
    }).join('') + '</div>';
  }

  // ---- Step renderers --------------------------------------------------
  const R = {};

  R['class'] = function() {
    if (MODE === 'levelup') {
      let h = '<h2>Level up</h2><p class="help">' + esc(B.name || 'Your character') + ' is level <strong>' + B.builtLevel + '</strong>. Pick the new level; you\'ll only make the new levels\' choices.</p>';
      h += '<div class="row"><select data-b="level">' + Array.apply(null, Array(CLS.maxLevel - B.builtLevel)).map(function(_, i) {
        const l = B.builtLevel + 1 + i; return '<option value="' + l + '"' + (B.level === l ? ' selected' : '') + '>Level ' + l + '</option>';
      }).join('') + '</select></div>';
      h += '<p class="tip">Your HP, inventory, money, notes and spell slots in use are kept. <a href="#" data-mode="new">Start a brand-new character instead</a></p>';
      return h;
    }
    let h = '';
    if (savedBuild && savedBuild.level) h += '<div class="banner" style="border-color:var(--gold2);background:rgba(154,122,26,0.15)">You already have a level ' + savedBuild.level + ' character. <a href="#" data-mode="levelup">⬆ Level up instead</a> — or carry on below to build a new one.</div>';
    h += '<h2>Class</h2><p class="help">Only the Druid is ready so far — other classes get added when a player needs one.</p><div class="grid">';
    h += cardHtml(true, 'Druid', 'Wisdom caster. Wild Shape, nature magic, healing.');
    CLASSES_COMING_SOON.forEach(function(n) { h += cardHtml(false, n, 'Coming soon', '', true); });
    h += '</div><h3>Build to level</h3><div class="row"><select data-b="level">' +
      Array.apply(null, Array(CLS.maxLevel)).map(function(_, i) { const l = i + 1; return '<option value="' + l + '"' + (B.level === l ? ' selected' : '') + '>Level ' + l + '</option>'; }).join('') +
      '</select><span class="tip">The party is level 6. You\'ll make each level\'s choices in turn.</span></div>';
    h += '<h3>Druid basics</h3>' +
      featureHtml('Hit points', 'd8 per level (8 + Con at level 1).') +
      featureHtml('Saving throws', 'Intelligence and Wisdom.') +
      featureHtml('Training', CLS.armorProf + '. ' + CLS.weaponProf + '. Tool: ' + CLS.toolProf + '.');
    return h;
  };

  R.background = function() {
    let h = '<h2>Background</h2><p class="help">Your background gives +3 to ability scores, two skills, a tool and an Origin feat.</p><div class="grid">';
    Object.keys(BACKGROUNDS_2024).forEach(function(k) {
      const g = BACKGROUNDS_2024[k];
      h += cardHtml(B.bg === k, g.name, g.abilities.map(function(a) { return a.toUpperCase(); }).join(' · ') + '<br>' + g.skills.map(function(s) { return SKILL_NAMES[s]; }).join(', ') + '<br>Feat: ' + FEATS_2024[g.feat].name + (g.featList ? ' (' + cap(g.featList) + ')' : ''), 'data-pick="bg" data-v="' + k + '"');
    });
    h += '</div>';
    const g = bg();
    if (g) {
      h += '<h3>Ability increase</h3><div class="row">' +
        chk(B.bgMode === '2-1', '+2 to one, +1 to another', 'data-b="bgMode" data-v="2-1"') +
        chk(B.bgMode === '1-1-1', '+1 to all three', 'data-b="bgMode" data-v="1-1-1"') + '</div>';
      if (B.bgMode === '2-1') {
        h += '<div class="row"><label class="lbl">+2</label>' + abilitySelect('data-b="bgPlus2"', B.bgPlus2, g.abilities) +
          '<label class="lbl">+1</label>' + abilitySelect('data-b="bgPlus1"', B.bgPlus1, g.abilities) + '</div>';
      } else {
        h += '<p class="help">+1 to ' + g.abilities.map(function(a) { return ABILITY_NAMES[a]; }).join(', ') + '.</p>';
      }
      h += '<h3>Skills &amp; tool</h3><p class="help">' + g.skills.map(function(s) { return SKILL_NAMES[s]; }).join(', ') + ' · ' + esc(g.tool) + '</p>';
      h += '<h3>Origin feat</h3>' + featChoiceHtml('bg', g.feat, g.featList);
    }
    return h;
  };

  R.species = function() {
    let h = '<h2>Species</h2><div class="grid">';
    Object.keys(SPECIES_2024).forEach(function(k) {
      const s = SPECIES_2024[k];
      h += cardHtml(B.species === k, s.name, s.sizes.join(' or ') + ' · Speed ' + s.speed + ' ft' + (s.darkvision ? ' · Darkvision ' + s.darkvision + ' ft' : ''), 'data-pick="species" data-v="' + k + '"');
    });
    h += '</div>';
    const s = species();
    if (!s) return h;
    h += '<h3>Traits</h3>' + s.traits.map(function(t) { return featureHtml(t.name, t.desc); }).join('');
    if (s.sizes.length > 1) {
      h += '<h3>Size</h3><div class="row">' + s.sizes.map(function(z) { return chk(B.size === z, z, 'data-b="size" data-v="' + z + '"'); }).join('') + '</div>';
    }
    (s.choices || []).forEach(function(ch) {
      h += '<h3>' + ch.label + '</h3><div class="grid">' + Object.keys(ch.options).map(function(k) {
        const o = ch.options[k];
        return cardHtml(B.speciesChoice[ch.id] === k, o.name, o.desc || '', 'data-sc="' + ch.id + '" data-v="' + k + '"');
      }).join('') + '</div>';
    });
    if (s.spellAbility) {
      h += '<div class="row"><label class="lbl">Spellcasting ability for ' + s.name + ' spells</label>' + abilitySelect('data-b="speciesAbility"', B.speciesAbility, ['int', 'wis', 'cha']) + '</div>';
    }
    if (s.skillChoice) {
      const from = s.skillChoice.from === 'any' ? Object.keys(SKILL_NAMES) : s.skillChoice.from;
      h += '<h3>' + s.skillChoice.label + '</h3><div class="row"><select data-b="speciesSkill"><option value="">—</option>' + from.map(function(k) {
        return '<option value="' + k + '"' + (B.speciesSkill === k ? ' selected' : '') + '>' + SKILL_NAMES[k] + '</option>';
      }).join('') + '</select></div>';
    }
    if (s.originFeat) {
      h += '<h3>Versatile — Origin feat</h3><div class="row"><select data-b="humanFeat" data-reset-fc="human"><option value="">—</option>' +
        Object.keys(FEATS_2024).filter(function(k) { return FEATS_2024[k].category === 'origin'; }).map(function(k) {
          return '<option value="' + k + '"' + (B.humanFeat === k ? ' selected' : '') + '>' + FEATS_2024[k].name + '</option>';
        }).join('') + '</select></div>';
      if (B.humanFeat) h += featChoiceHtml('human', B.humanFeat, null);
    }
    return h;
  };

  R.abilities = function() {
    let h = '<h2>Ability scores</h2><p class="help">Roll 4d6 six times at the table, dropping the lowest die each time. Type the six totals in, then give each one to an ability.</p>';
    h += '<div class="row">' + B.rolls.map(function(r, i) {
      return '<input type="number" min="3" max="18" data-roll="' + i + '" value="' + esc(r) + '" aria-label="Roll ' + (i + 1) + '">';
    }).join('') + '</div>';
    const used = {};
    ABILITY_KEYS.forEach(function(a) { const v = B.assign[a]; if (v !== undefined && v !== null && v !== '') used[v] = a; });
    h += '<h3>Assign</h3><div class="row" style="gap:1rem">' + ABILITY_KEYS.map(function(a) {
      return '<div><label class="lbl">' + ABILITY_NAMES[a] + '</label><br><select data-assign="' + a + '"><option value="">—</option>' + B.rolls.map(function(r, i) {
        if (r === '' || r === null) return '';
        const taken = used[i] && used[i] !== a;
        return '<option value="' + i + '"' + (String(B.assign[a]) === String(i) ? ' selected' : '') + (taken ? ' disabled' : '') + '>' + r + (taken ? ' (used)' : '') + '</option>';
      }).join('') + '</select></div>';
    }).join('') + '</div>';
    const sc = scores(), bon = bonuses();
    h += '<h3>Final scores</h3><p class="tip">Includes your background increase' + (B.level >= 4 ? ' and level 4 choice' : '') + '. Wisdom powers your druid spells.</p><div class="scores">' + ABILITY_KEYS.map(function(a) {
      return '<div class="score"><div class="a">' + a.toUpperCase() + '</div><div class="v">' + (sc[a] === null ? '—' : sc[a]) + '</div><div class="m">' + (sc[a] === null ? '' : fmt(mod(sc[a]))) + (bon[a] ? ' <span class="tip">(+' + bon[a] + ')</span>' : '') + '</div></div>';
    }).join('') + '</div>';
    return h;
  };

  R.L1 = function() {
    let h = '<h2>Level 1</h2>';
    h += '<p class="help">Hit points at level 1: 8 + Con ' + fmt(conMod()) + ' = <strong>' + Math.max(1, 8 + conMod()) + '</strong>.</p>';
    h += featureHtml(CLS.features.spellcasting.name, CLS.features.spellcasting.desc);
    h += featureHtml(CLS.features.druidic.name, CLS.features.druidic.desc);
    h += '<h3>Primal Order</h3><div class="grid">' + Object.keys(CLS.primalOrders).map(function(k) {
      const o = CLS.primalOrders[k]; return cardHtml(B.order === k, o.name, o.desc, 'data-b="order" data-v="' + k + '"');
    }).join('') + '</div>';
    const sm = skillMap();
    h += '<h3>Druid skills — choose ' + CLS.skillChoices.count + '</h3><div class="row">' + CLS.skillChoices.from.map(function(k) {
      const on = B.classSkills.indexOf(k) !== -1;
      const already = sm[k] && !on;
      const full = !on && B.classSkills.length >= CLS.skillChoices.count;
      return chk(on, SKILL_NAMES[k] + (already ? ' <small>(from ' + esc(sm[k]) + ')</small>' : ''), 'data-arr="classSkills" data-v="' + k + '" data-max="' + CLS.skillChoices.count + '"', already || full);
    }).join('') + '</div>';
    const need = CLS.table[1].cantrips + (B.order === 'magician' ? 1 : 0);
    h += '<h3>Cantrips — choose ' + need + '</h3>' + cantripPicker('cantrips1', need, cantripsUpTo(CLS.maxLevel).slice(B.cantrips1.length));
    return h;
  };

  function cantripPicker(key, max, otherKnown) {
    const free = alwaysPreparedList().map(function(x) { return x.name; });
    const mine = arrAt(key);
    return '<div>' + classSpells('druid').filter(function(s) { return s.level === 0; }).map(function(sp) {
      const on = mine.indexOf(sp.name) !== -1;
      const known = free.indexOf(sp.name) !== -1 || otherKnown.indexOf(sp.name) !== -1;
      return spellChip(sp, on, !on && (known || mine.length >= max), 'data-arr="' + key + '" data-v="' + esc(sp.name) + '" data-max="' + max + '"');
    }).join('') + '</div><p class="tip">Hover a spell for a summary.</p>';
  }

  // Generic level step (2–20): HP, that level's features and choices.
  function renderLevel(l) {
    let h = '<h2>Level ' + l + (l === SUB.level ? ' — Circle of the Land' : '') + '</h2>' + hpRow(l);
    const row = CLS.table[l];
    if (row.pb !== CLS.table[l - 1].pb) h += '<p class="help">Proficiency bonus rises to +' + row.pb + '.</p>';
    if (row.slots.length !== CLS.table[l - 1].slots.length) h += '<p class="help">You gain level ' + row.slots.length + ' spell slots.</p>';
    if (row.wildShape !== CLS.table[l - 1].wildShape) h += '<p class="help">Wild Shape uses rise to ' + row.wildShape + '.</p>';
    if (row.prepared !== CLS.table[l - 1].prepared) h += '<p class="help">You can prepare ' + row.prepared + ' spells.</p>';
    row.features.forEach(function(fid) {
      if (['subclass', 'subclassFeature', 'asi', 'epicBoon', 'primalOrder', 'elementalFury', 'improvedElementalFury'].indexOf(fid) !== -1) return;
      const f = CLS.features[fid]; if (f) h += featureHtml(f.name, f.desc);
    });
    (SUB.features[l] || []).forEach(function(f) { h += featureHtml(f.name, f.desc); });
    if (B.land) {
      const added = SUB.spellsByLand[B.land].filter(function(s) { return s.minLevel === l; }).map(function(s) { return s.name; });
      if (added.length && l !== SUB.level) h += '<p class="help">Your ' + SUB.landLabels[B.land] + ' Circle spells add: ' + added.join(', ') + '.</p>';
    }
    if (l === SUB.level) {
      h += '<h3>Starting land</h3><p class="tip">You can switch land on your sheet after any Long Rest.</p><div class="grid">' + SUB.lands.map(function(k) {
        const list = SUB.spellsByLand[k].filter(function(s) { return s.minLevel <= B.level; }).map(function(s) { return s.name; }).join(', ');
        return cardHtml(B.land === k, SUB.landLabels[k], list, 'data-b="land" data-v="' + k + '"');
      }).join('') + '</div>';
    }
    if (l === 7) {
      h += '<h3>Elemental Fury</h3><div class="grid">' + Object.keys(CLS.elementalFuries).map(function(k) {
        const f = CLS.elementalFuries[k]; return cardHtml(B.fury === k, f.name, f.desc + '<br><em>Level 15:</em> ' + f.improved, 'data-b="fury" data-v="' + k + '"');
      }).join('') + '</div>';
    }
    if (l === 15 && B.fury) h += featureHtml('Improved Elemental Fury — ' + CLS.elementalFuries[B.fury].name, CLS.elementalFuries[B.fury].improved);
    if (CLS.asiLevels.indexOf(l) !== -1 || l === CLS.epicBoonLevel) h += asiBlock(l);
    if (CLS.cantripLevels[l]) {
      const others = cantripsUpTo(CLS.maxLevel).filter(function(n) { return (B.cantripsAt[l] || []).indexOf(n) === -1; });
      h += '<h3>New cantrip — choose ' + CLS.cantripLevels[l] + '</h3>' + cantripPicker('cantripsAt.' + l, CLS.cantripLevels[l], others);
    }
    if (CLS.formLevels[l]) {
      const lim = CLS.wildShapeLimits.filter(function(x) { return x.minLevel <= l; }).pop();
      const others = formsUpTo(CLS.maxLevel).filter(function(id) { return (B.formsAt[l] || []).indexOf(id) === -1; });
      h += '<h3>Wild Shape — choose ' + CLS.formLevels[l] + ' ' + (l === 2 ? 'known forms' : 'more forms') + ' (up to CR ' + crLabel(lim.maxCR) + (lim.fly ? ', flying allowed' : ', no flying') + ')</h3>' +
        (l === 2 ? '<p class="tip">Beasts you knew around home. You can swap one after any Long Rest.</p>' : '') +
        beastPicker('formsAt.' + l, CLS.formLevels[l], lim.maxCR, others);
    }
    return h;
  }
  function asiBlock(l) {
    const a = asiOf(l);
    const epic = l === CLS.epicBoonLevel;
    const keys = Object.keys(FEATS_2024).filter(function(k) { const c = FEATS_2024[k].category; return epic ? c === 'epic' : c !== 'epic'; });
    let h = '<h3>' + (epic ? 'Epic Boon' : 'Ability Score Improvement or a feat') + '</h3><div class="row"><select data-asi="' + l + '" data-k="feat"><option value="">—</option>' +
      keys.map(function(k) { const f = FEATS_2024[k]; return '<option value="' + k + '"' + (a.feat === k ? ' selected' : '') + '>' + f.name + (f.category === 'origin' ? ' (Origin)' : '') + '</option>'; }).join('') + '</select></div>';
    if (a.feat === 'abilityScoreImprovement') {
      h += '<div class="row">' + chk(a.asiMode === '2', '+2 to one score', 'data-asi="' + l + '" data-k="asiMode" data-v="2"') + chk(a.asiMode === '1-1', '+1 to two scores', 'data-asi="' + l + '" data-k="asiMode" data-v="1-1"') + '</div>';
      h += '<div class="row">' + abilitySelect('data-asi="' + l + '" data-k="a1"', a.a1) + (a.asiMode === '1-1' ? abilitySelect('data-asi="' + l + '" data-k="a2"', a.a2) : '') + '<span class="tip">No score above 20.</span></div>';
    } else if (a.feat) {
      const f = FEATS_2024[a.feat];
      if (f.asiFrom || f.asiFromChoice) h += '<div class="row"><label class="lbl">+1 to</label>' + abilitySelect('data-asi="' + l + '" data-k="asi"', a.asi, f.asiFrom || ABILITY_KEYS) + (epic ? '<span class="tip">Epic Boons can raise a score up to 30.</span>' : '') + '</div>';
      h += featChoiceHtml('asi' + l, a.feat, null);
    }
    return h;
  }

  R.spells = function() {
    const need = tbl().prepared;
    const maxSlot = tbl().slots.length;
    const free = alwaysPreparedList();
    const freeNames = free.map(function(x) { return x.name; });
    let h = '<h2>Prepared spells</h2><p class="help">At level ' + B.level + ' you prepare <strong>' + need + '</strong> druid spells of level ' + maxSlot + ' or lower. You can change them after every Long Rest, so don\'t overthink it. ' +
      'Chosen: <strong>' + B.prepared.length + ' / ' + need + '</strong></p>';
    h += '<h3>Always prepared (free)</h3><p class="help">' + free.filter(function(x) { return spellByName[x.name.toLowerCase()] && spellByName[x.name.toLowerCase()].level > 0; }).map(function(x) { return esc(x.name) + ' <span class="tip">(' + esc(x.reason) + ')</span>'; }).join(', ') + '</p>';
    for (let lv = 1; lv <= maxSlot; lv++) {
      h += '<h3>Level ' + lv + '</h3><div>' + classSpells('druid').filter(function(s) { return s.level === lv && freeNames.indexOf(s.name) === -1; }).map(function(sp) {
        const on = B.prepared.indexOf(sp.name) !== -1;
        return spellChip(sp, on, !on && B.prepared.length >= need, 'data-arr="prepared" data-v="' + esc(sp.name) + '" data-max="' + need + '"');
      }).join('') + '</div>';
    }
    return h + '<p class="tip">C = Concentration, R = Ritual. Hover a spell for a summary; ↗ opens the official text on D&amp;D Beyond.</p>';
  };

  R.equipment = function() {
    const g = bg(); const ce = CLS.startingEquipment;
    let h = '<h2>Equipment</h2><h3>Druid</h3><div class="grid">' +
      cardHtml(B.equipClass === 'a', ce.a.label, ce.a.items.map(function(i) { return i.name; }).join(', ') + ', ' + ce.a.gp + ' GP', 'data-b="equipClass" data-v="a"') +
      cardHtml(B.equipClass === 'b', ce.b.label, 'Buy your own gear later.', 'data-b="equipClass" data-v="b"') + '</div>';
    if (g) {
      h += '<h3>' + g.name + ' background</h3><div class="grid">' +
        cardHtml(B.equipBg === 'a', g.name + ' kit', g.kit.join(', ') + ', ' + g.gp + ' GP', 'data-b="equipBg" data-v="a"') +
        cardHtml(B.equipBg === 'b', '50 GP instead', '', 'data-b="equipBg" data-v="b"') + '</div>';
    }
    if (B.order === 'warden') h += '<p class="help">As a Warden you can wear Medium armor and use Martial weapons — buy them with your gold.</p>';
    return h;
  };

  R.details = function() {
    const al = ['Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil', 'Unaligned'];
    let h = '<h2>Details</h2>';
    h += '<div class="row"><label class="lbl">Name</label><input type="text" data-b="name" value="' + esc(B.name) + '" style="flex:1;min-width:200px"></div>';
    h += '<div class="row"><label class="lbl">Age</label><input type="text" data-b="age" value="' + esc(B.age) + '" style="width:6rem">' +
      '<label class="lbl">Alignment</label><select data-b="alignment"><option value="">—</option>' + al.map(function(a) { return '<option' + (B.alignment === a ? ' selected' : '') + '>' + a + '</option>'; }).join('') + '</select></div>';
    h += '<h3>Languages</h3><p class="tip">You know Common and Druidic, plus two more.</p><div class="row">' + [0, 1].map(function(i) {
      return '<select data-lang="' + i + '"><option value="">—</option>' + STANDARD_LANGUAGES.map(function(l) { return '<option' + (B.languages[i] === l ? ' selected' : '') + '>' + l + '</option>'; }).join('') + '</select>';
    }).join('') + '</div>';
    h += '<h3>Appearance</h3><textarea data-b="appearance" style="min-height:70px">' + esc(B.appearance) + '</textarea>';
    h += '<h3>Personality</h3><textarea data-b="personality" style="min-height:70px">' + esc(B.personality) + '</textarea>';
    h += '<h3>Backstory</h3><textarea data-b="backstory" style="min-height:180px">' + esc(B.backstory) + '</textarea>';
    h += '<p class="tip">Your portrait: send the picture to Brad and he\'ll add it to your sheet.</p>';
    return h;
  };

  R.review = function() {
    const d = buildDefinition();
    const m = missing('review');
    let h = '<h2>Review</h2>';
    if (MODE === 'levelup') h += '<div class="banner" style="border-color:var(--gold2);background:rgba(154,122,26,0.15)">Levelling up from <strong>' + B.builtLevel + '</strong> to <strong>' + B.level + '</strong>. HP, inventory, money and notes are kept.</div>';
    else if (hasExisting) h += '<div class="banner">You already have a character. Finishing will <strong>replace</strong> it (the old one is kept as a backup the DM can restore).</div>';
    if (m.length) h += '<div class="banner">Not quite ready: ' + m.map(esc).join(' · ') + '</div>';
    const row = function(k, v) { return '<tr><td>' + k + '</td><td>' + v + '</td></tr>'; };
    h += '<table class="review">' +
      row('Name', d.name) + row('Class', 'Druid ' + d.level + (d.level >= 3 ? ' (Circle of the Land)' : '') + (B.order ? ' · ' + CLS.primalOrders[B.order].name : '')) +
      row('Species', d.species + ' · ' + d.size + ' · Speed ' + d.speed + ' ft') + row('Background', d.background) +
      row('Scores', ABILITY_KEYS.map(function(a) { return a.toUpperCase() + ' ' + d.abilities[a] + ' (' + fmt(mod(d.abilities[a] || 10)) + ')'; }).join(' · ')) +
      row('HP / AC', d.hpMax + ' HP · AC ' + d.ac + ' (' + d.acNote + ')') +
      row('Initiative / PB', fmt(d.initiative) + ' · +' + d.proficiencyBonus) +
      row('Skills', Object.keys(d.skills).filter(function(k) { return d.skills[k].proficient; }).map(function(k) { return SKILL_NAMES[k]; }).join(', ')) +
      row('Spell DC / attack', d.spellcasting.saveDc + ' / ' + fmt(d.spellcasting.atk) + ' · slots ' + d.spellcasting.slots.join(' / ') + ' · prepares ' + d.spellcasting.preparedMax) +
      row('Cantrips', esc(d.spellcasting.prepared.cantrips.join(', '))) +
      row('Prepared', esc(B.prepared.join(', '))) +
      (d.wildShape ? row('Wild Shape', d.wildShape.forms.map(function(b) { return b.name; }).join(', ')) : '') +
      row('Feats', d.feats.map(function(f) { return f.name; }).join(', ') || '—') +
      row('Languages', d.languages.join(', ')) +
      '</table>';
    h += '<div class="row" style="margin-top:1rem"><button class="btn primary" data-finish="1"' + (m.length || saving ? ' disabled' : '') + '>' + (saving ? 'Saving…' : MODE === 'levelup' ? 'Finish — level up' : 'Finish — create my character') + '</button></div>';
    if (IDENT && IDENT.role === 'dm') h += '<p class="tip">DM: you are building <strong>' + esc(TARGET) + '</strong>.</p>';
    return h;
  };

  // ---- Definition (CHARACTERS-shaped) ------------------------------------
  function itemFor(name) {
    const qm = name.match(/^(.*?)\s*\((\d+)\)$/);
    const base = qm ? qm[1] : name;
    const qty = qm ? parseInt(qm[2], 10) : 1;
    const cat = ITEMS_2024.find(function(it) { return it.name.toLowerCase() === base.toLowerCase(); });
    if (cat && (cat.category === 'weapon' || cat.category === 'armor')) {
      return { name: cat.name, qty: qty, sourceItemId: cat.id, slot: cat.category === 'armor' ? (cat.id === 'shield' ? 'shield' : 'armor') : 'weapon', equipped: false };
    }
    return { name: base, qty: qty, slot: 'gear' };
  }

  function buildDefinition() {
    const s = species() || { name: '—', sizes: ['Medium'], speed: 30, traits: [] };
    const g = bg() || { name: '—', skills: [], tool: '', feat: null };
    const sc = scores();
    const ab = {}; ABILITY_KEYS.forEach(function(a) { ab[a] = sc[a] === null ? 10 : sc[a]; });
    const P = pb();
    const L = B.level;
    const wis = mod(ab.wis), dex = mod(ab.dex), str = mod(ab.str);

    // Species sub-choice options
    const opts = {};
    (s.choices || []).forEach(function(ch) { const o = ch.options[B.speciesChoice[ch.id]]; if (o) opts[ch.id] = o; });
    let speed = s.speed, darkvision = s.darkvision || 0;
    Object.keys(opts).forEach(function(k) { if (opts[k].speed) speed = opts[k].speed; if (opts[k].darkvision) darkvision = opts[k].darkvision; });
    if (hasFeat('speedy')) speed += 10;

    // Saves and skills
    const saves = {}; CLS.saves.forEach(function(a) { saves[a] = { proficient: true }; });
    featSlots().forEach(function(f) { if (f.key === 'resilient' && f.level && B.asi[f.level] && B.asi[f.level].asi) saves[B.asi[f.level].asi] = { proficient: true }; });
    const skills = {};
    Object.keys(skillMap()).forEach(function(k) { skills[k] = { proficient: true }; });
    if (B.order === 'magician') {
      const bonus = Math.max(1, wis);
      ['arcana', 'nature'].forEach(function(k) {
        const base = mod(ab.int) + (skills[k] ? P : 0) + bonus;
        skills[k] = Object.assign({}, skills[k] || {}, { modOverride: base, note: '+' + bonus + ' Magician' });
      });
    }
    const percMod = mod(ab.wis) + (skills.perception ? P : 0);

    // Equipment
    const equipment = [];
    let gp = 0;
    if (B.equipClass === 'a') {
      CLS.startingEquipment.a.items.forEach(function(i) {
        equipment.push({ name: i.name, qty: 1, slot: i.slot, equipped: !!i.equipped, sourceItemId: i.itemId || null, desc: i.desc || '' });
      });
      gp += CLS.startingEquipment.a.gp;
    } else gp += CLS.startingEquipment.b.gp;
    if (B.equipBg === 'a' && g.kit) { g.kit.forEach(function(n) { equipment.push(itemFor(n)); }); gp += g.gp; } else gp += 50;
    const hasArmor = equipment.some(function(i) { return i.sourceItemId === 'leather' && i.equipped; });
    const hasShield = equipment.some(function(i) { return i.sourceItemId === 'shield' && i.equipped; });
    const ac = (hasArmor ? 11 : 10) + dex + (hasShield ? 2 : 0);
    const acNote = (hasArmor ? 'Leather armor' : 'No armor') + ' + Dex' + (hasShield ? ' + shield' : '');

    // Features
    const classFeatures = [];
    const t = CLS.table;
    for (let l = 1; l <= L; l++) {
      t[l].features.forEach(function(fid) {
        if (fid === 'primalOrder' && B.order) { const o = CLS.primalOrders[B.order]; classFeatures.push({ name: 'Primal Order — ' + o.name, desc: o.desc }); return; }
        if (fid === 'subclass') { (SUB.features[3] || []).forEach(function(f) { classFeatures.push({ name: f.name + ' (Circle of the Land)', desc: f.desc }); }); return; }
        if (fid === 'subclassFeature') { (SUB.features[l] || []).forEach(function(f) { classFeatures.push({ name: f.name + ' (Circle of the Land)', desc: f.desc }); }); return; }
        if (fid === 'asi') {
          const a = B.asi[l];
          if (a && a.feat === 'abilityScoreImprovement') classFeatures.push({ name: 'Ability Score Improvement (level ' + l + ')', desc: a.asiMode === '2' ? '+2 ' + ABILITY_NAMES[a.a1 || 'wis'] : '+1 ' + ABILITY_NAMES[a.a1 || 'wis'] + ', +1 ' + ABILITY_NAMES[a.a2 || 'con'] });
          return;
        }
        if (fid === 'epicBoon') return;   // listed under Feats
        if (fid === 'elementalFury' && B.fury) { const f = CLS.elementalFuries[B.fury]; classFeatures.push({ name: 'Elemental Fury — ' + f.name, desc: f.desc }); return; }
        if (fid === 'improvedElementalFury' && B.fury) { const f = CLS.elementalFuries[B.fury]; classFeatures.push({ name: 'Improved Elemental Fury — ' + f.name, desc: f.improved }); return; }
        const f = CLS.features[fid]; if (f) classFeatures.push({ name: f.name, desc: f.desc });
      });
    }

    const speciesTraits = s.traits.filter(function(tr) { return !tr.minLevel || tr.minLevel <= L; }).map(function(tr) { return { name: tr.name, desc: tr.desc }; });
    Object.keys(opts).forEach(function(k) {
      const o = opts[k];
      const label = ((s.choices || []).find(function(c) { return c.id === k; }) || {}).label || '';
      speciesTraits.push({ name: label.replace(/\s*\(.*\)$/, '') + ' — ' + o.name, desc: o.desc || '' });
      if (o.resist) speciesTraits.push({ name: 'Resistance', desc: o.resist + ' damage.' });
    });
    if (darkvision) speciesTraits.push({ name: 'Darkvision', desc: darkvision + ' ft.' });
    if (L >= 10 && B.land) classFeatures.push({ name: "Nature's Ward — current resistance", desc: 'Starting land ' + SUB.landLabels[B.land] + ': Resistance to ' + SUB.wardResistance[B.land] + ' (changes with your land: Arid Fire, Polar Cold, Temperate Lightning, Tropical Poison).' });

    // Feats
    const feats = [];
    let tools = [CLS.toolProf, g.tool].filter(Boolean);
    featSlots().forEach(function(f) {
      const feat = FEATS_2024[f.key]; const c = B.fc[f.slot] || {};
      let name = feat.name, desc = feat.desc;
      if (feat.choice && feat.choice.type === 'custom') { name = esc(c.name || feat.name); desc = esc(c.desc || ''); }
      if (feat.choice && feat.choice.type === 'text' && c.text) { desc += ' Choice: ' + esc(c.text) + '.'; if (/tool|instrument/i.test(feat.choice.label)) tools.push(esc(c.text)); }
      if (feat.choice && feat.choice.type === 'pick' && c.pick) desc += ' Choice: ' + (feat.choice.skill ? SKILL_NAMES[c.pick] : c.pick) + '.';
      if (f.key === 'skilled') desc += ' Chosen: ' + (c.skills || []).map(function(k) { return SKILL_NAMES[k]; }).join(', ') + '.';
      if (f.key === 'magicInitiate') desc += ' ' + cap(c.list || f.list || '') + ': ' + (c.cantrips || []).join(', ') + '; ' + (c.spell || '') + ' (' + ABILITY_NAMES[c.ability || 'wis'] + ').';
      if (f.level && (feat.asiFrom || feat.asiFromChoice) && B.asi[f.level] && B.asi[f.level].asi) desc += ' +1 ' + ABILITY_NAMES[B.asi[f.level].asi] + '.';
      feats.push({ name: name + ' (' + f.label + ')', desc: desc });
    });

    // Spells
    const cantrips = cantripsUpTo(L);
    const prepared = { cantrips: cantrips.slice() };
    B.prepared.forEach(function(n) {
      const sp = spellByName[n.toLowerCase()]; if (!sp) return;
      (prepared[sp.level] = prepared[sp.level] || []).push(sp.name);
    });
    // Circle spells are handled by def.landCircle (switchable on the sheet), not baked in here.
    const alwaysPreparedSpells = alwaysPreparedList().filter(function(x) { return !/^Circle of the Land/.test(x.reason); });

    // Resources
    const resources = [];
    if (L >= 2) resources.push({ id: 'wild_shape', label: 'Wild Shape (regain 1 on Short Rest)', max: t[L].wildShape, recharge: 'shortOne' });
    if (L >= 5) resources.push({ id: 'wild_resurgence_slot', label: 'Wild Resurgence — Wild Shape → L1 slot (1/long)', max: 1, recharge: 'long' });
    if (L >= 6) SUB.resources[6].forEach(function(r) { resources.push(Object.assign({}, r)); });
    if (L >= 20) resources.push({ id: 'nature_magician', label: 'Nature Magician — Wild Shape uses → spell slot (1/long)', max: 1, recharge: 'long' });
    const resolve = function(r) { return Object.assign({}, r, { max: r.max === 'pb' ? P : r.max }); };
    (s.resources || []).forEach(function(r) { if (!r.minLevel || r.minLevel <= L) resources.push(resolve(r)); });
    Object.keys(opts).forEach(function(k) {
      const o = opts[k];
      if (o.resource) resources.push(resolve(o.resource));
      Object.keys(o.spells || {}).forEach(function(lv) {
        if (L >= +lv) resources.push({ id: 'free_' + o.spells[lv].toLowerCase().replace(/[^a-z]+/g, '_'), label: o.spells[lv] + ' — free cast (1/long)', max: 1, recharge: 'long' });
      });
    });
    featSlots().forEach(function(f) {
      const feat = FEATS_2024[f.key]; const c = B.fc[f.slot] || {};
      if (feat.resource) resources.push(resolve(feat.resource));
      if (f.key === 'magicInitiate' && c.spell) resources.push({ id: 'mi_' + f.slot, label: c.spell + ' — Magic Initiate free cast (1/long)', max: 1, recharge: 'long' });
    });

    const armorProf = CLS.armorProf + (B.order === 'warden' ? ', Medium Armor' : '');
    const weaponProf = CLS.weaponProf + (B.order === 'warden' ? ', Martial Weapons' : '');

    const def = {
      id: TARGET,
      builtWith: 'char-builder v1',
      name: esc(B.name.trim() || 'Unnamed'),
      portraitUrl: '',
      species: s.name + (opts.lineage ? ' (' + opts.lineage.name + ')' : opts.legacy ? ' (' + opts.legacy.name + ')' : opts.ancestry ? ' (' + opts.ancestry.name + ')' : ''),
      className: 'Druid',
      level: L,
      subclass: L >= 3 ? 'Circle of the Land' : '—',
      primalOrder: B.order ? CLS.primalOrders[B.order].name : '',
      background: g.name,
      alignment: esc(B.alignment || '—'),
      age: esc(B.age),
      size: B.size || s.sizes[0],
      appearance: esc(B.appearance).replace(/\n/g, '<br>'),
      personality: esc(B.personality).replace(/\n/g, '<br>'),
      backstory: esc(B.backstory).replace(/\n/g, '<br>'),
      ac: ac, acNote: acNote,
      hpMax: hpMax(),
      hitDice: { max: L, die: 'd' + CLS.hitDie },
      speed: speed,
      initiative: dex + (hasFeat('alert') ? P : 0),
      proficiencyBonus: P,
      passivePerception: 10 + (skills.perception && skills.perception.modOverride !== undefined ? skills.perception.modOverride : percMod),
      abilities: ab,
      saves: saves,
      skills: skills,
      languages: ['Common', 'Druidic'].concat(B.languages.filter(Boolean)),
      armorProf: armorProf, weaponProf: weaponProf, toolProf: tools.join(', '),
      equipmentProf: { armor: armorProf.split(', '), weapons: weaponProf.split(', '), tools: tools },
      weapons: [{ name: 'Unarmed Strike', atk: P + str, damage: hasFeat('tavernBrawler') ? '1d4' + fmt(str) + ' bludgeoning' : Math.max(1, 1 + str) + ' bludgeoning', notes: 'Or Grapple / Shove.' }],
      classFeatures: classFeatures,
      speciesTraits: speciesTraits,
      feats: feats,
      spellcasting: {
        ability: 'Wisdom', saveDc: 8 + P + wis, atk: P + wis,
        slots: t[L].slots.slice(), preparedMax: t[L].prepared,
        prepared: prepared,
        notes: 'Prepared caster: change prepared spells after a Long Rest.'
      },
      alwaysPreparedSpells: alwaysPreparedSpells,
      resources: resources,
      equipment: equipment,
      coins: { cp: 0, sp: 0, ep: 0, gp: gp, pp: 0 }
    };
    if (L >= 3 && B.land) def.landCircle = { land: B.land, labels: SUB.landLabels, spellsByLand: SUB.spellsByLand };
    if (L >= 2) {
      const lim = CLS.wildShapeLimits.filter(function(x) { return x.minLevel <= L; }).pop();
      const ids = formsUpTo(L);
      def.wildShape = { maxCR: crLabel(lim.maxCR), knownCount: lim.known, forms: ids.map(function(id) { return WILD_SHAPE_BEASTS_BY_ID[id]; }).filter(Boolean) };
    }
    return def;
  }

  // ---- Finish ----------------------------------------------------------
  function finish() {
    if (saving || missing('review').length) return;
    const msg = MODE === 'levelup' ? 'Level ' + B.name.trim() + ' up to level ' + B.level + '? Your HP, inventory, money and notes are kept.'
      : hasExisting ? 'Replace your current character with this one?' : 'Create ' + B.name.trim() + '? It goes live on your sheet straight away.';
    if (!confirm(msg)) return;
    const db = PartyRoster._db();
    if (!db) { alert('Could not reach the database. Check your connection and try again.'); return; }
    saving = true; render();
    const def = JSON.parse(JSON.stringify(buildDefinition()));
    const defRef = db.ref(PartyRoster.definitionPath(TARGET));
    let prevDef = null;
    defRef.once('value').then(function(snap) {
      prevDef = snap.val();
      return prevDef ? db.ref(PartyRoster.definitionPath(TARGET) + '-prev').set(prevDef) : null;
    }).then(function() {
      return defRef.set(def);
    }).then(function() {
      return db.ref(PartyRoster.buildPath(TARGET)).set(JSON.parse(JSON.stringify({ choices: B, level: B.level, savedAt: Date.now(), by: IDENT.id })));
    }).then(function() {
      if (MODE === 'levelup' && prevDef) return levelUpState(db, prevDef, def);
      // Fresh live sheet state seeded from the new definition.
      try { localStorage.removeItem('eldoria-char-state-' + TARGET); } catch (e) {}
      CHARACTERS[TARGET] = def;
      const st = getSheetState(TARGET);
      if (def.landCircle) st.circleLand = def.landCircle.land;
      try { localStorage.setItem('eldoria-char-state-' + TARGET, JSON.stringify(st)); } catch (e) {}
      return db.ref('characters/' + TARGET).set(JSON.parse(JSON.stringify(Object.assign({}, st, { _updatedAt: firebase.database.ServerValue.TIMESTAMP }))));
    }).then(function() {
      try { localStorage.removeItem(draftKey()); } catch (e) {}
      window.location.href = 'sheet.html?id=' + encodeURIComponent(TARGET) + '&from=player';
    }).catch(function(e) {
      saving = false; render();
      alert('Saving failed: ' + (e && e.message || e) + '\nNothing was lost — your choices are still here. Try again.');
    });
  }

  // ---- Render + events -------------------------------------------------
  function render() {
    const list = stepList();
    if (step >= list.length) step = list.length - 1;
    const cur = list[step];
    let h = '<div class="steps">' + list.map(function(st, i) {
      const done = i !== step && !missing(st.id).length;
      return '<button data-go="' + i + '" class="' + (i === step ? 'on' : '') + (done ? ' done' : '') + '">' + st.label + '</button>';
    }).join('') + '</div>';
    const fn = R[cur.id] || (/^L\d+$/.test(cur.id) ? function() { return renderLevel(parseInt(cur.id.slice(1), 10)); } : null);
    h += '<div class="panel">' + fn() + '</div>';
    h += navHtml();
    app.innerHTML = h;
    saveDraft();
  }
  function navHtml() {
    const cur = stepList()[step];
    const m = missing(cur.id);
    return '<div class="nav"><button class="btn" data-go="' + (step - 1) + '"' + (step === 0 ? ' disabled' : '') + '>← Back</button>' +
      (m.length && cur.id !== 'review' ? '<span class="todo">' + m.map(esc).join(' · ') + '</span>' : (cur.id !== 'review' ? '<span class="ok">✓ Done</span>' : '<span></span>')) +
      (cur.id !== 'review' ? '<button class="btn primary" data-go="' + (step + 1) + '"' + (m.length ? ' disabled' : '') + '>Next →</button>' : '<span></span>') + '</div>';
  }
  // Refresh only the Back/Next bar (used while typing, so the text box keeps focus).
  function updateNav() {
    const n = app.querySelector('.nav');
    if (n) n.outerHTML = navHtml();
    saveDraft();
  }

  function setPath(attr, v) { B[attr] = v; }

  app.addEventListener('click', function(e) {
    const el = e.target.closest('[data-go],[data-pick],[data-b][data-v],[data-sc],[data-arr],[data-beast],[data-fcskill],[data-mic],[data-mis],[data-asi][data-v],[data-hp],[data-finish],[data-mode]');
    if (!el || el.classList.contains('dis') || el.classList.contains('off') || el.disabled) return;
    const d = el.dataset;
    if (d.go !== undefined) { const n = parseInt(d.go, 10); if (n >= 0 && n < stepList().length) { step = n; render(); window.scrollTo(0, 0); } return; }
    if (d.finish) { finish(); return; }
    if (d.mode) { e.preventDefault(); setMode(d.mode); return; }
    if (d.pick === 'bg') { if (B.bg !== d.v) { B.bg = d.v; B.bgPlus2 = null; B.bgPlus1 = null; B.fc.bg = {}; } }
    else if (d.pick === 'species') { if (B.species !== d.v) { B.species = d.v; B.size = null; B.speciesChoice = {}; B.speciesSkill = null; B.humanFeat = null; B.fc.human = {}; } }
    else if (d.sc) B.speciesChoice[d.sc] = d.v;
    else if (d.asi && d.v) asiOf(d.asi)[d.k] = d.v;
    else if (d.b && d.v) { setPath(d.b, d.v); if (d.b === 'order' && d.v !== 'magician') B.cantrips1 = B.cantrips1.slice(0, CLS.table[1].cantrips); }
    else if (d.hp) { const h = B.hp[d.hp] || (B.hp[d.hp] = {}); h.mode = d.mode; }
    else if (d.arr || d.beast || d.fcskill || d.mic) {
      let arr;
      if (d.arr) arr = arrAt(d.arr);
      else if (d.beast) arr = arrAt(d.beast);
      else if (d.fcskill) { const c = B.fc[d.fcskill] || (B.fc[d.fcskill] = {}); arr = c.skills || (c.skills = []); }
      else { const c = B.fc[d.mic] || (B.fc[d.mic] = {}); arr = c.cantrips || (c.cantrips = []); d.max = 2; }
      const i = arr.indexOf(d.v);
      if (i !== -1) arr.splice(i, 1); else if (arr.length < parseInt(d.max, 10)) arr.push(d.v);
    }
    else if (d.mis) { const c = B.fc[d.mis] || (B.fc[d.mis] = {}); c.spell = (c.spell === d.v) ? null : d.v; }
    render();
  });

  app.addEventListener('change', function(e) {
    const el = e.target; const d = el.dataset;
    if (d.b) {
      let v = el.value;
      if (d.b === 'level') { v = parseInt(v, 10); }
      B[d.b] = v || (d.b === 'level' ? CLS.maxLevel : null);
      if (d.resetFc) B.fc[d.resetFc] = {};
      if (['name', 'age', 'appearance', 'personality', 'backstory'].indexOf(d.b) !== -1) { saveDraft(); return; }
    } else if (d.asi) {
      asiOf(d.asi)[d.k] = el.value || null;
      if (d.k === 'feat') { B.fc['asi' + d.asi] = {}; asiOf(d.asi).asi = null; }
    } else if (d.fc) {
      const c = B.fc[d.fc] || (B.fc[d.fc] = {});
      c[d.k] = el.value || null;
      if (d.reset) d.reset.split(',').forEach(function(k) { c[k] = k === 'cantrips' ? [] : null; });
      if (d.k === 'text' || d.k === 'name' || d.k === 'desc') { saveDraft(); return; }
    } else if (d.roll !== undefined) {
      B.rolls[parseInt(d.roll, 10)] = el.value;
    } else if (d.assign) {
      B.assign[d.assign] = el.value === '' ? null : el.value;
    } else if (d.hproll) {
      const h = B.hp[d.hproll] || (B.hp[d.hproll] = { mode: 'roll' }); h.roll = el.value;
    } else if (d.lang !== undefined) {
      B.languages[parseInt(d.lang, 10)] = el.value;
    } else return;
    renderKeepFocus();
  });
  // Re-render after the browser has moved focus (e.g. Tab to the next roll
  // box), then put focus back on the matching element in the new DOM.
  function renderKeepFocus() {
    setTimeout(function() {
      const a = document.activeElement;
      let sel = null;
      if (a && app.contains(a) && a.dataset) {
        const k = ['roll', 'assign', 'hproll', 'lang', 'b', 'asi', 'fc'].find(function(x) { return a.dataset[x] !== undefined; });
        if (k) sel = '[data-' + k + '="' + a.dataset[k] + '"]' + (a.dataset.k ? '[data-k="' + a.dataset.k + '"]' : '');
      }
      render();
      if (sel) { const n = app.querySelector(sel); if (n) n.focus(); }
    }, 0);
  }
  // Text boxes: keep state current without re-rendering on every keystroke.
  app.addEventListener('input', function(e) {
    const el = e.target; const d = el.dataset;
    if (d.b && ['name', 'age', 'appearance', 'personality', 'backstory'].indexOf(d.b) !== -1) { B[d.b] = el.value; updateNav(); }
    if (d.fc && (d.k === 'text' || d.k === 'name' || d.k === 'desc')) { const c = B.fc[d.fc] || (B.fc[d.fc] = {}); c[d.k] = el.value; updateNav(); }
  });

  // ---- Boot --------------------------------------------------------------
  function gate(msg) { app.innerHTML = '<div class="panel"><p class="help">' + msg + '</p></div>'; }

  // Level up: keep the live sheet (HP, inventory, money, notes, custom spells)
  // and fold in what's new — extra max HP, new cantrips, the new prepared list.
  function levelUpState(db, prevDef, def) {
    const stateRef = db.ref('characters/' + TARGET);
    return stateRef.once('value').then(function(snap) {
      const live = snap.val();
      if (live) { delete live._updatedAt; try { localStorage.setItem('eldoria-char-state-' + TARGET, JSON.stringify(live)); } catch (e) {} }
      CHARACTERS[TARGET] = def;
      const st = getSheetState(TARGET);           // adds new slots, resources, species spells, Circle spells
      st.hp = st.hp || { current: def.hpMax, temp: 0 };
      st.hp.current = Math.min(def.hpMax, (st.hp.current || 0) + Math.max(0, def.hpMax - (prevDef.hpMax || 0)));
      const byName = {};
      SPELLS_2024.forEach(function(s) { byName[s.name.toLowerCase()] = s; });
      const want = {};
      B.prepared.forEach(function(n) { want[n.toLowerCase()] = true; });
      st.spells = (st.spells || []).filter(function(sp) {
        if (sp.level === 0 || sp.alwaysPrepared || /^custom_spell_/.test(sp.id || '')) return true;
        return !!want[(sp.name || '').toLowerCase()];      // drop prepared spells the player un-picked
      });
      const have = {};
      st.spells.forEach(function(sp) { have[(sp.name || '').toLowerCase()] = sp; });
      const add = def.spellcasting.prepared.cantrips.concat(B.prepared);
      add.forEach(function(n, i) {
        const key = n.toLowerCase(); const src = byName[key];
        if (have[key]) { have[key].prepared = true; return; }
        if (!src) return;
        st.spells.push({ id: 'lvl' + def.level + '_' + i + '_' + src.id, sourceSpellId: src.id, name: src.name, level: src.level, school: src.school || '',
          castingTime: src.castingTime || 'Action', range: src.range || '—', components: src.components || '', duration: src.duration || '',
          concentration: !!src.concentration, ritual: !!src.ritual, description: src.description || '', atHigherLevels: src.atHigherLevels || null,
          prepared: true, alwaysPrepared: false, alwaysPreparedReason: '', custom: false });
      });
      try { localStorage.setItem('eldoria-char-state-' + TARGET, JSON.stringify(st)); } catch (e) {}
      return stateRef.set(JSON.parse(JSON.stringify(Object.assign({}, st, { _updatedAt: firebase.database.ServerValue.TIMESTAMP }))));
    });
  }

  function setMode(mode) {
    if (mode === 'levelup' && savedBuild) {
      MODE = 'levelup';
      applyChoices(savedBuild.choices || {});
      B.builtLevel = savedBuild.level || B.level;
      B.level = Math.min(CLS.maxLevel, B.builtLevel + 1);
    } else {
      MODE = 'new';
      B.builtLevel = 0;
    }
    step = 0; render(); window.scrollTo(0, 0);
  }

  function boot() {
    IDENT = (typeof getCurrentIdentity === 'function') ? getCurrentIdentity() : null;
    if (!IDENT) { gate('Log in on the <a href="players.html">player site</a> first, then come back here.'); return; }
    if (IDENT.role === 'dm') {
      const q = new URLSearchParams(location.search).get('id');
      TARGET = q || PartyRoster.list().filter(function(p) { return p.built; }).map(function(p) { return p.id; })[0];
    } else {
      TARGET = IDENT.sheetId;
    }
    if (!TARGET || !PartyRoster.isBuilt(TARGET)) {
      gate('Your character already lives on the site — the builder is for new characters. <a href="players.html">Back to the player site</a>.');
      return;
    }
    document.getElementById('who').textContent = 'Building for ' + PartyRoster.label(TARGET) + (IDENT.role === 'dm' ? ' (as DM)' : '');
    loadDraft();
    render();
    const db = PartyRoster._db();
    if (db) Promise.all([db.ref(PartyRoster.definitionPath(TARGET)).once('value'), db.ref(PartyRoster.buildPath(TARGET)).once('value')]).then(function(r) {
      hasExisting = !!r[0].val();
      const b = r[1].val();
      if (hasExisting && b && b.choices) {
        savedBuild = { choices: b.choices, level: b.level || (b.choices && b.choices.level) || (r[0].val() || {}).level };
        // A fresh visit with a saved character goes straight to Level up.
        if (MODE !== 'levelup' && !localStorage.getItem(draftKey())) { setMode('levelup'); return; }
      }
      render();
    }).catch(function() {});
  }

  // Read-only handle for the DM / debugging: preview what Finish would save.
  window.CharBuilder = { preview: function() { return buildDefinition(); }, missing: function() { return missing('review'); },
    _test: { B: B, setMode: setMode, setSaved: function(s) { savedBuild = s; hasExisting = true; }, levelUpState: levelUpState } };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
