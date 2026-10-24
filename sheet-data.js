// =====================================================================
// ELDORIA 2.0 — CHARACTER SHEET DATA
// Player characters only — every player sheet loads this file, so it must
// hold NOTHING a player shouldn't read. DM-only characters (Vaeloran,
// Kaelith) and DM notes about PCs live in sheet-data-dm.js, which the public
// site only serves encrypted (Update 65b).
// =====================================================================

const CHARACTERS = {};

// ----- SYLAS ---------------------------------------------------------
// Tiefling (Chthonic) Wizard 6, Illusionist Subclass. Player: Jacob_Pies.
CHARACTERS.sylas = {
  id: 'sylas',
  name: 'Sylas',
  portraitUrl: 'portraits/sylas.jpeg',
  playerName: 'Jacob_Pies',
  species: 'Tiefling (Chthonic)',
  className: 'Wizard',
  level: 6,
  subclass: 'Illusionist',
  background: 'Sage',
  alignment: 'Neutral',
  age: 29,
  size: 'Small',
  height: '6\'0"',
  weight: '160 lb',
  appearance: 'Male tiefling, pale purple skin — a distinctive Aurum curse-line marker known to scholars. Heterochromia: left eye white, right eye white. Eyes glow faintly in dim light. Whispers of necrotic energy seem to cling to his presence. Wears the plain robe of a Scholars\' Circle graduate.',
  ac: 12, acNote: 'No armor (Mage Armor available: 13 + DEX = 15)',
  hpMax: 51,
  hitDice: { max: 6, die: 'd6' },
  speed: 30, initiative: 2, proficiencyBonus: 3, passivePerception: 13,
  abilities: { str: 8, dex: 15, con: 18, int: 20, wis: 10, cha: 10 },
  saves: {
    int: { proficient: true, modOverride: 8 },
    wis: { proficient: true, modOverride: 3 }
  },
  skills: {
    arcana:        { proficient: true, modOverride: 8 },
    history:       { proficient: true, modOverride: 8 },
    investigation: { proficient: true, expertise: true, modOverride: 11 },
    perception:    { proficient: true, modOverride: 3 }
  },
  senses: 'Darkvision 60ft, passive Perception 13, passive Investigation 21, passive Insight 10',
  damageResist: ['Necrotic (Chthonic Legacy)'],
  weapons: [
    // Cantrips + always-available strikes live here (they aren't inventory items).
    // Equipped inventory weapons render automatically underneath (see renderWeaponsSection).
    { name: 'Chill Touch (cantrip)', atk: 8, damage: '2d10 necrotic', notes: 'V/S · Range 120ft · Target can\'t regain HP until end of next turn. If Undead, disadv on attacks vs Sylas.' },
    { name: 'Unarmed Strike', atk: 2, damage: '0 bludgeoning',    notes: 'Fallback only' }
  ],
  classFeatures: [
    { name: 'Spellcasting (Wizard)', desc: 'INT is his spellcasting ability. Spell save DC 16, spell attack +8. Prepares from spellbook after long rest.' },
    { name: 'Ritual Adept',          desc: 'Can cast any Wizard spell he knows as a ritual, whether or not it has the Ritual tag, without a spell slot.' },
    { name: 'Arcane Recovery',       desc: 'Once per Long Rest, after a Short Rest he can recover spell slots totaling no more than 3, none higher than 5th level.' },
    { name: 'Scholar (Sage)',        desc: 'Expertise in one skill he\'s proficient in — Investigation. His +11 Investigation is the highest passive on the table.' },
    { name: 'Illusion Savant (Illusionist)', desc: 'Chose two illusion spells of L2 or lower and added them to his spellbook for free: Disguise Self (L1) and Invisibility (L2). Whenever he gains a new level of Wizard spell slots, he adds one Illusion school Wizard spell to his spellbook for free.' },
    { name: 'Improved Illusions',    desc: 'Can cast illusion spells without needing to provide Verbal components. Illusion spells with a range of 10ft or more have their range increased by 60ft. Also knows Minor Illusion cantrip.' },
    { name: 'Memorize Spell',        desc: 'When he finishes a Short Rest, he can study his spellbook and replace one of his prepared level 1+ Wizard spells with another level 1+ Wizard spell from his book.' },
    { name: 'Phantasmal Creatures',  desc: 'Always has Summon Beast and Summon Fey prepared. When he casts either spell, he can change its school to Illusion so it appears spectral. Once per Long Rest he can cast the Illusion version without expending a slot, but the summoned creature has half HP.' }
  ],
  speciesTraits: [
    { name: 'Tiefling (Chthonic Legacy)', desc: 'Fiend-touched bloodline with a lich in the ancestry. Grants Necrotic resistance and the Fiendish Legacy Spells list (Chthonic variant).' },
    { name: 'Fiendish Legacy Spells (Chthonic)', desc: 'Chill Touch (cantrip, always known). Once per Long Rest each without a slot: False Life (L1) and Ray of Enfeeblement (L2). Can also cast either using spell slots normally.' },
    { name: 'Otherworldly Presence', desc: 'Knows Thaumaturgy cantrip. Uses INT for it.' },
    { name: 'Darkvision 60ft',      desc: 'See in dim light as if bright, darkness as if dim (greyscale).' },
    { name: 'Creature Type: Humanoid', desc: 'Standard humanoid for effects that target creature type.' }
  ],
  feats: [
    { name: 'Lich Initiate',     desc: '**Soul Siphon (No Action).** When he reduces a Humanoid to 0 HP with a spell of 1st level or higher, he can consume its soul. The soul is destroyed and cannot be raised except by Wish. Sylas has a spirit jar (his necklace) that stores the essence. **Rider:** After a soul is siphoned, the next attack Sylas makes that HITS deals an additional **+1d6+5** damage. Bumping the Soul Siphon counter auto-arms the charge — a banner appears at the top of the sheet with a Roll & consume button. **This is his defining secret feat — the party does not know he took it. Orin does not yet know. Vaeloran knows and is watching.**' },
    { name: 'Magic Initiate (Wizard)', desc: 'Grants two cantrips from the Wizard list — **Mage Hand** and **Message** — and one 1st-level Wizard spell always prepared: **Shield**. Shield can be cast once per Long Rest without a slot, or using any spell slot he has.' },
    { name: 'Sage Ability Score Improvements', desc: 'The Sage background feat granting +2/+1 to ability scores (applied to INT and CON at 1st level).' }
  ],
  equipmentProf: {
    armor: [],
    weapons: ['Simple weapons'],
    tools: ['Calligrapher\'s Supplies', 'Mask Making Kit']
  },
  spellcasting: {
    ability: 'INT', modifier: 5, saveDC: 16, attackBonus: 8,
    slots: [4, 3, 3, 0, 0, 0, 0, 0, 0]
  },
  spells: [
    // Cantrips — at will
    { level: 0, name: 'Shape Water',    school: 'Transmutation', cast: 'Action', range: '30ft/5ft Cube', desc: 'Manipulate up to 5ft cube of water. Move it, shape it, freeze it (fragile), animate briefly.' },
    { level: 0, name: 'Toll the Dead',  school: 'Necromancy',    cast: 'Action', range: '60ft', desc: 'WIS DC 16 or 1d8 necrotic (1d12 if target is missing HP). Bell tolls audibly.' },
    { level: 0, name: 'Friends',        school: 'Enchantment',   cast: 'Action', range: '10ft', desc: 'Adv on CHA checks against a non-hostile creature for 1 minute (concentration). Target knows it was charmed when the spell ends and becomes hostile.', tags: ['concentration'] },
    { level: 0, name: 'Mending',        school: 'Transmutation', cast: '1 minute', range: 'Touch', desc: 'Repair a single break or tear no larger than 1ft.' },
    { level: 0, name: 'Mage Hand',      school: 'Conjuration',   cast: 'Action', range: '30ft', desc: 'Spectral hand. Move/manipulate objects up to 10lb. 1 minute. (Magic Initiate)' },
    { level: 0, name: 'Message',        school: 'Transmutation', cast: 'Action', range: '120ft', desc: 'Whisper to a target you can see — only they hear. They may whisper back. (Magic Initiate)' },
    { level: 0, name: 'Chill Touch',    school: 'Necromancy',    cast: 'Action', range: '120ft', desc: 'Ranged spell attack +8. Hit: 2d10 necrotic. Target can\'t regain HP until end of next turn. If undead, disadv on attacks vs Sylas until end of next turn. (Chthonic Legacy)' },
    { level: 0, name: 'Thaumaturgy',    school: 'Transmutation', cast: 'Action', range: '30ft', desc: 'Voice booms 3x louder · flames flicker · minor tremor · sound effect · door/window open/close · alter eye appearance. 1 minute. (Otherworldly Presence — INT)' },
    { level: 0, name: 'Minor Illusion', school: 'Illusion',      cast: 'Action', range: '30ft', desc: 'Create a sound or image of an object lasting 1 minute. Investigation DC 16 to discern. (Improved Illusions — 5ft cube, 30ft range base, cast without V component)' },

    // 1st level — 4 slots
    { level: 1, name: 'Mage Armor',     school: 'Abjuration',    cast: 'Action',     range: 'Touch', desc: 'AC = 13 + DEX (no armour). 8 hours. His self-buff of choice — sets AC to 15 when cast.' },
    { level: 1, name: 'Catapult',       school: 'Transmutation', cast: 'Action',     range: '60ft', desc: 'Choose an object weighing 1-5 lb within 30ft. Launch it at a target within 60ft. DEX DC 16 or 3d8 bludgeoning damage.' },
    { level: 1, name: 'Alarm',          school: 'Abjuration',    cast: '1 minute (R)', range: '30ft/20ft Cube', desc: 'Ward an area against intrusion. Ritual. 8 hours.', tags: ['ritual'] },
    { level: 1, name: 'Magic Missile',  school: 'Evocation',     cast: 'Action',     range: '120ft', desc: '3 darts, each 1d4+1 force damage. Autohit. Can split among targets.' },
    { level: 1, name: 'Chromatic Orb',  school: 'Evocation',     cast: 'Action',     range: '90ft', desc: 'Ranged spell attack +8. Choose damage type (acid/cold/fire/lightning/poison/thunder). Hit: 3d8 of chosen type. On natural 20 or when cast at higher level, can leap to a second target.' },
    { level: 1, name: 'Detect Magic',   school: 'Divination',    cast: 'Action (R)', range: 'Self (30ft)', desc: 'Sense magic within 30ft for 10 minutes. Ritual.', tags: ['concentration', 'ritual'] },
    { level: 1, name: 'Shield',         school: 'Abjuration',    cast: 'Reaction',   range: 'Self', desc: '+5 AC until start of next turn. Triggered by being hit or Magic Missile. **Magic Initiate: 1 free cast per Long Rest, then can cast with slots.**', tags: ['reaction'] },
    { level: 1, name: 'False Life',     school: 'Necromancy',    cast: 'Action',     range: 'Self', desc: '1d4+4 temp HP. 1 hour.' },
    { level: 1, name: 'False Life (Chthonic)', school: 'Necromancy', cast: 'Action', range: 'Self', desc: '**Fiendish Legacy: 1 free cast per Long Rest without expending a slot.** Same effect as above.', tags: ['legacy'] },
    { level: 1, name: 'Disguise Self',  school: 'Illusion',      cast: 'Action',     range: 'Self', desc: 'Change appearance — clothing, armor, weapons, and other belongings included. 1 hour. Investigation DC 16 to see through. (Illusion Savant — free spellbook entry)' },

    // 2nd level — 3 slots
    { level: 2, name: 'Misty Step',     school: 'Conjuration',   cast: 'Bonus',      range: 'Self', desc: 'Teleport up to 30ft to an unoccupied space he can see.' },
    { level: 2, name: 'Shatter',        school: 'Evocation',     cast: 'Action',     range: '60ft/10ft Sphere', desc: 'CON DC 16 or 3d8 thunder damage (half on save). Objects and Constructs disadv on save.' },
    { level: 2, name: 'Enhance Ability', school: 'Transmutation', cast: 'Action',    range: 'Touch', desc: 'Target gains adv on ability checks of chosen ability score + additional benefit depending on ability. 1 hour.', tags: ['concentration'] },
    { level: 2, name: 'Locate Object',  school: 'Divination',    cast: 'Action',     range: 'Self', desc: 'Sense the direction to a familiar or specifically described object within 1000ft. 10 minutes.', tags: ['concentration'] },
    { level: 2, name: 'Ray of Enfeeblement', school: 'Necromancy', cast: 'Action',   range: '60ft', desc: 'CON DC 16 or target\'s STR-weapon attacks deal only half damage until end of next turn. 1 minute.', tags: ['concentration'] },
    { level: 2, name: 'Ray of Enfeeblement (Chthonic)', school: 'Necromancy', cast: 'Action', range: '60ft', desc: '**Fiendish Legacy: 1 free cast per Long Rest without expending a slot.** Same effect.', tags: ['concentration', 'legacy'] },
    { level: 2, name: 'Invisibility',   school: 'Illusion',      cast: 'Action',     range: 'Touch', desc: 'Target becomes invisible for up to 1 hour or until they attack/cast a spell. (Illusion Savant — free spellbook entry)', tags: ['concentration'] },
    { level: 2, name: 'Summon Beast',   school: 'Conjuration',   cast: 'Action',     range: '90ft', desc: 'Summon a Bestial Spirit (Air, Land, or Water). 1 hour. **Phantasmal Creatures: always prepared. Can change school to Illusion to appear spectral.**', tags: ['concentration'] },
    { level: 2, name: 'Summon Beast (Illusion)', school: 'Illusion', cast: 'Action', range: '90ft', desc: '**Phantasmal Creatures: 1 free cast per Long Rest without expending a slot** — but the summoned creature has half HP. Appears spectral.', tags: ['concentration', 'phantasmal'] },

    // 3rd level — 3 slots
    { level: 3, name: 'Animate Dead',   school: 'Necromancy',    cast: '1 minute',   range: '10ft', desc: 'Animate a Small or Medium corpse as a Skeleton or Zombie. Lasts 24h; re-cast to maintain. Can command up to 4 with each casting. **Sylas\'s current zombies were raised via this spell.**' },
    { level: 3, name: 'Summon Undead',  school: 'Necromancy',    cast: 'Action',     range: '10ft', desc: 'Summon an Undead Spirit (Ghostly, Putrid, or Skeletal). 1 hour.', tags: ['concentration'] },
    { level: 3, name: 'Fly',            school: 'Transmutation', cast: 'Action',     range: 'Touch', desc: 'Target gains flying speed 60ft for 10 minutes.', tags: ['concentration'] },
    { level: 3, name: 'Summon Fey',     school: 'Conjuration',   cast: 'Action',     range: '90ft', desc: 'Summon a Fey Spirit (Fuming, Mirthful, or Tricksy). 1 hour. **Phantasmal Creatures: always prepared. Can change school to Illusion to appear spectral.**', tags: ['concentration'] },
    { level: 3, name: 'Summon Fey (Illusion)', school: 'Illusion', cast: 'Action',   range: '90ft', desc: '**Phantasmal Creatures: uses the same Long Rest free cast as Summon Beast** — but the summoned creature has half HP. Appears spectral.', tags: ['concentration', 'phantasmal'] }
  ],
  languages: ['Common', 'Elvish', 'Goblin'],
  equipment: [
    'Potion of Healing (×2)',
    'Bag of Holding — **currently contains the sealed Coin Cipher chest (hidden from Vrass)**',
    'Dagger (×2)',
    'Quarterstaff',
    'Whip',
    'Spear (×17) — inventory quirk',
    'Longbow (×17) — inventory quirk',
    'Spellbook (personal, in the Backpack)',
    'Spellbook — necromantic lore volume gifted by a Scholars\' Circle professor',
    'Backpack, Bedroll, Mess Kit, Rations (10 days), Rope (Hempen, 50 ft), Waterskin',
    'Tinderbox (×2), Torch (×10), Lamp, Oil (×10)',
    'Ink Pen, Ink, Parchment (×10), Book',
    'Robe (scholar\'s robe)',
    'Poisonous Spider Fang (×2) — collected component',
    'Spider Venom Sac (×2) — collected component',
    '**The Necklace / Spirit Jar** — Lich Initiate focus.'
  ],
  // attunements array retired — dynamic Attunement box (Update 18b) reads from state.equipment

  coins: { cp: 0, sp: 6, ep: 0, gp: 6, pp: 0 },
  backstory: 'Born in a quiet village nestled within the Aurora Peaks, your character was the unexpected child of two humble human parents. His Tiefling heritage, a result of a recessive pact made generations ago with a lich, marked him from birth—his eyes glowed faintly in the dark, and whispers of necrotic energy clung to his presence.\n\nFrom a young age, he showed an extraordinary affinity for magic, especially illusions. Despite his brilliance, the local school treated him as an outcast, fearing his lineage and the eerie manifestations of his power. Yet, he persevered—graduating top of his class, driven by a hunger for knowledge and a quiet defiance of those who doubted him.\n\nHis talents earned him a scholarship to the Scholars\' Circle, Eldoria\'s most prestigious arcane institution, located in the Aelorian Territories. There, he quickly rose through the ranks, impressing mentors and peers alike with his mastery of illusion and his curiosity about the undead.\n\nOne professor, intrigued by his magical lineage and academic promise, offered insight into his Cthonic ancestry and gifted him a spellbook containing necromantic lore. This gesture wasn\'t born of secrecy or taboo, but of scholarly encouragement—an invitation to explore the forces that shaped him and to understand the legacy he carried.\n\nNow, he has left the safety of academia to gain life experience, collect rare spells, and test his theories in the real world. Whether he seeks redemption, mastery, or something darker remains to be seen.',
  personality: '(Personality traits/ideals/bonds/flaws left open on his sheet — for the player to develop through play.)',
  ideal: '(Open — for Sylas\'s player to define.)',
  bond: '(Open — for Sylas\'s player to define.)',
  flaw: '(Open — for Sylas\'s player to define.)',
  allies: [
    '**Vaelith Morgrave** — Professor of Illusion at the Scholars\' Circle, Sylas\'s mentor for six years.',
    '**Scholars\' Circle** — Eldoria\'s most prestigious arcane institution, based in the Aelorian Territories.'
  ],
  notes: [
    '**Pulsating Rock** — the meteor shard the party recovered and delivered. Sylas noted it as "our quest objective" on his sheet.',
    '**Lyssandra\'s Spells** — a bundle of higher-level spell scrolls gifted to Sylas from Lyssandra\'s personal collection: L2 Suggestion; L3 Counterspell, Fireball, Fly; L4 Greater Invisibility, Ice Storm; L5 Cone of Cold. Spell components also from Lyssandra.',
    '**Eloin** — a friend Lyssandra grew up with. Referenced in Sylas\'s notes as a name to remember.'
  ],
  // Spells that are always prepared for this character based on race, class,
  // subclass, feat, background, or magic item. These are seeded into
  // state.spells on load with alwaysPrepared:true and the given reason.
  // They do NOT count against the prep limit. Names must match SPELLS_2024
  // entries (case-insensitive) or they're silently skipped — add missing
  // spells to spells-2024.js first.
  alwaysPreparedSpells: [
    { name: 'Chill Touch',         reason: 'Race: Chthonic Legacy (cantrip)' },
    { name: 'Ray of Enfeeblement', reason: 'Race: Chthonic Legacy (from L3)' },
    { name: 'False Life',          reason: 'Race: Chthonic Legacy (from L5)' },
    { name: 'Shield',              reason: 'Feat: Magic Initiate (Wizard)' }
  ],
  resources: [
    { id: 'arcane_recovery',   label: 'Arcane Recovery',                     max: 1, recharge: 'long',  note: 'After Short Rest, recover slots totaling ≤3, none higher than L5' },
    { id: 'shield_free',       label: 'Shield (Magic Initiate, free)',       max: 1, recharge: 'long' },
    { id: 'false_life_leg',    label: 'False Life (Chthonic Legacy, free)',  max: 1, recharge: 'long' },
    { id: 'ray_enf_leg',       label: 'Ray of Enfeeblement (Chthonic Legacy, free)', max: 1, recharge: 'long' },
    { id: 'phantasmal_free',   label: 'Summon Beast/Fey Illusion version (free, half HP)', max: 1, recharge: 'long' },
    { id: 'soul_siphon',       label: 'Soul Siphon consumed count', max: 999, default: 0, display: 'counter', recharge: 'never', note: 'Tally the souls Sylas has taken. Long-term Lich Initiate progress. Type or use +/-.' }
  ]
};

