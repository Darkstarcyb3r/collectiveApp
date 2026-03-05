// Add Friends Screen
// 3-step onboarding flow: Matrix intro → Contacts on Collective → Invite via SMS
// Appears after profile setup, before dashboard

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  ActivityIndicator,
  Dimensions,
  Animated,
  Linking,
  Platform,
  TextInput,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import * as Contacts from 'expo-contacts'
import { colors } from '../../theme'
import { fonts } from '../../theme/typography'
import { useAuth } from '../../contexts/AuthContext'
import { searchUserByPhone, followUser, updateUserProfile, getFollowingUsers, getUserProfile } from '../../services/userService'
import { playClick } from '../../services/soundService'
import { firestore } from '../../config/firebase'

const { width, height } = Dimensions.get('window')

// Matrix rain characters — random numbers only
const MATRIX_CHARS = '0123456789'
// Preview contact photos for "On Collective" step

// ── Matrix Rain inside Nokia Phone Frame ──
const SCREEN_COLUMNS = 18
const SCREEN_CHAR_SIZE = 12
const PHONE_SCREEN_WIDTH = width * 0.52
const CHAR_LINE_HEIGHT = SCREEN_CHAR_SIZE + 3 // 15px per character
const CHARS_PER_SET = 30
const SINGLE_SET_HEIGHT = CHARS_PER_SET * CHAR_LINE_HEIGHT // 450px

const MatrixPhoneFrame = () => {
  return (
    <View style={phoneStyles.wrapper}>
      {/* Phone body */}
      <View style={phoneStyles.phoneBody}>
        {/* Earpiece */}
        <View style={phoneStyles.earpiece} />

        {/* Screen bezel */}
        <View style={phoneStyles.screenBezel}>
          {/* Screen */}
          <View style={phoneStyles.screen}>
            <MatrixRainScreen />
          </View>
        </View>

        {/* Brand text */}
        <Text style={phoneStyles.brand}>COLLECTIVE</Text>

        {/* Keypad area */}
        <View style={phoneStyles.keypad}>
          {/* Nav buttons row */}
          <View style={phoneStyles.navRow}>
            <View style={phoneStyles.softKey} />
            <View style={phoneStyles.dPad}>
              <View style={phoneStyles.dPadInner} />
            </View>
            <View style={phoneStyles.softKey} />
          </View>
          {/* Number keys */}
          {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['*', '0', '#']].map((row, ri) => (
            <View key={ri} style={phoneStyles.keyRow}>
              {row.map((key) => (
                <View key={key} style={phoneStyles.key}>
                  <Text style={phoneStyles.keyText}>{key}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}

const MatrixRainScreen = () => {
  const screenColWidth = PHONE_SCREEN_WIDTH / SCREEN_COLUMNS
  const columns = useMemo(() => {
    return Array.from({ length: SCREEN_COLUMNS }, (_, i) => ({
      id: i,
      chars: Array.from({ length: CHARS_PER_SET }, () =>
        MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)]
      ),
      speed: 0.36 + Math.random() * 0.6,
      opacity: 0.8 + Math.random() * 0.2,
      startOffset: Math.random(), // random start position (0–1) so columns begin mid-flow
    }))
  }, [])

  return (
    <View style={matrixStyles.container}>
      {columns.map((col) => (
        <MatrixColumn key={col.id} column={col} index={col.id} colWidth={screenColWidth} />
      ))}
    </View>
  )
}

const MatrixColumn = React.memo(({ column, index, colWidth }) => {
  // Start each column at a random mid-position so the screen looks fully populated on frame 1
  const startY = -(column.startOffset * SINGLE_SET_HEIGHT)
  const translateY = useRef(new Animated.Value(startY)).current

  useEffect(() => {
    // Animate downward by exactly one set height, then loop resets to startY.
    // Because chars are rendered twice (doubled), the second copy fills in
    // exactly where the first was, making the reset invisible — seamless loop.
    Animated.loop(
      Animated.timing(translateY, {
        toValue: startY + SINGLE_SET_HEIGHT,
        duration: (10000 + Math.random() * 5000) / column.speed,
        useNativeDriver: true,
      })
    ).start()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Render chars twice for seamless wrap — when the loop resets,
  // the second copy is in the same visual position as the first was
  const doubleChars = useMemo(() => [...column.chars, ...column.chars], [column.chars])

  return (
    <Animated.View
      style={[
        matrixStyles.column,
        {
          left: index * colWidth,
          transform: [{ translateY }],
          opacity: column.opacity,
        },
      ]}
    >
      {doubleChars.map((char, i) => {
        const ci = i % CHARS_PER_SET // index within each set for rain-trail fade
        return (
          <Text
            key={i}
            style={[
              matrixStyles.char,
              {
                width: colWidth,
                color: ci === 0 ? '#ffffff' : colors.primary,
                opacity: ci < 3 ? 1 : Math.max(0.25, 1 - ci * 0.03),
              },
            ]}
          >
            {char}
          </Text>
        )
      })}
    </Animated.View>
  )
})

const matrixStyles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  column: {
    position: 'absolute',
    top: 0,
  },
  char: {
    fontSize: SCREEN_CHAR_SIZE,
    fontFamily: fonts.mono,
    lineHeight: SCREEN_CHAR_SIZE + 3,
    textAlign: 'center',
  },
})

const phoneStyles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneBody: {
    width: width * 0.62,
    height: height * 0.6,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(180, 180, 180, 0.5)',
    backgroundColor: 'rgba(30, 30, 30, 0.6)',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 14,
  },
  earpiece: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(120, 120, 120, 0.5)',
    marginBottom: 8,
  },
  screenBezel: {
    width: PHONE_SCREEN_WIDTH + 8,
    height: height * 0.28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(150, 150, 150, 0.4)',
    backgroundColor: '#0a0a0a',
    padding: 3,
  },
  screen: {
    flex: 1,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#050505',
  },
  brand: {
    color: 'rgba(150, 150, 150, 0.6)',
    fontSize: 8,
    fontFamily: fonts.regular,
    letterSpacing: 3,
    marginTop: 10,
    marginBottom: 8,
  },
  keypad: {
    flex: 1,
    width: PHONE_SCREEN_WIDTH + 8,
    justifyContent: 'flex-end',
    paddingBottom: 4,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 6,
  },
  softKey: {
    width: 28,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(100, 100, 100, 0.3)',
  },
  dPad: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(150, 150, 150, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dPadInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(100, 100, 100, 0.3)',
  },
  keyRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginBottom: 4,
  },
  key: {
    width: 44,
    height: 22,
    borderRadius: 11,
    borderWidth: 0.5,
    borderColor: 'rgba(150, 150, 150, 0.25)',
    backgroundColor: 'rgba(60, 60, 60, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    color: 'rgba(180, 180, 180, 0.5)',
    fontSize: 9,
    fontFamily: fonts.mono,
  },
})

