// LinkPreviewCard - Displays OpenGraph preview for URLs in chat messages
// Thumbnail on left, site name / title / description on right
// Tapping opens the URL in the browser

import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../theme'
import { fonts } from '../../theme/typography'
import { fetchLinkPreview } from '../../utils/linkPreviewCache'

const LinkPreviewCard = ({ url }) => {
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      const data = await fetchLinkPreview(url)
      if (!cancelled) {
        if (data) {
          setPreview(data)
        } else {
          setError(true)
        }
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [url])

  if (error || (!loading && !preview)) return null

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="small" color={colors.offline} />
      </View>
    )
  }

  const handlePress = () => {
    Linking.openURL(url).catch(() => {})
  }

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.7}>
      {preview.image && (
        <Image source={{ uri: preview.image }} style={styles.thumbnail} resizeMode="cover" />
      )}
      <View style={styles.textContainer}>
        <Text style={styles.siteName} numberOfLines={1}>
          {preview.siteName}
        </Text>
        {preview.title ? (
          <Text style={styles.title} numberOfLines={2}>
            {preview.title}
          </Text>
        ) : null}
        {preview.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {preview.description}
          </Text>
        ) : null}
      </View>
      <View style={styles.linkIcon}>
        <Ionicons name="open-outline" size={12} color={colors.offline} />
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundCard,
    borderRadius: 10,
    marginTop: 8,
    overflow: 'hidden',
    minHeight: 50,
    minWidth: 240,
    paddingRight: 8,
  },
  thumbnail: {
    width: 80,
    height: 56,
    backgroundColor: '#333',
  },
  textContainer: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  siteName: {
    fontSize: 10,
    fontFamily: fonts.mono,
    color: colors.offline,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  description: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.offline,
    lineHeight: 14,
  },
  linkIcon: {
    paddingLeft: 4,
  },
})

export default LinkPreviewCard
