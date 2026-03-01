// Phone number formatting utility
// Formats phone numbers as (xxx) xxx-xxxx for display and input

/**
 * Formats a phone number string as the user types.
 * Strips non-digits, then applies (xxx) xxx-xxxx format progressively.
 * Caps at 10 digits.
 *
 * @param {string} text - Raw input text
 * @returns {string} Formatted phone number
 */
export const formatPhoneNumber = (text) => {
  // Strip all non-digit characters
  const digits = text.replace(/\D/g, '').slice(0, 10)

  if (digits.length === 0) return ''
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

/**
 * Strips all formatting from a phone number, returning digits only.
 * Use this before saving to Firestore.
 *
 * @param {string} formatted - Formatted phone number string
 * @returns {string} Digits only (e.g. "5551234567")
 */
export const stripPhoneFormatting = (formatted) => {
  if (!formatted) return ''
  return formatted.replace(/\D/g, '')
}
