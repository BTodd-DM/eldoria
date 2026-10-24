// =====================================================================
// THE WAYWARD COMPANY — 2024 ORIGINS: BACKGROUNDS, SPECIES, FEATS
// (Update 61b — character builder data)
// ---------------------------------------------------------------------
// Official 2024 PHB content only. Every description is our own short
// mechanical summary, not the published wording.
//
// Skill keys match sheet-engine.js (camelCase, e.g. animalHandling).
// `max: 'pb'` on a resource means "equal to Proficiency Bonus".
// =====================================================================

const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const ABILITY_NAMES = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
const SKILL_NAMES = {
  acrobatics: 'Acrobatics', animalHandling: 'Animal Handling', arcana: 'Arcana', athletics: 'Athletics',
  deception: 'Deception', history: 'History', insight: 'Insight', intimidation: 'Intimidation',
  investigation: 'Investigation', medicine: 'Medicine', nature: 'Nature', perception: 'Perception',
  performance: 'Performance', persuasion: 'Persuasion', religion: 'Religion', sleightOfHand: 'Sleight of Hand',
  stealth: 'Stealth', survival: 'Survival'
};
// Common + two of these at character creation (2024 PHB).
const STANDARD_LANGUAGES = ['Common Sign Language', 'Draconic', 'Dwarvish', 'Elvish', 'Giant', 'Gnomish', 'Goblin', 'Halfling', 'Orc'];

