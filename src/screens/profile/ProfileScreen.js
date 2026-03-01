// ProfileScreen.js - Tab bar hidden by default, appears on scroll up
import React, { useState, useCallback, useRef, useEffect } from 'react'
import {
  View,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Image,
  RefreshControl,
  Text,
  TextInput,
  Alert,
  Linking,
  ActivityIndicator,
  Modal,
} from 'react-native'
import { Ionicons, FontAwesome5 } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import * as Contacts from 'expo-contacts'
import * as ImagePicker from 'expo-image-picker'
import { validateImageAsset } from '../../utils/imageValidation'
import { useAuth } from '../../contexts/AuthContext'
import { useTabBar } from '../../contexts/TabBarContext'
import { logOut, deleteAccount } from '../../services/authService'
import {
  searchUserByPhone,
  toggleEveryoneNetwork,
  updateUserProfile,
  uploadProfilePhoto,
} from '../../services/userService'
import { fonts } from '../../theme/typography'
import { colors } from '../../theme/colors' //import colors
import { NotificationListModal } from '../../components/notifications'
import { ConfirmModal, CustomToggle } from '../../components/common'
import {
  subscribeToNotifications,
} from '../../services/notificationHistoryService'
import { subscribeToConversations } from '../../services/messageService'
import { getMonthlyConfluenceCount } from '../../services/everyoneService'

