// Avatar Component
// Displays user profile photos with various sizes

import React from 'react'
import { View, Image, StyleSheet, Text } from 'react-native'
import { colors } from '../../theme'

const Avatar = ({
  source,
  size = 'medium', // small, medium, large, xlarge, profile
  name,
  showOnline = false,
  isOnline = false,
  style,
}) => {
  const getSizeStyle = () => {
    switch (size) {
      case 'small':
        return styles.small
      case 'medium':
        return styles.medium
      case 'large':
        return styles.large
      case 'xlarge':
        return styles.xlarge
      case 'profile':
        return styles.profile
      default:
        return styles.medium
    }
  }

  const getInitials = (name) => {
    if (!name) return '?'
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name[0].toUpperCase()
  }

  const getFontSize = () => {
    switch (size) {
      case 'small':
        return 14
      case 'medium':
        return 20
      case 'large':
        return 32
      case 'xlarge':
        return 48
      case 'profile':
        return 56
      default:
        return 20
    }
  }

  const getOnlineIndicatorSize = () => {
    switch (size) {
      case 'small':
        return { width: 10, height: 10, borderWidth: 2 }
      case 'medium':
        return { width: 14, height: 14, borderWidth: 2 }
      case 'large':
        return { width: 18, height: 18, borderWidth: 3 }
      case 'xlarge':
      case 'profile':
        return { width: 22, height: 22, borderWidth: 3 }
      default:
        return { width: 14, height: 14, borderWidth: 2 }
    }
  }

  const renderPlaceholder = () => (
    <View style={[styles.placeholder, getSizeStyle(), style]}>
      <Text style={[styles.initials, { fontSize: getFontSize() }]}>{getInitials(name)}</Text>
    </View>
  )

  const onlineIndicatorStyle = getOnlineIndicatorSize()

  return (
    <View style={styles.container}>
      {source ? (
        <Image
          source={typeof source === 'string' ? { uri: source, cache: 'reload' } : source}
          style={[styles.image, getSizeStyle(), style]}
        />
      ) : (
        renderPlaceholder()
      )}
      {showOnline && (
        <View
          style={[
            styles.onlineIndicator,
            onlineIndicatorStyle,
            isOnline ? styles.online : styles.offline,
          ]}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  image: {
    borderRadius: 9999,
  },
  placeholder: {
    backgroundColor: colors.lilac,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
  },
  initials: {
    color: colors.textDark,
    fontWeight: '600',
  },

  // Sizes
  small: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  medium: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  large: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  xlarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  profile: {
    width: 160,
    height: 200,
    borderRadius: 80,
  },

  // Online indicator
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    borderRadius: 9999,
    borderColor: colors.background,
  },
  online: {
    backgroundColor: colors.online,
  },
  offline: {
    backgroundColor: colors.offline,
  },
})

export default Avatar
