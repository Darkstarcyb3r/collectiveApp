// Cyber Lounge Create Screen
// Host creates a new chatroom with a name, vibe (background music), and stickers
// Timer starts at 4:00:00, room goes live immediately

import React, { useState, useRef, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { colors } from '../../../theme'
import { fonts } from '../../../theme/typography'
import { useAuth } from '../../../contexts/AuthContext'
import { createChatroom } from '../../../services/everyoneService'
import DarkTabBar from '../../../components/navigation/DarkTabBar'
import { VIBES, DEFAULT_VIBE_ID, getVibeById } from '../../../config/vibes'
import { STICKER_OPTIONS, MAX_STICKERS } from '../../../config/stickers'
import { BACKGROUNDS, DEFAULT_BACKGROUND_ID, getBackgroundById } from '../../../config/backgrounds'
import { playClick } from '../../../services/soundService'

const CyberLoungeCreateScreen = ({ navigation, route }) => {
  const { user, userProfile } = useAuth()
  const [roomName, setRoomName] = useState(route?.params?.initialName || '')
  const initialImageUrl = route?.params?.initialImageUrl || null
  const [useCustomBg, setUseCustomBg] = useState(!!initialImageUrl)
  const [selectedVibe, setSelectedVibe] = useState(DEFAULT_VIBE_ID)
  const [vibeDropdownOpen, setVibeDropdownOpen] = useState(false)
  const [selectedStickers, setSelectedStickers] = useState([])
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false)
  const [selectedBackground, setSelectedBackground] = useState(DEFAULT_BACKGROUND_ID)
  const [bgPickerOpen, setBgPickerOpen] = useState(false)
  const [creating, setCreating] = useState(false)

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

  const handleCreate = async () => {
    playClick()
    const name = roomName.trim()
    if (!name) {
      Alert.alert('Name Required', 'Please enter a chatroom name.')
      return
    }
    if (!user?.uid) return

    setCreating(true)
    const result = await createChatroom(
      user.uid,
      userProfile?.name || 'Host',
      userProfile?.profilePhoto || null,
      name,
      selectedVibe,
      selectedStickers,
      selectedBackground,
      useCustomBg ? initialImageUrl : null
    )

    if (result.success) {
      navigation.replace('CyberLoungeDetail', { roomId: result.roomId })
    } else if (result.error === 'max_rooms' || result.error === 'max_host_rooms') {
      Alert.alert('Limit Reached', result.message)
      navigation.goBack()
    } else {
      Alert.alert('Error', 'Could not create chatroom.')
    }
    setCreating(false)
  }

  const toggleSticker = (emoji) => {
    playClick()
    setSelectedStickers((prev) => {
      if (prev.includes(emoji)) {
        return prev.filter((s) => s !== emoji)
      }
      if (prev.length >= MAX_STICKERS) return prev
      return [...prev, emoji]
    })
  }

  const selectedVibeLabel = getVibeById(selectedVibe).label

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
          onScroll={handleScroll}
          onScrollBeginDrag={handleScrollBeginDrag}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.mainContainer}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ padding: 4 }}
              >
                <Ionicons name="chevron-back" size={24} color={colors.primary} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Create Chatroom</Text>
              <View style={{ width: 24 }} />
            </View>

            {/* Chatroom Name Input */}
            <TextInput
              style={styles.nameInput}
              value={roomName}
              onChangeText={setRoomName}
              placeholder="Chatroom Name"
              placeholderTextColor="rgba(255, 255, 255, 0.3)"
              maxLength={28}
            />

            {/* Host Info */}
            <View style={styles.hostRow}>
              <View style={styles.hostAvatar}>
                {userProfile?.profilePhoto ? (
                  <Image
                    source={{ uri: userProfile.profilePhoto, cache: 'reload' }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={20} color="#666" />
                  </View>
                )}
              </View>
              <View style={styles.hostInfo}>
                <Text style={styles.hostName}>{userProfile?.name || 'You'}</Text>
                <Text style={styles.hostLabel}>Host</Text>
              </View>

              {/* Create Button */}
              <TouchableOpacity
                style={[styles.createButtonOuter, creating && { opacity: 0.5 }]}
                onPress={handleCreate}
                disabled={creating}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#cafb6c', '#71f200', '#23ff0d']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.createButton}
                >
                  <LinearGradient
                    colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']}
                    style={styles.createButtonHighlight}
                  />
                  <Ionicons name="add" size={16} color={colors.textDark} />
                  <Text style={styles.createButtonText}>Chat</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Sticker Picker */}
            <View style={styles.stickerSection}>
              <View style={styles.stickerDisplay}>
                {selectedStickers.length > 0 ? (
                  selectedStickers.map((emoji, idx) => (
                    <Text key={idx} style={styles.stickerEmoji}>
                      {emoji}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.stickerPlaceholder}>stickers</Text>
                )}
                <TouchableOpacity
                  onPress={() => {
                    playClick()
                    setStickerPickerOpen(!stickerPickerOpen)
                    setVibeDropdownOpen(false)
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={stickerPickerOpen ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color="rgba(255, 255, 255, 0.4)"
                  />
                </TouchableOpacity>
              </View>
              {stickerPickerOpen && (
                <View style={styles.stickerGrid}>
                  {STICKER_OPTIONS.map((emoji) => (
                    <TouchableOpacity
                      key={emoji}
                      style={[
                        styles.stickerOption,
                        selectedStickers.includes(emoji) && styles.stickerOptionSelected,
                      ]}
                      onPress={() => toggleSticker(emoji)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.stickerOptionEmoji}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Countdown Preview */}
            <Text style={styles.countdownText}>Room countdown: 4:00:00</Text>

            {/* Background Picker */}
            <View style={styles.bgSection}>
              <TouchableOpacity
                style={styles.bgPickerTrigger}
                onPress={() => {
                  playClick()
                  setBgPickerOpen(!bgPickerOpen)
                  setVibeDropdownOpen(false)
                  setStickerPickerOpen(false)
                }}
                activeOpacity={0.7}
              >
                {useCustomBg && initialImageUrl ? (
                  <Image source={{ uri: initialImageUrl }} style={styles.bgTriggerThumb} />
                ) : (
                  <Ionicons name="image-outline" size={14} color={colors.primary} />
                )}
                <Text style={styles.bgPickerLabel} numberOfLines={1}>
                  {useCustomBg && initialImageUrl ? 'from confluence' : getBackgroundById(selectedBackground).label}
                </Text>
                <Ionicons
                  name={bgPickerOpen ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color="rgba(255, 255, 255, 0.4)"
                />
              </TouchableOpacity>
              {bgPickerOpen && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.bgScrollStrip}
                  contentContainerStyle={styles.bgScrollContent}
                >
                  {/* Confluence image option — only shown when triggered from a post */}
                  {initialImageUrl && (
                    <TouchableOpacity
                      style={[styles.bgThumbWrap, useCustomBg && styles.bgThumbWrapSelected]}
                      onPress={() => { playClick(); setUseCustomBg(true) }}
                      activeOpacity={0.7}
                    >
                      <Image source={{ uri: initialImageUrl }} style={styles.bgThumbImage} />
                      <Text style={[styles.bgThumbLabel, useCustomBg && styles.bgThumbLabelSelected]} numberOfLines={1}>
                        confluence
                      </Text>
                    </TouchableOpacity>
                  )}
                  {BACKGROUNDS.map((bg) => (
                    <TouchableOpacity
                      key={bg.id}
                      style={[
                        styles.bgThumbWrap,
                        !useCustomBg && selectedBackground === bg.id && styles.bgThumbWrapSelected,
                      ]}
                      onPress={() => { playClick(); setUseCustomBg(false); setSelectedBackground(bg.id) }}
                      activeOpacity={0.7}
                    >
                      {bg.source ? (
                        <Image source={bg.source} style={styles.bgThumbImage} />
                      ) : (
                        <View style={styles.bgThumbNone}>
                          <Ionicons name="close-circle-outline" size={16} color={colors.offline} />
                        </View>
                      )}
                      <Text
                        style={[
                          styles.bgThumbLabel,
                          !useCustomBg && selectedBackground === bg.id && styles.bgThumbLabelSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {bg.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Vibe Dropdown — wrapper for relative positioning */}
            <View style={styles.vibeDropdownWrapper}>
              <TouchableOpacity
                style={styles.vibeDropdownTrigger}
                onPress={() => { playClick(); setVibeDropdownOpen(!vibeDropdownOpen) }}
                activeOpacity={0.7}
              >
                <Ionicons name="musical-notes" size={14} color={colors.primary} />
                <Text style={styles.vibeDropdownLabel} numberOfLines={1}>
                  {selectedVibeLabel}
                </Text>
                <Ionicons
                  name={vibeDropdownOpen ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color="rgba(255, 255, 255, 0.4)"
                />
              </TouchableOpacity>

              {/* Dropdown list — opens directly below the trigger */}
              {vibeDropdownOpen && (
                <View style={styles.vibeDropdownContainer}>
                  <ScrollView
                    style={styles.vibeDropdownList}
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled
                  >
                    {VIBES.map((vibe) => (
                      <TouchableOpacity
                        key={vibe.id}
                        style={[
                          styles.vibeDropdownOption,
                          selectedVibe === vibe.id && styles.vibeDropdownOptionSelected,
                        ]}
                        onPress={() => {
                          playClick()
                          setSelectedVibe(vibe.id)
                          setVibeDropdownOpen(false)
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.vibeDropdownOptionText,
                            selectedVibe === vibe.id && styles.vibeDropdownOptionTextSelected,
                          ]}
                        >
                          {vibe.label}
                        </Text>
                        {selectedVibe === vibe.id && (
                          <Ionicons name="checkmark" size={16} color={colors.primary} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom Logo Watermark — outside KeyboardAvoidingView so keyboard covers it */}
      <View style={styles.bottomLogo} pointerEvents="none">
        <Image
          source={require('../../../assets/images/green-logo.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </View>

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
  mainContainer: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 16,
    padding: 16,
    overflow: 'visible',
  },

  // Header — matches CyberLoungeDetailScreen
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(34, 255, 10, 0.1)',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.primary,
    flex: 1,
    textAlign: 'center',
  },

  // Name Input
  nameInput: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
  },

  // Host Row
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  hostAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    marginRight: 10,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#a3a3a3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostInfo: {
    flex: 1,
  },
  hostName: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  hostLabel: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: '#ffffff',
  },

  // Create Button
  createButtonOuter: {
    borderRadius: 22,
    shadowColor: '#23ff0d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  createButton: {
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
  createButtonHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  createButtonText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textDark,
    marginLeft: 4,
  },

  // Sticker Picker
  stickerSection: {
    marginBottom: 12,
  },
  stickerDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stickerEmoji: {
    fontSize: 28,
  },
  stickerPlaceholder: {
    fontSize: 12,
    fontFamily: fonts.mono,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  stickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 4,
  },
  stickerOption: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  stickerOptionSelected: {
    backgroundColor: 'rgba(34, 255, 10, 0.15)',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  stickerOptionEmoji: {
    fontSize: 20,
  },

  // Countdown
  countdownText: {
    fontSize: 13,
    fontFamily: fonts.mono,
    color: '#ffffff',
    textAlign: 'right',
    marginBottom: 16,
  },

  // Vibe Dropdown
  vibeDropdownWrapper: {
    zIndex: 100,
  },
  vibeDropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 8,
  },
  vibeDropdownLabel: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: '#ffffff',
  },
  vibeDropdownContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '100%',
    marginTop: 4,
    zIndex: 100,
    backgroundColor: colors.backgroundCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  vibeDropdownList: {
    maxHeight: 280,
    paddingVertical: 6,
  },
  vibeDropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  vibeDropdownOptionSelected: {
    backgroundColor: 'rgba(34, 255, 10, 0.08)',
  },
  vibeDropdownOptionText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: '#ffffff',
  },
  vibeDropdownOptionTextSelected: {
    fontFamily: fonts.bold,
  },

  // Background Picker
  bgSection: {
    marginBottom: 12,
  },
  bgPickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 8,
  },
  bgPickerLabel: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: '#ffffff',
  },
  bgScrollStrip: {
    marginTop: 8,
  },
  bgScrollContent: {
    gap: 8,
    paddingRight: 4,
  },
  bgThumbWrap: {
    alignItems: 'center',
    width: 56,
    borderRadius: 8,
    padding: 3,
  },
  bgThumbWrapSelected: {
    backgroundColor: 'rgba(34, 255, 10, 0.15)',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  bgTriggerThumb: {
    width: 20,
    height: 20,
    borderRadius: 4,
    marginRight: 2,
  },
  bgThumbImage: {
    width: 48,
    height: 85,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  bgThumbNone: {
    width: 48,
    height: 85,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  bgThumbLabel: {
    fontSize: 8,
    fontFamily: fonts.regular,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 3,
    textAlign: 'center',
  },
  bgThumbLabelSelected: {
    fontFamily: fonts.bold,
  },

  // Bottom Logo — positioned on SafeAreaView so keyboard covers it
  bottomLogo: {
    position: 'absolute',
    bottom: 28,
    right: 28,
    zIndex: 0,
  },
  logoImage: {
    width: 250,
    height: 250,
    opacity: 0.15,
  },
})

export default CyberLoungeCreateScreen