// ── Contact Row Component ──
const ContactRow = React.memo(({ item, selected, onToggle, showPhoto, isFollowed, isInvited, onAvatarPress }) => {
  const initial = (item.displayName || item.name || '?')[0].toUpperCase()

  const avatarContent = (
    <View style={rowStyles.avatar}>
      {showPhoto && item.profilePhoto && item.profilePhoto.length > 0 ? (
        <Image source={{ uri: item.profilePhoto }} style={rowStyles.avatarImage} />
      ) : (
        <View style={rowStyles.avatarPlaceholder}>
          <Text style={rowStyles.avatarInitial}>{initial}</Text>
        </View>
      )}
    </View>
  )

  return (
    <TouchableOpacity
      style={[rowStyles.container, (isFollowed || isInvited) && { opacity: 0.4 }]}
      onPress={() => onToggle(item.id)}
      activeOpacity={0.7}
    >
      {onAvatarPress && item.uid ? (
        <TouchableOpacity onPress={() => onAvatarPress(item.uid)} activeOpacity={0.7}>
          {avatarContent}
        </TouchableOpacity>
      ) : (
        avatarContent
      )}
      <View style={rowStyles.info}>
        <Text style={rowStyles.name} numberOfLines={1}>
          {item.displayName || item.name}
        </Text>
        {isFollowed ? (
          <Text style={rowStyles.followedLabel}>following</Text>
        ) : isInvited ? (
          <Text style={rowStyles.invitedLabel}>invited</Text>
        ) : item.phoneNumber ? (
          <Text style={rowStyles.phone} numberOfLines={1}>{item.phoneNumber}</Text>
        ) : null}
      </View>
      {selected && !isFollowed && !isInvited && <View style={rowStyles.greenDot} />}
    </TouchableOpacity>
  )
})

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    marginRight: 14,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.lilac,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: colors.textDark,
    fontSize: 18,
    fontFamily: fonts.bold,
  },
  info: {
    flex: 1,
  },
  name: {
    color: colors.textPrimary,
    fontSize: 14,
    fontFamily: fonts.regular,
  },
  phone: {
    color: '#888',
    fontSize: 11,
    fontFamily: fonts.regular,
    marginTop: 2,
  },
  followedLabel: {
    color: colors.primary,
    fontSize: 10,
    fontFamily: fonts.regular,
    opacity: 0.7,
    marginTop: 2,
  },
  invitedLabel: {
    color: '#888',
    fontSize: 10,
    fontFamily: fonts.regular,
    opacity: 0.7,
    marginTop: 2,
  },
  greenDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    marginLeft: 8,
  },
})

