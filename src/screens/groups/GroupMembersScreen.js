// Group Members Screen
// Displays all members in a group (avatar grid similar to UserListScreen)
// Creator can remove members via long-press

import React, { useState, useCallback, useRef } from 'react'
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
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useFocusEffect } from '@react-navigation/native'
import { colors } from '../../theme'
import { fonts } from '../../theme/typography'
import { useAuth } from '../../contexts/AuthContext'
import { getGroupMembers, removeMember } from '../../services/groupService'
import { ConfirmModal } from '../../components/common'
import LightTabBar from '../../components/navigation/LightTabBar'

const GroupMembersScreen = ({ navigation, route }) => {
  const { groupId, groupName, creatorId } = route.params
  const { user, userProfile } = useAuth()
  const [members, setMembers] = useState([])
  const [filteredMembers, setFilteredMembers] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)
  const lightTabRef = useRef(null)
  const lastScrollY = useRef(0)

  const isCreator = user?.uid === creatorId

  // Scroll-based tab bar show/hide
  const handleScroll = (event) => {
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

  // Build excluded user list from hidden/blocked
  const hiddenUsers = userProfile?.hiddenUsers || []
  const blockedUsers = userProfile?.blockedUsers || []
  const blockedBy = userProfile?.blockedBy || []
  const excludedUsers = [...new Set([...hiddenUsers, ...blockedUsers, ...blockedBy])]

  const fetchMembers = async () => {
    setLoading(true)
    const result = await getGroupMembers(groupId)
    if (result.success) {
      const visibleMembers = result.data.filter(
        (m) => m.id === user?.uid || !excludedUsers.includes(m.id)
      )
      setMembers(visibleMembers)
      setFilteredMembers(visibleMembers)
    }
    setLoading(false)
  }

  useFocusEffect(
    useCallback(() => {
      fetchMembers()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupId])
  )

  // Filter by search query
  React.useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      const queryDigits = query.replace(/\D/g, '')
      const filtered = members.filter(
        (m) =>
          (m.name && m.name.toLowerCase().includes(query)) ||
          (queryDigits.length >= 3 && m.phoneNumber && m.phoneNumber.includes(queryDigits))
      )
      setFilteredMembers(filtered)
    } else {
      setFilteredMembers(members)
    }
  }, [searchQuery, members])

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchMembers()
    setRefreshing(false)
  }

  const handleMemberPress = (memberId) => {
    navigation.navigate('UserProfile', { userId: memberId })
  }

  const handleMemberLongPress = (member) => {
    // Only creator can remove members, and can't remove themselves
    if (!isCreator) return
    if (member.id === user?.uid) return

    setSelectedMember(member)
    setShowModal(true)
  }

  const handleRemoveMember = async () => {
    if (!selectedMember) return

    const result = await removeMember(groupId, selectedMember.id)
    if (result.success) {
      Alert.alert('Removed', `${selectedMember.name || 'Member'} has been removed from the group.`)
      await fetchMembers()
    } else {
      Alert.alert('Error', 'Could not remove member.')
    }

    setShowModal(false)
    setSelectedMember(null)
  }

  const renderMember = ({ item }) => {
    const isSelf = item.id === user?.uid
    const isGroupCreator = item.id === creatorId

    return (
      <TouchableOpacity
        style={styles.memberItem}
        onPress={() => handleMemberPress(item.id)}
        onLongPress={() => handleMemberLongPress(item)}
        delayLongPress={500}
      >
        {item.profilePhoto ? (
          <Image source={{ uri: item.profilePhoto, cache: 'reload' }} style={styles.memberPhoto} />
        ) : (
          <View style={styles.memberPhotoPlaceholder}>
            <Ionicons name="person" size={24} color={colors.textSecondary} />
          </View>
        )}
        <Text style={styles.memberName} numberOfLines={1}>
          {item.name || 'Unknown'}
        </Text>
        {isGroupCreator && <Text style={styles.creatorBadge}>creator</Text>}
        {isSelf && !isGroupCreator && <Text style={styles.youBadge}>you</Text>}
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.backgroundLight} />
      <View style={styles.mainContainer}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ padding: 4 }}
            >
              <Ionicons name="chevron-back" size={28} color={colors.textDark} />
            </TouchableOpacity>
          </View>

          {/* Title */}
          <Text style={styles.title}>Members</Text>

          {/* Subtitle Row with Add Member Button */}
          <View style={styles.subtitleRow}>
            <Text style={styles.subtitle}>
              {groupName} — {members.length} {members.length === 1 ? 'member' : 'members'}
            </Text>
            <TouchableOpacity
              style={styles.addMemberButtonOuter}
              onPress={() => navigation.navigate('InviteMember', { groupId, groupName })}
            >
              <LinearGradient
                colors={['#cafb6c', '#71f200', '#23ff0d']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.addMemberButton}
              >
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']}
                  style={styles.addMemberButtonHighlight}
                />
                <Ionicons name="add" size={16} color={colors.textDark} />
                <Text style={styles.addMemberText}>Member</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color={colors.offline} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or number..."
              placeholderTextColor={colors.offline}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={colors.offline} />
              </TouchableOpacity>
            )}
          </View>

          {/* Creator hint */}
          {isCreator && <Text style={styles.creatorHint}>Long-press a member to remove them</Text>}

          {/* Member Grid */}
          <FlatList
            data={filteredMembers}
            renderItem={renderMember}
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
                <Text style={styles.emptyText}>{loading ? 'Loading...' : 'No members found'}</Text>
              </View>
            }
          />
        </KeyboardAvoidingView>

        {/* Confirm Remove Modal */}
        <ConfirmModal
          visible={showModal}
          title="Remove Member"
          message={`Remove ${selectedMember?.name || 'this member'} from ${groupName}?`}
          confirmText="Remove"
          cancelText="Cancel"
          onConfirm={handleRemoveMember}
          onCancel={() => {
            setShowModal(false)
            setSelectedMember(null)
          }}
        />
      </View>

      {/* Light Tab Bar */}
      <LightTabBar ref={lightTabRef} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    marginBottom: 8,
  },

  // Title
  title: {
    fontSize: 22,
    fontFamily: fonts.bold,
    color: colors.textDark,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  // Subtitle Row
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 11,
    fontFamily: fonts.italic,
    color: colors.offline,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginHorizontal: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textDark,
    marginLeft: 8,
    textAlign: 'left',
    textAlignVertical: 'center',
    paddingVertical: 0,
  },

  // Add Member Button
  addMemberButtonOuter: {
    borderRadius: 20,
    shadowColor: '#23ff0d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  addMemberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  addMemberText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textDark,
    marginLeft: 4,
  },

  // Creator hint
  creatorHint: {
    fontSize: 11,
    fontFamily: fonts.italic,
    color: colors.offline,
    textAlign: 'center',
    marginBottom: 12,
  },

  // List
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 80,
  },
  memberItem: {
    flex: 1,
    alignItems: 'center',
    margin: 6,
    maxWidth: '25%',
  },
  memberPhoto: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginBottom: 6,
  },
  memberPhotoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#a3a3a3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  memberName: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textDark,
    textAlign: 'center',
    maxWidth: 90,
  },
  creatorBadge: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: colors.primary,
    marginTop: 2,
  },
  youBadge: {
    fontSize: 10,
    fontFamily: fonts.italic,
    color: colors.offline,
    marginTop: 2,
  },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.offline,
  },
})

export default GroupMembersScreen
