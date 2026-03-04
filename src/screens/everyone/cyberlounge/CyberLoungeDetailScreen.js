// Cyber Lounge Detail Screen
// Live chatroom with countdown timer, messages, host controls
// Room auto-closes when timer hits 0 or host ends chat
// Participant counter x/50
// + button opens photo picker for image messages via Cloudinary
// Background music: host picks a vibe, plays looped audio for all participants

import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
  ScrollView,
  Linking,
  AppState,
  ImageBackground,
  Animated,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import { Swipeable } from 'react-native-gesture-handler'
import * as ImagePicker from 'expo-image-picker'
import * as Haptics from 'expo-haptics'
import { playSwoosh } from '../../../services/soundService'
import { Audio } from 'expo-av'
import Autolink from 'react-native-autolink'
import { colors } from '../../../theme'
import { fonts } from '../../../theme/typography'
import { useAuth } from '../../../contexts/AuthContext'
import ChatInput from '../../../components/messages/ChatInput'
import { extractFirstUrl } from '../../../utils/linkPreviewCache'
import LinkPreviewCard from '../../../components/messages/LinkPreviewCard'
import { VIBES, getVibeById } from '../../../config/vibes'
import { STICKER_OPTIONS, MAX_STICKERS } from '../../../config/stickers'
import { BACKGROUNDS, getBackgroundById } from '../../../config/backgrounds'
import {
  subscribeToChatroom,
  subscribeToChatroomMessages,
  sendChatroomMessage,
  joinChatroom,
  endChatroom,
  deleteChatroom,
  sendHeartbeat,
  updateRoomVibe,
  updateRoomStickers,
  updateRoomBackground,
  toggleChatroomReaction,
  deleteChatroomMessage,
} from '../../../services/everyoneService'
import { getMemberProfiles } from '../../../services/groupService'
import { setActiveScreen, clearActiveScreen } from '../../../services/userService'
import { signedUpload } from '../../../utils/cloudinaryUpload'
import { validateImageAsset } from '../../../utils/imageValidation'
import { ConfirmModal } from '../../../components/common'

const MAX_PARTICIPANTS = 50

