import { functions } from '../config/firebase'

/**
 * Upload an image to Cloudinary using server-signed authentication.
 * Calls the getCloudinarySignature Cloud Function for a signature,
 * then uploads directly to Cloudinary's API.
 *
 * @param {string} imageUri - Local file URI of the image
 * @param {string} folder - Cloudinary folder path (e.g. "collective/users/abc123")
 * @param {string} [filenamePrefix] - Optional prefix for the filename
 * @param {Object} [metadata] - Optional { fileSize, mimeType } from imageValidation
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export const signedUpload = async (imageUri, folder, filenamePrefix = 'upload', metadata = {}) => {
  try {
    const { fileSize = null, mimeType = 'image/jpeg' } = metadata

    // 1. Get signed upload credentials from Cloud Function (includes server-side validation)
    const getSignature = functions.httpsCallable('getCloudinarySignature')
    const result = await getSignature({ folder, filenamePrefix, fileSize, mimeType })

    const { signature, timestamp, apiKey, cloudName } = result.data

    // 2. Build FormData for Cloudinary upload — use actual mimeType
    const ext = mimeType.split('/')[1] || 'jpg'
    const filename = `${filenamePrefix}_${Date.now()}.${ext === 'jpeg' ? 'jpg' : ext}`
    const formData = new FormData()
    formData.append('file', {
      uri: imageUri,
      type: mimeType,
      name: filename,
    })
    formData.append('signature', signature)
    formData.append('timestamp', timestamp)
    formData.append('api_key', apiKey)
    formData.append('folder', folder)

    // 3. Upload to Cloudinary
    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    })

    const data = await response.json()

    if (data.secure_url) {
      return { success: true, url: data.secure_url }
    }

    return { success: false, error: data.error?.message || 'Upload failed' }
  } catch (error) {
    console.error('Signed upload error:', error)
    // Provide user-friendly error for rate limit
    if (error.code === 'functions/resource-exhausted') {
      return { success: false, error: 'Daily upload limit reached. Try again tomorrow.' }
    }
    return { success: false, error: error.message || 'Upload failed' }
  }
}