const ProfileScreen = ({ navigation }) => {
  const { user, userProfile, refreshUserProfile } = useAuth()
  const [refreshing, setRefreshing] = useState(false)
  const { showTabBar, hideTabBar, resetTimer } = useTabBar()
  const [notificationModalVisible, setNotificationModalVisible] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [_unreadCount, setUnreadCount] = useState(0)
  const lastScrollY = useRef(0)

  // Inline editing state
  const [editableName, setEditableName] = useState(userProfile?.name || '')
  const [nameSaving, setNameSaving] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [networkDropdownOpen, setNetworkDropdownOpen] = useState(false)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [monthlyConfluenceCount, setMonthlyConfluenceCount] = useState(0)
  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState(false)

  // Keep editableName in sync with profile
  useEffect(() => {
    if (userProfile?.name) {
      setEditableName(userProfile.name)
    }
  }, [userProfile?.name])

  const fetchData = async () => {
    await refreshUserProfile()
    if (user?.uid) {
      const result = await getMonthlyConfluenceCount(user.uid)
      if (result.success) {
        setMonthlyConfluenceCount(result.count)
      }
    }
  }

  useFocusEffect(
    useCallback(() => {
      fetchData()
      // Reset tab bar timer when screen is focused
      resetTimer()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  )

  // Subscribe to notification history
  useEffect(() => {
    if (!user?.uid) return

    const unsubscribe = subscribeToNotifications(user.uid, (notifs) => {
      setNotifications(notifs)
      setUnreadCount(notifs.filter((n) => !n.read).length)
    })

    return () => unsubscribe()
  }, [user?.uid])

  // Subscribe to conversations for unread message count
  useEffect(() => {
    if (!user?.uid) return

    const unsubscribe = subscribeToConversations(user.uid, (convos) => {
      const count = convos.filter((c) => c[`unread_${user.uid}`] === true).length
      setUnreadMessages(count)
    })

    return () => unsubscribe()
  }, [user?.uid])

  const handleCloseNotifications = () => {
    setNotificationModalVisible(false)
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  const handleLogout = async () => {
    await logOut()
  }

  const handleDeleteAccount = () => {
    setDeleteAccountConfirm(true)
  }

  const handleConfirmDeleteAccount = () => {
    setDeleteAccountConfirm(false)
    // Prompt for password to re-authenticate
    Alert.prompt(
      'Confirm Password',
      'Enter your password to confirm account deletion.',
      async (password) => {
        if (!password) return
        const result = await deleteAccount(password)
        if (result.success) {
          Alert.alert('Account Deleted', 'Your account has been permanently deleted.')
        } else {
          Alert.alert('Error', result.error)
        }
      },
      'secure-text',
      '',
      'default'
    )
  }

  const handlePrivacyTerms = () => {
    Alert.alert('Privacy & Terms', 'View our legal documents', [
      {
        text: 'Terms of Service',
        onPress: () =>
          Linking.openURL('https://darkstarcyb3r.github.io/CollectiveLegal/TermsOfAgreement.html'),
      },
      {
        text: 'Privacy Policy',
        onPress: () =>
          Linking.openURL('https://darkstarcyb3r.github.io/CollectiveLegal/PrivacyPolicy.html'),
      },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  const handleToggleEveryoneNetwork = async (enabled) => {
    if (!user?.uid) return
    await toggleEveryoneNetwork(user.uid, enabled)
    await refreshUserProfile()
  }

  // Pick and immediately upload a new profile photo
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant permission to access your photos.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    })

    if (!result.canceled) {
      const asset = result.assets[0]
      const validation = await validateImageAsset(asset)
      if (!validation.valid) {
        Alert.alert('Image Error', validation.error)
        return
      }

      setPhotoUploading(true)
      try {
        const uploadResult = await uploadProfilePhoto(user.uid, asset.uri, {
          fileSize: validation.fileSize,
          mimeType: validation.mimeType,
        })
        if (uploadResult.success) {
          await updateUserProfile(user.uid, { profilePhoto: uploadResult.url })
          await refreshUserProfile()
        } else {
          Alert.alert('Upload Error', uploadResult.error || 'Failed to upload photo.')
        }
      } catch (_error) {
        Alert.alert('Error', 'Failed to upload profile photo.')
      }
      setPhotoUploading(false)
    }
  }

  // Save name inline on blur or submit
  const handleNameSave = async () => {
    const trimmedName = editableName.trim()
    if (!trimmedName || trimmedName === userProfile?.name) {
      if (!trimmedName) setEditableName(userProfile?.name || '')
      return
    }

    setNameSaving(true)
    try {
      const result = await updateUserProfile(user.uid, { name: trimmedName })
      if (result.success) {
        await refreshUserProfile()
      } else {
        Alert.alert('Error', result.error || 'Failed to update name.')
        setEditableName(userProfile?.name || '')
      }
    } catch (_error) {
      Alert.alert('Error', 'Failed to update name.')
      setEditableName(userProfile?.name || '')
    }
    setNameSaving(false)
  }

  const handleSearchContact = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert(
          'Permission needed',
          'Please grant access to your contacts to search for friends.'
        )
        return
      }

      const contact = await Contacts.presentContactPickerAsync()

      if (!contact) return // User cancelled

      // Extract phone number from contact
      const phoneNumbers = contact.phoneNumbers
      if (!phoneNumbers || phoneNumbers.length === 0) {
        Alert.alert('No phone number', 'This contact does not have a phone number.')
        return
      }

      const rawNumber = phoneNumbers[0].number || phoneNumbers[0].digits
      if (!rawNumber) {
        Alert.alert('No phone number', "Could not read this contact's phone number.")
        return
      }

      // Search Firestore for this number
      const result = await searchUserByPhone(rawNumber)

      if (!result.success) {
        Alert.alert('Error', 'Something went wrong. Please try again.')
        return
      }

      if (result.data) {
        // User found — navigate to their profile
        navigation.navigate('UserProfile', { userId: result.data.id })
      } else {
        // Not found — offer to invite
        const cleanNumber = rawNumber.replace(/\D/g, '')
        Alert.alert(
          'Not on Collective yet',
          `${contact.name || 'This contact'} isn't on Collective. Want to invite them?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Invite via SMS',
              onPress: () => Linking.openURL(`sms:${cleanNumber}&body=Join me on Collective!`),
            },
          ]
        )
      }
    } catch (_error) {
      Alert.alert('Error', 'Something went wrong. Please try again.')
    }
  }

  const handleScroll = (event) => {
    const currentScrollY = event.nativeEvent.contentOffset.y
    const contentHeight = event.nativeEvent.contentSize.height
    const layoutHeight = event.nativeEvent.layoutMeasurement.height
    const scrollDirection = currentScrollY > lastScrollY.current ? 'down' : 'up'

    // Calculate scroll percentage
    const scrollableHeight = contentHeight - layoutHeight
    const scrollPercent = scrollableHeight > 0 ? currentScrollY / scrollableHeight : 0

    if (scrollDirection === 'down' && scrollPercent > 0.5) {
      // Hide when scrolled past 50%
      hideTabBar()
    } else if (scrollDirection === 'up') {
      // Show when scrolling back up
      showTabBar()
    }

    lastScrollY.current = currentScrollY
  }

  const handleScrollBeginDrag = () => {
    // Show tab bar when user starts touching/dragging
    showTabBar()
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00FF00" />
        }
      >
        {/* Main Container with White Border */}
        <View style={styles.mainContainer}>
          {/* Back Arrow */}
          <TouchableOpacity style={styles.backArrowContainer} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={30} color={colors.textGreen} />
          </TouchableOpacity>

          {/* Top Section - Name, Network Toggle */}
          <View style={styles.topSection}>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Name:</Text>
              <TextInput
                style={styles.nameInput}
                value={editableName}
                onChangeText={setEditableName}
                onBlur={handleNameSave}
                onSubmitEditing={handleNameSave}
                placeholder="Enter your name"
                placeholderTextColor="#666666"
                autoCapitalize="words"
                returnKeyType="done"
                maxLength={24}
              />
              {nameSaving && (
                <ActivityIndicator size="small" color="#00FF00" style={{ marginLeft: 6 }} />
              )}
            </View>

            {/* Everyone logo and toggle */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons
                name="globe-outline"
                size={16}
                color={userProfile?.everyoneNetworkEnabled ? '#00FF00' : '#888888'}
              />
              <Text
                style={[
                  styles.everyoneToggleLabel,
                  { color: userProfile?.everyoneNetworkEnabled ? '#00FF00' : '#888888' },
                ]}
              >
                Public Collective
              </Text>
              <CustomToggle
                value={!!userProfile?.everyoneNetworkEnabled}
                onValueChange={handleToggleEveryoneNetwork}
                size="small"
                activeColor="#00FF00"
              />
            </View>
          </View>

          {/* Middle Section with Photo and Status */}
          <View style={styles.middleSection}>
            <View style={styles.leftContent}>
              {/* Monthly Confluence Count */}
              <View style={styles.statusColumn}>
                <Text style={styles.onlineCount}>{monthlyConfluenceCount}/10</Text>
                <Text style={styles.statusText}>confluence posts{'\n'}used this month</Text>
              </View>

              {/* Messages Button */}
              <View style={{ position: 'relative', alignSelf: 'flex-start' }}>
                <TouchableOpacity
                  style={styles.messagesButton}
                  onPress={() => navigation.navigate('MainTabs', { screen: 'MessagesTab' })}
                >
                  <FontAwesome5 name="envelope" size={16} color={colors.textDark} />
                  <Text style={styles.messagesText}>messages</Text>
                </TouchableOpacity>
                {unreadMessages > 0 && (
                  <View style={styles.messagesBadge}>
                    <Text style={styles.messagesBadgeText}>{unreadMessages}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Profile Photo - Large Circle with Camera Icon */}
            <TouchableOpacity style={styles.photoWrapper} onPress={pickImage} activeOpacity={0.8}>
              <View style={styles.photoContainer}>
                {userProfile?.profilePhoto ? (
                  <Image
                    source={{ uri: userProfile.profilePhoto, cache: 'reload' }}
                    style={styles.profilePhoto}
                  />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="person" size={100} color="#666666" />
                  </View>
                )}
              </View>
              <View style={styles.cameraOverlay}>
                <Ionicons name="camera" size={20} color="#313131" />
              </View>
              {photoUploading && (
                <View style={styles.photoUploadingOverlay}>
                  <ActivityIndicator size="large" color="#00FF00" />
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Quip Section */}
          <View style={styles.quipSection}>
            <Text style={styles.quipLabel}>what's on my mind:</Text>
          </View>

          {/* Quip Input Area */}
          <TouchableOpacity
            style={styles.quipInput}
            onPress={() => navigation.navigate('EditQuip')}
          >
            <Text style={styles.quipText}>{userProfile?.quip || ''}</Text>
            <Ionicons name="create-outline" size={18} color="#343333" style={styles.quipPencil} />
          </TouchableOpacity>

          {/* Buttons and Logo Row */}
          <View style={styles.buttonsAndLogoRow}>
            {/* Left: stacked buttons */}
            <View style={styles.buttonsColumn}>
              <View style={styles.settingsStack}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => navigation.navigate('FollowingUsers')}
                >
                  <Ionicons name="people-outline" size={14} color="#000000" />
                  <Text style={styles.navButtonText}>following</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => navigation.navigate('Followers')}
                >
                  <Ionicons name="person-add-outline" size={14} color="#000000" />
                  <Text style={styles.navButtonText}>followers</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.networkSettingsButton}
                  onPress={() => setNetworkDropdownOpen(true)}
                >
                  <Text style={styles.networkSettingsText}>Network Settings</Text>
                  <Ionicons name="chevron-down" size={14} color="#000000" />
                </TouchableOpacity>
              </View>

              <View style={styles.navButtons}>
                <TouchableOpacity style={styles.navButton} onPress={handleSearchContact}>
                  <Ionicons name="search-outline" size={14} color="#000000" />
                  <Text style={styles.navButtonText}>Search #</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Right: logo */}
            <View style={styles.logoContainer}>
              <Image
                source={require('../../assets/images/green-logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
          </View>

          {/* Network Settings Modal */}
          <Modal
            visible={networkDropdownOpen}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setNetworkDropdownOpen(false)}
          >
            <TouchableOpacity
              style={styles.networkModalOverlay}
              activeOpacity={1}
              onPress={() => setNetworkDropdownOpen(false)}
            >
              <View style={styles.networkModalContent}>
                <Text style={styles.networkModalTitle}>Network Settings</Text>
                <TouchableOpacity
                  style={styles.networkModalItem}
                  onPress={() => {
                    setNetworkDropdownOpen(false)
                    navigation.navigate('HiddenUsers')
                  }}
                >
                  <Ionicons name="eye-off-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.networkModalText}>Hidden</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.networkModalItem}
                  onPress={() => {
                    setNetworkDropdownOpen(false)
                    navigation.navigate('BlockedUsers')
                  }}
                >
                  <Ionicons name="ban-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.networkModalText}>Blocked</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        </View>

        {/* Account Actions - Outside main container */}
        <View style={styles.accountActions}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutButton} onPress={handlePrivacyTerms}>
            <Text style={styles.logoutText}>Privacy & Terms</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutButton} onPress={handleDeleteAccount}>
            <Text style={styles.deleteAccountText}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <NotificationListModal
        visible={notificationModalVisible}
        notifications={notifications}
        onClose={handleCloseNotifications}
        userId={user?.uid}
        onNavigate={({ route, params }) => navigation.navigate(route, params)}
      />

      {/* Delete Account Confirm Modal */}
      <ConfirmModal
        visible={deleteAccountConfirm}
        title="Delete Account"
        message="Are you sure you want to permanently delete your account? This action cannot be undone."
        confirmText="Delete"
        onConfirm={handleConfirmDeleteAccount}
        onCancel={() => setDeleteAccountConfirm(false)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 120, // Extra padding for tab bar space
  },
  // Main Container with green Border
  mainContainer: {
    backgroundColor: '#000000',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: 16,
    marginBottom: 0,
    position: 'relative',
  },
  // Top Section
  topSection: {
    marginBottom: 0,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  fieldLabel: {
    color: '#00FF00',
    fontSize: 16,
    fontWeight: 'normal',
    fontFamily: fonts.regular,
    marginRight: 10,
  },
  nameInput: {
    flex: 1,
    color: colors.textGreen,
    fontSize: 16,
    fontFamily: fonts.italic,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 0, 0.3)',
    borderStyle: 'dashed',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: 'transparent',
  },
  everyoneToggleLabel: {
    fontSize: 12,
    fontFamily: fonts.regular,
    marginLeft: 8,
    marginRight: 8,
  },

  // Middle Section with Photo
  middleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
    minHeight: 220,
  },
  leftContent: {
    flex: 1,
    justifyContent: 'space-around',
    paddingRight: 13,
  },
  statusColumn: {
    marginBottom: 30,
  },
  onlineCount: {
    color: '#00FF00',
    fontSize: 28,
    fontWeight: 'normal',
    fontFamily: fonts.bold,
    marginRight: 2,
  },
  statusText: {
    color: '#00FF00',
    fontSize: 12,
    fontWeight: 'normal',
    fontFamily: fonts.regular,
  },
  backArrowContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    marginLeft: -12,
  },
  messagesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d8ff1b',
    paddingVertical: 6,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: 2,
    borderTopColor: '#B8D816',
    borderLeftColor: '#B8D816',
    borderBottomColor: '#EFFFB0',
    borderRightColor: '#EFFFB0',
  },

  messagesText: {
    color: '#000000',
    fontSize: 12,
    fontFamily: fonts.medium,
    marginLeft: 8,
    marginRight: 4,
  },

  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#15ff00',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderTopColor: '#2dd816',
    borderLeftColor: '#5ad816',
    borderBottomColor: '#bcffb0',
    borderRightColor: '#c5ffb0',
    alignSelf: 'flex-start',
    width: 160,
  },

  messagesBadge: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 1,
    borderColor: '#3a3a3a',
    zIndex: 10,
  },
  messagesBadgeText: {
    color: '#000000',
    fontSize: 10,
    fontFamily: fonts.bold,
  },
  photoWrapper: {
    position: 'relative',
  },
  photoContainer: {
    width: 170,
    height: 240,
    borderRadius: 110,
    overflow: 'hidden',
    backgroundColor: '#808080',
    marginLeft: 8,
    marginTop: 10,
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
  cameraOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#000000',
    zIndex: 10,
  },
  photoUploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Quip Section
  quipSection: {
    marginBottom: 1,
    marginTop: -6,
  },
  quipLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: fonts.italic,
    marginTop: 8,
    marginBottom: 4,
  },

  quipInput: {
    position: 'relative',
    backgroundColor: '#E8E8E8',
    borderRadius: 4,
    padding: 8,
    paddingBottom: 20,
    minHeight: 40,
    marginBottom: 24,
  },
  quipText: {
    color: '#000000',
    fontSize: 11,
    fontFamily: fonts.regular,
    lineHeight: 14,
  },
  quipPencil: {
    position: 'absolute',
    bottom: 4,
    right: 6,
  },
  navButtons: {
    flex: 1,
    gap: 18,
    paddingRight: 0,
    marginTop: 0,
  },

  // Buttons and Logo horizontal row
  buttonsAndLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  buttonsColumn: {
    flex: 1,
  },
  // Following, Followers, Network Settings stack
  settingsStack: {
    gap: 20,
    marginBottom: 18,
  },
  networkSettingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D6D1D1',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 4,
    borderWidth: 2,
    borderTopColor: '#B0ABAB',
    borderLeftColor: '#B0ABAB',
    borderBottomColor: '#EFEFEF',
    borderRightColor: '#EFEFEF',
    alignSelf: 'flex-start',
    width: 160,
  },
  networkSettingsText: {
    color: '#000000',
    fontSize: 12,
    fontFamily: fonts.medium,
  },
  networkModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  networkModalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    width: 220,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 0, 0.3)',
  },
  networkModalTitle: {
    color: '#00FF00',
    fontSize: 14,
    fontFamily: fonts.bold,
    textAlign: 'center',
    marginBottom: 12,
  },
  networkModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  networkModalText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: fonts.regular,
  },

  //search button
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D6D1D1',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    gap: 4,
    borderWidth: 2,
    borderTopColor: '#B0ABAB',
    borderLeftColor: '#B0ABAB',
    borderBottomColor: '#EFEFEF',
    borderRightColor: '#EFEFEF',
    alignSelf: 'flex-start',
    width: 160,
    marginBottom: 20,
  },
  navButtonText: {
    color: '#000000',
    fontSize: 12,
    fontFamily: fonts.medium,
    marginLeft: 5,
  },
  // Vertical Logo
  logoContainer: {
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -10,
  },
  logoImage: {
    width: '120%',
    height: '120%',
  },
  // Account Actions
  accountActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
  },
  logoutButton: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  logoutText: {
    color: '#888888',
    fontSize: 10,
    fontFamily: fonts.regular,
    textDecorationLine: 'underline',
  },
  deleteAccountText: {
    color: '#888888',
    fontSize: 10,
    fontFamily: fonts.regular,
    textDecorationLine: 'underline',
  },
})

export default ProfileScreen
