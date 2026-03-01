import * as FileSystem from 'expo-file-system'

// ── Single source of truth for upload limits ──
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB
const MAX_FILE_SIZE_MB = 10
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

/**
 * Extract file extension from a URI (strips query params / fragments).
 */
const getExtensionFromUri = (uri) => {
  const clean = uri.split('?')[0].split('#')[0]
  const parts = clean.split('.')
  return parts.length > 1 ? parts.pop().toLowerCase() : ''
}

/**
 * Derive MIME type from the expo-image-picker asset.
 * Falls back to extension-based lookup if the asset doesn't carry a type.
 */
const getMimeType = (asset) => {
  if (asset?.mimeType) return asset.mimeType.toLowerCase()
  if (asset?.type) return asset.type.toLowerCase()
  const ext = getExtensionFromUri(asset?.uri || '')
  const map = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }
  return map[ext] || ''
}

/**
 * Validate an image asset from expo-image-picker.
 *
 * @param {Object} asset  – result.assets[0] from ImagePicker
 * @returns {Promise<{ valid: boolean, error?: string, fileSize?: number, mimeType?: string }>}
 */
export const validateImageAsset = async (asset) => {
  const uri = asset?.uri
  if (!uri) return { valid: false, error: 'No image selected.' }

  // ── 1. Format check ──
  const mimeType = getMimeType(asset)
  const ext = getExtensionFromUri(uri)

  if (!ALLOWED_MIME_TYPES.includes(mimeType) && !ALLOWED_EXTENSIONS.includes(ext)) {
    return { valid: false, error: 'Unsupported format. Please use JPG, PNG, or WebP.' }
  }

  // ── 2. File size check ──
  let fileSize = asset?.fileSize // sometimes populated by expo-image-picker
  if (!fileSize) {
    try {
      const info = await FileSystem.getInfoAsync(uri, { size: true })
      fileSize = info.size
    } catch {
      // Cannot determine size — allow through (server-side is the backstop)
      return { valid: true, fileSize: null, mimeType: mimeType || `image/${ext}` }
    }
  }

  if (fileSize > MAX_FILE_SIZE_BYTES) {
    const sizeMB = (fileSize / (1024 * 1024)).toFixed(1)
    return {
      valid: false,
      error: `Image is too large (${sizeMB} MB). Maximum size is ${MAX_FILE_SIZE_MB} MB.`,
    }
  }

  return { valid: true, fileSize, mimeType: mimeType || `image/${ext}` }
}

export const IMAGE_LIMITS = {
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_MB,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
}
