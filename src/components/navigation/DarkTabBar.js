// DarkTabBar - Dark-themed bottom tab bar for screens outside main tabs
// Same auto-hide animation as LightTabBar but with dark background matching AutoHideTabBar
// Exposes show/hide/resetTimer via ref for scroll-based control

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react'
import { View, TouchableOpacity, Animated, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { colors } from '../../theme'
import { useAuth } from '../../contexts/AuthContext'
import { subscribeToConversations } from '../../services/messageService'
import { subscribeToNotifications } from '../../services/notificationHistoryService'

const IDLE_TIMEOUT = 5000

const TABS = [
  { name: 'HomeTab', icon: 'home-outline' },
  { name: 'MessagesTab', icon: 'mail-outline' },
  { name: 'ProfileTab', icon: 'person-outline' },
  { name: 'ConfluenceTab', icon: 'globe-outline' },
]

const DarkTabBar = forwardRef((props, ref) => {
  const navigation = useNavigation()
  const { user } = useAuth()
  const insets = useSafeAreaInsets()
  const fadeAnim = useRef(new Animated.Value(1)).current
  const [visible, setVisible] = useState(true)
  const idleTimer = useRef(null)
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

  // Reset the idle timer — shows the bar and starts the countdown
  const resetTimer = useCallback(() => {
    setVisible(true)
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => {
      setVisible(false)
    }, IDLE_TIMEOUT)
  }, [])

  const show = useCallback(() => {
    resetTimer()
  }, [resetTimer])

  const hide = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current)
    setVisible(false)
  }, [])

  // Expose show/hide/resetTimer to parent screens via ref
  useImperativeHandle(
    ref,
    () => ({
      show,
      hide,
      resetTimer,
    }),
    [show, hide, resetTimer]
  )

  // Start initial idle timer
  useEffect(() => {
    resetTimer()
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Animate opacity based on visible state
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: visible ? 1 : 0,
      duration: 400,
      useNativeDriver: true,
    }).start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const handleTabPress = (tabName) => {
    resetTimer()
    // Navigate to the tab within the MainTabs navigator
    navigation.navigate('MainTabs', { screen: tabName })
  }

  return (
    <Animated.View
      style={[styles.container, { opacity: fadeAnim, paddingBottom: insets.bottom || 8 }]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      {TABS.map((tab) => (
        <TouchableOpacity
          key={tab.name}
          accessibilityRole="button"
          onPress={() => handleTabPress(tab.name)}
          style={styles.tab}
        >
          <View style={styles.iconWrapper}>
            <Ionicons name={tab.icon} size={24} color={colors.tabBarInactive} />
            {tab.name === 'MessagesTab' && hasUnreadMessages && <View style={styles.unreadDot} />}
            {tab.name === 'HomeTab' && hasUnreadNotifications && <View style={styles.unreadDot} />}
          </View>
        </TouchableOpacity>
      ))}
    </Animated.View>
  )
})

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

export default DarkTabBar