// ----- TORREN -------------------------------------------------------
CHARACTERS.torren = {
  id: 'torren',
  name: 'Torren',
  portraitUrl: 'portraits/torren.jpeg',
  species: 'Halfling',
  className: 'Rogue',
  level: 6,
  subclass: 'Assassin',
  background: 'Soldier',
  alignment: 'Neutral',
  size: 'Small',
  appearance: 'Older halfling than he looks. Ex-Watch (Stonegate), discharged. Guilded Veil operative. Sworn to Vrass as of Session 5.',
  // Verbatim from the vault backstory (Torren.md — player-written; do not
  // paraphrase). The renderBioSection reads this as one prose block.
  backstory:
    "Torren is older than he looks and older than he acts. He spent most of his working life in the Aelorian Territories Watch, stationed at the Stonegate garrison on the northern frontier. He served under Captain Rikhardt Vall and alongside Nell Vissen. A solid soldier for most of it, competent, dependable.\n\n" +
    "Somewhere along the way — quietly, unglamorously — he began taking coin from the wrong people. Small favours at first: turning a blind eye on a shipment, adjusting a patrol route, dropping a name to someone waiting for it. Payments were small. Then they weren't. The corruption was slow enough that he told himself for years he wasn't corrupt, only tired. Then he was caught.\n\n" +
    "The discharge was public. Vall did not protect him — not because Vall was cruel but because the evidence had gone too far and Vall was, above all, a fair officer. Torren stood at attention while it was read out. He never wore the tabard again.\n\n" +
    "He didn't leave Stonegate right away. He had nothing waiting for him. He drifted through the taverns of the lower town for a season, drinking, sleeping poorly, doing odd jobs for merchants who remembered his old favours. That's where Wenzel \"The Kite\" Tosscobble found him — the Stonegate cell leader of the Guilded Veil. She didn't recruit him with promises; she just started paying him for the work he was already doing, framed it as an organisation, and made the offer feel inevitable. He said yes. It felt like a homecoming. It was.\n\n" +
    "He worked the Veil's Stonegate cell for years — smuggling contraband through the north gate, quietly intimidating merchants behind on tribute, occasional wet-work when the Kite pointed at someone. His assassin skills sharpened in that period. He learned that the world had far fewer honest people in it than his Watch years had led him to believe, and that this was, in some ways, easier to live with.\n\n" +
    "Eventually he came south to Aeloria — either sent by Wenzel as an inter-cell liaison, or because Stonegate was getting too warm, or both. He connected with the Aeloria network. He was the party's way into the Pig's Head back rooms. He met Merric there. He hasn't been back to Stonegate. He does not particularly want to go.",
  personality: 'PTSD from Stonegate frontier duty — nightmares, startle-response to specific sounds. Wary of magic-wielders (including Sylas). Distrustful of tall people (including Orin). Something to prove — takes Assassinate risks. Manages more than he lets on.',
  bond: 'Sworn to lifetime service to Vrass (young black dragon) as of Session 5. Dark bond active. Also owes the Guilded Veil (Stonegate cell of origin, now Aeloria network via Gerald and Merric).',
  flaw: 'Cannot look Captain Vall in the eye. Avoids Watch tabards. Assumes tall people are looking down on him — sometimes literally, always figuratively.',
  ac: 14, acNote: 'Studded leather (light armor, if worn) + Dex; adjust in inventory',
  hpMax: 43,
  hitDice: { max: 6, die: 'd8' },
  speed: 30, initiative: 3, proficiencyBonus: 3, passivePerception: 17,
  abilities: { str: 11, dex: 17, con: 13, int: 13, wis: 13, cha: 12 },
  saves: {
    dex: { proficient: true, modOverride: 6 },
    int: { proficient: true, modOverride: 4 }
  },
  skills: {
    // Proficient
    acrobatics:   { proficient: true, modOverride: 6 },
    athletics:    { proficient: true, modOverride: 3 },
    deception:    { proficient: true, modOverride: 4 },
    intimidation: { proficient: true, modOverride: 4 },
    survival:     { proficient: true, modOverride: 4 },
    // Expertise (double proficiency)
    investigation:  { proficient: true, expertise: true, modOverride: 7 },
    perception:     { proficient: true, expertise: true, modOverride: 7 },
    sleight_of_hand:{ proficient: true, expertise: true, modOverride: 9 },
    stealth:        { proficient: true, expertise: true, modOverride: 9 }
  },
  languages: ['Common', 'Dwarvish', 'Gnomish', 'Goblin', "Thieves' Cant"],
  armorProf: 'Light Armor',
  weaponProf: 'Simple Weapons, Crossbow (Hand), Rapier, Scimitar, Shortsword, Whip',
  toolProf: "Dice Set, Disguise Kit, Poisoner's Kit, Thieves' Tools",
  saveNote: 'A: advantage on saves to avoid or end the Frightened condition (source TBD — likely a feat or racial trait).',
  weapons: [
    // Dagger + Shortbow live in inventory; magic +1 variants also there.
    // Only fallbacks + always-available attacks stay in char.weapons.
    { name: 'Unarmed Strike', atk: 3, damage: '1 bludgeoning', notes: 'Damage OR Grapple (Str/Dex save DC 14) OR Shove (Str/Dex save DC 14 to avoid 5-ft push OR prone). One mode per attack.' }
  ],
  classFeatures: [
    { name: 'Expertise (4 skills)',   desc: 'Investigation, Perception, Sleight of Hand, Stealth — double proficiency bonus.' },
    { name: 'Sneak Attack (3d6)',     desc: 'Once per turn, extra 3d6 damage on a Finesse or Ranged attack IF advantage OR an ally within 5 ft of target (and no disadvantage). Same damage type as the weapon.' },
    { name: 'Cunning Action',         desc: 'Bonus action to Dash, Disengage, or Hide.' },
    { name: 'Steady Aim',             desc: 'Bonus action: grant self advantage on next attack this turn — Speed becomes 0 for the rest of the turn. Cannot have moved this turn to use.' },
    { name: 'Uncanny Dodge',          desc: 'Reaction: halve incoming damage from a visible attacker\'s hit (round down).' },
    { name: "Thieves' Cant",          desc: 'Secret sign-and-slang used by rogues and criminal networks; nearly imperceptible to outsiders.' },
    { name: 'Weapon Mastery (2 picks)', desc: 'Currently: Dagger (Nick) and Shortsword (Vex). Reassign at long rest.' },
    { name: 'Cunning Strike (1d6 costs)', desc: 'When Sneak Attack hits, may spend 1d6 from the Sneak Attack pool to add an effect: Poison (DC 14 Con or Poisoned 1 min — requires Poisoner\'s Kit), Trip (Large or smaller, DC 14 Dex or Prone), Withdraw (move half speed after the attack without provoking).' }
  ],
  subclassFeatures: [
    { name: 'Assassin\'s Tools',      desc: 'Free Disguise Kit + Poisoner\'s Kit + proficiency with both.' },
    { name: 'Assassinate',            desc: 'Advantage on Initiative rolls. First round of each combat: advantage on attacks against any creature that hasn\'t taken a turn yet. If Sneak Attack hits during that first round, +6 damage of the weapon\'s type.' }
  ],
  speciesFeatures: [
    { name: 'Brave',                  desc: 'Advantage on saves to avoid or end the Frightened condition.' },
    { name: 'Halfling Nimbleness',    desc: 'Can move through the space of any creature one size larger, but can\'t stop in the same space.' },
    { name: 'Luck',                   desc: 'When Torren rolls a 1 on a d20 test, reroll and use the new result.' },
    { name: 'Naturally Stealthy',     desc: 'Can take the Hide action even when obscured only by a creature at least one size larger.' }
  ],
  feats: [
    { name: 'Skilled (Rogue)',        desc: 'Three additional proficiencies. Torren picked Athletics, Deception, Perception.' },
    { name: 'Savage Attacker (Soldier background)', desc: 'Once per turn on a weapon hit, roll the weapon\'s damage dice twice and use either result.' }
  ],
  resources: [
    // Rogues don't have short/long recharging casting slots. Sneak Attack
    // itself resets each turn, not tracked here.
  ],
  equipment: [
    // -- Equipment (15 items, 34 lb) --
    { name: 'Dagger, +1',       equipped: true,  slot: 'weapon',     wt: 1,             desc: 'Magic +1. Simple, Finesse, Light, Thrown (20/60), Nick mastery.' },
    { name: 'Dagger',           equipped: false, slot: 'weapon',     wt: 1, cost: 2,    desc: 'Simple, Finesse, Light, Thrown (20/60), Nick mastery. 1d4 piercing.' },
    { name: 'Dagger',           equipped: false, slot: 'weapon',     wt: 1, cost: 2,    desc: 'Second dagger. Simple, Finesse, Light, Thrown, Nick mastery. 1d4 piercing.' },
    { name: 'Shortbow, +1',     equipped: true,  slot: 'weapon',     wt: 2,             desc: 'Magic +1. Simple, Ammunition (80/320), Two-Handed, Vex mastery.' },
    { name: 'Shortbow',         equipped: false, slot: 'weapon',     wt: 2, cost: 25,   desc: 'Simple, Ammunition (80/320), Two-Handed, Vex mastery.' },
    { name: 'Shortbow',         equipped: false, slot: 'weapon',     wt: 2, cost: 25,   desc: 'Second shortbow. Simple, Ammunition (80/320), Two-Handed, Vex mastery.' },
    { name: 'Shortsword',       equipped: false, slot: 'weapon',     wt: 2, cost: 10,   desc: 'Martial, Finesse, Light, Vex mastery. 1d6 piercing.' },
    { name: 'Spear',            equipped: false, slot: 'weapon',     wt: 3, cost: 1,    desc: 'Simple, Thrown (20/60), Versatile (1d8), Sap mastery.' },
    { name: 'Arrows',           qty: 20,         slot: 'ammunition', wt: 1, cost: 1 },
    { name: 'Arrows',           qty: 20,         slot: 'ammunition', wt: 1, cost: 1,    desc: 'Second stack.' },
    { name: 'Leather Armor',    equipped: true,  slot: 'armor',      wt: 10, cost: 10,  desc: 'Light armor, AC 11 + Dex (no cap). Currently gives AC 14.' },
    { name: "Thieves' Tools",   qty: 1,          slot: 'tool',       wt: 1, cost: 25,   desc: 'Utility, Exploration. Proficient — used for locks and traps.' },
    { name: 'Dice Set',         qty: 1,          slot: 'tool',       cost: 0.1,         desc: 'Social. Proficient.' },
    { name: "Healer's Kit",     qty: 1,          slot: 'gear',       wt: 3, cost: 5,    desc: 'Healing. 10 charges. Action to stabilise or restore a small amount of HP to an ally.' },
    { name: "Traveler's Clothes", qty: 1,        slot: 'clothing',   wt: 4, cost: 2,    desc: 'Social, Outerwear.' },
    // -- Backpack (10 items, 42 lb — over capacity 37/30 lb) --
    { name: 'Ball Bearings',    qty: 1000,       slot: 'backpack',   wt: 2, cost: 1,    desc: 'Control, Utility, Combat. Action to scatter 10-ft area — creatures moving through DC 10 Dex save or Prone.' },
    { name: 'Bell',             qty: 1,          slot: 'backpack',   wt: 0, cost: 1,    desc: 'Communication, Utility.' },
    { name: 'Candle',           qty: 10,         slot: 'backpack',   wt: 0, cost: 0.1,  desc: 'Utility, Exploration, Consumable. Bright light 5 ft, dim 5 ft beyond.' },
    { name: 'Crowbar',          qty: 1,          slot: 'backpack',   wt: 5, cost: 2,    desc: 'Utility, Exploration. Grants advantage on Str checks where leverage helps.' },
    { name: 'Hooded Lantern',   qty: 1,          slot: 'backpack',   wt: 2, cost: 5,    desc: 'Utility, Exploration. Bright 30 ft, dim 30 ft beyond.' },
    { name: 'Oil',              qty: 7,          slot: 'backpack',   wt: 7, cost: 0.7,  desc: 'Damage, Utility. Splash a flask to prime terrain for fire (5-ft square), or throw as improvised (1d4 fire on hit if ignited).' },
    { name: 'Rations',          qty: 5,          slot: 'backpack',   wt: 10, cost: 2.5, desc: 'Consumable. 1 day of food each.' },
    { name: 'Rope',             qty: 1,          slot: 'backpack',   wt: 5, cost: 1,    desc: 'Hemp, 50 ft.' },
    { name: 'Tinderbox',        qty: 1,          slot: 'backpack',   wt: 1, cost: 0.5,  desc: 'Utility, Exploration. 1 action to light a lamp/torch/small fire.' },
    { name: 'Waterskin',        qty: 1,          slot: 'backpack',   wt: 5, cost: 0.2,  desc: 'Container. 4 pints capacity.' }
    // Quiver: empty. No attuned items.
  ],
  currency: { pp: 0, gp: 20, sp: 47, cp: 0 },  // Confirmed by player
  bio: {
    faction: 'Guilded Veil (Stonegate cell); ex-Aelorian Watch (discharged).',
    bond: 'Sworn to lifetime service to Vrass (young black dragon) as of Session 5.',
    voice: '(see backstory verbatim reference)'
  }
};

