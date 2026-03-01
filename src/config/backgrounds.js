// Background config for Cyber Lounge chatrooms
// Host picks a background image for the chat container
// Stored in Firestore as a background ID string

export const BACKGROUNDS = [
  { id: 'none', label: 'No Background', source: null },
  {
    id: 'chaoticOcean',
    label: 'Chaotic Ocean',
    source: require('../assets/backgrounds/chaoticOcean.png'),
  },
  {
    id: 'chromGirlie',
    label: 'Chrom Girlie',
    source: require('../assets/backgrounds/chromGirlie.png'),
  },
  { id: 'clouds', label: 'Clouds', source: require('../assets/backgrounds/clouds.png') },
  {
    id: 'feelingCute',
    label: 'Feeling Cute',
    source: require('../assets/backgrounds/feelingCute.png'),
  },
  {
    id: 'glitchGoddess',
    label: 'Glitch Goddess',
    source: require('../assets/backgrounds/glitchGoddess.png'),
  },
  { id: 'mountain', label: 'Mountain', source: require('../assets/backgrounds/mountain.png') },
  {
    id: 'organicGlitch',
    label: 'Organic Glitch',
    source: require('../assets/backgrounds/organicGlitch.png'),
  },
  { id: 'slime', label: 'Slime', source: require('../assets/backgrounds/slime.png') },
  { id: 'spaceBase', label: 'Space Base', source: require('../assets/backgrounds/spaceBase.png') },
  { id: 'spring', label: 'Spring', source: require('../assets/backgrounds/spring.png') },
  {
    id: 'touchGrass',
    label: 'Touch Grass',
    source: require('../assets/backgrounds/touchGrass.png'),
  },
  { id: 'water', label: 'Water', source: require('../assets/backgrounds/water.png') },
]

export const DEFAULT_BACKGROUND_ID = 'none'

export const getBackgroundById = (id) => {
  return BACKGROUNDS.find((bg) => bg.id === id) || BACKGROUNDS[0]
}
