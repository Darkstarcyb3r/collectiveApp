// Confluence Add Post Screen
// Upload an image to the confluence feed
// 5 posts per month limit, posts expire after 30 days, posts are final

import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  TextInput,
  Modal,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { colors } from '../../../theme'
import { fonts } from '../../../theme/typography'
import { useAuth } from '../../../contexts/AuthContext'
import { createConfluencePost, getMonthlyConfluenceCount } from '../../../services/everyoneService'
import { signedUpload } from '../../../utils/cloudinaryUpload'
import { validateImageAsset } from '../../../utils/imageValidation'
import DarkTabBar from '../../../components/navigation/DarkTabBar'

const MAX_MONTHLY = 10

const ConfluenceAddPostScreen = ({ navigation }) => {
  const { user, userProfile } = useAuth()
  const [imageUri, setImageUri] = useState(null)
  const [imageMeta, setImageMeta] = useState(null)
  const [caption, setCaption] = useState('')
  const [link, setLink] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [tempLinkLabel, setTempLinkLabel] = useState('')
  const [tempLink, setTempLink] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [monthlyCount, setMonthlyCount] = useState(0)

  useEffect(() => {
    const fetchCount = async () => {
      if (user?.uid) {
        const result = await getMonthlyConfluenceCount(user.uid)
        if (result.success) {
          setMonthlyCount(result.count)
        }
      }
    }
    fetchCount()
  }, [user?.uid])

  const handlePickImage = async () => {
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

  const handlePublish = () => {
    if (!imageUri) {
      Alert.alert('Image Required', 'Please upload a photo.')
      return
    }
    if (monthlyCount >= MAX_MONTHLY) {
      Alert.alert(
        'Limit Reached',
        'You have reached your 5 confluence contributions for this month.'
      )
      return
    }
    if (!user?.uid) return

    Alert.alert(
      'Publish Confluence',
      'Are you sure you want to post? This action cannot be reversed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Publish',
          onPress: async () => {
            setPublishing(true)

            try {
              const uploadResult = await signedUpload(
                imageUri,
                'collective/confluence',
                `confluence_${user.uid}`,
                imageMeta || {}
              )
              if (!uploadResult.success) {
                Alert.alert('Upload Error', uploadResult.error || 'Could not upload image.')
                setPublishing(false)
                return
              }

              const result = await createConfluencePost({
                imageUrl: uploadResult.url,
                caption: caption.trim(),
                link: link.trim(),
                linkLabel: linkLabel.trim(),
                authorId: user.uid,
                authorName: userProfile?.name || '',
                authorPhoto: userProfile?.profilePhoto || null,
              })

              if (result.success) {
                navigation.goBack()
              } else {
                Alert.alert('Error', result.error || 'Could not publish.')
              }
            } catch (error) {
              console.log('Confluence publish error:', error.message)
              Alert.alert('Upload Error', error.message || 'Could not upload image.')
            }

            setPublishing(false)
          },
        },
      ]
    )
  }

  const isMaxed = monthlyCount >= MAX_MONTHLY

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Main Container with green border */}
        <View style={styles.mainContainer}>
          {/* Header Row */}
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ padding: 4 }}
            >
              <Ionicons name="chevron-back" size={24} color={colors.textGreen} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.publishButton, (publishing || isMaxed) && { opacity: 0.4 }]}
              onPress={handlePublish}
              disabled={publishing || isMaxed}
            >
              <Ionicons name="add" size={14} color={colors.textDark} />
              <Text style={styles.publishButtonText}>Publish</Text>
            </TouchableOpacity>
          </View>

          {/* Title */}
          <Text style={styles.title}>Cultural Confluence</Text>

          {/* Image Upload */}
          <TouchableOpacity style={styles.imageUpload} onPress={handlePickImage}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.uploadedImage} />
            ) : (
              <View style={styles.uploadPlaceholder}>
                <Ionicons name="image-outline" size={48} color={colors.textDark} />
                <Text style={styles.uploadText}>upload a photo</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Caption — hidden when a link has been saved */}
          {!linkLabel && !link ? (
            <View style={styles.captionRow}>
              <Text style={styles.captionLabel}>caption:</Text>
              <TextInput
                style={styles.captionInput}
                value={caption}
                onChangeText={setCaption}
                placeholder="// caption goes here"
                placeholderTextColor={colors.offline}
                maxLength={50}
                numberOfLines={1}
                multiline={false}
              />
              <Text style={styles.captionCount}>{caption.length}/50</Text>
            </View>
          ) : null}

          {/* Hyperlink option — hidden when caption has text */}
          {!caption.trim() && (
            <TouchableOpacity
              style={styles.linkCell}
              onPress={() => {
                setTempLinkLabel(linkLabel)
                setTempLink(link)
                setShowLinkModal(true)
              }}
              activeOpacity={0.7}
            >
              {linkLabel ? (
                <Text style={styles.linkDisplayText} numberOfLines={1}>
                  {linkLabel}
                </Text>
              ) : (
                <Text style={styles.linkPlaceholder}>+ Add link</Text>
              )}
            </TouchableOpacity>
          )}

          {/* Notices */}
          <Text style={styles.notice}>
            Anonymous posting of a collective stream of consciousness with your connects
          </Text>

          <Text style={styles.notice}>
            Each user gets {MAX_MONTHLY} confluence contributions a month, then it resets at the
            beginning of the month. Contribute to the trove.
          </Text>

          <Text style={styles.countText}>
            {monthlyCount}/{MAX_MONTHLY} used this month
          </Text>

          {/* Collective Logo */}
          <View style={styles.logoContainer}>
            <Image
              source={require('../../../assets/images/green-logo.png')}
              style={styles.logoImage}
            />
          </View>
        </View>
      </ScrollView>
      {/* ==================== LINK MODAL ==================== */}
      <Modal
        visible={showLinkModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLinkModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowLinkModal(false)}
        >
          <View style={styles.linkModalContainer}>
            <Text style={styles.linkModalTitle}>Add Link</Text>
            <TextInput
              style={styles.linkModalInput}
              value={tempLinkLabel}
              onChangeText={setTempLinkLabel}
              placeholder="Label (e.g. Sign Up Here)"
              placeholderTextColor={colors.offline}
              maxLength={50}
            />
            <TextInput
              style={styles.linkModalInput}
              value={tempLink}
              onChangeText={setTempLink}
              placeholder="Paste URL"
              placeholderTextColor={colors.offline}
              autoCapitalize="none"
              keyboardType="url"
            />
            <View style={styles.linkModalButtons}>
              {link || linkLabel ? (
                <TouchableOpacity
                  style={styles.linkModalRemoveButton}
                  onPress={() => {
                    setLink('')
                    setLinkLabel('')
                    setTempLink('')
                    setTempLinkLabel('')
                    setShowLinkModal(false)
                  }}
                >
                  <Text style={styles.linkModalRemoveText}>Remove</Text>
                </TouchableOpacity>
              ) : (
                <View />
              )}
              <TouchableOpacity
                style={styles.linkModalSaveButton}
                onPress={() => {
                  setLink(tempLink.trim())
                  setLinkLabel(tempLinkLabel.trim())
                  setShowLinkModal(false)
                }}
              >
                <Text style={styles.linkModalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Dark Tab Bar */}
      <DarkTabBar />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 120,
  },

  // Main Container with green border
  mainContainer: {
    backgroundColor: colors.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#00FF00',
    padding: 16,
    minHeight: '90%',
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    marginTop: 0,
  },
  publishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  publishButtonText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.textDark,
    marginLeft: 2,
  },

  // Title
  title: {
    fontSize: 20,
    fontFamily: fonts.regular,
    color: colors.textGreen,
    marginBottom: 24,
    textAlign: 'center',
  },

  // Image Upload
  imageUpload: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
    height: 180,
    marginBottom: 24,
    overflow: 'hidden',
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
  },
  uploadPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.textDark,
    marginTop: 8,
  },

  // Caption
  captionRow: {
    marginBottom: 18,
    marginTop: -10,
  },
  captionLabel: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textGreen,
    marginBottom: 8,
  },
  captionInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.textGreen,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    fontSize: 13,
    fontFamily: fonts.mono,
    color: '#ffffff',
  },
  captionCount: {
    textAlign: 'right',
    fontSize: 11,
    fontFamily: fonts.mono,
    color: colors.textGreen,
    marginTop: 4,
  },

  // Link cell
  linkCell: {
    borderWidth: 1,
    borderColor: colors.textGreen,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 18,
    marginTop: -10,
    backgroundColor: colors.background,
  },
  linkDisplayText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: '#ffffff',
    textDecorationLine: 'underline',
  },
  linkPlaceholder: {
    fontSize: 13,
    fontFamily: fonts.italic,
    color: colors.offline,
  },

  // Link Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkModalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    width: '95%',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  linkModalTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.textDark,
    marginBottom: 16,
  },
  linkModalInput: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textDark,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  linkModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  linkModalRemoveButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  linkModalRemoveText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.offline,
  },
  linkModalSaveButton: {
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 16,
  },
  linkModalSaveText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.textDark,
  },

  // Notices
  notice: {
    fontSize: 12,
    fontFamily: fonts.mono,
    color: colors.textGreen,
    lineHeight: 18,
    marginBottom: 12,
  },
  countText: {
    fontSize: 12,
    fontFamily: fonts.mono,
    color: colors.textGreen,
    marginTop: 0,
  },

  // Logo
  logoContainer: {
    alignItems: 'flex-end',
    marginTop: -30,
  },
  logoImage: {
    width: 200,
    height: 200,
  },
})

export default ConfluenceAddPostScreen
