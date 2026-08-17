// =====================================================================
// THE WAYWARD COMPANY — 2024 MONSTER CATALOG
// ---------------------------------------------------------------------
// Curated set of ~40 monsters covering campaign-relevant threats:
// humanoids (Ironhold arc, city encounters), beasts, undead, fiends,
// goblinoids/orcs, dragons, ogres, and one full lich stat block for
// Vaeloran's endgame.
//
// Stat blocks are 2024-flavoured but light — CR / XP / AC / HP / speed /
// abilities / key traits / actions. Enough for combat tracker use;
// full-detail lookup happens in Obsidian if needed.
//
// Schema per entry:
//   id, name, size, type, alignment
//   ac, acNote, hp, hpFormula, speed
//   str, dex, con, int, wis, cha
//   saves    — { con: 5, wis: 4 } (optional)
//   skills   — { stealth: 6 } (optional)
//   damageResist, damageImmune, conditionImmune — arrays (optional)
//   senses, languages
//   cr (string), xp (number)
//   traits   — [{ name, desc }]
//   actions  — [{ name, desc }]
//   bonusActions, reactions, legendaryActions — optional [{ name, desc }]
//   source   — page reference (optional)
// =====================================================================

const MONSTERS_2024 = [

  // =================================================================
  // HUMANOIDS — city / bandit / cultist
  // =================================================================
  { id: 'bandit', name: 'Bandit', size: 'Medium', type: 'Humanoid', alignment: 'Any Non-Lawful',
    ac: 12, acNote: 'leather armor', hp: 11, hpFormula: '2d8+2', speed: '30 ft',
    str: 11, dex: 12, con: 12, int: 10, wis: 10, cha: 10,
    senses: 'passive Perception 10', languages: 'any one language (usually Common)',
    cr: '1/8', xp: 25,
    actions: [
      { name: 'Scimitar', desc: 'Melee Attack: +3 to hit, reach 5 ft. Hit: 4 (1d6+1) slashing.' },
      { name: 'Light Crossbow', desc: 'Ranged Attack: +3 to hit, range 80/320 ft. Hit: 5 (1d8+1) piercing.' }
    ], source: 'MM 2024' },

  { id: 'bandit_captain', name: 'Bandit Captain', size: 'Medium', type: 'Humanoid', alignment: 'Any Non-Lawful',
    ac: 15, acNote: 'studded leather', hp: 65, hpFormula: '10d8+20', speed: '30 ft',
    str: 15, dex: 16, con: 14, int: 14, wis: 11, cha: 14,
    saves: { str: 4, dex: 5, wis: 2 },
    skills: { athletics: 4, deception: 4 },
    senses: 'passive Perception 10', languages: 'any two languages',
    cr: '2', xp: 450,
    traits: [{ name: 'Multiattack (2)', desc: 'Makes two attacks; may substitute Pistol for Scimitar.' }],
    actions: [
      { name: 'Scimitar', desc: '+5 to hit, reach 5 ft. Hit: 6 (1d6+3) slashing.' },
      { name: 'Dagger', desc: '+5 to hit, reach 5 ft or range 20/60 ft. Hit: 5 (1d4+3) piercing.' }
    ],
    reactions: [{ name: 'Parry', desc: '+2 AC against one attack that would hit (must see attacker, wield melee weapon).' }],
    source: 'MM 2024' },

  { id: 'guard', name: 'Guard (Watch)', size: 'Medium', type: 'Humanoid', alignment: 'Any',
    ac: 16, acNote: 'chain shirt + shield', hp: 11, hpFormula: '2d8+2', speed: '30 ft',
    str: 13, dex: 12, con: 12, int: 10, wis: 11, cha: 10,
    skills: { perception: 2 },
    senses: 'passive Perception 12', languages: 'Common',
    cr: '1/8', xp: 25,
    actions: [
      { name: 'Spear', desc: '+3 to hit, reach 5 ft or thrown 20/60 ft. Hit: 4 (1d6+1) piercing, or 5 (1d8+1) two-handed melee.' }
    ], source: 'MM 2024' },

  { id: 'veteran', name: 'Veteran (elite guard)', size: 'Medium', type: 'Humanoid', alignment: 'Any',
    ac: 17, acNote: 'splint', hp: 58, hpFormula: '9d8+18', speed: '30 ft',
    str: 16, dex: 13, con: 14, int: 10, wis: 11, cha: 10,
    skills: { athletics: 5, perception: 2 },
    senses: 'passive Perception 12', languages: 'Common',
    cr: '3', xp: 700,
    traits: [{ name: 'Multiattack (3)', desc: 'Two longsword attacks and one shortsword attack (if wielded).' }],
    actions: [
      { name: 'Longsword', desc: '+5 to hit, reach 5 ft. Hit: 7 (1d8+3) slashing, or 8 (1d10+3) two-handed.' },
      { name: 'Shortsword', desc: '+5 to hit, reach 5 ft. Hit: 6 (1d6+3) piercing.' },
      { name: 'Heavy Crossbow', desc: '+3 to hit, range 100/400 ft. Hit: 6 (1d10+1) piercing.' }
    ], source: 'MM 2024' },

  { id: 'thug', name: 'Thug', size: 'Medium', type: 'Humanoid', alignment: 'Any Non-Good',
    ac: 11, acNote: 'leather', hp: 32, hpFormula: '5d8+10', speed: '30 ft',
    str: 15, dex: 11, con: 14, int: 10, wis: 10, cha: 11,
    skills: { intimidation: 2 },
    senses: 'passive Perception 10', languages: 'any one language',
    cr: '1/2', xp: 100,
    traits: [{ name: "Pack Tactics", desc: 'Advantage on attack rolls against a creature if at least one ally is within 5 ft of it.' }],
    actions: [
      { name: 'Multiattack (2)', desc: 'Two mace attacks.' },
      { name: 'Mace', desc: '+4 to hit, reach 5 ft. Hit: 5 (1d6+2) bludgeoning.' },
      { name: 'Heavy Crossbow', desc: '+2 to hit, range 100/400 ft. Hit: 5 (1d10) piercing.' }
    ], source: 'MM 2024' },

  { id: 'assassin', name: 'Assassin', size: 'Medium', type: 'Humanoid', alignment: 'Any Non-Good',
    ac: 15, acNote: 'studded leather', hp: 78, hpFormula: '12d8+24', speed: '30 ft',
    str: 11, dex: 16, con: 14, int: 13, wis: 11, cha: 10,
    saves: { dex: 6, int: 4 },
    skills: { acrobatics: 6, deception: 3, perception: 3, stealth: 9 },
    damageResist: ['poison'],
    senses: 'passive Perception 13', languages: 'Common + Thieves\' Cant',
    cr: '8', xp: 3900,
    traits: [
      { name: 'Assassinate', desc: 'Advantage on attacks against surprised targets. Any hit is a critical hit.' },
      { name: 'Evasion', desc: 'Half damage on failed Dex saves; no damage on success.' },
      { name: 'Sneak Attack (4d6)', desc: 'Once per turn, +14 (4d6) damage on a hit with advantage or when an ally is adjacent to the target.' }
    ],
    actions: [
      { name: 'Multiattack (2)', desc: 'Two shortsword attacks.' },
      { name: 'Shortsword', desc: '+6 to hit, reach 5 ft. Hit: 6 (1d6+3) piercing + 24 (7d8) poison DC 15 Con save half.' },
      { name: 'Light Crossbow', desc: '+6 to hit, range 80/320 ft. Hit: 7 (1d8+3) piercing + 24 (7d8) poison DC 15 Con save half.' }
    ], source: 'MM 2024' },

  { id: 'spy', name: 'Spy', size: 'Medium', type: 'Humanoid', alignment: 'Any',
    ac: 12, hp: 27, hpFormula: '6d8', speed: '30 ft',
    str: 10, dex: 15, con: 10, int: 12, wis: 14, cha: 16,
    skills: { deception: 5, insight: 4, investigation: 5, perception: 6, persuasion: 5, sleight_of_hand: 4, stealth: 4 },
    senses: 'passive Perception 16', languages: 'any two languages',
    cr: '1', xp: 200,
    traits: [
      { name: 'Cunning Action', desc: 'Dash/Disengage/Hide as bonus action.' },
      { name: 'Sneak Attack (2d6)', desc: '+7 (2d6) damage on a hit with advantage or an adjacent ally.' }
    ],
    actions: [
      { name: 'Multiattack (2)', desc: 'Two shortsword or hand crossbow attacks.' },
      { name: 'Shortsword', desc: '+4 to hit, reach 5 ft. Hit: 5 (1d6+2) piercing.' },
      { name: 'Hand Crossbow', desc: '+4 to hit, range 30/120 ft. Hit: 5 (1d6+2) piercing.' }
    ], source: 'MM 2024' },

  { id: 'cultist', name: 'Cultist', size: 'Medium', type: 'Humanoid', alignment: 'Any Non-Good',
    ac: 12, acNote: 'leather', hp: 9, hpFormula: '2d8', speed: '30 ft',
    str: 11, dex: 12, con: 10, int: 10, wis: 11, cha: 10,
    skills: { deception: 2, religion: 2 },
    senses: 'passive Perception 10', languages: 'any one',
    cr: '1/8', xp: 25,
    traits: [{ name: 'Dark Devotion', desc: 'Advantage on saves against being charmed or frightened.' }],
    actions: [
      { name: 'Scimitar', desc: '+3 to hit, reach 5 ft. Hit: 4 (1d6+1) slashing.' }
    ], source: 'MM 2024' },

  { id: 'cult_fanatic', name: 'Cult Fanatic', size: 'Medium', type: 'Humanoid', alignment: 'Any Non-Good',
    ac: 13, acNote: 'leather', hp: 33, hpFormula: '6d8+6', speed: '30 ft',
    str: 11, dex: 14, con: 12, int: 10, wis: 13, cha: 14,
    skills: { deception: 4, persuasion: 4, religion: 2 },
    senses: 'passive Perception 11', languages: 'any one',
    cr: '2', xp: 450,
    traits: [
      { name: 'Dark Devotion', desc: 'Advantage on saves vs charmed/frightened.' },
      { name: 'Spellcasting', desc: 'Cleric 4. WIS spell save DC 11, +3 to hit. Prepared: Light, Sacred Flame, Thaumaturgy · L1 (4): Command, Inflict Wounds, Shield of Faith · L2 (3): Hold Person, Spiritual Weapon.' }
    ],
    actions: [
      { name: 'Multiattack (2)', desc: 'Two dagger attacks.' },
      { name: 'Dagger', desc: '+4 to hit, reach 5 ft or range 20/60 ft. Hit: 4 (1d4+2) piercing.' }
    ], source: 'MM 2024' },

  { id: 'priest', name: 'Priest', size: 'Medium', type: 'Humanoid', alignment: 'Any',
    ac: 13, acNote: 'chain shirt', hp: 27, hpFormula: '5d8+5', speed: '30 ft',
    str: 10, dex: 10, con: 12, int: 13, wis: 16, cha: 13,
    skills: { medicine: 7, persuasion: 3, religion: 5 },
    senses: 'passive Perception 13', languages: 'any two',
    cr: '2', xp: 450,
    traits: [
      { name: 'Divine Eminence', desc: 'As a bonus action, expend a spell slot to add +10 (2d6) radiant/necrotic damage on next melee hit (extra die per slot level above 1st, max 5d6).' },
      { name: 'Spellcasting', desc: 'Cleric 5. WIS DC 13, +5 to hit. Prepared: Guidance, Light, Sacred Flame, Thaumaturgy · L1 (4): Bless, Cure Wounds, Guiding Bolt, Sanctuary · L2 (3): Lesser Restoration, Spiritual Weapon · L3 (2): Dispel Magic, Spirit Guardians.' }
    ],
    actions: [
      { name: 'Mace', desc: '+2 to hit, reach 5 ft. Hit: 3 (1d6) bludgeoning.' }
    ], source: 'MM 2024' },

  { id: 'scout', name: 'Scout', size: 'Medium', type: 'Humanoid', alignment: 'Any',
    ac: 13, acNote: 'leather', hp: 16, hpFormula: '3d8+3', speed: '30 ft',
    str: 11, dex: 14, con: 12, int: 11, wis: 13, cha: 11,
    skills: { nature: 4, perception: 5, stealth: 6, survival: 5 },
    senses: 'passive Perception 15', languages: 'any one',
    cr: '1/2', xp: 100,
    actions: [
      { name: 'Multiattack (2)', desc: 'Two melee attacks or two ranged.' },
      { name: 'Shortsword', desc: '+4 to hit, reach 5 ft. Hit: 5 (1d6+2) piercing.' },
      { name: 'Longbow', desc: '+4 to hit, range 150/600 ft. Hit: 6 (1d8+2) piercing.' }
    ], source: 'MM 2024' },

  // =================================================================
  // GOBLINOIDS / ORCS
  // =================================================================
  { id: 'goblin', name: 'Goblin', size: 'Small', type: 'Humanoid (goblinoid)', alignment: 'Neutral Evil',
    ac: 15, acNote: 'leather armor + shield', hp: 7, hpFormula: '2d6', speed: '30 ft',
    str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8,
    skills: { stealth: 6 },
    senses: 'Darkvision 60 ft, passive Perception 9', languages: 'Common, Goblin',
    cr: '1/4', xp: 50,
    traits: [{ name: 'Nimble Escape', desc: 'Disengage or Hide as bonus action.' }],
    actions: [
      { name: 'Scimitar', desc: '+4 to hit, reach 5 ft. Hit: 5 (1d6+2) slashing.' },
      { name: 'Shortbow', desc: '+4 to hit, range 80/320 ft. Hit: 5 (1d6+2) piercing.' }
    ], source: 'MM 2024' },

  { id: 'goblin_boss', name: 'Goblin Boss', size: 'Small', type: 'Humanoid (goblinoid)', alignment: 'Neutral Evil',
    ac: 17, acNote: 'chain shirt + shield', hp: 21, hpFormula: '6d6', speed: '30 ft',
    str: 10, dex: 14, con: 10, int: 10, wis: 8, cha: 10,
    skills: { stealth: 6 },
    senses: 'Darkvision 60 ft, passive Perception 9', languages: 'Common, Goblin',
    cr: '1', xp: 200,
    traits: [{ name: 'Nimble Escape', desc: 'Disengage or Hide as bonus action.' }],
    actions: [
      { name: 'Multiattack (2)', desc: 'Scimitar + throw javelin (or scimitar melee twice).' },
      { name: 'Scimitar', desc: '+4 to hit, reach 5 ft. Hit: 5 (1d6+2) slashing.' },
      { name: 'Javelin', desc: '+4 to hit, reach 5 ft or range 30/120 ft. Hit: 5 (1d6+2) piercing.' }
    ],
    reactions: [{ name: 'Redirect Attack', desc: 'When an attack would hit, swap places with an adjacent goblin ally to force the attack to hit them.' }],
    source: 'MM 2024' },

  { id: 'hobgoblin', name: 'Hobgoblin', size: 'Medium', type: 'Humanoid (goblinoid)', alignment: 'Lawful Evil',
    ac: 18, acNote: 'chain mail + shield', hp: 11, hpFormula: '2d8+2', speed: '30 ft',
    str: 13, dex: 12, con: 12, int: 10, wis: 10, cha: 9,
    senses: 'Darkvision 60 ft, passive Perception 10', languages: 'Common, Goblin',
    cr: '1/2', xp: 100,
    traits: [{ name: 'Martial Advantage', desc: 'Once per turn, +7 (2d6) damage on a hit if an ally is within 5 ft of target.' }],
    actions: [
      { name: 'Longsword', desc: '+3 to hit, reach 5 ft. Hit: 5 (1d8+1) slashing, or 6 (1d10+1) two-handed.' },
      { name: 'Longbow', desc: '+3 to hit, range 150/600 ft. Hit: 5 (1d8+1) piercing.' }
    ], source: 'MM 2024' },

  { id: 'bugbear', name: 'Bugbear', size: 'Medium', type: 'Humanoid (goblinoid)', alignment: 'Chaotic Evil',
    ac: 16, acNote: 'hide + shield', hp: 27, hpFormula: '5d8+5', speed: '30 ft',
    str: 15, dex: 14, con: 13, int: 8, wis: 11, cha: 9,
    skills: { stealth: 6, survival: 2 },
    senses: 'Darkvision 60 ft, passive Perception 10', languages: 'Common, Goblin',
    cr: '1', xp: 200,
    traits: [
      { name: 'Brute', desc: 'A melee weapon deals one extra die of damage on a hit (included).' },
      { name: 'Surprise Attack', desc: 'If it surprises a creature and hits in the first round, +7 (2d6) damage.' }
    ],
    actions: [
      { name: 'Morningstar', desc: '+4 to hit, reach 5 ft. Hit: 11 (2d8+2) piercing.' },
      { name: 'Javelin', desc: '+4 to hit, reach 5 ft or range 30/120 ft. Hit: 9 (2d6+2) piercing melee, or 5 (1d6+2) ranged.' }
    ], source: 'MM 2024' },

  { id: 'orc', name: 'Orc', size: 'Medium', type: 'Humanoid (orc)', alignment: 'Chaotic Evil',
    ac: 13, acNote: 'hide', hp: 15, hpFormula: '2d8+6', speed: '30 ft',
    str: 16, dex: 12, con: 16, int: 7, wis: 11, cha: 10,
    skills: { intimidation: 2 },
    senses: 'Darkvision 60 ft, passive Perception 10', languages: 'Common, Orc',
    cr: '1/2', xp: 100,
    traits: [{ name: 'Aggressive', desc: 'Bonus action: move up to speed toward a hostile creature you can see.' }],
    actions: [
      { name: 'Greataxe', desc: '+5 to hit, reach 5 ft. Hit: 9 (1d12+3) slashing.' },
      { name: 'Javelin', desc: '+5 to hit, reach 5 ft or range 30/120 ft. Hit: 6 (1d6+3) piercing.' }
    ], source: 'MM 2024' },

  // =================================================================
  // BEASTS
  // =================================================================
  { id: 'wolf', name: 'Wolf', size: 'Medium', type: 'Beast', alignment: 'Unaligned',
    ac: 13, hp: 11, hpFormula: '2d8+2', speed: '40 ft',
    str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6,
    skills: { perception: 3, stealth: 4 },
    senses: 'passive Perception 13', languages: '—',
    cr: '1/4', xp: 50,
    traits: [
      { name: 'Keen Hearing & Smell', desc: 'Advantage on Perception checks that rely on hearing or smell.' },
      { name: 'Pack Tactics', desc: 'Advantage on attacks if ally is within 5 ft of target.' }
    ],
    actions: [
      { name: 'Bite', desc: '+4 to hit, reach 5 ft. Hit: 7 (2d4+2) piercing. DC 11 Str save or knocked prone.' }
    ], source: 'MM 2024' },

  { id: 'dire_wolf', name: 'Dire Wolf', size: 'Large', type: 'Beast', alignment: 'Unaligned',
    ac: 14, hp: 37, hpFormula: '5d10+10', speed: '50 ft',
    str: 17, dex: 15, con: 15, int: 3, wis: 12, cha: 7,
    skills: { perception: 3, stealth: 4 },
    senses: 'passive Perception 13', languages: '—',
    cr: '1', xp: 200,
    traits: [
      { name: 'Keen Hearing & Smell', desc: 'Advantage on Perception rolls using hearing/smell.' },
      { name: 'Pack Tactics', desc: 'Advantage on attacks if ally is within 5 ft of target.' }
    ],
    actions: [
      { name: 'Bite', desc: '+5 to hit, reach 5 ft. Hit: 10 (2d6+3) piercing. DC 13 Str save or knocked prone.' }
    ], source: 'MM 2024' },

  { id: 'brown_bear', name: 'Brown Bear', size: 'Large', type: 'Beast', alignment: 'Unaligned',
    ac: 11, hp: 34, hpFormula: '4d10+12', speed: '40 ft, climb 30 ft',
    str: 19, dex: 10, con: 16, int: 2, wis: 13, cha: 7,
    skills: { perception: 3 },
    senses: 'passive Perception 13', languages: '—',
    cr: '1', xp: 200,
    traits: [{ name: 'Keen Smell', desc: 'Advantage on Perception rolls relying on smell.' }],
    actions: [
      { name: 'Multiattack (2)', desc: 'Bite + claws.' },
      { name: 'Bite', desc: '+5 to hit, reach 5 ft. Hit: 8 (1d8+4) piercing.' },
      { name: 'Claws', desc: '+5 to hit, reach 5 ft. Hit: 11 (2d6+4) slashing.' }
    ], source: 'MM 2024' },

  { id: 'giant_spider', name: 'Giant Spider', size: 'Large', type: 'Beast', alignment: 'Unaligned',
    ac: 14, hp: 26, hpFormula: '4d10+4', speed: '30 ft, climb 30 ft',
    str: 14, dex: 16, con: 12, int: 2, wis: 11, cha: 4,
    skills: { stealth: 7 },
    senses: 'Blindsight 10 ft, Darkvision 60 ft, passive Perception 10', languages: '—',
    cr: '1', xp: 200,
    traits: [
      { name: 'Spider Climb', desc: 'Can climb any surface without a check.' },
      { name: 'Web Sense', desc: 'While in contact with a web, knows exact location of any creature in contact with the same web.' },
      { name: 'Web Walker', desc: 'Ignores movement restrictions caused by webbing.' }
    ],
    actions: [
      { name: 'Bite', desc: '+5 to hit, reach 5 ft. Hit: 7 (1d8+3) piercing + 9 (2d8) poison DC 11 Con save half. If reduced to 0, incapacitated 1hr.' },
      { name: 'Web (recharge 5-6)', desc: 'Ranged 30/60 ft, one Large or smaller. DC 12 Dex or restrained (AC 10, HP 5, vulnerable fire, immune bludgeoning/poison/psychic).' }
    ], source: 'MM 2024' },

  { id: 'giant_wolf_spider', name: 'Giant Wolf Spider', size: 'Medium', type: 'Beast', alignment: 'Unaligned',
    ac: 13, hp: 11, hpFormula: '2d8+2', speed: '40 ft, climb 40 ft',
    str: 12, dex: 16, con: 13, int: 3, wis: 12, cha: 4,
    skills: { perception: 3, stealth: 7 },
    senses: 'Blindsight 10 ft, Darkvision 60 ft, passive Perception 13', languages: '—',
    cr: '1/4', xp: 50,
    actions: [
      { name: 'Bite', desc: '+3 to hit, reach 5 ft. Hit: 4 (1d6+1) piercing + 7 (2d6) poison DC 11 Con save half. If reduced to 0, poisoned 1hr.' }
    ], source: 'MM 2024' },

  { id: 'giant_rat', name: 'Giant Rat', size: 'Small', type: 'Beast', alignment: 'Unaligned',
    ac: 12, hp: 7, hpFormula: '2d6', speed: '30 ft',
    str: 7, dex: 15, con: 11, int: 2, wis: 10, cha: 4,
    senses: 'Darkvision 60 ft, passive Perception 10', languages: '—',
    cr: '1/8', xp: 25,
    traits: [
      { name: 'Keen Smell', desc: 'Advantage on Perception rolls using smell.' },
      { name: 'Pack Tactics', desc: 'Advantage on attacks if ally within 5 ft of target.' }
    ],
    actions: [
      { name: 'Bite', desc: '+4 to hit, reach 5 ft. Hit: 4 (1d4+2) piercing.' }
    ], source: 'MM 2024' },

  { id: 'boar', name: 'Boar', size: 'Medium', type: 'Beast', alignment: 'Unaligned',
    ac: 11, hp: 11, hpFormula: '2d8+2', speed: '40 ft',
    str: 13, dex: 11, con: 12, int: 2, wis: 9, cha: 5,
    senses: 'passive Perception 9', languages: '—',
    cr: '1/4', xp: 50,
    traits: [
      { name: 'Charge', desc: 'If it moves 20 ft straight then hits with tusk, extra 3 (1d6) slashing + DC 11 Str save or prone.' },
      { name: 'Relentless (recharges after Short/Long Rest)', desc: 'If reduced to 0 by damage of 7 or less, drops to 1 instead.' }
    ],
    actions: [
      { name: 'Tusk', desc: '+3 to hit, reach 5 ft. Hit: 4 (1d6+1) slashing.' }
    ], source: 'MM 2024' },

  { id: 'giant_crocodile', name: 'Giant Crocodile', size: 'Huge', type: 'Beast', alignment: 'Unaligned',
    ac: 14, hp: 85, hpFormula: '9d12+27', speed: '30 ft, swim 50 ft',
    str: 21, dex: 9, con: 17, int: 2, wis: 10, cha: 7,
    skills: { stealth: 5 },
    senses: 'passive Perception 10', languages: '—',
    cr: '5', xp: 1800,
    traits: [{ name: 'Hold Breath', desc: 'Can hold breath for 30 minutes.' }],
    actions: [
      { name: 'Multiattack (2)', desc: 'Bite + tail.' },
      { name: 'Bite', desc: '+8 to hit, reach 5 ft. Hit: 21 (3d10+5) piercing + target grappled (escape DC 16). Grappled = restrained, no other bite.' },
      { name: 'Tail', desc: '+8 to hit, reach 10 ft, one creature not grappled by it. Hit: 14 (2d8+5) bludgeoning + DC 16 Str save or prone.' }
    ], source: 'MM 2024' },

  // =================================================================
  // UNDEAD
  // =================================================================
  { id: 'skeleton', name: 'Skeleton', size: 'Medium', type: 'Undead', alignment: 'Lawful Evil',
    ac: 13, acNote: 'armor scraps', hp: 13, hpFormula: '2d8+4', speed: '30 ft',
    str: 10, dex: 14, con: 15, int: 6, wis: 8, cha: 5,
    damageImmune: ['poison'], damageResist: ['exhaustion', 'poisoned'],
    senses: 'Darkvision 60 ft, passive Perception 9', languages: 'understands but doesn\'t speak',
    cr: '1/4', xp: 50,
    actions: [
      { name: 'Shortsword', desc: '+4 to hit, reach 5 ft. Hit: 5 (1d6+2) piercing.' },
      { name: 'Shortbow', desc: '+4 to hit, range 80/320 ft. Hit: 5 (1d6+2) piercing.' }
    ], source: 'MM 2024' },

  { id: 'zombie', name: 'Zombie', size: 'Medium', type: 'Undead', alignment: 'Neutral Evil',
    ac: 8, hp: 22, hpFormula: '3d8+9', speed: '20 ft',
    str: 13, dex: 6, con: 16, int: 3, wis: 6, cha: 5,
    saves: { wis: 0 },
    damageImmune: ['poison'], conditionImmune: ['poisoned'],
    senses: 'Darkvision 60 ft, passive Perception 8', languages: 'understands but doesn\'t speak',
    cr: '1/4', xp: 50,
    traits: [
      { name: 'Undead Fortitude', desc: 'When damage would drop it to 0, DC = 5 + damage Con save. Success: drops to 1 instead. Fails on radiant/crit.' }
    ],
    actions: [
      { name: 'Slam', desc: '+3 to hit, reach 5 ft. Hit: 4 (1d6+1) bludgeoning.' }
    ], source: 'MM 2024' },

  { id: 'ghoul', name: 'Ghoul', size: 'Medium', type: 'Undead', alignment: 'Chaotic Evil',
    ac: 12, hp: 22, hpFormula: '5d8', speed: '30 ft',
    str: 13, dex: 15, con: 10, int: 7, wis: 10, cha: 6,
    damageImmune: ['poison'], conditionImmune: ['charmed', 'exhaustion', 'poisoned'],
    senses: 'Darkvision 60 ft, passive Perception 10', languages: 'Common',
    cr: '1', xp: 200,
    actions: [
      { name: 'Bite', desc: '+2 to hit, reach 5 ft. Hit: 9 (2d6+2) piercing.' },
      { name: 'Claws', desc: '+4 to hit, reach 5 ft. Hit: 7 (2d4+2) slashing. If target isn\'t elf or undead, DC 10 Con save or paralyzed 1 min (save end).' }
    ], source: 'MM 2024' },

  { id: 'wight', name: 'Wight', size: 'Medium', type: 'Undead', alignment: 'Neutral Evil',
    ac: 14, acNote: 'studded leather', hp: 45, hpFormula: '6d8+18', speed: '30 ft',
    str: 15, dex: 14, con: 16, int: 10, wis: 13, cha: 15,
    skills: { perception: 3, stealth: 4 },
    damageResist: ['necrotic', 'bludgeoning/piercing/slashing from non-magical non-silvered weapons'],
    damageImmune: ['poison'],
    conditionImmune: ['exhaustion', 'poisoned'],
    senses: 'Darkvision 60 ft, passive Perception 13', languages: 'the languages it knew in life',
    cr: '3', xp: 700,
    traits: [{ name: 'Sunlight Sensitivity', desc: 'Disadvantage on attacks and Perception (sight) in sunlight.' }],
    actions: [
      { name: 'Multiattack (2)', desc: 'Two longsword attacks or two longbow attacks. May replace one attack with Life Drain.' },
      { name: 'Life Drain', desc: '+4 to hit, reach 5 ft. Hit: 5 (1d6+2) necrotic. DC 13 Con save or HP max reduced by damage dealt (until long rest). Killed target rises next midnight as zombie under the wight\'s command.' },
      { name: 'Longsword', desc: '+4 to hit, reach 5 ft. Hit: 6 (1d8+2) slashing, or 7 (1d10+2) two-handed.' },
      { name: 'Longbow', desc: '+4 to hit, range 150/600 ft. Hit: 6 (1d8+2) piercing.' }
    ], source: 'MM 2024' },

  { id: 'specter', name: 'Specter', size: 'Medium', type: 'Undead', alignment: 'Chaotic Evil',
    ac: 12, hp: 22, hpFormula: '5d8', speed: '0 ft, fly 50 ft (hover)',
    str: 1, dex: 14, con: 11, int: 10, wis: 10, cha: 11,
    damageResist: ['acid', 'cold', 'fire', 'lightning', 'thunder', 'bludgeoning/piercing/slashing from non-magical weapons'],
    damageImmune: ['necrotic', 'poison'],
    conditionImmune: ['charmed', 'exhaustion', 'grappled', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'unconscious'],
    senses: 'Darkvision 60 ft, passive Perception 10', languages: 'the languages it knew in life',
    cr: '1', xp: 200,
    traits: [
      { name: 'Incorporeal Movement', desc: 'Can move through creatures and objects (5 ft or less thick). Takes 5 (1d10) force if it ends its turn inside an object.' },
      { name: 'Sunlight Sensitivity', desc: 'Disadvantage on attacks and Perception (sight) in sunlight.' }
    ],
    actions: [
      { name: 'Life Drain', desc: '+4 to hit, reach 5 ft. Hit: 10 (3d6) necrotic. DC 10 Con save or HP max reduced by damage dealt (until long rest).' }
    ], source: 'MM 2024' },

  // =================================================================
  // FIENDS / FEY (small)
  // =================================================================
  { id: 'imp', name: 'Imp', size: 'Tiny', type: 'Fiend (devil)', alignment: 'Lawful Evil',
    ac: 13, hp: 10, hpFormula: '3d4+3', speed: '20 ft, fly 40 ft',
    str: 6, dex: 17, con: 13, int: 11, wis: 12, cha: 14,
    skills: { deception: 4, insight: 3, persuasion: 4, stealth: 5 },
    damageResist: ['cold', 'bludgeoning/piercing/slashing from non-magical non-silvered'],
    damageImmune: ['fire', 'poison'],
    conditionImmune: ['poisoned'],
    senses: 'Darkvision 120 ft, passive Perception 11', languages: 'Infernal, Common',
    cr: '1', xp: 200,
    traits: [
      { name: 'Shapechanger', desc: 'Can polymorph into rat, raven, or spider forms.' },
      { name: 'Devil\'s Sight', desc: 'Magical darkness doesn\'t impede darkvision.' },
      { name: 'Magic Resistance', desc: 'Advantage on saves vs spells and magical effects.' }
    ],
    actions: [
      { name: 'Sting (bite in beast form)', desc: '+5 to hit, reach 5 ft. Hit: 5 (1d4+3) piercing + 10 (3d6) poison DC 11 Con save half.' },
      { name: 'Invisibility', desc: 'Magically turns invisible; equipment invisible with it. Ends if attacks or casts.' }
    ], source: 'MM 2024' },

  // =================================================================
  // OGRE / LARGE HUMANOIDS
  // =================================================================
  { id: 'ogre', name: 'Ogre', size: 'Large', type: 'Giant', alignment: 'Chaotic Evil',
    ac: 11, acNote: 'hide', hp: 59, hpFormula: '7d10+21', speed: '40 ft',
    str: 19, dex: 8, con: 16, int: 5, wis: 7, cha: 7,
    senses: 'Darkvision 60 ft, passive Perception 8', languages: 'Common, Giant',
    cr: '2', xp: 450,
    actions: [
      { name: 'Greatclub', desc: '+6 to hit, reach 5 ft. Hit: 13 (2d8+4) bludgeoning.' },
      { name: 'Javelin', desc: '+6 to hit, reach 5 ft or range 30/120 ft. Hit: 11 (2d6+4) piercing.' }
    ], source: 'MM 2024' },

  // =================================================================
  // MANTICORE / MID-CR
  // =================================================================
  { id: 'manticore', name: 'Manticore', size: 'Large', type: 'Monstrosity', alignment: 'Lawful Evil',
    ac: 14, hp: 68, hpFormula: '8d10+24', speed: '30 ft, fly 50 ft',
    str: 17, dex: 16, con: 17, int: 7, wis: 12, cha: 8,
    senses: 'Darkvision 60 ft, passive Perception 11', languages: 'Common',
    cr: '3', xp: 700,
    traits: [{ name: 'Tail Spike Regrowth', desc: 'Has 24 tail spikes; used spikes regrow after a long rest.' }],
    actions: [
      { name: 'Multiattack (3)', desc: 'One bite + two claws, OR three tail spikes.' },
      { name: 'Bite', desc: '+5 to hit, reach 5 ft. Hit: 7 (1d8+3) piercing.' },
      { name: 'Claw', desc: '+5 to hit, reach 5 ft. Hit: 6 (1d6+3) slashing.' },
      { name: 'Tail Spike', desc: '+5 to hit, range 100/200 ft. Hit: 7 (1d8+3) piercing.' }
    ], source: 'MM 2024' },

  // =================================================================
  // DRAGONS
  // =================================================================
  { id: 'young_black_dragon', name: 'Young Black Dragon (Vrass template)', size: 'Large', type: 'Dragon (chromatic)', alignment: 'Chaotic Evil',
    ac: 18, acNote: 'natural armor', hp: 127, hpFormula: '15d10+45', speed: '40 ft, fly 80 ft, swim 40 ft',
    str: 19, dex: 14, con: 17, int: 12, wis: 11, cha: 15,
    saves: { dex: 5, con: 6, wis: 3, cha: 5 },
    skills: { perception: 6, stealth: 5 },
    damageImmune: ['acid'],
    senses: 'Blindsight 30 ft, Darkvision 120 ft, passive Perception 16', languages: 'Common, Draconic',
    cr: '7', xp: 2900,
    traits: [
      { name: 'Amphibious', desc: 'Can breathe air and water.' }
    ],
    actions: [
      { name: 'Multiattack (3)', desc: 'Bite + two claws.' },
      { name: 'Bite', desc: '+7 to hit, reach 10 ft. Hit: 15 (2d10+4) piercing + 4 (1d8) acid.' },
      { name: 'Claw', desc: '+7 to hit, reach 5 ft. Hit: 11 (2d6+4) slashing.' },
      { name: 'Acid Breath (Recharge 5-6)', desc: '30-ft line, 5 ft wide. DC 14 Dex save. 49 (11d8) acid on fail, half on success.' }
    ], source: 'MM 2024 · Vrass at Session 5 has taken minor injuries; DM may reduce HP as narratively appropriate' },

  // =================================================================
  // ELITE / END-GAME (for later)
  // =================================================================
  { id: 'lich', name: 'Lich (Vaeloran end-game template)', size: 'Medium', type: 'Undead', alignment: 'Any Evil',
    ac: 17, acNote: 'natural armor', hp: 135, hpFormula: '18d8+54', speed: '30 ft',
    str: 11, dex: 16, con: 16, int: 20, wis: 14, cha: 16,
    saves: { con: 10, int: 12, wis: 9 },
    skills: { arcana: 19, history: 12, insight: 9, perception: 9 },
    damageResist: ['cold', 'lightning', 'necrotic'],
    damageImmune: ['poison', 'bludgeoning/piercing/slashing from non-magical weapons'],
    conditionImmune: ['charmed', 'exhaustion', 'frightened', 'paralyzed', 'poisoned'],
    senses: 'Truesight 120 ft, passive Perception 19', languages: 'Common + up to 5 others',
    cr: '21', xp: 33000,
    traits: [
      { name: 'Legendary Resistance (3/day)', desc: 'If it fails a save, may choose to succeed instead.' },
      { name: 'Rejuvenation', desc: 'If it has a phylactery, gains a new body in 1d10 days.' },
      { name: 'Spellcasting', desc: 'Wizard 18. INT DC 20, +12 to hit. Signature: Foresight, Mind Blank. Full 9th-level prepared spellbook.' },
      { name: 'Turn Resistance', desc: 'Advantage on saves vs Turn Undead.' }
    ],
    actions: [
      { name: 'Paralyzing Touch', desc: '+12 to hit, reach 5 ft. Hit: 10 (3d6) cold + DC 18 Con save or paralyzed 1 min (save end).' }
    ],
    legendaryActions: [
      { name: 'Cantrip', desc: 'Casts a cantrip.' },
      { name: 'Paralyzing Touch (2 actions)', desc: 'Uses its Paralyzing Touch.' },
      { name: 'Frightening Gaze (2 actions)', desc: 'Target within 10 ft, DC 18 Wis save or frightened 1 min. Immune 24h on success.' },
      { name: 'Disrupt Life (3 actions)', desc: 'Each non-undead within 20 ft: 21 (6d6) necrotic, DC 18 Con save half.' }
    ],
    source: 'MM 2024 · Vaeloran currently Stage 3 lich progression — see NPC file for lich tracker; full stat block applies at Stage 9+' },

  // ==================================================================
  // ELDORIA-SPECIFIC ORIGINAL MONSTERS
  // Designed from scratch for The Wayward Company campaign — factional
  // enemies tied to Naturus cult, Guilded Veil, Halvor's operation, and
  // Vaeloran's lich progression. Not adaptations of published creatures.
  // ==================================================================

  { id: 'naturus_touched_wolf', name: 'Naturus-Touched Wolf', size: 'Medium', type: 'beast (corrupted)', alignment: 'unaligned',
    ac: 13, hp: 34, hpFormula: '5d8+10', speed: '45 ft.',
    str: 14, dex: 15, con: 15, int: 4, wis: 12, cha: 6,
    senses: 'darkvision 60 ft., passive Perception 13',
    languages: '—',
    cr: '1', xp: 200,
    traits: [
      { name: 'Corruption Aura', desc: 'The first creature to hit the wolf in melee each round takes 1d4 necrotic damage from black ichor spray.' },
      { name: 'Pack Instinct', desc: 'Advantage on attack rolls against a creature if another Naturus-touched creature is within 5 ft. of it.' }
    ],
    actions: [
      { name: 'Rending Bite', desc: 'Melee weapon attack, +4 to hit, reach 5 ft., one target. Hit: 2d6+2 piercing plus 1d4 necrotic. Target DC 12 Str save or knocked prone.' }
    ],
    source: 'Eldoria original — Naturus corruption variant of a common wolf. Appears in Frostwood Marsh.'
  },

  { id: 'naturus_adept', name: 'Naturus Adept', size: 'Medium', type: 'humanoid (cultist)', alignment: 'chaotic evil',
    ac: 12, hp: 38, hpFormula: '7d8+7', speed: '30 ft.',
    str: 10, dex: 12, con: 13, int: 12, wis: 15, cha: 11,
    senses: 'passive Perception 12',
    languages: 'Common, plus cult cant',
    cr: '2', xp: 450,
    traits: [
      { name: 'Naturus Devotion', desc: 'Advantage on saves against being Charmed or Frightened.' }
    ],
    actions: [
      { name: 'Multiattack', desc: 'Makes two Rot-Touched Sickle attacks OR casts a spell and makes one Sickle attack.' },
      { name: 'Rot-Touched Sickle', desc: 'Melee weapon attack, +4 to hit, reach 5 ft., one target. Hit: 1d6+2 slashing plus 1d4 necrotic.' },
      { name: 'Withering Bolt (spell, 3/day)', desc: 'Ranged spell attack, +4 to hit, range 60 ft., one target. Hit: 3d6 necrotic. Target loses hit points equal to its Con modifier (min 1) from its maximum until it finishes a long rest.' }
    ],
    bonusActions: [
      { name: 'Corrupt Wound (recharge 5-6)', desc: 'One creature the Adept can see within 30 ft. that has taken damage this round: DC 12 Con save or take 2d6 necrotic damage as an existing wound festers.' }
    ],
    source: 'Eldoria original — mid-tier Naturus cult caster, sits between Cultist and Cult Fanatic.'
  },

  { id: 'rotwood_stalker', name: 'Rotwood Stalker', size: 'Large', type: 'monstrosity', alignment: 'unaligned',
    ac: 14, hp: 65, hpFormula: '10d10+10', speed: '40 ft., climb 30 ft.',
    str: 16, dex: 16, con: 13, int: 3, wis: 12, cha: 6,
    skills: { stealth: 5 },
    senses: 'darkvision 60 ft., passive Perception 11',
    languages: '—',
    cr: '3', xp: 700,
    traits: [
      { name: 'Marsh Stealth', desc: 'Advantage on Dex (Stealth) checks in dim light or swampy terrain.' },
      { name: 'Ambush', desc: 'On its first turn in combat, has advantage on attack rolls against creatures that have not acted yet.' }
    ],
    actions: [
      { name: 'Multiattack', desc: 'Makes one Claw and one Bite attack.' },
      { name: 'Claw', desc: 'Melee weapon attack, +5 to hit, reach 10 ft., one target. Hit: 1d10+3 slashing. On hit, target must succeed on a DC 13 Str save or be pulled 10 ft. toward the Stalker.' },
      { name: 'Bite', desc: 'Melee weapon attack, +5 to hit, reach 5 ft., one target. Hit: 2d6+3 piercing. If target is a Medium or smaller creature, it is Grappled (escape DC 13).' }
    ],
    source: 'Eldoria original — apex predator of Frostwood Marsh interior. Fights alone.'
  },

  { id: 'ashen_servant', name: 'Ashen Servant', size: 'Medium', type: 'undead', alignment: 'lawful evil',
    ac: 13, hp: 44, hpFormula: '8d8+8', speed: '30 ft.',
    str: 15, dex: 13, con: 13, int: 8, wis: 10, cha: 8,
    damageResist: 'necrotic',
    damageImmune: 'poison',
    conditionImmune: 'exhaustion, poisoned',
    senses: 'darkvision 60 ft., passive Perception 10',
    languages: 'understands Common but cannot speak',
    cr: '2', xp: 450,
    traits: [
      { name: 'Bound Purpose', desc: 'The Ashen Servant knows the location of its master (a lich or death priest) at any distance on the same plane, and will move toward that master if not otherwise directed.' }
    ],
    actions: [
      { name: 'Multiattack', desc: 'Makes two Ash Blade attacks.' },
      { name: 'Ash Blade', desc: 'Melee weapon attack, +4 to hit, reach 5 ft., one target. Hit: 1d8+2 slashing plus 1d6 necrotic. Nonmagical armor hit by the blade loses 1 point of AC until repaired (min AC 10).' }
    ],
    source: 'Eldoria original — a corpse re-animated by Vaeloran or one of his lieutenants and given a specific task. Deploys in pairs or triads.'
  },

  { id: 'hollow_voiced', name: 'The Hollow-Voiced', size: 'Medium', type: 'undead', alignment: 'neutral evil',
    ac: 15, hp: 82, hpFormula: '11d8+33', speed: '30 ft.',
    str: 13, dex: 16, con: 16, int: 14, wis: 15, cha: 18,
    saves: { wis: 5, cha: 7 },
    damageResist: 'necrotic; bludgeoning, piercing, slashing from nonmagical attacks',
    damageImmune: 'poison',
    conditionImmune: 'charmed, exhaustion, frightened, poisoned',
    senses: 'darkvision 120 ft., passive Perception 12',
    languages: 'the languages it knew in life plus Deep Speech',
    cr: '5', xp: 1800,
    traits: [
      { name: 'Aura of Silence', desc: 'Spells of 3rd level or lower cast within 10 ft. of the Hollow-Voiced fail unless the caster succeeds on a DC 15 Cha save.' },
      { name: 'Sunlight Sensitivity', desc: 'Disadvantage on attack rolls and Perception checks that rely on sight in direct sunlight.' }
    ],
    actions: [
      { name: 'Multiattack', desc: 'Makes two Silencing Touch attacks.' },
      { name: 'Silencing Touch', desc: 'Melee spell attack, +7 to hit, reach 5 ft., one target. Hit: 3d8 psychic. Target cannot speak or cast spells with verbal components until end of its next turn.' },
      { name: 'Whisper of Unmaking (recharge 5-6)', desc: 'Choose one creature within 30 ft. that can hear. Target makes a DC 15 Wis save or takes 6d8 psychic damage and is Stunned until end of its next turn. On success, half damage and no stun.' }
    ],
    source: 'Eldoria original — one of Vaeloran\'s inner lieutenants. Silences prayer and spellcasting. Appears as a robed figure with no visible face; a soft, terrible voice comes from the empty hood.'
  },

  { id: 'guilded_veil_whisperer', name: 'Guilded Veil Whisperer', size: 'Medium', type: 'humanoid', alignment: 'lawful evil',
    ac: 15, hp: 45, hpFormula: '10d8', speed: '30 ft.',
    str: 10, dex: 16, con: 10, int: 15, wis: 14, cha: 16,
    saves: { dex: 5, cha: 5 },
    skills: { deception: 5, insight: 4, persuasion: 5, sleight: 5, stealth: 5 },
    senses: 'passive Perception 12',
    languages: 'Common, Elvish, Thieves\' Cant, plus one exotic',
    cr: '3', xp: 700,
    traits: [
      { name: 'Sowing Doubt', desc: 'Once per turn as a free action, when the Whisperer speaks to a Charmed creature, that creature must succeed on a DC 13 Wis save or be Poisoned by suggestion (mechanics: disadvantage on next attack roll or ability check) until end of its next turn.' }
    ],
    actions: [
      { name: 'Multiattack', desc: 'Makes two Poisoned Rapier attacks.' },
      { name: 'Poisoned Rapier', desc: 'Melee weapon attack, +5 to hit, reach 5 ft., one target. Hit: 1d8+3 piercing plus 2d4 poison. On hit, target DC 13 Con save or Poisoned 1 min (save at end of each turn).' }
    ],
    bonusActions: [
      { name: 'Disengaging Step', desc: 'Takes the Disengage action.' }
    ],
    reactions: [
      { name: 'Read the Room', desc: 'When a creature the Whisperer can see makes an attack or spell against it, the Whisperer imposes disadvantage if it succeeds on a DC 15 Insight check to predict the attack.' }
    ],
    source: 'Eldoria original — Guilded Veil operative specializing in blackmail and misdirection. Not front-line muscle; deploys with Enforcer bodyguards.'
  },

  { id: 'bound_sentinel', name: 'Bound Sentinel', size: 'Large', type: 'construct', alignment: 'unaligned',
    ac: 17, hp: 95, hpFormula: '10d10+40', speed: '30 ft.',
    str: 18, dex: 10, con: 18, int: 3, wis: 10, cha: 1,
    damageResist: 'bludgeoning, piercing, slashing from nonmagical non-adamantine attacks',
    damageImmune: 'necrotic, poison, psychic',
    conditionImmune: 'charmed, exhaustion, frightened, paralyzed, petrified, poisoned',
    senses: 'darkvision 60 ft., passive Perception 10',
    languages: 'understands Draconic (its bind-language) but cannot speak',
    cr: '5', xp: 1800,
    traits: [
      { name: 'Anchored', desc: 'The Sentinel cannot move more than 60 ft. from the object or location it was bound to protect. If forced beyond that range, it collapses inert until returned.' },
      { name: 'Magic Resistance', desc: 'Advantage on saving throws against spells and other magical effects.' }
    ],
    actions: [
      { name: 'Multiattack', desc: 'Makes two Warding Slam attacks.' },
      { name: 'Warding Slam', desc: 'Melee weapon attack, +7 to hit, reach 10 ft., one target. Hit: 2d10+4 bludgeoning plus 1d8 force.' }
    ],
    reactions: [
      { name: 'Ward Redirect', desc: 'When a creature within 10 ft. targets another creature with a spell, the Sentinel forces the spell to target itself instead (no save).' }
    ],
    source: 'Eldoria original — arcane construct set by high-tier wizards (Vaeloran, high Aeloria mages) to guard specific vaults, tombs, or towers.'
  },

  { id: 'halvor_bruiser', name: 'Halvor Compound Bruiser', size: 'Medium', type: 'humanoid', alignment: 'neutral evil',
    ac: 14, hp: 52, hpFormula: '7d8+21', speed: '30 ft.',
    str: 17, dex: 12, con: 16, int: 9, wis: 10, cha: 11,
    saves: { str: 5, con: 5 },
    skills: { athletics: 5, intimidation: 3 },
    senses: 'passive Perception 10',
    languages: 'Common',
    cr: '2', xp: 450,
    traits: [
      { name: 'Compound Loyalty', desc: 'If a Bruiser drops to 0 HP within 20 ft. of Halvor or another Bruiser, an ally within 20 ft. can use its reaction to move up to its speed toward the fallen Bruiser and make a melee attack with advantage against the creature that dropped them.' }
    ],
    actions: [
      { name: 'Multiattack', desc: 'Makes two Reinforced Cudgel attacks.' },
      { name: 'Reinforced Cudgel', desc: 'Melee weapon attack, +5 to hit, reach 5 ft., one target. Hit: 2d6+3 bludgeoning. On critical hit, target DC 12 Con save or Stunned until end of its next turn.' },
      { name: 'Sap (recharge 4-6)', desc: 'Melee weapon attack, +5 to hit, reach 5 ft., one target. Hit: 1d6+3 bludgeoning. Target DC 13 Con save or unconscious 1 min (save at end of each turn or when hit).' }
    ],
    source: 'Eldoria original — Halvor\'s hand-picked muscle at his Ironhold compound. Tougher than a Thug, more disciplined; loyal because Halvor pays and protects them.'
  },

  { id: 'shadow_of_kaelith', name: 'Shadow of Kaelith', size: 'Medium', type: 'fiend (cult manifestation)', alignment: 'chaotic evil',
    ac: 14, hp: 68, hpFormula: '9d8+27', speed: '40 ft.',
    str: 13, dex: 18, con: 16, int: 10, wis: 13, cha: 16,
    saves: { dex: 7 },
    damageResist: 'necrotic; bludgeoning, piercing, slashing from nonmagical attacks not made in bright light',
    damageImmune: 'poison',
    conditionImmune: 'charmed, exhaustion, frightened, poisoned',
    senses: 'darkvision 60 ft., passive Perception 11',
    languages: 'understands Common but cannot speak',
    cr: '4', xp: 1100,
    traits: [
      { name: 'Shadow Form', desc: 'Can move through a space as narrow as 1 inch wide without squeezing. In dim light or darkness, gains half cover and advantage on Stealth.' },
      { name: 'Sunlight Weakness', desc: 'While in direct sunlight, has disadvantage on attack rolls, ability checks, and saving throws.' }
    ],
    actions: [
      { name: 'Multiattack', desc: 'Makes two Draining Touch attacks.' },
      { name: 'Draining Touch', desc: 'Melee spell attack, +6 to hit, reach 5 ft., one target. Hit: 2d6+4 necrotic. Target\'s Strength score is reduced by 1d4 (min 1). This reduction lasts until target finishes a short or long rest.' }
    ],
    source: 'Eldoria original — a manifest fragment of Sister Kaelith\'s corrupted essence. Kaelith has learned to project these as scouts and assassins ahead of her physical arrival. Killing one weakens the connection to Naturus temporarily but does not harm Kaelith herself.'
  },

];

const MONSTERS_BY_ID = {};
MONSTERS_2024.forEach(m => { MONSTERS_BY_ID[m.id] = m; });

if (typeof window !== 'undefined') {
  window.MONSTERS_2024 = MONSTERS_2024;
  window.MONSTERS_BY_ID = MONSTERS_BY_ID;
}
