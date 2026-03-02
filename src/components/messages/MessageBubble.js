// MessageBubble - Chat bubble component
// Lilac for sent messages, lime for received
// Supports special message types: group_invite, chatroom_invite
// Detects URLs: renders as tappable links with OpenGraph preview cards
// Long-press to add emoji reactions

import React, { useState, useMemo, useRef } from 'react'
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Modal,
  Dimensions,
  SafeAreaView,
  Animated,
  ScrollView,
  Pressable,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Swipeable } from 'react-native-gesture-handler'
import Autolink from 'react-native-autolink'
import { colors } from '../../theme'
import { fonts } from '../../theme/typography'
import { extractFirstUrl } from '../../utils/linkPreviewCache'
import LinkPreviewCard from './LinkPreviewCard'
import { STICKER_OPTIONS } from '../../config/stickers'

const MessageBubble = ({
  message,
  isCurrentUser,
  onJoinGroup,
  onJoinChatroom,
  onViewGroup,
  onReaction,
  onDelete,
  currentUserId,
}) => {
  const isGroupInvite = message.type === 'group_invite'
  const isChatroomInvite = message.type === 'chatroom_invite'
  const isInvite = isGroupInvite || isChatroomInvite

  const bubbleColor = isInvite
    ? colors.textSecondary
    : isCurrentUser
      ? colors.chatBubbleSent
      : colors.chatBubbleReceived
  const textColor = colors.textDark

  const [joining, setJoining] = useState(false)
  const [imageModalVisible, setImageModalVisible] = useState(false)
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const swipeableRef = useRef(null)

  // Render the X delete button revealed by swipe
  const renderDeleteAction = (progress, dragX) => {
    const scale = dragX.interpolate({
      inputRange: isCurrentUser ? [-80, 0] : [0, 80],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    })

    return (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => {
          swipeableRef.current?.close()
          if (onDelete) onDelete(message.id)
        }}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <Ionicons name="close-circle" size={28} color="#ffffff" />
        </Animated.View>
      </TouchableOpacity>
    )
  }

  // Memoize URL extraction to avoid re-computation on every render
  const firstUrl = useMemo(() => {
    if (isInvite || !message.text) return null
    return extractFirstUrl(message.text)
  }, [message.text, isInvite])

  // Parse reactions from message data
  const reactions = message.reactions || {}
  const reactionEntries = Object.entries(reactions).filter(([, users]) => users && users.length > 0)

  const handleJoinGroup = async () => {
    if (!onJoinGroup || !message.groupId) return
    setJoining(true)
    await onJoinGroup(message.groupId, message.groupName)
    setJoining(false)
  }

  const handleJoinChatroom = async () => {
    if (!onJoinChatroom || !message.roomId) return
    setJoining(true)
    await onJoinChatroom(message.roomId, message.roomName)
    setJoining(false)
  }

  const handleLongPress = () => {
    if (!isInvite) {
      setShowReactionPicker(true)
    }
  }

  const handleSelectReaction = (emoji) => {
    setShowReactionPicker(false)
    if (onReaction) {
      onReaction(message.id, emoji)
    }
  }

  const handleTapReaction = (emoji) => {
    if (onReaction) {
      onReaction(message.id, emoji)
    }
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={isCurrentUser ? renderDeleteAction : undefined}
      overshootRight={false}
      overshootLeft={false}
      friction={2}
    >
      <View
        style={[styles.container, isCurrentUser ? styles.containerRight : styles.containerLeft]}
      >
        {/* Avatar on left for received */}
        {!isCurrentUser && (
          <View style={styles.avatarContainer}>
            {message.senderPhoto ? (
              <Image source={{ uri: message.senderPhoto, cache: 'reload' }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={14} color="#666" />
              </View>
            )}
          </View>
        )}

        <View style={[styles.bubbleWrapper, firstUrl && styles.bubbleWrapperLink]}>
          {/* Emoji Reaction Picker — appears above bubble on long-press */}
          {showReactionPicker && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={[
                styles.reactionPickerScroll,
                isCurrentUser ? styles.reactionPickerRight : styles.reactionPickerLeft,
              ]}
              contentContainerStyle={styles.reactionPicker}
            >
              {STICKER_OPTIONS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.reactionPickerItem}
                  onPress={() => handleSelectReaction(emoji)}
                >
                  <Text style={styles.reactionPickerEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Image-only message — render outside bubble, no background */}
          {message.imageUrl && !message.text && !isInvite ? (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setImageModalVisible(true)}
              onLongPress={handleLongPress}
              delayLongPress={400}
            >
              <Image
                source={{ uri: message.imageUrl }}
                style={[
                  styles.chatImage,
                  message.imageWidth && message.imageHeight
                    ? { aspectRatio: message.imageWidth / message.imageHeight, height: undefined }
                    : null,
                ]}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ) : (
            /* Bubble — long-press to show reaction picker */
            <TouchableOpacity
              activeOpacity={0.9}
              onLongPress={handleLongPress}
              onPress={() => showReactionPicker && setShowReactionPicker(false)}
              delayLongPress={400}
              style={[
                styles.bubble,
                { backgroundColor: bubbleColor },
                isCurrentUser ? styles.bubbleRight : styles.bubbleLeft,
                isInvite && styles.inviteBubble,
                message.imageUrl && styles.imageBubble,
                firstUrl && styles.linkBubble,
              ]}
            >
              {isGroupInvite && (
                <View style={styles.inviteHeader}>
                  <Ionicons name="people" size={16} color={colors.textDark} />
                  <Text style={styles.inviteLabel}>Group Invitation</Text>
                </View>
              )}
              {isChatroomInvite && (
                <View style={styles.inviteHeader}>
                  <Ionicons name="chatbubbles" size={16} color={colors.textDark} />
                  <Text style={styles.inviteLabel}>Chatroom Invitation</Text>
                </View>
              )}
              {/* Image with text — stays inside bubble */}
              {message.imageUrl ? (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setImageModalVisible(true)}
                  onLongPress={handleLongPress}
                  delayLongPress={400}
                >
                  <Image
                    source={{ uri: message.imageUrl }}
                    style={[
                      styles.chatImage,
                      message.imageWidth && message.imageHeight
                        ? {
                            aspectRatio: message.imageWidth / message.imageHeight,
                            height: undefined,
                          }
                        : null,
                    ]}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ) : null}
              {/* Message text — Autolink detects and renders URLs as tappable links */}
              {message.text ? (
                <Autolink
                  text={message.text}
                  style={[styles.messageText, { color: textColor }]}
                  linkStyle={styles.linkText}
                  url
                  email
                  phone={false}
                  hashtag={false}
                  stripPrefix={false}
                  onPress={(url) => Linking.openURL(url)}
                />
              ) : null}
              {/* Link preview card — shown below text for messages containing a URL */}
              {firstUrl && <LinkPreviewCard url={firstUrl} />}
              {/* Show View Group and Join Group buttons for group invitations received */}
              {isGroupInvite && !isCurrentUser && (
                <View style={styles.inviteButtons}>
                  <TouchableOpacity
                    style={styles.viewGroupButton}
                    onPress={() => onViewGroup && message.groupId && onViewGroup(message.groupId)}
                  >
                    <Ionicons name="eye-outline" size={16} color="#000000" />
                    <Text style={styles.viewGroupButtonText}>View Group</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.joinButton, joining && styles.joinButtonDisabled]}
                    onPress={handleJoinGroup}
                    disabled={joining}
                  >
                    {joining ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <>
                        <Ionicons name="enter-outline" size={16} color="#ffffff" />
                        <Text style={styles.joinButtonText}>Join Group</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
              {/* Show Join Chat button only for chatroom invitations received */}
              {isChatroomInvite && !isCurrentUser && (
                <TouchableOpacity
                  style={[styles.joinButton, joining && styles.joinButtonDisabled]}
                  onPress={handleJoinChatroom}
                  disabled={joining}
                >
                  {joining ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons name="chatbubble-ellipses-outline" size={16} color="#ffffff" />
                      <Text style={styles.joinButtonText}>Join Chat</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
              {isInvite && isCurrentUser && (
                <Text style={styles.inviteSentLabel}>Invitation sent</Text>
              )}
            </TouchableOpacity>
          )}

          {/* Reaction Display — shown below bubble */}
          {reactionEntries.length > 0 && (
            <View
              style={[
                styles.reactionsRow,
                isCurrentUser ? styles.reactionsRowRight : styles.reactionsRowLeft,
              ]}
            >
              {reactionEntries.map(([emoji, users]) => {
                const isUserReacted = currentUserId && users.includes(currentUserId)
                return (
                  <TouchableOpacity
                    key={emoji}
                    style={[styles.reactionBadge, isUserReacted && styles.reactionBadgeActive]}
                    onPress={() => handleTapReaction(emoji)}
                  >
                    <Text style={styles.reactionBadgeEmoji}>{emoji}</Text>
                    {users.length > 1 && (
                      <Text style={styles.reactionBadgeCount}>{users.length}</Text>
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>
          )}
        </View>

        {/* Avatar on right for sent */}
        {isCurrentUser && (
          <View style={styles.avatarContainer}>
            {message.senderPhoto ? (
              <Image source={{ uri: message.senderPhoto, cache: 'reload' }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={14} color="#666" />
              </View>
            )}
          </View>
        )}

        {/* Fullscreen Image Modal */}
        {message.imageUrl && (
          <Modal
            visible={imageModalVisible}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setImageModalVisible(false)}
          >
            <Pressable
              style={styles.imageModalContainer}
              onPress={() => setImageModalVisible(false)}
            >
              <Image
                source={{ uri: message.imageUrl }}
                style={styles.imageModalFull}
                resizeMode="contain"
                pointerEvents="none"
              />
            </Pressable>
          </Modal>
        )}
      </View>
    </Swipeable>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 4,
    paddingHorizontal: 8,
  },
  containerRight: {
    justifyContent: 'flex-end',
  },
  containerLeft: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    marginHorizontal: 6,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#a3a3a3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleWrapper: {
    maxWidth: '65%',
  },
  bubbleWrapperLink: {
    maxWidth: '80%',
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleRight: {
    borderBottomRightRadius: 4,
  },
  bubbleLeft: {
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    lineHeight: 20,
  },
  linkText: {
    color: '#000000',
    textDecorationLine: 'underline',
    fontFamily: fonts.regular,
  },
  linkBubble: {
    maxWidth: '100%',
  },
  imageBubble: {
    maxWidth: '100%',
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 6,
  },
  chatImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: '#e0e0e0',
    maxHeight: 320,
  },

  // Swipe delete action
  deleteAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 60,
    paddingHorizontal: 12,
  },

  // Emoji Reaction Picker (appears above bubble on long-press)
  reactionPickerScroll: {
    maxWidth: '85%',
    marginBottom: 6,
    backgroundColor: '#000000',
    borderRadius: 20,
  },
  reactionPicker: {
    flexDirection: 'row',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  reactionPickerRight: {
    alignSelf: 'flex-end',
  },
  reactionPickerLeft: {
    alignSelf: 'flex-start',
  },
  reactionPickerItem: {
    paddingHorizontal: 5,
    paddingVertical: 4,
  },
  reactionPickerEmoji: {
    fontSize: 20,
  },

  // Reaction badges (shown below bubble)
  reactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 2,
    gap: 4,
  },
  reactionsRowRight: {
    justifyContent: 'flex-end',
  },
  reactionsRowLeft: {
    justifyContent: 'flex-start',
  },
  reactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  reactionBadgeActive: {},
  reactionBadgeEmoji: {
    fontSize: 14,
  },
  reactionBadgeCount: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: '#ffffff',
    marginLeft: 3,
  },

  // Fullscreen image modal
  imageModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalFull: {
    width: Dimensions.get('window').width - 32,
    height: Dimensions.get('window').height * 0.7,
  },

  // Group invite styles
  inviteBubble: {
    maxWidth: '100%',
    borderWidth: 1,
  },
  inviteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  inviteLabel: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.textDark,
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  inviteButtons: {
    flexDirection: 'column',
    marginTop: 10,
    gap: 6,
  },
  viewGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 5,
    borderWidth: 1,
    borderColor: '#000000',
  },
  viewGroupButtonText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: '#000000',
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 6,
  },
  joinButtonDisabled: {
    opacity: 0.6,
  },
  joinButtonText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: '#ffffff',
  },
  inviteSentLabel: {
    fontSize: 11,
    fontFamily: fonts.italic,
    color: colors.textDark,
    marginTop: 6,
  },
})

export default MessageBubble
