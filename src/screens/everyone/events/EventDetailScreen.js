// Event Detail Screen
// Shows full event details using grid-cell layout with black borders
// Author can edit or delete
// Comments section with add comment modal

import React, { useState, useCallback, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Linking,
  Platform,
  Modal,
  Pressable,
  Dimensions,
  Animated,
} from 'react-native'
import Swipeable from 'react-native-gesture-handler/Swipeable'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { colors } from '../../../theme'
import { fonts } from '../../../theme/typography'
import { useAuth } from '../../../contexts/AuthContext'
import {
  getEvent,
  deleteEvent,
  getEventComments,
  deleteEventComment,
  toggleEventCommentReaction,
} from '../../../services/everyoneService'
import { STICKER_OPTIONS } from '../../../config/stickers'
import AddEventCommentModal from './AddEventCommentModal'
import { ConfirmModal } from '../../../components/common'
import LightTabBar from '../../../components/navigation/LightTabBar'
import { groupCommentsWithReplies } from '../../../utils/commentUtils'

const EVENT_THUMBNAILS = [
  require('../../../assets/event-thumbnails/Galaxy.png'),
  require('../../../assets/event-thumbnails/Green.png'),
  require('../../../assets/event-thumbnails/Lavendar.png'),
  require('../../../assets/event-thumbnails/Orange.png'),
  require('../../../assets/event-thumbnails/Red.png'),
]
const PLACEHOLDER_MAP = {
  thumb1: require('../../../assets/event-thumbnails/Galaxy.png'),
  thumb2: require('../../../assets/event-thumbnails/Green.png'),
  thumb3: require('../../../assets/event-thumbnails/Lavendar.png'),
  thumb4: require('../../../assets/event-thumbnails/Orange.png'),
  thumb5: require('../../../assets/event-thumbnails/Red.png'),
}
const getEventThumbnail = (eventId) => {
  let hash = 0
  for (let i = 0; i < eventId.length; i++) {
    hash = (hash << 5) - hash + eventId.charCodeAt(i)
    hash |= 0
  }
  return EVENT_THUMBNAILS[Math.abs(hash) % EVENT_THUMBNAILS.length]
}
const getEventImageSource = (imageUrl, eventId) => {
  if (imageUrl && imageUrl.startsWith('placeholder:')) {
    const thumbId = imageUrl.replace('placeholder:', '')
    return PLACEHOLDER_MAP[thumbId] || getEventThumbnail(eventId)
  }
  if (imageUrl) return { uri: imageUrl }
  return getEventThumbnail(eventId)
}

