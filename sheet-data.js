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
