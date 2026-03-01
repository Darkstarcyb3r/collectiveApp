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
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../../theme'
import { fonts } from '../../../theme/typography'
import { useAuth } from '../../../contexts/AuthContext'
import { createMutualAidGroup } from '../../../services/everyoneService'
import CityAutocomplete from '../../../components/common/CityAutocomplete'
import LightTabBar from '../../../components/navigation/LightTabBar'

const MutualAidCreateScreen = ({ route, navigation }) => {
  const { category, _title } = route.params
  const { user, userProfile } = useAuth()
  const [name, setName] = useState('')
  const [caption, setCaption] = useState('')
  const [link, setLink] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [tempLinkLabel, setTempLinkLabel] = useState('')
  const [tempLink, setTempLink] = useState('')
  const [city, setCity] = useState('')
  const [isGlobal, setIsGlobal] = useState(false)
  const [description, setDescription] = useState('')
  const [vetByAuthor, setVetByAuthor] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const lightTabRef = useRef(null)
  const lastScrollY = useRef(0)

  const handlePublish = async () => {
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
    })

    setPublishing(false)
    if (result.success) {
      navigation.goBack()
    } else {
      Alert.alert('Error', 'Could not create group.')
    }
  }

  const handleDelete = () => {
    setName('')
    setCaption('')
    setLink('')
    setLinkLabel('')
    setCity('')
    setIsGlobal(false)
    setDescription('')
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

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          onScroll={handleScroll}
          onScrollBeginDrag={handleScrollBeginDrag}
          scrollEventThrottle={16}
        >
          <View style={styles.mainContainer}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ padding: 4 }}
              >
                <Ionicons name="chevron-back" size={24} color={colors.textDark} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Add a Mutual Aid Group</Text>
              <View style={{ width: 24 }} />
            </View>

            {/* Action Row */}
            <View style={styles.actionRow}>
              <TouchableOpacity onPress={handleDelete}>
                <Ionicons name="trash-outline" size={20} color={colors.offline} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.publishButton, publishing && { opacity: 0.5 }]}
                onPress={handlePublish}
                disabled={publishing}
              >
                <Text style={styles.publishButtonText}>Publish</Text>
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

            <TextInput
              style={styles.input}
              value={caption}
              onChangeText={(text) => {
                setCaption(text)
                if (text.trim()) {
                  setLink('')
                  setLinkLabel('')
                }
              }}
              placeholder="Caption"
              placeholderTextColor={colors.offline}
              maxLength={80}
            />

            {/* Hyperlink option — only visible when no typed caption */}
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
              onPress={() => setVetByAuthor(!vetByAuthor)}
              activeOpacity={0.7}
            >
              <View style={[styles.vetCheckbox, vetByAuthor && styles.vetCheckboxActive]}>
                {vetByAuthor && <Ionicons name="checkmark" size={14} color={colors.textDark} />}
              </View>
              <Text style={styles.vetToggleLabel}>Vet this organization</Text>
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
      </KeyboardAvoidingView>
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
              maxLength={80}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.secondary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
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
  publishButton: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
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
    borderColor: colors.borderLight,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    backgroundColor: '#ffffff',
  },
  descriptionInput: {
    minHeight: 80,
  },

  // Link cell
  linkCell: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    backgroundColor: '#ffffff',
  },
  linkDisplayText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textDark,
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
