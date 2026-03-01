// Share Link Utilities
// Generates deep link URLs for sharing app content via SMS, social, etc.
//
// URL scheme: collective://
// When Universal Links are configured (production), these will use:
//   https://collectivenetwork.app/events/eventId
// For now, uses the app scheme which works in dev builds + production:
//   collective://events/eventId
//
// Deep link paths:
//   /events/:eventId         — Event detail
//   /groups/:groupId/:postId — Group post detail
//   /cyberlounge/:roomId     — Cyber lounge chatroom
//   /barter/:postId          — Barter market post
//   /mutualaid/:groupId      — Mutual aid group

import { Share } from 'react-native'

// Base URL — switch to your web domain when Universal Links are set up
const BASE_URL = 'collective://'

export const buildEventLink = (eventId) => `${BASE_URL}events/${eventId}`
export const buildGroupPostLink = (groupId, postId) => `${BASE_URL}groups/${groupId}/${postId}`
export const buildCyberLoungeLink = (roomId) => `${BASE_URL}cyberlounge/${roomId}`
export const buildBarterLink = (postId) => `${BASE_URL}barter/${postId}`
export const buildMutualAidLink = (groupId) => `${BASE_URL}mutualaid/${groupId}`

/**
 * Open the native share sheet with a message + deep link.
 * @param {string} message - Human-readable text (shown in SMS body)
 * @param {string} url - Deep link URL (appended to message)
 */
export const shareContent = async (message, url) => {
  try {
    await Share.share({
      message: `${message}\n${url}`,
    })
  } catch (_error) {
    // User cancelled — no action needed
  }
}
