// Barter Market Post Screen
// Read-only view: avatar, Contact button, barter type select, title, photo, description
// Author edit mode: editable fields with offering/lookingFor dropdowns, photo upload, save/cancel/delete

import React, { useState, useCallback } from 'react'
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
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import * as ImagePicker from 'expo-image-picker'
import { colors } from '../../../theme'
import { fonts } from '../../../theme/typography'
import { useAuth } from '../../../contexts/AuthContext'
import {
  getBarterPost,
  updateBarterPost,
  deleteBarterPost,
} from '../../../services/everyoneService'
import { sendChatRequest } from '../../../services/messageService'
import { signedUpload } from '../../../utils/cloudinaryUpload'
import { validateImageAsset } from '../../../utils/imageValidation'
import { ConfirmModal } from '../../../components/common'
import CityAutocomplete from '../../../components/common/CityAutocomplete'

const BARTER_TYPES = ['Service', 'Good', 'Currency']
const MONTHS_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const BarterMarketPostScreen = ({ route, navigation }) => {
  const { postId, editMode } = route.params
  const { user, userProfile } = useAuth()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(editMode || false)
  const [editTitle, setEditTitle] = useState('')
  const [editLookingForText, setEditLookingForText] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editOfferingType, setEditOfferingType] = useState('')
  const [editLookingForType, setEditLookingForType] = useState('')
  const [editCity, setEditCity] = useState('')
  const [editIsGlobal, setEditIsGlobal] = useState(false)
  const [offeringDropdownOpen, setOfferingDropdownOpen] = useState(false)
  const [lookingForDropdownOpen, setLookingForDropdownOpen] = useState(false)
  const [editImageUri, setEditImageUri] = useState(null)
  const [editImageMeta, setEditImageMeta] = useState(null)
  const [saving, setSaving] = useState(false)
  const [imageModalVisible, setImageModalVisible] = useState(false)
  const [deletePostConfirm, setDeletePostConfirm] = useState(false)

  const fetchPost = async () => {
    const result = await getBarterPost(postId)
    if (!result.success) {
      setLoading(false)
      Alert.alert('Not Found', 'This post has been deleted.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ])
      return
    }
    setPost(result.data)
    setEditTitle(result.data.title || '')
    setEditLookingForText(result.data.lookingForText || '')
    setEditDescription(result.data.description || '')
    setEditOfferingType(result.data.offeringType || '')
    setEditLookingForType(result.data.lookingForType || '')
    setEditCity(result.data.city === 'Global' ? '' : result.data.city || '')
    setEditIsGlobal(result.data.city === 'Global')
    setLoading(false)
  }

  useFocusEffect(
    useCallback(() => {
      fetchPost()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [postId])
  )

  const handleShare = async () => {
    const { shareContent, buildBarterLink } = require('../../../utils/shareLinks')
    await shareContent(
      `Check out this barter: ${post?.title || 'a new listing'} on Collective!`,
      buildBarterLink(postId)
    )
  }

  const handleContact = async () => {
    if (!post?.authorId || !user?.uid) return
    const blockedUsers = userProfile?.blockedUsers || []
    const blockedBy = userProfile?.blockedBy || []
    if (blockedUsers.includes(post.authorId) || blockedBy.includes(post.authorId)) {
      Alert.alert('Unavailable', 'This action is unavailable.')
      return
    }
    const result = await sendChatRequest(user.uid, post.authorId, userProfile, {
      name: post.authorName,
      profilePhoto: post.authorPhoto,
    })
    if (result.success) {
      if (result.status === 'accepted') {
        // Already connected — go straight to chat
        navigation.navigate('Chat', {
          conversationId: result.conversationId,
          otherUserId: post.authorId,
          otherUserName: post.authorName || 'Unknown',
          otherUserPhoto: post.authorPhoto || null,
        })
      } else if (result.alreadySent) {
        Alert.alert('Request Pending', 'Your chat request is still pending.')
      } else {
        Alert.alert(
          'Request Sent',
          `${post.authorName || 'This user'} will be notified of your chat request.`
        )
      }
    } else {
      Alert.alert('Error', 'Could not send chat request.')
    }
  }

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
      setEditImageUri(asset.uri)
      setEditImageMeta({ fileSize: validation.fileSize, mimeType: validation.mimeType })
    }
  }

  const handleSaveEdit = async () => {
    setSaving(true)

    let imageUrl = post.imageUrl || null

    // Upload new image if one was picked
    if (editImageUri) {
      const uploadResult = await signedUpload(
        editImageUri,
        'collective/barter',
        'barter',
        editImageMeta || {}
      )
      if (!uploadResult.success) {
        Alert.alert('Upload Error', uploadResult.error || 'Could not upload image.')
        setSaving(false)
        return
      }
      imageUrl = uploadResult.url
    }

    const savedCity = editIsGlobal ? 'Global' : editCity.trim()
    await updateBarterPost(postId, {
      title: editTitle.trim(),
      lookingForText: editLookingForText.trim(),
      description: editDescription.trim(),
      city: savedCity,
      offeringType: editOfferingType,
      lookingForType: editLookingForType,
      imageUrl,
    })
    setPost({
      ...post,
      title: editTitle.trim(),
      lookingForText: editLookingForText.trim(),
      description: editDescription.trim(),
      city: savedCity,
      offeringType: editOfferingType,
      lookingForType: editLookingForType,
      imageUrl,
    })
    setEditImageUri(null)
    setEditImageMeta(null)
    setSaving(false)
    setEditing(false)
  }

  const handleDelete = () => {
    setDeletePostConfirm(true)
  }

  const handleConfirmDeletePost = async () => {
    setDeletePostConfirm(false)
    await deleteBarterPost(postId)
    navigation.goBack()
  }

  const renderEditDropdown = (label, value, isOpen, setIsOpen, setValue, otherClose) => (
    <View style={styles.editDropdownSection}>
      <Text style={styles.editDropdownLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.editDropdownToggle}
        onPress={() => {
          setIsOpen(!isOpen)
          otherClose(false)
        }}
      >
        <Text style={value ? styles.editDropdownValue : styles.editDropdownPlaceholder}>
          {value || 'Select type'}
        </Text>
        <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textDark} />
      </TouchableOpacity>
      {isOpen && (
        <View style={styles.editDropdownMenu}>
          {BARTER_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.editDropdownOption, value === type && styles.editDropdownOptionActive]}
              onPress={() => {
                setValue(type)
                setIsOpen(false)
              }}
            >
              <Text
                style={[
                  styles.editDropdownOptionText,
                  value === type && styles.editDropdownOptionTextActive,
                ]}
              >
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  )

  if (loading || !post) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    )
  }

  const isAuthor = post.authorId === user?.uid

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.mainContainer}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ padding: 4 }}
            >
              <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Barter Market</Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Author Row */}
          <View style={styles.authorRow}>
            <TouchableOpacity
              style={styles.authorAvatar}
              onPress={() => {
                if (post.authorId && post.authorId !== user?.uid) {
                  navigation.navigate('UserProfile', { userId: post.authorId })
                }
              }}
            >
              {post.authorPhoto ? (
                <Image
                  source={{ uri: post.authorPhoto, cache: 'reload' }}
                  style={styles.avatarImage}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={20} color="#666" />
                </View>
              )}
            </TouchableOpacity>

            {!isAuthor && (
              <TouchableOpacity style={styles.contactButton} onPress={handleContact}>
                <Ionicons name="add" size={14} color={colors.textDark} />
                <Text style={styles.contactButtonText}>Contact</Text>
              </TouchableOpacity>
            )}

            {!editing && (
              <TouchableOpacity
                onPress={handleShare}
                style={styles.shareButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="share-outline" size={20} color={colors.textDark} />
              </TouchableOpacity>
            )}
          </View>

          {/* Content */}
          <View style={styles.contentSection}>
            {editing ? (
              <>
                {/* Actions Row */}
                <View style={styles.editActionRow}>
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: 16,
                      alignItems: 'center',
                      marginLeft: 'auto',
                    }}
                  >
                    <TouchableOpacity
                      onPress={handleDelete}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="trash-outline" size={20} color={colors.offline} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.saveButton, saving && { opacity: 0.5 }]}
                      onPress={handleSaveEdit}
                      disabled={saving}
                    >
                      {saving ? (
                        <ActivityIndicator size="small" color={colors.textDark} />
                      ) : (
                        <Text style={styles.saveButtonText}>Save</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Offering Dropdown */}
                {renderEditDropdown(
                  'Offering:',
                  editOfferingType,
                  offeringDropdownOpen,
                  setOfferingDropdownOpen,
                  setEditOfferingType,
                  setLookingForDropdownOpen
                )}

                {/* Offering Text Input */}
                <TextInput
                  style={styles.editFieldInput}
                  value={editTitle}
                  onChangeText={setEditTitle}
                  placeholder="what are you offering? i.e. logo design"
                  placeholderTextColor={colors.offline}
                />

                {/* Looking For Dropdown */}
                {renderEditDropdown(
                  'Looking for:',
                  editLookingForType,
                  lookingForDropdownOpen,
                  setLookingForDropdownOpen,
                  setEditLookingForType,
                  setOfferingDropdownOpen
                )}

                {/* Looking For Text Input */}
                <TextInput
                  style={styles.editFieldInput}
                  value={editLookingForText}
                  onChangeText={setEditLookingForText}
                  placeholder="what are you looking for? i.e. moving help"
                  placeholderTextColor={colors.offline}
                />

                {/* City */}
                {!editIsGlobal && (
                  <CityAutocomplete
                    value={editCity}
                    onCitySelect={(selectedCity) => setEditCity(selectedCity)}
                    placeholder="Filter by city (required)..."
                  />
                )}

                {/* Global Toggle */}
                <TouchableOpacity
                  style={styles.globalToggleRow}
                  onPress={() => {
                    setEditIsGlobal(!editIsGlobal)
                    if (!editIsGlobal) setEditCity('')
                  }}
                  activeOpacity={0.7}
                >
                  <View
                    style={[styles.globalCheckbox, editIsGlobal && styles.globalCheckboxActive]}
                  >
                    {editIsGlobal && (
                      <Ionicons name="checkmark" size={14} color={colors.textDark} />
                    )}
                  </View>
                  <Ionicons
                    name="globe-outline"
                    size={14}
                    color={colors.textDark}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={styles.globalToggleLabel}>Global / Digital</Text>
                </TouchableOpacity>

                {/* Card — matches create screen card layout */}
                <View style={styles.editCard}>
                  {/* Avatar */}
                  <View style={styles.editCardAvatar}>
                    {post.authorPhoto ? (
                      <Image
                        source={{ uri: post.authorPhoto, cache: 'reload' }}
                        style={styles.avatarImage}
                      />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Ionicons name="person" size={16} color="#666" />
                      </View>
                    )}
                  </View>

                  {/* Tappable Image Upload Area */}
                  <TouchableOpacity style={styles.editImageUpload} onPress={handlePickImage}>
                    {editImageUri ? (
                      <Image source={{ uri: editImageUri }} style={styles.editUploadedImage} />
                    ) : post.imageUrl ? (
                      <View>
                        <Image source={{ uri: post.imageUrl }} style={styles.editUploadedImage} />
                        <View style={styles.editImageOverlay}>
                          <Ionicons name="camera-outline" size={24} color="#ffffff" />
                          <Text style={styles.editImageOverlayText}>tap to change</Text>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.editUploadPlaceholder}>
                        <Ionicons name="image-outline" size={40} color={colors.offline} />
                        <Text style={styles.editUploadText}>upload a photo</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Description */}
                  <TextInput
                    style={styles.editDescriptionInput}
                    value={editDescription}
                    onChangeText={setEditDescription}
                    placeholder="Description of item or service"
                    placeholderTextColor={colors.offline}
                    multiline
                    textAlignVertical="top"
                  />
                </View>
              </>
            ) : (
              <>
                {/* Barter Type Select (read-only) */}
                <Text style={styles.barterTypeLabel}>Barter Type Select</Text>
                {(post.offeringType || post.title) && (
                  <Text style={styles.barterTypeValue}>
                    Offering: {post.offeringType}
                    {post.title ? ` — ${post.title}` : ''}
                  </Text>
                )}
                {(post.lookingForType || post.lookingForText) && (
                  <Text style={styles.barterTypeValue}>
                    Looking for: {post.lookingForType}
                    {post.lookingForText ? ` — ${post.lookingForText}` : ''}
                  </Text>
                )}

                {post.city ? (
                  <View style={styles.cityRow}>
                    <Ionicons
                      name={post.city === 'Global' ? 'globe-outline' : 'location-outline'}
                      size={14}
                      color={colors.offline}
                    />
                    <Text style={styles.cityText}>{post.city}</Text>
                  </View>
                ) : null}

                {post.date && (
                  <Text style={styles.postDate}>
                    {(() => {
                      const d = post.date.toDate ? post.date.toDate() : new Date(post.date)
                      return `${MONTHS_FULL[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
                    })()}
                  </Text>
                )}

                <Text style={styles.postDescription}>{post.description}</Text>

                {post.imageUrl && (
                  <TouchableOpacity activeOpacity={0.8} onPress={() => setImageModalVisible(true)}>
                    <Image source={{ uri: post.imageUrl }} style={styles.postImage} />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

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

      {/* Fullscreen Image Modal */}
      {post?.imageUrl && (
        <Modal
          visible={imageModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setImageModalVisible(false)}
        >
          <SafeAreaView style={styles.imageModalContainer}>
            <TouchableOpacity
              style={styles.imageModalClose}
              onPress={() => setImageModalVisible(false)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={28} color="#ffffff" />
            </TouchableOpacity>
            <Image
              source={{ uri: post.imageUrl }}
              style={styles.imageModalFull}
              resizeMode="contain"
            />
          </SafeAreaView>
        </Modal>
      )}

      {/* Delete Post Confirm Modal */}
      <ConfirmModal
        visible={deletePostConfirm}
        title="Delete Post"
        message="Are you sure you want to delete this post?"
        confirmText="Delete"
        onConfirm={handleConfirmDeletePost}
        onCancel={() => setDeletePostConfirm(false)}
      />
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.offline,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },

  // Author Row
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingTop: 20,
    gap: 12,
  },
  authorAvatar: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    overflow: 'hidden',
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
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  contactButtonText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textDark,
    marginLeft: 4,
  },
  shareButton: {
    marginLeft: 'auto',
    padding: 4,
  },

  // Content
  contentSection: {
    paddingHorizontal: 4,
    paddingTop: 20,
  },
  barterTypeLabel: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textDark,
    marginBottom: 6,
  },
  barterTypeValue: {
    fontSize: 13,
    fontFamily: fonts.italic,
    color: colors.textDark,
    marginBottom: 4,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 4,
  },
  cityText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.offline,
    marginLeft: 4,
  },
  globalToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  globalCheckbox: {
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
  globalCheckboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  globalToggleLabel: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textDark,
  },
  postDate: {
    fontSize: 13,
    fontFamily: fonts.italic,
    color: colors.offline,
    marginTop: 10,
  },
  postDescription: {
    fontSize: 13,
    fontFamily: fonts.mono,
    color: colors.textDark,
    lineHeight: 20,
    marginTop: 12,
  },
  postImage: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    marginTop: 16,
  },

  // Edit Dropdowns
  editDropdownSection: {
    marginBottom: 12,
  },
  editDropdownLabel: {
    fontSize: 13,
    fontFamily: fonts.mono,
    color: colors.textDark,
    marginBottom: 6,
  },
  editDropdownToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  editDropdownValue: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textDark,
  },
  editDropdownPlaceholder: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.offline,
  },
  editDropdownMenu: {
    marginTop: 4,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
  },
  editDropdownOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  editDropdownOptionActive: {
    backgroundColor: colors.secondary,
  },
  editDropdownOptionText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textDark,
  },
  editDropdownOptionTextActive: {
    fontFamily: fonts.bold,
  },

  // Edit Mode
  editActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -30,
    marginBottom: 12,
  },
  editFieldInput: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textDark,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginBottom: 16,
  },
  editCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  editCardAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 16,
  },
  editImageUpload: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderStyle: 'dashed',
    height: 160,
    marginBottom: 16,
    overflow: 'hidden',
  },
  editUploadedImage: {
    width: '100%',
    height: '100%',
  },
  editImageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editImageOverlayText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: '#ffffff',
    marginTop: 4,
  },
  editUploadPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editUploadText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.offline,
    marginTop: 8,
  },
  editDescriptionInput: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textDark,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 8,
    padding: 12,
    minHeight: 60,
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    marginTop: 20,
  },
  saveButtonText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textDark,
  },
  // Fullscreen image modal
  imageModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageModalFull: {
    width: Dimensions.get('window').width - 32,
    height: Dimensions.get('window').height * 0.7,
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

export default BarterMarketPostScreen
