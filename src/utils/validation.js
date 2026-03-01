// Input Validation Utility
// Centralized text length validation for all user-submitted content.
// Applied at the service layer as a defense-in-depth measure.

const MAX_LENGTHS = {
  message: 5000,
  comment: 2000,
  postTitle: 200,
  postContent: 5000,
  groupName: 100,
  groupDescription: 2000,
  eventTitle: 200,
  eventDescription: 5000,
  eventLocation: 300,
  quip: 150,
  reportReason: 500,
  reportDetails: 2000,
  chatroomName: 100,
  barterTitle: 200,
  barterDescription: 3000,
  confluenceCaption: 2000,
  mutualAidName: 200,
  mutualAidDescription: 3000,
  mutualAidLink: 500,
  userName: 100,
  searchQuery: 100,
}

/**
 * Validate and truncate a text field to its maximum allowed length.
 * Returns the trimmed string, or empty string if input is falsy.
 *
 * @param {string} text - The input text to validate
 * @param {string} fieldType - Key from MAX_LENGTHS (e.g. 'message', 'comment')
 * @returns {string} The validated text (trimmed and length-limited)
 */
export const validateText = (text, fieldType) => {
  if (!text || typeof text !== 'string') return ''
  const trimmed = text.trim()
  const maxLen = MAX_LENGTHS[fieldType]
  if (maxLen && trimmed.length > maxLen) {
    return trimmed.substring(0, maxLen)
  }
  return trimmed
}

/**
 * Check if a text field exceeds its maximum allowed length.
 * Useful for UI validation before submission.
 *
 * @param {string} text - The input text to check
 * @param {string} fieldType - Key from MAX_LENGTHS
 * @returns {{ valid: boolean, maxLength: number, currentLength: number }}
 */
export const checkTextLength = (text, fieldType) => {
  const maxLen = MAX_LENGTHS[fieldType] || Infinity
  const currentLength = (text || '').length
  return {
    valid: currentLength <= maxLen,
    maxLength: maxLen,
    currentLength,
  }
}

export { MAX_LENGTHS }

export default {
  validateText,
  checkTextLength,
  MAX_LENGTHS,
}