// ── Main AddFriendsScreen ──
// mode: 'onboarding' (default) = full flow with matrix intro → dashboard
//       'profile' = skips matrix, starts loading contacts immediately, goBack on done
const AddFriendsScreen = ({ navigation, route }) => {
  const mode = route?.params?.mode || 'onboarding'
  const isProfileMode = mode === 'profile'
  const { user, refreshUserProfile } = useAuth()
  const [step, setStep] = useState(isProfileMode ? -1 : 0) // -1=loading contacts, 0=matrix, 1=onCollective, 2=notOnCollective
  const [loading, setLoading] = useState(false)
  const [contactsOnCollective, setContactsOnCollective] = useState([])
  const [contactsNotOnCollective, setContactsNotOnCollective] = useState([])
  const [selectedCollective, setSelectedCollective] = useState(new Set())
  const [selectedInvite, setSelectedInvite] = useState(new Set())
  const [searchCollective, setSearchCollective] = useState('')
  const [searchInvite, setSearchInvite] = useState('')
  const [followingIds, setFollowingIds] = useState(new Set())
  const [invitedPhones, setInvitedPhones] = useState(new Set())

  // Filter contacts by search text
  const filteredCollective = useMemo(() => {
    if (!searchCollective.trim()) return contactsOnCollective
    const q = searchCollective.toLowerCase()
    return contactsOnCollective.filter((c) =>
      (c.displayName || c.name || '').toLowerCase().includes(q) ||
      (c.phoneNumber || '').includes(q)
    )
  }, [contactsOnCollective, searchCollective])

  const filteredNotOnCollective = useMemo(() => {
    if (!searchInvite.trim()) return contactsNotOnCollective
    const q = searchInvite.toLowerCase()
    return contactsNotOnCollective.filter((c) =>
      (c.displayName || c.name || '').toLowerCase().includes(q) ||
      (c.phoneNumber || '').includes(q)
    )
  }, [contactsNotOnCollective, searchInvite])

  // Select All / Deselect All for Collective contacts
  const allCollectiveSelected = contactsOnCollective.length > 0 &&
    contactsOnCollective.every((c) => selectedCollective.has(c.id))

  const handleSelectAllCollective = useCallback(() => {
    playClick()
    if (allCollectiveSelected) {
      setSelectedCollective(new Set())
    } else {
      setSelectedCollective(new Set(contactsOnCollective.map((c) => c.id)))
    }
  }, [allCollectiveSelected, contactsOnCollective])

  // Complete the add friends flow and navigate to dashboard
  const completeFlow = useCallback(async () => {
    if (isProfileMode) {
      navigation.goBack()
      return
    }
    try {
      await updateUserProfile(user.uid, { addFriendsComplete: true })
      await refreshUserProfile()
    } catch (_err) {
      // Even if update fails, let the user through
      await refreshUserProfile()
    }
  }, [user, refreshUserProfile, isProfileMode, navigation])

  // Skip / Done
  const handleSkip = useCallback(() => {
    playClick()
    if (isProfileMode) {
      navigation.goBack()
    } else {
      completeFlow()
    }
  }, [completeFlow, isProfileMode, navigation])

  // Auto-load contacts on mount in profile mode
  useEffect(() => {
    if (isProfileMode) {
      handleAddContactsRef.current?.()
    }
  }, [isProfileMode])

  // Fetch user's following list so we can dim already-followed contacts (profile mode)
  // Uses useFocusEffect so the list refreshes when the user returns from a UserProfile
  // after following someone — the newly-followed contact will appear dimmed immediately.
  useFocusEffect(
    useCallback(() => {
      if (!isProfileMode || !user?.uid) return
      getFollowingUsers(user.uid).then((result) => {
        if (result.success) {
          setFollowingIds(new Set(result.data.map((u) => u.id)))
        }
      })
    }, [isProfileMode, user?.uid])
  )

  // Fetch invited phone numbers from Firestore so already-invited contacts stay dimmed.
  // Runs on focus so the list updates if a contact joins Collective (removing them from
  // the not-on-collective list) or when the user returns after sending an SMS.
  useFocusEffect(
    useCallback(() => {
      if (!isProfileMode || !user?.uid) return
      getUserProfile(user.uid).then((result) => {
        if (result.success && result.data?.invitedPhones) {
          setInvitedPhones(new Set(result.data.invitedPhones))
        }
      })
    }, [isProfileMode, user?.uid])
  )

  const handleAddContactsRef = useRef(null)

  // Request contacts permission and load contacts
  const handleAddContacts = useCallback(async () => {
    setLoading(true)
    try {
      const { status } = await Contacts.requestPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to your contacts to find friends on Collective.',
          [{ text: 'OK', onPress: () => isProfileMode && navigation.goBack() }]
        )
        setLoading(false)
        return
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
        sort: Contacts.SortTypes.FirstName,
      })

      // Filter contacts with phone numbers and deduplicate
      const contactsWithPhones = []
      const seenPhones = new Set()

      for (const contact of data) {
        if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
          const phone = contact.phoneNumbers[0].number
          const digits = phone.replace(/\D/g, '')
          const normalized = digits.length === 11 && digits.startsWith('1')
            ? digits.slice(1)
            : digits

          if (normalized.length >= 7 && !seenPhones.has(normalized)) {
            seenPhones.add(normalized)
            contactsWithPhones.push({
              id: contact.id,
              displayName: contact.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
              phoneNumber: phone,
              normalizedPhone: normalized,
            })
          }
        }
      }

      // Check which contacts are on Collective
      const onCollective = []
      const notOnCollective = []

      // Batch check phones against Firestore (limit to first 200 to avoid rate limits)
      const toCheck = contactsWithPhones.slice(0, 200)
      const results = await Promise.allSettled(
        toCheck.map(async (contact) => {
          const result = await searchUserByPhone(contact.normalizedPhone)
          return { contact, result }
        })
      )

      for (const res of results) {
        if (res.status === 'fulfilled') {
          const { contact, result } = res.value
          if (result.success && result.data && result.data.id !== user.uid) {
            onCollective.push({
              ...contact,
              uid: result.data.id,
              name: result.data.name || contact.displayName,
              profilePhoto: result.data.profilePhoto,
            })
          } else {
            notOnCollective.push(contact)
          }
        } else {
          notOnCollective.push(res.reason?.contact || toCheck[0])
        }
      }

      // Add remaining unchecked contacts to notOnCollective
      if (contactsWithPhones.length > 200) {
        notOnCollective.push(...contactsWithPhones.slice(200))
      }

      setContactsOnCollective(onCollective)
      setContactsNotOnCollective(notOnCollective)
      setStep(1)
    } catch (error) {
      Alert.alert('Error', 'Failed to load contacts. You can try again later from your profile.')
      console.log('Contacts error:', error)
    }
    setLoading(false)
  }, [user, isProfileMode, navigation])

  // Keep ref in sync so the auto-load effect can call it
  handleAddContactsRef.current = handleAddContacts

  // Follow selected contacts on Collective
  const handleFollowSelected = useCallback(async () => {
    if (isProfileMode) {
      // Profile mode: no mass follow — just advance to invite step
      setStep(2)
      return
    }

    if (selectedCollective.size === 0) {
      setStep(2)
      return
    }

    setLoading(true)
    try {
      const followPromises = Array.from(selectedCollective).map((contactId) => {
        const contact = contactsOnCollective.find((c) => c.id === contactId)
        if (contact?.uid) {
          return followUser(user.uid, contact.uid)
        }
        return Promise.resolve()
      })

      await Promise.allSettled(followPromises)
    } catch (error) {
      console.log('Follow error:', error)
    }
    setLoading(false)
    setStep(2)
  }, [selectedCollective, contactsOnCollective, user, isProfileMode])

  // Send SMS invites to selected contacts using expo-sms
  // Sends individual texts (one per contact) so recipients don't see each other's numbers.
  // Each SMS composer opens one at a time; after the last one the app navigates to dashboard.
  const handleSendInvites = useCallback(async () => {
    if (selectedInvite.size === 0) {
      completeFlow()
      return
    }

    setLoading(true)
    try {
      const phones = Array.from(selectedInvite)
        .map((contactId) => {
          const contact = contactsNotOnCollective.find((c) => c.id === contactId)
          return contact?.phoneNumber
        })
        .filter(Boolean)

      if (phones.length > 0) {
        const message = encodeURIComponent(
          'Hey! Join me on Collective - a new social network built for real community. Download it here: https://apps.apple.com/us/app/collective-network/id6759182429'
        )
        const separator = Platform.OS === 'ios' ? '&' : '?'
        // Send individual texts — one composer per person, no group threads
        for (const phone of phones) {
          const smsUrl = `sms:${phone}${separator}body=${message}`
          await Linking.openURL(smsUrl).catch(() => {})
        }
      }
    } catch (error) {
      console.log('SMS error:', error)
    }
    setLoading(false)
    completeFlow()
  }, [selectedInvite, contactsNotOnCollective, completeFlow])

  // Toggle selection
  const toggleCollective = useCallback((id) => {
    playClick()
    if (isProfileMode) {
      // In profile mode, tapping a Collective contact navigates to their profile
      const contact = contactsOnCollective.find((c) => c.id === id)
      if (contact?.uid) {
        navigation.navigate('UserProfile', { userId: contact.uid })
      }
      return
    }
    setSelectedCollective((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [isProfileMode, contactsOnCollective, navigation])

  const toggleInvite = useCallback(async (id) => {
    playClick()
    if (isProfileMode) {
      // In profile mode, tapping a contact opens SMS composer for that one person
      const contact = contactsNotOnCollective.find((c) => c.id === id)
      if (contact?.phoneNumber) {
        // Skip if already invited
        if (invitedPhones.has(contact.normalizedPhone)) return

        const message = encodeURIComponent(
          'Hey! Join me on Collective - a new social network built for real community. Download it here: https://apps.apple.com/us/app/collective-network/id6759182429'
        )
        const separator = Platform.OS === 'ios' ? '&' : '?'
        const smsUrl = `sms:${contact.phoneNumber}${separator}body=${message}`
        Linking.openURL(smsUrl)
          .then(() => {
            // Mark as invited locally immediately
            setInvitedPhones((prev) => new Set([...prev, contact.normalizedPhone]))
            // Persist to Firestore so it survives app restarts
            if (user?.uid) {
              updateUserProfile(user.uid, {
                invitedPhones: firestore.FieldValue.arrayUnion(contact.normalizedPhone),
              })
            }
          })
          .catch(() => {
            Alert.alert('SMS Not Available', 'SMS is not available on this device.')
          })
      }
      return
    }
    setSelectedInvite((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [isProfileMode, contactsNotOnCollective, invitedPhones, user])

  // Navigate to a Collective user's profile (profile mode)
  const handleAvatarPress = useCallback((uid) => {
    playClick()
    navigation.navigate('UserProfile', { userId: uid })
  }, [navigation])

  // Render the glass container with search bar + contact list
  const renderContactList = (data, selectedSet, onToggle, showPhoto, searchValue, onSearchChange, options = {}) => (
    <View style={styles.glassContainer}>
      {/* Fixed search bar */}
      <View style={styles.searchBarContainer}>
        <Ionicons name="search" size={16} color="#888" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search contacts..."
          placeholderTextColor="#666"
          value={searchValue}
          onChangeText={onSearchChange}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ContactRow
            item={item}
            selected={selectedSet.has(item.id)}
            onToggle={onToggle}
            showPhoto={showPhoto}
            isFollowed={options.showFollowState ? followingIds.has(item.uid) : false}
            isInvited={options.showInviteState ? invitedPhones.has(item.normalizedPhone) : false}
            onAvatarPress={options.onAvatarPress}
          />
        )}
        showsVerticalScrollIndicator={true}
        indicatorStyle="white"
        contentContainerStyle={styles.listContent}
      />
    </View>
  )

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Green border frame */}
      <View style={styles.frame}>
        <LinearGradient
          colors={[colors.primary, colors.primary]}
          style={styles.frameBorder}
        >
          <View style={styles.frameInner}>
            {/* Back button */}
            {(isProfileMode || step > 0) && (
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => {
                  playClick()
                  if (isProfileMode && step <= 1) {
                    navigation.goBack()
                  } else {
                    setStep((s) => s - 1)
                  }
                }}
              >
                <Ionicons name="chevron-back" size={28} color={colors.primary} />
              </TouchableOpacity>
            )}

            {/* Title */}
            <Text style={styles.title}>{isProfileMode ? (step === 2 ? 'INVITE FR13NDS TO COLLECTIVE' : 'FOLLOW FR13NDS ON COLLECTIVE') : 'ADD FR13NDS ON C0LL3CTIVE'}</Text>
            <Text style={styles.subtitle}>
              {isProfileMode
                ? step === 2
                  ? 'Tap a contact to send an invite.'
                  : 'Tap a friend to view their profile & follow.'
                : 'Get started by inviting your network.'}
            </Text>

            {/* Step content */}
            <View style={styles.content}>
              {step === -1 && (
                <View style={styles.emptyState}>
                  <ActivityIndicator color={colors.primary} size="large" />
                  <Text style={[styles.emptyText, { marginTop: 16 }]}>Loading contacts...</Text>
                </View>
              )}

              {step === 0 && !isProfileMode && (
                <MatrixPhoneFrame />
              )}

              {step === 1 && (
                <>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>from your contacts</Text>
                    {!isProfileMode && contactsOnCollective.length > 0 && (
                      <TouchableOpacity onPress={handleSelectAllCollective} activeOpacity={0.7}>
                        <Text style={styles.selectAllText}>
                          {allCollectiveSelected ? 'deselect all' : 'select all'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {contactsOnCollective.length > 0 ? (
                    renderContactList(
                      filteredCollective,
                      selectedCollective,
                      toggleCollective,
                      true,
                      searchCollective,
                      setSearchCollective,
                      isProfileMode
                        ? { showFollowState: true, onAvatarPress: handleAvatarPress }
                        : {}
                    )
                  ) : (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyText}>
                        None of your contacts are on Collective yet.
                      </Text>
                    </View>
                  )}
                </>
              )}

              {step === 2 && (
                <>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>from your contacts</Text>
                  </View>
                  {contactsNotOnCollective.length > 0 ? (
                    renderContactList(
                      filteredNotOnCollective,
                      selectedInvite,
                      toggleInvite,
                      false,
                      searchInvite,
                      setSearchInvite,
                      isProfileMode
                        ? { showInviteState: true }
                        : {}
                    )
                  ) : (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyText}>
                        All your contacts are already on Collective!
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Bottom buttons */}
      <View style={styles.bottomButtons}>
        {/* Profile mode step 2: only "done" button */}
        {isProfileMode && step === 2 ? (
          <TouchableOpacity
            style={styles.nextButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#cafb6c', '#71f200', '#23ff0d']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.nextGradient}
            >
              <Text style={styles.nextText}>done</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
              <Text style={styles.skipText}>{isProfileMode ? 'done' : 'skip'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.nextButton}
              onPress={() => {
                playClick()
                if (step === 0 && !isProfileMode) handleAddContacts()
                else if (step === 1) handleFollowSelected()
                else if (step === 2) handleSendInvites()
              }}
              disabled={loading || step === -1}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#cafb6c', '#71f200', '#23ff0d']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.nextGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <Text style={styles.nextText}>
                    {step === 0 && !isProfileMode
                      ? 'add contacts'
                      : isProfileMode && step === 1
                        ? 'next'
                        : step === 1
                          ? 'follow'
                          : 'invite'}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  frame: {
    flex: 1,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  frameBorder: {
    flex: 1,
    borderRadius: 16,
    padding: 2,
  },
  frameInner: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    marginBottom: 16,
    opacity: 0.8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  selectAllText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.primary,
    opacity: 0.9,
  },
  content: {
    flex: 1,
  },
  glassContainer: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    fontFamily: fonts.regular,
    padding: 0,
    height: 28,
  },
  listContent: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    color: '#888',
    fontSize: 14,
    fontFamily: fonts.regular,
    textAlign: 'center',
  },
  bottomButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 48,
    gap: 8,
  },
  skipButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  skipText: {
    color: colors.primary,
    fontSize: 13,
    fontFamily: fonts.regular,
  },
  nextButton: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  nextGradient: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  nextText: {
    color: '#000',
    fontSize: 14,
    fontFamily: fonts.bold,
  },
})

export default AddFriendsScreen
