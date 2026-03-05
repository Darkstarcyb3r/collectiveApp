// Mutual Aid Create Screen
// Create a new mutual aid group with name, link, description

import React, { useState, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  Image,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import * as ImagePicker from 'expo-image-picker'
import { colors } from '../../../theme'
import { fonts } from '../../../theme/typography'
import { useAuth } from '../../../contexts/AuthContext'
import { createMutualAidGroup } from '../../../services/everyoneService'
import { validateImageAsset } from '../../../utils/imageValidation'
import { signedUpload } from '../../../utils/cloudinaryUpload'
import CityAutocomplete from '../../../components/common/CityAutocomplete'
import LightTabBar from '../../../components/navigation/LightTabBar'
import { playClick } from '../../../services/soundService'

const MutualAidCreateScreen = ({ route, navigation }) => {
  const { category, _title } = route.params
  const { user, userProfile } = useAuth()
  const [name, setName] = useState('')
  const [caption, setCaption] = useState('')
  const [link, setLink] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [city, setCity] = useState('')
  const [isGlobal, setIsGlobal] = useState(false)
  const [description, setDescription] = useState('')
  const [vetByAuthor, setVetByAuthor] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [imageUri, setImageUri] = useState(null)
  const [imageMeta, setImageMeta] = useState(null)
  const lightTabRef = useRef(null)
  const lastScrollY = useRef(0)
  const isArtAction = category === 'action_art'

  const handlePickImage = async () => {
    playClick()
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    })
    if (!result.canceled && result.assets?.length > 0) {
      const asset = result.assets[0]
      const validation = await validateImageAsset(asset)
      if (!validation.valid) {
        Alert.alert('Image Error', validation.error)
        return
      }
      setImageUri(asset.uri)
      setImageMeta({ fileSize: validation.fileSize, mimeType: validation.mimeType })
    }
  }

  const handlePublish = async () => {
    playClick()
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter a group name.')
      return
    }
    if (!isGlobal && !city.trim()) {
      Alert.alert('City Required', 'Please select a city or mark as Global.')
      return
    }
    if (!user?.uid) return

    setPublishing(true)

    // Upload image if one was selected (Art & Action only)
    let imageUrl = null
    if (isArtAction && imageUri) {
      const uploadResult = await signedUpload(
        imageUri,
        'collective/mutualaid',
        `mutualaid_${user.uid}`,
        imageMeta || {}
      )
      if (!uploadResult.success) {
        Alert.alert('Upload Error', uploadResult.error || 'Could not upload image.')
        setPublishing(false)
        return
      }
      imageUrl = uploadResult.url
    }

    const result = await createMutualAidGroup({
      name: name.trim(),
      caption: caption.trim(),
      link: link.trim(),
      linkLabel: linkLabel.trim(),
      city: isGlobal ? 'Global' : city.trim(),
      description: description.trim(),
      category,
      authorId: user.uid,
      authorName: userProfile?.name || '',
      authorPhoto: userProfile?.profilePhoto || null,
      vetByAuthor,
      ...(imageUrl && { imageUrl }),
    })

    setPublishing(false)
    if (result.success) {
      navigation.goBack()
    } else {
      Alert.alert('Error', 'Could not create group.')
    }
  }

  const handleScroll = (event) => {
    const currentScrollY = event.nativeEvent.contentOffset.y
    const contentHeight = event.nativeEvent.contentSize.height
    const layoutHeight = event.nativeEvent.layoutMeasurement.height
    const scrollDirection = currentScrollY > lastScrollY.current ? 'down' : 'up'
    const scrollableHeight = contentHeight - layoutHeight
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.backgroundLight} />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          onScroll={handleScroll}
          onScrollBeginDrag={handleScrollBeginDrag}
          scrollEventThrottle={16}
        >
          <View style={styles.mainContainer}>
            {/* Header */}
            <View style={styles.headerOuter}>
              <LinearGradient
                colors={['#ff93bd', '#8b5cf6', '#32259e']}
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
                  <Ionicons name="chevron-back" size={24} color="#ffffff" />
                </TouchableOpacity>
                <Ionicons
                  name="globe-outline"
                  size={22}
                  color="#ffffff"
                  style={{ marginLeft: 4 }}
                />
                <Text style={[styles.headerTitle, { color: '#ffffff', marginLeft: 8 }]}>Add a Mutual Aid Group</Text>
                <View style={{ width: 24 }} />
              </LinearGradient>
            </View>

            {/* Action Row */}
            <View style={styles.actionRow}>
              
              <TouchableOpacity
                style={[styles.publishButtonOuter, publishing && { opacity: 0.5 }]}
                onPress={handlePublish}
                disabled={publishing}
              >
                <LinearGradient
                  colors={['#ff93bd', '#8b5cf6', '#32259e']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.publishButton}
                >
                  <LinearGradient
                    colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']}
                    style={styles.publishButtonHighlight}
                  />
                  <Text style={[styles.publishButtonText, { color: '#ffffff' }]}>Publish</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Form */}
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter Group Name"
              placeholderTextColor={colors.offline}
              maxLength={40}
            />

            {/* Image Picker — Art & Action only */}
            {isArtAction && (
              <View style={styles.imageSection}>
                {imageUri ? (
                  <View style={styles.imagePreviewContainer}>
                    <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                    <View style={styles.imageActions}>
                      <TouchableOpacity onPress={handlePickImage} style={styles.imageChangeButton}>
                        <Ionicons name="camera-outline" size={16} color={colors.textDark} />
                        <Text style={styles.imageChangeText}>Change</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => { playClick(); setImageUri(null); setImageMeta(null) }}
                        style={styles.imageRemoveButton}
                      >
                        <Ionicons name="close-circle-outline" size={16} color={colors.offline} />
                        <Text style={styles.imageRemoveText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.imagePicker} onPress={handlePickImage}>
                    <Ionicons name="image-outline" size={24} color={colors.offline} />
                    <Text style={styles.imagePickerText}>+ Add photo</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <TextInput
              style={styles.input}
              value={caption}
              onChangeText={setCaption}
              placeholder="Caption"
              placeholderTextColor={colors.offline}
              maxLength={80}
            />

            {/* Link fields (inline) */}
            <TextInput
              style={styles.input}
              value={linkLabel}
              onChangeText={setLinkLabel}
              placeholder="Link label (e.g. Sign Up Here)"
              placeholderTextColor={colors.offline}
              maxLength={80}
            />
            <TextInput
              style={styles.input}
              value={link}
              onChangeText={setLink}
              placeholder="Paste URL"
              placeholderTextColor={colors.offline}
              autoCapitalize="none"
              keyboardType="url"
            />

            {!isGlobal && (
              <CityAutocomplete
                value={city}
                onCitySelect={(selectedCity) => setCity(selectedCity)}
                placeholder="Filter by city (required)..."
              />
            )}

            {/* Global Toggle */}
            <TouchableOpacity
              style={styles.globalToggleRow}
              onPress={() => {
                playClick()
                setIsGlobal(!isGlobal)
                if (!isGlobal) setCity('')
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.vetCheckbox, isGlobal && styles.vetCheckboxActive]}>
                {isGlobal && <Ionicons name="checkmark" size={14} color={colors.textDark} />}
              </View>
              <Ionicons
                name="globe-outline"
                size={14}
                color={colors.textDark}
                style={{ marginRight: 4 }}
              />
              <Text style={styles.vetToggleLabel}>Global / Digital</Text>
            </TouchableOpacity>

            <TextInput
              style={[styles.input, styles.descriptionInput]}
              value={description}
              onChangeText={setDescription}
              placeholder="Description"
              placeholderTextColor={colors.offline}
              multiline
              textAlignVertical="top"
            />

            {/* Vet Toggle */}
            <TouchableOpacity
              style={styles.vetToggleRow}
              onPress={() => { playClick(); setVetByAuthor(!vetByAuthor) }}
              activeOpacity={0.7}
            >
              <View style={[styles.vetCheckbox, vetByAuthor && styles.vetCheckboxActive]}>
                {vetByAuthor && <Ionicons name="checkmark" size={14} color={colors.textDark} />}
              </View>
              <View style={styles.vetTextContainer}>
                <Text style={styles.vetToggleLabel}>Vet this organization</Text>
                <Text style={styles.vetNote}>(you have direct experience with this resource)</Text>
              </View>
            </TouchableOpacity>

            {/* Collective Logo */}
            <View style={styles.logoContainer}>
              <Image
                source={require('../../../assets/images/black-logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
          </View>
        </ScrollView>
      <LightTabBar ref={lightTabRef} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 120,
  },
  mainContainer: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 16,
  },

  // Header
  headerOuter: {
    borderRadius: 10,
    shadowColor: '#ff93bd',
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
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.textDark,
  },

  // Action Row
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 16,
    gap: 12,
  },
  publishButtonOuter: {
    borderRadius: 20,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  publishButton: {
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
  publishButtonHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  publishButtonText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textDark,
  },

  // Form
  input: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textDark,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  descriptionInput: {
    minHeight: 80,
  },

  // Image Picker (Art & Action)
  imageSection: {
    marginBottom: 12,
  },
  imagePicker: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 8,
    borderStyle: 'dashed',
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  imagePickerText: {
    fontSize: 13,
    fontFamily: fonts.italic,
    color: colors.offline,
    marginTop: 6,
  },
  imagePreviewContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  imagePreview: {
    width: '100%',
    height: 180,
    borderRadius: 8,
  },
  imageActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
  },
  imageChangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  imageChangeText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textDark,
  },
  imageRemoveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  imageRemoveText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.offline,
  },

  // Global Toggle
  globalToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },

  // Vet Toggle
  vetToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  vetCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    marginRight: 10,
  },
  vetCheckboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  vetToggleLabel: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textDark,
  },
  vetNote: {
    fontSize: 11,
    fontFamily: fonts.italic,
    color: colors.offline,
  },

  // Logo
  logoContainer: {
    alignItems: 'flex-end',
    marginTop: 0,
    opacity: 1,
  },
  logoImage: {
    width: 250,
    height: 250,
  },
})

export default MutualAidCreateScreen
