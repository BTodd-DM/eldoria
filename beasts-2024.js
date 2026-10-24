// =====================================================================
// THE WAYWARD COMPANY — WILD SHAPE BEASTS (Update 61b)
// ---------------------------------------------------------------------
// The 16 beasts a druid from Coldhearth would know (Brad, 2026-10-23).
// Same schema as monsters-2024.js. Actions are short summaries in our
// own words. CR is a number for filtering (0.125 = 1/8).
//
// ⚠ DM CHECK: D&D Beyond's free rules don't include beast stat blocks,
// so these numbers were written from memory of the Monster Manual and
// may follow the 2014 versions in places. Check against the 2024 MM.
// =====================================================================

const WILD_SHAPE_BEASTS = [
  { id: 'goat', name: 'Goat', size: 'Medium', cr: '0', crNum: 0, ac: 10, hp: 4, hpFormula: '1d8', speed: '40 ft, climb 30 ft',
    str: 12, dex: 10, con: 11, int: 2, wis: 10, cha: 5, senses: 'passive Perception 10',
    traits: [{ name: 'Sure-Footed', desc: 'Advantage on Str and Dex saves against being knocked Prone.' }],
    actions: [{ name: 'Ram', desc: '+3 to hit, reach 5 ft. 3 (1d4+1) bludgeoning. If it moved 20 ft straight first: +2 (1d4) and DC 10 Str save or Prone.' }] },

  { id: 'cat', name: 'Cat', size: 'Tiny', cr: '0', crNum: 0, ac: 12, hp: 2, hpFormula: '1d4', speed: '40 ft, climb 40 ft',
    str: 3, dex: 15, con: 10, int: 3, wis: 12, cha: 7, skills: { perception: 3, stealth: 4 }, senses: 'Darkvision 60 ft, passive Perception 13',
    traits: [{ name: 'Keen Smell', desc: 'Advantage on Perception checks that rely on smell.' }],
    actions: [{ name: 'Scratch', desc: '+4 to hit, reach 5 ft. 1 slashing.' }] },

  { id: 'rat', name: 'Rat', size: 'Tiny', cr: '0', crNum: 0, ac: 10, hp: 1, hpFormula: '1d4−1', speed: '20 ft, climb 20 ft',
    str: 2, dex: 11, con: 9, int: 2, wis: 10, cha: 4, senses: 'Darkvision 30 ft, passive Perception 10',
    traits: [{ name: 'Keen Smell', desc: 'Advantage on Perception checks that rely on smell.' }],
    actions: [{ name: 'Bite', desc: '+2 to hit, reach 5 ft. 1 piercing.' }] },

  { id: 'frog', name: 'Frog', size: 'Tiny', cr: '0', crNum: 0, ac: 11, hp: 1, hpFormula: '1d4−1', speed: '20 ft, swim 20 ft',
    str: 1, dex: 13, con: 8, int: 1, wis: 8, cha: 3, skills: { perception: 1, stealth: 3 }, senses: 'Darkvision 30 ft, passive Perception 11',
    traits: [{ name: 'Amphibious', desc: 'Breathes air and water.' }, { name: 'Standing Leap', desc: 'Long jump 10 ft, high jump 5 ft, with or without a run-up.' }],
    actions: [] },

  { id: 'badger', name: 'Badger', size: 'Tiny', cr: '0', crNum: 0, ac: 10, hp: 3, hpFormula: '1d4+1', speed: '20 ft, burrow 5 ft',
    str: 4, dex: 11, con: 12, int: 2, wis: 12, cha: 5, senses: 'Darkvision 30 ft, passive Perception 11',
    traits: [{ name: 'Keen Smell', desc: 'Advantage on Perception checks that rely on smell.' }],
    actions: [{ name: 'Bite', desc: '+2 to hit, reach 5 ft. 1 piercing.' }] },

  { id: 'deer', name: 'Deer', size: 'Medium', cr: '0', crNum: 0, ac: 13, hp: 4, hpFormula: '1d8', speed: '50 ft',
    str: 11, dex: 16, con: 11, int: 2, wis: 14, cha: 5, senses: 'passive Perception 12',
    traits: [],
    actions: [{ name: 'Ram', desc: '+2 to hit, reach 5 ft. 2 (1d4) bludgeoning.' }] },

  { id: 'mastiff', name: 'Mastiff', size: 'Medium', cr: '1/8', crNum: 0.125, ac: 12, hp: 5, hpFormula: '1d8+1', speed: '40 ft',
    str: 13, dex: 14, con: 12, int: 3, wis: 12, cha: 7, skills: { perception: 3 }, senses: 'passive Perception 13',
    traits: [{ name: 'Keen Hearing and Smell', desc: 'Advantage on Perception checks that rely on hearing or smell.' }],
    actions: [{ name: 'Bite', desc: '+3 to hit, reach 5 ft. 4 (1d6+1) piercing. Creature: DC 11 Str save or Prone.' }] },

  { id: 'venomous_snake', name: 'Venomous Snake', size: 'Tiny', cr: '1/8', crNum: 0.125, ac: 13, hp: 2, hpFormula: '1d4', speed: '30 ft, swim 30 ft',
    str: 2, dex: 16, con: 11, int: 1, wis: 10, cha: 3, senses: 'Blindsight 10 ft, passive Perception 10',
    traits: [],
    actions: [{ name: 'Bite', desc: '+5 to hit, reach 5 ft. 1 piercing, and DC 10 Con save: 5 (2d4) poison, half on a success.' }] },

  { id: 'constrictor_snake', name: 'Constrictor Snake', size: 'Large', cr: '1/4', crNum: 0.25, ac: 12, hp: 13, hpFormula: '2d10+2', speed: '30 ft, swim 30 ft',
    str: 15, dex: 14, con: 12, int: 1, wis: 10, cha: 3, senses: 'Blindsight 10 ft, passive Perception 10',
    traits: [],
    actions: [
      { name: 'Bite', desc: '+4 to hit, reach 5 ft. 5 (1d6+2) piercing.' },
      { name: 'Constrict', desc: '+4 to hit, reach 5 ft. 6 (1d8+2) bludgeoning; target is Grappled (escape DC 12) and Restrained while grappled. One target at a time.' }
    ] },

  { id: 'boar', name: 'Boar', size: 'Medium', cr: '1/4', crNum: 0.25, ac: 11, hp: 11, hpFormula: '2d8+2', speed: '40 ft',
    str: 13, dex: 11, con: 12, int: 2, wis: 9, cha: 5, senses: 'passive Perception 9',
    traits: [
      { name: 'Charge', desc: 'If it moves 20 ft straight then hits with Tusk: +3 (1d6) slashing and DC 11 Str save or Prone.' },
      { name: 'Relentless (1/Short or Long Rest)', desc: 'If reduced to 0 HP by 7 damage or less, drop to 1 HP instead.' }
    ],
    actions: [{ name: 'Tusk', desc: '+3 to hit, reach 5 ft. 4 (1d6+1) slashing.' }] },

  { id: 'wolf', name: 'Wolf', size: 'Medium', cr: '1/4', crNum: 0.25, ac: 13, hp: 11, hpFormula: '2d8+2', speed: '40 ft',
    str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6, skills: { perception: 3, stealth: 4 }, senses: 'passive Perception 13',
    traits: [
      { name: 'Keen Hearing and Smell', desc: 'Advantage on Perception checks that rely on hearing or smell.' },
      { name: 'Pack Tactics', desc: 'Advantage on attacks against a creature if an ally is within 5 ft of it.' }
    ],
    actions: [{ name: 'Bite', desc: '+4 to hit, reach 5 ft. 7 (2d4+2) piercing. Creature: DC 11 Str save or Prone.' }] },

  { id: 'giant_frog', name: 'Giant Frog', size: 'Medium', cr: '1/4', crNum: 0.25, ac: 11, hp: 18, hpFormula: '4d8', speed: '30 ft, swim 30 ft',
    str: 12, dex: 13, con: 11, int: 2, wis: 10, cha: 3, skills: { perception: 2, stealth: 3 }, senses: 'Darkvision 30 ft, passive Perception 12',
    traits: [{ name: 'Amphibious', desc: 'Breathes air and water.' }, { name: 'Standing Leap', desc: 'Long jump 20 ft, high jump 10 ft, with or without a run-up.' }],
    actions: [
      { name: 'Bite', desc: '+3 to hit, reach 5 ft. 4 (1d6+1) piercing; a Small or smaller target is Grappled (escape DC 11) and Restrained.' },
      { name: 'Swallow', desc: 'Swallow a Small or smaller creature it is grappling: Blinded and Restrained inside, 5 (2d4) acid at the start of each of the frog\'s turns. One at a time.' }
    ] },

  { id: 'elk', name: 'Elk', size: 'Large', cr: '1/4', crNum: 0.25, ac: 10, hp: 13, hpFormula: '2d10+2', speed: '50 ft',
    str: 16, dex: 10, con: 12, int: 2, wis: 10, cha: 6, senses: 'passive Perception 10',
    traits: [{ name: 'Charge', desc: 'If it moves 20 ft straight then hits with Ram: +7 (2d6) and DC 13 Str save or Prone.' }],
    actions: [
      { name: 'Ram', desc: '+5 to hit, reach 5 ft. 6 (1d6+3) bludgeoning.' },
      { name: 'Hooves', desc: 'Only against a Prone creature. +5 to hit, reach 5 ft. 8 (2d4+3) bludgeoning.' }
    ] },

  { id: 'giant_badger', name: 'Giant Badger', size: 'Medium', cr: '1/4', crNum: 0.25, ac: 10, hp: 13, hpFormula: '2d8+4', speed: '30 ft, burrow 10 ft',
    str: 13, dex: 10, con: 15, int: 2, wis: 12, cha: 5, senses: 'Darkvision 30 ft, passive Perception 11',
    traits: [{ name: 'Keen Smell', desc: 'Advantage on Perception checks that rely on smell.' }],
    actions: [
      { name: 'Multiattack', desc: 'One Bite and one Claws.' },
      { name: 'Bite', desc: '+3 to hit, reach 5 ft. 4 (1d6+1) piercing.' },
      { name: 'Claws', desc: '+3 to hit, reach 5 ft. 6 (2d4+1) slashing.' }
    ] },

  { id: 'black_bear', name: 'Black Bear', size: 'Medium', cr: '1/2', crNum: 0.5, ac: 11, hp: 19, hpFormula: '3d8+6', speed: '40 ft, climb 30 ft',
    str: 15, dex: 10, con: 14, int: 2, wis: 12, cha: 7, skills: { perception: 3 }, senses: 'passive Perception 13',
    traits: [{ name: 'Keen Smell', desc: 'Advantage on Perception checks that rely on smell.' }],
    actions: [
      { name: 'Multiattack', desc: 'One Bite and one Claws.' },
      { name: 'Bite', desc: '+3 to hit, reach 5 ft. 5 (1d6+2) piercing.' },
      { name: 'Claws', desc: '+3 to hit, reach 5 ft. 7 (2d4+2) slashing.' }
    ] },

  { id: 'crocodile', name: 'Crocodile', size: 'Large', cr: '1/2', crNum: 0.5, ac: 12, hp: 19, hpFormula: '3d10+3', speed: '20 ft, swim 30 ft',
    str: 15, dex: 10, con: 13, int: 2, wis: 10, cha: 5, skills: { stealth: 2 }, senses: 'passive Perception 10',
    traits: [{ name: 'Hold Breath', desc: 'Can hold its breath for 15 minutes.' }],
    actions: [{ name: 'Bite', desc: '+4 to hit, reach 5 ft. 7 (1d10+2) piercing; Medium or smaller target is Grappled (escape DC 12) and Restrained. One target at a time.' }] }
];

const WILD_SHAPE_BEASTS_BY_ID = WILD_SHAPE_BEASTS.reduce(function(m, b) { m[b.id] = b; return m; }, {});
window.WILD_SHAPE_BEASTS = WILD_SHAPE_BEASTS;
window.WILD_SHAPE_BEASTS_BY_ID = WILD_SHAPE_BEASTS_BY_ID;
