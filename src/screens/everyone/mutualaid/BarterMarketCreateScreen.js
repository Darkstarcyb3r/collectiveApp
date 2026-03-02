// Barter Market Create Screen
// Create a new barter post with offering type, looking-for type, title, photo, description

import React, { useState, useRef } from 'react'
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
  Modal,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import * as ImagePicker from 'expo-image-picker'
import { colors } from '../../../theme'
import { fonts } from '../../../theme/typography'
import { useAuth } from '../../../contexts/AuthContext'
import { createBarterPost } from '../../../services/everyoneService'
import { signedUpload } from '../../../utils/cloudinaryUpload'
import { validateImageAsset } from '../../../utils/imageValidation'
import CityAutocomplete from '../../../components/common/CityAutocomplete'
import LightTabBar from '../../../components/navigation/LightTabBar'

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
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const BarterMarketCreateScreen = ({ navigation }) => {
  const { user, userProfile } = useAuth()
  const [title, setTitle] = useState('')
  const [city, setCity] = useState('')
  const [isGlobal, setIsGlobal] = useState(false)
  const [lookingForText, setLookingForText] = useState('')
  const [description, setDescription] = useState('')
  const [imageUri, setImageUri] = useState(null)
  const [imageMeta, setImageMeta] = useState(null)
  const [publishing, setPublishing] = useState(false)
  const [offeringType, setOfferingType] = useState('')
  const [lookingForType, setLookingForType] = useState('')
  const [offeringDropdownOpen, setOfferingDropdownOpen] = useState(false)
  const [lookingForDropdownOpen, setLookingForDropdownOpen] = useState(false)
  // Calendar date state
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedDay, setSelectedDay] = useState(new Date().getDate())
  const [showCalendar, setShowCalendar] = useState(false)
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calDay, setCalDay] = useState(new Date().getDate())
  const lightTabRef = useRef(null)
  const lastScrollY = useRef(0)

  // Calendar helpers
  const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate()
  const getFirstDayOfMonth = (month, year) => new Date(year, month, 1).getDay()

  const openCalendar = () => {
    setCalMonth(selectedMonth)
    setCalYear(selectedYear)
    setCalDay(selectedDay)
    setShowCalendar(true)
  }

  const cycleCalMonth = (direction) => {
    let newMonth = calMonth + direction
    let newYear = calYear
    if (newMonth > 11) {
      newMonth = 0
      newYear++
    }
    if (newMonth < 0) {
      newMonth = 11
      newYear--
    }
    setCalMonth(newMonth)
    setCalYear(newYear)
    const daysInNew = getDaysInMonth(newMonth, newYear)
    if (calDay > daysInNew) setCalDay(daysInNew)
  }

  const applyCalendar = () => {
    setSelectedMonth(calMonth)
    setSelectedYear(calYear)
    setSelectedDay(calDay)
    setShowCalendar(false)
  }

  const getFormattedDate = () => {
    return `${MONTHS_FULL[selectedMonth]} ${selectedDay}, ${selectedYear}`
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
      setImageUri(asset.uri)
      setImageMeta({ fileSize: validation.fileSize, mimeType: validation.mimeType })
    }
  }

  const handlePublish = async () => {
    if (!title.trim()) {
      Alert.alert('Title Required', 'Please enter a post title.')
      return
    }
    if (!offeringType) {
      Alert.alert('Selection Required', 'Please select what you are offering.')
      return
    }
    if (!lookingForType) {
      Alert.alert('Selection Required', 'Please select what you are looking for.')
      return
    }
    if (!isGlobal && !city.trim()) {
      Alert.alert('City Required', 'Please select a city or mark as Global.')
      return
    }

    // Enforce 60-day max date restriction
    const postDate = new Date(selectedYear, selectedMonth, selectedDay)
    const maxDate = new Date()
    maxDate.setDate(maxDate.getDate() + 60)
    if (postDate > maxDate) {
      Alert.alert('Date Too Far', 'Post date must be within 60 days of today.')
      return
    }

    if (!user?.uid) return

    setPublishing(true)

    let imageUrl = null
    if (imageUri) {
      const uploadResult = await signedUpload(
        imageUri,
        'collective/barter',
        'barter',
        imageMeta || {}
      )
      if (!uploadResult.success) {
        Alert.alert('Upload Error', uploadResult.error || 'Could not upload image.')
        setPublishing(false)
        return
      }
      imageUrl = uploadResult.url
    }

    const result = await createBarterPost({
      title: title.trim(),
      lookingForText: lookingForText.trim(),
      description: description.trim(),
      city: isGlobal ? 'Global' : city.trim(),
      imageUrl,
      offeringType,
      lookingForType,
      date: postDate,
      authorId: user.uid,
      authorName: userProfile?.name || '',
      authorPhoto: userProfile?.profilePhoto || null,
    })

    setPublishing(false)
    if (result.success) {
      navigation.goBack()
    } else {
      Alert.alert('Error', 'Could not create post.')
    }
  }

  const renderDropdown = (label, value, isOpen, setIsOpen, setValue, otherClose) => (
    <View style={styles.dropdownSection}>
      <Text style={styles.dropdownLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.dropdownToggle}
        onPress={() => {
          setIsOpen(!isOpen)
          otherClose(false)
        }}
      >
        <Text style={value ? styles.dropdownValue : styles.dropdownPlaceholder}>
          {value || 'Select type'}
        </Text>
        <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textDark} />
      </TouchableOpacity>
      {isOpen && (
        <View style={styles.dropdownMenu}>
          {BARTER_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.dropdownOption, value === type && styles.dropdownOptionActive]}
              onPress={() => {
                setValue(type)
                setIsOpen(false)
              }}
            >
              <Text
                style={[
                  styles.dropdownOptionText,
                  value === type && styles.dropdownOptionTextActive,
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
      <StatusBar barStyle="dark-content" backgroundColor={colors.secondary} />

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
                <Ionicons name="chevron-back" size={24} color="#ffffff" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Create Service or Item</Text>
              <View style={{ width: 24 }} />
            </View>

            {/* Action Row */}
            <View style={styles.actionRow}>
              <View style={{ width: 20 }} />
              <TouchableOpacity
                style={[styles.publishButtonOuter, publishing && { opacity: 0.5 }]}
                onPress={handlePublish}
                disabled={publishing}
              >
                <LinearGradient colors={['#cafb6c', '#71f200', '#23ff0d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.publishButton}>
                  <LinearGradient colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']} style={styles.publishButtonHighlight} />
                  <Text style={styles.publishButtonText}>Publish</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Offering Dropdown */}
            {renderDropdown(
              'Offering:',
              offeringType,
              offeringDropdownOpen,
              setOfferingDropdownOpen,
              setOfferingType,
              setLookingForDropdownOpen
            )}

            {/* Offering Input */}
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="what are you offering? i.e. logo design"
              placeholderTextColor={colors.offline}
            />

            {/* Looking For Dropdown */}
            {renderDropdown(
              'Looking for:',
              lookingForType,
              lookingForDropdownOpen,
              setLookingForDropdownOpen,
              setLookingForType,
              setOfferingDropdownOpen
            )}

            {/* Looking For Input */}
            <TextInput
              style={styles.input}
              value={lookingForText}
              onChangeText={setLookingForText}
              placeholder="what are you looking for? i.e. moving help"
              placeholderTextColor={colors.offline}
            />

            {/* Date — press to open calendar */}
            <TouchableOpacity style={styles.dateRow} onPress={openCalendar}>
              <Ionicons
                name="calendar-outline"
                size={18}
                color={colors.textDark}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.dateText}>{getFormattedDate()}</Text>
              <Ionicons
                name="chevron-down"
                size={16}
                color={colors.offline}
                style={{ marginLeft: 6 }}
              />
            </TouchableOpacity>

            {/* Card */}
            <View style={styles.card}>
              {/* Avatar */}
              <View style={styles.cardAvatar}>
                {userProfile?.profilePhoto ? (
                  <Image
                    source={{ uri: userProfile.profilePhoto, cache: 'reload' }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={16} color="#666" />
                  </View>
                )}
              </View>

              {/* Image Upload */}
              <TouchableOpacity style={styles.imageUpload} onPress={handlePickImage}>
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.uploadedImage} />
                ) : (
                  <View style={styles.uploadPlaceholder}>
                    <Ionicons name="image-outline" size={40} color={colors.offline} />
                    <Text style={styles.uploadText}>upload a photo</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Description */}
              <TextInput
                style={styles.descriptionInput}
                value={description}
                onChangeText={setDescription}
                placeholder="Description of item or service"
                placeholderTextColor={colors.offline}
                multiline
                textAlignVertical="top"
              />
            </View>

            {/* City */}
            <View style={{ marginTop: 20 }}>
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
                <View style={[styles.globalCheckbox, isGlobal && styles.globalCheckboxActive]}>
                  {isGlobal && <Ionicons name="checkmark" size={14} color={colors.textDark} />}
                </View>
                <Ionicons
                  name="globe-outline"
                  size={14}
                  color={colors.textDark}
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.globalToggleLabel}>Global / Digital</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ==================== CALENDAR MODAL ==================== */}
      <Modal
        visible={showCalendar}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCalendar(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.calendarContainer}>
            {/* Month/Year Header */}
            <View style={styles.calMonthRow}>
              <TouchableOpacity onPress={() => cycleCalMonth(-1)}>
                <Ionicons name="chevron-back" size={22} color={colors.textDark} />
              </TouchableOpacity>
              <Text style={styles.calMonthText}>
                {MONTHS_FULL[calMonth]} {calYear}
              </Text>
              <TouchableOpacity onPress={() => cycleCalMonth(1)}>
                <Ionicons name="chevron-forward" size={22} color={colors.textDark} />
              </TouchableOpacity>
            </View>

            {/* Day Labels */}
            <View style={styles.calDayLabelsRow}>
              {DAY_LABELS.map((d) => (
                <Text key={d} style={styles.calDayLabel}>
                  {d}
                </Text>
              ))}
            </View>

            {/* Day Grid */}
            <View style={styles.calGrid}>
              {Array.from({ length: getFirstDayOfMonth(calMonth, calYear) }).map((_, i) => (
                <View key={`empty-${i}`} style={styles.calDayCell} />
              ))}
              {Array.from({ length: getDaysInMonth(calMonth, calYear) }).map((_, i) => {
                const day = i + 1
                const isSelected = day === calDay
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.calDayCell, isSelected && styles.calDayCellSelected]}
                    onPress={() => setCalDay(day)}
                  >
                    <Text style={[styles.calDayText, isSelected && styles.calDayTextSelected]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            {/* Actions */}
            <View style={styles.calActions}>
              <TouchableOpacity
                style={styles.calCancelButton}
                onPress={() => setShowCalendar(false)}
              >
                <Text style={styles.calCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.calApplyButtonOuter} onPress={applyCalendar}>
                <LinearGradient colors={['#cafb6c', '#71f200', '#23ff0d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.calApplyButton}>
                  <LinearGradient colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']} style={styles.calApplyButtonHighlight} />
                  <Text style={styles.calApplyText}>Apply</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.textDark,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
    gap: 12,
  },
  publishButtonOuter: {
    borderRadius: 20,
    shadowColor: '#23ff0d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    marginTop: 20,
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

  // Dropdowns
  dropdownSection: {
    marginBottom: 4,
  },
  dropdownLabel: {
    fontSize: 13,
    fontFamily: fonts.mono,
    color: colors.textDark,
    marginBottom: 6,
  },
  dropdownToggle: {
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
  dropdownValue: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textDark,
  },
  dropdownPlaceholder: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.offline,
  },
  dropdownMenu: {
    marginTop: 4,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    marginBottom: 4,
  },
  dropdownOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  dropdownOptionActive: {
    backgroundColor: colors.secondary,
  },
  dropdownOptionText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textDark,
  },
  dropdownOptionTextActive: {
    fontFamily: fonts.bold,
  },

  // Global Toggle
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

  // Date Row
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  dateText: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.textDark,
  },

  input: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textDark,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  cardAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 16,
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
  imageUpload: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderStyle: 'dashed',
    height: 160,
    marginBottom: 16,
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
    fontFamily: fonts.regular,
    color: colors.offline,
    marginTop: 8,
  },
  descriptionInput: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textDark,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 8,
    padding: 12,
    minHeight: 60,
  },

  // Calendar Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarContainer: {
    width: '88%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
  },
  calMonthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  calMonthText: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.textDark,
  },
  calDayLabelsRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calDayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.offline,
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calDayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calDayCellSelected: {
    backgroundColor: colors.primary,
    borderRadius: 100,
  },
  calDayText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textDark,
  },
  calDayTextSelected: {
    fontFamily: fonts.bold,
    color: colors.textDark,
  },
  calActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  calCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  calCancelText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.textDark,
  },
  calApplyButtonOuter: {
    borderRadius: 16,
    shadowColor: '#23ff0d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  calApplyButton: {
    paddingVertical: 10,
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
  calApplyButtonHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  calApplyText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.textDark,
  },
})

export default BarterMarketCreateScreen
