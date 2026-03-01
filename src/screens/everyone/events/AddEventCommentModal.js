// Add Event Comment Modal
// Modal with author avatar, date, "// Comment" label, text input, Publish button
// Replicates the groups AddCommentModal pattern for events

import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../../theme'
import { fonts } from '../../../theme/typography'
import { addEventComment } from '../../../services/everyoneService'

const MAX_COMMENT_WORDS = 100

const AddEventCommentModal = ({
  visible,
  onClose,
  onCommentAdded,
  eventId,
  userProfile,
  userId,
  parentCommentId,
}) => {
  const [commentText, setCommentText] = useState('')
  const [loading, setLoading] = useState(false)

  const commentWordCount = commentText.trim() ? commentText.trim().split(/\s+/).length : 0

  const handleCommentChange = (text) => {
    const words = text.trim().split(/\s+/)
    if (text.trim() === '' || words.length <= MAX_COMMENT_WORDS) {
      setCommentText(text)
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

  const handlePublish = async () => {
    if (!commentText.trim()) {
      Alert.alert('Required', 'Please write a comment.')
      return
    }

    setLoading(true)
    const result = await addEventComment(
      eventId,
      userId,
      commentText.trim(),
      parentCommentId || null
    )
    setLoading(false)

    if (result.success) {
      setCommentText('')
      onCommentAdded()
    } else {
      Alert.alert('Error', 'Could not add comment.')
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalContainer}>
          {/* Close X */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={22} color={colors.textDark} />
          </TouchableOpacity>

          {/* Author + Date */}
          <View style={styles.authorRow}>
            {userProfile?.profilePhoto ? (
              <Image
                source={{ uri: userProfile.profilePhoto, cache: 'reload' }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={18} color="#666" />
              </View>
            )}
            <Text style={styles.dateText}>{formatDate()}</Text>
          </View>

          {/* Label */}
          <Text style={styles.label}>{parentCommentId ? '// Reply' : '// Comment'}</Text>

          {/* Text Input */}
          <TextInput
            style={styles.input}
            value={commentText}
            onChangeText={handleCommentChange}
            placeholder={parentCommentId ? 'Write your reply...' : 'Write your comment...'}
            placeholderTextColor={colors.offline}
            multiline
            textAlignVertical="top"
            autoFocus
          />
          <Text style={styles.wordCount}>
            {commentWordCount}/{MAX_COMMENT_WORDS} words
          </Text>

          {/* Publish Button */}
          <TouchableOpacity
            style={[styles.publishButton, loading && styles.publishDisabled]}
            onPress={handlePublish}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.textDark} />
            ) : (
              <Text style={styles.publishText}>Publish</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 10,
    padding: 4,
  },

  // Author Row
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
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
    marginLeft: 12,
  },

  // Label
  label: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textDark,
    marginBottom: 10,
  },

  // Input
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textDark,
    borderWidth: 1,
    borderColor: colors.borderLight,
    minHeight: 100,
    marginBottom: 4,
  },
  wordCount: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.offline,
    textAlign: 'right',
    marginBottom: 12,
  },

  // Publish
  publishButton: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 28,
    alignSelf: 'center',
    minWidth: 120,
    alignItems: 'center',
  },
  publishDisabled: {
    opacity: 0.6,
  },
  publishText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textDark,
  },
})

export default AddEventCommentModal
