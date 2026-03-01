// Group Detail / Feed Screen — matches Figma "GroupFeedScreen"
// Creator avatar, edit_group link, group name/description, +Member, member avatars,
// +Post button, post cards with author avatar/title/date/content/image, edit_post link for author

import React, { useState, useCallback, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  FlatList,
  Image,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native'
import Swipeable from 'react-native-gesture-handler/Swipeable'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { colors } from '../../theme'
import { fonts } from '../../theme/typography'
import { useAuth } from '../../contexts/AuthContext'
import {
  getGroup,
  getGroupPosts,
  deleteGroup,
  deletePost,
  getMemberProfiles,
  leaveGroup,
} from '../../services/groupService'
import { getUserProfile } from '../../services/userService'
import { ConfirmModal } from '../../components/common'
import LightTabBar from '../../components/navigation/LightTabBar'

const GroupDetailScreen = ({ navigation, route }) => {
  const { groupId } = route.params
  const { user, userProfile } = useAuth()
  const hiddenUsers = userProfile?.hiddenUsers || []
  const blockedUsers = userProfile?.blockedUsers || []
  const blockedBy = userProfile?.blockedBy || []
  const excludedUsers = [...new Set([...hiddenUsers, ...blockedUsers, ...blockedBy])]
  const [group, setGroup] = useState(null)
  const [posts, setPosts] = useState([])
  const [creator, setCreator] = useState(null)
  const [memberProfiles, setMemberProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [deleteGroupConfirm, setDeleteGroupConfirm] = useState(false)
  const [leaveGroupConfirm, setLeaveGroupConfirm] = useState(false)
  const [deletePostConfirm, setDeletePostConfirm] = useState({ visible: false, postId: null })
  const [postLastViewed, setPostLastViewed] = useState({})
  const lightTabRef = useRef(null)
  const lastScrollY = useRef(0)

  // Scroll-based tab bar show/hide (mirrors dark tab bar behavior)
  const handleScroll = (event) => {
    const currentScrollY = event.nativeEvent.contentOffset.y
    const contentHeight = event.nativeEvent.contentSize.height
    const layoutHeight = event.nativeEvent.layoutMeasurement.height
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

  // Load post last-viewed timestamps from AsyncStorage
  const loadPostLastViewed = async () => {
    if (!user?.uid) return
    try {
      const key = `postLastViewed_${user.uid}_${groupId}`
      const stored = await AsyncStorage.getItem(key)
      if (stored) {
        setPostLastViewed(JSON.parse(stored))
      }
    } catch (_err) {
      // silently fail
    }
  }

  // Check if a post has unseen changes
  const isPostUnseen = (post) => {
    const lastViewed = postLastViewed[post.id] || 0
    // Check updatedAt (post edits)
    const updatedMs = post.updatedAt?.toDate
      ? post.updatedAt.toDate().getTime()
      : post.updatedAt?.seconds
        ? post.updatedAt.seconds * 1000
        : 0
    // Check createdAt (new posts never viewed)
    const createdMs = post.createdAt?.toDate
      ? post.createdAt.toDate().getTime()
      : post.createdAt?.seconds
        ? post.createdAt.seconds * 1000
        : 0
    const latestChange = Math.max(updatedMs, createdMs)
    return latestChange > lastViewed
  }

  const fetchData = async () => {
    setLoading(true)

    // Fetch group details
    const groupResult = await getGroup(groupId)
    if (!groupResult.success) {
      setLoading(false)
      Alert.alert('Not Found', 'This group has been deleted.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ])
      return
    }
    setGroup(groupResult.data)

    // Fetch creator info
    const creatorResult = await getUserProfile(groupResult.data.creatorId)
    if (creatorResult.success) {
      setCreator({ id: groupResult.data.creatorId, ...creatorResult.data })
    }

    // Fetch member profiles for avatar banner — filter out excluded users
    const members = groupResult.data.members || []
    const visibleMembers = members.filter((id) => !excludedUsers.includes(id))
    if (visibleMembers.length > 0) {
      const membersResult = await getMemberProfiles(visibleMembers, 4)
      if (membersResult.success) {
        setMemberProfiles(membersResult.data)
      }
    }

    // Fetch posts — filter out hidden and blocked users
    const postsResult = await getGroupPosts(groupId)
    if (postsResult.success) {
      const visiblePosts = postsResult.data.filter((p) => !excludedUsers.includes(p.authorId))
      setPosts(visiblePosts)
    }

    setLoading(false)
  }

  useFocusEffect(
    useCallback(() => {
      fetchData()
      loadPostLastViewed()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupId])
  )

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  const isCreator = group?.creatorId === user?.uid
  const isMember = group?.members?.includes(user?.uid) || false
  const allMembers = group?.members || []
  const visibleMemberIds = allMembers.filter((id) => !excludedUsers.includes(id))
  const totalMembers = visibleMemberIds.length

  const formatDate = (timestamp) => {
    if (!timestamp) return ''
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    })
  }

  const handleDeleteGroup = () => {
    setDeleteGroupConfirm(true)
  }

  const handleConfirmDeleteGroup = async () => {
    setDeleteGroupConfirm(false)
    const result = await deleteGroup(groupId, user.uid)
    if (result.success) {
      navigation.goBack()
    } else {
      Alert.alert('Error', 'Could not delete group.')
    }
  }

  const handleLeaveGroup = () => {
    setLeaveGroupConfirm(true)
  }

  const handleConfirmLeaveGroup = async () => {
    setLeaveGroupConfirm(false)
    const result = await leaveGroup(groupId, user.uid)
    if (result.success) {
      navigation.goBack()
    } else {
      Alert.alert('Error', 'Could not leave group.')
    }
  }

  const handleViewMembers = () => {
    navigation.navigate('GroupMembers', {
      groupId,
      groupName: group?.name,
      creatorId: group?.creatorId,
    })
  }

  const swipeableRefs = useRef({})

  const renderPostDeleteAction = (progress, dragX, post) => {
    const trans = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [80, 0],
    })

    return (
      <Animated.View style={[styles.swipeDeleteAction, { transform: [{ translateX: trans }] }]}>
        <TouchableOpacity
          onPress={() => {
            swipeableRefs.current[post.id]?.close()
            setDeletePostConfirm({ visible: true, postId: post.id })
          }}
          style={styles.swipeDeleteButton}
        >
          <Ionicons name="trash-outline" size={22} color="#000000" />
        </TouchableOpacity>
      </Animated.View>
    )
  }

  const renderPostCard = ({ item }) => {
    const isPostAuthor = item.authorId === user?.uid
    const unseen = isPostUnseen(item)

    const postCard = (
      <TouchableOpacity
        style={styles.postCard}
        onPress={() =>
          navigation.navigate('PostDetail', { groupId, postId: item.id, groupName: group?.name })
        }
        activeOpacity={0.8}
      >
        {/* Unseen changes green dot */}
        {unseen && <View style={styles.unseenDot} />}

        {/* Post Header: author avatar + edit link + icons/date */}
        <View style={styles.postHeader}>
          {/* Author Avatar (Left) */}
          <TouchableOpacity
            onPress={() => {
              if (item.author?.id) {
                navigation.navigate('UserProfile', { userId: item.author.id })
              }
            }}
          >
            {item.author?.profilePhoto ? (
              <Image
                source={{ uri: item.author.profilePhoto, cache: 'reload' }}
                style={styles.postAuthorAvatar}
              />
            ) : (
              <View style={styles.postAuthorPlaceholder}>
                <Ionicons name="person" size={16} color="#666" />
              </View>
            )}
          </TouchableOpacity>

          {/* Right Side Container: Edit Link + Icons + Date */}
          <View style={styles.postRightContainer}>
            <View style={styles.postTopRow} />

            {/* Date (right-aligned) */}
            <Text style={styles.postDate}>{formatDate(item.createdAt)}</Text>
          </View>
        </View>

        {/* Post Title */}
        <Text style={styles.postTitle}>{item.title}</Text>

        {/* Post Content Preview + Chevron Row */}
        <View style={styles.postContentRow}>
          <Text style={styles.postContent} numberOfLines={3}>
            {item.content}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.offline}
            style={styles.postChevronInline}
          />
        </View>

        {/* Post Banner Image Preview */}
        {item.imageUrl && <Image source={{ uri: item.imageUrl }} style={styles.postBannerImage} />}
      </TouchableOpacity>
    )

    // Only post authors can swipe to delete
    if (isPostAuthor) {
      return (
        <Swipeable
          ref={(ref) => {
            swipeableRefs.current[item.id] = ref
          }}
          renderRightActions={(progress, dragX) => renderPostDeleteAction(progress, dragX, item)}
          rightThreshold={40}
          overshootRight={false}
        >
          {postCard}
        </Swipeable>
      )
    }

    return postCard
  }

  if (loading || !group) {
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

      <View style={styles.mainContainer}>
        {/* Fixed Header Section */}
        <View style={styles.fixedHeader}>
          {/* Header: back chevron + Creator Avatar */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="chevron-back" size={28} color={colors.textDark} />
            </TouchableOpacity>

            {/* Creator section — avatar links to creator's profile (hidden if blocked) */}
            {creator?.id && !excludedUsers.includes(creator.id) && (
              <TouchableOpacity
                style={styles.creatorSection}
                onPress={() => {
                  navigation.navigate('UserProfile', { userId: creator.id })
                }}
              >
                {creator?.profilePhoto ? (
                  <Image
                    source={{ uri: creator.profilePhoto, cache: 'reload' }}
                    style={styles.creatorAvatar}
                  />
                ) : (
                  <View style={styles.creatorAvatarPlaceholder}>
                    <Ionicons name="person" size={18} color="#666" />
                  </View>
                )}
                <View style={styles.creatorInfo}>
                  <Text style={styles.creatorName}>{creator?.name || 'creator'}</Text>
                  <Text style={styles.creatorLabel}>creator</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* Group Name row + trash (creator only) + edit link (creator only) */}
          <View style={styles.groupNameRow}>
            <Text style={styles.groupName}>{group.name}</Text>
            {isCreator && (
              <TouchableOpacity onPress={() => navigation.navigate('EditGroup', { groupId })}>
                <Text style={styles.editGroupLink}>edit_group</Text>
              </TouchableOpacity>
            )}
            {isCreator && (
              <TouchableOpacity style={styles.trashButton} onPress={handleDeleteGroup}>
                <Ionicons name="trash-outline" size={20} color={colors.offline} />
              </TouchableOpacity>
            )}
          </View>

          {/* Group Description */}
          <Text style={styles.groupDescription}>
            {group.description || 'what is your group about?'}
          </Text>

          {/* Group Banner Image */}
          {group.bannerUrl ? (
            <Image
              source={{ uri: group.bannerUrl }}
              style={styles.groupBanner}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.groupBannerPlaceholder}>
              <Ionicons name="image-outline" size={28} color={colors.borderLight} />
            </View>
          )}

          {/* Action Row: +Post button + avatar banner + Members button */}
          <View style={styles.actionRow}>
            {isMember && (
              <TouchableOpacity
                style={styles.postButton}
                onPress={() =>
                  navigation.navigate('CreatePost', { groupId, groupName: group.name })
                }
              >
                <Ionicons name="add" size={16} color={colors.textDark} />
                <Text style={styles.postButtonText}>Post</Text>
              </TouchableOpacity>
            )}

            {/* Member Avatar Banner */}
            <TouchableOpacity style={styles.memberAvatarBanner} onPress={handleViewMembers}>
              {memberProfiles.slice(0, 4).map((member, idx) => (
                <View
                  key={member.id}
                  style={[styles.memberAvatarWrapper, { marginLeft: idx > 0 ? -10 : 0 }]}
                >
                  {member.profilePhoto ? (
                    <Image
                      source={{ uri: member.profilePhoto, cache: 'reload' }}
                      style={styles.memberAvatar}
                    />
                  ) : (
                    <View style={styles.memberAvatarPlaceholder}>
                      <Ionicons name="person" size={12} color="#666" />
                    </View>
                  )}
                </View>
              ))}
              {totalMembers > 4 && (
                <View style={[styles.memberAvatarPlaceholder, { marginLeft: -10 }]}>
                  <Text style={styles.memberCountText}>+{totalMembers - 4}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Members button */}
            <TouchableOpacity style={styles.membersButton} onPress={handleViewMembers}>
              <Ionicons name="people-outline" size={14} color={colors.textDark} />
              <Text style={styles.membersButtonText}>Members</Text>
            </TouchableOpacity>
          </View>

          {/* Posts expiry note + Leave group */}
          <View style={styles.expiryRow}>
            <Text style={styles.postsExpiry}>posts last for 90 days</Text>
            {isMember && !isCreator && (
              <TouchableOpacity onPress={handleLeaveGroup}>
                <Text style={styles.leaveGroupText}>leave group</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Scrollable Posts Section */}
        <FlatList
          data={posts}
          renderItem={renderPostCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          onScroll={handleScroll}
          onScrollBeginDrag={handleScrollBeginDrag}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No posts yet. Be the first to post!</Text>
            </View>
          }
        />

        {/* Delete Group Confirm Modal */}
        <ConfirmModal
          visible={deleteGroupConfirm}
          title="Delete Group"
          message="This will permanently delete the group and all posts. Are you sure?"
          confirmText="Delete"
          onConfirm={handleConfirmDeleteGroup}
          onCancel={() => setDeleteGroupConfirm(false)}
        />

        {/* Leave Group Confirm Modal */}
        <ConfirmModal
          visible={leaveGroupConfirm}
          icon="exit-outline"
          iconColor="#FFFFFF"
          title="Leave Group"
          message={`Are you sure you want to leave "${group?.name}"?`}
          confirmText="Leave"
          onConfirm={handleConfirmLeaveGroup}
          onCancel={() => setLeaveGroupConfirm(false)}
        />

        {/* Delete Post Confirm Modal */}
        <ConfirmModal
          visible={deletePostConfirm.visible}
          title="Delete Post"
          message="Are you sure you want to delete this post? This cannot be undone."
          confirmText="Delete"
          onConfirm={async () => {
            const pid = deletePostConfirm.postId
            setDeletePostConfirm({ visible: false, postId: null })
            const result = await deletePost(groupId, pid)
            if (result.success) {
              setPosts((prev) => prev.filter((p) => p.id !== pid))
            } else {
              Alert.alert('Error', 'Could not delete post.')
            }
          }}
          onCancel={() => setDeletePostConfirm({ visible: false, postId: null })}
        />
      </View>

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
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 16,
    overflow: 'hidden',
  },
  fixedHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
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
    paddingVertical: 8,
  },
  // Creator Section
  creatorSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  creatorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  creatorAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#a3a3a3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorInfo: {
    marginLeft: 8,
  },
  creatorName: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.offline,
  },
  creatorLabel: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.textDark,
  },

  // Group Name Row
  groupNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  trashButton: {
    marginLeft: 10,
    padding: 4,
  },
  groupName: {
    flex: 1,
    fontSize: 20,
    fontFamily: fonts.bold,
    color: colors.textDark,
  },
  editGroupLink: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textDark,
    textDecorationLine: 'underline',
    marginLeft: 8,
  },

  // Description
  groupDescription: {
    fontSize: 13,
    fontFamily: fonts.italic,
    color: colors.offline,
    marginBottom: 16,
    lineHeight: 20,
  },

  // Group Banner
  groupBanner: {
    width: '100%',
    aspectRatio: 3,
    borderRadius: 12,
    marginBottom: 16,
  },
  groupBannerPlaceholder: {
    width: '100%',
    aspectRatio: 3,
    borderRadius: 12,
    backgroundColor: '#e8e6f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderStyle: 'dashed',
  },

  // Action Row
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  postButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  postButtonText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textDark,
    marginLeft: 4,
  },

  // Member Avatar Banner
  memberAvatarBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  memberAvatarWrapper: {
    zIndex: 1,
  },
  memberAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.backgroundLight,
  },
  memberAvatarPlaceholder: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#a3a3a3',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.backgroundLight,
  },
  memberCountText: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: '#fff',
  },
  membersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginRight: 6,
  },
  membersButtonText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textDark,
    marginLeft: 4,
  },

  // Posts Expiry Row
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  postsExpiry: {
    fontSize: 11,
    fontFamily: fonts.italic,
    color: colors.offline,
  },
  leaveGroupText: {
    fontSize: 11,
    fontFamily: fonts.italic,
    color: colors.offline,
    textDecorationLine: 'underline',
  },

  // Post Card
  postCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    position: 'relative',
  },
  unseenDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    zIndex: 2,
  },

  // Post Header Layout
  postHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between', // Pushes avatar left, content right
    marginBottom: 10,
  },
  postRightContainer: {
    flex: 1,
    marginLeft: 10,
    alignItems: 'flex-end', // Aligns everything inside to the right
  },
  postTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 9,
    justifyContent: 'flex-end', // Pushes edit link and icon to the right
    width: '100%',
  },
  postAuthorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  postAuthorPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#a3a3a3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Post Date
  postDate: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.offline,
    textAlign: 'right',
  },
  postTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.textDark,
    marginBottom: 8,
  },
  postContentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  postContent: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.offline,
    lineHeight: 20,
  },
  postChevronInline: {
    marginLeft: 8,
    marginTop: 2,
  },
  postBannerImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    marginTop: 12,
  },
  // Swipe-to-delete action
  swipeDeleteAction: {
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 14,
    marginBottom: 16,
  },
  swipeDeleteButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
  },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.offline,
  },
})

export default GroupDetailScreen
