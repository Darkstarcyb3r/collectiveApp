// Confluence Edit Post Screen
// Edit caption and link for an existing confluence post
// Mirrors AddPost layout but for editing (no image upload)

import React, { useState } from 'react'
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
import { LinearGradient } from 'expo-linear-gradient'
import { colors } from '../../../theme'
import { fonts } from '../../../theme/typography'
import { updateConfluencePost } from '../../../services/everyoneService'
import DarkTabBar from '../../../components/navigation/DarkTabBar'
import { playClick } from '../../../services/soundService'

const ConfluenceEditPostScreen = ({ navigation, route }) => {
  const { postId, caption: initialCaption, link: initialLink, linkLabel: initialLinkLabel, imageUrl } = route.params

  const [caption, setCaption] = useState(initialCaption)
  const [link, setLink] = useState(initialLink)
  const [linkLabel, setLinkLabel] = useState(initialLinkLabel)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [tempLinkLabel, setTempLinkLabel] = useState('')
  const [tempLink, setTempLink] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    playClick()
    if (combinedLength > SHARED_CHAR_LIMIT) {
      Alert.alert(
        'Character Limit Exceeded',
        `Caption and link label combined cannot exceed ${SHARED_CHAR_LIMIT} characters. Use the link label field for URLs instead of the caption.`
      )
      return
    }

    setSaving(true)
    try {
      const result = await updateConfluencePost(postId, {
        caption: caption.trim(),
        link: link.trim(),
        linkLabel: linkLabel.trim(),
      })
      if (result.success) {
        navigation.goBack()
      } else {
        Alert.alert('Error', result.error || 'Could not update post.')
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Could not update post.')
    }
    setSaving(false)
  }

  const SHARED_CHAR_LIMIT = 75
  const combinedLength = caption.length + linkLabel.length
  const captionRemaining = SHARED_CHAR_LIMIT - linkLabel.length

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
              style={[styles.saveButtonOuter, saving && { opacity: 0.4 }]}
              onPress={handleSave}
              disabled={saving}
            >
              <LinearGradient colors={['#cafb6c', '#71f200', '#23ff0d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.saveButton}>
                <LinearGradient colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']} style={styles.saveButtonHighlight} />
                <Text style={styles.saveButtonText}>Save</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Title */}
          <Text style={styles.title}>Edit Post</Text>

          {/* Existing Image (read-only) */}
          {imageUrl ? (
            <View style={styles.imageContainer}>
              <Image source={{ uri: imageUrl }} style={styles.existingImage} resizeMode="cover" />
            </View>
          ) : null}

          {/* Caption */}
          <View style={styles.captionRow}>
            <Text style={styles.captionLabel}>caption:</Text>
            <TextInput
              style={styles.captionInput}
              value={caption}
              onChangeText={setCaption}
              placeholder="// caption goes here"
              placeholderTextColor={colors.offline}
              maxLength={Math.max(caption.length, captionRemaining)}
              numberOfLines={1}
              multiline={false}
            />
            <Text style={[styles.captionCount, combinedLength > SHARED_CHAR_LIMIT && { color: '#ff6b6b' }]}>{combinedLength}/{SHARED_CHAR_LIMIT}</Text>
          </View>

          {/* Hyperlink option */}
          <TouchableOpacity
            style={styles.linkCell}
            onPress={() => {
              playClick()
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

          {/* Hint */}
          <Text style={styles.linkHint}>Use a short label for links — the full URL is saved separately</Text>

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
            <Text style={styles.linkModalTitle}>Edit Link</Text>
            <TextInput
              style={styles.linkModalInput}
              value={tempLinkLabel}
              onChangeText={setTempLinkLabel}
              placeholder="Label (e.g. Sign Up Here)"
              placeholderTextColor={colors.offline}
              maxLength={Math.max(tempLinkLabel.length, SHARED_CHAR_LIMIT - caption.length)}
            />
            <Text style={[styles.modalCharCount, (caption.length + tempLinkLabel.length) > SHARED_CHAR_LIMIT && { color: '#ff6b6b' }]}>{caption.length + tempLinkLabel.length}/{SHARED_CHAR_LIMIT}</Text>
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
                    playClick()
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
                style={styles.linkModalSaveButtonOuter}
                onPress={() => {
                  playClick()
                  setLink(tempLink.trim())
                  setLinkLabel(tempLinkLabel.trim())
                  setShowLinkModal(false)
                }}
              >
                <LinearGradient colors={['#cafb6c', '#71f200', '#23ff0d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.linkModalSaveButton}>
                  <LinearGradient colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']} style={styles.linkModalSaveButtonHighlight} />
                  <Text style={styles.linkModalSaveText}>Save</Text>
                </LinearGradient>
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
  saveButtonOuter: {
    borderRadius: 16,
    shadowColor: '#23ff0d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
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
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.textDark,
  },

  // Title
  title: {
    fontSize: 20,
    fontFamily: fonts.regular,
    color: colors.textGreen,
    marginBottom: 24,
    textAlign: 'center',
  },

  // Image (read-only)
  imageContainer: {
    borderRadius: 16,
    backgroundColor: colors.backgroundCard,
    height: 180,
    marginBottom: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  existingImage: {
    width: '100%',
    height: '100%',
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
    paddingVertical: 6,
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
  linkHint: {
    fontSize: 11,
    fontFamily: fonts.mono,
    color: colors.offline,
    marginBottom: 12,
    marginTop: -10,
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
  modalCharCount: {
    textAlign: 'right',
    fontSize: 11,
    fontFamily: fonts.mono,
    color: colors.offline,
    marginTop: -8,
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
  linkModalSaveButtonOuter: {
    borderRadius: 16,
    shadowColor: '#23ff0d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  linkModalSaveButton: {
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
  linkModalSaveButtonHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  linkModalSaveText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.textDark,
  },

  // Logo
  logoContainer: {
    alignItems: 'flex-end',
    marginTop: 10,
  },
  logoImage: {
    width: 200,
    height: 200,
  },
})

export default ConfluenceEditPostScreen
