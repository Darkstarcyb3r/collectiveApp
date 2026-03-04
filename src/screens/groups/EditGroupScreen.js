// Edit Group Screen
// Allows creator to edit group name, description, and banner image

import React, { useState, useEffect, useRef } from 'react'
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
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import * as ImagePicker from 'expo-image-picker'
import { colors } from '../../theme'
import { fonts } from '../../theme/typography'
import { getGroup, updateGroup, updateGroupBanner } from '../../services/groupService'
import { validateImageAsset } from '../../utils/imageValidation'
import LightTabBar from '../../components/navigation/LightTabBar'
import { playClick } from '../../services/soundService'

const MAX_DESCRIPTION_WORDS = 50

const EditGroupScreen = ({ navigation, route }) => {
  const { groupId } = route.params
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [bannerUrl, setBannerUrl] = useState(null)
  const [newBannerUri, setNewBannerUri] = useState(null)
  const [newBannerMeta, setNewBannerMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const lightTabRef = useRef(null)
  const lastScrollY = useRef(0)

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

  useEffect(() => {
    const fetchGroup = async () => {
      const result = await getGroup(groupId)
      if (!result.success) {
        setLoading(false)
        Alert.alert('Not Found', 'This group has been deleted.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ])
        return
      }
      setName(result.data.name || '')
      setDescription(result.data.description || '')
      setBannerUrl(result.data.bannerUrl || null)
      setLoading(false)
    }
    fetchGroup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId])

  const wordCount = description.trim() ? description.trim().split(/\s+/).length : 0

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
      setNewBannerUri(asset.uri)
      setNewBannerMeta({ fileSize: validation.fileSize, mimeType: validation.mimeType })
    }
  }

  const handleSave = async () => {
    playClick()
    if (!name.trim()) {
      Alert.alert('Required', 'Group name cannot be empty.')
      return
    }

    setSaving(true)

    // Update name and description
    const result = await updateGroup(groupId, {
      name: name.trim(),
      description: description.trim(),
    })

    // Upload new banner if selected
    let bannerFailed = false
    if (newBannerUri) {
      const bannerResult = await updateGroupBanner(groupId, newBannerUri, newBannerMeta || {})
      if (!bannerResult.success) {
        bannerFailed = true
      }
    }

    setSaving(false)

    if (result.success) {
      if (bannerFailed) {
        Alert.alert(
          'Partially Saved',
          'Group info was updated but the banner photo failed to upload. Please try again.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        )
      } else {
        navigation.goBack()
      }
    } else {
      Alert.alert('Error', 'Could not update group.')
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.backgroundLight} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  // Show the new banner if picked, otherwise the existing one
  const displayBanner = newBannerUri || bannerUrl

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.backgroundLight} />

      <View style={styles.mainContainer}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onScroll={handleScroll}
            onScrollBeginDrag={handleScrollBeginDrag}
            scrollEventThrottle={16}
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
              <Text style={styles.headerTitle}>Edit Group</Text>
              <View style={{ width: 24 }} />
            </View>

            {/* Name Input */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Group Name</Text>
              <TextInput
                style={styles.nameInput}
                value={name}
                onChangeText={setName}
                placeholder="Group name"
                placeholderTextColor={colors.offline}
                maxLength={40}
              />
            </View>

            {/* Description Input */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={styles.descriptionInput}
                value={description}
                onChangeText={handleDescriptionChange}
                placeholder="What is your group about?"
                placeholderTextColor={colors.offline}
                multiline
                textAlignVertical="top"
              />
              <Text style={styles.wordCount}>
                {wordCount}/{MAX_DESCRIPTION_WORDS} words
              </Text>
            </View>

            {/* Banner Image */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Banner Photo</Text>
              <TouchableOpacity style={styles.bannerUpload} onPress={pickBanner}>
                {displayBanner ? (
                  <Image source={{ uri: displayBanner }} style={styles.bannerPreview} />
                ) : (
                  <View style={styles.bannerPlaceholder}>
                    <Ionicons name="image-outline" size={32} color={colors.offline} />
                    <Text style={styles.bannerPlaceholderText}>tap to upload a banner photo</Text>
                  </View>
                )}
              </TouchableOpacity>
              {displayBanner && <Text style={styles.bannerHint}>Tap to change banner</Text>}
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveButtonOuter, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              <LinearGradient
                colors={['#cafb6c', '#71f200', '#23ff0d']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.saveButton}
              >
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']}
                  style={styles.saveButtonHighlight}
                />
                {saving ? (
                  <ActivityIndicator size="small" color={colors.textDark} />
                ) : (
                  <Text style={styles.saveText}>Save Changes</Text>
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 80,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.textDark,
  },

  // Inputs
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textDark,
    marginBottom: 6,
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
  },
  bannerPreview: {
    width: '100%',
    aspectRatio: 3,
    borderRadius: 12,
  },
  bannerPlaceholder: {
    width: '100%',
    aspectRatio: 3,
    backgroundColor: '#f0f0f0',
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
  bannerHint: {
    fontSize: 11,
    fontFamily: fonts.italic,
    color: colors.offline,
    textAlign: 'center',
    marginTop: 6,
  },

  // Save
  saveButtonOuter: {
    borderRadius: 24,
    alignSelf: 'flex-start',
    marginTop: 10,
    shadowColor: '#23ff0d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  saveButton: {
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 32,
    minWidth: 160,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
    borderLeftColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    borderRightColor: 'rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
  },
  saveButtonHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveText: {
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

export default EditGroupScreen
