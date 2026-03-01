// Link Preview Cache
// In-memory cache for fetched OpenGraph metadata
// Prevents re-fetching URLs on every render

import { getLinkPreview } from 'link-preview-js'

const cache = new Map()
const MAX_CACHE_SIZE = 100

// Extract the first URL from a text string
export const extractFirstUrl = (text) => {
  if (!text) return null
  const urlRegex = /(https?:\/\/[^\s]+)/gi
  const match = text.match(urlRegex)
  return match ? match[0] : null
}

// Fetch OpenGraph preview data with caching
export const fetchLinkPreview = async (url) => {
  if (cache.has(url)) {
    return cache.get(url)
  }

  try {
    const data = await getLinkPreview(url, {
      timeout: 5000,
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; CollectiveApp/1.0)',
      },
    })

    const preview = {
      url: data.url || url,
      title: data.title || '',
      description: data.description || '',
      image: data.images?.[0] || data.favicons?.[0] || null,
      siteName:
        data.siteName ||
        (() => {
          try {
            return new URL(url).hostname
          } catch {
            return url
          }
        })(),
    }

    // Evict oldest entry if at capacity
    if (cache.size >= MAX_CACHE_SIZE) {
      const firstKey = cache.keys().next().value
      cache.delete(firstKey)
    }

    cache.set(url, preview)
    return preview
  } catch (_error) {
    // Cache failures as null to avoid retrying broken URLs
    cache.set(url, null)
    return null
  }
}
