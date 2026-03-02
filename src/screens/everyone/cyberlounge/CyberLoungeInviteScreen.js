// Cyber Lounge Invite Screen
// Search for users to invite to a chatroom
// Follows same pattern as InviteMemberScreen for groups

import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { colors } from '../../../theme'
import { fonts } from '../../../theme/typography'
import { useAuth } from '../../../contexts/AuthContext'
import { searchUsers, searchUserByPhone } from '../../../services/userService'
import { subscribeToChatroom } from '../../../services/everyoneService'
import { sendChatroomInvitation } from '../../../services/messageService'
import { getMemberProfiles } from '../../../services/groupService'

const CyberLoungeInviteScreen = ({ navigation, route }) => {
  const { roomId, roomName } = route.params
  const { user, userProfile } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [inviting, setInviting] = useState(null)
  const [existingParticipants, setExistingParticipants] = useState([])
  const [activeMemberProfiles, setActiveMemberProfiles] = useState([])
  const [hasSearched, setHasSearched] = useState(false)
  const debounceTimer = useRef(null)

  // Subscribe to room participants in real-time
  useEffect(() => {
    const unsubscribe = subscribeToChatroom(roomId, (roomData) => {
      if (roomData) {
        setExistingParticipants(roomData.participants || [])
      }
    })
    return () => unsubscribe()
  }, [roomId])

  // Fetch active member profiles when participants change
  useEffect(() => {
    if (existingParticipants.length === 0) {
      setActiveMemberProfiles([])
      return
    }
    const fetchProfiles = async () => {
      const result = await getMemberProfiles(existingParticipants)
      if (result.success) {
        setActiveMemberProfiles(result.data)
      }
    }
    fetchProfiles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(existingParticipants)])

  // Live search with debounce
  const performSearch = useCallback(
    async (query) => {
      const trimmed = query.trim()
      if (!trimmed || trimmed.length < 2) {
        setResults([])
        setHasSearched(false)
        return
      }

      setLoading(true)
      setHasSearched(true)

      const isPhone = /^[\d\s\-()+]+$/.test(trimmed) && trimmed.replace(/\D/g, '').length >= 7

      // Build excluded user list from hidden/blocked
      const hiddenList = userProfile?.hiddenUsers || []
      const blockedList = userProfile?.blockedUsers || []
      const blockedByList = userProfile?.blockedBy || []
      const excluded = [...new Set([...hiddenList, ...blockedList, ...blockedByList])]

      let searchResults = []

      if (isPhone) {
        const phoneResult = await searchUserByPhone(trimmed)
        if (phoneResult.success && phoneResult.data) {
          // Filter out excluded users from phone search
          if (!excluded.includes(phoneResult.data.id)) {
            searchResults = [phoneResult.data]
          }
        }
      } else {
        const nameResult = await searchUsers(trimmed, user.uid)
        if (nameResult.success) {
          // searchUsers already filters blocked, but also filter hidden
          searchResults = nameResult.data.filter((u) => !excluded.includes(u.id))
        }
      }

      setResults(searchResults)
      setLoading(false)
    },
    [user?.uid, userProfile]
  )

  const handleChangeText = (text) => {
    setSearchQuery(text)

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    debounceTimer.current = setTimeout(() => {
      performSearch(text)
    }, 400)
  }

  // Clear debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [])

  const handleInvite = async (targetUserId, targetName, targetPhoto) => {
    setInviting(targetUserId)

    const result = await sendChatroomInvitation(
      user.uid,
      userProfile,
      targetUserId,
      { name: targetName, profilePhoto: targetPhoto },
      roomId,
      roomName
    )

    if (result.success) {
      Alert.alert(
        'Invitation Sent',
        `An invitation to join "${roomName}" has been sent to ${targetName}'s messages.`
      )
    } else {
      Alert.alert('Error', 'Could not send invitation.')
    }

    setInviting(null)
  }

  const renderUser = ({ item }) => {
    const isParticipant = existingParticipants.includes(item.id)
    const isSelf = item.id === user?.uid

    return (
      <View style={styles.userRow}>
        {item.profilePhoto ? (
          <Image source={{ uri: item.profilePhoto, cache: 'reload' }} style={styles.userAvatar} />
        ) : (
          <View style={styles.userAvatarPlaceholder}>
            <Ionicons name="person" size={18} color="#666" />
          </View>
        )}

        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name || 'Unknown'}</Text>
          {item.phoneNumber && <Text style={styles.userPhone}>{item.phoneNumber}</Text>}
        </View>

        {isSelf ? (
          <Text style={styles.selfLabel}>you</Text>
        ) : isParticipant ? (
          <View style={styles.memberBadge}>
            <Text style={styles.memberBadgeText}>In Room</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.inviteButtonOuter}
            onPress={() => handleInvite(item.id, item.name, item.profilePhoto)}
            disabled={inviting === item.id}
          >
            <LinearGradient
              colors={['#cafb6c', '#71f200', '#23ff0d']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.inviteButton}
            >
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']}
                style={styles.inviteButtonHighlight}
              />
              {inviting === item.id ? (
                <ActivityIndicator size="small" color={colors.textDark} />
              ) : (
                <Text style={styles.inviteButtonText}>Invite</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.backgroundLight} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.headerOuter}>
          <LinearGradient
            colors={['#d8f434', '#b3f425', '#93f478']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']}
              style={styles.headerHighlight}
            />
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ padding: 4 }}
            >
              <Ionicons name="chevron-back" size={24} color={colors.textDark} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Add Members</Text>
            <View style={{ width: 24 }} />
          </LinearGradient>
        </View>

        <Text style={styles.subtitle}>Invite to {roomName}</Text>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={colors.offline} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={handleChangeText}
            placeholder="Search by name or phone number..."
            placeholderTextColor={colors.offline}
            returnKeyType="search"
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('')
                setResults([])
                setHasSearched(false)
              }}
            >
              <Ionicons name="close-circle" size={18} color={colors.offline} />
            </TouchableOpacity>
          )}
        </View>

        {/* Active Members */}
        {activeMemberProfiles.length > 0 && (
          <View style={styles.activeMembersSection}>
            <Text style={styles.activeMembersLabel}>Active Members</Text>
            <View style={styles.activeMembersRow}>
              {activeMemberProfiles.map((member) => (
                <TouchableOpacity
                  key={member.id}
                  style={styles.activeMemberItem}
                  onPress={() => navigation.navigate('UserProfile', { userId: member.id })}
                >
                  {member.profilePhoto ? (
                    <Image
                      source={{ uri: member.profilePhoto, cache: 'reload' }}
                      style={styles.activeMemberAvatar}
                    />
                  ) : (
                    <View style={styles.activeMemberAvatarPlaceholder}>
                      <Ionicons name="person" size={16} color="#666" />
                    </View>
                  )}
                  <Text style={styles.activeMemberName} numberOfLines={1}>
                    {member.name || 'User'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Results */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={results}
            renderItem={renderUser}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            ListEmptyComponent={
              hasSearched ? (
                <View style={styles.centerContainer}>
                  <Text style={styles.emptyText}>No users found.</Text>
                  <Text style={styles.emptySubtext}>
                    They might not be on Collective yet.{' '}
                    <Text
                      style={styles.emptyLink}
                      onPress={() => Linking.openURL('https://apps.apple.com/us/app/collective-network/id6759182429')}
                    >
                      Share the app link
                    </Text>{' '}
                    to invite them!
                  </Text>
                </View>
              ) : null
            }
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },

  // Header
  headerOuter: {
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
    shadowColor: '#b3f425',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
    borderLeftColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    borderRightColor: 'rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
  },
  headerHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.textDark,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: fonts.italic,
    color: colors.offline,
    textAlign: 'center',
    marginBottom: 16,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textDark,
    marginLeft: 8,
  },

  // Active Members
  activeMembersSection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  activeMembersLabel: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.textDark,
    marginBottom: 16,
  },
  activeMembersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  activeMemberItem: {
    alignItems: 'center',
    width: 60,
  },
  activeMemberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginBottom: 4,
  },
  activeMemberAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#a3a3a3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  activeMemberName: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textDark,
    textAlign: 'center',
  },

  // List
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  userAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#a3a3a3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textDark,
  },
  userPhone: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.offline,
    marginTop: 2,
  },

  // Buttons / Badges
  selfLabel: {
    fontSize: 12,
    fontFamily: fonts.italic,
    color: colors.offline,
  },
  memberBadge: {
    backgroundColor: colors.secondary,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  memberBadgeText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textDark,
  },
  inviteButtonOuter: {
    borderRadius: 22,
    shadowColor: '#23ff0d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
    borderLeftColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    borderRightColor: 'rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
  },
  inviteButtonHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  inviteButtonText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.textDark,
  },

  // Empty / Center
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.offline,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 12,
    fontFamily: fonts.italic,
    color: colors.offline,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  emptyLink: {
    textDecorationLine: 'underline',
    color: colors.textDark,
  },
})

export default CyberLoungeInviteScreen
