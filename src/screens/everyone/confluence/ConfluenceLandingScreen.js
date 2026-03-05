// Confluence Landing Screen
// Masonry-style image grid feed — posts can be edited or deleted by owner
// Green border container, 10 posts/month per user

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Modal,
  TouchableWithoutFeedback,
  TextInput,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { colors } from '../../../theme'
import { fonts } from '../../../theme/typography'
import { useAuth } from '../../../contexts/AuthContext'
import {
  subscribeToConfluencePosts,
  subscribeToNetworkUsers,
  reportConfluencePost,
  checkExistingConfluenceReport,
  updateConfluencePost,
  deleteConfluencePost,
} from '../../../services/everyoneService'
import { buildConnectedUserIds } from '../../../utils/networkGraph'
import DarkTabBar from '../../../components/navigation/DarkTabBar'
import { playClick } from '../../../services/soundService'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const COLUMN_GAP = 8
const CONTAINER_PADDING = 16 * 2 + 16 * 2 // scroll padding + main container padding
const AVAILABLE_WIDTH = SCREEN_WIDTH - CONTAINER_PADDING
const COLUMN_WIDTH = (AVAILABLE_WIDTH - COLUMN_GAP) / 2

// Predefined aspect ratios for masonry variety
const ASPECT_RATIOS = [1.2, 0.8, 1.0, 1.4, 0.9, 1.1, 0.7, 1.3]

const FLAG_REASONS = [
  { key: 'spam', label: 'Spam' },
  { key: 'inappropriate', label: 'Inappropriate content' },
  { key: 'harassment', label: 'Harassment' },
  { key: 'other', label: 'Other' },
]

