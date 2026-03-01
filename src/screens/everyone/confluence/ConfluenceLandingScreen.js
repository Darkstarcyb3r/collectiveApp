// Confluence Landing Screen
// Masonry-style image grid feed (archive — posts are never deleted)
// Green border container, 5 posts/month per user

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
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../../theme'
import { fonts } from '../../../theme/typography'
import { useAuth } from '../../../contexts/AuthContext'
import {
  subscribeToConfluencePosts,
  subscribeToNetworkUsers,
  reportConfluencePost,
  checkExistingConfluenceReport,
} from '../../../services/everyoneService'
import { buildConnectedUserIds } from '../../../utils/networkGraph'
import DarkTabBar from '../../../components/navigation/DarkTabBar'

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
  const [allNetworkUsers, setAllNetworkUsers] = useState([])
  const [showFlagModal, setShowFlagModal] = useState(false)
  const [flagReason, setFlagReason] = useState('')
  const [flagDetails, setFlagDetails] = useState('')
  const [flagLoading, setFlagLoading] = useState(false)
  const [flagAlert, setFlagAlert] = useState({ visible: false, title: '', message: '' })

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
              style={styles.uploadButton}
              onPress={() => navigation.navigate('ConfluenceAddPost')}
            >
              <Ionicons name="add" size={14} color={colors.textDark} />
              <Text style={styles.uploadButtonText}>Upload</Text>
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
                  style={styles.popupImage}
                  resizeMode="cover"
                />
              )}
              <View style={styles.popupCaptionBar}>
                {selectedPost?.caption ? (
                  <Text style={styles.popupCaptionText}>// {selectedPost.caption}</Text>
                ) : selectedPost?.link ? (
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    onPress={() => {
                      const url = selectedPost.link.startsWith('http')
                        ? selectedPost.link
                        : `https://${selectedPost.link}`
                      Linking.openURL(url).catch(() => {})
                    }}
                  >
                    <Text style={styles.popupLinkText}>
                      {selectedPost.linkLabel || selectedPost.link}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{ flex: 1 }} />
                )}
                <TouchableOpacity
                  onPress={openFlagModal}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="flag-outline" size={16} color={colors.textPrimary} />
                </TouchableOpacity>
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
                onPress={() => setFlagReason(item.key)}
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
                onPress={() => setShowFlagModal(false)}
              >
                <Text style={styles.flagCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.flagSubmitButton}
                onPress={handleSubmitFlag}
                disabled={flagLoading}
              >
                {flagLoading ? (
                  <ActivityIndicator size="small" color={colors.textDark} />
                ) : (
                  <Text style={styles.flagSubmitText}>Submit</Text>
                )}
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
                style={styles.flagAlertOkButton}
                onPress={() => setFlagAlert({ visible: false, title: '', message: '' })}
              >
                <Text style={styles.flagSubmitText}>OK</Text>
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
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
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
    height: SCREEN_WIDTH - 32,
  },
  popupCaptionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111111',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  popupCaptionText: {
    flex: 1,
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
  flagSubmitButton: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  flagSubmitText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textDark,
  },
  flagAlertOkButton: {
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 8,
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
})

export default ConfluenceLandingScreen
