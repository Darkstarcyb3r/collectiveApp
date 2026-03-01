// User List Screen
// Displays lists of following, hidden, or blocked users

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  FlatList,
  TextInput,
  Image,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { ConfirmModal } from '../../components/common'
import { colors } from '../../theme'
import { fonts } from '../../theme/typography'
import DarkTabBar from '../../components/navigation/DarkTabBar'

import { useAuth } from '../../contexts/AuthContext'
import {
  getFollowingUsers,
  getFollowers,
  getHiddenUsers,
  getBlockedUsers,
  unfollowUser,
  removeFollower,
  unhideUser,
  unblockUser,
} from '../../services/userService'

const UserListScreen = ({ navigation, route }) => {
  const { type } = route.params // 'following', 'followers', 'hidden', or 'blocked'
  const { user, refreshUserProfile } = useAuth()
  const [users, setUsers] = useState([])
  const [filteredUsers, setFilteredUsers] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)

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

  const getTitle = () => {
    switch (type) {
      case 'following':
        return 'Following'
      case 'followers':
        return 'Followers'
      case 'hidden':
        return 'Hidden Users'
      case 'blocked':
        return 'Blocked Users'
      default:
        return 'Users'
    }
  }

  const fetchUsers = async () => {
    setLoading(true)
    let result

    switch (type) {
      case 'following':
        result = await getFollowingUsers(user.uid)
        break
      case 'followers':
        result = await getFollowers(user.uid)
        break
      case 'hidden':
        result = await getHiddenUsers(user.uid)
        break
      case 'blocked':
        result = await getBlockedUsers(user.uid)
        break
      default:
        result = { success: true, data: [] }
    }

    if (result.success) {
      setUsers(result.data)
      setFilteredUsers(result.data)
    }
    setLoading(false)
  }

  useFocusEffect(
    useCallback(() => {
      fetchUsers()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [type])
  )

  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      const queryDigits = query.replace(/\D/g, '')
      const filtered = users.filter(
        (u) =>
          (u.name && u.name.toLowerCase().includes(query)) ||
          (queryDigits.length >= 3 && u.phoneNumber && u.phoneNumber.includes(queryDigits))
      )
      setFilteredUsers(filtered)
    } else {
      setFilteredUsers(users)
    }
  }, [searchQuery, users])

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchUsers()
    setRefreshing(false)
  }

  const handleUserPress = (userId) => {
    navigation.navigate('UserProfile', { userId })
  }

  const handleUserLongPress = (selectedUserData) => {
    setSelectedUser(selectedUserData)
    setShowModal(true)
  }

  const getModalMessage = () => {
    switch (type) {
      case 'following':
        return 'Unfollow this user?'
      case 'followers':
        return 'Remove this follower?'
      case 'hidden':
        return 'Unhide this user?'
      case 'blocked':
        return 'Unblock this user?'
      default:
        return ''
    }
  }

  const handleConfirmAction = async () => {
    if (!selectedUser) return

    const removedId = selectedUser.id
    let result

    switch (type) {
      case 'following':
        result = await unfollowUser(user.uid, selectedUser.id)
        break
      case 'followers':
        result = await removeFollower(user.uid, selectedUser.id)
        break
      case 'hidden':
        result = await unhideUser(user.uid, selectedUser.id)
        break
      case 'blocked':
        result = await unblockUser(user.uid, selectedUser.id)
        break
    }

    setShowModal(false)
    setSelectedUser(null)

    // Optimistically remove the user from local state immediately
    if (!result || result.success) {
      setUsers((prev) => prev.filter((u) => u.id !== removedId))
      setFilteredUsers((prev) => prev.filter((u) => u.id !== removedId))
    }

    await refreshUserProfile()
  }

  const renderUser = ({ item }) => (
    <TouchableOpacity
      style={styles.userItem}
      onPress={() => handleUserPress(item.id)}
      onLongPress={() => handleUserLongPress(item)}
    >
      {item.profilePhoto ? (
        <Image source={{ uri: item.profilePhoto, cache: 'reload' }} style={styles.userPhoto} />
      ) : (
        <View style={styles.userPhotoPlaceholder}>
          <Ionicons name="person" size={24} color={colors.textSecondary} />
        </View>
      )}
      <Text style={styles.userName} numberOfLines={1}>
        {item.name && item.name.length > 10 ? item.name.substring(0, 10) + '...' : item.name || ''}
      </Text>
    </TouchableOpacity>
  )

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Main Container with green border */}
        <View style={styles.mainContainer}>
          {/* Header Row */}
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ padding: 4 }}
            >
              <Ionicons name="chevron-back" size={28} color={colors.textGreen} />
            </TouchableOpacity>

            <Text style={styles.title}>{getTitle()}</Text>
            <View style={{ width: 28 }} />
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#888" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by user name or phone number..."
              placeholderTextColor="#888"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#888" />
              </TouchableOpacity>
            )}
          </View>

          {type === 'followers' && (
            <Text style={styles.longPressHint}>long press to remove follower</Text>
          )}

          {/* User Grid */}
          <FlatList
            data={filteredUsers}
            renderItem={renderUser}
            keyExtractor={(item) => item.id}
            numColumns={4}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
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
                <Text style={styles.emptyText}>
                  {loading
                    ? 'Loading...'
                    : searchQuery.trim()
                      ? 'no users found'
                      : {
                          following: 'not following any users yet',
                          followers: 'no users are following you yet',
                          hidden: 'no hidden users',
                          blocked: 'no blocked users',
                        }[type]}
                </Text>
              </View>
            }
          />
        </View>
      </KeyboardAvoidingView>

      {/* Confirm Modal */}
      <ConfirmModal
        visible={showModal}
        message={getModalMessage()}
        confirmText="Confirm"
        cancelText="Go Back"
        onConfirm={handleConfirmAction}
        onCancel={() => {
          setShowModal(false)
          setSelectedUser(null)
        }}
      />

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
    borderColor: colors.primary,
    padding: 16,
    margin: 16,
    marginTop: 20,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    marginTop: 8,
  },
  title: {
    fontSize: 18,
    fontFamily: fonts.regular,
    color: colors.textGreen,
    textAlign: 'center',
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundCard,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 18,
  },
  longPressHint: {
    fontSize: 11,
    fontFamily: fonts.italic,
    color: '#888',
    textAlign: 'center',
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 11,
    fontFamily: fonts.italic,
    color: colors.textPrimary,
    marginLeft: 12,
  },
  listContent: {
    paddingBottom: 40,
    fontFamily: fonts.regular,
  },
  userItem: {
    width: '25%',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 6,
  },
  userPhoto: {
    width: 56,
    height: 56,
    borderRadius: 9999,
  },
  userPhotoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 9999,
    backgroundColor: colors.backgroundCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: 10,
    fontFamily: fonts.regular,
    color: '#888',
    marginTop: 4,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.textGreen,
  },
})

export default UserListScreen