const ConfluenceLandingScreen = ({ navigation }) => {
  const { user, userProfile } = useAuth()
  const [posts, setPosts] = useState([])

  // Tab bar ref for scroll-based show/hide
  const tabBarRef = useRef(null)
  const lastScrollY = useRef(0)

  const handleScroll = useCallback((event) => {
    const currentY = event.nativeEvent.contentOffset.y
    if (currentY > lastScrollY.current && currentY > 20) {
      tabBarRef.current?.hide()
    }
    lastScrollY.current = currentY
  }, [])

  const handleScrollBeginDrag = useCallback(() => {
    tabBarRef.current?.show()
  }, [])
  const [selectedPost, setSelectedPost] = useState(null)
  const [popupImageHeight, setPopupImageHeight] = useState(SCREEN_WIDTH - 32)
  const [allNetworkUsers, setAllNetworkUsers] = useState([])
  const [showFlagModal, setShowFlagModal] = useState(false)
  const [flagReason, setFlagReason] = useState('')
  const [flagDetails, setFlagDetails] = useState('')
  const [flagLoading, setFlagLoading] = useState(false)
  const [flagAlert, setFlagAlert] = useState({ visible: false, title: '', message: '' })
  const [showEditModal, setShowEditModal] = useState(false)
  const [editCaption, setEditCaption] = useState('')
  const [editLink, setEditLink] = useState('')
  const [editLinkLabel, setEditLinkLabel] = useState('')
  const [editLoading, setEditLoading] = useState(false)

  // Calculate proportional image height when a post is selected
  useEffect(() => {
    if (selectedPost?.imageUrl) {
      Image.getSize(
        selectedPost.imageUrl,
        (width, height) => {
          const imageWidth = SCREEN_WIDTH - 32
          const proportionalHeight = (height / width) * imageWidth
          const maxHeight = SCREEN_WIDTH * 1.5 // cap tall images
          setPopupImageHeight(Math.min(proportionalHeight, maxHeight))
        },
        () => {
          setPopupImageHeight(SCREEN_WIDTH - 32) // fallback to square
        }
      )
    }
  }, [selectedPost])

  const hiddenUsers = userProfile?.hiddenUsers || []
  const blockedUsers = userProfile?.blockedUsers || []
  const blockedBy = userProfile?.blockedBy || []
  const excludedUsers = [...new Set([...hiddenUsers, ...blockedUsers, ...blockedBy])]
  const myFollowingUsers = userProfile?.subscribedUsers || []

  useEffect(() => {
    if (!userProfile?.everyoneNetworkEnabled) {
      navigation.goBack()
      return
    }
    const unsubscribe = subscribeToConfluencePosts((postList) => {
      setPosts(postList)
    })

    // Subscribe to network users for 2-degree filtering
    const unsubNetwork = subscribeToNetworkUsers((users) => {
      setAllNetworkUsers(users)
    })

    return () => {
      unsubscribe()
      unsubNetwork()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Build 2-degree connection graph and filter posts
  const connectedUserIds = buildConnectedUserIds(
    user?.uid,
    allNetworkUsers,
    excludedUsers,
    myFollowingUsers
  )
  const visiblePosts = posts.filter(
    (post) => !excludedUsers.includes(post.authorId) && connectedUserIds.has(post.authorId)
  )

  // Split posts into 2 columns for masonry layout
  const leftColumn = []
  const rightColumn = []
  let leftHeight = 0
  let rightHeight = 0

  visiblePosts.forEach((post, index) => {
    const ratio = ASPECT_RATIOS[index % ASPECT_RATIOS.length]
    const height = COLUMN_WIDTH * ratio

    if (leftHeight <= rightHeight) {
      leftColumn.push({ ...post, height })
      leftHeight += height + COLUMN_GAP
    } else {
      rightColumn.push({ ...post, height })
      rightHeight += height + COLUMN_GAP
    }
  })

  // Flag/report handlers
  const openFlagModal = async () => {
    playClick()
    if (!user?.uid || !selectedPost) return
    const result = await checkExistingConfluenceReport(user.uid, selectedPost.id)
    if (result.exists) {
      setFlagAlert({
        visible: true,
        title: 'Already Reported',
        message: 'You have already reported this post. Your report is being reviewed.',
      })
      return
    }
    setFlagReason('')
    setFlagDetails('')
    setShowFlagModal(true)
  }

  const handleSubmitFlag = async () => {
    playClick()
    if (!flagReason) {
      setFlagAlert({
        visible: true,
        title: 'Select a reason',
        message: 'Please select a reason for flagging this post.',
      })
      return
    }
    if (!user?.uid || !selectedPost) return
    setFlagLoading(true)
    try {
      await reportConfluencePost(
        user.uid,
        selectedPost.id,
        selectedPost.authorId,
        flagReason,
        flagDetails,
        {
          imageUrl: selectedPost.imageUrl || null,
          caption: selectedPost.caption || null,
          authorId: selectedPost.authorId,
          postedAt: selectedPost.createdAt || null,
        }
      )
      setFlagLoading(false)
      setShowFlagModal(false)
      setSelectedPost(null)
      setFlagAlert({
        visible: true,
        title: 'Report Submitted',
        message: 'Thank you. Your report has been submitted for review.',
      })
    } catch (_error) {
      setFlagLoading(false)
      setFlagAlert({
        visible: true,
        title: 'Error',
        message: 'Failed to submit report. Please try again.',
      })
    }
  }

  // Edit/Delete handlers for own posts
  const handleEditPost = () => {
    playClick()
    if (!selectedPost) return
    setEditCaption(selectedPost.caption || '')
    setEditLink(selectedPost.link || '')
    setEditLinkLabel(selectedPost.linkLabel || '')
    setShowEditModal(true)
  }

  const handleSaveEdit = async () => {
    playClick()
    if (!selectedPost) return
    setEditLoading(true)
    try {
      const result = await updateConfluencePost(selectedPost.id, {
        caption: editCaption.trim(),
        link: editLink.trim(),
        linkLabel: editLinkLabel.trim(),
      })
      if (result.success) {
        setShowEditModal(false)
        setSelectedPost(null)
      } else {
        Alert.alert('Error', result.error || 'Could not update post.')
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Could not update post.')
    }
    setEditLoading(false)
  }

  const handleDeletePost = () => {
    playClick()
    if (!selectedPost || !user?.uid) return
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this confluence post?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteConfluencePost(selectedPost.id, user.uid)
            if (result.success) {
              setSelectedPost(null)
            } else {
              Alert.alert('Error', result.error || 'Could not delete post.')
            }
          },
        },
      ]
    )
  }

  const EDIT_CHAR_LIMIT = 75
  const editCombinedLength = editCaption.length + editLinkLabel.length

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Main Container with green border */}
      <View style={styles.mainContainer}>
        {/* Fixed Header */}
        <View style={styles.fixedHeader}>
          {/* Header Row */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <TouchableOpacity
                onPress={() => navigation.navigate('MainTabs', { screen: 'HomeTab' })}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ padding: 4 }}
              >
                <Ionicons name="chevron-back" size={24} color={colors.textGreen} />
              </TouchableOpacity>
              <Ionicons
                name="globe-outline"
                size={22}
                color={colors.primary}
                style={{ marginLeft: 4 }}
              />
            </View>
            <TouchableOpacity
              style={styles.uploadButtonOuter}
              onPress={() => { playClick(); navigation.navigate('ConfluenceAddPost') }}
            >
              <LinearGradient colors={['#cafb6c', '#71f200', '#23ff0d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.uploadButton}>
                <LinearGradient colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']} style={styles.uploadButtonHighlight} />
                <Ionicons name="add" size={14} color={colors.textDark} />
                <Text style={styles.uploadButtonText}>Upload</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Title */}
          <Text style={styles.title}>Confluence</Text>

          {/* Description */}
          <Text style={styles.description}>Share cultural recs: Music, Film, Art...(archive)</Text>
        </View>

        {/* Scrollable Masonry Grid */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          onScrollBeginDrag={handleScrollBeginDrag}
          scrollEventThrottle={16}
        >
          {visiblePosts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="images-outline" size={48} color={colors.offline} />
              <Text style={styles.emptyText}>No confluences yet. Upload one!</Text>
            </View>
          ) : (
            <View style={styles.masonryContainer}>
              {/* Left Column */}
              <View style={styles.masonryColumn}>
                {leftColumn.map((post) => (
                  <TouchableOpacity
                    key={post.id}
                    style={[styles.masonryItem, { height: post.height }]}
                    activeOpacity={0.8}
                    onPress={() => setSelectedPost(post)}
                  >
                    {post.imageUrl ? (
                      <Image source={{ uri: post.imageUrl }} style={styles.masonryImage} />
                    ) : (
                      <View style={styles.masonryPlaceholder}>
                        <Ionicons name="image-outline" size={30} color={colors.offline} />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Right Column */}
              <View style={styles.masonryColumn}>
                {rightColumn.map((post) => (
                  <TouchableOpacity
                    key={post.id}
                    style={[styles.masonryItem, { height: post.height }]}
                    activeOpacity={0.8}
                    onPress={() => setSelectedPost(post)}
                  >
                    {post.imageUrl ? (
                      <Image source={{ uri: post.imageUrl }} style={styles.masonryImage} />
                    ) : (
                      <View style={styles.masonryPlaceholder}>
                        <Ionicons name="image-outline" size={30} color={colors.offline} />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </View>

      {/* Image Popup Modal */}
      <Modal
        visible={!!selectedPost && !showFlagModal}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPost(null)}
      >
        <TouchableWithoutFeedback onPress={() => setSelectedPost(null)}>
          <View style={styles.popupOverlay}>
            <View style={styles.popupContent}>
              {selectedPost?.imageUrl && (
                <Image
                  source={{ uri: selectedPost.imageUrl }}
                  style={[styles.popupImage, { height: popupImageHeight }]}
                  resizeMode="contain"
                />
              )}
              <View style={styles.popupCaptionBar}>
                {/* Caption row */}
                {selectedPost?.caption ? (
                  <Text style={styles.popupCaptionText}>// {selectedPost.caption}</Text>
                ) : null}

                {/* Link + icons row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: selectedPost?.caption ? 6 : 0 }}>
                  {selectedPost?.link ? (
                    <TouchableOpacity
                      onPress={() => {
                        playClick()
                        const url = selectedPost.link.startsWith('http')
                          ? selectedPost.link
                          : `https://${selectedPost.link}`
                        Linking.openURL(url).catch(() => {})
                      }}
                      style={{ flex: 1 }}
                    >
                      <Text style={styles.popupLinkText} numberOfLines={1}>
                        {selectedPost.linkLabel || selectedPost.link}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={{ flex: 1 }} />
                  )}
                  {selectedPost?.authorId === user?.uid ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginLeft: 12 }}>
                      <TouchableOpacity
                        onPress={handleEditPost}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="pencil-outline" size={16} color={colors.textPrimary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleDeletePost}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="trash-outline" size={16} color="#ff6b6b" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={openFlagModal}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      style={{ marginLeft: 12 }}
                    >
                      <Ionicons name="flag-outline" size={16} color={colors.textPrimary} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Flag/Report Modal */}
      <Modal
        visible={showFlagModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFlagModal(false)}
      >
        <View style={styles.popupOverlay}>
          <View style={styles.flagModalContent}>
            <Text style={styles.flagTitle}>Report this post</Text>

            {FLAG_REASONS.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={styles.flagReasonRow}
                onPress={() => { playClick(); setFlagReason(item.key) }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={flagReason === item.key ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.flagReasonText}>{item.label}</Text>
              </TouchableOpacity>
            ))}

            {flagReason === 'other' && (
              <TextInput
                style={styles.flagDetailsInput}
                placeholder="Details..."
                placeholderTextColor="#888"
                value={flagDetails}
                onChangeText={setFlagDetails}
                maxLength={500}
                multiline
              />
            )}

            <View style={styles.flagButtonRow}>
              <TouchableOpacity
                style={styles.flagCancelButton}
                onPress={() => { playClick(); setShowFlagModal(false) }}
              >
                <Text style={styles.flagCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.flagSubmitButtonOuter}
                onPress={handleSubmitFlag}
                disabled={flagLoading}
              >
                <LinearGradient colors={['#cafb6c', '#71f200', '#23ff0d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.flagSubmitButton}>
                  <LinearGradient colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']} style={styles.flagSubmitButtonHighlight} />
                  {flagLoading ? (
                    <ActivityIndicator size="small" color={colors.textDark} />
                  ) : (
                    <Text style={styles.flagSubmitText}>Submit</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Dark-themed Alert Modal */}
      <Modal
        visible={flagAlert.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setFlagAlert({ visible: false, title: '', message: '' })}
      >
        <View style={styles.popupOverlay}>
          <View style={styles.flagModalContent}>
            <Text style={styles.flagTitle}>{flagAlert.title}</Text>
            <Text style={styles.flagAlertMessage}>{flagAlert.message}</Text>
            <View style={{ alignItems: 'center' }}>
              <TouchableOpacity
                style={styles.flagAlertOkButtonOuter}
                onPress={() => { playClick(); setFlagAlert({ visible: false, title: '', message: '' }) }}
              >
                <LinearGradient colors={['#cafb6c', '#71f200', '#23ff0d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.flagAlertOkButton}>
                  <LinearGradient colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']} style={styles.flagAlertOkButtonHighlight} />
                  <Text style={styles.flagSubmitText}>OK</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Post Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.popupOverlay}>
          <View style={styles.flagModalContent}>
            <Text style={styles.flagTitle}>Edit Post</Text>

            <Text style={styles.editFieldLabel}>Caption</Text>
            <TextInput
              style={styles.editInput}
              value={editCaption}
              onChangeText={setEditCaption}
              placeholder="// caption goes here"
              placeholderTextColor="#888"
              maxLength={Math.max(editCaption.length, EDIT_CHAR_LIMIT - editLinkLabel.length)}
            />
            <Text style={styles.editCharCount}>{editCombinedLength}/75</Text>

            <Text style={styles.editFieldLabel}>Link Label</Text>
            <TextInput
              style={styles.editInput}
              value={editLinkLabel}
              onChangeText={setEditLinkLabel}
              placeholder="Label (e.g. Sign Up Here)"
              placeholderTextColor="#888"
              maxLength={Math.max(editLinkLabel.length, EDIT_CHAR_LIMIT - editCaption.length)}
            />

            <Text style={styles.editFieldLabel}>URL</Text>
            <TextInput
              style={styles.editInput}
              value={editLink}
              onChangeText={setEditLink}
              placeholder="Paste URL"
              placeholderTextColor="#888"
              autoCapitalize="none"
              keyboardType="url"
            />

            <View style={styles.flagButtonRow}>
              <TouchableOpacity
                style={styles.flagCancelButton}
                onPress={() => { playClick(); setShowEditModal(false) }}
              >
                <Text style={styles.flagCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.flagSubmitButtonOuter}
                onPress={handleSaveEdit}
                disabled={editLoading}
              >
                <LinearGradient colors={['#cafb6c', '#71f200', '#23ff0d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.flagSubmitButton}>
                  <LinearGradient colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']} style={styles.flagSubmitButtonHighlight} />
                  {editLoading ? (
                    <ActivityIndicator size="small" color={colors.textDark} />
                  ) : (
                    <Text style={styles.flagSubmitText}>Save</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Dark Tab Bar with auto-hide */}
      <DarkTabBar ref={tabBarRef} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Main Container with green border
  mainContainer: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#00FF00',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 16,
    overflow: 'hidden',
  },

  // Fixed Header
  fixedHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 0,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  uploadButtonOuter: {
    borderRadius: 16,
    shadowColor: '#23ff0d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
    borderLeftColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    borderRightColor: 'rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
  },
  uploadButtonHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  uploadButtonText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.textDark,
    marginLeft: 2,
  },

  // Title
  title: {
    fontSize: 20,
    fontFamily: fonts.regular,
    color: colors.textGreen,
    marginBottom: 12,
    textAlign: 'center',
  },

  // Description
  description: {
    fontSize: 11,
    fontFamily: fonts.mono,
    color: colors.primary,
    lineHeight: 16,
    marginBottom: 20,
  },

  // Masonry Grid
  masonryContainer: {
    flexDirection: 'row',
    gap: COLUMN_GAP,
  },
  masonryColumn: {
    flex: 1,
    gap: COLUMN_GAP,
  },
  masonryItem: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  masonryImage: {
    width: '100%',
    height: '100%',
  },
  masonryPlaceholder: {
    flex: 1,
    backgroundColor: colors.backgroundCard,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Image Popup
  popupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popupContent: {
    width: SCREEN_WIDTH - 32,
    borderRadius: 12,
    overflow: 'hidden',
  },
  popupImage: {
    width: '100%',
    backgroundColor: '#000',
  },
  popupCaptionBar: {
    flexDirection: 'column',
    backgroundColor: '#111111',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  popupCaptionText: {
    fontSize: 13,
    fontFamily: fonts.mono,
    color: colors.textPrimary,
  },
  popupLinkText: {
    fontSize: 13,
    fontFamily: fonts.mono,
    color: colors.textPrimary,
    textDecorationLine: 'underline',
  },

  // Flag/Report Modal
  flagModalContent: {
    width: SCREEN_WIDTH - 48,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
  },
  flagTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 20,
    textAlign: 'center',
  },
  flagReasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  flagReasonText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
  },
  flagDetailsInput: {
    backgroundColor: '#222',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 13,
    padding: 12,
    marginTop: 8,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  flagButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
    gap: 12,
  },
  flagCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  flagCancelText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.offline,
  },
  flagSubmitButtonOuter: {
    borderRadius: 8,
    shadowColor: '#23ff0d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  flagSubmitButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
    borderLeftColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    borderRightColor: 'rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
  },
  flagSubmitButtonHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  flagSubmitText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textDark,
  },
  flagAlertOkButtonOuter: {
    borderRadius: 8,
    shadowColor: '#23ff0d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  flagAlertOkButton: {
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
    borderLeftColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    borderRightColor: 'rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
  },
  flagAlertOkButtonHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  flagAlertMessage: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.offline,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },

  // Empty
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: fonts.italic,
    color: colors.offline,
    marginTop: 8,
  },

  // Edit Modal
  editFieldLabel: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textGreen,
    marginBottom: 6,
    marginTop: 4,
  },
  editInput: {
    backgroundColor: '#222',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  editCharCount: {
    textAlign: 'right',
    fontSize: 11,
    fontFamily: fonts.mono,
    color: colors.offline,
    marginTop: -8,
    marginBottom: 12,
  },
})

export default ConfluenceLandingScreen
