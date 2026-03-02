// Mutual Aid Post Screen
// Displays a single mutual aid group: name, link, description
// Author can edit or delete
// Matches Figma: black header bar, group name large, link underlined, description, logo

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
  Linking,
  TextInput,
  ActivityIndicator,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { STICKER_OPTIONS } from '../../../config/stickers'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useFocusEffect } from '@react-navigation/native'
import { colors } from '../../../theme'
import { fonts } from '../../../theme/typography'
import { useAuth } from '../../../contexts/AuthContext'
import {
  getMutualAidGroup,
  updateMutualAidGroup,
  deleteMutualAidGroup,
  getMutualAidComments,
  deleteMutualAidComment,
  toggleMutualAidCommentReaction,
} from '../../../services/everyoneService'
import AddMutualAidCommentModal from './AddMutualAidCommentModal'
import { ConfirmModal } from '../../../components/common'
import CityAutocomplete from '../../../components/common/CityAutocomplete'
import { groupCommentsWithReplies } from '../../../utils/commentUtils'
import { validateImageAsset } from '../../../utils/imageValidation'
import { signedUpload } from '../../../utils/cloudinaryUpload'

const MutualAidPostScreen = ({ route, navigation }) => {
  const { groupId, editMode } = route.params
  const { user, userProfile } = useAuth()
  const [group, setGroup] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(editMode || false)
  const [editName, setEditName] = useState('')
  const [editCaption, setEditCaption] = useState('')
  const [editLink, setEditLink] = useState('')
  const [editLinkLabel, setEditLinkLabel] = useState('')
  const [editCity, setEditCity] = useState('')
  const [editIsGlobal, setEditIsGlobal] = useState(false)
  const [editDescription, setEditDescription] = useState('')
  const [comments, setComments] = useState([])
  const [showCommentModal, setShowCommentModal] = useState(false)
  const [deleteGroupConfirm, setDeleteGroupConfirm] = useState(false)
  const [deleteCommentConfirm, setDeleteCommentConfirm] = useState({
    visible: false,
    commentId: null,
  })
  const [reactionPickerCommentId, setReactionPickerCommentId] = useState(null)
  const [replyTarget, setReplyTarget] = useState(null)
  const [editImageUri, setEditImageUri] = useState(null)
  const [editImageMeta, setEditImageMeta] = useState(null)
  const [imageChanged, setImageChanged] = useState(false)

  const isArtAction = group?.category === 'action_art'

  const handlePickEditImage = async () => {
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
      setEditImageUri(asset.uri)
      setEditImageMeta({ fileSize: validation.fileSize, mimeType: validation.mimeType })
      setImageChanged(true)
    }
  }

  const fetchGroup = async () => {
    const result = await getMutualAidGroup(groupId)
    if (!result.success) {
      setLoading(false)
      Alert.alert('Not Found', 'This group has been deleted.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ])
      return
    }
    setGroup(result.data)
    setEditName(result.data.name || '')
    setEditCaption(result.data.caption || '')
    setEditLink(result.data.link || '')
    setEditLinkLabel(result.data.linkLabel || '')
    setEditCity(result.data.city === 'Global' ? '' : result.data.city || '')
    setEditIsGlobal(result.data.city === 'Global')
    setEditDescription(result.data.description || '')
    setEditImageUri(result.data.imageUrl || null)
    setImageChanged(false)

    const commentsResult = await getMutualAidComments(groupId)
    if (commentsResult.success) {
      setComments(groupCommentsWithReplies(commentsResult.data))
    }

    setLoading(false)
  }

  const formatCommentDate = (timestamp) => {
    if (!timestamp) return ''
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    })
  }

  const handleDeleteComment = (commentId) => {
    setDeleteCommentConfirm({ visible: true, commentId })
  }

  const handleConfirmDeleteComment = async () => {
    const cid = deleteCommentConfirm.commentId
    setDeleteCommentConfirm({ visible: false, commentId: null })
    await deleteMutualAidComment(groupId, cid)
    fetchGroup()
  }

  const handleCommentLongPress = (commentId) => {
    setReactionPickerCommentId((prev) => (prev === commentId ? null : commentId))
  }

  const handleSelectCommentReaction = (emoji) => {
    const cid = reactionPickerCommentId
    setReactionPickerCommentId(null)
    if (cid && user?.uid) {
      setComments((prev) =>
        prev.map((c) => {
          if (c.id !== cid) return c
          const reactions = { ...(c.reactions || {}) }
          const emojiReactions = reactions[emoji] || []
          if (emojiReactions.includes(user.uid)) {
            const updated = emojiReactions.filter((id) => id !== user.uid)
            if (updated.length === 0) delete reactions[emoji]
            else reactions[emoji] = updated
          } else {
            reactions[emoji] = [...emojiReactions, user.uid]
          }
          return { ...c, reactions }
        })
      )
      toggleMutualAidCommentReaction(groupId, cid, user.uid, emoji)
    }
  }

  const handleTapCommentReaction = (commentId, emoji) => {
    if (!user?.uid) return
    setComments((prev) =>
      prev.map((c) => {
        if (c.id !== commentId) return c
        const reactions = { ...(c.reactions || {}) }
        const emojiReactions = reactions[emoji] || []
        if (emojiReactions.includes(user.uid)) {
          const updated = emojiReactions.filter((id) => id !== user.uid)
          if (updated.length === 0) delete reactions[emoji]
          else reactions[emoji] = updated
        } else {
          reactions[emoji] = [...emojiReactions, user.uid]
        }
        return { ...c, reactions }
      })
    )
    toggleMutualAidCommentReaction(groupId, commentId, user.uid, emoji)
  }

  useFocusEffect(
    useCallback(() => {
      fetchGroup()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupId])
  )

  const handleShare = async () => {
    const { shareContent, buildMutualAidLink } = require('../../../utils/shareLinks')
    await shareContent(
      `Check out this mutual aid group: ${group?.name || 'a group'} on Collective!`,
      buildMutualAidLink(groupId)
    )
  }

  const handleOpenLink = () => {
    if (group?.link) {
      const url = group.link.startsWith('http') ? group.link : `https://${group.link}`
      Linking.openURL(url).catch(() => {
        Alert.alert('Error', 'Could not open link.')
      })
    }
  }

  const handleSaveEdit = async () => {
    const savedCity = editIsGlobal ? 'Global' : editCity.trim()

    // Upload new image if changed (Art & Action only)
    let imageUrl = group?.imageUrl || null
    if (isArtAction && imageChanged) {
      if (editImageUri && !editImageUri.startsWith('http')) {
        const uploadResult = await signedUpload(
          editImageUri,
          'collective/mutualaid',
          `mutualaid_${user.uid}`,
          editImageMeta || {}
        )
        if (!uploadResult.success) {
          Alert.alert('Upload Error', uploadResult.error || 'Could not upload image.')
          return
        }
        imageUrl = uploadResult.url
      } else if (!editImageUri) {
        imageUrl = null
      }
    }

    const updates = {
      name: editName.trim(),
      caption: editCaption.trim(),
      link: editLink.trim(),
      linkLabel: editLinkLabel.trim(),
      city: savedCity,
      description: editDescription.trim(),
      ...(isArtAction && { imageUrl }),
    }
    await updateMutualAidGroup(groupId, updates)
    setGroup({ ...group, ...updates })
    setImageChanged(false)
    setEditing(false)
  }

  const handleDelete = () => {
    setDeleteGroupConfirm(true)
  }

  const handleConfirmDeleteGroup = async () => {
    setDeleteGroupConfirm(false)
    await deleteMutualAidGroup(groupId)
    navigation.goBack()
  }

  if (loading || !group) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    )
  }

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
            <Text style={styles.headerTitle}>Mutual Aid Group</Text>
            {!editing ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TouchableOpacity
                  onPress={handleShare}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="share-outline" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setReplyTarget(null)
                    setShowCommentModal(true)
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chatbubble-outline" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ width: 20 }} />
            )}
          </View>

          {/* Content */}
          <View style={styles.contentSection}>
            {editing ? (
              <>
                <TextInput
                  style={styles.editInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Group Name"
                  placeholderTextColor={colors.offline}
                />

                {/* Image Picker — Art & Action edit mode */}
                {isArtAction && (
                  <View style={styles.imageSection}>
                    {editImageUri ? (
                      <View style={styles.imagePreviewContainer}>
                        <Image source={{ uri: editImageUri }} style={styles.imagePreview} />
                        <View style={styles.imageActions}>
                          <TouchableOpacity onPress={handlePickEditImage} style={styles.imageChangeButton}>
                            <Ionicons name="camera-outline" size={16} color={colors.textDark} />
                            <Text style={styles.imageChangeText}>Change</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => { setEditImageUri(null); setEditImageMeta(null); setImageChanged(true) }}
                            style={styles.imageRemoveButton}
                          >
                            <Ionicons name="close-circle-outline" size={16} color={colors.offline} />
                            <Text style={styles.imageRemoveText}>Remove</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity style={styles.imagePicker} onPress={handlePickEditImage}>
                        <Ionicons name="image-outline" size={24} color={colors.offline} />
                        <Text style={styles.imagePickerText}>+ Add photo</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                <TextInput
                  style={styles.editInput}
                  value={editCaption}
                  onChangeText={setEditCaption}
                  placeholder="Caption"
                  placeholderTextColor={colors.offline}
                  maxLength={80}
                />

                {/* Link fields (inline) */}
                <TextInput
                  style={styles.editInput}
                  value={editLinkLabel}
                  onChangeText={setEditLinkLabel}
                  placeholder="Link label (e.g. Sign Up Here)"
                  placeholderTextColor={colors.offline}
                  maxLength={80}
                />
                <TextInput
                  style={styles.editInput}
                  value={editLink}
                  onChangeText={setEditLink}
                  placeholder="Paste URL"
                  placeholderTextColor={colors.offline}
                  autoCapitalize="none"
                  keyboardType="url"
                />
                {!editIsGlobal && (
                  <CityAutocomplete
                    value={editCity}
                    onCitySelect={(selectedCity) => setEditCity(selectedCity)}
                    placeholder="Filter by city (required)..."
                  />
                )}
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
                  <Text style={styles.globalToggleLabel}>Global</Text>
                </TouchableOpacity>
                <TextInput
                  style={[styles.editInput, { minHeight: 80 }]}
                  value={editDescription}
                  onChangeText={setEditDescription}
                  placeholder="Description"
                  placeholderTextColor={colors.offline}
                  multiline
                />
                <View style={styles.editActions}>
                  <TouchableOpacity style={styles.saveButtonOuter} onPress={handleSaveEdit}>
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
                      <Text style={styles.saveButtonText}>Save</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditing(false)}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleDelete}
                    style={{
                      marginLeft: 'auto',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Ionicons name="trash-outline" size={14} color={colors.offline} />
                    <Text style={styles.deleteLink}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.groupName}>{group.name}</Text>

                {group.city ? (
                  <View style={styles.cityRow}>
                    <Ionicons
                      name={group.city === 'Global' ? 'globe-outline' : 'location-outline'}
                      size={14}
                      color={colors.offline}
                    />
                    <Text style={styles.cityText}>{group.city}</Text>
                  </View>
                ) : null}

                {/* Image — Art & Action view mode */}
                {group.imageUrl ? (
                  <Image
                    source={{ uri: group.imageUrl }}
                    style={styles.viewImage}
                    resizeMode="cover"
                  />
                ) : null}

                {group.caption ? (
                  <Text style={styles.groupCaption}>{group.caption}</Text>
                ) : null}
                {group.link ? (
                  <TouchableOpacity onPress={handleOpenLink}>
                    <Text style={styles.groupLink}>{group.linkLabel || group.link}</Text>
                  </TouchableOpacity>
                ) : null}

                <Text style={styles.groupDescription}>{group.description}</Text>
              </>
            )}
          </View>

          {/* Comments Section (view mode only) */}
          {!editing &&
            (() => {
              const hiddenUsers = userProfile?.hiddenUsers || []
              const blockedUsers = userProfile?.blockedUsers || []
              const blockedBy = userProfile?.blockedBy || []
              const excludedUsers = [...new Set([...hiddenUsers, ...blockedUsers, ...blockedBy])]
              const visibleComments = comments.filter((c) => !excludedUsers.includes(c.author?.id))
              return (
                <View style={styles.commentsSection}>
                  <Text style={styles.commentsHeader}>// Comments</Text>

                  {visibleComments.length === 0 ? (
                    <Text style={styles.noComments}>No comments yet. Be the first!</Text>
                  ) : (
                    visibleComments.map((comment) => (
                      <TouchableOpacity
                        key={comment.id}
                        activeOpacity={0.8}
                        onLongPress={() => handleCommentLongPress(comment.id)}
                        delayLongPress={400}
                      >
                        <View
                          style={[styles.commentRow, comment.isReply && styles.replyCommentRow]}
                        >
                          <TouchableOpacity
                            onPress={() => {
                              if (comment.author?.id) {
                                navigation.navigate('UserProfile', { userId: comment.author.id })
                              }
                            }}
                          >
                            {comment.author?.profilePhoto ? (
                              <Image
                                source={{ uri: comment.author.profilePhoto, cache: 'reload' }}
                                style={comment.isReply ? styles.replyAvatar : styles.commentAvatar}
                              />
                            ) : (
                              <View
                                style={
                                  comment.isReply
                                    ? styles.replyAvatarPlaceholder
                                    : styles.commentAvatarPlaceholder
                                }
                              >
                                <Ionicons
                                  name="person"
                                  size={comment.isReply ? 10 : 12}
                                  color="#666"
                                />
                              </View>
                            )}
                          </TouchableOpacity>
                          <View style={styles.commentContent}>
                            <View style={styles.commentMeta}>
                              <Text style={styles.commentAuthor}>
                                {comment.author?.name || 'User'}
                              </Text>
                              <Text style={styles.commentDate}>
                                {formatCommentDate(comment.createdAt)}
                              </Text>
                              {comment.author?.id === user?.uid && (
                                <TouchableOpacity
                                  onPress={() => handleDeleteComment(comment.id)}
                                  style={styles.deleteCommentButton}
                                >
                                  <Ionicons name="trash-outline" size={12} color={colors.offline} />
                                </TouchableOpacity>
                              )}
                            </View>
                            <Text style={styles.commentText}>{comment.content}</Text>

                            {/* Reply link — only on top-level comments */}
                            {!comment.isReply && (
                              <TouchableOpacity
                                onPress={() => {
                                  setReplyTarget({
                                    commentId: comment.id,
                                    authorName: comment.author?.name || 'User',
                                  })
                                  setShowCommentModal(true)
                                }}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Text style={styles.replyLinkText}>Reply</Text>
                              </TouchableOpacity>
                            )}

                            {/* Reaction picker */}
                            {reactionPickerCommentId === comment.id && (
                              <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={styles.commentReactionPickerScroll}
                                contentContainerStyle={styles.commentReactionPicker}
                              >
                                {STICKER_OPTIONS.map((emoji) => (
                                  <TouchableOpacity
                                    key={emoji}
                                    style={styles.commentReactionItem}
                                    onPress={() => handleSelectCommentReaction(emoji)}
                                  >
                                    <Text style={styles.commentReactionEmoji}>{emoji}</Text>
                                  </TouchableOpacity>
                                ))}
                              </ScrollView>
                            )}

                            {/* Reaction badges */}
                            {comment.reactions && Object.keys(comment.reactions).length > 0 && (
                              <View style={styles.commentReactionsRow}>
                                {Object.entries(comment.reactions).map(([emoji, users]) => (
                                  <TouchableOpacity
                                    key={emoji}
                                    style={[
                                      styles.commentReactionBadge,
                                      users.includes(user?.uid) &&
                                        styles.commentReactionBadgeActive,
                                    ]}
                                    onPress={() => handleTapCommentReaction(comment.id, emoji)}
                                  >
                                    <Text style={styles.commentReactionBadgeEmoji}>{emoji}</Text>
                                    <Text style={styles.commentReactionBadgeCount}>
                                      {users.length}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            )}
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )
            })()}

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

      {/* Add Comment Modal */}
      <AddMutualAidCommentModal
        visible={showCommentModal}
        onClose={() => {
          setShowCommentModal(false)
          setReplyTarget(null)
        }}
        onCommentAdded={() => {
          setShowCommentModal(false)
          setReplyTarget(null)
          fetchGroup()
        }}
        groupId={groupId}
        userProfile={userProfile}
        userId={user?.uid}
        parentCommentId={replyTarget?.commentId || null}
      />

      {/* Delete Group Confirm Modal */}
      <ConfirmModal
        visible={deleteGroupConfirm}
        icon="trash-outline"
        title="Delete Group"
        message="Are you sure you want to delete this group?"
        confirmText="Delete"
        onConfirm={handleConfirmDeleteGroup}
        onCancel={() => setDeleteGroupConfirm(false)}
      />

      {/* Delete Comment Confirm Modal */}
      <ConfirmModal
        visible={deleteCommentConfirm.visible}
        title="Delete Comment"
        message="Are you sure you want to delete this comment?"
        confirmText="Delete"
        onConfirm={handleConfirmDeleteComment}
        onCancel={() => setDeleteCommentConfirm({ visible: false, commentId: null })}
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

  // Content
  contentSection: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    marginTop: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  groupName: {
    fontSize: 22,
    fontFamily: fonts.bold,
    color: colors.textDark,
    marginBottom: 12,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
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
  groupCaption: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textDark,
    marginBottom: 20,
  },
  groupLink: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textDark,
    textDecorationLine: 'underline',
    marginBottom: 20,
  },
  groupDescription: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textDark,
    lineHeight: 20,
  },

  // Image (Art & Action)
  viewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 16,
  },
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

  // Delete (in edit mode)
  deleteLink: {
    fontSize: 12,
    fontFamily: fonts.italic,
    color: colors.offline,
    textDecorationLine: 'underline',
  },

  // Edit Mode
  editInput: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textDark,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  editActions: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonOuter: {
    borderRadius: 16,
    shadowColor: '#23ff0d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  saveButton: {
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
  saveButtonHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  saveButtonText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.textDark,
  },
  cancelText: {
    fontSize: 12,
    fontFamily: fonts.italic,
    color: colors.offline,
  },

  // Comments Section
  commentsSection: {
    marginTop: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  commentsHeader: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.textDark,
    marginBottom: 14,
  },
  noComments: {
    fontSize: 13,
    fontFamily: fonts.italic,
    color: colors.offline,
    marginBottom: 16,
  },
  commentRow: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  commentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  commentAvatarPlaceholder: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#a3a3a3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentContent: {
    flex: 1,
    marginLeft: 10,
  },
  commentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  commentAuthor: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.textDark,
    marginRight: 10,
  },
  commentDate: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.offline,
  },
  deleteCommentButton: {
    marginLeft: 'auto',
    padding: 4,
  },
  commentText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textDark,
    lineHeight: 20,
  },

  // Reply styles
  replyCommentRow: {
    marginLeft: 40,
  },
  replyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  replyAvatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#a3a3a3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyLinkText: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.offline,
    marginTop: 4,
  },

  // Comment Reaction Picker
  commentReactionPickerScroll: {
    marginTop: 6,
    marginBottom: 4,
    backgroundColor: '#000000',
    borderRadius: 20,
    maxWidth: '85%',
  },
  commentReactionPicker: {
    flexDirection: 'row',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  commentReactionItem: {
    paddingHorizontal: 5,
    paddingVertical: 4,
  },
  commentReactionEmoji: {
    fontSize: 20,
  },

  // Comment Reaction Badges
  commentReactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 4,
  },
  commentReactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  commentReactionBadgeActive: {
    backgroundColor: 'rgba(34, 255, 10, 0.15)',
    borderColor: colors.primary,
  },
  commentReactionBadgeEmoji: {
    fontSize: 14,
  },
  commentReactionBadgeCount: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.textDark,
    marginLeft: 3,
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

export default MutualAidPostScreen