// ---------------------------------------------------------------------
// BACKGROUNDS (16). abilities = the three that may be raised
// (+2/+1 or +1/+1/+1, no score above 20).
// ---------------------------------------------------------------------
const BACKGROUNDS_2024 = {
  acolyte:     { name: 'Acolyte',     abilities: ['int', 'wis', 'cha'], feat: 'magicInitiate', featList: 'cleric', skills: ['insight', 'religion'], tool: "Calligrapher's Supplies",
                 kit: ["Calligrapher's Supplies", 'Book (prayers)', 'Holy Symbol', 'Parchment (10 sheets)', 'Robe'], gp: 8 },
  artisan:     { name: 'Artisan',     abilities: ['str', 'dex', 'int'], feat: 'crafter', skills: ['investigation', 'persuasion'], tool: "Artisan's Tools (one kind)",
                 kit: ["Artisan's Tools (same kind)", 'Pouch (2)', "Traveler's Clothes"], gp: 32 },
  charlatan:   { name: 'Charlatan',   abilities: ['dex', 'con', 'cha'], feat: 'skilled', skills: ['deception', 'sleightOfHand'], tool: 'Forgery Kit',
                 kit: ['Forgery Kit', 'Costume', 'Fine Clothes'], gp: 15 },
  criminal:    { name: 'Criminal',    abilities: ['dex', 'con', 'int'], feat: 'alert', skills: ['sleightOfHand', 'stealth'], tool: "Thieves' Tools",
                 kit: ['Dagger (2)', "Thieves' Tools", 'Crowbar', 'Pouch (2)', "Traveler's Clothes"], gp: 16 },
  entertainer: { name: 'Entertainer', abilities: ['str', 'dex', 'cha'], feat: 'musician', skills: ['acrobatics', 'performance'], tool: 'Musical Instrument (one kind)',
                 kit: ['Musical Instrument (same kind)', 'Costume (2)', 'Mirror', 'Perfume', "Traveler's Clothes"], gp: 11 },
  farmer:      { name: 'Farmer',      abilities: ['str', 'con', 'wis'], feat: 'tough', skills: ['animalHandling', 'nature'], tool: "Carpenter's Tools",
                 kit: ['Sickle', "Carpenter's Tools", "Healer's Kit", 'Iron Pot', 'Shovel', "Traveler's Clothes"], gp: 30 },
  guard:       { name: 'Guard',       abilities: ['str', 'int', 'wis'], feat: 'alert', skills: ['athletics', 'perception'], tool: 'Gaming Set (one kind)',
                 kit: ['Spear', 'Light Crossbow', 'Bolts (20)', 'Gaming Set (same kind)', 'Hooded Lantern', 'Manacles', 'Quiver', "Traveler's Clothes"], gp: 12 },
  guide:       { name: 'Guide',       abilities: ['dex', 'con', 'wis'], feat: 'magicInitiate', featList: 'druid', skills: ['stealth', 'survival'], tool: "Cartographer's Tools",
                 kit: ['Shortbow', 'Arrows (20)', "Cartographer's Tools", 'Bedroll', 'Quiver', 'Tent', "Traveler's Clothes"], gp: 3 },
  hermit:      { name: 'Hermit',      abilities: ['con', 'wis', 'cha'], feat: 'healer', skills: ['medicine', 'religion'], tool: 'Herbalism Kit',
                 kit: ['Quarterstaff', 'Herbalism Kit', 'Bedroll', 'Book (philosophy)', 'Lamp', 'Oil (3 flasks)', "Traveler's Clothes"], gp: 16 },
  merchant:    { name: 'Merchant',    abilities: ['con', 'int', 'cha'], feat: 'lucky', skills: ['animalHandling', 'persuasion'], tool: "Navigator's Tools",
                 kit: ["Navigator's Tools", 'Pouch (2)', "Traveler's Clothes"], gp: 22 },
  noble:       { name: 'Noble',       abilities: ['str', 'int', 'cha'], feat: 'skilled', skills: ['history', 'persuasion'], tool: 'Gaming Set (one kind)',
                 kit: ['Gaming Set (same kind)', 'Fine Clothes', 'Perfume'], gp: 29 },
  sage:        { name: 'Sage',        abilities: ['con', 'int', 'wis'], feat: 'magicInitiate', featList: 'wizard', skills: ['arcana', 'history'], tool: "Calligrapher's Supplies",
                 kit: ['Quarterstaff', "Calligrapher's Supplies", 'Book (history)', 'Parchment (8 sheets)', 'Robe'], gp: 8 },
  sailor:      { name: 'Sailor',      abilities: ['str', 'dex', 'wis'], feat: 'tavernBrawler', skills: ['acrobatics', 'perception'], tool: "Navigator's Tools",
                 kit: ['Dagger', "Navigator's Tools", 'Rope', "Traveler's Clothes"], gp: 20 },
  scribe:      { name: 'Scribe',      abilities: ['dex', 'int', 'wis'], feat: 'skilled', skills: ['investigation', 'perception'], tool: "Calligrapher's Supplies",
                 kit: ["Calligrapher's Supplies", 'Fine Clothes', 'Lamp', 'Oil (3 flasks)', 'Parchment (12 sheets)'], gp: 23 },
  soldier:     { name: 'Soldier',     abilities: ['str', 'dex', 'con'], feat: 'savageAttacker', skills: ['athletics', 'intimidation'], tool: 'Gaming Set (one kind)',
                 kit: ['Spear', 'Shortbow', 'Arrows (20)', 'Gaming Set (same kind)', "Healer's Kit", 'Quiver', "Traveler's Clothes"], gp: 14 },
  wayfarer:    { name: 'Wayfarer',    abilities: ['dex', 'wis', 'cha'], feat: 'lucky', skills: ['insight', 'stealth'], tool: "Thieves' Tools",
                 kit: ['Dagger (2)', "Thieves' Tools", 'Gaming Set (any)', 'Bedroll', 'Pouch (2)', "Traveler's Clothes"], gp: 16 }
};

