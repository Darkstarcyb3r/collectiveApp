// AutoHideTabBar - Custom tab bar that fades out after inactivity or scroll
// Visible for 10 seconds on load/interaction, then fades away
// Reappears on tab press or when scroll position returns to top half

import React, { useEffect, useRef, useState } from 'react'
import { View, TouchableOpacity, Animated, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../theme'
import { useTabBar } from '../../contexts/TabBarContext'
import { useAuth } from '../../contexts/AuthContext'
import { subscribeToConversations } from '../../services/messageService'
import { subscribeToNotifications } from '../../services/notificationHistoryService'
import { playClick } from '../../services/soundService'

const AutoHideTabBar = ({ state, _descriptors, navigation }) => {
  const { visible, resetTimer } = useTabBar()
  const { user } = useAuth()
  const fadeAnim = useRef(new Animated.Value(1)).current
  const insets = useSafeAreaInsets()
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false)
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false)

  // Subscribe to unread messages
  useEffect(() => {
    if (!user?.uid) return
    const unsubscribe = subscribeToConversations(user.uid, (convos) => {
      const unread = convos.some((c) => c[`unread_${user.uid}`] === true)
      setHasUnreadMessages(unread)
    })
    return () => unsubscribe()
  }, [user?.uid])

  // Subscribe to unread notifications
  useEffect(() => {
    if (!user?.uid) return
    const unsubscribe = subscribeToNotifications(user.uid, (notifs) => {
      const unread = notifs.some((n) => !n.read)
      setHasUnreadNotifications(unread)
    })
    return () => unsubscribe()
  }, [user?.uid])

  // Animate opacity based on visible state
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: visible ? 1 : 0,
      duration: 400,
      useNativeDriver: true,
    }).start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const getIconName = (routeName) => {
    switch (routeName) {
      case 'HomeTab':
        return 'home-outline'
      case 'MessagesTab':
        return 'mail-outline'
      case 'ProfileTab':
        return 'person-outline'
      case 'ConfluenceTab':
        return 'globe-outline'
      default:
        return 'ellipse-outline'
    }
  }

  return (
    <Animated.View
      style={[styles.container, { opacity: fadeAnim, paddingBottom: insets.bottom || 8 }]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      {state.routes.map((route, index) => {
        const isFocused = state.index === index
        const iconName = getIconName(route.name)

        const onPress = () => {
          playClick()
          resetTimer()

          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          })

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name)
          }
        }

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          })
        }

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tab}
          >
            <View style={styles.iconWrapper}>
              <Ionicons
                name={iconName}
                size={24}
                color={isFocused ? colors.primary : colors.tabBarInactive}
              />
              {route.name === 'MessagesTab' && hasUnreadMessages && (
                <View style={styles.unreadDot} />
              )}
              {route.name === 'HomeTab' && hasUnreadNotifications && (
                <View style={styles.unreadDot} />
              )}
            </View>
          </TouchableOpacity>
        )
      })}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    paddingTop: 10,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  iconWrapper: {
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
})

export default AutoHideTabBar
