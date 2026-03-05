// Invite Contacts Overlay
// Reusable modal showing followed contacts to invite to a group or share an event
// Used by GroupDetailScreen, GroupMembersScreen, EventDetailScreen, and PostDetailScreen

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { colors } from '../../theme'
import { fonts } from '../../theme/typography'
import { useAuth } from '../../contexts/AuthContext'
import { getFollowingUsers } from '../../services/userService'
import { sendGroupInvitation, sendEventInvitation, sendPostShare } from '../../services/messageService'
import { playClick } from '../../services/soundService'

const InviteContactsOverlay = ({
  visible,
  onClose,
  groupId,
  groupName,
  eventId,
  eventTitle,
  postId,
  postTitle,
  existingMemberIds = [],
}) => {
  const isEvent = !!eventId
  const isPost = !!postId
  const itemName = isPost ? postTitle : isEvent ? eventTitle : groupName
  const shareType = isPost ? 'Post' : isEvent ? 'Event' : 'Group'
  const { user, userProfile } = useAuth()
  const [contacts, setContacts] = useState([])
  const [filteredContacts, setFilteredContacts] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [inviting, setInviting] = useState(null)
  const [invited, setInvited] = useState([])
  const debounceTimer = useRef(null)

  // Fetch followed contacts when overlay opens
  useEffect(() => {
    if (visible && user?.uid) {
      fetchContacts()
    }
    if (!visible) {
      // Reset state when closing
      setSearchQuery('')
      setInvited([])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, user?.uid])

  const fetchContacts = async () => {
    setLoading(true)
    try {
      const result = await getFollowingUsers(user.uid)
      if (result.success && result.data) {
        // Filter out existing members, self, hidden/blocked users
        const hidden = userProfile?.hiddenUsers || []
        const blocked = userProfile?.blockedUsers || []
        const blockedBy = userProfile?.blockedBy || []
        const excluded = [...new Set([...hidden, ...blocked, ...blockedBy, ...existingMemberIds])]

        const available = result.data.filter(
          (u) => u.id !== user.uid && !excluded.includes(u.id)
        )
        setContacts(available)
        setFilteredContacts(available)
      }
    } catch (_err) {
      // silently fail
    }
    setLoading(false)
  }

  // Search filter with debounce
  const handleSearch = useCallback(
    (text) => {
      setSearchQuery(text)
      if (debounceTimer.current) clearTimeout(debounceTimer.current)

      debounceTimer.current = setTimeout(() => {
        const trimmed = text.trim().toLowerCase()
        if (!trimmed) {
          setFilteredContacts(contacts)
        } else {
          setFilteredContacts(
            contacts.filter((u) => (u.name || '').toLowerCase().includes(trimmed))
          )
        }
      }, 300)
    },
    [contacts]
  )

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [])

  const handleInvite = async (targetUser) => {
    playClick()
    setInviting(targetUser.id)

    const targetProfile = { name: targetUser.name, profilePhoto: targetUser.profilePhoto }

    let result
    if (isPost) {
      result = await sendPostShare(
        user.uid,
        userProfile,
        targetUser.id,
        targetProfile,
        postId,
        postTitle,
        groupId,
        groupName
      )
    } else if (isEvent) {
      result = await sendEventInvitation(
        user.uid,
        userProfile,
        targetUser.id,
        targetProfile,
        eventId,
        eventTitle
      )
    } else {
      result = await sendGroupInvitation(
        user.uid,
        userProfile,
        targetUser.id,
        targetProfile,
        groupId,
        groupName
      )
    }

    if (result.success) {
      setInvited((prev) => [...prev, targetUser.id])
      const messages = {
        Post: { title: 'Post Shared', body: `"${postTitle}" has been shared with ${targetUser.name}.` },
        Event: { title: 'Event Shared', body: `"${eventTitle}" has been shared with ${targetUser.name}.` },
        Group: { title: 'Invitation Sent', body: `An invitation to join "${groupName}" has been sent to ${targetUser.name}'s messages.` },
      }
      Alert.alert(messages[shareType].title, messages[shareType].body)
    } else {
      Alert.alert('Error', `Could not share ${shareType.toLowerCase()}.`)
    }

    setInviting(null)
  }

  const renderContact = ({ item }) => {
    const alreadyInvited = invited.includes(item.id)

    return (
      <View style={styles.contactRow}>
        {item.profilePhoto ? (
          <Image source={{ uri: item.profilePhoto, cache: 'reload' }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={18} color="#666" />
          </View>
        )}

        <Text style={styles.contactName} numberOfLines={1}>
          {item.name || 'Unknown'}
        </Text>

        {alreadyInvited ? (
          <View style={styles.sentBadge}>
            <Ionicons name="checkmark" size={14} color={colors.textDark} />
            <Text style={styles.sentBadgeText}>Sent</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.inviteButtonOuter}
            onPress={() => handleInvite(item)}
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
                <Text style={styles.inviteButtonText}>{isPost || isEvent ? 'Share' : 'Invite'}</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    )
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        {/* Tap outside to close */}
        <TouchableOpacity style={styles.overlayTop} activeOpacity={1} onPress={onClose} />

        {/* Card */}
        <View style={styles.card}>
          {/* Handle bar */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Share {shareType}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={24} color={colors.textDark} />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>{isPost || isEvent ? `Share "${itemName}"` : `Invite to "${itemName}"`}</Text>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color={colors.offline} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={handleSearch}
              placeholder="Search..."
              placeholderTextColor={colors.offline}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => handleSearch('')}>
                <Ionicons name="close-circle" size={18} color={colors.offline} />
              </TouchableOpacity>
            )}
          </View>

          {/* Contact List */}
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <FlatList
              data={filteredContacts}
              renderItem={renderContact}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={styles.centerContainer}>
                  <Text style={styles.emptyText}>
                    {searchQuery ? 'No contacts match your search.' : 'No contacts to invite.'}
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  overlayTop: {
    flex: 1,
  },
  card: {
    backgroundColor: colors.backgroundLight,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    paddingBottom: 30,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ccc',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  title: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.textDark,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: fonts.italic,
    color: colors.offline,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 20,
    marginBottom: 12,
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
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#a3a3a3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactName: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textDark,
    marginLeft: 12,
  },
  inviteButtonOuter: {
    borderRadius: 16,
    shadowColor: '#23ff0d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  inviteButton: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 16,
    minWidth: 70,
    alignItems: 'center',
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
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  inviteButtonText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.textDark,
  },
  sentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    gap: 4,
  },
  sentBadgeText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textDark,
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
    paddingBottom: 20,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.offline,
  },
})

export default InviteContactsOverlay