// ----- ORIN ---------------------------------------------------------
CHARACTERS.orin = {
  id: 'orin',
  name: 'Orin',
  portraitUrl: 'portraits/orin.jpeg',
  species: 'Goliath',
  className: 'Cleric',
  level: 6,
  subclass: 'Light Domain',
  divineOrder: 'Thaumaturge',
  background: 'Guard',
  alignment: 'Neutral Good',
  size: 'Medium',
  appearance: 'Goliath cleric of Luminos. Devoted, mercy-first. Adoptive son of Merric Underbough / Rulden Marr.',
  // Verbatim from the vault backstory (Orin.md / _Backstories - Verbatim
  // Reference.md — player-written; do not paraphrase).
  backstory:
    "Pre-Merric origin: Orin comes from The Stonemarked — a warrior clan of goliaths living in the mountains northeast of Duskmere. A proud people who value physical strength, endurance, and martial prowess above all else.\n\n" +
    "The exile: The Stonemarked practice a coming-of-age trial. Children who fail — or who are deemed to lack the warrior spirit — are cast out. Not killed, but exiled. Left at the edge of their territory with nothing. Orin failed his trial.\n\n" +
    "The reason matters: Orin did not fail through cowardice or weakness. He failed because he showed mercy — he refused to deliver a killing blow at the moment the trial demanded it. His clan read this as failure of spirit. What it actually was: the beginning of a divine calling. Luminos touched him even then. He was approximately seven or eight years old when the Stonemarked left him near the road south of Duskmere.\n\n" +
    "Found by Merric: Merric Underbough (then a Luminar of Luminos) found Orin wandering, malnourished and alone. He took him in, raised him, and brought him into the faith of Luminos. Orin became a Cleric — his devotion is real, shaped entirely by Merric's guidance and warmth.\n\n" +
    "The theological resonance: The \"weakness\" that got Orin exiled was actually Luminos's calling. His mercy was not weakness — it was the first expression of his faith. He does not yet fully understand this.",
  personality: 'Devoted to Luminos. Mercy-first — will de-escalate before he draws steel. His devotion is genuine and shaped entirely by Merric\'s example. Steady, honest, unshowy.',
  bond: 'Adoptive father Merric Underbough — now revealed as Rulden Marr, Veilmaster of the Guilded Veil. Merric sent a cold warning ending "Keep to the light, Orin. It suits you better." Seraphine (Dawnwarden of the Temple of Luminos) has counselled him not to stop searching for the truth.',
  flaw: 'His entire faith was built on Merric\'s example. If Merric is corrupt, Orin doesn\'t yet know what his own faith stands on.',
  ac: 17, acNote: 'Chain shirt + shield + Dex',
  hpMax: 50,
  hitDice: { max: 6, die: 'd8' },
  speed: 35, initiative: 5, proficiencyBonus: 3, passivePerception: 18,
  speedNote: 'Base 35 ft. +10 ft while Activate Large Form is on (bonus action, 1/long rest, 10 min).',
  abilities: { str: 17, dex: 15, con: 16, int: 12, wis: 20, cha: 10 },
  saves: {
    wis: { proficient: true, modOverride: 8 },
    cha: { proficient: true, modOverride: 3 }
  },
  skills: {
    athletics:  { proficient: true, modOverride: 6 },  // STR prof
    insight:    { proficient: true, modOverride: 8 },  // WIS prof (Divine Order-granted)
    medicine:   { proficient: true, modOverride: 8 },  // WIS prof (Divine Order-granted)
    perception: { proficient: true, modOverride: 8 },  // WIS prof
    // Divine Order Thaumaturge grants a flat +5 bonus to Arcana and Religion (WIS-mod + prof-ish equivalent).
    arcana:     { modOverride: 6, note: '+5 Divine Order bonus stacked' },
    religion:   { modOverride: 6, note: '+5 Divine Order bonus stacked' }
    // Other skills default to ability mod (Survival +5, Animal Handling +5, etc.).
  },
  languages: ['Common', 'Giant', 'Halfling'],
  armorProf: 'Light Armor, Medium Armor, Shields',
  weaponProf: 'Simple Weapons',
  toolProf: 'Dice Set',
  // Weapons + fallback attacks that appear in the Attacks section.
  // Note: Mace / Spear / Light Crossbow live in inventory (equipment)
  // and auto-appear in the attack list when equipped there — so we
  // don't repeat them here.
  weapons: [
    { name: 'Unarmed Strike', atk: 6, damage: '4 bludgeoning', notes: 'Damage OR Grapple (Str/Dex save DC 14) OR Shove (Str/Dex save DC 14 to avoid 5-ft push OR prone). One mode per attack.' }
  ],
  // Class + subclass + species features. My own 1-line mechanical
  // summaries — not published rules text.
  classFeatures: [
    { name: 'Spellcasting (Wisdom)',          desc: 'Prepared caster. Save DC 16, Spell Attack +8. Ritual casting.' },
    { name: 'Divine Order — Thaumaturge',     desc: 'Extra Cleric cantrip. Flat +5 to Arcana and Religion checks.' },
    { name: 'Channel Divinity (3/rest)',      desc: '3 uses per long rest, 1 recovered on short rest. Options: Turn Undead, Divine Spark, Radiance of the Dawn (Light Domain), Sear Undead (auxiliary).' },
    { name: 'Turn Undead (Channel Divinity)', desc: 'Action. Undead within 30 ft.: DC 16 Wis save or Frightened + Incapacitated 1 min, flees. Ends early on damage taken.' },
    { name: 'Divine Spark (Channel Divinity)', desc: 'Bonus action, Holy Symbol at creature within 30 ft. Either heal 1d8+5 HP, OR target makes DC 16 Con save (half) for 1d8+5 radiant or necrotic (Orin picks type).' }
  ],
  subclassFeatures: [
    { name: 'Light Domain — Bonus Cantrip',           desc: 'Extra Light cantrip granted at subclass pickup.' },
    { name: 'Warding Flare (5/short rest)',           desc: 'Reaction when a creature within 30 ft. that Orin can see makes an attack roll — impose disadvantage on the roll AND grant the target 2d6+5 temporary HP (Improved Warding Flare, L6).' },
    { name: 'Radiance of the Dawn (Channel Divinity)', desc: 'Action. 30-ft emanation: dispels magical darkness; each chosen creature DC 16 Con save or take 2d10+6 radiant (half on save).' },
    { name: 'Sear Undead (subclass boost)',           desc: 'When Orin uses Turn Undead, any undead that fail the save also take 5d8 radiant. Doesn\'t break the turn effect.' }
  ],
  speciesFeatures: [
    { name: 'Powerful Build',                                  desc: 'Advantage on ability checks to end the Grappled condition. Counts as one size larger for carrying capacity.' },
    { name: 'Activate Large Form (bonus action, 1/long rest)', desc: 'Become Large for 10 min. Advantage on Str checks, +10 ft speed. End early at will.' },
    { name: "Storm's Thunder (Storm Giant Ancestry, 3/long)",  desc: 'Reaction when Orin takes damage from a creature within 60 ft.: deal 1d8 thunder damage back to that creature.' }
  ],
  feats: [
    { name: 'Ability Score Improvement (Cleric L4)', desc: '+2 Wisdom.' },
    { name: 'Alert (Guard background)',              desc: 'Initiative Proficiency: +3 to initiative rolls. Initiative Swap: after rolling, may swap your init with a willing ally in the same combat (neither may be Incapacitated).' }
  ],
  spellcasting: {
    ability: 'Wisdom',
    saveDc: 16,
    atk: 8,
    slots: [4, 3, 3],  // L1, L2, L3 slots at Cleric 6
    prepared: {
      cantrips: ['Guidance', 'Sacred Flame', 'Spare the Dying', 'Word of Radiance'],
      1: ['Bless', 'Burning Hands', 'Cure Wounds', 'Faerie Fire', 'Guiding Bolt', 'Shield of Faith'],
      2: ['Hold Person', 'Prayer of Healing', 'Scorching Ray', 'See Invisibility', 'Spiritual Weapon'],
      3: ['Aura of Vitality', 'Daylight', 'Fireball', 'Spirit Guardians']
    },
    // Free-source spells that don't count against the prepared cap.
    // Seeder tags matching state.spells entries with alwaysPrepared=true
    // and the reason surfaces in the prep-modal UI.
    alwaysPrepared: [
      { name: 'Burning Hands',  reason: 'Light Domain' },
      { name: 'Faerie Fire',    reason: 'Light Domain' },
      { name: 'Scorching Ray',  reason: 'Light Domain' },
      { name: 'Daylight',       reason: 'Light Domain' },
      { name: 'Fireball',       reason: 'Light Domain' }
    ],
    notes: 'Light Domain grants 5 always-prepared spells that do not count against the prepared limit.'
  },
  resources: [
    { id: 'channel_divinity', label: 'Channel Divinity',              max: 3, recharge: 'short' },  // 3/long, regains 1 on short
    { id: 'warding_flare',    label: 'Warding Flare (5/short rest)',  max: 5, recharge: 'short' },
    { id: 'large_form',       label: 'Activate Large Form (1/long)',  max: 1, recharge: 'long' },
    { id: 'storms_thunder',   label: "Storm's Thunder (3/long rest)", max: 3, recharge: 'long' }
  ],
  // Full inventory from DDB screenshots.
  // Equipped items (red-square markers in DDB): Mace, Spear, Chain Shirt, Shield.
  // Total weight carried: ~95 lb.
  equipment: [
    // -- Equipment (worn / at-hand, 12 items, 66 lb) --
    { name: 'Chain Shirt',       equipped: true,  slot: 'armor',      wt: 20, cost: 50,  desc: 'Medium armor. AC 13 + Dex (max +2).' },
    { name: 'Shield',            equipped: true,  slot: 'shield',     wt: 6,  cost: 10,  desc: '+2 AC. Two-hand to equip/unequip as part of an attack.' },
    { name: 'Mace',              equipped: true,  slot: 'weapon',     wt: 4,  cost: 5,   desc: 'Simple, Sap. 1d6 bludgeoning.' },
    { name: 'Spear',             equipped: true,  slot: 'weapon',     wt: 3,  cost: 1,   desc: 'Simple, Thrown (20/60), Versatile (1d8), Sap. 1d6 piercing.' },
    { name: 'Light Crossbow',    equipped: false, slot: 'weapon',     wt: 5,  cost: 25,  desc: 'Simple, Ammunition (80/320), Loading, Two-Handed, Slow.' },
    { name: 'Bolts',             qty: 200,        slot: 'ammunition', wt: 15, cost: 10 },
    { name: 'Dice Set',          qty: 1,          slot: 'tool',       cost: 0.1, desc: 'Social — Dice set proficiency.' },
    { name: 'Holy Symbol',       qty: 1,          slot: 'gear',       desc: 'Spellcasting focus for Cleric spells (Luminos).' },
    { name: 'Hooded Lantern',    qty: 1,          slot: 'gear',       wt: 2,  cost: 5,   desc: 'Utility, Exploration. Bright light 30 ft, dim 30 ft beyond.' },
    { name: 'Manacles',          qty: 1,          slot: 'gear',       wt: 6,  cost: 2,   desc: 'Control, Utility. DC 20 to break or Sleight of Hand DC 20 to escape.' },
    { name: 'Potion of Healing', qty: 2,          slot: 'consumable', wt: 1,             desc: '1 Charge each. Bonus action to drink: 2d4+2 HP.' },
    { name: "Traveler's Clothes", qty: 1,         slot: 'clothing',   wt: 4,  cost: 2,   desc: 'Social, Outerwear.' },
    // -- Backpack (6 items, 29 lb / cap 30) --
    { name: 'Blanket',           qty: 1,          slot: 'backpack',   wt: 3,  cost: 0.5, desc: 'Utility.' },
    { name: 'Holy Water',        qty: 1,          slot: 'backpack',   wt: 1,  cost: 25,  desc: 'Damage, Utility, Combat. Action to splash — 2d6 radiant to fiend or undead within 5 ft.' },
    { name: 'Lamp',              qty: 1,          slot: 'backpack',   wt: 1,  cost: 0.5, desc: 'Utility, Exploration. Bright 15 ft, dim 30 ft beyond.' },
    { name: 'Rations',           qty: 7,          slot: 'backpack',   wt: 14, cost: 3.5, desc: 'Consumable. 1 day of food each.' },
    { name: 'Robe',              qty: 1,          slot: 'backpack',   wt: 4,  cost: 1 },
    { name: 'Tinderbox',         qty: 1,          slot: 'backpack',   wt: 1,  cost: 0.5, desc: 'Utility, Exploration. 1 action to light a lamp/torch/small fire.' }
    // Quiver: empty. Attunement: no items currently attuned (3 slots available).
  ],
  // Currency — verify against DDB. Screenshot showed 295 gp and a few pp/ep;
  // exact minor totals unclear from the coin icons. Update in edit mode
  // (Currency section) once confirmed.
  currency: { pp: 3, gp: 295, ep: 8, sp: 0, cp: 0 },
  // Bio short — full backstory lives in vault _Backstories - Verbatim Reference.md.
  bio: {
    faith: 'Luminos — cleric of Light. Mercy is his strength.',
    adoptive_father: 'Merric Underbough (aka Rulden Marr) — has since become Veilmaster of the Guilded Veil (party knows).',
    homeland: '(from backstory)',
    voice: '(from backstory)'
  }
};
