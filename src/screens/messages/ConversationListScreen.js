// ConversationListScreen - Shows all user's conversations
// Matches ProfileScreen tab navigator hide/show pattern
// Green-bordered container matching ProfileScreen/MyGroupsScreen

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Text,
  Image,
  Alert,
  ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useFocusEffect } from '@react-navigation/native'
import { colors } from '../../theme'
import { fonts } from '../../theme/typography'
import { useAuth } from '../../contexts/AuthContext'
import { useTabBar } from '../../contexts/TabBarContext'
import {
  subscribeToConversations,
  deleteConversation,
  acceptMessageRequest,
  declineMessageRequest,
} from '../../services/messageService'
import ConversationItem from '../../components/messages/ConversationItem'
import { playClick } from '../../services/soundService'

const ConversationListScreen = ({ navigation }) => {
  const { user, userProfile } = useAuth()
  const [conversations, setConversations] = useState([])
  const [messageRequests, setMessageRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const { showTabBar, hideTabBar, resetTimer } = useTabBar()
  const [showRequests, setShowRequests] = useState(false)
  const lastScrollY = useRef(0)

  // Reset tab bar timer when screen is focused
  useFocusEffect(
    useCallback(() => {
      resetTimer()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  )

  useEffect(() => {
    if (!user?.uid) return

    const unsubscribe = subscribeToConversations(user.uid, (convos) => {
      // Filter out conversations with blocked users (both directions)
      const blockedUsers = userProfile?.blockedUsers || []
      const blockedBy = userProfile?.blockedBy || []
      const excludedUsers = [...new Set([...blockedUsers, ...blockedBy])]
      const filtered = convos.filter((convo) => {
        const otherUserId = convo.participants?.find((id) => id !== user.uid)
        return !excludedUsers.includes(otherUserId)
      })

      // Split into accepted conversations and pending message requests
      const accepted = []
      const pending = []

      filtered.forEach((convo) => {
        if (convo.status === 'pending' && convo.initiatedBy !== user.uid) {
          // This is a message request FROM someone else TO the current user
          pending.push(convo)
        } else {
          // Accepted conversations OR conversations the current user initiated (even if pending)
          accepted.push(convo)
        }
      })

      setConversations(accepted)
      setMessageRequests(pending)
      setLoading(false)
    })

    return () => unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid])

  const handleScroll = (event) => {
    const currentScrollY = event.nativeEvent.contentOffset.y
    const contentHeight = event.nativeEvent.contentSize.height
    const layoutHeight = event.nativeEvent.layoutMeasurement.height
    const scrollDirection = currentScrollY > lastScrollY.current ? 'down' : 'up'

    const scrollableHeight = contentHeight - layoutHeight
    const scrollPercent = scrollableHeight > 0 ? currentScrollY / scrollableHeight : 0

    if (scrollDirection === 'down' && scrollPercent > 0.5) {
      hideTabBar()
    } else if (scrollDirection === 'up') {
      showTabBar()
    }

    lastScrollY.current = currentScrollY
  }

  const handleScrollBeginDrag = () => {
    showTabBar()
  }

  const handleConversationPress = (conversation, otherUserId, otherProfile) => {
    playClick()
    // Use getParent() to navigate from tab to stack-level Chat screen
    const parentNav = navigation.getParent() || navigation
    parentNav.navigate('Chat', {
      conversationId: conversation.id,
      otherUserId,
      otherUserName: otherProfile.name,
      otherUserPhoto: otherProfile.profilePhoto,
    })
  }

  const handleDeleteConversation = async (conversationId) => {
    if (!user?.uid) return
    await deleteConversation(conversationId, user.uid)
  }

  // Accept a chat request → mark as accepted, navigate to chat
  const handleAcceptRequest = async (conversation, otherUserId, otherProfile) => {
    const result = await acceptMessageRequest(conversation.id)
    if (result.success) {
      const parentNav = navigation.getParent() || navigation
      parentNav.navigate('Chat', {
        conversationId: conversation.id,
        otherUserId,
        otherUserName: otherProfile.name,
        otherUserPhoto: otherProfile.profilePhoto,
      })
    }
  }

  // Decline a chat request → sends "perhaps another time", deletes the conversation
  const handleDeclineRequest = (conversation) => {
    playClick()
    const otherUserId = conversation.participants?.find((id) => id !== user?.uid)
    const otherProfile = conversation.participantProfiles?.[otherUserId] || {}
    Alert.alert(
      'Decline Request',
      `Decline chat request from ${otherProfile.name || 'this user'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            await declineMessageRequest(conversation.id)
          },
        },
      ]
    )
  }

  const handleGoBack = () => {
    playClick()
    // Navigate to ProfileTab (inside tabs) so tab bar remains visible
    navigation.navigate('ProfileTab')
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Main Container with green border - stays on screen */}
      <View style={styles.mainContainer}>
        {/* Back button + Logo row */}
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
            <Ionicons name="chevron-back" size={28} color={colors.textGreen} />
          </TouchableOpacity>
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/images/green-logo.png')}
              style={styles.logoImage}
            />
          </View>
        </View>

        {/* 90-day retention notice */}
        <Text style={styles.retentionNotice}>
          Messages are automatically deleted after 90 days.
        </Text>

        {/* Header Row: title */}
        <View style={styles.headerRow}>
          <Text style={styles.title}>Messages</Text>
        </View>

        {/* Scrollable conversation list inside the green border */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          onScroll={handleScroll}
          onScrollBeginDrag={handleScrollBeginDrag}
          scrollEventThrottle={16}
        >
          {/* Message Requests Banner */}
          {!loading && messageRequests.length > 0 && (
            <TouchableOpacity
              style={styles.requestsBanner}
              onPress={() => { playClick(); setShowRequests(!showRequests); }}
            >
              <View style={styles.requestsBannerLeft}>
                <Ionicons name="mail-unread-outline" size={20} color={colors.textDark} />
                <Text style={styles.requestsBannerText}>
                  Message Requests ({messageRequests.length})
                </Text>
              </View>
              <Ionicons
                name={showRequests ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.textDark}
              />
            </TouchableOpacity>
          )}

          {/* Message Requests List (collapsible) */}
          {showRequests &&
            messageRequests.map((item) => {
              const reqOtherUserId = item.participants?.find((id) => id !== user?.uid)
              const reqOtherProfile = item.participantProfiles?.[reqOtherUserId] || {}
              return (
                <View key={item.id} style={styles.requestItem}>
                  <ConversationItem
                    conversation={item}
                    currentUserId={user?.uid}
                    onPress={() => {}} // No navigation for pending requests
                    onDelete={handleDeleteConversation}
                    isRequest
                  />
                  <View style={styles.requestActions}>
                    <TouchableOpacity
                      style={styles.declineBtn}
                      onPress={() => handleDeclineRequest(item)}
                    >
                      <Text style={styles.declineBtnText}>Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.acceptBtnOuter}
                      onPress={() => { playClick(); handleAcceptRequest(item, reqOtherUserId, reqOtherProfile); }}
                    >
                      <LinearGradient colors={['#cafb6c', '#71f200', '#23ff0d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.acceptBtn}>
                        <LinearGradient colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']} style={styles.acceptBtnHighlight} />
                        <Text style={styles.acceptBtnText}>Accept</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              )
            })}

          {/* Conversations List */}
          {loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Loading...</Text>
            </View>
          ) : conversations.length === 0 && messageRequests.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.offline} />
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>Start a conversation from a user's profile</Text>
            </View>
          ) : conversations.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptySubtext}>No accepted messages</Text>
            </View>
          ) : (
            conversations.map((item) => (
              <View key={item.id}>
                <ConversationItem
                  conversation={item}
                  currentUserId={user?.uid}
                  onPress={handleConversationPress}
                  onDelete={handleDeleteConversation}
                />
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Main Container with green border - fixed on screen
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },

  // Logo inside container
  // Back button + Logo row
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  logoContainer: {
    alignItems: 'flex-end',
    marginTop: -8,
  },
  logoImage: {
    width: 250,
    height: 250,
  },

  // Header Row
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    marginLeft: -12,
  },
  title: {
    fontSize: 20,
    fontFamily: fonts.regular,
    color: colors.primary,
    marginLeft: 4,
  },

  // Message Requests Banner
  requestsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.lilac,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  requestsBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  requestsBannerText: {
    color: colors.textDark,
    fontSize: 14,
    fontFamily: fonts.bold,
  },

  // Request Item with actions
  requestItem: {
    marginBottom: 8,
  },
  requestActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 70,
    marginTop: -4,
    marginBottom: 8,
  },
  declineBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  declineBtnText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontFamily: fonts.bold,
  },
  acceptBtnOuter: {
    borderRadius: 16,
    shadowColor: '#23ff0d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  acceptBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
    borderLeftColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    borderRightColor: 'rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
  },
  acceptBtnHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  acceptBtnText: {
    color: colors.textDark,
    fontSize: 13,
    fontFamily: fonts.bold,
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    color: colors.offline,
    fontSize: 16,
    fontFamily: fonts.regular,
    marginTop: 12,
  },
  emptySubtext: {
    color: colors.offline,
    fontSize: 13,
    fontFamily: fonts.italic,
    marginTop: 4,
  },
  retentionNotice: {
    color: colors.primary,
    fontSize: 11,
    fontFamily: fonts.italic,
    textAlign: 'center',
    marginTop: 0,
    opacity: 0.7,
    marginBottom: 10,
  },
})

export default ConversationListScreen
