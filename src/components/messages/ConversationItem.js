// ConversationItem - Row in conversation list
// Shows avatar, message preview in lime bubble, green chevron
// Unread indicator (green dot) when there are new messages
// Swipe left to delete conversation (dark-themed confirm modal)

import React, { useRef, useState } from 'react'
import { View, Text, Image, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Swipeable } from 'react-native-gesture-handler'
import { colors } from '../../theme'
import { fonts } from '../../theme/typography'
import { ConfirmModal } from '../common'

const ConversationItem = ({ conversation, currentUserId, onPress, onDelete, isRequest }) => {
  // Get the other participant's profile
  const otherUserId = conversation.participants?.find((id) => id !== currentUserId)
  const otherProfile = conversation.participantProfiles?.[otherUserId] || {}
  const lastMessageText = conversation.lastMessage?.text || ''
  const lastMessageSenderId = conversation.lastMessage?.senderId
  const isLastMessageFromMe = lastMessageSenderId === currentUserId
  const swipeableRef = useRef(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Check if this conversation has unread messages for the current user
  const isUnread = conversation[`unread_${currentUserId}`] === true

  // Truncate preview text
  const previewText =
    lastMessageText.length > 50 ? lastMessageText.substring(0, 50) + '...' : lastMessageText

  const handleDeletePress = () => {
    swipeableRef.current?.close()
    setShowDeleteConfirm(true)
  }

  const renderDeleteAction = (progress, dragX) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    })

    return (
      <TouchableOpacity style={styles.deleteAction} onPress={handleDeletePress}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <Ionicons name="close-circle" size={32} color="#ffffff" />
        </Animated.View>
      </TouchableOpacity>
    )
  }

  return (
    <>
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderDeleteAction}
        overshootRight={false}
        friction={2}
      >
        <TouchableOpacity
          style={styles.container}
          onPress={() => onPress(conversation, otherUserId, otherProfile)}
        >
          {/* Avatar with unread dot */}
          <View style={styles.avatarContainer}>
            {otherProfile.profilePhoto ? (
              <Image
                source={{ uri: otherProfile.profilePhoto, cache: 'reload' }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={24} color={colors.textSecondary} />
              </View>
            )}
            {isUnread && <View style={styles.unreadDot} />}
          </View>

          {/* Message Preview Bubble */}
          <View
            style={[
              styles.previewBubble,
              isRequest && styles.previewBubbleRequest,
              isLastMessageFromMe && styles.previewBubbleFromMe,
            ]}
          >
            <View style={styles.nameRow}>
              <Text style={[styles.nameText, isUnread && styles.nameTextUnread]} numberOfLines={1}>
                {otherProfile.name || 'Unknown'}
              </Text>
              {isRequest && (
                <View style={styles.requestBadge}>
                  <Text style={styles.requestBadgeText}>request</Text>
                </View>
              )}
            </View>
            {previewText ? (
              <Text
                style={[styles.previewText, isUnread && styles.previewTextUnread]}
                numberOfLines={2}
              >
                {previewText}
              </Text>
            ) : (
              <Text style={styles.previewTextEmpty}>
                {isRequest ? 'Wants to message you' : 'No messages yet'}
              </Text>
            )}
          </View>

          {/* Chevron */}
          <Ionicons name="chevron-forward" size={24} color={colors.primary} />
        </TouchableOpacity>
      </Swipeable>

      {/* Delete Confirmation Modal — dark themed, matches individual message delete */}
      <ConfirmModal
        visible={showDeleteConfirm}
        title="Delete Conversation"
        message={`Remove your chat with ${otherProfile.name || 'this user'}? This will only remove it from your message list.`}
        confirmText="Delete"
        onConfirm={() => {
          setShowDeleteConfirm(false)
          if (onDelete) {
            onDelete(conversation.id)
          }
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  )
}

const styles = StyleSheet.create({
  deleteAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 70,
    paddingHorizontal: 16,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: colors.background,
  },
  avatarContainer: {
    marginRight: 12,
    position: 'relative',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.backgroundCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.background,
  },
  previewBubble: {
    flex: 1,
    backgroundColor: colors.secondary,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 8,
  },
  previewBubbleRequest: {
    backgroundColor: colors.lilac,
  },
  previewBubbleFromMe: {
    backgroundColor: colors.chatBubbleSent,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  requestBadge: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  requestBadgeText: {
    color: colors.textDark,
    fontSize: 9,
    fontFamily: fonts.bold,
    textTransform: 'uppercase',
  },
  nameText: {
    color: colors.textDark,
    fontSize: 12,
    fontFamily: fonts.medium,
    flex: 1,
  },
  nameTextUnread: {
    fontFamily: fonts.bold,
  },
  previewText: {
    color: colors.textDark,
    fontSize: 13,
    fontFamily: fonts.regular,
    lineHeight: 18,
  },
  previewTextUnread: {
    fontFamily: fonts.medium,
  },
  previewTextEmpty: {
    color: '#666666',
    fontSize: 13,
    fontFamily: fonts.italic,
  },
})

export default ConversationItem