// ---------------------------------------------------------------------
// FEATS. category 'origin' = available from backgrounds / Human
// Versatile; 'general' = level 4+. asiFrom = feat also gives +1 to one
// of these abilities. choice = extra pick the builder asks for.
// ---------------------------------------------------------------------
const FEATS_2024 = {
  alert:          { name: 'Alert', category: 'origin', desc: 'Add your Proficiency Bonus to Initiative. Right after rolling Initiative you can swap results with a willing ally (neither Incapacitated).', initiativePb: true },
  crafter:        { name: 'Crafter', category: 'origin', desc: "Proficiency with three Artisan's Tools of your choice. 20% off nonmagical items you buy. After a Long Rest you can craft one simple item (e.g. ladder, torch, rope) with a tool you know.", choice: { type: 'text', label: "Three Artisan's Tools" } },
  healer:         { name: 'Healer', category: 'origin', desc: "Battle Medic: as a Utilize action, spend a Healer's Kit use so a creature within 5 ft can spend one Hit Die and regain that roll plus your Proficiency Bonus. You reroll 1s on healing dice from spells or this feat." },
  lucky:          { name: 'Lucky', category: 'origin', desc: 'Luck Points equal to your Proficiency Bonus per Long Rest. Spend one for Advantage on your own d20 Test, or to give an attack against you Disadvantage.', resource: { id: 'luck_points', label: 'Luck Points', max: 'pb', recharge: 'long' } },
  magicInitiate:  { name: 'Magic Initiate', category: 'origin', desc: 'Two cantrips and one level 1 spell from the Cleric, Druid or Wizard list. The level 1 spell is always prepared and can be cast once per Long Rest without a slot. Pick Int, Wis or Cha as the spellcasting ability.', choice: { type: 'magicInitiate' } },
  musician:       { name: 'Musician', category: 'origin', desc: 'Proficiency with three musical instruments. After a Short or Long Rest, play a song to give Heroic Inspiration to allies who hear it (up to your Proficiency Bonus).', choice: { type: 'text', label: 'Three musical instruments' } },
  savageAttacker: { name: 'Savage Attacker', category: 'origin', desc: 'Once per turn when you hit with a weapon, roll its damage dice twice and use either result.' },
  skilled:        { name: 'Skilled', category: 'origin', desc: 'Proficiency in any three skills (or tools).', choice: { type: 'skills', count: 3 } },
  tavernBrawler:  { name: 'Tavern Brawler', category: 'origin', desc: 'Unarmed Strikes deal 1d4 + Str Bludgeoning; reroll 1s on that damage. Proficiency with improvised weapons. Once per turn when you hit with an Unarmed Strike, you can also push the target 5 ft.' },
  tough:          { name: 'Tough', category: 'origin', desc: 'Your Hit Point maximum rises by twice your character level, and by 2 more each level after.', hpPerLevel: 2 },

  // General feats (level 4+). A druid-friendly selection; "Other" lets
  // the player type any other 2024 feat.
  abilityScoreImprovement: { name: 'Ability Score Improvement', category: 'asi', desc: 'Raise one score by 2, or two scores by 1 (max 20).' },
  elementalAdept: { name: 'Elemental Adept', category: 'general', asiFrom: ['int', 'wis', 'cha'], desc: 'Pick Acid, Cold, Fire, Lightning or Thunder. Your spells ignore resistance to that type, and you treat 1s on its damage dice as 2s.', choice: { type: 'pick', label: 'Damage type', options: ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'] } },
  feyTouched:     { name: 'Fey Touched', category: 'general', asiFrom: ['int', 'wis', 'cha'], desc: 'Misty Step plus one level 1 Divination or Enchantment spell, both always prepared and each castable once per Long Rest without a slot.', choice: { type: 'text', label: 'Level 1 Divination or Enchantment spell' }, alwaysPrepared: ['Misty Step'] },
  observant:      { name: 'Observant', category: 'general', asiFrom: ['int', 'wis'], desc: 'Proficiency in one of Insight, Investigation or Perception (Expertise if already proficient). You can take the Search action as a Bonus Action.', choice: { type: 'pick', label: 'Skill', options: ['insight', 'investigation', 'perception'], skill: true } },
  resilient:      { name: 'Resilient', category: 'general', asiFromChoice: true, desc: 'Raise one ability by 1 and gain saving-throw proficiency in that ability.', saveFromAsi: true },
  shadowTouched:  { name: 'Shadow Touched', category: 'general', asiFrom: ['int', 'wis', 'cha'], desc: 'Invisibility plus one level 1 Illusion or Necromancy spell, both always prepared and each castable once per Long Rest without a slot.', choice: { type: 'text', label: 'Level 1 Illusion or Necromancy spell' }, alwaysPrepared: ['Invisibility'] },
  skillExpert:    { name: 'Skill Expert', category: 'general', asiFromChoice: true, desc: 'Raise one ability by 1. Gain one skill proficiency, and Expertise in one skill you are proficient in.', choice: { type: 'text', label: 'New skill + Expertise skill' } },
  telekinetic:    { name: 'Telekinetic', category: 'general', asiFrom: ['int', 'wis', 'cha'], desc: 'Mage Hand becomes invisible with +30 ft range. Bonus Action: shove a creature within 30 ft 5 ft (Str save vs 8 + mod + PB).' },
  telepathic:     { name: 'Telepathic', category: 'general', asiFrom: ['int', 'wis', 'cha'], desc: 'Speak telepathically to creatures within 60 ft. Detect Thoughts is always prepared and castable once per Long Rest without a slot.' },
  warCaster:      { name: 'War Caster', category: 'general', asiFrom: ['int', 'wis', 'cha'], desc: 'Advantage on Con saves to keep Concentration. You can do Somatic components with hands full, and cast a one-target spell instead of an Opportunity Attack.' },
  actor:          { name: 'Actor', category: 'general', asiFrom: ['cha'], desc: 'Advantage on Deception and Performance checks to pass as someone else. You can mimic a voice or sounds; listeners need an Insight check vs 8 + Cha mod + PB to tell.' },
  athlete:        { name: 'Athlete', category: 'general', asiFrom: ['str', 'dex'], desc: 'Climb speed equal to your Speed. Standing up from Prone costs only 5 ft. Running jumps need only a 5-ft run-up.' },
  charger:        { name: 'Charger', category: 'general', asiFrom: ['str', 'dex'], desc: 'Dash adds +10 ft. Once per turn after moving 10+ ft straight, a melee hit deals +1d8 or pushes the target 10 ft.' },
  chef:           { name: 'Chef', category: 'general', asiFrom: ['con', 'wis'], desc: "Cook's Utensils proficiency. After a Short Rest, food you cook heals up to 4 + PB creatures 1d8 each. After a Long Rest, make PB treats that give temp HP equal to your PB.", resource: { id: 'chef_treats', label: 'Chef treats', max: 'pb', recharge: 'long' } },
  crossbowExpert: { name: 'Crossbow Expert', category: 'general', asiFrom: ['dex'], desc: 'Ignore the Loading property of crossbows. No Disadvantage firing them within 5 ft of an enemy. Your Light-crossbow extra attack adds your ability modifier to damage.' },
  crusher:        { name: 'Crusher', category: 'general', asiFrom: ['str', 'con'], desc: 'Once per turn, a Bludgeoning hit can push the target 5 ft. On a Bludgeoning critical hit, attacks against the target have Advantage until your next turn.' },
  defensiveDuelist:{ name: 'Defensive Duelist', category: 'general', asiFrom: ['dex'], desc: 'Reaction while holding a Finesse weapon: add your PB to AC against one melee attack (needs Dex 13+).' },
  dualWielder:    { name: 'Dual Wielder', category: 'general', asiFrom: ['str', 'dex'], desc: 'When you attack with a Light weapon, your extra Bonus Action attack can use a non-Two-Handed weapon. Draw or stow two weapons at once.' },
  durable:        { name: 'Durable', category: 'general', asiFrom: ['con'], desc: 'Advantage on Death Saving Throws. Bonus Action: spend one Hit Die to heal.' },
  grappler:       { name: 'Grappler', category: 'general', asiFrom: ['str', 'dex'], desc: 'An Unarmed Strike can both damage and grapple once per turn. Advantage on attacks against creatures you grapple. Moving a grappled creature your size or smaller costs no extra movement.' },
  greatWeaponMaster:{ name: 'Great Weapon Master', category: 'general', asiFrom: ['str'], desc: 'Heavy weapon hits deal extra damage equal to your PB. After a critical hit or a kill with a melee weapon, make one attack as a Bonus Action.' },
  heavilyArmored: { name: 'Heavily Armored', category: 'general', asiFrom: ['str', 'con'], desc: 'Training with Heavy armor (needs Medium armor training).' },
  heavyArmorMaster:{ name: 'Heavy Armor Master', category: 'general', asiFrom: ['str', 'con'], desc: 'While in Heavy armor, reduce Bludgeoning, Piercing and Slashing damage you take by your PB.' },
  inspiringLeader:{ name: 'Inspiring Leader', category: 'general', asiFrom: ['wis', 'cha'], desc: 'After a Short or Long Rest, give up to six creatures temp HP equal to your level + the raised ability modifier (needs Wis or Cha 13+).' },
  keenMind:       { name: 'Keen Mind', category: 'general', asiFrom: ['int'], desc: 'Proficiency (or Expertise) in one of Arcana, History, Investigation, Nature or Religion. Study action as a Bonus Action.', choice: { type: 'pick', label: 'Skill', options: ['arcana', 'history', 'investigation', 'nature', 'religion'], skill: true } },
  lightlyArmored: { name: 'Lightly Armored', category: 'general', asiFrom: ['str', 'dex'], desc: 'Training with Light armor and Shields.' },
  mageSlayer:     { name: 'Mage Slayer', category: 'general', asiFrom: ['str', 'dex'], desc: 'Creatures you damage have Disadvantage on saves to keep Concentration. Once per Short or Long Rest, turn a failed Int, Wis or Cha save into a success.' },
  martialWeaponTraining:{ name: 'Martial Weapon Training', category: 'general', asiFrom: ['str', 'dex'], desc: 'Proficiency with Martial weapons.' },
  mediumArmorMaster:{ name: 'Medium Armor Master', category: 'general', asiFrom: ['str', 'dex'], desc: 'In Medium armor you can add up to +3 Dex to AC (instead of +2) (needs Medium armor training).' },
  moderatelyArmored:{ name: 'Moderately Armored', category: 'general', asiFrom: ['str', 'dex'], desc: 'Training with Medium armor (needs Light armor training).' },
  mountedCombatant:{ name: 'Mounted Combatant', category: 'general', asiFrom: ['str', 'dex', 'wis'], desc: 'While mounted: Advantage on melee attacks against unmounted creatures smaller than your mount; your mount takes no damage on a successful Dex save (half on a failure); you can redirect an attack aimed at your mount to yourself.' },
  piercer:        { name: 'Piercer', category: 'general', asiFrom: ['str', 'dex'], desc: 'Once per turn, reroll one Piercing damage die. Piercing critical hits roll one extra damage die.' },
  poisoner:       { name: 'Poisoner', category: 'general', asiFrom: ['dex', 'int'], desc: "Your Poison damage ignores Resistance. Poisoner's Kit proficiency: brew doses (Con save or 2d8 Poison and Poisoned)." },
  polearmMaster:  { name: 'Polearm Master', category: 'general', asiFrom: ['str', 'dex'], desc: 'With a Quarterstaff, Spear or Heavy-Reach weapon: Bonus Action d4 butt-end attack, and an Opportunity Attack when a creature enters your reach.' },
  ritualCaster:   { name: 'Ritual Caster', category: 'general', asiFrom: ['int', 'wis', 'cha'], desc: 'Learn level 1 Ritual spells (as many as your PB) and cast them as rituals. Once per Long Rest, cast one at normal speed without a slot.' },
  sentinel:       { name: 'Sentinel', category: 'general', asiFrom: ['str', 'dex'], desc: 'Reaction attack when an enemy within 5 ft attacks someone else. Your Opportunity Attack hits drop the target\'s Speed to 0, even if it Disengaged.' },
  sharpshooter:   { name: 'Sharpshooter', category: 'general', asiFrom: ['dex'], desc: 'Ranged weapon attacks ignore Half and Three-Quarters Cover, have no Disadvantage at long range, and none when an enemy is within 5 ft.' },
  shieldMaster:   { name: 'Shield Master', category: 'general', asiFrom: ['str'], desc: 'Once per turn after a melee hit, shield-bash to push 5 ft or knock Prone (Str save). Reaction: take no damage on a successful Dex save against an area effect.' },
  skulker:        { name: 'Skulker', category: 'general', asiFrom: ['dex'], desc: 'Blindsight 10 ft. Advantage on Stealth checks made to Hide during combat. Missing with an attack while hidden doesn\'t reveal you.' },
  slasher:        { name: 'Slasher', category: 'general', asiFrom: ['str', 'dex'], desc: 'Once per turn, a Slashing hit reduces the target\'s Speed by 10 ft. A Slashing critical hit gives it Disadvantage on attacks until your next turn.' },
  speedy:         { name: 'Speedy', category: 'general', asiFrom: ['dex', 'con'], desc: '+10 ft Speed. Dash ignores Difficult Terrain that turn. Opportunity Attacks against you have Disadvantage.' },
  spellSniper:    { name: 'Spell Sniper', category: 'general', asiFrom: ['int', 'wis', 'cha'], desc: 'Spell attacks ignore Half and Three-Quarters Cover, have no Disadvantage within 5 ft of an enemy, and spells with a range of 10+ ft gain +60 ft.' },
  weaponMaster:   { name: 'Weapon Master', category: 'general', asiFrom: ['str', 'dex'], desc: 'Use the mastery property of one weapon kind you are proficient with; change it after a Long Rest.' },

  // Epic Boon (level 19) — Brad is researching these separately (2026-10-25),
  // so the builder takes a typed-in boon for now. Raises one ability by 1, up to 30.
  epicBoonCustom: { name: 'Epic Boon (type it in)', category: 'epic', asiFromChoice: true, desc: 'Type the Epic Boon\'s name and a one-line summary from the PHB.', choice: { type: 'custom' } },

  other:          { name: 'Other feat (type it in)', category: 'general', desc: 'Any other 2024 PHB feat you qualify for — type its name and a one-line summary.', choice: { type: 'custom' } }
};

// ---------------------------------------------------------------------
// SPECIES (10). Sub-choice options can grant: cantrip, spells{3,5},
// speed, darkvision, resist, skill, desc. spellAbility: true means the
// player picks Int, Wis or Cha for that species' spells.
// ---------------------------------------------------------------------
const SPECIES_2024 = {
  aasimar: {
    name: 'Aasimar', sizes: ['Medium', 'Small'], speed: 30, darkvision: 60,
    traits: [
      { name: 'Celestial Resistance', desc: 'Resistance to Necrotic and Radiant damage.' },
      { name: 'Healing Hands', desc: 'Magic action, once per Long Rest: touch a creature and heal it a number of d4s equal to your Proficiency Bonus.' },
      { name: 'Light Bearer', desc: 'You know the Light cantrip (Charisma).' },
      { name: 'Celestial Revelation (level 3)', desc: 'Bonus Action, once per Long Rest: transform for 1 minute. Once per turn, deal extra damage equal to your Proficiency Bonus (Radiant, or Necrotic for Shroud). Form chosen each time: Heavenly Wings (Fly speed = Speed), Inner Radiance (bright light 10 ft; Radiant damage = PB to creatures within 10 ft at end of your turns), or Necrotic Shroud (creatures within 10 ft: Cha save or Frightened).', minLevel: 3 }
    ],
    cantrips: ['Light'],
    resources: [
      { id: 'healing_hands', label: 'Healing Hands (1/long)', max: 1, recharge: 'long' },
      { id: 'celestial_revelation', label: 'Celestial Revelation (1/long)', max: 1, recharge: 'long', minLevel: 3 }
    ]
  },
  dragonborn: {
    name: 'Dragonborn', sizes: ['Medium'], speed: 30, darkvision: 60,
    traits: [
      { name: 'Breath Weapon', desc: 'Replace one attack: 15-ft Cone or 30×5-ft Line. Dex save (DC 8 + Con mod + PB), 1d10 of your ancestry type, half on a success. 2d10 at level 5. Uses = PB per Long Rest.' },
      { name: 'Damage Resistance', desc: 'Resistance to your ancestry\'s damage type.' },
      { name: 'Draconic Flight (level 5)', desc: 'Bonus Action, once per Long Rest: Fly speed equal to your Speed for 10 minutes.', minLevel: 5 }
    ],
    choices: [
      { id: 'ancestry', label: 'Draconic Ancestry', options: {
        black: { name: 'Black (Acid)' }, blue: { name: 'Blue (Lightning)' }, brass: { name: 'Brass (Fire)' }, bronze: { name: 'Bronze (Lightning)' },
        copper: { name: 'Copper (Acid)' }, gold: { name: 'Gold (Fire)' }, green: { name: 'Green (Poison)' }, red: { name: 'Red (Fire)' },
        silver: { name: 'Silver (Cold)' }, white: { name: 'White (Cold)' } } }
    ],
    resources: [
      { id: 'breath_weapon', label: 'Breath Weapon', max: 'pb', recharge: 'long' },
      { id: 'draconic_flight', label: 'Draconic Flight (1/long)', max: 1, recharge: 'long', minLevel: 5 }
    ]
  },
  dwarf: {
    name: 'Dwarf', sizes: ['Medium'], speed: 30, darkvision: 120,
    traits: [
      { name: 'Dwarven Resilience', desc: 'Resistance to Poison damage; Advantage on saves to avoid or end Poisoned.' },
      { name: 'Dwarven Toughness', desc: '+1 Hit Point maximum per level.' },
      { name: 'Stonecunning', desc: 'Bonus Action while on or touching stone: Tremorsense 60 ft for 10 minutes. Uses = PB per Long Rest.' }
    ],
    hpPerLevel: 1,
    resources: [{ id: 'stonecunning', label: 'Stonecunning', max: 'pb', recharge: 'long' }]
  },
  elf: {
    name: 'Elf', sizes: ['Medium'], speed: 30, darkvision: 60,
    traits: [
      { name: 'Fey Ancestry', desc: 'Advantage on saves to avoid or end Charmed.' },
      { name: 'Keen Senses', desc: 'Proficiency in Insight, Perception or Survival (chosen below).' },
      { name: 'Trance', desc: 'You don\'t need sleep; 4 hours of trance gives a Long Rest.' },
      { name: 'Elven Lineage', desc: 'Lineage spells: cast each level 3/5 spell once per Long Rest without a slot, or with slots.' }
    ],
    spellAbility: true,
    skillChoice: { label: 'Keen Senses skill', from: ['insight', 'perception', 'survival'] },
    choices: [
      { id: 'lineage', label: 'Elven Lineage', options: {
        drow:   { name: 'Drow', desc: 'Darkvision 120 ft. Dancing Lights; Faerie Fire at 3; Darkness at 5.', darkvision: 120, cantrip: 'Dancing Lights', spells: { 3: 'Faerie Fire', 5: 'Darkness' } },
        high:   { name: 'High Elf', desc: 'Prestidigitation (swap for another Wizard cantrip after a Long Rest); Detect Magic at 3; Misty Step at 5.', cantrip: 'Prestidigitation', spells: { 3: 'Detect Magic', 5: 'Misty Step' } },
        wood:   { name: 'Wood Elf', desc: 'Speed 35 ft. Druidcraft; Longstrider at 3; Pass without Trace at 5.', speed: 35, cantrip: 'Druidcraft', spells: { 3: 'Longstrider', 5: 'Pass without Trace' } }
      } }
    ]
  },
  gnome: {
    name: 'Gnome', sizes: ['Small'], speed: 30, darkvision: 60,
    traits: [
      { name: 'Gnomish Cunning', desc: 'Advantage on Intelligence, Wisdom and Charisma saves.' }
    ],
    spellAbility: true,
    choices: [
      { id: 'lineage', label: 'Gnomish Lineage', options: {
        forest: { name: 'Forest Gnome', desc: 'Minor Illusion. Speak with Animals always prepared; cast it free PB times per Long Rest.', cantrip: 'Minor Illusion', alwaysPrepared: ['Speak with Animals'],
                  resource: { id: 'forest_gnome_animals', label: 'Speak with Animals (free casts)', max: 'pb', recharge: 'long' } },
        rock:   { name: 'Rock Gnome', desc: 'Mending and Prestidigitation. 10 minutes: build a Tiny clockwork device (AC 5, 1 HP) with one Prestidigitation effect; up to 3 at once, each lasts 8 hours.', cantrip: 'Mending', cantrip2: 'Prestidigitation' }
      } }
    ]
  },
  goliath: {
    name: 'Goliath', sizes: ['Medium'], speed: 35, darkvision: 0,
    traits: [
      { name: 'Large Form (level 5)', desc: 'Bonus Action, once per Long Rest: become Large for 10 minutes — Advantage on Str checks, +10 ft Speed.', minLevel: 5 },
      { name: 'Powerful Build', desc: 'Advantage on checks to end Grappled. Count as one size larger for carrying.' }
    ],
    choices: [
      { id: 'ancestry', label: 'Giant Ancestry (uses = PB per Long Rest)', options: {
        cloud: { name: "Cloud's Jaunt", desc: 'Bonus Action: teleport up to 30 ft to a space you can see.' },
        fire:  { name: "Fire's Burn", desc: 'When you hit with an attack: +1d10 Fire damage.' },
        frost: { name: "Frost's Chill", desc: 'When you hit with an attack: +1d6 Cold and the target\'s Speed drops 10 ft until your next turn.' },
        hill:  { name: "Hill's Tumble", desc: 'When you hit a Large or smaller creature: knock it Prone.' },
        stone: { name: "Stone's Endurance", desc: 'Reaction when you take damage: roll 1d12 + Con mod and reduce the damage by that much.' },
        storm: { name: "Storm's Thunder", desc: 'Reaction when a creature within 60 ft damages you: deal 1d8 Thunder to it.' }
      } }
    ],
    resources: [
      { id: 'giant_ancestry', label: 'Giant Ancestry', max: 'pb', recharge: 'long' },
      { id: 'large_form', label: 'Large Form (1/long)', max: 1, recharge: 'long', minLevel: 5 }
    ]
  },
  halfling: {
    name: 'Halfling', sizes: ['Small'], speed: 30, darkvision: 0,
    traits: [
      { name: 'Brave', desc: 'Advantage on saves to avoid or end Frightened.' },
      { name: 'Halfling Nimbleness', desc: 'Move through the space of any creature a size larger than you (can\'t stop there).' },
      { name: 'Luck', desc: 'When you roll a 1 on a d20 Test, reroll it and use the new roll.' },
      { name: 'Naturally Stealthy', desc: 'You can Hide when obscured only by a creature at least one size larger than you.' }
    ]
  },
  human: {
    name: 'Human', sizes: ['Medium', 'Small'], speed: 30, darkvision: 0,
    traits: [
      { name: 'Resourceful', desc: 'Gain Heroic Inspiration whenever you finish a Long Rest.' },
      { name: 'Skillful', desc: 'Proficiency in one skill of your choice.' },
      { name: 'Versatile', desc: 'Gain an Origin feat of your choice.' }
    ],
    skillChoice: { label: 'Skillful — any skill', from: 'any' },
    originFeat: true
  },
  orc: {
    name: 'Orc', sizes: ['Medium'], speed: 30, darkvision: 120,
    traits: [
      { name: 'Adrenaline Rush', desc: 'Dash as a Bonus Action and gain temp HP equal to your PB. Uses = PB, regained on a Short or Long Rest.' },
      { name: 'Relentless Endurance', desc: 'Once per Long Rest, when reduced to 0 HP but not killed outright, drop to 1 HP instead.' }
    ],
    resources: [
      { id: 'adrenaline_rush', label: 'Adrenaline Rush', max: 'pb', recharge: 'short' },
      { id: 'relentless_endurance', label: 'Relentless Endurance (1/long)', max: 1, recharge: 'long' }
    ]
  },
  tiefling: {
    name: 'Tiefling', sizes: ['Medium', 'Small'], speed: 30, darkvision: 60,
    traits: [
      { name: 'Otherworldly Presence', desc: 'You know Thaumaturgy (same ability as your Legacy spells).' },
      { name: 'Fiendish Legacy', desc: 'Legacy spells: cast each level 3/5 spell once per Long Rest without a slot, or with slots.' }
    ],
    cantrips: ['Thaumaturgy'],
    spellAbility: true,
    choices: [
      { id: 'legacy', label: 'Fiendish Legacy', options: {
        abyssal:  { name: 'Abyssal', desc: 'Poison resistance. Poison Spray; Ray of Sickness at 3; Hold Person at 5.', cantrip: 'Poison Spray', spells: { 3: 'Ray of Sickness', 5: 'Hold Person' }, resist: 'Poison' },
        chthonic: { name: 'Chthonic', desc: 'Necrotic resistance. Chill Touch; False Life at 3; Ray of Enfeeblement at 5.', cantrip: 'Chill Touch', spells: { 3: 'False Life', 5: 'Ray of Enfeeblement' }, resist: 'Necrotic' },
        infernal: { name: 'Infernal', desc: 'Fire resistance. Fire Bolt; Hellish Rebuke at 3; Darkness at 5.', cantrip: 'Fire Bolt', spells: { 3: 'Hellish Rebuke', 5: 'Darkness' }, resist: 'Fire' }
      } }
    ]
  }
};

window.ABILITY_KEYS = ABILITY_KEYS;
window.ABILITY_NAMES = ABILITY_NAMES;
window.SKILL_NAMES = SKILL_NAMES;
window.STANDARD_LANGUAGES = STANDARD_LANGUAGES;
window.BACKGROUNDS_2024 = BACKGROUNDS_2024;
window.FEATS_2024 = FEATS_2024;
window.SPECIES_2024 = SPECIES_2024;
