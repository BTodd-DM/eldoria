// =====================================================================
// THE WAYWARD COMPANY — 2024 CLASS DATA (Update 61b)
// ---------------------------------------------------------------------
// Data for the character builder (char-builder.html). One entry per
// class; adding a class is a data job, not an engine rewrite.
//
// All feature text is our own short mechanical summary — never the
// published wording. Official 2024 PHB only.
//
// Shape per class:
//   id, name, hitDie, primary, saves[], skillChoices{count, from[]},
//   armorProf, weaponProf, toolProf, spellAbility,
//   startingEquipment{ a: { items[], gp }, b: { gp } },
//   table[level] → { pb, cantrips, prepared, slots[], features[] }
//   levelChoices[level] → ['primalOrder', 'subclass', 'asi', …]
//   features{ id → { name, desc, level } }
//   subclasses{ id → { name, level, features{…}, … } }
// =====================================================================

const CLASSES_2024 = {
  druid: {
    id: 'druid',
    name: 'Druid',
    available: true,
    hitDie: 8,
    primary: 'wis',
    saves: ['int', 'wis'],
    skillChoices: { count: 2, from: ['arcana', 'animalHandling', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'] },
    armorProf: 'Light Armor, Shields',
    weaponProf: 'Simple Weapons',
    toolProf: "Herbalism Kit",
    spellAbility: 'wis',
    spellList: 'druid',
    startingEquipment: {
      a: {
        label: 'Druid kit',
        items: [
          { name: 'Leather Armor', itemId: 'leather', equipped: true, slot: 'armor' },
          { name: 'Shield', itemId: 'shield', equipped: true, slot: 'shield' },
          { name: 'Sickle', itemId: 'sickle', equipped: true, slot: 'weapon' },
          { name: 'Quarterstaff', itemId: 'quarterstaff', equipped: true, slot: 'weapon', desc: 'Doubles as your Druidic Focus.' },
          { name: "Explorer's Pack", slot: 'gear', desc: 'Backpack, bedroll, 2 flasks of oil, 10 days of rations, 50 ft rope, tinderbox, 10 torches, waterskin.' },
          { name: 'Herbalism Kit', slot: 'tool', desc: 'Tool proficiency. Used to make Antitoxin and Potions of Healing.' }
        ],
        gp: 9
      },
      b: { label: '50 GP instead', gp: 50 }
    },

    // Druid table, levels 1–20 (2024 PHB). slots = [L1, L2, L3, …]
    table: {
      1:  { pb: 2, cantrips: 2, prepared: 4,  slots: [2],                         wildShape: 0, features: ['spellcasting', 'druidic', 'primalOrder'] },
      2:  { pb: 2, cantrips: 2, prepared: 5,  slots: [3],                         wildShape: 2, features: ['wildShape', 'wildCompanion'] },
      3:  { pb: 2, cantrips: 2, prepared: 6,  slots: [4, 2],                      wildShape: 2, features: ['subclass'] },
      4:  { pb: 2, cantrips: 3, prepared: 7,  slots: [4, 3],                      wildShape: 2, features: ['asi'] },
      5:  { pb: 3, cantrips: 3, prepared: 9,  slots: [4, 3, 2],                   wildShape: 2, features: ['wildResurgence'] },
      6:  { pb: 3, cantrips: 3, prepared: 10, slots: [4, 3, 3],                   wildShape: 3, features: ['subclassFeature'] },
      7:  { pb: 3, cantrips: 3, prepared: 11, slots: [4, 3, 3, 1],                wildShape: 3, features: ['elementalFury'] },
      8:  { pb: 3, cantrips: 3, prepared: 12, slots: [4, 3, 3, 2],                wildShape: 3, features: ['asi'] },
      9:  { pb: 4, cantrips: 3, prepared: 14, slots: [4, 3, 3, 3, 1],             wildShape: 3, features: [] },
      10: { pb: 4, cantrips: 4, prepared: 15, slots: [4, 3, 3, 3, 2],             wildShape: 3, features: ['subclassFeature'] },
      11: { pb: 4, cantrips: 4, prepared: 16, slots: [4, 3, 3, 3, 2, 1],          wildShape: 3, features: [] },
      12: { pb: 4, cantrips: 4, prepared: 16, slots: [4, 3, 3, 3, 2, 1],          wildShape: 3, features: ['asi'] },
      13: { pb: 5, cantrips: 4, prepared: 17, slots: [4, 3, 3, 3, 2, 1, 1],       wildShape: 3, features: [] },
      14: { pb: 5, cantrips: 4, prepared: 17, slots: [4, 3, 3, 3, 2, 1, 1],       wildShape: 3, features: ['subclassFeature'] },
      15: { pb: 5, cantrips: 4, prepared: 18, slots: [4, 3, 3, 3, 2, 1, 1, 1],    wildShape: 3, features: ['improvedElementalFury'] },
      16: { pb: 5, cantrips: 4, prepared: 18, slots: [4, 3, 3, 3, 2, 1, 1, 1],    wildShape: 3, features: ['asi'] },
      17: { pb: 6, cantrips: 4, prepared: 19, slots: [4, 3, 3, 3, 2, 1, 1, 1, 1], wildShape: 4, features: [] },
      18: { pb: 6, cantrips: 4, prepared: 20, slots: [4, 3, 3, 3, 3, 1, 1, 1, 1], wildShape: 4, features: ['beastSpells'] },
      19: { pb: 6, cantrips: 4, prepared: 21, slots: [4, 3, 3, 3, 3, 2, 1, 1, 1], wildShape: 4, features: ['epicBoon'] },
      20: { pb: 6, cantrips: 4, prepared: 22, slots: [4, 3, 3, 3, 3, 2, 2, 1, 1], wildShape: 4, features: ['archdruid'] }
    },
    maxLevel: 20,
    asiLevels: [4, 8, 12, 16],
    epicBoonLevel: 19,
    // Extra cantrips learned at these levels (on top of level 1's).
    cantripLevels: { 4: 1, 10: 1 },
    // Extra Wild Shape forms learned at these levels (level 2 gives the first 4).
    formLevels: { 2: 4, 4: 2, 8: 2 },

    // Wild Shape known-form limits by druid level.
    wildShapeLimits: [
      { minLevel: 2, known: 4, maxCR: 0.25, fly: false },
      { minLevel: 4, known: 6, maxCR: 0.5,  fly: false },
      { minLevel: 8, known: 8, maxCR: 1,    fly: true }
    ],

    features: {
      spellcasting: { level: 1, name: 'Spellcasting (Wisdom)', desc: 'Prepared caster using a Druidic Focus. Change prepared spells after a Long Rest. Swap one cantrip when you gain a level.' },
      druidic:      { level: 1, name: 'Druidic', desc: 'You know the secret Druidic language and can leave hidden messages in it. Speak with Animals is always prepared.' },
      primalOrder:  { level: 1, name: 'Primal Order', desc: 'Your chosen order (see below).' },
      wildShape:    { level: 2, name: 'Wild Shape', desc: 'Bonus Action: become a known Beast form for hours equal to half your druid level. Gain temp HP equal to druid level on transforming. Keep your mind, Int/Wis/Cha, proficiencies and features; no spellcasting, but Concentration holds. Bonus Action to end. Regain one use on a Short Rest, all on a Long Rest. Swap one known form after a Long Rest.' },
      wildCompanion:{ level: 2, name: 'Wild Companion', desc: 'Magic action: spend a spell slot or a Wild Shape use to cast Find Familiar with no material. The familiar is Fey and leaves when you finish a Long Rest.' },
      subclass:     { level: 3, name: 'Druid Subclass', desc: 'Choose your Circle.' },
      asi:          { level: 4, name: 'Ability Score Improvement', desc: 'Increase scores or take a feat (see Feats).' },
      wildResurgence:{ level: 5, name: 'Wild Resurgence', desc: 'Once per turn with no Wild Shape uses left, spend a spell slot to regain one use. Also: spend a Wild Shape use to gain a level 1 spell slot (once per Long Rest).' },
      subclassFeature: { level: 6, name: 'Subclass feature', desc: 'From your Circle.' },
      elementalFury: { level: 7, name: 'Elemental Fury', desc: 'Your chosen fury (see below).' },
      improvedElementalFury: { level: 15, name: 'Improved Elemental Fury', desc: 'Your fury grows stronger (see below).' },
      beastSpells: { level: 18, name: 'Beast Spells', desc: 'You can cast spells while in Wild Shape, except spells with a material component that has a cost or is consumed.' },
      epicBoon: { level: 19, name: 'Epic Boon', desc: 'Gain an Epic Boon feat (see Feats).' },
      archdruid: { level: 20, name: 'Archdruid', desc: 'Evergreen Wild Shape: when you roll Initiative with no Wild Shape uses left, regain one. Nature Magician: once per Long Rest, turn Wild Shape uses into one spell slot (2 slot levels per use). Longevity: you age only 1 year for every 10 that pass.' }
    },

    // Level 7 choice; level 15 improves whichever was chosen.
    elementalFuries: {
      potentSpellcasting: { name: 'Potent Spellcasting', desc: 'Add your Wisdom modifier to the damage of Druid cantrips.', improved: 'Druid cantrips with a range of 10 ft or more gain +300 ft range.' },
      primalStrike: { name: 'Primal Strike', desc: 'Once on each of your turns when you hit with a weapon or a Wild Shape attack, add 1d8 Cold, Fire, Lightning or Thunder damage (your choice).', improved: 'The extra damage becomes 2d8.' }
    },

    primalOrders: {
      magician: { name: 'Magician', desc: 'Learn one extra Druid cantrip. Add your Wisdom modifier (min +1) to Intelligence (Arcana) and (Nature) checks.', extraCantrip: 1 },
      warden:   { name: 'Warden', desc: 'Proficiency with Martial weapons and training with Medium armor. The front-line option.', armorAdd: 'Medium Armor', weaponAdd: 'Martial Weapons' }
    },

    subclasses: {
      land: {
        id: 'land',
        name: 'Circle of the Land',
        level: 3,
        lands: ['arid', 'polar', 'temperate', 'tropical'],
        landLabels: { arid: 'Arid', polar: 'Polar', temperate: 'Temperate', tropical: 'Tropical' },
        // Circle spells are always prepared for the land chosen after each
        // Long Rest. Only spells at or below the druid's level apply.
        spellsByLand: {
          arid:      [{ name: 'Blur', minLevel: 3 }, { name: 'Burning Hands', minLevel: 3 }, { name: 'Fire Bolt', minLevel: 3 }, { name: 'Fireball', minLevel: 5 }, { name: 'Blight', minLevel: 7 }, { name: 'Wall of Stone', minLevel: 9 }],
          polar:     [{ name: 'Fog Cloud', minLevel: 3 }, { name: 'Hold Person', minLevel: 3 }, { name: 'Ray of Frost', minLevel: 3 }, { name: 'Sleet Storm', minLevel: 5 }, { name: 'Ice Storm', minLevel: 7 }, { name: 'Cone of Cold', minLevel: 9 }],
          temperate: [{ name: 'Misty Step', minLevel: 3 }, { name: 'Shocking Grasp', minLevel: 3 }, { name: 'Sleep', minLevel: 3 }, { name: 'Lightning Bolt', minLevel: 5 }, { name: 'Freedom of Movement', minLevel: 7 }, { name: 'Tree Stride', minLevel: 9 }],
          tropical:  [{ name: 'Acid Splash', minLevel: 3 }, { name: 'Ray of Sickness', minLevel: 3 }, { name: 'Web', minLevel: 3 }, { name: 'Stinking Cloud', minLevel: 5 }, { name: 'Polymorph', minLevel: 7 }, { name: 'Insect Plague', minLevel: 9 }]
        },
        features: {
          3: [
            { name: 'Circle of the Land Spells', desc: 'After each Long Rest choose a land: Arid, Polar, Temperate or Tropical. That land\'s Circle spells are always prepared. Switch it with the Land picker in your Spells section.' },
            { name: "Land's Aid", desc: 'Magic action, spend a Wild Shape use: 10-ft-radius sphere within 60 ft. Chosen creatures make a Con save vs your spell DC: 2d6 Necrotic, half on a success. One creature you choose in the area regains 2d6 HP. (3d6 at druid level 10, 4d6 at 14.)' }
          ],
          6: [
            { name: 'Natural Recovery', desc: 'Once per Long Rest: cast one prepared level 1+ Circle spell without a slot. Also once per Long Rest, on a Short Rest, recover spell slots totalling up to half your druid level (rounded up), none of level 6+.' }
          ],
          10: [
            { name: "Nature's Ward", desc: 'You are immune to the Poisoned condition, and have Resistance to a damage type set by your current land: Arid Fire, Polar Cold, Temperate Lightning, Tropical Poison.' }
          ],
          14: [
            { name: "Nature's Sanctuary", desc: 'Magic action, spend a Wild Shape use: spectral trees fill a 15-ft cube within 120 ft for 1 minute. You and allies have Half Cover there and gain your Nature\'s Ward resistance. Bonus Action: move the cube up to 60 ft.' }
          ]
        },
        // Land's Aid dice grow at these druid levels.
        landsAidDice: { 3: '2d6', 10: '3d6', 14: '4d6' },
        wardResistance: { arid: 'Fire', polar: 'Cold', temperate: 'Lightning', tropical: 'Poison' },
        resources: {
          6: [
            { id: 'natural_recovery_cast', label: 'Natural Recovery — free Circle spell (1/long)', max: 1, recharge: 'long' },
            { id: 'natural_recovery_slots', label: 'Natural Recovery — slots on Short Rest (1/long)', max: 1, recharge: 'long' }
          ]
        }
      }
    }
  }
};

// Classes shown greyed out in the builder until their data is added.
const CLASSES_COMING_SOON = ['Barbarian', 'Bard', 'Cleric', 'Fighter', 'Monk', 'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard'];

window.CLASSES_2024 = CLASSES_2024;
window.CLASSES_COMING_SOON = CLASSES_COMING_SOON;