const formatTimeDisplay = (timeVal) => {
  if (!timeVal) return 'TBD'
  // Already in AM/PM format
  if (timeVal.includes('AM') || timeVal.includes('PM')) return timeVal
  // Legacy 24h format — convert to 12h AM/PM
  const [h, m] = timeVal.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`
}

const EventDetailScreen = ({ route, navigation }) => {
  const { eventId } = route.params
  const { user, userProfile } = useAuth()
  const [event, setEvent] = useState(null)
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCommentModal, setShowCommentModal] = useState(false)
  const [viewingImage, setViewingImage] = useState(null)
  const [deleteEventConfirm, setDeleteEventConfirm] = useState(false)
  const [deleteCommentConfirm, setDeleteCommentConfirm] = useState({
    visible: false,
    commentId: null,
  })
  const [reactionPickerCommentId, setReactionPickerCommentId] = useState(null)
  const [replyTarget, setReplyTarget] = useState(null)
  const lightTabRef = useRef(null)
  const lastScrollY = useRef(0)

  const fetchData = async () => {
    setLoading(true)

    const eventResult = await getEvent(eventId)
    if (!eventResult.success) {
      setLoading(false)
      Alert.alert('Not Found', 'This event has been deleted.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ])
      return
    }
    setEvent(eventResult.data)

    const commentsResult = await getEventComments(eventId)
    if (commentsResult.success) {
      setComments(groupCommentsWithReplies(commentsResult.data))
    }

    setLoading(false)
  }

  useFocusEffect(
    useCallback(() => {
      fetchData()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [eventId])
  )

  const formatDate = (dateVal) => {
    if (!dateVal) return ''
    const d =
      dateVal instanceof Date ? dateVal : dateVal.toDate ? dateVal.toDate() : new Date(dateVal)
    const days = ['Sun', 'Mon', 'Tues', 'Weds', 'Thurs', 'Fri', 'Sat']
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ]
    const day = days[d.getDay()]
    const month = months[d.getMonth()]
    const date = d.getDate()
    const suffix =
      date === 1 || date === 21 || date === 31
        ? 'st'
        : date === 2 || date === 22
          ? 'nd'
          : date === 3 || date === 23
            ? 'rd'
            : 'th'
    return `${day} ${month} ${date}${suffix}`
  }

  const formatCardDate = (dateVal) => {
    if (!dateVal) return ''
    const d =
      dateVal instanceof Date ? dateVal : dateVal.toDate ? dateVal.toDate() : new Date(dateVal)
    return `${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getDate().toString().padStart(2, '0')}`
  }

  const formatCommentDate = (timestamp) => {
    if (!timestamp) return ''
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    })
  }

  const handleDelete = () => {
    setDeleteEventConfirm(true)
  }

  const handleConfirmDeleteEvent = async () => {
    setDeleteEventConfirm(false)
    await deleteEvent(eventId)
    navigation.goBack()
  }

  const openInMaps = () => {
    if (!event?.location) return
    const query = encodeURIComponent(event.location.trim())
    const url = Platform.OS === 'ios' ? `maps:0,0?q=${query}` : `https://maps.apple.com/?q=${query}`
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`)
    })
  }

  const handleShare = async () => {
    const { shareContent, buildEventLink } = require('../../../utils/shareLinks')
    await shareContent(
      `Check out this event: ${event?.title} on Collective!`,
      buildEventLink(eventId)
    )
  }

  const handleDeleteComment = (commentId) => {
    setDeleteCommentConfirm({ visible: true, commentId })
  }

  const handleConfirmDeleteComment = async () => {
    const cid = deleteCommentConfirm.commentId
    setDeleteCommentConfirm({ visible: false, commentId: null })
    await deleteEventComment(eventId, cid)
    fetchData()
  }

  const handleCommentLongPress = (commentId) => {
    setReactionPickerCommentId((prev) => (prev === commentId ? null : commentId))
  }

  const handleSelectCommentReaction = (emoji) => {
    const cid = reactionPickerCommentId
    setReactionPickerCommentId(null)
    if (cid && user?.uid) {
      // Optimistic update
      setComments((prev) =>
        prev.map((c) => {
          if (c.id !== cid) return c
          const reactions = { ...(c.reactions || {}) }
          const emojiReactions = reactions[emoji] || []
          if (emojiReactions.includes(user.uid)) {
            const updated = emojiReactions.filter((id) => id !== user.uid)
            if (updated.length === 0) delete reactions[emoji]
            else reactions[emoji] = updated
          } else {
            reactions[emoji] = [...emojiReactions, user.uid]
          }
          return { ...c, reactions }
        })
      )
      toggleEventCommentReaction(eventId, cid, user.uid, emoji)
    }
  }

  const handleTapCommentReaction = (commentId, emoji) => {
    if (!user?.uid) return
    // Optimistic update
    setComments((prev) =>
      prev.map((c) => {
        if (c.id !== commentId) return c
        const reactions = { ...(c.reactions || {}) }
        const emojiReactions = reactions[emoji] || []
        if (emojiReactions.includes(user.uid)) {
          const updated = emojiReactions.filter((id) => id !== user.uid)
          if (updated.length === 0) delete reactions[emoji]
          else reactions[emoji] = updated
        } else {
          reactions[emoji] = [...emojiReactions, user.uid]
        }
        return { ...c, reactions }
      })
    )
    toggleEventCommentReaction(eventId, commentId, user.uid, emoji)
  }

  const renderCommentDeleteAction = (progress, commentId) => {
    const trans = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [80, 0],
    })
    return (
      <Animated.View style={[styles.commentDeleteAction, { transform: [{ translateX: trans }] }]}>
        <TouchableOpacity
          onPress={() => handleDeleteComment(commentId)}
          style={styles.commentDeleteButton}
        >
          <Ionicons name="trash-outline" size={18} color={colors.offline} />
        </TouchableOpacity>
      </Animated.View>
    )
  }

  const handleScroll = (event_) => {
    const currentScrollY = event_.nativeEvent.contentOffset.y
    const contentHeight = event_.nativeEvent.contentSize.height
    const layoutHeight = event_.nativeEvent.layoutMeasurement.height
    const scrollDirection = currentScrollY > lastScrollY.current ? 'down' : 'up'
    const scrollableHeight = contentHeight - layoutHeight
    const scrollPercent = scrollableHeight > 0 ? currentScrollY / scrollableHeight : 0
    if (scrollDirection === 'down' && scrollPercent > 0.5) {
      lightTabRef.current?.hide()
    } else if (scrollDirection === 'up') {
      lightTabRef.current?.show()
    }
    lastScrollY.current = currentScrollY
  }
  const handleScrollBeginDrag = () => {
    lightTabRef.current?.show()
  }

  if (loading || !event) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.backgroundLight} />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    )
  }

  const hiddenUsers = userProfile?.hiddenUsers || []
  const blockedUsers = userProfile?.blockedUsers || []
  const blockedBy = userProfile?.blockedBy || []
  const excludedUsers = [...new Set([...hiddenUsers, ...blockedUsers, ...blockedBy])]
  const visibleComments = comments.filter((c) => !excludedUsers.includes(c.author?.id))

  const isAuthor = event.authorId === user?.uid

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.backgroundLight} />

      {/* Full-screen image viewer modal */}
      {viewingImage && (
        <Modal
          visible={true}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setViewingImage(null)}
        >
          <Pressable style={styles.imageViewerOverlay} onPress={() => setViewingImage(null)}>
            <Pressable
              style={styles.imageViewerCloseButton}
              onPress={() => setViewingImage(null)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={26} color="#fff" />
            </Pressable>
            <Image
              source={{ uri: viewingImage }}
              style={styles.imageViewerFull}
              resizeMode="contain"
            />
          </Pressable>
        </Modal>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        scrollEventThrottle={16}
      >
        <View style={styles.mainContainer}>
          {/* Header — simple row, no banner */}
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ padding: 4 }}
            >
              <Ionicons name="chevron-back" size={24} color={colors.textDark} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{formatDate(event.date)}</Text>
          </View>

          {/* Grid Card */}
          <View style={styles.cardContainer}>
            {/* Top section: 2 columns */}
            <View style={styles.cardTopSection}>
              {/* Left column: author row + title */}
              <View style={styles.cardLeftColumn}>
                {/* Author row cell */}
                <View style={styles.cardAuthorRow}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                    onPress={() =>
                      event.authorId &&
                      navigation.navigate('UserProfile', { userId: event.authorId })
                    }
                    activeOpacity={0.7}
                  >
                    <View style={styles.cardAvatar}>
                      {event.authorPhoto ? (
                        <Image
                          source={{ uri: event.authorPhoto, cache: 'reload' }}
                          style={styles.cardAvatarImage}
                        />
                      ) : (
                        <Ionicons name="person" size={14} color="#666" />
                      )}
                    </View>
                    <Text style={styles.cardAuthorName} numberOfLines={1}>
                      {event.authorName}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleShare}
                    style={styles.headerActionButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="share-outline" size={18} color={colors.textDark} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setReplyTarget(null)
                      setShowCommentModal(true)
                    }}
                    style={styles.headerActionButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="chatbubble-outline" size={18} color={colors.textDark} />
                  </TouchableOpacity>
                </View>
                {/* Title cell */}
                <View style={styles.cardTitleCell}>
                  <Text style={styles.cardTitle}>{event.title}</Text>
                </View>
              </View>

              {/* Right column: chevron, date */}
              <View style={styles.cardRightColumn}>
                <View style={styles.cardChevronCircle}>
                  <Ionicons name="chevron-forward" size={11} color="#ffffff" />
                </View>
                <Text style={styles.cardDate}>{formatCardDate(event.date)}</Text>
              </View>
            </View>

            {/* City display */}
            {event.city && (
              <View style={styles.cardCityCell}>
                <Ionicons
                  name={event.city === 'Global' ? 'globe-outline' : 'location-outline'}
                  size={14}
                  color={colors.offline}
                />
                <Text style={styles.cityText}>
                  {event.city === 'Global' ? 'Global / Digital' : event.city}
                </Text>
              </View>
            )}

            {/* Location & Time cell */}
            <View style={styles.cardDetailsCell}>
              <View style={styles.detailsInner}>
                <View style={styles.locationSection}>
                  <Text style={styles.detailLabel}>Location:</Text>
                  {event.location ? (
                    <TouchableOpacity onPress={openInMaps}>
                      <Text style={styles.locationLink}>{event.location}</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.detailValue}>TBD</Text>
                  )}
                </View>
                <View style={styles.timeSection}>
                  <Text style={styles.detailLabel}>Time:</Text>
                  <Text style={styles.timeValue}>{formatTimeDisplay(event.time)}</Text>
                </View>
              </View>
            </View>

            {/* Photo cell */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() =>
                event.imageUrl && !event.imageUrl.startsWith('placeholder:')
                  ? setViewingImage(event.imageUrl)
                  : null
              }
              style={styles.cardImageCell}
            >
              <Image
                source={getEventImageSource(event.imageUrl, event.id)}
                style={styles.cardImage}
              />
            </TouchableOpacity>

            {/* Description cell */}
            <View style={styles.cardDescriptionCell}>
              <Text style={styles.cardDescriptionText}>{event.description}</Text>
            </View>

            {/* Link cell */}
            {event.link ? (
              <TouchableOpacity
                style={styles.cardLinkCell}
                onPress={() => {
                  const url = event.link.startsWith('http') ? event.link : `https://${event.link}`
                  Linking.openURL(url).catch(() => {
                    Alert.alert('Error', 'Could not open link.')
                  })
                }}
              >
                <Text style={styles.cardLinkText}>{event.linkLabel || event.link}</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.cardLinkCell}>
                <Text style={styles.cardLinkPlaceholder}>Event link</Text>
              </View>
            )}

            {/* Actions cell: edit, delete */}
            {isAuthor && (
              <View style={styles.cardActionsCell}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('EventEdit', { eventId })}
                  style={styles.actionButton}
                >
                  <Text style={styles.editLink}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDelete} style={styles.actionButton}>
                  <Ionicons name="trash-outline" size={20} color={colors.offline} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Comments Section */}
          <View style={styles.commentsSection}>
            <Text style={styles.commentsHeader}>// Comments</Text>

            {visibleComments.length === 0 ? (
              <Text style={styles.noComments}>No comments yet. Be the first!</Text>
            ) : (
              visibleComments.map((comment) => (
                <Swipeable
                  key={comment.id}
                  renderRightActions={
                    comment.author?.id === user?.uid
                      ? (progress) => renderCommentDeleteAction(progress, comment.id)
                      : undefined
                  }
                  rightThreshold={40}
                  overshootRight={false}
                  enabled={comment.author?.id === user?.uid}
                >
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onLongPress={() => handleCommentLongPress(comment.id)}
                    delayLongPress={400}
                  >
                    <View style={[styles.commentRow, comment.isReply && styles.replyCommentRow]}>
                      <TouchableOpacity
                        onPress={() => {
                          if (comment.author?.id) {
                            navigation.navigate('UserProfile', { userId: comment.author.id })
                          }
                        }}
                      >
                        {comment.author?.profilePhoto ? (
                          <Image
                            source={{ uri: comment.author.profilePhoto, cache: 'reload' }}
                            style={comment.isReply ? styles.replyAvatar : styles.commentAvatar}
                          />
                        ) : (
                          <View
                            style={
                              comment.isReply
                                ? styles.replyAvatarPlaceholder
                                : styles.commentAvatarPlaceholder
                            }
                          >
                            <Ionicons name="person" size={comment.isReply ? 10 : 12} color="#666" />
                          </View>
                        )}
                      </TouchableOpacity>
                      <View style={styles.commentContent}>
                        <View style={styles.commentMeta}>
                          <Text style={styles.commentAuthor}>{comment.author?.name || 'User'}</Text>
                          <Text style={styles.commentDate}>
                            {formatCommentDate(comment.createdAt)}
                          </Text>
                        </View>
                        <Text style={styles.commentText}>{comment.content}</Text>

                        {/* Reply link — only on top-level comments */}
                        {!comment.isReply && (
                          <TouchableOpacity
                            onPress={() => {
                              setReplyTarget({
                                commentId: comment.id,
                                authorName: comment.author?.name || 'User',
                              })
                              setShowCommentModal(true)
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Text style={styles.replyLinkText}>Reply</Text>
                          </TouchableOpacity>
                        )}

                        {/* Reaction picker */}
                        {reactionPickerCommentId === comment.id && (
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.commentReactionPickerScroll}
                            contentContainerStyle={styles.commentReactionPicker}
                          >
                            {STICKER_OPTIONS.map((emoji) => (
                              <TouchableOpacity
                                key={emoji}
                                style={styles.commentReactionItem}
                                onPress={() => handleSelectCommentReaction(emoji)}
                              >
                                <Text style={styles.commentReactionEmoji}>{emoji}</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        )}

                        {/* Reaction badges */}
                        {comment.reactions && Object.keys(comment.reactions).length > 0 && (
                          <View style={styles.commentReactionsRow}>
                            {Object.entries(comment.reactions).map(([emoji, users]) => (
                              <TouchableOpacity
                                key={emoji}
                                style={[
                                  styles.commentReactionBadge,
                                  users.includes(user?.uid) && styles.commentReactionBadgeActive,
                                ]}
                                onPress={() => handleTapCommentReaction(comment.id, emoji)}
                              >
                                <Text style={styles.commentReactionBadgeEmoji}>{emoji}</Text>
                                <Text style={styles.commentReactionBadgeCount}>{users.length}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                </Swipeable>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* Add Comment Modal */}
      <AddEventCommentModal
        visible={showCommentModal}
        onClose={() => {
          setShowCommentModal(false)
          setReplyTarget(null)
        }}
        onCommentAdded={() => {
          setShowCommentModal(false)
          setReplyTarget(null)
          fetchData()
        }}
        eventId={eventId}
        userProfile={userProfile}
        userId={user?.uid}
        parentCommentId={replyTarget?.commentId || null}
      />

      {/* Delete Event Confirm Modal */}
      <ConfirmModal
        visible={deleteEventConfirm}
        title="Delete Event"
        message="Are you sure you want to delete this event?"
        confirmText="Delete"
        onConfirm={handleConfirmDeleteEvent}
        onCancel={() => setDeleteEventConfirm(false)}
      />

      {/* Delete Comment Confirm Modal */}
      <ConfirmModal
        visible={deleteCommentConfirm.visible}
        title="Delete Comment"
        message="Are you sure you want to delete this comment?"
        confirmText="Delete"
        onConfirm={handleConfirmDeleteComment}
        onCancel={() => setDeleteCommentConfirm({ visible: false, commentId: null })}
      />
      <LightTabBar ref={lightTabRef} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 120,
  },
  mainContainer: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#000000',
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.offline,
  },

  // Header — simple row, no banner
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.textDark,
    marginLeft: 8,
  },

  // Grid Card Container
  cardContainer: {
    backgroundColor: '#ffffff',
    marginBottom: 20,
  },

  // Top section: two columns side by side
  cardTopSection: {
    flexDirection: 'row',
  },

  // Left column (author + title)
  cardLeftColumn: {
    flex: 1,
  },

  // Author row cell
  cardAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#000000',
    padding: 10,
  },
  cardAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 8,
  },
  cardAvatarImage: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  cardAuthorName: {
    flex: 1,
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textDark,
  },
  headerActionButton: {
    marginLeft: 16,
    padding: 6,
  },

  // Title cell (below author, left side)
  cardTitleCell: {
    borderWidth: 1,
    borderColor: '#000000',
    borderTopWidth: 0,
    padding: 10,
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: '#000000',
  },

  // Right column (zipcode, chevron, date)
  cardRightColumn: {
    width: 80,
    borderWidth: 1,
    borderColor: '#000000',
    borderLeftWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  cardChevronCircle: {
    width: 22,
    height: 22,
    borderRadius: 16,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  cardDate: {
    fontSize: 23,
    fontFamily: fonts.bold,
    color: colors.textDark,
    marginBottom: -15,
  },

  // City display cell
  cardCityCell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#000000',
    borderTopWidth: 0,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  cityText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.offline,
    marginLeft: 6,
  },

  // Location & Time details cell
  cardDetailsCell: {
    borderWidth: 1,
    borderColor: '#000000',
    borderTopWidth: 0,
    padding: 10,
  },
  detailsInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  locationSection: {
    flex: 1,
    marginRight: 16,
  },
  detailLabel: {
    fontSize: 12,
    fontFamily: fonts.mono,
    color: colors.textDark,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textDark,
    lineHeight: 18,
  },
  locationLink: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textDark,
    lineHeight: 18,
    textDecorationLine: 'underline',
  },
  timeSection: {
    alignItems: 'flex-end',
  },
  timeValue: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: colors.textDark,
  },

  // Photo cell
  cardImageCell: {
    borderWidth: 1,
    borderColor: '#000000',
    borderTopWidth: 0,
    aspectRatio: 2,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },

  // Description cell
  cardDescriptionCell: {
    borderWidth: 1,
    borderColor: '#000000',
    borderTopWidth: 0,
    padding: 10,
  },
  cardDescriptionText: {
    fontSize: 12,
    fontFamily: fonts.mono,
    color: colors.textDark,
    lineHeight: 18,
  },

  // Link cell — standalone rectangle box at bottom of card
  cardLinkCell: {
    borderWidth: 1,
    borderColor: '#000000',
    borderTopWidth: 0,
    padding: 10,
  },
  cardLinkText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textDark,
    textDecorationLine: 'underline',
  },
  cardLinkPlaceholder: {
    fontSize: 12,
    fontFamily: fonts.italic,
    color: colors.offline,
  },

  // Actions cell
  cardActionsCell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#000000',
    borderTopWidth: 0,
    padding: 10,
  },
  actionButton: {
    marginRight: 16,
  },
  editLink: {
    fontSize: 11,
    fontFamily: fonts.italic,
    color: colors.offline,
    textDecorationLine: 'underline',
  },

  // Image Viewer Modal
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerCloseButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  imageViewerFull: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height * 0.75,
  },

  // Comments Section
  commentsSection: {
    marginTop: 4,
  },
  commentsHeader: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.textDark,
    marginBottom: 14,
  },
  noComments: {
    fontSize: 13,
    fontFamily: fonts.italic,
    color: colors.offline,
    marginBottom: 16,
  },
  commentRow: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  commentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  commentAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#a3a3a3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentContent: {
    flex: 1,
    marginLeft: 10,
  },
  commentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  commentAuthor: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.textDark,
    marginRight: 10,
  },
  commentDate: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.offline,
  },
  commentDeleteAction: {
    backgroundColor: colors.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
    width: 60,
  },
  commentDeleteButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: 60,
  },
  commentText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textDark,
    lineHeight: 20,
  },

  // Reply styles
  replyCommentRow: {
    marginLeft: 40,
  },
  replyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  replyAvatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#a3a3a3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyLinkText: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.offline,
    marginTop: 4,
  },

  // Comment Reaction Picker
  commentReactionPickerScroll: {
    marginTop: 6,
    marginBottom: 4,
    backgroundColor: '#000000',
    borderRadius: 20,
    maxWidth: '85%',
  },
  commentReactionPicker: {
    flexDirection: 'row',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  commentReactionItem: {
    paddingHorizontal: 5,
    paddingVertical: 4,
  },
  commentReactionEmoji: {
    fontSize: 20,
  },

  // Comment Reaction Badges
  commentReactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 4,
  },
  commentReactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  commentReactionBadgeActive: {
    backgroundColor: 'rgba(34, 255, 10, 0.15)',
    borderColor: colors.primary,
  },
  commentReactionBadgeEmoji: {
    fontSize: 14,
  },
  commentReactionBadgeCount: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.textDark,
    marginLeft: 3,
  },
})

export default EventDetailScreen