const CyberLoungeDetailScreen = ({ route, navigation }) => {
  const { roomId } = route.params
  const { user, userProfile } = useAuth()
  const [room, setRoom] = useState(null)
  const [messages, setMessages] = useState([])
  const [countdown, setCountdown] = useState('')
  const [participantProfiles, setParticipantProfiles] = useState([])
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pendingImageUri, setPendingImageUri] = useState(null)
  const [pendingImageMeta, setPendingImageMeta] = useState(null)
  const [pendingImageDimensions, setPendingImageDimensions] = useState(null)
  const flatListRef = useRef(null)
  const timerRef = useRef(null)
  const [endChatConfirm, setEndChatConfirm] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [vibePickerVisible, setVibePickerVisible] = useState(false)
  const [stickerPickerVisible, setStickerPickerVisible] = useState(false)
  const [backgroundPickerVisible, setBackgroundPickerVisible] = useState(false)
  const [playbackPosition, setPlaybackPosition] = useState(0)
  const [playbackDuration, setPlaybackDuration] = useState(0)
  const soundRef = useRef(null)
  const seekBarWidth = useRef(0)
  const mountedRef = useRef(true)
  const endingRef = useRef(false)
  const heartbeatRef = useRef(null)
  const appStateRef = useRef(AppState.currentState)
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null) // messageId to confirm delete
  const [viewImageUrl, setViewImageUrl] = useState(null)

  // Track mounted state to prevent stale navigation calls
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Subscribe to room data
  useEffect(() => {
    const unsubscribe = subscribeToChatroom(roomId, (roomData) => {
      if (!mountedRef.current || endingRef.current) return

      if (!roomData || !roomData.isActive) {
        // Room was closed/deleted — navigate home
        endingRef.current = true
        Alert.alert('Room Closed', 'This chatroom has ended.')
        navigation.navigate('MainTabs', { screen: 'HomeTab' })
        return
      }
      setRoom(roomData)
    })
    return () => unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  // Join room on mount (no auto-leave on unmount — room stays open)
  useEffect(() => {
    if (user?.uid) {
      joinChatroom(roomId, user.uid).then((result) => {
        if (!mountedRef.current || endingRef.current) return
        if (!result.success) {
          // Room doesn't exist — navigate home instead of goBack
          endingRef.current = true
          Alert.alert('Room Closed', result.error || 'This chatroom no longer exists.')
          navigation.navigate('MainTabs', { screen: 'HomeTab' })
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user?.uid])

  // Track active screen for notification suppression
  useEffect(() => {
    if (!roomId || !user?.uid) return
    setActiveScreen(user.uid, 'cyberlounge', roomId)
    return () => {
      clearActiveScreen(user.uid)
    }
  }, [roomId, user?.uid])

  // 5-minute heartbeat to track active presence
  useEffect(() => {
    if (!roomId || !user?.uid) return

    // Send initial heartbeat
    sendHeartbeat(roomId, user.uid)

    // Send heartbeat every 5 minutes
    heartbeatRef.current = setInterval(
      () => {
        sendHeartbeat(roomId, user.uid)
      },
      5 * 60 * 1000
    )

    // Pause heartbeat when app backgrounds, resume on foreground
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // Returning to foreground — send heartbeat immediately + restart interval
        sendHeartbeat(roomId, user.uid)
        if (heartbeatRef.current) clearInterval(heartbeatRef.current)
        heartbeatRef.current = setInterval(
          () => {
            sendHeartbeat(roomId, user.uid)
          },
          5 * 60 * 1000
        )
      } else if (nextAppState.match(/inactive|background/)) {
        // Going to background — stop heartbeat (will be pruned after 5 min)
        if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      }
      appStateRef.current = nextAppState
    })

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      subscription.remove()
    }
  }, [roomId, user?.uid])

  // Fetch participant profiles when participants change (max 4 avatars)
  useEffect(() => {
    const participants = room?.participants || []
    if (participants.length === 0) {
      setParticipantProfiles([])
      return
    }
    const fetchProfiles = async () => {
      const result = await getMemberProfiles(participants, 5)
      if (result.success && mountedRef.current) {
        setParticipantProfiles(result.data)
      }
    }
    fetchProfiles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(room?.participants)])

  // Subscribe to messages — filter hidden/blocked users
  useEffect(() => {
    const unsubscribe = subscribeToChatroomMessages(roomId, (msgs) => {
      if (mountedRef.current) {
        const hiddenUsers = userProfile?.hiddenUsers || []
        const blockedUsers = userProfile?.blockedUsers || []
        const blockedBy = userProfile?.blockedBy || []
        const excludedUsers = [...new Set([...hiddenUsers, ...blockedUsers, ...blockedBy])]
        const filtered = msgs.filter((m) => !excludedUsers.includes(m.senderId))
        setMessages(filtered)
      }
    })
    return () => unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  // Countdown timer
  useEffect(() => {
    if (!room?.expiresAt) return

    const updateCountdown = () => {
      const now = new Date()
      // Handle both Firestore Timestamp and plain Date
      let expires
      if (room.expiresAt.toDate && typeof room.expiresAt.toDate === 'function') {
        expires = room.expiresAt.toDate()
      } else if (room.expiresAt instanceof Date) {
        expires = room.expiresAt
      } else if (room.expiresAt.seconds) {
        expires = new Date(room.expiresAt.seconds * 1000)
      } else {
        expires = new Date(room.expiresAt)
      }

      const diff = expires - now

      if (diff <= 0) {
        setCountdown('0:00:00')
        // Auto-delete expired room (any user triggers)
        if (mountedRef.current) {
          endingRef.current = true
          deleteChatroom(roomId)
        }
        return
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      setCountdown(
        `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      )
    }

    updateCountdown()
    timerRef.current = setInterval(updateCountdown, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.expiresAt])

  // Audio playback — load and loop the selected vibe track
  // Re-fires whenever the room's vibe changes (real-time via Firestore listener)
  useEffect(() => {
    let cancelled = false
    const currentVibe = room?.vibe

    const loadAndPlay = async () => {
      // Ensure audio mode is set BEFORE creating any sound
      // (prevents race condition where createAsync runs before audio category is configured)
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          allowsRecordingIOS: false,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        })
      } catch (err) {
        console.log('Audio mode error:', err.message)
      }

      if (cancelled) return

      // Unload any existing sound first
      if (soundRef.current) {
        try {
          await soundRef.current.unloadAsync()
        } catch (e) {
          console.log('Audio unload warning:', e.message)
        }
        soundRef.current = null
      }

      const vibe = getVibeById(currentVibe)
      if (!vibe || !vibe.source) {
        // "No Music" selected or invalid vibe — reset playback state
        setPlaybackPosition(0)
        setPlaybackDuration(0)
        return
      }

      if (cancelled) return

      try {
        console.log('Audio: loading vibe', currentVibe)
        const { sound } = await Audio.Sound.createAsync(vibe.source, {
          isLooping: true,
          volume: isMuted ? 0 : 0.5,
          shouldPlay: true,
        })

        if (cancelled) {
          await sound.unloadAsync()
          return
        }

        soundRef.current = sound

        // Track playback position for the seek bar
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && !cancelled) {
            setPlaybackPosition(status.positionMillis || 0)
            setPlaybackDuration(status.durationMillis || 0)
          }
        })

        // Verify playback actually started; if not, force play
        const status = await sound.getStatusAsync()
        console.log('Audio: status after create', status.isLoaded, status.isPlaying)
        if (status.isLoaded && !status.isPlaying && !cancelled) {
          console.log('Audio: forcing playAsync')
          await sound.playAsync()
        }
      } catch (error) {
        console.log('Audio load error:', error.message)
        // Retry once after a short delay
        if (!cancelled) {
          setTimeout(async () => {
            if (cancelled) return
            try {
              // Re-set audio mode before retry
              await Audio.setAudioModeAsync({
                playsInSilentModeIOS: true,
                allowsRecordingIOS: false,
                staysActiveInBackground: false,
                shouldDuckAndroid: true,
              })
              const vibe2 = getVibeById(currentVibe)
              if (!vibe2?.source) return
              console.log('Audio: retrying vibe', currentVibe)
              const { sound } = await Audio.Sound.createAsync(vibe2.source, {
                isLooping: true,
                volume: isMuted ? 0 : 0.5,
                shouldPlay: true,
              })
              if (cancelled) {
                await sound.unloadAsync()
                return
              }
              soundRef.current = sound
              sound.setOnPlaybackStatusUpdate((s) => {
                if (s.isLoaded && !cancelled) {
                  setPlaybackPosition(s.positionMillis || 0)
                  setPlaybackDuration(s.durationMillis || 0)
                }
              })
              // Force play on retry too
              const retryStatus = await sound.getStatusAsync()
              if (retryStatus.isLoaded && !retryStatus.isPlaying && !cancelled) {
                await sound.playAsync()
              }
            } catch (retryErr) {
              console.log('Audio retry failed:', retryErr.message)
            }
          }, 500)
        }
      }
    }

    if (currentVibe && currentVibe !== 'none') {
      loadAndPlay()
    } else {
      // No music — clean up any existing audio
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {})
        soundRef.current = null
      }
      setPlaybackPosition(0)
      setPlaybackDuration(0)
    }

    return () => {
      cancelled = true
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {})
        soundRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.vibe])

  // Sync mute state to the active sound
  useEffect(() => {
    if (soundRef.current) {
      soundRef.current.setVolumeAsync(isMuted ? 0 : 0.5)
    }
  }, [isMuted])

  // Format milliseconds to m:ss
  const formatTime = (millis) => {
    if (!millis || millis <= 0) return '0:00'
    const totalSec = Math.floor(millis / 1000)
    const min = Math.floor(totalSec / 60)
    const sec = totalSec % 60
    return `${min}:${sec.toString().padStart(2, '0')}`
  }

  // Host seek — tap on the seek bar to jump to that position
  const handleSeek = async (evt) => {
    if (!soundRef.current || !playbackDuration) return
    const x = evt.nativeEvent.locationX
    const ratio = Math.max(0, Math.min(1, x / seekBarWidth.current))
    const positionMillis = Math.floor(ratio * playbackDuration)
    await soundRef.current.setPositionAsync(positionMillis)
  }

  // Toggle a sticker on/off and save to Firestore
  const toggleSticker = async (emoji) => {
    const current = room?.stickers || []
    let updated
    if (current.includes(emoji)) {
      updated = current.filter((s) => s !== emoji)
    } else {
      if (current.length >= MAX_STICKERS) return
      updated = [...current, emoji]
    }
    await updateRoomStickers(roomId, updated)
  }

  const handleSend = async (text) => {
    if (!text || !user?.uid || sending) return

    setSending(true)
    await sendChatroomMessage(
      roomId,
      user.uid,
      userProfile?.name || '',
      userProfile?.profilePhoto || null,
      text
    )
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    playSwoosh()
    setSending(false)
  }

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
    if (!user?.uid || uploading) return

    setUploading(true)
    try {
      const result = await signedUpload(
        uri,
        `collective/cyberlounge/${roomId}`,
        `chatroom_${roomId}`,
        pendingImageMeta || {}
      )

      if (result.success) {
        await sendChatroomMessage(
          roomId,
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
    if (pendingImageUri) {
      // Capture dimensions before clearing state — upload is async
      const dims = pendingImageDimensions
      const uri = pendingImageUri
      setPendingImageUri(null)
      setPendingImageDimensions(null)
      uploadAndSendImage(uri, dims)
    }
  }

  const handleCancelSendImage = () => {
    setPendingImageUri(null)
    setPendingImageDimensions(null)
  }

  const handleLongPressMessage = (messageId) => {
    setReactionPickerMessageId(messageId)
  }

  const handleSelectReaction = (emoji) => {
    const msgId = reactionPickerMessageId
    setReactionPickerMessageId(null)
    if (msgId && user?.uid) {
      toggleChatroomReaction(roomId, msgId, user.uid, emoji)
    }
  }

  const handleTapReaction = (messageId, emoji) => {
    if (user?.uid) {
      toggleChatroomReaction(roomId, messageId, user.uid, emoji)
    }
  }

  const handleEndChat = () => {
    setEndChatConfirm(true)
  }

  const handleConfirmEndChat = async () => {
    setEndChatConfirm(false)
    endingRef.current = true
    await endChatroom(roomId, user.uid)
    navigation.navigate('MainTabs', { screen: 'HomeTab' })
  }

  const handleAddMembers = () => {
    navigation.navigate('CyberLoungeInvite', { roomId, roomName: room?.name || 'Chatroom' })
  }

  const isHost = room?.hostId === user?.uid
  const roomBackground = getBackgroundById(room?.background)
  const hasBackground = roomBackground.source !== null
  const participantCount = room?.participantCount || room?.participants?.length || 0

  // Handle chatroom message delete (sender or host)
  const handleDeleteMessage = async () => {
    if (!deleteConfirm) return
    await deleteChatroomMessage(roomId, deleteConfirm)
    setDeleteConfirm(null)
  }

  const renderMessage = ({ item }) => {
    const messageUrl = item.text ? extractFirstUrl(item.text) : null
    const reactions = item.reactions || {}
    const reactionEntries = Object.entries(reactions).filter(
      ([, users]) => users && users.length > 0
    )
    const showPicker = reactionPickerMessageId === item.id
    const isOwnMessage = item.senderId === user?.uid

    // Swipe-to-delete action (matches MessageBubble style)
    const renderDeleteAction = (progress, dragX) => {
      const scale = dragX.interpolate({
        inputRange: [-80, 0],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      })
      return (
        <TouchableOpacity style={styles.deleteAction} onPress={() => setDeleteConfirm(item.id)}>
          <Animated.View style={{ transform: [{ scale }] }}>
            <Ionicons name="close-circle" size={28} color="#ffffff" />
          </Animated.View>
        </TouchableOpacity>
      )
    }

    const messageContent = (
      <View style={styles.messageBubble}>
        <TouchableOpacity
          style={styles.messageAvatar}
          onPress={() =>
            item.senderId && navigation.navigate('UserProfile', { userId: item.senderId })
          }
          activeOpacity={0.7}
        >
          {item.senderPhoto ? (
            <Image source={{ uri: item.senderPhoto, cache: 'reload' }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={14} color="#666" />
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.messageContent}>
          {/* Reaction Picker — appears above message on long-press */}
          {showPicker && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.reactionPickerScroll}
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
          <TouchableOpacity
            activeOpacity={0.8}
            onLongPress={() => handleLongPressMessage(item.id)}
            onPress={() => showPicker && setReactionPickerMessageId(null)}
            delayLongPress={400}
          >
            {item.imageUrl ? (
              <TouchableOpacity activeOpacity={0.9} onPress={() => setViewImageUrl(item.imageUrl)}>
                <Image
                  source={{ uri: item.imageUrl }}
                  style={[
                    styles.chatImage,
                    item.imageWidth && item.imageHeight
                      ? { aspectRatio: item.imageWidth / item.imageHeight, height: undefined }
                      : null,
                  ]}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ) : null}
            {item.text ? (
              <BlurView intensity={40} tint="dark" style={styles.messageBubbleInner}>
                <Autolink
                  text={item.text}
                  style={styles.messageText}
                  linkStyle={styles.linkText}
                  url
                  email
                  phone={false}
                  hashtag={false}
                  stripPrefix={false}
                  onPress={(url) => Linking.openURL(url)}
                />
              </BlurView>
            ) : null}
          </TouchableOpacity>
          {messageUrl && (
            <BlurView intensity={40} tint="dark" style={styles.messageBubbleInner}>
              <LinkPreviewCard url={messageUrl} />
            </BlurView>
          )}
          {/* Reaction Badges — shown below message */}
          {reactionEntries.length > 0 && (
            <View style={styles.reactionsRow}>
              {reactionEntries.map(([emoji, users]) => {
                const isUserReacted = user?.uid && users.includes(user.uid)
                return (
                  <TouchableOpacity
                    key={emoji}
                    style={[styles.reactionBadge, isUserReacted && styles.reactionBadgeActive]}
                    onPress={() => handleTapReaction(item.id, emoji)}
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
      </View>
    )

    // Wrap own messages in Swipeable for delete; others render plain
    if (isOwnMessage) {
      return (
        <Swipeable renderRightActions={renderDeleteAction} overshootRight={false} friction={2}>
          {messageContent}
        </Swipeable>
      )
    }

    return messageContent
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'position' : 'height'}
        style={{ flex: 1 }}
        contentContainerStyle={{ flex: 1 }}
      >
        <View style={styles.mainContainer}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ padding: 4 }}
            >
              <Ionicons name="chevron-back" size={24} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.title} numberOfLines={1}>
              {room?.name || 'Chatroom'}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Participant Counter */}
          <Text style={styles.participantCount}>
            {participantCount}/{MAX_PARTICIPANTS} participants
          </Text>

          {/* Host Info Row */}
          <View style={styles.hostRow}>
            <TouchableOpacity
              style={styles.hostTouchable}
              onPress={() =>
                room?.hostId && navigation.navigate('UserProfile', { userId: room.hostId })
              }
            >
              <View style={styles.hostAvatar}>
                {room?.hostPhoto ? (
                  <Image
                    source={{ uri: room.hostPhoto, cache: 'reload' }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={16} color="#666" />
                  </View>
                )}
              </View>
              <View style={styles.hostInfo}>
                <Text style={styles.hostName}>{room?.hostName || 'Host'}</Text>
                <Text style={styles.hostLabel}>Host</Text>
              </View>
            </TouchableOpacity>

            {/* Right side: avatars + share + members */}
            <View style={styles.hostRowActions}>
              {/* Participant Avatar Banner */}
              <View style={styles.participantAvatarBanner}>
                {participantProfiles.slice(0, 5).map((p, idx) => (
                  <View
                    key={p.id}
                    style={[styles.participantAvatarWrapper, { marginLeft: idx > 0 ? -8 : 0 }]}
                  >
                    {p.profilePhoto ? (
                      <Image
                        source={{ uri: p.profilePhoto, cache: 'reload' }}
                        style={styles.participantAvatar}
                      />
                    ) : (
                      <View style={styles.participantAvatarPlaceholder}>
                        <Ionicons name="person" size={10} color="#666" />
                      </View>
                    )}
                  </View>
                ))}
                {participantCount > 5 && (
                  <View style={[styles.participantAvatarPlaceholder, { marginLeft: -8 }]}>
                    <Text style={styles.participantCountText}>+{participantCount - 5}</Text>
                  </View>
                )}
              </View>

              {/* + Members Button */}
              <TouchableOpacity style={styles.addMemberButtonShadow} onPress={handleAddMembers}>
                <LinearGradient colors={['#cafb6c', '#71f200', '#23ff0d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.addMemberButton}>
                  <LinearGradient colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']} style={styles.addMemberButtonHighlight} />
                  <Ionicons name="add" size={16} color={colors.textDark} />
                  <Text style={styles.addMemberText}>Active Members</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* Sticker Display */}
          <TouchableOpacity
            style={styles.stickerRow}
            onPress={isHost ? () => setStickerPickerVisible(true) : undefined}
            activeOpacity={isHost ? 0.7 : 1}
            disabled={!isHost}
          >
            {(room?.stickers || []).length > 0 ? (
              room.stickers.map((emoji, idx) => (
                <Text key={idx} style={styles.stickerEmoji}>
                  {emoji}
                </Text>
              ))
            ) : isHost ? (
              <Text style={styles.stickerPlaceholder}>+ stickers</Text>
            ) : null}
          </TouchableOpacity>

          {/* End Chat (host only) */}
          {isHost && (
            <TouchableOpacity style={styles.endChatButton} onPress={handleEndChat}>
              <Text style={styles.endChatText}>end chat</Text>
            </TouchableOpacity>
          )}

          {/* Countdown */}
          <Text style={styles.countdown}>Room countdown: {countdown}</Text>

          {/* Audio Controls */}
          {/* Audio Controls + Vibe Dropdown */}
          <View style={styles.vibeDropdownWrapper}>
            {room?.vibe && room.vibe !== 'none' && (
              <View style={styles.audioSection}>
                <View style={styles.audioControlRow}>
                  <Ionicons name="musical-notes" size={14} color={colors.primary} />
                  <Text style={styles.vibeNameText} numberOfLines={1}>
                    {getVibeById(room.vibe).label}
                  </Text>
                  {isHost && (
                    <TouchableOpacity
                      onPress={() => setVibePickerVisible(!vibePickerVisible)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.changeVibeText}>change</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => setIsMuted(!isMuted)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name={isMuted ? 'volume-mute' : 'volume-high'}
                      size={18}
                      color={colors.primary}
                    />
                  </TouchableOpacity>
                </View>

                {/* Seek Bar + Time */}
                <View style={styles.seekBarRow}>
                  <Text style={styles.seekTimeText}>{formatTime(playbackPosition)}</Text>
                  <TouchableOpacity
                    activeOpacity={1}
                    style={styles.seekBarTrack}
                    onPress={isHost ? handleSeek : undefined}
                    onLayout={(e) => {
                      seekBarWidth.current = e.nativeEvent.layout.width
                    }}
                  >
                    <View
                      style={[
                        styles.seekBarFill,
                        {
                          width:
                            playbackDuration > 0
                              ? `${(playbackPosition / playbackDuration) * 100}%`
                              : '0%',
                        },
                      ]}
                    />
                    {isHost && playbackDuration > 0 && (
                      <View
                        style={[
                          styles.seekBarThumb,
                          {
                            left:
                              playbackDuration > 0
                                ? `${(playbackPosition / playbackDuration) * 100}%`
                                : '0%',
                          },
                        ]}
                      />
                    )}
                  </TouchableOpacity>
                  <Text style={styles.seekTimeText}>{formatTime(playbackDuration)}</Text>
                </View>
              </View>
            )}
            {room?.vibe === 'none' && isHost && (
              <TouchableOpacity
                style={styles.addVibeButton}
                onPress={() => setVibePickerVisible(!vibePickerVisible)}
              >
                <Ionicons name="musical-notes-outline" size={14} color={colors.primary} />
                <Text style={styles.addVibeText}>add a vibe</Text>
              </TouchableOpacity>
            )}

            {/* Inline Vibe Dropdown */}
            {vibePickerVisible && (
              <View style={styles.vibeDropdownContainer}>
                <ScrollView
                  style={styles.vibeDropdownList}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                >
                  {VIBES.map((vibe) => (
                    <TouchableOpacity
                      key={vibe.id}
                      style={[
                        styles.vibeDropdownOption,
                        room?.vibe === vibe.id && styles.vibeDropdownOptionSelected,
                      ]}
                      onPress={async () => {
                        await updateRoomVibe(roomId, vibe.id)
                        setVibePickerVisible(false)
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.vibeDropdownOptionText,
                          room?.vibe === vibe.id && styles.vibeDropdownOptionTextSelected,
                        ]}
                      >
                        {vibe.label}
                      </Text>
                      {room?.vibe === vibe.id && (
                        <Ionicons name="checkmark" size={16} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Background Picker (host only) */}
          {isHost && (
            <View style={styles.bgSection}>
              <TouchableOpacity
                style={styles.bgPickerTrigger}
                onPress={() => setBackgroundPickerVisible(!backgroundPickerVisible)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="image-outline"
                  size={14}
                  color={colors.primary}
                />
                <Text style={styles.bgPickerLabel} numberOfLines={1}>
                  {hasBackground ? roomBackground.label : 'background'}
                </Text>
                <Ionicons
                  name={backgroundPickerVisible ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={colors.primary}
                />
              </TouchableOpacity>
              {backgroundPickerVisible && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.bgScrollStrip}
                  contentContainerStyle={styles.bgScrollContent}
                >
                  {BACKGROUNDS.map((bg) => (
                    <TouchableOpacity
                      key={bg.id}
                      style={[
                        styles.bgThumbWrap,
                        room?.background === bg.id && styles.bgThumbWrapSelected,
                      ]}
                      onPress={async () => {
                        await updateRoomBackground(roomId, bg.id)
                        setBackgroundPickerVisible(false)
                      }}
                      activeOpacity={0.7}
                    >
                      {bg.source ? (
                        <Image source={bg.source} style={styles.bgThumbImage} />
                      ) : (
                        <View style={styles.bgThumbNone}>
                          <Ionicons name="close-circle-outline" size={14} color={colors.offline} />
                        </View>
                      )}
                      <Text
                        style={[
                          styles.bgThumbLabel,
                          room?.background === bg.id && styles.bgThumbLabelSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {bg.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* Messages */}
          <View style={styles.chatContainer}>
            {hasBackground ? (
              <ImageBackground
                source={roomBackground.source}
                style={styles.chatBackgroundImage}
                imageStyle={styles.chatBackgroundImageStyle}
                resizeMode="cover"
              >
                <FlatList
                  ref={flatListRef}
                  data={[...messages].reverse()}
                  renderItem={renderMessage}
                  keyExtractor={(item) => item.id}
                  inverted
                  contentContainerStyle={styles.messageListInverted}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="interactive"
                  onScrollBeginDrag={() => setReactionPickerMessageId(null)}
                />
              </ImageBackground>
            ) : (
              <FlatList
                ref={flatListRef}
                data={[...messages].reverse()}
                renderItem={renderMessage}
                keyExtractor={(item) => item.id}
                inverted
                contentContainerStyle={styles.messageListInverted}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                onScrollBeginDrag={() => setReactionPickerMessageId(null)}
              />
            )}
          </View>

          {/* Input Bar */}
          <View style={styles.inputBarWrapper}>
            <ChatInput
              onSend={handleSend}
              onPickImage={handlePickImage}
              disabled={sending}
              uploading={uploading}
              variant="dark"
            />
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Image Preview Modal */}
      <Modal
        visible={!!pendingImageUri}
        transparent
        animationType="fade"
        onRequestClose={handleCancelSendImage}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
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
              <TouchableOpacity style={styles.modalSendButtonShadow} onPress={handleConfirmSendImage}>
                <LinearGradient colors={['#cafb6c', '#71f200', '#23ff0d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.modalSendButton}>
                  <LinearGradient colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']} style={styles.modalSendButtonHighlight} />
                  <Ionicons name="send" size={16} color={colors.textDark} />
                  <Text style={styles.modalSendText}>Send</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* End Chat Confirm Modal */}
      <ConfirmModal
        visible={endChatConfirm}
        title="End Chat"
        message="Are you sure you want to end this chatroom?"
        confirmText="End Chat"
        onConfirm={handleConfirmEndChat}
        onCancel={() => setEndChatConfirm(false)}
      />

      {/* Delete Message Confirm Modal */}
      <ConfirmModal
        visible={!!deleteConfirm}
        title="Delete Message"
        message="Delete this message? This cannot be undone."
        confirmText="Delete"
        onConfirm={handleDeleteMessage}
        onCancel={() => setDeleteConfirm(null)}
      />

      {/* Sticker Picker Modal (host only) */}
      <Modal
        visible={stickerPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setStickerPickerVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setStickerPickerVisible(false)}>
          <Pressable style={styles.stickerModalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.stickerModalTitle}>Pick Stickers</Text>
            <Text style={styles.stickerModalSubtext}>
              {(room?.stickers || []).length}/{MAX_STICKERS} selected
            </Text>
            <View style={styles.stickerModalGrid}>
              {STICKER_OPTIONS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={[
                    styles.stickerModalOption,
                    (room?.stickers || []).includes(emoji) && styles.stickerModalOptionSelected,
                  ]}
                  onPress={() => toggleSticker(emoji)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.stickerModalEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.stickerModalDoneShadow}
              onPress={() => setStickerPickerVisible(false)}
            >
              <LinearGradient colors={['#cafb6c', '#71f200', '#23ff0d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.stickerModalDone}>
                <LinearGradient colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']} style={styles.stickerModalDoneHighlight} />
                <Text style={styles.stickerModalDoneText}>Done</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Fullscreen Image Viewer */}
      <Modal
        visible={!!viewImageUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setViewImageUrl(null)}
      >
        <Pressable
          style={styles.imageViewerContainer}
          onPress={() => setViewImageUrl(null)}
        >
          {viewImageUrl && (
            <Image
              source={{ uri: viewImageUrl }}
              style={styles.imageViewerFull}
              resizeMode="contain"
              pointerEvents="none"
            />
          )}
        </Pressable>
      </Modal>
    </SafeAreaView>
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
    borderColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 0,
    overflow: 'hidden',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(34, 255, 10, 0.1)',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.primary,
    flex: 1,
    textAlign: 'center',
  },

  // Participant Counter
  participantCount: {
    fontSize: 11,
    fontFamily: fonts.mono,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    marginBottom: 10,
  },

  // Host Row
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  hostAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    marginRight: 8,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#a3a3a3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  hostInfo: {
    flexShrink: 1,
  },
  hostRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  hostName: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  hostLabel: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: '#ffffff',
  },

  // Sticker Display
  stickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 0,
    gap: 4,
    minHeight: 24,
  },
  stickerEmoji: {
    fontSize: 22,
  },
  stickerPlaceholder: {
    fontSize: 11,
    fontFamily: fonts.mono,
    color: 'rgba(255, 255, 255, 0.4)',
  },

  // Participant Avatar Banner
  participantAvatarBanner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantAvatarWrapper: {
    zIndex: 1,
  },
  participantAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.background,
  },
  participantAvatarPlaceholder: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#a3a3a3',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  participantCountText: {
    fontSize: 9,
    fontFamily: fonts.bold,
    color: '#fff',
  },

  // Add Member Button
  addMemberButtonShadow: {
    borderRadius: 16,
    marginLeft: 4,
    shadowColor: '#23ff0d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  addMemberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
    borderLeftColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    borderRightColor: 'rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
  },
  addMemberButtonHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  addMemberText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.textDark,
    marginLeft: 2,
  },

  // End Chat
  endChatButton: {
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginBottom: 10,
    marginLeft: 52,
    marginTop: -30,
  },
  endChatText: {
    fontSize: 11,
    fontFamily: fonts.mono,
    color: 'rgba(255, 255, 255, 0.6)',
  },

  // Countdown
  countdown: {
    fontSize: 12,
    fontFamily: fonts.mono,
    color: '#ffffff',
    textAlign: 'right',
    marginBottom: 10,
  },

  // Audio Controls
  audioSection: {
    marginBottom: 10,
  },
  audioControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 255, 10, 0.1)',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 8,
  },
  vibeNameText: {
    flex: 1,
    fontSize: 11,
    fontFamily: fonts.mono,
    color: '#ffffff',
  },
  changeVibeText: {
    fontSize: 11,
    fontFamily: fonts.mono,
    color: colors.primary,
  },

  // Seek Bar
  seekBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 255, 10, 0.1)',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    paddingHorizontal: 12,
    paddingBottom: 8,
    paddingTop: 2,
    gap: 8,
  },
  seekTimeText: {
    fontSize: 10,
    fontFamily: fonts.mono,
    color: 'rgba(255, 255, 255, 0.5)',
    minWidth: 32,
    textAlign: 'center',
  },
  seekBarTrack: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 2,
    justifyContent: 'center',
  },
  seekBarFill: {
    height: 4,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  seekBarThumb: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    marginLeft: -6,
    top: -4,
  },

  addVibeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginBottom: 10,
  },
  addVibeText: {
    fontSize: 11,
    fontFamily: fonts.mono,
    color: colors.primary,
  },

  // Input bar — stretch edge to edge
  inputBarWrapper: {
    marginHorizontal: -16,
  },

  // Chat
  chatContainer: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    overflow: 'hidden',
    position: 'relative',
    marginHorizontal: -16,
  },
  chatBackgroundImage: {
    flex: 1,
  },
  chatBackgroundImageStyle: {
    borderRadius: 0,
  },
  messageListInverted: {
    padding: 12,
  },
  messageBubble: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  deleteAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 60,
    paddingHorizontal: 12,
  },
  messageAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    marginRight: 8,
  },
  messageContent: {
    flex: 1,
  },
  messageBubbleInner: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  messageText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: '#ffffff',
    lineHeight: 18,
  },
  linkText: {
    color: colors.primary,
    textDecorationLine: 'underline',
    fontFamily: fonts.regular,
  },
  chatImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: '#e0e0e0',
    maxHeight: 320,
  },

  // Fullscreen Image Viewer
  imageViewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerFull: {
    width: '100%',
    height: '80%',
  },

  // Reaction Picker (horizontal scrollable strip above message)
  reactionPickerScroll: {
    maxWidth: '100%',
    marginBottom: 4,
  },
  reactionPicker: {
    flexDirection: 'row',
    backgroundColor: '#000000',
    borderRadius: 20,
    paddingHorizontal: 4,
    paddingVertical: 3,
    alignItems: 'center',
  },
  reactionPickerItem: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  reactionPickerEmoji: {
    fontSize: 20,
  },

  // Reaction Badges (below message)
  reactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 4,
  },
  reactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  reactionBadgeActive: {
    backgroundColor: 'rgba(34, 255, 10, 0.15)',
    borderColor: colors.primary,
  },
  reactionBadgeEmoji: {
    fontSize: 14,
  },
  reactionBadgeCount: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: '#ffffff',
    marginLeft: 3,
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
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.textDark,
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
    color: colors.offline,
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
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textDark,
  },
  modalSendButtonShadow: {
    flex: 1,
    borderRadius: 16,
    shadowColor: '#23ff0d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  modalSendButton: {
    flex: 1,
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

  // Vibe Inline Dropdown
  vibeDropdownWrapper: {
    zIndex: 100,
  },
  vibeDropdownContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(26, 26, 26, 0.9)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  vibeDropdownList: {
    maxHeight: 280,
    paddingVertical: 6,
  },
  vibeDropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  vibeDropdownOptionSelected: {
    backgroundColor: 'rgba(34, 255, 10, 0.08)',
  },
  vibeDropdownOptionText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: '#ffffff',
  },
  vibeDropdownOptionTextSelected: {
    fontFamily: fonts.bold,
  },

  // Background Picker
  bgSection: {
    marginBottom: 6,
  },
  bgPickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
  },
  bgPickerLabel: {
    fontSize: 11,
    fontFamily: fonts.mono,
    color: colors.primary,
  },
  bgScrollStrip: {
    marginTop: 6,
  },
  bgScrollContent: {
    gap: 8,
    paddingRight: 4,
  },
  bgThumbWrap: {
    alignItems: 'center',
    width: 52,
    borderRadius: 8,
    padding: 3,
  },
  bgThumbWrapSelected: {
    backgroundColor: 'rgba(34, 255, 10, 0.15)',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  bgThumbImage: {
    width: 44,
    height: 78,
    borderRadius: 6,
    backgroundColor: colors.borderLight,
  },
  bgThumbNone: {
    width: 44,
    height: 78,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  bgThumbLabel: {
    fontSize: 7,
    fontFamily: fonts.regular,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 2,
    textAlign: 'center',
  },
  bgThumbLabelSelected: {
    fontFamily: fonts.bold,
  },

  // Sticker Picker Modal
  stickerModalContent: {
    width: '80%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 20,
    alignItems: 'center',
  },
  stickerModalTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.textDark,
    marginBottom: 4,
  },
  stickerModalSubtext: {
    fontSize: 11,
    fontFamily: fonts.mono,
    color: colors.offline,
    marginBottom: 14,
  },
  stickerModalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 16,
  },
  stickerModalOption: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  stickerModalOptionSelected: {
    backgroundColor: 'rgba(34, 255, 10, 0.15)',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  stickerModalEmoji: {
    fontSize: 22,
  },
  stickerModalDoneShadow: {
    borderRadius: 20,
    shadowColor: '#23ff0d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  stickerModalDone: {
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
    borderLeftColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    borderRightColor: 'rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
  },
  stickerModalDoneHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  stickerModalDoneText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textDark,
  },
})

export default CyberLoungeDetailScreen
