// Create Group Screen — matches Figma "New Group - Create"
// Creator avatar, group name input, description (max 50 words), Publish button, logo watermark

import React, { useState, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import * as ImagePicker from 'expo-image-picker'
import { colors } from '../../theme'
import { fonts } from '../../theme/typography'
import { useAuth } from '../../contexts/AuthContext'
import { createGroup } from '../../services/groupService'
import { validateImageAsset } from '../../utils/imageValidation'
import LightTabBar from '../../components/navigation/LightTabBar'
import { playClick } from '../../services/soundService'

const MAX_DESCRIPTION_WORDS = 50

const CreateGroupScreen = ({ navigation }) => {
  const { user, userProfile } = useAuth()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [bannerUri, setBannerUri] = useState(null)
  const [bannerMeta, setBannerMeta] = useState(null)
  const [loading, setLoading] = useState(false)
  const lightTabRef = useRef(null)
  const lastScrollY = useRef(0)

  const wordCount = description.trim() ? description.trim().split(/\s+/).length : 0

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

  const handleDescriptionChange = (text) => {
    const words = text.trim().split(/\s+/)
    if (text.trim() === '' || words.length <= MAX_DESCRIPTION_WORDS) {
      setDescription(text)
    }
  }

  const pickBanner = async () => {
    playClick()
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant permission to access your photos.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    })

    if (!result.canceled) {
      const asset = result.assets[0]
      const validation = await validateImageAsset(asset)
      if (!validation.valid) {
        Alert.alert('Image Error', validation.error)
        return
      }
      setBannerUri(asset.uri)
      setBannerMeta({ fileSize: validation.fileSize, mimeType: validation.mimeType })
    }
  }

  const handlePublish = async () => {
    playClick()
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a group name.')
      return
    }

    setLoading(true)
    const result = await createGroup(user.uid, {
      name: name.trim(),
      description: description.trim(),
      bannerUri: bannerUri,
      bannerMeta: bannerMeta || {},
    })
    setLoading(false)

    if (result.success) {
      if (result.bannerFailed && bannerUri) {
        Alert.alert(
          'Group Created',
          'Your group was created but the banner photo failed to upload. You can add it later from Edit Group.',
          [
            {
              text: 'OK',
              onPress: () => navigation.replace('GroupDetail', { groupId: result.groupId }),
            },
          ]
        )
      } else {
        navigation.replace('GroupDetail', { groupId: result.groupId })
      }
    } else {
      Alert.alert('Error', result.error || 'Could not create group.')
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.backgroundLight} />

      <View style={styles.mainContainer}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onScroll={handleScroll}
            onScrollBeginDrag={handleScrollBeginDrag}
            scrollEventThrottle={16}
          >
            {/* Header Row */}
            <View style={styles.headerRow}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ padding: 4 }}
              >
                <Ionicons name="chevron-back" size={28} color={colors.textDark} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Create a Group</Text>
              <View style={{ width: 28 }} />
            </View>

            {/* Creator Avatar — links to own profile */}
            <TouchableOpacity
              style={styles.creatorSection}
              onPress={() => {
                playClick()
                if (user?.uid) {
                  navigation.navigate('UserProfile', { userId: user.uid })
                }
              }}
            >
              {userProfile?.profilePhoto ? (
                <Image
                  source={{ uri: userProfile.profilePhoto, cache: 'reload' }}
                  style={styles.creatorAvatar}
                />
              ) : (
                <View style={styles.creatorAvatarPlaceholder}>
                  <Ionicons name="person" size={22} color="#666" />
                </View>
              )}
              <View style={styles.creatorInfo}>
                <Text style={styles.creatorName}>{userProfile?.name || 'your name'}</Text>
                <Text style={styles.creatorLabel}>creator</Text>
              </View>
            </TouchableOpacity>

            {/* Group Name Input */}
            <View style={styles.inputSection}>
              <TextInput
                style={styles.nameInput}
                value={name}
                onChangeText={setName}
                placeholder="enter group name"
                placeholderTextColor={colors.offline}
                maxLength={26}
              />
            </View>

            {/* Description Input */}
            <View style={styles.inputSection}>
              <TextInput
                style={styles.descriptionInput}
                value={description}
                onChangeText={handleDescriptionChange}
                placeholder="what is your group about? (max 50 words)"
                placeholderTextColor={colors.offline}
                multiline
                textAlignVertical="top"
              />
              <Text style={styles.wordCount}>
                {wordCount}/{MAX_DESCRIPTION_WORDS} words
              </Text>
            </View>

            {/* Banner Image Upload */}
            <TouchableOpacity style={styles.bannerUpload} onPress={pickBanner}>
              {bannerUri ? (
                <Image source={{ uri: bannerUri }} style={styles.bannerPreview} />
              ) : (
                <View style={styles.bannerPlaceholder}>
                  <Ionicons name="image-outline" size={32} color={colors.offline} />
                  <Text style={styles.bannerPlaceholderText}>upload a group banner photo</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Publish Button */}
            <TouchableOpacity
              style={[styles.publishButtonOuter, loading && styles.publishButtonDisabled]}
              onPress={handlePublish}
              disabled={loading}
            >
              <LinearGradient
                colors={['#cafb6c', '#71f200', '#23ff0d']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.publishButton}
              >
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']}
                  style={styles.publishButtonHighlight}
                />
                {loading ? (
                  <ActivityIndicator size="small" color={colors.textDark} />
                ) : (
                  <Text style={styles.publishText}>Publish</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Bottom Logo Watermark */}
            <View style={styles.bottomLogo}>
              <Image
                source={require('../../assets/images/black-logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 80,
    flexGrow: 1,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginRight: 50,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.textDark,
    textAlign: 'center',
    flex: 1,
  },

  // Creator
  creatorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    alignSelf: 'flex-end',
  },
  creatorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  creatorAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#a3a3a3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorInfo: {
    marginLeft: 10,
  },
  creatorName: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.offline,
  },
  creatorLabel: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.textDark,
  },

  // Inputs
  inputSection: {
    marginBottom: 20,
  },
  nameInput: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: fonts.medium,
    color: colors.textDark,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  descriptionInput: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textDark,
    borderWidth: 1,
    borderColor: colors.borderLight,
    minHeight: 100,
  },
  wordCount: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.offline,
    textAlign: 'right',
    marginTop: 4,
  },

  // Banner
  bannerUpload: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  bannerPreview: {
    width: '100%',
    aspectRatio: 3,
    borderRadius: 12,
  },
  bannerPlaceholder: {
    width: '100%',
    aspectRatio: 3,
    backgroundColor: colors.inputBackground || '#f0f0f0',
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderStyle: 'dashed',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerPlaceholderText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.offline,
    marginTop: 4,
  },

  // Publish
  publishButtonOuter: {
    borderRadius: 24,
    alignSelf: 'flex-start',
    marginTop: 10,
    shadowColor: '#23ff0d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  publishButton: {
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 32,
    minWidth: 140,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
    borderLeftColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    borderRightColor: 'rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
  },
  publishButtonHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  publishButtonDisabled: {
    opacity: 0.6,
  },
  publishText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textDark,
  },

  // Bottom Logo
  bottomLogo: {
    alignItems: 'flex-end',
    marginTop: 'auto',
    paddingTop: 0,
  },
  logoImage: {
    width: 250,
    height: 250,
    opacity: 100,
  },
})

export default CreateGroupScreen
