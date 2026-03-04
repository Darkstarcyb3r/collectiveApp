// ChatScreen - Individual private chat view
// Real-time messaging with message bubbles and input bar
// Only accessible for accepted conversations

import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  FlatList,
  Text,
  Image,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  Keyboard,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import * as ImagePicker from 'expo-image-picker'
import * as Haptics from 'expo-haptics'
import { playSwoosh, playClick } from '../../services/soundService'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../theme'
import { fonts } from '../../theme/typography'
import { useAuth } from '../../contexts/AuthContext'
import { firestore } from '../../config/firebase'
import {
  getOrCreateConversation,
  subscribeToMessages,
  sendMessage,
  markConversationAsRead,
  toggleReaction,
  deleteMessage,
} from '../../services/messageService'
import { joinGroup } from '../../services/groupService'
import { joinChatroom } from '../../services/everyoneService'
import MessageBubble from '../../components/messages/MessageBubble'
import TimestampSeparator from '../../components/messages/TimestampSeparator'
import ChatInput from '../../components/messages/ChatInput'
import { ConfirmModal } from '../../components/common'
import { setActiveScreen, clearActiveScreen } from '../../services/userService'
import { signedUpload } from '../../utils/cloudinaryUpload'
import { validateImageAsset } from '../../utils/imageValidation'

