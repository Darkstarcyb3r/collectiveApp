// NotificationBell - Bell icon overlay for profile photo
// Positioned absolute bottom-right, shows unread count badge

import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../theme/colors'
import { fonts } from '../../theme/typography'

const NotificationBell = ({ unreadCount = 0, onPress }) => {
  return (
    <TouchableOpacity
      style={styles.bellContainer}
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      activeOpacity={0.7}
    >
      <View style={styles.bellCircle}>
        <Ionicons name="notifications" size={18} color="#000000" />
      </View>
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  bellContainer: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    zIndex: 10,
  },
  bellCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#000000',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.tertiary,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: '#000000',
  },
  badgeText: {
    color: '#000000',
    fontSize: 10,
    fontFamily: fonts.bold,
  },
})

export default NotificationBell
