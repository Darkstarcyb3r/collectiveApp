// Sound Service — lightweight UI sound effects
// Uses expo-av to play tiny bundled WAV files

import { Audio } from 'expo-av'

// Pre-loaded sound references
let swooshSound = null
let popSound = null
let clickSound = null

// Load sounds once at app startup
export const loadSounds = async () => {
  try {
    const { sound: swoosh } = await Audio.Sound.createAsync(
      require('../assets/sounds/swoosh.wav'),
      { volume: 0.45 }
    )
    swooshSound = swoosh

    const { sound: pop } = await Audio.Sound.createAsync(
      require('../assets/sounds/pop.wav'),
      { volume: 0.4 }
    )
    popSound = pop

    const { sound: click } = await Audio.Sound.createAsync(
      require('../assets/sounds/click.wav'),
      { volume: 0.15 }
    )
    clickSound = click
  } catch (_e) {
    // Sounds are non-critical — fail silently
  }
}

// Play the swoosh (message sent)
export const playSwoosh = async () => {
  try {
    if (!swooshSound) return
    await swooshSound.setPositionAsync(0)
    await swooshSound.playAsync()
  } catch (_e) {}
}

// Play the pop (follow/unfollow)
export const playPop = async () => {
  try {
    if (!popSound) return
    await popSound.setPositionAsync(0)
    await popSound.playAsync()
  } catch (_e) {}
}

// Play the click (button tap)
export const playClick = async () => {
  try {
    if (!clickSound) return
    await clickSound.setPositionAsync(0)
    await clickSound.playAsync()
  } catch (_e) {}
}

// Cleanup on unmount (optional)
export const unloadSounds = async () => {
  try {
    if (swooshSound) await swooshSound.unloadAsync()
    if (popSound) await popSound.unloadAsync()
    if (clickSound) await clickSound.unloadAsync()
  } catch (_e) {}
}
