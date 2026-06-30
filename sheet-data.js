// =====================================================================
// ELDORIA 2.0 — CHARACTER SHEET DATA
// Add new characters here. The same file is loaded by index.html (modal)
// and sheet.html (standalone) so this is the single source of truth.
// =====================================================================

const CHARACTERS = {};

// ----- VAELORAN DUSKWHISPER ----------------------------------------
CHARACTERS.vaeloran = {
  id: 'vaeloran',
  name: 'Vaeloran Duskwhisper',
  alias: 'Aurek Voln Drowhiss',
  species: 'Human',
  className: 'Wizard',
  level: 20,
  subclass: 'School of Divination',
  background: 'Sage',
  alignment: 'Lawful Evil (believes Lawful Neutral)',
  age: 67,
  size: 'Medium',
  appearance: 'Silver-threaded robes, calm eyes that carry warmth he has not yet abandoned, hands that are never still.',
  ac: 17, acNote: 'Robe of the Archmagi + Mage Armour',
  hpMax: 144,
  hitDice: { max: 20, die: 'd6' },
  speed: 30, initiative: 4, proficiencyBonus: 6, passivePerception: 20,
  abilities: { str: 10, dex: 14, con: 16, int: 26, wis: 18, cha: 16 },
  saves: {
    int: { proficient: true, modOverride: 14 },
    wis: { proficient: true, modOverride: 10 }
  },
  skills: {
    arcana:     { proficient: true, expertise: true, modOverride: 20 },
    history:    { proficient: true, modOverride: 14 },
    insight:    { proficient: true, modOverride: 10 },
    deception:  { proficient: true, modOverride: 9 },
    perception: { proficient: true, modOverride: 10 }
  },
  senses: 'Truesight 10ft (Gem of Seeing), passive Perception 20',
  damageResist: ['Damage from spells (Robe of the Archmagi)'],
  weapons: [
    { name: 'Fire Bolt (cantrip)', atk: 13, damage: '4d10 fire', notes: 'Range 120ft · L17+ scaling' },
    { name: 'Quarterstaff',         atk: 6,  damage: '1d6 bludgeoning', notes: 'Versatile (1d8); fallback only' }
  ],
  classFeatures: [
    { name: 'Portent (Divination signature)', desc: 'Rolls 2d20 at dawn each day. Can replace ANY roll (his or another creature\'s) with one of these dice. Always has two stored. Most dangerous ability — guarantees a Counterspell, forces an enemy fail, or survives a crit.' },
    { name: 'Architect of Inevitability',     desc: 'At the start of combat, has already prepared one free Counterspell or Shield (his choice). Does not need to expend a spell slot for the first use.' },
    { name: 'Expert Divination',              desc: 'When he casts a divination spell of 2nd level or higher, regains one expended spell slot (max 5th level).' },
    { name: 'The Third Eye',                  desc: 'Darkvision 60ft OR read any language OR see Ethereal Plane 60ft (bonus action; resets on short rest).' },
    { name: 'Signature Spells',               desc: 'Foresight and Mind Blank — cast once per day each without a spell slot.' },
    { name: 'Spell Mastery',                  desc: 'Misty Step (2nd) and Counterspell (3rd) can be cast at their lowest level without expending a slot (1/short rest each).' },
    { name: 'Legendary Resistance (3/day)',   desc: 'When he fails a saving throw, he can choose to succeed instead.' }
  ],
  speciesTraits: [
    { name: 'Human (Resourceful)', desc: 'Gains Heroic Inspiration whenever he finishes a long rest.' },
    { name: 'Skillful',            desc: 'Proficient in one additional skill (Insight).' },
    { name: 'Versatile',           desc: 'Gained the Skilled feat at 1st level.' }
  ],
  feats: [
    { name: 'Skilled (Origin)',  desc: 'Three additional skill proficiencies.' },
    { name: 'War Caster',        desc: 'Adv on Con saves for concentration; can perform somatic components with hands full; cast a spell as opportunity attack.' },
    { name: 'Resilient (Wisdom)', desc: 'Proficiency in Wisdom saves.' },
    { name: 'Alert',             desc: '+5 to initiative; cannot be surprised while conscious.' },
    { name: 'Lucky',             desc: 'Has 3 luck points per day to alter d20 rolls.' }
  ],
  equipmentProf: {
    armor: [],
    weapons: ['Daggers', 'darts', 'slings', 'quarterstaffs', 'light crossbows'],
    tools: ["Calligrapher's supplies"]
  },
  spellcasting: {
    ability: 'INT', modifier: 8, saveDC: 21, attackBonus: 13,
    slots: [4, 3, 3, 3, 3, 2, 2, 1, 1]
  },
  spells: [
    { level: 0, name: 'Fire Bolt',          school: 'Evocation',   cast: 'Action',     range: '120ft',         desc: 'Ranged spell attack. Hit: 4d10 fire damage. Ignites unattended flammables.' },
    { level: 0, name: 'Mage Hand',          school: 'Conjuration', cast: 'Action',     range: '30ft',          desc: 'Spectral hand. Move/manipulate objects up to 10lb. 1 minute.' },
    { level: 0, name: 'Prestidigitation',   school: 'Transmutation', cast: 'Action',   range: '10ft',          desc: 'Minor magical trick: sensory effect, clean/soil, chill/warm/flavour matter, illusory trinkets.' },
    { level: 0, name: 'Minor Illusion',     school: 'Illusion',    cast: 'Action',     range: '30ft',          desc: 'Sound or image of an object lasting 1 minute. Investigation DC 21 to discern.' },
    { level: 0, name: 'Light',              school: 'Evocation',   cast: 'Action',     range: 'Touch',         desc: 'Object sheds bright 20ft / dim 20ft. 1 hour.' },
    { level: 1, name: 'Shield',             school: 'Abjuration',  cast: 'Reaction',   range: 'Self',          desc: '+5 AC until start of next turn. Triggered by being hit or Magic Missile. ARCHITECT OF INEVITABILITY: free first use per combat.', tags: ['reaction'] },
    { level: 1, name: 'Mage Armor',         school: 'Abjuration',  cast: 'Action',     range: 'Touch',         desc: 'AC = 13 + Dex (no armour). 8 hours. He casts this on himself every morning.' },
    { level: 1, name: 'Detect Magic',       school: 'Divination',  cast: 'Action (R)', range: 'Self (30ft)',   desc: 'Sense magic within 30ft for 10 minutes. Action to see faint aura and school.', tags: ['concentration', 'ritual'] },
    { level: 2, name: 'Misty Step',         school: 'Conjuration', cast: 'Bonus',      range: 'Self',          desc: 'Teleport 30ft to unoccupied space he can see. SPELL MASTERY: free 1/short rest at 2nd level.', tags: ['mastery'] },
    { level: 2, name: 'Suggestion',         school: 'Enchantment', cast: 'Action',     range: '30ft',          desc: 'WIS DC 21 or follow reasonable course of action. 8 hours. He prefers this to violence.', tags: ['concentration'] },
    { level: 2, name: 'Mirror Image',       school: 'Illusion',    cast: 'Action',     range: 'Self',          desc: 'Three illusory duplicates. Attacks may hit a duplicate (DC 6/8/11 depending on number remaining).' },
    { level: 3, name: 'Counterspell',       school: 'Abjuration',  cast: 'Reaction',   range: '60ft',          desc: 'Interrupt a creature casting. L3 or below: auto. Higher: ability check DC 10+spell level (uses Portent if critical). SPELL MASTERY: free 1/short rest at 3rd level.', tags: ['reaction', 'mastery'] },
    { level: 3, name: 'Dispel Magic',       school: 'Abjuration',  cast: 'Action',     range: '120ft',         desc: 'End spell of L3 or lower. Higher: ability check DC 10 + spell level.' },
    { level: 3, name: 'Fly',                school: 'Transmutation', cast: 'Action',   range: 'Touch',         desc: 'Target gains flying speed 60ft for 10 minutes.', tags: ['concentration'] },
    { level: 4, name: 'Greater Invisibility', school: 'Illusion',  cast: 'Action',     range: 'Touch',         desc: 'Target invisible for 1 minute. Adv on attacks; attacks vs target have disadv.', tags: ['concentration'] },
    { level: 4, name: 'Polymorph',          school: 'Transmutation', cast: 'Action',   range: '60ft',          desc: 'WIS DC 21 or transform into a beast (CR ≤ target\'s level) for 1 hour or until 0 HP.', tags: ['concentration'] },
    { level: 4, name: 'Banishment',         school: 'Abjuration',  cast: 'Action',     range: '60ft',          desc: 'CHA DC 21 or banished to a harmless demiplane for 1 minute (if from this plane) or sent home permanently.', tags: ['concentration'] },
    { level: 5, name: 'Hold Monster',       school: 'Enchantment', cast: 'Action',     range: '90ft',          desc: 'WIS DC 21 each turn or paralyzed. Melee = auto-crit. 1 minute.', tags: ['concentration'] },
    { level: 5, name: 'Dominate Person',    school: 'Enchantment', cast: 'Action',     range: '60ft',          desc: 'WIS DC 21 or full control of humanoid. Repeat save on damage. 1 minute. His preferred opening on the most physically dangerous PC.', tags: ['concentration'] },
    { level: 5, name: 'Modify Memory',      school: 'Enchantment', cast: 'Action',     range: '30ft',          desc: 'WIS DC 21 or modify memories of an event in past 24h. He has done this to Lyssandra. NOT usable mid-combat.', tags: ['concentration'] },
    { level: 5, name: 'Wall of Force',      school: 'Evocation',   cast: 'Action',     range: '120ft',         desc: 'Invisible force barrier. Nothing physical passes. 10 minutes. Immune to dispel magic.', tags: ['concentration'] },
    { level: 6, name: 'Globe of Invulnerability', school: 'Abjuration', cast: 'Action', range: 'Self (10ft sphere)', desc: 'Immune to spells of 5th level and below within 10ft. Each 6th+ slot raises immunity by one level.', tags: ['concentration'] },
    { level: 6, name: 'Disintegrate',       school: 'Transmutation', cast: 'Action',   range: '60ft',          desc: 'CON DC 21 or 10d6+40 force. On 0 HP: dust. No resurrection except Wish.' },
    { level: 6, name: 'Mass Suggestion',    school: 'Enchantment', cast: 'Action',     range: '60ft',          desc: 'WIS DC 21 (up to 12 creatures) or follow reasonable course of action. 24 hours.' },
    { level: 6, name: 'True Seeing',        school: 'Divination',  cast: 'Action',     range: 'Touch',         desc: 'Target sees through illusions, invisibility, into Ethereal Plane. 120ft truesight. 1 hour.' },
    { level: 7, name: 'Forcecage',          school: 'Evocation',   cast: 'Action',     range: '100ft',         desc: 'Immobile cube of force traps creatures. CHA save DC 21 to teleport out. 1 hour.' },
    { level: 7, name: 'Teleport',           school: 'Conjuration', cast: 'Action',     range: '10ft',          desc: 'Instantly transport self + up to 8 willing creatures to a destination he knows.' },
    { level: 7, name: 'Plane Shift',        school: 'Conjuration', cast: 'Action',     range: 'Touch',         desc: 'Transport up to 8 willing creatures (or banish one — CHA DC 21) to another plane.' },
    { level: 8, name: 'Mind Blank',         school: 'Abjuration',  cast: 'Action',     range: 'Touch',         desc: 'Immune to psychic damage, any mind-reading, charm of any kind. 24 hours. SIGNATURE: free 1/day. He casts this every morning — assume active.', tags: ['signature'] },
    { level: 8, name: 'Maze',               school: 'Conjuration', cast: 'Action',     range: '60ft',          desc: 'Banishes target to extradimensional maze. INT DC 20 to escape (check each turn).', tags: ['concentration'] },
    { level: 8, name: 'Feeblemind',         school: 'Enchantment', cast: 'Action',     range: '150ft',         desc: 'INT/CHA DC 21 or INT and CHA become 1. Cannot cast spells. Until Greater Restoration / Heal / Wish.' },
    { level: 9, name: 'Foresight',          school: 'Divination',  cast: '1 minute',   range: 'Touch',         desc: 'Cannot be surprised. Adv on attacks/saves/checks. Attacks vs = disadv. 8 hours. SIGNATURE: free 1/day. Cast this morning — assume active.', tags: ['signature'] },
    { level: 9, name: 'Meteor Swarm',       school: 'Evocation',   cast: 'Action',     range: '1 mile',        desc: '40d6 fire+bludgeoning in four 40ft-radius spheres. DEX DC 21 half. Last resort — he dislikes destruction.' },
    { level: 9, name: 'Wish',               school: 'Conjuration', cast: 'Action',     range: 'Self',          desc: 'Mightiest spell. Duplicate any spell of L8 or lower with no components, or alter reality. Stress penalty after duplicating L7+.' },
    { level: 9, name: 'Time Stop',          school: 'Transmutation', cast: 'Action',   range: 'Self',          desc: 'Take 1d4+1 turns in a row. Ends if he affects another creature or moves more than 1000ft from start.' }
  ],
  languages: ['Common', 'Elvish', 'Draconic', 'Infernal', 'Deep Speech', 'Celestial'],
  equipment: [
    'Robe of the Archmagi (attuned · resistance to spell damage · adv on saves vs spells · spell save DC +2 already in totals)',
    'Gem of Seeing (attuned · truesight 10ft when activated)',
    'Ring of Mind Shielding (attuned · immune to magical mind reading)',
    'Wand of the War Mage +2 (arcane focus)',
    'Spellbook (master copy, kept in his tower)',
    'Component pouch',
    'Scholar\'s journal',
    'Identification papers as "Aurek Voln Drowhiss"',
    'Diamond dust (1000gp, components)'
  ],
  attunements: ['Robe of the Archmagi', 'Gem of Seeing', 'Ring of Mind Shielding'],
  coins: { cp: 0, sp: 0, ep: 0, gp: 2400, pp: 180 },
  backstory: 'Patron to Sylas. Secret villain. Operates the "Aurek Voln Drowhiss" criminal alias to engineer political instability while presenting as a benevolent archmage. True goal: control all of Eldoria — pursuing lichdom via meteor shard phylactery. Believes he is the only one willing to do what must be done. Genuinely sees himself as the hero.',
  personality: 'Calm authority. Treats every conversation as a negotiation. Disappointed, not angry, when crossed. Patient on the scale of decades. Believes ends justify means absolutely.',
  ideal: 'Order through control.',
  bond: 'Aeloria Crossroads must not fall to the Aurum Dominion.',
  flaw: 'Cannot conceive that his methods might be worse than the disease he is curing.',
  resources: [
    { id: 'portent',       label: 'Portent dice',                     max: 2, recharge: 'long',  note: 'Stored 2d20. Replace any roll.' },
    { id: 'legres',        label: 'Legendary Resistance',             max: 3, recharge: 'long' },
    { id: 'mastery_misty', label: 'Misty Step (free, mastery)',       max: 1, recharge: 'short' },
    { id: 'mastery_cs',    label: 'Counterspell (free, mastery)',     max: 1, recharge: 'short' },
    { id: 'thirdeye',      label: 'Third Eye',                        max: 1, recharge: 'short' },
    { id: 'signature_mb',  label: 'Mind Blank (signature, free)',     max: 1, recharge: 'long' },
    { id: 'signature_fs',  label: 'Foresight (signature, free)',      max: 1, recharge: 'long' },
    { id: 'arch_inev',     label: 'Architect of Inevitability',       max: 1, recharge: 'long' }
  ]
};