const ChatScreen = ({ route, navigation }) => {
  const {
    conversationId: passedConversationId,
    otherUserId,
    otherUserName,
    otherUserPhoto,
  } = route.params || {}

  const { user, userProfile } = useAuth()
  const insets = useSafeAreaInsets()
  const [conversationId, setConversationId] = useState(passedConversationId || null)
  const [messages, setMessages] = useState([])
  const [initReady, setInitReady] = useState(false)
  const clearedAtRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pendingImageUri, setPendingImageUri] = useState(null)
  const [pendingImageMeta, setPendingImageMeta] = useState(null)
  const [pendingImageDimensions, setPendingImageDimensions] = useState(null)
  const flatListRef = useRef(null)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [joinConfirm, setJoinConfirm] = useState({ visible: false, type: null, id: null, name: '' })
  const [deleteConfirm, setDeleteConfirm] = useState({ visible: false, messageId: null })
  const [_displayName, setDisplayName] = useState(otherUserName || '')
  const [displayPhoto, setDisplayPhoto] = useState(otherUserPhoto || null)

  // Track keyboard height and scroll to end when it opens
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height)
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true })
      }, 100)
    })
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0)
    })
    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  // Initialize conversation — only allow accepted conversations
  useEffect(() => {
    const initConversation = async () => {
      if (conversationId) {
        // Verify the conversation is accepted
        try {
          const convoDoc = await firestore().collection('conversations').doc(conversationId).get()
          if (convoDoc.exists) {
            const data = convoDoc.data()
            if (data.status === 'pending') {
              // Should not be here for a pending conversation
              Alert.alert('Pending', 'This chat request has not been accepted yet.')
              navigation.goBack()
              return
            }
            // Resolve the other user's ID — use param if available,
            // otherwise extract from the conversation's participants array
            let resolvedOtherUserId = otherUserId
            if (!resolvedOtherUserId && user?.uid && data.participants) {
              resolvedOtherUserId = data.participants.find((id) => id !== user.uid)
            }

            // Fetch LIVE profile from users collection (authoritative source)
            // Falls back to conversation's participantProfiles if user doc unavailable
            if (resolvedOtherUserId) {
              try {
                const otherUserDoc = await firestore().collection('users').doc(resolvedOtherUserId).get()
                if (otherUserDoc.exists) {
                  const liveProfile = otherUserDoc.data()
                  if (liveProfile.name) setDisplayName(liveProfile.name)
                  if (liveProfile.profilePhoto) setDisplayPhoto(liveProfile.profilePhoto)
                }
              } catch (_profileErr) {
                // Fallback to stale participantProfiles from conversation doc
                if (data.participantProfiles) {
                  const profile = data.participantProfiles[resolvedOtherUserId]
                  if (profile) {
                    if (!otherUserName && profile.name) setDisplayName(profile.name)
                    if (!otherUserPhoto && profile.profilePhoto) setDisplayPhoto(profile.profilePhoto)
                  }
                }
              }
            }
            // Check if user previously cleared this thread
            if (user?.uid) {
              const ts = data[`clearedAt_${user.uid}`]
              if (ts) clearedAtRef.current = ts.toDate()
            }
          }
        } catch (_e) {}
        setLoading(false)
        setInitReady(true)
        return
      }

      // Coming from somewhere without a conversationId — get or create accepted conversation
      if (otherUserId && user?.uid) {
        // Check if blocked in either direction
        const blockedUsers = userProfile?.blockedUsers || []
        const blockedBy = userProfile?.blockedBy || []
        if (blockedUsers.includes(otherUserId) || blockedBy.includes(otherUserId)) {
          Alert.alert('Unavailable', 'This conversation is unavailable.')
          navigation.goBack()
          return
        }

        const result = await getOrCreateConversation(user.uid, otherUserId, userProfile, {
          name: otherUserName,
          profilePhoto: otherUserPhoto,
        })

        if (result.success) {
          if (result.status === 'pending') {
            Alert.alert('Pending', 'This chat request has not been accepted yet.')
            navigation.goBack()
            return
          }
          // Check if user previously cleared this thread
          try {
            const convoDoc = await firestore().collection('conversations').doc(result.conversationId).get()
            if (convoDoc.exists) {
              const ts = convoDoc.data()?.[`clearedAt_${user.uid}`]
              if (ts) clearedAtRef.current = ts.toDate()
            }
          } catch (_e) {}
          // Fetch live profile if name/photo not provided via params
          if (!otherUserName || !otherUserPhoto) {
            try {
              const otherUserDoc = await firestore().collection('users').doc(otherUserId).get()
              if (otherUserDoc.exists) {
                const liveProfile = otherUserDoc.data()
                if (liveProfile.name && !otherUserName) setDisplayName(liveProfile.name)
                if (liveProfile.profilePhoto) setDisplayPhoto(liveProfile.profilePhoto)
              }
            } catch (_profileErr) {}
          }
          setConversationId(result.conversationId)
          setInitReady(true)
        } else {
          Alert.alert('Error', 'Could not start conversation.')
          navigation.goBack()
          return
        }
      }
      setLoading(false)
    }

    initConversation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Subscribe to messages once we have a conversationId AND init is complete
  useEffect(() => {
    if (!conversationId || !initReady) return

    // Mark as read when opening the chat
    if (user?.uid) {
      markConversationAsRead(conversationId, user.uid)
    }

    const unsubscribe = subscribeToMessages(conversationId, (newMessages) => {
      // Filter out messages from before the user cleared/deleted the thread
      const cleared = clearedAtRef.current
      const afterClear = cleared ? newMessages.filter((m) => m.createdAt > cleared) : newMessages
      // Filter out messages from blocked users
      const blocked = userProfile?.blockedUsers || []
      const by = userProfile?.blockedBy || []
      const excludedSenders = [...new Set([...blocked, ...by])]
      const visibleMessages = afterClear.filter((m) => !excludedSenders.includes(m.senderId))
      setMessages(visibleMessages)
      // Mark as read whenever new messages arrive while chat is open
      if (user?.uid) {
        markConversationAsRead(conversationId, user.uid)
      }
    })

    return () => unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, initReady])

  // Track active screen for notification suppression
  useEffect(() => {
    if (!conversationId || !user?.uid) return
    setActiveScreen(user.uid, 'conversation', conversationId)
    return () => {
      clearActiveScreen(user.uid)
    }
  }, [conversationId, user?.uid])

  const handleSend = async (text) => {
    if (!conversationId || !user?.uid || sending) return

    setSending(true)
    const result = await sendMessage(
      conversationId,
      user.uid,
      userProfile?.name || '',
      userProfile?.profilePhoto || null,
      text
    )
    setSending(false)

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      playSwoosh()
      // Scroll to bottom after sending (offset 0 in inverted list = bottom)
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true })
      }, 200)
    } else {
      Alert.alert('Error', 'Failed to send message. Please try again.')
    }
  }

  // Handle picking and uploading an image in private messages
  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant permission to access your photos.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    })

    if (!result.canceled && result.assets?.[0]?.uri) {
      const asset = result.assets[0]
      const validation = await validateImageAsset(asset)
      if (!validation.valid) {
        Alert.alert('Image Error', validation.error)
        return
      }
      // Show preview modal before sending
      setPendingImageUri(asset.uri)
      setPendingImageMeta({ fileSize: validation.fileSize, mimeType: validation.mimeType })
      setPendingImageDimensions({ width: asset.width, height: asset.height })
    }
  }

  const uploadAndSendImage = async (uri, dims) => {
    if (!conversationId || !user?.uid || uploading) return

    setUploading(true)
    try {
      const result = await signedUpload(
        uri,
        `collective/messages/${conversationId}`,
        `message_${conversationId}`,
        pendingImageMeta || {}
      )

      if (result.success) {
        await sendMessage(
          conversationId,
          user.uid,
          userProfile?.name || '',
          userProfile?.profilePhoto || null,
          '',
          result.url,
          dims
        )
      } else {
        Alert.alert('Upload Failed', result.error || 'Could not upload image. Please try again.')
      }
    } catch (error) {
      console.log('Image upload error:', error.message)
      Alert.alert('Upload Error', 'Something went wrong uploading your image.')
    }
    setUploading(false)
  }

  const handleConfirmSendImage = () => {
    playClick()
    if (pendingImageUri) {
      const dims = pendingImageDimensions
      const uri = pendingImageUri
      setPendingImageUri(null)
      setPendingImageDimensions(null)
      uploadAndSendImage(uri, dims)
    }
  }

  const handleCancelSendImage = () => {
    playClick()
    setPendingImageUri(null)
    setPendingImageDimensions(null)
  }

  // Handle viewing a group before joining
  const handleViewGroup = (groupId) => {
    navigation.navigate('GroupDetail', { groupId })
  }

  // Handle joining a group from an invitation message
  const handleJoinGroup = async (groupId, groupName) => {
    if (!user?.uid) return

    const result = await joinGroup(groupId, user.uid)
    if (result.success) {
      setJoinConfirm({ visible: true, type: 'group', id: groupId, name: groupName })
    } else {
      Alert.alert('Error', result.error || 'Could not join group.')
    }
  }

  // Handle joining a chatroom from an invitation message
  const handleJoinChatroom = async (roomId, roomName) => {
    if (!user?.uid) return

    const result = await joinChatroom(roomId, user.uid)
    if (result.success) {
      setJoinConfirm({ visible: true, type: 'chatroom', id: roomId, name: roomName })
    } else {
      Alert.alert('Error', result.error || 'Could not join chatroom.')
    }
  }

  // Handle emoji reaction on a message
  const handleReaction = async (messageId, emoji) => {
    if (!conversationId || !user?.uid) return
    await toggleReaction(conversationId, messageId, user.uid, emoji)
  }

  const handleDeleteMessage = async (messageId) => {
    if (!conversationId) return
    setDeleteConfirm({ visible: true, messageId })
  }

  // Determine if we should show a timestamp separator
  const shouldShowTimestamp = (currentMsg, prevMsg) => {
    if (!prevMsg) return true
    const curr =
      currentMsg.createdAt instanceof Date ? currentMsg.createdAt : new Date(currentMsg.createdAt)
    const prev = prevMsg.createdAt instanceof Date ? prevMsg.createdAt : new Date(prevMsg.createdAt)
    // Show separator if more than 30 minutes apart
    return curr - prev > 30 * 60 * 1000
  }

  // For inverted FlatList: data is reversed, so "previous" message is index+1
  const renderMessage = ({ item, index }) => {
    // In the inverted list, the original next message is at index-1
    // and the original previous message is at index+1
    const originalIndex = messages.length - 1 - index
    const prevMessage = originalIndex > 0 ? messages[originalIndex - 1] : null
    const showTimestamp = shouldShowTimestamp(messages[originalIndex], prevMessage)

    return (
      <View>
        {showTimestamp && <TimestampSeparator timestamp={item.createdAt} />}
        <MessageBubble
          message={item}
          isCurrentUser={item.senderId === user?.uid}
          onJoinGroup={handleJoinGroup}
          onJoinChatroom={handleJoinChatroom}
          onViewGroup={handleViewGroup}
          onReaction={handleReaction}
          onDelete={handleDeleteMessage}
          currentUserId={user?.uid}
        />
      </View>
    )
  }

  // Reversed copy for inverted FlatList (newest first)
  const invertedMessages = [...messages].reverse()

  return (
    <View
      style={[
        styles.safeArea,
        {
          paddingTop: insets.top,
          paddingBottom: keyboardHeight > 0 ? keyboardHeight : insets.bottom,
        },
      ]}
    >
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Main Container */}
      <View style={[styles.mainContainer, keyboardHeight > 0 && styles.mainContainerKeyboard]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={28} color={colors.textGreen} />
          </TouchableOpacity>
          <Text style={styles.title}>Messages</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Other User Avatar — tappable, links to their profile */}
        <TouchableOpacity
          style={styles.avatarSection}
          onPress={() => {
            if (otherUserId) {
              navigation.navigate('UserProfile', { userId: otherUserId })
            }
          }}
        >
          {displayPhoto ? (
            <Image source={{ uri: displayPhoto, cache: 'reload' }} style={styles.otherAvatar} />
          ) : (
            <View style={styles.otherAvatarPlaceholder}>
              <Ionicons name="person" size={30} color="#666" />
            </View>
          )}
        </TouchableOpacity>

        {/* Messages List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={invertedMessages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            inverted
            style={styles.messageList}
            contentContainerStyle={styles.messageListContentInverted}
            keyboardShouldPersistTaps="handled"
          />
        )}

        {/* Input Bar */}
        <ChatInput
          onSend={handleSend}
          onPickImage={handlePickImage}
          disabled={!conversationId || loading || sending}
          uploading={uploading}
        />
      </View>

      {/* Join Success Confirm Modal */}
      <ConfirmModal
        visible={joinConfirm.visible}
        icon={joinConfirm.type === 'group' ? 'people-outline' : 'chatbubble-ellipses-outline'}
        iconColor={colors.primary}
        title="Joined!"
        message={`You've joined "${joinConfirm.name}"!`}
        confirmText={joinConfirm.type === 'group' ? 'View Group' : 'Go to Chat'}
        cancelText="Stay Here"
        onConfirm={() => {
          setJoinConfirm({ visible: false, type: null, id: null, name: '' })
          if (joinConfirm.type === 'group') {
            navigation.navigate('GroupDetail', { groupId: joinConfirm.id })
          } else {
            navigation.navigate('CyberLoungeDetail', { roomId: joinConfirm.id })
          }
        }}
        onCancel={() => setJoinConfirm({ visible: false, type: null, id: null, name: '' })}
      />

      {/* Delete Message Confirm Modal */}
      <ConfirmModal
        visible={deleteConfirm.visible}
        title="Delete Message"
        message="This message will be permanently deleted for both you and the other person."
        confirmText="Delete"
        onConfirm={async () => {
          const msgId = deleteConfirm.messageId
          setDeleteConfirm({ visible: false, messageId: null })
          await deleteMessage(conversationId, msgId)
        }}
        onCancel={() => setDeleteConfirm({ visible: false, messageId: null })}
      />

      {/* Image Preview Modal */}
      <Modal
        visible={!!pendingImageUri}
        transparent
        animationType="fade"
        onRequestClose={handleCancelSendImage}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={handleCancelSendImage}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            <Text style={styles.modalTitle}>Send Photo</Text>
            {pendingImageUri && (
              <Image
                source={{ uri: pendingImageUri }}
                style={styles.previewImage}
                resizeMode="cover"
              />
            )}
            <Text style={styles.modalSubtext}>Send this image?</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={handleCancelSendImage}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSendButtonOuter} onPress={handleConfirmSendImage}>
                <LinearGradient
                  colors={['#d8f434', '#b3f425', '#93f478']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalSendButton}
                >
                  <LinearGradient
                    colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']}
                    style={styles.modalSendButtonHighlight}
                  />
                  <Ionicons name="send" size={16} color={colors.textDark} />
                  <Text style={styles.modalSendText}>Send</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mainContainer: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary,
    margin: 10,
    overflow: 'hidden',
  },
  mainContainerKeyboard: {
    marginBottom: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    marginLeft: 0,
    marginTop: 10,
  },
  title: {
    fontSize: 20,
    fontFamily: fonts.regular,
    color: colors.primary,
    textAlign: 'center',
  },
  avatarSection: {
    alignItems: 'center',
    paddingBottom: 16,
    marginTop: -12,
  },
  otherAvatar: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
  },
  otherAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#a3a3a3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageList: {
    flex: 1,
  },
  messageListContentInverted: {
    paddingTop: 12,
    paddingBottom: 8,
  },

  // Image Preview Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: colors.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.secondary,
    marginBottom: 14,
  },
  previewImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    backgroundColor: '#e0e0e0',
    marginBottom: 10,
  },
  modalSubtext: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  modalSendButtonOuter: {
    flex: 1,
    borderRadius: 16,
    shadowColor: '#b3f425',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  modalSendButton: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
    borderLeftColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    borderRightColor: 'rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
  },
  modalSendButtonHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  modalSendText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textDark,
  },
})

export default ChatScreen
