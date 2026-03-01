// Vibe registry for Cyber Lounge background music
// Each vibe has an id (stored in Firestore), a display label, and a require() source
// Metro bundler requires static paths — no dynamic require() allowed

export const VIBES = [
  { id: 'none', label: 'No Music', source: null },
  { id: 'lowFiLoops', label: 'Lo-Fi Loops', source: require('../audio/lowFiLoops.mp3') },
  { id: 'ambientPop', label: 'Ambient Pop', source: require('../audio/ambientPop.mp3') },
  {
    id: 'ambientDreamcore',
    label: 'Ambient Dreamcore',
    source: require('../audio/ambientDreamcore.mp3'),
  },
  { id: 'softPiano', label: 'Soft Piano', source: require('../audio/softPiano.mp3') },
  { id: 'soulSoundbath', label: 'Soul Soundbath', source: require('../audio/SoulSoundbath.mp3') },
  {
    id: 'cinematicGhosts',
    label: 'Cinematic Ghosts',
    source: require('../audio/cinematicGhosts.mp3'),
  },
  {
    id: 'justBeingQuietlySad',
    label: 'Just Being Quietly Sad',
    source: require('../audio/justBeingQuietlySad.mp3'),
  },
  { id: 'justDarling', label: 'Just Darling', source: require('../audio/JustDarling.mp3') },
  { id: 'darkCyberpunk', label: 'Dark Cyberpunk', source: require('../audio/darkcyberpunk.mp3') },
  { id: 'freakyTrap', label: 'Freaky Trap', source: require('../audio/freakyTrap.mp3') },
  { id: '1964Frenchy', label: '1964 Frenchy', source: require('../audio/1964Frenchy.mp3') },
  { id: 'afrobeatSun', label: 'Afrobeat Sun', source: require('../audio/AfrobeatSun.mp3') },
  { id: 'smoothVibes', label: 'Smooth Vibes', source: require('../audio/SmoothVibes.mp3') },
  { id: 'jeVais', label: 'Je Vais', source: require('../audio/jeVais.mp3') },
  { id: 'sadGirls', label: 'Sad Girls', source: require('../audio/sadGirls.mp3') },
  { id: 'strut', label: 'Strut', source: require('../audio/strut.mp3') },
  { id: 'japanesePop', label: 'Japanese Pop', source: require('../audio/japanesePop.mp3') },
  { id: 'dungeonSynth', label: 'Dungeon Synth', source: require('../audio/dungeonSynth.mp3') },
  { id: '8bitBaby', label: '8-Bit Baby', source: require('../audio/8bitBaby.mp3') },
]

// Helper: look up a vibe by its Firestore ID
export const getVibeById = (vibeId) => VIBES.find((v) => v.id === vibeId) || VIBES[0]

// Default vibe for new rooms
export const DEFAULT_VIBE_ID = 'none'
