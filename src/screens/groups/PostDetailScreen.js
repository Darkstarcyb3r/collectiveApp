// Post Detail Screen — matches Figma "Individual PostScreen"
// Full post view with group name title, author avatar (links to profile), share/comment icons,
// date, full content, image, comments section, add comment popup
// Post content area capped at ~2/3 screen height with internal scroll; comments visible below

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
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Animated,
  Modal,
  Pressable,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Swipeable from 'react-native-gesture-handler/Swipeable'
import { colors } from '../../theme'
import { fonts } from '../../theme/typography'
import { useAuth } from '../../contexts/AuthContext'
import {
  getPost,
  getPostComments,
  deletePost,
  deleteComment,
  toggleGroupCommentReaction,
  subscribeToPost,
  unsubscribeFromPost,
} from '../../services/groupService'
import { STICKER_OPTIONS } from '../../config/stickers'
import AddCommentModal from './AddCommentModal'
import { ConfirmModal } from '../../components/common'
import InviteContactsOverlay from '../../components/groups/InviteContactsOverlay'
import LightTabBar from '../../components/navigation/LightTabBar'
import { groupCommentsWithReplies } from '../../utils/commentUtils'
import { LinearGradient } from 'expo-linear-gradient'
import { playClick } from '../../services/soundService'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')
const POST_CONTENT_MAX_HEIGHT = SCREEN_HEIGHT * 0.2