// ----- SISTER KAELITH -----------------------------------------------
// Tiefling Cleric 10, Pestilence Domain (WotC playtest material)
CHARACTERS.kaelith = {
  id: 'kaelith',
  name: 'Sister Kaelith',
  species: 'Tiefling',
  className: 'Cleric',
  level: 10,
  subclass: 'Pestilence Domain (playtest)',
  background: 'Acolyte',
  alignment: 'Neutral Evil',
  age: 30,
  size: 'Medium',
  appearance: 'Ashen skin, green eyes, black hair. 5ft tall, 95lb. Carries the smell of damp earth and turning leaves. Devoted to Naturus.',
  ac: 19, acNote: 'Mithral Half Plate + Shield',
  hpMax: 83,
  hitDice: { max: 10, die: 'd8' },
  speed: 30, initiative: 2, proficiencyBonus: 4, passivePerception: 15,
  abilities: { str: 14, dex: 14, con: 14, int: 12, wis: 20, cha: 8 },
  saves: {
    wis: { proficient: true, modOverride: 9 },
    cha: { proficient: true, modOverride: 3 }
  },
  skills: {
    arcana:    { proficient: false, modOverride: 6 },  // Thaumaturge +5 to Arcana
    religion:  { proficient: false, modOverride: 6 },  // Thaumaturge +5 to Religion
    medicine:  { proficient: true },
    insight:   { proficient: true },
    perception: { proficient: true }
  },
  senses: 'Darkvision 60ft, passive Perception 15',
  damageResist: ['Necrotic', 'Poison', 'Fire (Tiefling Hellish Resistance)'],
  weapons: [
    { name: 'Mace +3 (magic)',       atk: 9, damage: '1d6+5 bludgeoning', notes: 'Magic; Sap mastery (disadv on next atk)' },
    { name: 'Chill Touch (cantrip)', atk: 9, damage: '2d10 necrotic',     notes: 'V/S · range 120ft · target can\'t regain HP until end of next turn' },
    { name: 'Sacred Flame (cantrip)', atk: 0, damage: '2d8+5 radiant',   notes: 'DEX DC 17 · range 60ft · no cover benefit · +5 Potent Spellcasting' },
    { name: 'Light Crossbow',        atk: 6, damage: '1d8+2 piercing',    notes: 'Range 80/320 · Slow mastery' },
    { name: 'Mace (basic)',          atk: 6, damage: '1d6+2 bludgeoning', notes: 'Fallback if disarmed of magic mace' }
  ],
  classFeatures: [
    { name: 'Blight Weaver (Pestilence 1)',     desc: 'Resistance to Necrotic and Poison damage. As a Reaction when taking necrotic or poison damage, can swap which type she\'s resistant to. Her own necrotic/poison damage ignores resistance.' },
    { name: 'Plague Blessing (Pestilence 2)',   desc: 'As a Bonus Action expend a Channel Divinity: become a 5ft Emanation of plague for 1 minute. Each creature that starts its turn in the emanation makes CON DC 17 or gains 1 Exhaustion (max = WIS mod = 5 levels stacking). Concentration. 3/Long Rest.' },
    { name: 'Virulent Burst (Pestilence 6, Reaction)', desc: 'When a creature within 60ft drops to 0HP: 10ft Emanation centred on that creature (20ft if they had Exhaustion). Each creature in the burst makes CON DC 17 or suffers EITHER Putrid Shock (Incapacitated until end of next turn) OR Toxic Infection (3d6 Necrotic + 3d6 Poison). Uses = WIS mod = 5/Long Rest.' },
    { name: 'Potent Spellcasting (Pestilence/Cleric)', desc: '+5 (WIS mod) damage to Cleric cantrips that deal damage (already in cantrip damage above).' },
    { name: 'Channel Divinity (3/Long Rest)',   desc: 'Spend a use for: Divine Spark · Turn Undead · Sear Undead (when Turn Undead succeeds, deal 5d8 radiant) · Plague Blessing. Recovers on short rest (1 use) or long rest (all).' },
    { name: 'Divine Intervention (1/Long Rest)', desc: 'Once per long rest, cast any Cleric spell of L5 or lower for free, no components, no concentration penalty. At Cleric 20 this becomes auto-success at 100%.' },
    { name: 'Thaumaturge',                       desc: '+5 (Prof + WIS) to Arcana and Religion checks. Knows Thaumaturgy cantrip.' },
    { name: 'Cloak of Displacement (attuned)',   desc: 'Attackers have disadvantage on attack rolls against her, until she takes damage. Resets at the start of her next turn or when she takes damage.' }
  ],
  speciesTraits: [
    { name: 'Tiefling (Infernal Legacy)',  desc: 'Innate spellcasting (Thaumaturgy at will; can cast Hellish Rebuke 1/long rest at 2nd level; Darkness 1/long rest).' },
    { name: 'Darkvision 60ft',             desc: 'See in dim light as if bright, darkness as if dim (greyscale).' },
    { name: 'Hellish Resistance',          desc: 'Resistance to fire damage.' },
    { name: 'Otherworldly Presence',       desc: 'Knows Thaumaturgy cantrip (Charisma).' }
  ],
  feats: [
    { name: 'Acolyte (Origin)',  desc: 'Proficiency in Insight + Religion; can perform religious ceremonies.' },
    { name: 'War Caster',        desc: 'Adv on Con saves to maintain concentration; can perform somatic components with weapon/shield in hand; cast a single-target spell as Opportunity Attack.' },
    { name: 'Resilient (Charisma)', desc: 'Proficiency in Charisma saves (+1 CHA).' }
  ],
  equipmentProf: {
    armor: ['Light', 'Medium', 'Heavy', 'Shields'],
    weapons: ['Simple weapons'],
    tools: []
  },
  spellcasting: {
    ability: 'WIS', modifier: 5, saveDC: 17, attackBonus: 9,
    slots: [4, 3, 3, 3, 2, 0, 0, 0, 0]
  },
  spells: [
    // Cantrips (8)
    { level: 0, name: 'Sacred Flame',        school: 'Evocation',   cast: 'Action', range: '60ft',   desc: 'Flame-like radiance descends. DEX DC 17 or 2d8 radiant. No cover. +5 from Potent Spellcasting on hit.' },
    { level: 0, name: 'Chill Touch',         school: 'Necromancy',  cast: 'Action', range: '120ft', desc: 'Ghostly skeletal hand. Ranged spell attack +9. Hit: 2d10 necrotic. Target can\'t regain HP until end of next turn. If undead, also has disadvantage on attacks against you until end of next turn.' },
    { level: 0, name: 'Guidance',            school: 'Divination',  cast: 'Action', range: 'Touch', desc: 'Target adds 1d4 to one ability check before spell ends (concentration, 1 minute).', tags: ['concentration'] },
    { level: 0, name: 'Light',               school: 'Evocation',   cast: 'Action', range: 'Touch', desc: 'Object sheds bright 20ft / dim 20ft for 1 hour. No effect on a held magical object.' },
    { level: 0, name: 'Mending',             school: 'Transmutation', cast: '1 min', range: 'Touch', desc: 'Repair a single break or tear no larger than 1ft.' },
    { level: 0, name: 'Resistance',          school: 'Abjuration',  cast: 'Action', range: 'Touch', desc: 'Target adds 1d4 to one saving throw before spell ends (concentration, 1 minute).', tags: ['concentration'] },
    { level: 0, name: 'Spare the Dying',     school: 'Necromancy',  cast: 'Action', range: '15ft',  desc: 'Stabilise a creature at 0HP. No effect on undead or constructs.' },
    { level: 0, name: 'Thaumaturgy',         school: 'Transmutation', cast: 'Action', range: '30ft', desc: 'Voice booms x3 louder · flames flicker / brighten / dim / change colour · tremors · sound effect · open/close door/window · alter eyes\' appearance. 1 minute.' },
    // 1st level (4 slots)
    { level: 1, name: 'Bless',               school: 'Enchantment', cast: 'Action',     range: '30ft',  desc: 'Up to 3 creatures add 1d4 to attack rolls and saving throws. Concentration, 1 minute.', tags: ['concentration'] },
    { level: 1, name: 'Cure Wounds',         school: 'Abjuration',  cast: 'Action',     range: 'Touch', desc: 'Heal 2d8 + 5 HP.' },
    { level: 1, name: 'Guiding Bolt',        school: 'Evocation',   cast: 'Action',     range: '120ft', desc: 'Ranged spell attack +9. Hit: 4d6 radiant. Next attack roll vs target before end of next turn has advantage.' },
    { level: 1, name: 'Healing Word',        school: 'Abjuration',  cast: 'Bonus',      range: '60ft',  desc: 'Heal 1d4 + 5 HP. Cannot raise from 0 HP if creature is undead or construct.' },
    { level: 1, name: 'Bane',                school: 'Enchantment', cast: 'Action',     range: '30ft',  desc: 'Up to 3 creatures CHA DC 17 or subtract 1d4 from attack rolls and saves. Concentration, 1 minute.', tags: ['concentration'] },
    { level: 1, name: 'Protection from Evil and Good', school: 'Abjuration', cast: 'Action', range: 'Touch', desc: 'Aberrations, celestials, elementals, fey, fiends, undead have disadvantage on attacks vs target; target can\'t be charmed, frightened, or possessed by them. Concentration, 10 minutes.', tags: ['concentration'] },
    { level: 1, name: 'Command',             school: 'Enchantment', cast: 'Action',     range: '60ft',  desc: 'WIS DC 17 or follow a one-word command on its next turn. Approach/Drop/Flee/Grovel/Halt.' },
    { level: 1, name: 'Shield of Faith',     school: 'Abjuration',  cast: 'Bonus',      range: '60ft',  desc: 'Target gains +2 AC. Concentration, 10 minutes.', tags: ['concentration'] },
    { level: 1, name: 'Detect Poison and Disease', school: 'Divination', cast: 'Action (R)', range: 'Self (30ft)', desc: 'Sense location and type of poisons/diseases/poisonous creatures within 30ft. PESTILENCE DOMAIN.', tags: ['concentration', 'ritual'] },
    { level: 1, name: 'Protection from Poison', school: 'Abjuration', cast: 'Action',   range: 'Touch', desc: 'Neutralise poisons; resistance to poison damage; immune to Poisoned condition. 1 hour. PESTILENCE DOMAIN.' },
    { level: 1, name: 'Ray of Sickness',     school: 'Necromancy',  cast: 'Action',     range: '60ft',  desc: 'Ranged spell attack +9. Hit: 2d8 poison + CON DC 17 or Poisoned until end of next turn. PESTILENCE DOMAIN.' },
    { level: 1, name: 'Inflict Wounds',      school: 'Necromancy',  cast: 'Action',     range: 'Touch', desc: 'Melee spell attack. Hit: 3d10 necrotic. PESTILENCE DOMAIN.' },
    // 2nd level (3 slots)
    { level: 2, name: 'Spiritual Weapon',    school: 'Evocation',   cast: 'Bonus',      range: '60ft',  desc: 'Floating spectral weapon. Bonus action to melee spell attack +9 within 5ft of weapon: 1d8+5 force. Move 20ft each turn. 1 minute. No concentration.' },
    { level: 2, name: 'Hold Person',         school: 'Enchantment', cast: 'Action',     range: '60ft',  desc: 'WIS DC 17 each turn or Paralyzed. Concentration, 1 minute. Melee attacks from within 5ft = auto-crit.', tags: ['concentration'] },
    { level: 2, name: 'Prayer of Healing',   school: 'Abjuration',  cast: '10 min',     range: '30ft',  desc: 'Up to 6 creatures regain 2d8+5 HP each.' },
    { level: 2, name: 'Aid',                 school: 'Abjuration',  cast: 'Action',     range: '30ft',  desc: 'Up to 3 creatures gain +5 max HP and current HP for 8 hours.' },
    { level: 2, name: 'Silence',             school: 'Illusion',    cast: 'Action (R)', range: '120ft', desc: '20ft radius sphere of silence — no sound passes; no spells with verbal components can be cast inside. Concentration, 10 minutes. KEY OPENING: cast on Orin.', tags: ['concentration', 'ritual'] },
    { level: 2, name: 'Calm Emotions',       school: 'Enchantment', cast: 'Action',     range: '60ft',  desc: 'Humanoids in 20ft sphere CHA DC 17 or suppress charm/fright or anger/hostility. Concentration, 1 minute.', tags: ['concentration'] },
    { level: 2, name: 'Lesser Restoration',  school: 'Abjuration',  cast: 'Action',     range: 'Touch', desc: 'End one condition on target: Blinded, Deafened, Paralyzed, Poisoned, or one disease.' },
    { level: 2, name: 'Warding Bond',        school: 'Abjuration',  cast: 'Action',     range: 'Touch', desc: 'Bond with target within 60ft. +1 AC, saves; resistance to all damage; take half damage target takes. 1 hour.' },
    { level: 2, name: 'Zone of Truth',       school: 'Enchantment', cast: 'Action',     range: '60ft',  desc: '15ft radius. CHA DC 17 or cannot deliberately lie inside for 10 minutes.' },
    { level: 2, name: 'Ray of Enfeeblement', school: 'Necromancy',  cast: 'Action',     range: '60ft',  desc: 'Ranged spell attack +9. Hit: target deals only half damage with weapons that use STR until end of next turn. Concentration. PESTILENCE DOMAIN.', tags: ['concentration'] },
    // 3rd level (3 slots)
    { level: 3, name: 'Spirit Guardians',    school: 'Conjuration', cast: 'Action',     range: 'Self (15ft)', desc: '15ft radius emanation. Each creature in it: speed halved + WIS DC 17 or 3d8 radiant (good cleric) or 3d8 necrotic (evil cleric — Kaelith uses necrotic). Concentration, 10 minutes. CORE BATTLEFIELD CONTROL.', tags: ['concentration'] },
    { level: 3, name: 'Beacon of Hope',      school: 'Abjuration',  cast: 'Action',     range: '30ft',  desc: 'Any number of creatures: adv on WIS saves and death saves; gain max HP from healing. Concentration, 1 minute.', tags: ['concentration'] },
    { level: 3, name: 'Mass Healing Word',   school: 'Abjuration',  cast: 'Bonus',      range: '60ft',  desc: 'Up to 6 creatures regain 1d4+5 HP each.' },
    { level: 3, name: 'Dispel Magic',        school: 'Abjuration',  cast: 'Action',     range: '120ft', desc: 'End spell of L3 or lower. Higher: ability check DC 10 + spell level.' },
    { level: 3, name: 'Animate Dead',        school: 'Necromancy',  cast: '1 min',      range: '10ft',  desc: 'Animate skeleton or zombie. Lasts 24h; re-cast to maintain. Can command up to 4 with each casting.' },
    { level: 3, name: 'Bestow Curse',        school: 'Necromancy',  cast: 'Action',     range: 'Touch', desc: 'Touch attack + WIS DC 17 or curse: disadv on chosen ability checks/saves OR target attacks at disadv vs you OR target wastes action OR you deal +1d8 necrotic. Concentration, 1 minute.', tags: ['concentration'] },
    { level: 3, name: 'Glyph of Warding',    school: 'Abjuration',  cast: '1 hour',     range: 'Touch', desc: 'Inscribe a magical trap or stored spell. Triggered by specified condition. Permanent until triggered.' },
    { level: 3, name: 'Sending',             school: 'Evocation',   cast: 'Action',     range: 'Unlimited', desc: 'Send a 25-word message to a known creature. They can reply. Crosses planes (variable success).' },
    { level: 3, name: 'Stinking Cloud',      school: 'Conjuration', cast: 'Action',     range: '90ft',  desc: '20ft radius cloud. CON DC 17 each turn or lose action retching. Concentration, 1 minute. Heavy obscurement. PESTILENCE DOMAIN.', tags: ['concentration'] },
    { level: 3, name: 'Vampiric Touch',      school: 'Necromancy',  cast: 'Action',     range: 'Self', desc: 'Melee spell attack +9, hit: 3d6 necrotic and she regains half as HP. Repeat attack each action for duration. Concentration, 1 minute. PESTILENCE DOMAIN.', tags: ['concentration'] },
    // 4th level (3 slots)
    { level: 4, name: 'Banishment',          school: 'Abjuration',  cast: 'Action',     range: '60ft',  desc: 'CHA DC 17 or banish target to harmless demiplane (if native plane) or send home (if extraplanar) for up to 1 minute. Concentration.', tags: ['concentration'] },
    { level: 4, name: 'Death Ward',          school: 'Abjuration',  cast: 'Action',     range: 'Touch', desc: 'When target drops to 0HP, instead drops to 1HP. Spell ends after triggering. 8 hours.' },
    { level: 4, name: 'Aura of Life',        school: 'Abjuration',  cast: 'Action',     range: 'Self (30ft)', desc: '30ft aura: creatures (other than undead/constructs) have resistance to necrotic; max HP cannot be reduced; if at 0HP start of turn, regain 1HP. Concentration, 10 minutes.', tags: ['concentration'] },
    { level: 4, name: 'Freedom of Movement', school: 'Abjuration',  cast: 'Action',     range: 'Touch', desc: 'Target ignores difficult terrain, can\'t be paralyzed or restrained by spells, can spend 5ft of movement to escape grapple. 1 hour.' },
    { level: 4, name: 'Guardian of Faith',   school: 'Conjuration', cast: 'Action',     range: '30ft',  desc: 'Spectral guardian appears. Any hostile creature within 10ft of it: DEX DC 17 or take 20 radiant (half on save). 60 total damage budget. 8 hours.' },
    { level: 4, name: 'Divination',          school: 'Divination',  cast: 'Action (R)', range: 'Self', desc: 'Pose one question about an event in the next 7 days; receive truthful answer (limited).', tags: ['ritual'] },
    { level: 4, name: 'Blight',              school: 'Necromancy',  cast: 'Action',     range: '30ft',  desc: 'CON DC 17 or 8d8 necrotic (half on save). Plants take max damage; magical plants gain save. PESTILENCE DOMAIN.' },
    { level: 4, name: 'Giant Insect',        school: 'Transmutation', cast: 'Action',   range: '30ft',  desc: 'Up to 10 centipedes / 3 spiders / 5 wasps / 1 scorpion become Giant variants for 10 minutes. PESTILENCE DOMAIN.', tags: ['concentration'] },
    // 5th level (2 slots)
    { level: 5, name: 'Flame Strike',        school: 'Evocation',   cast: 'Action',     range: '60ft',  desc: '10ft radius column from sky. DEX DC 17 or 4d6 fire + 4d6 radiant (half on save).' },
    { level: 5, name: 'Raise Dead',          school: 'Necromancy',  cast: '1 hour',     range: 'Touch', desc: 'Resurrect a creature dead no more than 10 days. Diamond worth 500gp consumed.' },
    { level: 5, name: 'Geas',                school: 'Enchantment', cast: '1 min',      range: '60ft',  desc: 'WIS DC 17 or magically compelled to follow a command for 30 days. 5d10 psychic damage when defying. Heavy social tool — used to mark Naturus loyalists.', tags: ['concentration'] },
    { level: 5, name: 'Greater Restoration', school: 'Abjuration',  cast: 'Action',     range: 'Touch', desc: 'End: one of: charm/petrification effect, exhaustion, ability score reduction, HP max reduction. Diamond worth 100gp consumed.' },
    { level: 5, name: 'Commune',             school: 'Divination',  cast: '1 min (R)',  range: 'Self', desc: 'Contact deity for 3 yes/no questions. Once per long rest reliable.', tags: ['ritual'] },
    { level: 5, name: 'Scrying',             school: 'Divination',  cast: '10 min',     range: 'Self', desc: 'WIS DC 17 — scry on a creature (DC depends on how well you know them and any focus you have). Concentration, 10 minutes.', tags: ['concentration'] },
    { level: 5, name: 'Contagion',           school: 'Necromancy',  cast: 'Action',     range: 'Touch', desc: 'Touch attack + CON DC 17 each turn for 3 turns. 3 fails: contracts disease (Blinding Sickness/Filth Fever/Flesh Rot/Mindfire/Seizure/Slimy Doom). PESTILENCE DOMAIN.' },
    { level: 5, name: 'Insect Plague',       school: 'Conjuration', cast: 'Action',     range: '300ft', desc: '20ft radius sphere of locusts. CON DC 17 or 4d10 piercing (half on save). Difficult terrain inside. Concentration, 10 minutes. PESTILENCE DOMAIN.', tags: ['concentration'] }
  ],
  languages: ['Common', 'Draconic', 'Elvish', 'Modron'],
  equipment: [
    'Mithral Half Plate (light, no stealth disadvantage)',
    'Shield (+2 AC included in AC 19)',
    'Mace +3 (magic weapon)',
    'Light Crossbow + 20 bolts',
    'Cloak of Displacement (attuned · disadv on attacks vs her until she takes damage)',
    'Component pouch · Holy symbol of Naturus (twisted gnarled wood pendant)',
    'Vestments of Naturus (black robe with green vine motifs over the armour)',
    'Diamond dust (300gp, for Revivify-style components if she carries them)',
    'Diamond (500gp, Raise Dead component)',
    'Diamond (100gp, Greater Restoration component)',
    'Vial of foul-smelling oil (signature — leaves on those she\'s "blessed")',
    'The "K" note seal — used to grant Pig\'s Head back-room access'
  ],
  attunements: ['Cloak of Displacement', '— (one slot free)', '— (one slot free)'],
  coins: { cp: 0, sp: 0, ep: 0, gp: 240, pp: 0 },
  backstory: 'Cleric of Naturus. Charmed the gnoll pack leader. The "K" on the note that grants Pig\'s Head back-room access. Believes she serves a greater demon — actually being manipulated through whispers (Naturus speaking to her from beyond the Dawnoak). Her rot spread is, from Naturus\'s perspective, less about cult expansion and more about destabilising the marsh seal on Vroth-Khorn.',
  personality: 'Blunt. No filter. Believes rot and decay bring new life. Sees suffering as a necessary stage. Will tell you exactly why she\'s killing you. Patient with the slow path of corruption.',
  ideal: 'All things must rot to make way for new growth.',
  bond: 'Devoted to Naturus above all else.',
  flaw: 'No filter — speaks her actual thoughts even when diplomatically catastrophic.',
  resources: [
    { id: 'channel_div',     label: 'Channel Divinity',           max: 3, recharge: 'short', note: 'Divine Spark / Turn Undead / Sear Undead / Plague Blessing' },
    { id: 'plague_blessing', label: 'Plague Blessing uses',       max: 3, recharge: 'long',  note: 'Bonus action emanation, CON DC 17 or 1 Exhaustion/turn' },
    { id: 'virulent_burst',  label: 'Virulent Burst (Reaction)',  max: 5, recharge: 'long',  note: 'When enemy within 60ft drops to 0HP' },
    { id: 'divine_int',      label: 'Divine Intervention',        max: 1, recharge: 'long',  note: 'Cast any L5 or lower Cleric spell free' },
    { id: 'blight_swap',     label: 'Blight Weaver swap (Reaction)', max: 0, recharge: 'long', note: 'Swap necrotic/poison resistance — no per-rest cap, freely used' },
    { id: 'hellish_rebuke',  label: 'Hellish Rebuke (Tiefling)',  max: 1, recharge: 'long' },
    { id: 'darkness',        label: 'Darkness (Tiefling)',        max: 1, recharge: 'long' }
  ]
};
