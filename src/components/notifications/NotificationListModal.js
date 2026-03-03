// NotificationListModal - Full notification history with swipe-to-delete
// Shows all past notifications in a vertical stack
// Swipe left on a notification to reveal delete action

import React, { useRef, useCallback, useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Animated,
  SafeAreaView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Swipeable from 'react-native-gesture-handler/Swipeable'
import { colors } from '../../theme/colors'
import { fonts } from '../../theme/typography'
import CustomToggle from '../common/CustomToggle'
import { deleteNotification } from '../../services/notificationHistoryService'
import { useAuth } from '../../contexts/AuthContext'
import { firestore } from '../../config/firebase'

// Icon mapping by notification type
const getNotificationIcon = (type) => {
  switch (type) {
    case 'message':
      return 'chatbubble-outline'
    case 'chat_request':
      return 'chatbubble-ellipses-outline'
    case 'chat_accepted':
      return 'checkmark-circle-outline'
    case 'chat_declined':
      return 'close-circle-outline'
    case 'follower':
    case 'subscriber':
      return 'person-add-outline'
    case 'group_invite':
      return 'people-outline'
    case 'chatroom_invite':
    case 'cyberlounge_room':
      return 'cafe-outline'
    case 'groupPostComment':
    case 'groupCommentReaction':
    case 'groupPostCommentReply':
    case 'groupPostSubscription':
      return 'chatbox-outline'
    case 'eventComment':
    case 'eventCommentReaction':
    case 'eventCommentReply':
      return 'calendar-outline'
    case 'mutualAidComment':
    case 'mutualAidCommentReaction':
    case 'mutualAidCommentReply':
      return 'heart-outline'
    case 'barterMarketPost':
      return 'swap-horizontal-outline'
    case 'mutualAidGroup':
      return 'heart-outline'
    default:
      return 'notifications-outline'
  }
}

// Map notification type to navigation target
const getNavigationTarget = (notification) => {
  const { type, data } = notification
  if (!data) return null
  switch (type) {
    case 'eventComment':
    case 'eventCommentReaction':
    case 'eventCommentReply':
      return data.eventId ? { route: 'EventDetail', params: { eventId: data.eventId } } : null
    case 'groupPostComment':
    case 'groupCommentReaction':
    case 'groupPostCommentReply':
    case 'groupPostSubscription':
      return data.groupId && data.postId
        ? { route: 'PostDetail', params: { groupId: data.groupId, postId: data.postId } }
        : null
    case 'mutualAidComment':
    case 'mutualAidCommentReaction':
    case 'mutualAidCommentReply':
      return data.groupId ? { route: 'MutualAidPost', params: { groupId: data.groupId } } : null
    case 'barterMarketPost':
      return data.postId ? { route: 'BarterMarketPost', params: { postId: data.postId } } : null
    case 'mutualAidGroup':
      return data.groupId ? { route: 'MutualAidPost', params: { groupId: data.groupId } } : null
    case 'follower':
      return data.followerId ? { route: 'UserProfile', params: { userId: data.followerId } } : null
    case 'subscriber':
      return data.subscriberId
        ? { route: 'UserProfile', params: { userId: data.subscriberId } }
        : null
    case 'message':
    case 'chat_request':
    case 'chat_accepted':
    case 'group_invite':
      return data.conversationId
        ? {
            route: 'Chat',
            params: { conversationId: data.conversationId, otherUserId: data.senderId },
          }
        : null
    case 'chatroom_invite':
    case 'cyberlounge_room':
      return data.roomId ? { route: 'CyberLoungeDetail', params: { roomId: data.roomId } } : null
    default:
      return null
  }
}

// Simple relative time formatter
const timeAgo = (timestamp) => {
  if (!timestamp) return 'just now'

  let date
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    date = timestamp.toDate()
  } else if (timestamp.seconds) {
    date = new Date(timestamp.seconds * 1000)
  } else if (timestamp instanceof Date) {
    date = timestamp
  } else {
    date = new Date(timestamp)
  }

  const now = new Date()
  const diffMs = now - date
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`
  return `${Math.floor(diffDay / 30)}mo ago`
}

const NotificationItem = ({ item, userId, onDeleted, onPress, showAsUnread }) => {
  const swipeableRef = useRef(null)

  const handleDelete = useCallback(async () => {
    swipeableRef.current?.close()
    await deleteNotification(userId, item.id)
    if (onDeleted) onDeleted(item.id)
  }, [userId, item.id, onDeleted])

  const renderRightActions = (progress, _dragX) => {
    const trans = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [80, 0],
    })

    return (
      <Animated.View style={[styles.deleteAction, { transform: [{ translateX: trans }] }]}>
        <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
          <Ionicons name="trash-outline" size={22} color={colors.offline} />
        </TouchableOpacity>
      </Animated.View>
    )
  }

  const iconName = getNotificationIcon(item.type)
  const isUnread = showAsUnread
  const navTarget = getNavigationTarget(item)

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      rightThreshold={40}
      overshootRight={false}
    >
      <TouchableOpacity
        style={[styles.notificationItem, isUnread && styles.notificationUnread]}
        onPress={() => navTarget && onPress && onPress(navTarget)}
        activeOpacity={navTarget ? 0.6 : 1}
        disabled={!navTarget}
      >
        <View style={styles.iconContainer}>
          <Ionicons name={iconName} size={20} color={colors.primary} />
        </View>
        <View style={styles.notificationContent}>
          <Text style={styles.notificationTitle} numberOfLines={1}>
            {item.title || 'Notification'}
          </Text>
          <Text style={styles.notificationBody} numberOfLines={2}>
            {item.body || ''}
          </Text>
          <Text style={styles.notificationTime}>{timeAgo(item.createdAt)}</Text>
        </View>
        {isUnread && <View style={styles.unreadDot} />}
        {navTarget && (
          <Ionicons
            name="chevron-forward"
            size={16}
            color={colors.offline}
            style={{ marginLeft: 4 }}
          />
        )}
      </TouchableOpacity>
    </Swipeable>
  )
}

const NotificationListModal = ({ visible, notifications, onClose, userId, onNavigate }) => {
  const { userProfile, refreshUserProfile } = useAuth()
  const isDisabled = userProfile?.notificationsMuted === true
  const [notificationsEnabled, setNotificationsEnabled] = useState(!isDisabled)
  const [visuallyUnreadIds, setVisuallyUnreadIds] = useState(new Set())
  const unreadTimerRef = useRef(null)

  // Sync toggle state whenever profile changes or modal opens
  useEffect(() => {
    setNotificationsEnabled(!isDisabled)
  }, [isDisabled, visible])

  // Capture unread IDs when modal opens, clear after 5s or on close
  useEffect(() => {
    if (visible && notifications.length > 0) {
      const unreadIds = new Set(notifications.filter((n) => !n.read).map((n) => n.id))
      setVisuallyUnreadIds(unreadIds)

      // Clear the visual highlight after 5 seconds
      unreadTimerRef.current = setTimeout(() => {
        setVisuallyUnreadIds(new Set())
      }, 5000)
    }

    if (!visible) {
      // Clear immediately when modal closes
      if (unreadTimerRef.current) {
        clearTimeout(unreadTimerRef.current)
        unreadTimerRef.current = null
      }
      setVisuallyUnreadIds(new Set())
    }

    return () => {
      if (unreadTimerRef.current) {
        clearTimeout(unreadTimerRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const handleToggleNotifications = async (value) => {
    setNotificationsEnabled(value)
    try {
      await firestore().collection('users').doc(userId).update({
        notificationsMuted: !value,
      })
      await refreshUserProfile()
    } catch (error) {
      console.log('🔴 Error toggling notifications:', error.message)
      setNotificationsEnabled(!value)
    }
  }

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="notifications-off-outline" size={48} color={colors.offline} />
      <Text style={styles.emptyText}>No notifications yet</Text>
    </View>
  )

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={26} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={{ width: 26 }} />
        </View>

        {/* Notification Toggle */}
        <View style={styles.toggleContainer}>
          <View style={styles.toggleLabelRow}>
            <Ionicons
              name={notificationsEnabled ? 'notifications-outline' : 'notifications-off-outline'}
              size={18}
              color={notificationsEnabled ? colors.primary : colors.offline}
            />
            <Text style={styles.toggleLabel}>
              {notificationsEnabled ? 'Notifications On' : 'Notifications Off'}
            </Text>
          </View>
          <CustomToggle value={notificationsEnabled} onValueChange={handleToggleNotifications} />
        </View>

        {/* Notification List */}
        <View style={styles.listContainer}>
          <FlatList
            data={notifications}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <NotificationItem
                item={item}
                userId={userId}
                showAsUnread={visuallyUnreadIds.has(item.id)}
                onPress={(target) => {
                  if (onNavigate) {
                    onClose()
                    setTimeout(() => onNavigate(target), 300)
                  }
                }}
              />
            )}
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={
              notifications.length === 0 ? styles.emptyList : styles.listContent
            }
            showsVerticalScrollIndicator={false}
          />
        </View>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  listContainer: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 12,
    backgroundColor: '#000000',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  toggleLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleLabel: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: '#ffffff',
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 20,
  },
  emptyList: {
    flex: 1,
  },

  // Notification Item
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 1,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  notificationUnread: {
    backgroundColor: 'rgba(26, 204, 10, 0.08)',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textDark,
    marginBottom: 2,
  },
  notificationBody: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.offline,
    lineHeight: 18,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 11,
    fontFamily: fonts.mono,
    color: colors.offline,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: 8,
  },

  // Delete Action (swipe right)
  deleteAction: {
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  deleteButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.offline,
    marginTop: 12,
  },
})

export default NotificationListModal
