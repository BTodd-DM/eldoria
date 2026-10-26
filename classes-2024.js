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

    // Circles. 2024 PHB: Land, Moon, Sea, Stars. Older books (on 2024 timing —
    // features the old book gives at level 2 arrive at 3): Dreams, Shepherd,
    // Spores, Wildfire. spellsByLevel = always-prepared Circle spells by druid
    // level. Resource max: number, 'pb', 'wis' (Wis modifier, min 1) or
    // 'level' (druid level). ⚠ DM CHECK: older-book and Moon numbers were
    // written from memory (Update 69).
    subclasses: {
      land: {
        id: 'land',
        name: 'Circle of the Land',
        source: 'PHB 2024',
        blurb: 'Draw on the land you know: switchable Circle spells, healing-and-harm bursts, and recovered spell slots.',
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
      },

      moon: {
        id: 'moon', name: 'Circle of the Moon', source: 'PHB 2024', level: 3,
        blurb: 'A shapeshifter: tougher, stronger Wild Shape forms, and moonlight magic.',
        spellsByLevel: [{ name: 'Cure Wounds', minLevel: 3 }, { name: 'Moonbeam', minLevel: 3 }, { name: 'Starry Wisp', minLevel: 3 },
                        { name: 'Conjure Animals', minLevel: 5 }, { name: 'Fount of Moonlight', minLevel: 7 }, { name: 'Mass Cure Wounds', minLevel: 9 }],
        moonForms: true,
        features: {
          3: [{ name: 'Circle Forms', desc: 'Wild Shape into beasts up to CR = druid level ÷ 3 (rounded down). While shaped: your AC is at least 13 + Wis mod, and you gain temp HP equal to three times your druid level.' },
              { name: 'Circle of the Moon Spells', desc: 'Moon spells are always prepared (see Spells). You can cast them while in Wild Shape.' }],
          6: [{ name: 'Improved Circle Forms', desc: 'Your Wild Shape attacks can deal Radiant damage instead of their normal type, and you add your Wis mod to Con saves while shaped.' }],
          10: [{ name: 'Moonlight Step', desc: 'Bonus Action: teleport up to 30 ft to a space you can see, with Advantage on your next attack this turn. Uses = Wis mod per Long Rest; spend a level 2+ slot to regain a use.' }],
          14: [{ name: 'Lunar Form', desc: 'Once per turn, a hit while in Wild Shape deals +2d10 Radiant. Moonlight Step can take one willing creature within 10 ft with you.' }]
        },
        resources: { 10: [{ id: 'moonlight_step', label: 'Moonlight Step', max: 'wis', recharge: 'long' }] }
      },

      sea: {
        id: 'sea', name: 'Circle of the Sea', source: 'PHB 2024', level: 3,
        blurb: 'Wield the storm-tossed sea: a freezing, shoving aura of wind and water.',
        spellsByLevel: [{ name: 'Fog Cloud', minLevel: 3 }, { name: 'Gust of Wind', minLevel: 3 }, { name: 'Ray of Frost', minLevel: 3 }, { name: 'Shatter', minLevel: 3 }, { name: 'Thunderwave', minLevel: 3 },
                        { name: 'Lightning Bolt', minLevel: 5 }, { name: 'Water Breathing', minLevel: 5 }, { name: 'Control Water', minLevel: 7 }, { name: 'Ice Storm', minLevel: 7 },
                        { name: 'Conjure Elemental', minLevel: 9 }, { name: 'Hold Monster', minLevel: 9 }],
        features: {
          3: [{ name: 'Wrath of the Sea', desc: 'Bonus Action, spend a Wild Shape use: a 5-ft emanation of ocean spray for 10 minutes. When you create it and as a Bonus Action later, one creature in it makes a Con save or takes Cold damage (d6s equal to your Wis mod, min 1) and is pushed up to 15 ft if Large or smaller.' },
              { name: 'Circle of the Sea Spells', desc: 'Sea spells are always prepared (see Spells).' }],
          6: [{ name: 'Aquatic Affinity', desc: 'Wrath of the Sea grows to 10 ft, and you gain a Swim speed equal to your Speed.' }],
          10: [{ name: 'Stormborn', desc: 'While Wrath of the Sea is active: Fly speed equal to your Speed, and Resistance to Cold, Lightning and Thunder.' }],
          14: [{ name: 'Oceanic Gift', desc: 'You can centre Wrath of the Sea on a willing creature within 60 ft instead of you — or on both of you by spending two Wild Shape uses.' }]
        }
      },

      stars: {
        id: 'stars', name: 'Circle of the Stars', source: 'PHB 2024', level: 3,
        blurb: 'Read the heavens: a glowing starry form for archery, healing or focus, and omens.',
        spellsByLevel: [{ name: 'Guidance', minLevel: 3 }, { name: 'Guiding Bolt', minLevel: 3 }],
        features: {
          3: [{ name: 'Star Map', desc: 'A star chart is your focus. Guidance and Guiding Bolt are always prepared, and you can cast Guiding Bolt without a slot a number of times equal to your Wis mod per Long Rest.' },
              { name: 'Starry Form', desc: 'Bonus Action, spend a Wild Shape use: glow for 10 minutes as one constellation. Archer: Bonus Action ranged spell attack, 1d8 + Wis Radiant. Chalice: when you heal with a slot, you or a creature within 30 ft regains 1d8 + Wis. Dragon: treat a d20 of 9 or lower as 10 on Int/Wis checks and Concentration saves.' }],
          6: [{ name: 'Cosmic Omen', desc: 'After a Long Rest roll a die — even: Weal, odd: Woe. Reaction when a creature within 30 ft makes a D20 Test: add (Weal) or subtract (Woe) 1d6. Uses = Wis mod per Long Rest.' }],
          10: [{ name: 'Twinkling Constellations', desc: 'Archer and Chalice use 2d8. Dragon gives a 20-ft Fly speed with hover. You can switch constellation at the start of each of your turns.' }],
          14: [{ name: 'Full of Stars', desc: 'While in Starry Form you have Resistance to Bludgeoning, Piercing and Slashing damage.' }]
        },
        resources: { 3: [{ id: 'star_map_bolt', label: 'Star Map — free Guiding Bolt', max: 'wis', recharge: 'long' }],
                     6: [{ id: 'cosmic_omen', label: 'Cosmic Omen', max: 'wis', recharge: 'long' }] }
      },

      dreams: {
        id: 'dreams', name: 'Circle of Dreams', source: "Xanathar's Guide (older book)", level: 3,
        blurb: 'Touched by the Feywild: healing magic, safe camps and fey paths.',
        features: {
          3: [{ name: 'Balm of the Summer Court', desc: 'A pool of d6s equal to your druid level, refilled on a Long Rest. Bonus Action: spend up to half your druid level in dice to heal a creature within 120 ft, which also gains 1 temp HP per die.' }],
          6: [{ name: 'Hearth of Moonlight and Shadow', desc: 'During a rest, ward a 30-ft sphere: you and allies there get +5 to Stealth and Perception, and light inside can\'t be seen from outside.' }],
          10: [{ name: 'Hidden Paths', desc: 'Bonus Action: teleport up to 60 ft to a space you can see — or, as an action, teleport a willing creature you touch 30 ft. Uses = Wis mod per Long Rest.' }],
          14: [{ name: 'Walker in Dreams', desc: 'Once per Long Rest, after a Short Rest, cast Dream, Scrying or Teleportation Circle without a slot (with a location you visited during your last Long Rest).' }]
        },
        resources: { 3: [{ id: 'balm_dice', label: 'Balm of the Summer Court — d6 pool', max: 'level', recharge: 'long' }],
                     10: [{ id: 'hidden_paths', label: 'Hidden Paths', max: 'wis', recharge: 'long' }],
                     14: [{ id: 'walker_in_dreams', label: 'Walker in Dreams (1/long)', max: 1, recharge: 'long' }] }
      },

      shepherd: {
        id: 'shepherd', name: 'Circle of the Shepherd', source: "Xanathar's Guide (older book)", level: 3,
        blurb: 'Speak for the wild\'s creatures: spirit totems that empower allies and summoned beasts.',
        features: {
          3: [{ name: 'Speech of the Woods', desc: 'You learn Sylvan, and Beasts can understand your speech while you understand theirs.' },
              { name: 'Spirit Totem', desc: 'Bonus Action, once per Short or Long Rest: a spirit appears within 60 ft for 1 minute with a 30-ft aura. Bear: allies in it gain 5 + druid level temp HP and Advantage on Str checks and saves. Hawk: Reaction to give Advantage to an attack against a creature in the aura; you have Advantage on Perception. Unicorn: Advantage to find creatures in the aura; your healing spells also heal each ally in it by your druid level.' }],
          6: [{ name: 'Mighty Summoner', desc: 'Beasts and Fey you summon get +2 HP per Hit Die and their attacks count as magical.' }],
          10: [{ name: 'Guardian Spirit', desc: 'Your summoned Beasts and Fey that end their turn in your Spirit Totem aura regain HP equal to half your druid level.' }],
          14: [{ name: 'Faithful Summons', desc: 'Once per Long Rest, when you drop to 0 HP or are Incapacitated, four beasts of CR 2 or lower appear to protect you for 1 hour (as Conjure Animals at 9th level).' }]
        },
        resources: { 3: [{ id: 'spirit_totem', label: 'Spirit Totem (1/short rest)', max: 1, recharge: 'short' }],
                     14: [{ id: 'faithful_summons', label: 'Faithful Summons (1/long)', max: 1, recharge: 'long' }] }
      },

      spores: {
        id: 'spores', name: 'Circle of Spores', source: "Tasha's Cauldron (older book)", level: 3,
        blurb: 'Life in decay: a cloud of harmful spores, a fungal battle-form, and raised dead.',
        spellsByLevel: [{ name: 'Chill Touch', minLevel: 3 }, { name: 'Blindness/Deafness', minLevel: 3 }, { name: 'Gentle Repose', minLevel: 3 },
                        { name: 'Animate Dead', minLevel: 5 }, { name: 'Gaseous Form', minLevel: 5 }, { name: 'Blight', minLevel: 7 }, { name: 'Confusion', minLevel: 7 },
                        { name: 'Cloudkill', minLevel: 9 }, { name: 'Contagion', minLevel: 9 }],
        sporesSheet: true,
        haloDice: { 3: '1d4', 6: '1d6', 10: '1d8', 14: '1d10' },
        features: {
          3: [{ name: 'Halo of Spores', desc: 'Reaction when a creature you can see moves into a space within 10 ft of you or starts its turn there: it makes a Con save or takes Necrotic damage (1d4; 1d6 at level 6, 1d8 at 10, 1d10 at 14). Roll it from the 🍄 Spores bar on your sheet.' },
              { name: 'Symbiotic Entity', desc: 'Action, spend a Wild Shape use: gain 4 temp HP per druid level for 10 minutes (or until the temp HP are gone, or you Wild Shape). While active, your Halo of Spores rolls its die twice, and your melee weapon attacks deal +1d6 Necrotic.' },
              { name: 'Circle of Spores Spells', desc: 'Spores spells are always prepared (see Spells). You know Chill Touch.' }],
          6: [{ name: 'Fungal Infestation', desc: 'Reaction when a Small or Medium Beast or Humanoid dies within 10 ft: it rises as a Zombie with 1 HP, acting right after you for 1 hour. Uses = Wis mod per Long Rest. Use the Fungal Infestation button in your minions section.' }],
          10: [{ name: 'Spreading Spores', desc: 'While Symbiotic Entity is active, Bonus Action: hurl spores into a 10-ft cube within 30 ft for 1 minute — creatures moving into or starting their turn there take your Halo damage (Con save). You can\'t use Halo of Spores as a Reaction meanwhile.' }],
          14: [{ name: 'Fungal Body', desc: 'You can\'t be Blinded, Deafened, Frightened or Poisoned, and critical hits against you count as normal hits unless you are Incapacitated.' }]
        },
        resources: { 6: [{ id: 'fungal_infestation', label: 'Fungal Infestation', max: 'wis', recharge: 'long' }] }
      },

      wildfire: {
        id: 'wildfire', name: 'Circle of Wildfire', source: "Tasha's Cauldron (older book)", level: 3,
        blurb: 'Renewal through flame: a fiery spirit companion that burns foes and heals friends.',
        spellsByLevel: [{ name: 'Burning Hands', minLevel: 3 }, { name: 'Cure Wounds', minLevel: 3 }, { name: 'Flaming Sphere', minLevel: 3 }, { name: 'Scorching Ray', minLevel: 3 },
                        { name: 'Plant Growth', minLevel: 5 }, { name: 'Revivify', minLevel: 5 }, { name: 'Aura of Life', minLevel: 7 }, { name: 'Fire Shield', minLevel: 7 },
                        { name: 'Flame Strike', minLevel: 9 }, { name: 'Mass Cure Wounds', minLevel: 9 }],
        features: {
          3: [{ name: 'Summon Wildfire Spirit', desc: 'Action, spend a Wild Shape use: a fiery spirit appears within 30 ft for 1 hour; creatures within 10 ft of it make a Dex save or take 2d6 Fire. It acts after you: AC 13, HP 5 + 5 × druid level, Fly 30 ft. Flame Seed: ranged attack, 1d6 + PB Fire. Fiery Teleportation: it and willing allies within 5 ft teleport 15 ft; creatures next to where it left take 1d6 + PB Fire (Dex save).' },
              { name: 'Circle of Wildfire Spells', desc: 'Wildfire spells are always prepared (see Spells).' }],
          6: [{ name: 'Enhanced Bond', desc: 'While your spirit is summoned, a spell you cast that deals Fire damage or heals adds 1d8 to one roll, and your spells can start from the spirit.' }],
          10: [{ name: 'Cauterizing Flames', desc: 'When a Small or larger creature dies within 30 ft of you or your spirit, a spectral flame burns in its space for 1 minute. Reaction when a creature enters it: heal it or burn it for 2d10 + Wis mod. Uses = PB per Long Rest.' }],
          14: [{ name: 'Blazing Revival', desc: 'Once per Long Rest, when you drop to 0 HP with your spirit within 120 ft, it drops to 0 instead and you regain half your HP and stand up.' }]
        },
        resources: { 10: [{ id: 'cauterizing_flames', label: 'Cauterizing Flames', max: 'pb', recharge: 'long' }],
                     14: [{ id: 'blazing_revival', label: 'Blazing Revival (1/long)', max: 1, recharge: 'long' }] }
      }
    }
  }
};

// Classes shown greyed out in the builder until their data is added.
const CLASSES_COMING_SOON = ['Barbarian', 'Bard', 'Cleric', 'Fighter', 'Monk', 'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard'];

window.CLASSES_2024 = CLASSES_2024;
window.CLASSES_COMING_SOON = CLASSES_COMING_SOON;
