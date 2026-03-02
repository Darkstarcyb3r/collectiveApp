// Create Post Screen — matches Figma post creation
// Group name as title, author avatar + date, title input, image upload, content input, Publish

import React, { useState, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import * as ImagePicker from 'expo-image-picker'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { colors } from '../../theme'
import { fonts } from '../../theme/typography'
import { useAuth } from '../../contexts/AuthContext'
import { createPost } from '../../services/groupService'
import { validateImageAsset } from '../../utils/imageValidation'
import { ConfirmModal } from '../../components/common'
import LightTabBar from '../../components/navigation/LightTabBar'

const MAX_CONTENT_WORDS = 500

const CreatePostScreen = ({ navigation, route }) => {
  const { groupId, groupName } = route.params
  const { user, userProfile } = useAuth()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [imageUri, setImageUri] = useState(null)
  const [imageMeta, setImageMeta] = useState(null)
  const [loading, setLoading] = useState(false)
  const [discardConfirm, setDiscardConfirm] = useState(false)
  const lightTabRef = useRef(null)
  const lastScrollY = useRef(0)

  const contentWordCount = content.trim() ? content.trim().split(/\s+/).length : 0

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

  const handleContentChange = (text) => {
    const words = text.trim().split(/\s+/)
    if (text.trim() === '' || words.length <= MAX_CONTENT_WORDS) {
      setContent(text)
    }
  }

  const pickImage = async () => {
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
      setImageUri(asset.uri)
      setImageMeta({ fileSize: validation.fileSize, mimeType: validation.mimeType })
    }
  }

  const handlePublish = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a title for your post.')
      return
    }

    setLoading(true)
    const result = await createPost(groupId, user.uid, {
      title: title.trim(),
      content: content.trim(),
      imageUri: imageUri,
      imageMeta: imageMeta || {},
    })
    setLoading(false)

    if (result.success) {
      // Mark group as visited so our own post doesn't trigger the activity dot
      try {
        const key = `groupLastVisited_${user.uid}`
        const stored = await AsyncStorage.getItem(key)
        const parsed = stored ? JSON.parse(stored) : {}
        parsed[groupId] = Date.now()
        await AsyncStorage.setItem(key, JSON.stringify(parsed))
      } catch (_e) { /* silently fail */ }
      navigation.goBack()
    } else {
      Alert.alert('Error', result.error || 'Could not create post.')
    }
  }

  const formatDate = () => {
    const date = new Date()
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    })
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.backgroundLight} />

      <View style={styles.mainContainer}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onScroll={handleScroll}
            onScrollBeginDrag={handleScrollBeginDrag}
            scrollEventThrottle={16}
          >
            {/* Header: back + group name */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ padding: 4 }}
              >
                <Ionicons name="chevron-back" size={28} color={colors.textDark} />
              </TouchableOpacity>
              <Text style={styles.groupName}>{groupName}</Text>
              <View style={{ width: 24 }} />
            </View>

            {/* Post Card */}
            <View style={styles.postCard}>
              {/* Author and Date */}
              <View style={styles.authorRow}>
                <TouchableOpacity
                  onPress={() => {
                    if (user?.uid) {
                      navigation.navigate('UserProfile', { userId: user.uid })
                    }
                  }}
                >
                  {userProfile?.profilePhoto ? (
                    <Image
                      source={{ uri: userProfile.profilePhoto, cache: 'reload' }}
                      style={styles.authorAvatar}
                    />
                  ) : (
                    <View style={styles.authorAvatarPlaceholder}>
                      <Ionicons name="person" size={18} color="#666" />
                    </View>
                  )}
                </TouchableOpacity>
                <Text style={styles.dateText}>{formatDate()}</Text>
              </View>

              {/* Title Input */}
              <TextInput
                style={styles.titleInput}
                value={title}
                onChangeText={setTitle}
                placeholder="Title"
                placeholderTextColor={colors.offline}
                maxLength={26}
              />

              {/* Image Upload */}
              <TouchableOpacity style={styles.imageUpload} onPress={pickImage}>
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.uploadedImage} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Ionicons name="image-outline" size={36} color={colors.offline} />
                    <Text style={styles.uploadText}>upload a photo</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Content Input */}
              <TextInput
                style={styles.contentInput}
                value={content}
                onChangeText={handleContentChange}
                placeholder="Write your post here. It's great to keep it in the group theme."
                placeholderTextColor={colors.offline}
                multiline
                textAlignVertical="top"
              />
            </View>
            <Text style={styles.wordCount}>
              {contentWordCount}/{MAX_CONTENT_WORDS} words
            </Text>

            {/* Action Row: Publish */}
            <View style={styles.actionRow}>
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
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Discard Post Confirm Modal */}
        <ConfirmModal
          visible={discardConfirm}
          icon="trash-outline"
          title="Discard Post"
          message="Are you sure you want to discard this post?"
          confirmText="Discard"
          onConfirm={() => {
            setDiscardConfirm(false)
            navigation.goBack()
          }}
          onCancel={() => setDiscardConfirm(false)}
        />
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 60,
    flexGrow: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  groupName: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.textDark,
  },

  // Post Card
  postCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 20,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  authorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  authorAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#a3a3a3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.offline,
  },

  // Inputs
  titleInput: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.textDark,
    marginBottom: 14,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  imageUpload: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 14,
    backgroundColor: colors.inputBackground,
  },
  imagePlaceholder: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderStyle: 'dashed',
    borderRadius: 12,
  },
  uploadText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.offline,
    marginTop: 6,
  },
  uploadedImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  contentInput: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textDark,
    minHeight: 100,
    lineHeight: 22,
  },
  wordCount: {
    fontSize: 12,
    fontFamily: fonts.mono,
    color: colors.offline,
    textAlign: 'right',
    marginTop: 8,
    marginBottom: 12,
  },

  // Action Row
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 16,
  },
  publishButtonOuter: {
    borderRadius: 24,
    shadowColor: '#23ff0d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  publishButton: {
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 28,
    minWidth: 120,
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
})

export default CreatePostScreen
