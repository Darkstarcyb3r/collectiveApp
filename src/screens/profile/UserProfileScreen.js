// screens/profile/UserProfileScreen.js
// View another user's profile
import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Image,
  Text,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native'
import { Ionicons, FontAwesome5 } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useFocusEffect } from '@react-navigation/native'
import { colors } from '../../theme'
import { fonts } from '../../theme/typography'
import { useAuth } from '../../contexts/AuthContext'
import {
  getUserProfile,
  followUser,
  unfollowUser,
  hideUser,
  unhideUser,
  blockUser,
  unblockUser,
  updateSubscriptionPreferences,
  reportUser,
  checkExistingReport,
  checkPendingFollowRequest,
  cancelFollowRequest,
} from '../../services/userService'
import { sendChatRequest } from '../../services/messageService'
import { playClick } from '../../services/soundService'
import DarkTabBar from '../../components/navigation/DarkTabBar'

const UserProfileScreen = ({ route, navigation }) => {
  const { userId } = route.params || {}
  const { user, userProfile, refreshUserProfile } = useAuth()
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)

  // Track relationship states
  const [isFollowing, setIsFollowing] = useState(false)
  const [isRequested, setIsRequested] = useState(false)
  const [isHidden, setIsHidden] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)

  // Confirmation modal state
  const [modalVisible, setModalVisible] = useState(false)
  const [modalAction, setModalAction] = useState(null) // 'follow' | 'hide' | 'block'
  const [actionLoading, setActionLoading] = useState(false)

  // Notification preferences state
  const [showNotifPrefs, setShowNotifPrefs] = useState(false)
  const [notifPrefs, setNotifPrefs] = useState({
    groupPosts: true,
    hostedChats: true,
    events: true,
    barterMarketPosts: true,
    mutualAidPosts: true,
  })

  // Tab bar ref for scroll-based show/hide
  const tabBarRef = useRef(null)
  const lastScrollY = useRef(0)

  const handleScroll = useCallback((event) => {
    const currentY = event.nativeEvent.contentOffset.y
    if (currentY > lastScrollY.current && currentY > 20) {
      // Scrolling down — hide tab bar
      tabBarRef.current?.hide()
    }
    lastScrollY.current = currentY
  }, [])

  const handleScrollBeginDrag = useCallback(() => {
    // User started dragging — show tab bar
    tabBarRef.current?.show()
  }, [])

  // Flag/report state
  const [showFlagModal, setShowFlagModal] = useState(false)
  const [flagReason, setFlagReason] = useState('')
  const [flagDetails, setFlagDetails] = useState('')
  const [flagAlert, setFlagAlert] = useState({ visible: false, title: '', message: '' })

  useEffect(() => {
    const fetchUser = async () => {
      if (!userId) {
        setLoading(false)
        return
      }
      const result = await getUserProfile(userId)
      if (result.success) {
        setUserData(result.data)
      }
      setLoading(false)
    }
    fetchUser()
  }, [userId])

  // Check current relationship status from logged-in user's profile
  useEffect(() => {
    if (userProfile && userId) {
      const followingList = userProfile.subscribedUsers || []
      const hiddenList = userProfile.hiddenUsers || []
      const blockedList = userProfile.blockedUsers || []
      setIsFollowing(followingList.includes(userId))
      setIsHidden(hiddenList.includes(userId))
      setIsBlocked(blockedList.includes(userId))
    }
  }, [userProfile, userId])

  // Check for pending follow request (re-checks on screen focus)
  useFocusEffect(
    useCallback(() => {
      const checkRequest = async () => {
        if (!user?.uid || !userId) return
        const result = await checkPendingFollowRequest(user.uid, userId)
        if (result.success) {
          setIsRequested(result.pending)
        }
      }
      checkRequest()
    }, [user?.uid, userId])
  )

  const getModalMessage = () => {
    const name = userData?.name || 'this user'
    switch (modalAction) {
      case 'follow':
        if (isFollowing) return `Unfollow ${name}?`
        if (isRequested) return `Cancel follow request to ${name}?`
        if (userData?.isPrivate) return `Send follow request to ${name}?`
        return `Follow ${name}?`
      case 'hide':
        return isHidden ? `Unhide ${name}?` : `Hide ${name}?`
      case 'block':
        return isBlocked ? `Unblock ${name}?` : `Block ${name}?`
      default:
        return ''
    }
  }

  const handleConfirmAction = async () => {
    if (!user?.uid || !userId) {
      return
    }
    setActionLoading(true)

    let result
    switch (modalAction) {
      case 'follow':
        if (isFollowing) {
          // Unfollow
          result = await unfollowUser(user.uid, userId)
          if (result.success) setIsFollowing(false)
        } else if (isRequested) {
          // Cancel pending follow request
          result = await cancelFollowRequest(user.uid, userId)
          if (result.success) setIsRequested(false)
        } else {
          // Follow (or send request if private)
          result = await followUser(user.uid, userId, userProfile?.name, userProfile?.profilePhoto)
          if (result.success) {
            if (result.requested) {
              // Private profile — request sent, no notif prefs
              setIsRequested(true)
              setActionLoading(false)
              setModalVisible(false)
              Alert.alert('Request Sent', `${userData?.name || 'User'} will be notified of your follow request.`)
              return
            } else {
              // Public profile — instant follow
              setIsFollowing(true)
              await refreshUserProfile()
              setActionLoading(false)
              setModalVisible(false)
              setTimeout(() => openNotifPrefs(), 300)
              return
            }
          }
        }
        break
      case 'hide':
        result = isHidden ? await unhideUser(user.uid, userId) : await hideUser(user.uid, userId)
        if (result.success) setIsHidden(!isHidden)
        break
      case 'block':
        result = isBlocked ? await unblockUser(user.uid, userId) : await blockUser(user.uid, userId)
        if (result.success) {
          if (!isBlocked) {
            // Just blocked this user — close modal FIRST, then navigate home
            setActionLoading(false)
            setModalVisible(false)
            await refreshUserProfile()
            navigation.navigate('MainTabs')
            return
          } else {
            // Unblocked — navigate back to own profile
            setActionLoading(false)
            setModalVisible(false)
            await refreshUserProfile()
            navigation.navigate('MainTabs', { screen: 'ProfileTab' })
            return
          }
        }
        break
    }

    await refreshUserProfile()
    setActionLoading(false)
    setModalVisible(false)
  }

  const openConfirmation = (action) => {
    setModalAction(action)
    setShowNotifPrefs(false)
    setModalVisible(true)
  }

  // Open notification preferences modal (bell icon tap)
  const openNotifPrefs = () => {
    // Load existing preferences if available
    const existingPrefs = userProfile?.subscriptionPreferences?.[userId]
    if (existingPrefs) {
      setNotifPrefs({
        groupPosts: existingPrefs.groupPosts !== false,
        hostedChats: existingPrefs.hostedChats !== false,
        events: existingPrefs.events !== false,
        barterMarketPosts: existingPrefs.barterMarketPosts !== false,
        mutualAidPosts: existingPrefs.mutualAidPosts !== false,
      })
    } else {
      setNotifPrefs({
        groupPosts: true,
        hostedChats: true,
        events: true,
        barterMarketPosts: true,
        mutualAidPosts: true,
      })
    }
    setShowNotifPrefs(true)
    setModalVisible(true)
  }

  // Save notification preferences and close
  const handleSaveNotifPrefs = async () => {
    if (!user?.uid || !userId) return
    setActionLoading(true)
    await updateSubscriptionPreferences(user.uid, userId, notifPrefs)
    await refreshUserProfile()
    setActionLoading(false)
    setShowNotifPrefs(false)
    setModalVisible(false)
  }

  // Flag/report handlers
  const FLAG_REASONS = [
    { key: 'spam', label: 'Spam' },
    { key: 'harassment', label: 'Harassment' },
    { key: 'inappropriate', label: 'Inappropriate content' },
    { key: 'fake_profile', label: 'Fake profile' },
    { key: 'other', label: 'Other' },
  ]

  const openFlagModal = async () => {
    if (!user?.uid || !userId) return
    const result = await checkExistingReport(user.uid, userId)
    if (result.exists) {
      setFlagAlert({
        visible: true,
        title: 'Already Reported',
        message: 'You have already reported this user. Your report is being reviewed.',
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
        message: 'Please select a reason for flagging this user.',
      })
      return
    }
    if (!user?.uid || !userId) return
    setActionLoading(true)
    const result = await reportUser(user.uid, userId, flagReason, flagDetails)
    setActionLoading(false)
    if (result.success) {
      setShowFlagModal(false)
      setFlagAlert({
        visible: true,
        title: 'Report Submitted',
        message: 'Thank you. Your report has been submitted for review.',
      })
    } else {
      setFlagAlert({
        visible: true,
        title: 'Error',
        message: 'Failed to submit report. Please try again.',
      })
    }
  }

  // Two-way block check: if this user blocked you OR you blocked them
  const isBlockedByThem = (userProfile?.blockedBy || []).includes(userId)

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  // If user no longer exists (deleted account), show gone message
  if (!loading && !userData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        <View
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}
        >
          <Ionicons name="person-remove-outline" size={64} color={colors.offline} />
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 18,
              fontFamily: fonts.bold,
              marginTop: 16,
              textAlign: 'center',
            }}
          >
            User Not Found
          </Text>
          <Text
            style={{
              color: colors.offline,
              fontSize: 14,
              fontFamily: fonts.regular,
              marginTop: 8,
              textAlign: 'center',
            }}
          >
            This account no longer exists.
          </Text>
          <TouchableOpacity
            style={styles.goBackButtonShadow}
            onPress={() => navigation.goBack()}
          >
            <LinearGradient colors={['#cafb6c', '#71f200', '#23ff0d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.goBackButton}>
              <LinearGradient colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']} style={styles.goBackButtonHighlight} />
              <Text style={{ color: colors.textDark, fontSize: 14, fontFamily: fonts.medium }}>
                Go Back
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // If blocked in either direction, show unavailable profile
  if (isBlocked || isBlockedByThem) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 10 }}>
          <View style={[styles.mainContainer, { position: 'relative' }]}>
            {/* Back button — Pressable with absolute position so nothing can overlap it */}
            <Pressable
              style={({ pressed }) => [
                styles.blockedBackButton,
                { position: 'absolute', top: 16, left: 16, zIndex: 99, opacity: pressed ? 0.5 : 1 },
              ]}
              onPress={() => {
                navigation.navigate('MainTabs')
              }}
            >
              <Ionicons name="chevron-back" size={28} color={colors.textGreen} />
            </Pressable>

            {/* Centered lock content */}
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="lock-closed-outline" size={48} color={colors.offline} />
              <Text
                style={{
                  color: colors.offline,
                  fontSize: 14,
                  fontFamily: fonts.regular,
                  marginTop: 12,
                  textAlign: 'center',
                }}
              >
                This profile is unavailable
              </Text>
              {isBlocked && !isBlockedByThem && (
                <TouchableOpacity
                  onPress={() => { playClick(); openConfirmation('block'); }}
                  style={{ marginTop: 20 }}
                >
                  <Text
                    style={{
                      color: colors.primary,
                      fontSize: 13,
                      fontFamily: fonts.regular,
                      textDecorationLine: 'underline',
                    }}
                  >
                    Unblock this user
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Lilac Confirmation Modal (needed for unblock) — only mount when visible */}
        {modalVisible && (
          <Modal
            transparent
            visible={modalVisible}
            animationType="fade"
            onRequestClose={() => setModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContainer}>
                <Text style={styles.modalText}>{getModalMessage()}</Text>
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.modalButtonCancel}
                    onPress={() => { playClick(); setModalVisible(false); }}
                    disabled={actionLoading}
                  >
                    <Text style={styles.modalButtonCancelText}>cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalButtonConfirmShadow}
                    onPress={() => { playClick(); handleConfirmAction(); }}
                    disabled={actionLoading}
                  >
                    <LinearGradient colors={['#cafb6c', '#71f200', '#23ff0d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.modalButtonConfirm}>
                      <LinearGradient colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']} style={styles.modalButtonConfirmHighlight} />
                      {actionLoading ? (
                        <ActivityIndicator size="small" color={colors.textDark} />
                      ) : (
                        <Text style={styles.modalButtonConfirmText}>confirm</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}
      </SafeAreaView>
    )
  }

  const isOnline = userData?.isOnline || false

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Modal — confirmation or notification preferences (light theme) */}
      {modalVisible && (
        <Modal
          transparent
          visible={modalVisible}
          animationType="fade"
          onRequestClose={() => {
            setModalVisible(false)
            setShowNotifPrefs(false)
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              {showNotifPrefs ? (
                <>
                  {/* Notification Preferences View */}
                  <Text style={styles.modalText}>
                    Get notifications from{'\n'}
                    {userData?.name || 'this user'} for:
                  </Text>
                  <View style={styles.notifPrefsList}>
                    {[
                      { key: 'groupPosts', label: 'Group posts & comments' },
                      { key: 'hostedChats', label: 'Cyberlounge' },
                      { key: 'events', label: 'Event posts & comments' },
                      { key: 'barterMarketPosts', label: 'Barter market posts' },
                      { key: 'mutualAidPosts', label: 'Mutual aid posts' },
                    ].map((item) => (
                      <TouchableOpacity
                        key={item.key}
                        style={styles.notifPrefRow}
                        onPress={() => {
                          playClick()
                          setNotifPrefs((prev) => ({ ...prev, [item.key]: !prev[item.key] }))
                        }}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.notifBullet,
                            notifPrefs[item.key] && styles.notifBulletActive,
                          ]}
                        >
                          {notifPrefs[item.key] && <View style={styles.notifBulletInner} />}
                        </View>
                        <Text
                          style={[
                            styles.notifPrefLabel,
                            notifPrefs[item.key] && styles.notifPrefLabelActive,
                          ]}
                        >
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <TouchableOpacity
                      style={styles.flagAlertOkButtonShadow}
                      onPress={() => { playClick(); handleSaveNotifPrefs(); }}
                      disabled={actionLoading}
                    >
                      <LinearGradient colors={['#cafb6c', '#71f200', '#23ff0d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.flagAlertOkButton}>
                        <LinearGradient colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']} style={styles.flagAlertOkButtonHighlight} />
                        {actionLoading ? (
                          <ActivityIndicator size="small" color={colors.textDark} />
                        ) : (
                          <Text style={styles.flagSubmitText}>done</Text>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  {/* Standard Confirmation View */}
                  <Text style={styles.modalText}>{getModalMessage()}</Text>
                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={styles.modalButtonCancel}
                      onPress={() => { playClick(); setModalVisible(false); }}
                      disabled={actionLoading}
                    >
                      <Text style={styles.modalButtonCancelText}>cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.modalButtonConfirmShadow}
                      onPress={() => { playClick(); handleConfirmAction(); }}
                      disabled={actionLoading}
                    >
                      <LinearGradient colors={['#cafb6c', '#71f200', '#23ff0d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.modalButtonConfirm}>
                        <LinearGradient colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']} style={styles.modalButtonConfirmHighlight} />
                        {actionLoading ? (
                          <ActivityIndicator size="small" color={colors.textDark} />
                        ) : (
                          <Text style={styles.modalButtonConfirmText}>confirm</Text>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>
      )}

      {/* Dark-themed Flag/Report Modal */}
      <Modal
        visible={showFlagModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFlagModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.flagModalContent}>
            <Text style={styles.flagTitle}>Report this user</Text>
            {FLAG_REASONS.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={styles.flagReasonRow}
                onPress={() => { playClick(); setFlagReason(item.key); }}
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
                placeholder="Please describe the issue..."
                placeholderTextColor="#888"
                value={flagDetails}
                onChangeText={setFlagDetails}
                multiline
                maxLength={500}
              />
            )}
            <View style={styles.flagButtonRow}>
              <TouchableOpacity
                style={styles.flagCancelButton}
                onPress={() => { playClick(); setShowFlagModal(false); }}
                disabled={actionLoading}
              >
                <Text style={styles.flagCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.flagSubmitButtonShadow}
                onPress={() => { playClick(); handleSubmitFlag(); }}
                disabled={actionLoading}
              >
                <LinearGradient colors={['#cafb6c', '#71f200', '#23ff0d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.flagSubmitButton}>
                  <LinearGradient colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']} style={styles.flagSubmitButtonHighlight} />
                  {actionLoading ? (
                    <ActivityIndicator size="small" color="#000" />
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
        <View style={styles.modalOverlay}>
          <View style={styles.flagModalContent}>
            <Text style={styles.flagTitle}>{flagAlert.title}</Text>
            <Text style={styles.flagAlertMessage}>{flagAlert.message}</Text>
            <View style={{ alignItems: 'center' }}>
              <TouchableOpacity
                style={styles.flagAlertOkButtonShadow}
                onPress={() => { playClick(); setFlagAlert({ visible: false, title: '', message: '' }); }}
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

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        scrollEventThrottle={16}
      >
        {/* Main Container with Green Border */}
        <View style={styles.mainContainer}>
          {/* Back Button */}
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={28} color={colors.textGreen} />
          </TouchableOpacity>

          {/* Name & Number at Top */}
          <View style={styles.topFields}>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Name:</Text>
              <Text style={styles.fieldValue}>{userData?.name || 'Unknown'}</Text>
            </View>
          </View>

          {/* Middle Section - Photo and Left Content */}
          <View style={styles.middleSection}>
            <View style={styles.leftContent}>
              {/* Online Status Indicator */}
              <View style={styles.onlineStatusRow}>
                <View
                  style={[
                    styles.onlineDot,
                    { backgroundColor: isOnline ? colors.online : colors.offline },
                    isOnline && styles.onlineDotGlow,
                  ]}
                />
                <Text
                  style={[styles.onlineText, { color: isOnline ? colors.online : colors.offline }]}
                >
                  {isOnline ? 'online' : 'offline'}
                </Text>
              </View>

              {/* Message Button — left side, under online status */}
              <TouchableOpacity
                style={styles.messageButtonOuter}
                onPress={async () => {
                  playClick()
                  if (isBlocked) return
                  const result = await sendChatRequest(user.uid, userId, userProfile, {
                    name: userData?.name,
                    profilePhoto: userData?.profilePhoto,
                  })
                  if (result.success) {
                    if (result.status === 'accepted') {
                      // Already connected — go straight to chat
                      navigation.navigate('Chat', {
                        conversationId: result.conversationId,
                        otherUserId: userId,
                        otherUserName: userData?.name || 'Unknown',
                        otherUserPhoto: userData?.profilePhoto || null,
                      })
                    } else if (result.alreadySent) {
                      Alert.alert('Request Pending', 'Your chat request is still pending.')
                    } else {
                      Alert.alert(
                        'Request Sent',
                        `${userData?.name || 'This user'} will be notified of your chat request.`
                      )
                    }
                  } else {
                    Alert.alert('Error', result.error || 'Could not send chat request.')
                  }
                }}
              >
                <LinearGradient
                  colors={['#cafb6c', '#71f200', '#23ff0d']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.messageButton}
                >
                  <LinearGradient
                    colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']}
                    style={styles.messageButtonHighlight}
                  />
                  <FontAwesome5 name="envelope" size={16} color={colors.textDark} />
                  <Text style={styles.messageButtonText}>message</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Profile Photo */}
            <View style={styles.photoWrapper}>
              <View style={[styles.photoGlowWrapper, (isFollowing || isRequested) && styles.photoGlow]}>
                <View style={styles.photoContainer}>
                  {userData?.profilePhoto ? (
                    <Image
                      source={{ uri: userData.profilePhoto, cache: 'reload' }}
                      style={styles.profilePhoto}
                    />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Ionicons name="person" size={100} color="#666666" />
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* Quip Section */}
          <View style={styles.quipSection}>
            {/* Links row — follow+bell+flag left, hide+block right (under photo) */}
            <View style={styles.quipLinks}>
              {/* Left group: follow + bell + flag */}
              <View style={styles.quipLinksLeft}>
                <TouchableOpacity
                  onPress={() => { playClick(); openConfirmation('follow'); }}
                  hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                  style={styles.quipLinkTouchable}
                >
                  <Text style={[styles.quipLink, !isFollowing && !isRequested && styles.quipLinkActive]}>
                    {isFollowing ? 'following' : isRequested ? 'requested' : 'follow?'}
                  </Text>
                </TouchableOpacity>
                {isFollowing && (
                  <TouchableOpacity
                    onPress={() => { playClick(); openNotifPrefs(); }}
                    hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                    style={styles.bellIconTouchable}
                  >
                    <Ionicons name="notifications-outline" size={16} color={colors.primary} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => { playClick(); openFlagModal(); }}
                  hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                  style={styles.flagIconTouchable}
                >
                  <Ionicons name="flag-outline" size={17} color="#888" />
                </TouchableOpacity>
              </View>

              {/* Right group: hide + block (centered under photo) */}
              <View style={styles.quipLinksRight}>
                <TouchableOpacity
                  onPress={() => { playClick(); openConfirmation('hide'); }}
                  hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                  style={styles.quipLinkTouchable}
                >
                  <Text style={[styles.quipLink, !isHidden && styles.quipLinkActive]}>
                    {isHidden ? 'hidden' : 'hide'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { playClick(); openConfirmation('block'); }}
                  hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                  style={styles.quipLinkTouchable}
                >
                  <Text style={[styles.quipLink, !isBlocked && styles.quipLinkActive]}>
                    {isBlocked ? 'blocked' : 'block'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            {/* Label LAST (below links) */}
            <Text style={styles.quipLabel}>what's on my mind:</Text>
          </View>
          {/* Quip Display */}
          <View style={styles.quipBox}>
            <Text style={styles.quipText}>{userData?.quip || ''}</Text>
          </View>

          {/* Logo at Bottom */}
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/images/green-logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        </View>
      </ScrollView>

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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 40,
    flexGrow: 1,
  },
  mainContainer: {
    backgroundColor: colors.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: 24,
    flex: 1,
    minHeight: '80%',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    marginLeft: -12,
  },
  blockedBackButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  topFields: {
    marginBottom: 24,
  },

  // Middle Section - photo + left content
  middleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
    minHeight: 230,
  },
  leftContent: {
    flex: 1,
    justifyContent: 'space-around',
    paddingRight: 13,
  },
  onlineStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  onlineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 8,
  },
  onlineDotGlow: {
    shadowColor: colors.online,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 6,
  },
  onlineText: {
    fontSize: 14,
    fontFamily: fonts.regular,
  },
  photoWrapper: {
    position: 'relative',
  },
  messageButtonOuter: {
    borderRadius: 24,
    alignSelf: 'flex-start',
    shadowColor: '#23ff0d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
    borderLeftColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    borderRightColor: 'rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
  },
  messageButtonHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  messageButtonText: {
    color: colors.textDark,
    fontSize: 12,
    fontFamily: fonts.medium,
    marginLeft: 8,
    marginRight: 4,
  },

  // Photo
  photoGlowWrapper: {
    width: 170,
    height: 240,
    borderRadius: 110,
  },
  photoGlow: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 15,
  },
  photoContainer: {
    width: 170,
    height: 240,
    borderRadius: 110,
    overflow: 'hidden',
    backgroundColor: '#808080',
    marginTop: 0,
  },
  profilePhoto: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#a3a3a3',
  },

  // Fields
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  fieldLabel: {
    color: colors.primary,
    fontSize: 16,
    fontFamily: fonts.regular,
    marginRight: 8,
  },
  fieldValue: {
    color: colors.textGreen,
    fontSize: 16,
    fontFamily: fonts.italic,
    flex: 1,
  },

  // Quip Section
  quipSection: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginTop: 15,
    marginBottom: 12,
    gap: 10,
  },

  quipLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: fonts.italic,
    marginRight: 16,
  },

  quipLinks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
    width: '100%',
  },

  quipLinksLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  quipLinksRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },

  quipLinkTouchable: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },

  quipLink: {
    color: colors.primary,
    fontSize: 14,
    fontFamily: fonts.regular,
    textDecorationLine: 'underline',
  },
  quipLinkActive: {
    color: colors.offline,
  },
  quipBox: {
    backgroundColor: '#E8E8E8',
    borderRadius: 8,
    padding: 8,
    minHeight: 40,
    marginBottom: 24,
    marginTop: 0,
  },
  quipText: {
    color: '#000000',
    fontSize: 11,
    fontFamily: fonts.regular,
    lineHeight: 20,
  },

  bellIconTouchable: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },

  flagIconTouchable: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },

  // Dark-themed flag modal styles
  flagModalContent: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 40,
    minWidth: 260,
  },
  flagTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  flagReasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  flagReasonText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
  },
  flagDetailsInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    minHeight: 60,
    textAlignVertical: 'top',
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  flagButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  flagCancelButton: {
    flex: 1,
    backgroundColor: '#333333',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  flagCancelText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  flagSubmitButtonShadow: {
    flex: 1,
    borderRadius: 8,
    shadowColor: '#23ff0d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  flagSubmitButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
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
  flagAlertOkButtonShadow: {
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

  // Go Back Button (extracted from inline)
  goBackButtonShadow: {
    marginTop: 24,
    borderRadius: 20,
    shadowColor: '#23ff0d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  goBackButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
    borderLeftColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    borderRightColor: 'rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
  },
  goBackButtonHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },

  // Logo
  logoContainer: {
    alignItems: 'flex-end',
    marginTop: -40,
    marginBottom: -40,
  },
  logoImage: {
    width: 215,
    height: 215,
    marginRight: -30,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 40,
    alignItems: 'center',
    minWidth: 260,
  },
  modalText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontFamily: fonts.bold,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButtonCancel: {
    flex: 1,
    backgroundColor: '#333333',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancelText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontFamily: fonts.bold,
  },
  modalButtonConfirmShadow: {
    flex: 1,
    borderRadius: 8,
    shadowColor: '#23ff0d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  modalButtonConfirm: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
    borderLeftColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    borderRightColor: 'rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
  },
  modalButtonConfirmHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  modalButtonConfirmText: {
    color: colors.textDark,
    fontSize: 14,
    fontFamily: fonts.bold,
  },

  // Notification Preferences
  notifPrefsList: {
    width: '100%',
    marginBottom: 20,
    gap: 14,
  },
  notifPrefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 2,
  },
  notifBullet: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.offline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBulletActive: {
    borderColor: colors.primary,
  },
  notifBulletInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  notifPrefLabel: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.offline,
  },
  notifPrefLabelActive: {
    color: colors.textPrimary,
  },
})

export default UserProfileScreen