const PostDetailScreen = ({ navigation, route }) => {
  const { groupId, postId, groupName } = route.params
  const { user, userProfile } = useAuth()
  const [post, setPost] = useState(null)
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showCommentModal, setShowCommentModal] = useState(false)
  const [viewingImage, setViewingImage] = useState(null)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const [containerHeight, setContainerHeight] = useState(0)
  const [contentHeight, setContentHeight] = useState(0)
  const [deletePostConfirm, setDeletePostConfirm] = useState(false)
  const [deleteCommentConfirm, setDeleteCommentConfirm] = useState({
    visible: false,
    commentId: null,
  })
  const [reactionPickerCommentId, setReactionPickerCommentId] = useState(null)
  const [replyTarget, setReplyTarget] = useState(null)
  const [showShareOverlay, setShowShareOverlay] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const subscribingRef = useRef(false)
  const scrollViewRef = useRef(null)
  const blurOpacity = useRef(new Animated.Value(1)).current
  const lightTabRef = useRef(null)
  const lastScrollY = useRef(0)

  // Scroll-based tab bar show/hide
  const handleLightTabScroll = (event) => {
    const currentScrollY = event.nativeEvent.contentOffset.y
    const contentH = event.nativeEvent.contentSize.height
    const layoutH = event.nativeEvent.layoutMeasurement.height
    const scrollDirection = currentScrollY > lastScrollY.current ? 'down' : 'up'
    const scrollableHeight = contentH - layoutH
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

  // Mark this post as viewed in AsyncStorage
  const markPostViewed = async () => {
    if (!user?.uid || !groupId || !postId) return
    try {
      const key = `postLastViewed_${user.uid}_${groupId}`
      const stored = await AsyncStorage.getItem(key)
      const parsed = stored ? JSON.parse(stored) : {}
      parsed[postId] = Date.now()
      await AsyncStorage.setItem(key, JSON.stringify(parsed))
    } catch (_err) {
      // silently fail
    }
  }

  const fetchData = async () => {
    setLoading(true)

    const postResult = await getPost(groupId, postId)
    if (!postResult.success) {
      setLoading(false)
      Alert.alert('Not Found', 'This post has been deleted.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ])
      return
    }
    setPost(postResult.data)
    const subscribers = postResult.data.subscribers || []
    setIsSubscribed(subscribers.includes(user?.uid))

    const commentsResult = await getPostComments(groupId, postId)
    if (commentsResult.success) {
      const hiddenUsers = userProfile?.hiddenUsers || []
      const blockedUsers = userProfile?.blockedUsers || []
      const blockedBy = userProfile?.blockedBy || []
      const excludedUsers = [...new Set([...hiddenUsers, ...blockedUsers, ...blockedBy])]
      const visibleComments = commentsResult.data.filter(
        (c) => !excludedUsers.includes(c.author?.id)
      )
      setComments(groupCommentsWithReplies(visibleComments))
    }

    setLoading(false)
  }

  useFocusEffect(
    useCallback(() => {
      fetchData()
      markPostViewed()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupId, postId])
  )

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  const isPostAuthor = post?.authorId === user?.uid

  const formatDate = (timestamp) => {
    if (!timestamp) return ''
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    })
  }

  const handleDelete = () => {
    playClick()
    setDeletePostConfirm(true)
  }

  const handleConfirmDeletePost = async () => {
    setDeletePostConfirm(false)
    const result = await deletePost(groupId, postId)
    if (result.success) {
      navigation.goBack()
    } else {
      Alert.alert('Error', 'Could not delete post.')
    }
  }

  const handleShare = () => {
    playClick()
    setShowShareOverlay(true)
  }

  const handleToggleSubscribe = async () => {
    playClick()
    if (!user?.uid || subscribingRef.current) return
    subscribingRef.current = true
    const newState = !isSubscribed
    setIsSubscribed(newState) // optimistic
    try {
      const result = newState
        ? await subscribeToPost(groupId, postId, user.uid)
        : await unsubscribeFromPost(groupId, postId, user.uid)
      if (!result.success) {
        console.log('🔴 Subscribe toggle failed, reverting:', result.error)
        setIsSubscribed(!newState) // revert on failure
      }
    } catch (_err) {
      setIsSubscribed(!newState)
    } finally {
      subscribingRef.current = false
    }
  }

  const handleDeleteComment = (commentId) => {
    playClick()
    setDeleteCommentConfirm({ visible: true, commentId })
  }

  const handleConfirmDeleteComment = async () => {
    const cid = deleteCommentConfirm.commentId
    setDeleteCommentConfirm({ visible: false, commentId: null })
    await deleteComment(groupId, postId, cid)
    fetchData()
  }

  const handleCommentLongPress = (commentId) => {
    setReactionPickerCommentId((prev) => (prev === commentId ? null : commentId))
  }

  const handleSelectCommentReaction = (emoji) => {
    playClick()
    const cid = reactionPickerCommentId
    setReactionPickerCommentId(null)
    if (cid && user?.uid) {
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
      toggleGroupCommentReaction(groupId, postId, cid, user.uid, emoji)
    }
  }

  const handleTapCommentReaction = (commentId, emoji) => {
    playClick()
    if (!user?.uid) return
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
    toggleGroupCommentReaction(groupId, postId, commentId, user.uid, emoji)
  }

  if (loading || !post) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.backgroundLight} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

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

      <View style={styles.mainContainer}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          onScroll={handleLightTabScroll}
          onScrollBeginDrag={handleScrollBeginDrag}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {/* Header: back + group name */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="chevron-back" size={28} color={colors.textDark} />
            </TouchableOpacity>
            <Text style={styles.groupNameTitle}>{groupName || 'Group'}</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Post Card — capped at ~2/3 screen height */}
          <View style={styles.postCard}>
            {/* Author Row: avatar + icons + date */}
            <View style={styles.authorRow}>
              {/* Author Avatar (Left) */}
              <TouchableOpacity
                onPress={() => {
                  playClick()
                  if (post.author?.id) {
                    navigation.navigate('UserProfile', { userId: post.author.id })
                  }
                }}
              >
                {post.author?.profilePhoto ? (
                  <Image
                    source={{ uri: post.author.profilePhoto, cache: 'reload' }}
                    style={styles.authorAvatar}
                  />
                ) : (
                  <View style={styles.authorAvatarPlaceholder}>
                    <Ionicons name="person" size={20} color="#666" />
                  </View>
                )}
              </TouchableOpacity>

              {/* Middle Spacer - Pushes Icons to the Right */}
              <View style={styles.spacer} />

              {/* Icons Container (Right) */}
              <View style={styles.iconsContainer}>
                {/* Edit + Delete — only visible to post author */}
                {isPostAuthor && (
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => { playClick(); navigation.navigate('EditPost', { groupId, postId, groupName }); }}
                  >
                    <Text style={styles.editPostLink}>edit_post</Text>
                  </TouchableOpacity>
                )}
                {isPostAuthor && (
                  <TouchableOpacity style={styles.iconButton} onPress={handleDelete}>
                    <Ionicons name="trash-outline" size={20} color={colors.offline} />
                  </TouchableOpacity>
                )}
                {/* re: create live chat */}
                <TouchableOpacity
                  style={styles.liveChatBtnOuter}
                  activeOpacity={0.8}
                  onPress={() => {
                    playClick()
                    navigation.navigate('CyberLoungeCreate', { initialName: post?.title || 're: post' })
                  }}
                >
                  <LinearGradient
                    colors={['#d8f434', '#b3f425', '#93f478']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.liveChatBtn}
                  >
                    <LinearGradient colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']} style={styles.liveChatBtnHighlight} />
                    <Ionicons name="radio-outline" size={12} color="#000" />
                    <Text style={styles.liveChatBtnText}>re: live chat</Text>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Share and Comment Icons */}
                <TouchableOpacity style={styles.iconButton} onPress={handleShare}>
                  <Ionicons name="share-outline" size={23} color={colors.offline} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => {
                    playClick()
                    setReplyTarget(null)
                    setShowCommentModal(true)
                  }}
                >
                  <Ionicons name="chatbubble-outline" size={22} color={colors.offline} />
                </TouchableOpacity>
                {!isPostAuthor && (
                  <TouchableOpacity style={styles.iconButton} onPress={handleToggleSubscribe}>
                    <Ionicons
                      name={isSubscribed ? 'notifications' : 'notifications-outline'}
                      size={22}
                      color={isSubscribed ? colors.primary : colors.offline}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Title + Date Row */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <Text style={[styles.postTitle, { marginBottom: 0, flex: 1 }]}>{post.title}</Text>
              <Text style={styles.postDate}>{formatDate(post.createdAt)}</Text>
            </View>

            {/* Image — tap to view full */}
            {post.imageUrl && (
              <TouchableOpacity activeOpacity={0.85} onPress={() => { playClick(); setViewingImage(post.imageUrl); }}>
                <Image source={{ uri: post.imageUrl }} style={styles.postImage} />
              </TouchableOpacity>
            )}

            {/* Scrollable Content Area — max height with frosted fade indicator */}
            <View style={styles.postContentContainer}>
              <ScrollView
                style={styles.postContentScroll}
                nestedScrollEnabled
                showsVerticalScrollIndicator={true}
                persistentScrollbar={true}
                ref={scrollViewRef}
                onLayout={(event) => {
                  const h = event.nativeEvent.layout.height
                  setContainerHeight(h)
                }}
                onContentSizeChange={(w, h) => {
                  setContentHeight(h)
                  if (containerHeight > 0) {
                    const overflows = h > containerHeight
                    setIsOverflowing(overflows)
                    if (overflows) {
                      Animated.timing(blurOpacity, {
                        toValue: 1,
                        duration: 200,
                        useNativeDriver: true,
                      }).start()
                    }
                  }
                }}
                onScroll={(event) => {
                  const { y } = event.nativeEvent.contentOffset
                  const scrollableHeight = contentHeight - containerHeight

                  if (scrollableHeight > 0) {
                    const scrollPercentage = y / scrollableHeight
                    if (scrollPercentage >= 0.9) {
                      const fadeProgress = (scrollPercentage - 0.9) / 0.1
                      Animated.timing(blurOpacity, {
                        toValue: 1 - fadeProgress,
                        duration: 100,
                        useNativeDriver: true,
                      }).start()
                    } else {
                      Animated.timing(blurOpacity, {
                        toValue: 1,
                        duration: 100,
                        useNativeDriver: true,
                      }).start()
                    }
                  }
                }}
                scrollEventThrottle={16}
              >
                <Text style={styles.postContent}>{post.content}</Text>
              </ScrollView>

              {/* Frosted fade overlay — shows only when content overflows */}
              {isOverflowing && (
                <Animated.View
                  style={[styles.fadeOverlay, { opacity: blurOpacity }]}
                  pointerEvents="none"
                >
                  <LinearGradient
                    colors={[
                      'rgba(255, 255, 255, 0.3)',
                      'rgba(255, 255, 255, 0.7)',
                      'rgba(255, 255, 255, 0.9)',
                      '#ffffff',
                    ]}
                    locations={[0, 0.4, 0.8, 1]}
                    style={StyleSheet.absoluteFill}
                  />
                </Animated.View>
              )}
            </View>
          </View>

          {/* Comments Section — flows below post, scrolls with page */}
          <View style={styles.commentsSection}>
            <Text style={styles.commentsHeader}>// Comments</Text>

            {comments.length === 0 ? (
              <Text style={styles.noComments}>No comments yet. Be the first!</Text>
            ) : (
              comments.map((comment) => {
                const isCommentAuthor = comment.author?.id === user?.uid

                const commentContent = (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onLongPress={() => handleCommentLongPress(comment.id)}
                    delayLongPress={400}
                  >
                    <View style={[styles.commentRow, comment.isReply && styles.replyCommentRow]}>
                      <TouchableOpacity
                        onPress={() => {
                          playClick()
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
                          <Text style={styles.commentDate}>{formatDate(comment.createdAt)}</Text>
                        </View>
                        <Text style={styles.commentText}>{comment.content}</Text>

                        {/* Reply link — only on top-level comments */}
                        {!comment.isReply && (
                          <TouchableOpacity
                            onPress={() => {
                              playClick()
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
                )

                if (isCommentAuthor) {
                  return (
                    <Swipeable
                      key={comment.id}
                      renderRightActions={(progress, dragX) => {
                        const scale = dragX.interpolate({
                          inputRange: [-80, 0],
                          outputRange: [1, 0],
                          extrapolate: 'clamp',
                        })
                        return (
                          <TouchableOpacity
                            style={styles.commentDeleteAction}
                            onPress={() => handleDeleteComment(comment.id)}
                          >
                            <Animated.View style={{ transform: [{ scale }] }}>
                              <Ionicons name="trash-outline" size={22} color={colors.offline} />
                            </Animated.View>
                          </TouchableOpacity>
                        )
                      }}
                      overshootRight={false}
                      friction={2}
                    >
                      {commentContent}
                    </Swipeable>
                  )
                }

                return <View key={comment.id}>{commentContent}</View>
              })
            )}
          </View>
        </ScrollView>
      </View>

      {/* Add Comment Modal */}
      <AddCommentModal
        visible={showCommentModal}
        onClose={() => {
          setShowCommentModal(false)
          setReplyTarget(null)
        }}
        onCommentAdded={async () => {
          setShowCommentModal(false)
          setReplyTarget(null)
          // Mark post and group as viewed so our own comment doesn't trigger dots
          markPostViewed()
          try {
            const key = `groupLastVisited_${user.uid}`
            const stored = await AsyncStorage.getItem(key)
            const parsed = stored ? JSON.parse(stored) : {}
            parsed[groupId] = Date.now()
            await AsyncStorage.setItem(key, JSON.stringify(parsed))
          } catch (_e) { /* silently fail */ }
          fetchData()
        }}
        groupId={groupId}
        postId={postId}
        userProfile={userProfile}
        userId={user?.uid}
        parentCommentId={replyTarget?.commentId || null}
      />

      {/* Delete Post Confirm Modal */}
      <ConfirmModal
        visible={deletePostConfirm}
        title="Delete Post"
        message="Are you sure you want to delete this post?"
        confirmText="Delete"
        onConfirm={handleConfirmDeletePost}
        onCancel={() => setDeletePostConfirm(false)}
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

      {/* Share Post Overlay */}
      <InviteContactsOverlay
        visible={showShareOverlay}
        onClose={() => setShowShareOverlay(false)}
        postId={postId}
        postTitle={post?.title || ''}
        groupId={groupId}
        groupName={groupName || ''}
      />

      {/* Light Tab Bar */}
      <LightTabBar ref={lightTabRef} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  mainContainer: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#000000',
    marginHorizontal: 8,
    marginTop: 10,
    marginBottom: 16,
    overflow: 'hidden',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 80,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupNameTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.textDark,
    textAlign: 'center',
  },

  // Post Card
  postCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 20,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center', // Vertically center items in the row
    justifyContent: 'space-between', // This pushes the end items apart
    marginBottom: 14,
  },
  // This view will take up all available space, pushing the icons container to the right
  spacer: {
    flex: 1,
  },
  // Container for the delete, share, and comment icons
  iconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Style for each icon button for consistent spacing
  iconButton: {
    marginLeft: 16, // Adds space between the icons
  },
  liveChatBtnOuter: {
    marginLeft: 16,
    borderRadius: 12,
    shadowColor: '#b3f425',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  liveChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.8)',
    borderLeftColor: 'rgba(255,255,255,0.6)',
    borderBottomColor: 'rgba(0,0,0,0.08)',
    borderRightColor: 'rgba(0,0,0,0.05)',
    overflow: 'hidden',
    gap: 4,
  },
  liveChatBtnHighlight: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: '50%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  liveChatBtnText: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: '#000',
    fontWeight: '600',
  },
  editPostLink: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.textDark,
    textDecorationLine: 'underline',
  },
  authorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  authorAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#a3a3a3',
    alignItems: 'center',
    justifyContent: 'center',
  },

  postDate: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.offline,
  },
  // Post Body
  postTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.textDark,
    marginBottom: 12,
  },
  postImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    marginBottom: 14,
  },
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
    height: SCREEN_HEIGHT * 0.75,
  },

  // Scrollable post content container — capped at ~2/3 screen
  postContentContainer: {
    maxHeight: POST_CONTENT_MAX_HEIGHT,
  },
  postContentScroll: {
    flexGrow: 0,
  },
  postContent: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textDark,
    lineHeight: 22,
    paddingRight: 4,
  },

  // Comments Section
  commentsSection: {
    marginTop: 6,
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
    width: 30,
    height: 30,
    borderRadius: 15,
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
    justifyContent: 'center',
    alignItems: 'center',
    width: 60,
    paddingHorizontal: 12,
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

  // Frosted fade overlay for scrollable content overflow
  fadeOverlay: {
    position: 'absolute',
    bottom: -10,
    left: 0,
    right: 0,
    height: 70, // Fixed height works better than percentage here
    borderBottomLeftRadius: 16, // Matches your postCard borderRadius
    borderBottomRightRadius: 16,
    overflow: 'hidden',
  },
})

export default PostDetailScreen
