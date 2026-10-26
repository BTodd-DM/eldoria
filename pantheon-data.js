// =====================================================================
// THE WAYWARD COMPANY — SHARED PANTHEON DATA
// ---------------------------------------------------------------------
// Canonical Eldoria pantheon. Loaded by both DM site (for the knowledge
// tracker) and player site (for filtered display).
//
// Categories: creator, child, betrayer
// =====================================================================

const PANTHEON_GODS = [
  // Creators
  { id: 'luminos',   category: 'creator', name: 'Luminos',   align: 'Neutral Good · Creator',
    body: 'Radiant light, creativity, hope, knowledge. Revered by scholars, artists, teachers, and any who work to bring understanding into dark places. Symbol: a radiant orb wreathed in flowing light.',
    color: '#c9a84c' },
  { id: 'veridania', category: 'creator', name: 'Veridania', align: 'Neutral · Creator',
    body: 'Nature\'s balance, life, the interconnection of all living things. Honoured by druids, healers, and naturalists. Sylvarian communities revere her alongside Yggdris. Symbol: a blooming flower with intertwining roots.',
    color: '#7fbfa0' },
  // Children
  { id: 'aetherius', category: 'child', name: 'Aetherius', align: 'Lawful Good',
    body: 'Wisdom, prophecy, the stars. State deity of the Aurum Dominion. Symbol: a starburst.', color: '#a0a0d0' },
  { id: 'solara',    category: 'child', name: 'Solara',    align: 'Lawful Good',
    body: 'Light, sun, rebirth. Paladins and healers. Revered by the nomads of the Ember Wastes. Symbol: a golden sunburst.', color: '#e0c060' },
  { id: 'korvain',   category: 'child', name: 'Korvain',   align: 'Lawful Neutral',
    body: 'Craftsmanship, invention, the dwarven peoples. Chief god of the Celestium Clans. Symbol: anvil and hammer.', color: '#a08050' },
  { id: 'thalasia',  category: 'child', name: 'Thalasia',  align: 'Lawful Neutral',
    body: 'Arcane magic and the elemental forces. Central to the mages of the Aurum Dominion. Symbol: a crystal marked with elemental sigils.', color: '#80a0d0' },
  { id: 'mornyx',    category: 'child', name: "Mor'nyx",   align: 'Lawful Neutral',
    body: 'Death, the afterlife, the protection of the dead. Chief god of the Ember Wastes tombs. Symbol: an ankh with winged scarab.', color: '#909090' },
  { id: 'sirenna',   category: 'child', name: 'Sirenna',   align: 'Neutral',
    body: 'The sea, protection, the natural world\'s harsher edges. Worshipped by the Reptilian Tribes and the Pirate Confederacy. Symbol: a coiled sea serpent.', color: '#5fbfbf' },
  { id: 'yggdris',   category: 'child', name: 'Yggdris',   align: 'Neutral Good',
    body: 'Nature, balance, the life cycle. Worshipped by the Sylvarian Enclaves, druids, and rangers. Symbol: intertwined trees.', color: '#7fa050' },
  { id: 'lunara',    category: 'child', name: 'Lunara',    align: 'Neutral',
    body: 'The moon, dreams, hidden truths. The Order of the Silver Crescent is devoted to her. Symbol: a crescent moon.', color: '#b0b0d0' },
  { id: 'sylvana',   category: 'child', name: 'Sylvana',   align: 'Chaotic Good',
    body: 'Travel, air, communication. Patron of the nomad clans of the Ember Wastes. Symbol: a wind-carried feather.', color: '#c0d090' },
  { id: 'mizura',    category: 'child', name: 'Mizura',    align: 'Chaotic Neutral',
    body: 'Secrets, illusions, trickery. Patron of rogues, spies, and quiet cults. Symbol: a two-faced mask.', color: '#a080b0' },
  // Betrayers (hidden by default on player side)
  { id: 'astronar',  category: 'betrayer', name: 'Astronar — the Twilight Sovereign', align: 'Lawful Evil · Betrayer',
    body: 'Said to work through secrets, whispers, and those who believe themselves free. Blamed in old stories for the coming of the Dark Reign. Symbol: an eclipse shrouding a sun.', color: '#c04040' },
  { id: 'naturus',   category: 'betrayer', name: 'Naturus — the Rotting Entropy', align: 'Chaotic Evil · Betrayer',
    body: 'Said to rot what he touches. His cults hide in wild places and gather beneath the sign of the withered tree. Priests warn against travelling through corrupted lands after nightfall.', color: '#c04040' }
];

if (typeof window !== 'undefined') window.PANTHEON_GODS = PANTHEON_GODS;
