// Event Create Screen
// User creates an event with location (Apple Maps link), time (24h dropdown),
// date (calendar modal), photo, title, description
// Uploads photos to Cloudinary

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
  FlatList,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import * as ImagePicker from 'expo-image-picker'
import { colors } from '../../../theme'
import { fonts } from '../../../theme/typography'
import { useAuth } from '../../../contexts/AuthContext'
import { createEvent } from '../../../services/everyoneService'
import { signedUpload } from '../../../utils/cloudinaryUpload'
import { validateImageAsset } from '../../../utils/imageValidation'
import LightTabBar from '../../../components/navigation/LightTabBar'
import CityAutocomplete from '../../../components/common/CityAutocomplete'

const MAX_DESCRIPTION_WORDS = 100
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

// Generate 12h AM/PM time options in 30-min increments
const TIME_OPTIONS = []
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 30) {
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour12 = h % 12 || 12
    const mm = m.toString().padStart(2, '0')
    TIME_OPTIONS.push(`${hour12}:${mm} ${ampm}`)
  }
}

const EVENT_THUMBNAILS = [
  { id: 'thumb1', label: 'Galaxy', source: require('../../../assets/event-thumbnails/Galaxy.png') },
  { id: 'thumb2', label: 'Green', source: require('../../../assets/event-thumbnails/Green.png') },
  {
    id: 'thumb3',
    label: 'Lavendar',
    source: require('../../../assets/event-thumbnails/Lavendar.png'),
  },
  { id: 'thumb4', label: 'Orange', source: require('../../../assets/event-thumbnails/Orange.png') },
  { id: 'thumb5', label: 'Red', source: require('../../../assets/event-thumbnails/Red.png') },
]

const EventCreateScreen = ({ navigation }) => {
  const { user, userProfile } = useAuth()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const descriptionWordCount = description.trim() ? description.trim().split(/\s+/).length : 0
  const handleDescriptionChange = (text) => {
    const words = text.trim().split(/\s+/)
    if (text.trim() === '' || words.length <= MAX_DESCRIPTION_WORDS) {
      setDescription(text)
    }
  }
  const [location, setLocation] = useState('')
  const [link, setLink] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [tempLinkLabel, setTempLinkLabel] = useState('')
  const [tempLink, setTempLink] = useState('')
  const [time, setTime] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedDay, setSelectedDay] = useState(new Date().getDate())
  const [imageUri, setImageUri] = useState(null)
  const [imageMeta, setImageMeta] = useState(null)
  const [selectedPlaceholder, setSelectedPlaceholder] = useState(null)
  const [placeholderPickerOpen, setPlaceholderPickerOpen] = useState(false)
  const [city, setCity] = useState('')
  const [isGlobal, setIsGlobal] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const lightTabRef = useRef(null)
  const lastScrollY = useRef(0)

  // Calendar helpers
  const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate()
  const getFirstDayOfMonth = (month, year) => new Date(year, month, 1).getDay()

  const todayDate = new Date()
  todayDate.setHours(0, 0, 0, 0)
  const maxDate = new Date(todayDate)
  maxDate.setDate(maxDate.getDate() + 42) // 6 weeks

  const canGoBack = calMonth !== todayDate.getMonth() || calYear !== todayDate.getFullYear()
  const canGoForward = calMonth !== maxDate.getMonth() || calYear !== maxDate.getFullYear()

  const isDayInRange = (day) => {
    const d = new Date(calYear, calMonth, day)
    d.setHours(0, 0, 0, 0)
    return d >= todayDate && d <= maxDate
  }

  const cycleCalMonth = (direction) => {
    if (direction === -1 && !canGoBack) return
    if (direction === 1 && !canGoForward) return
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
  }

  const handleSelectDay = (day) => {
    if (!isDayInRange(day)) return
    setSelectedMonth(calMonth)
    setSelectedYear(calYear)
    setSelectedDay(day)
  }

  const handleResetDate = () => {
    const now = new Date()
    setSelectedMonth(now.getMonth())
    setSelectedYear(now.getFullYear())
    setSelectedDay(now.getDate())
    setCalMonth(now.getMonth())
    setCalYear(now.getFullYear())
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
      setSelectedPlaceholder(null)
      setPlaceholderPickerOpen(false)
    }
  }

  const handlePublish = async () => {
    if (!title.trim()) {
      Alert.alert('Title Required', 'Please enter an event title.')
      return
    }

    if (!isGlobal && !city.trim()) {
      Alert.alert('City Required', 'Please select a city or mark as Global / Digital.')
      return
    }

    // Enforce 6-week max date restriction
    const eventDate = new Date(selectedYear, selectedMonth, selectedDay)
    const maxDate = new Date()
    maxDate.setDate(maxDate.getDate() + 42) // 6 weeks
    if (eventDate > maxDate) {
      Alert.alert('Date Too Far', 'Event date must be within 6 weeks of today.')
      return
    }

    if (!user?.uid) return

    setPublishing(true)

    let imageUrl = null
    if (imageUri) {
      const uploadResult = await signedUpload(
        imageUri,
        'collective/events',
        'event',
        imageMeta || {}
      )
      if (!uploadResult.success) {
        Alert.alert('Upload Error', uploadResult.error || 'Could not upload image.')
        setPublishing(false)
        return
      }
      imageUrl = uploadResult.url
    } else if (selectedPlaceholder) {
      imageUrl = `placeholder:${selectedPlaceholder}`
    }

    // Extract zip from location
    const zipMatch = location.match(/\b(\d{5})\b/)
    const zipCode = zipMatch ? zipMatch[1] : ''

    const result = await createEvent({
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      link: link.trim(),
      linkLabel: linkLabel.trim(),
      time: time.trim(),
      date: eventDate,
      zipCode,
      imageUrl,
      city: isGlobal ? 'Global' : city.trim(),
      authorId: user.uid,
      authorName: userProfile?.name || '',
      authorPhoto: userProfile?.profilePhoto || null,
    })

    setPublishing(false)

    if (result.success) {
      navigation.navigate('EventsLanding', { updatedMonthlyCount: result.newCount })
    } else if (result.error === 'max_monthly_events') {
      Alert.alert('Monthly Limit Reached', result.message)
    } else {
      Alert.alert('Error', 'Could not create event.')
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
            {/* Header — simple row, no banner */}
            <View style={styles.headerRow}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ padding: 4 }}
              >
                <Ionicons name="chevron-back" size={24} color={colors.textDark} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Create Event</Text>
            </View>

            {/* Publish Row */}
            <View style={styles.publishRow}>
              <Text style={styles.publishNotice}>
                event must be within 6 weeks of today. events are removed after the event date
                passes.
              </Text>
              <TouchableOpacity
                style={[styles.publishButton, publishing && { opacity: 0.5 }]}
                onPress={handlePublish}
                disabled={publishing}
              >
                <Text style={styles.publishButtonText}>Publish</Text>
              </TouchableOpacity>
            </View>

            {/* Grid Card */}
            <View style={styles.cardContainer}>
              {/* Author row cell */}
              <View style={styles.cardAuthorRow}>
                <View style={styles.cardAvatar}>
                  {userProfile?.profilePhoto ? (
                    <Image
                      source={{ uri: userProfile.profilePhoto, cache: 'reload' }}
                      style={styles.cardAvatarImage}
                    />
                  ) : (
                    <Ionicons name="person" size={14} color="#666" />
                  )}
                </View>
                <Text style={styles.cardAuthorName} numberOfLines={1}>
                  {userProfile?.name || ''}
                </Text>
              </View>

              {/* Title cell */}
              <View style={styles.cardTitleCell}>
                <TextInput
                  style={styles.titleInput}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Enter event title"
                  placeholderTextColor={colors.offline}
                  maxLength={26}
                />
              </View>

              {/* Location & Time cell */}
              <View style={styles.cardDetailsCell}>
                <View style={styles.detailsInner}>
                  <View style={styles.locationSection}>
                    <Text style={styles.detailLabel}>Location:</Text>
                    <TextInput
                      style={styles.detailInput}
                      value={location}
                      onChangeText={setLocation}
                      placeholder="Event location / address"
                      placeholderTextColor={colors.offline}
                    />
                  </View>
                  <View style={styles.timeSection}>
                    <Text style={styles.detailLabel}>Time:</Text>
                    <TouchableOpacity
                      style={styles.timeDropdown}
                      onPress={() => setShowTimePicker(true)}
                    >
                      <Text style={[styles.timeValue, !time && { color: colors.offline }]}>
                        {time || '12:00 PM'}
                      </Text>
                      <Ionicons
                        name="chevron-down"
                        size={14}
                        color={colors.offline}
                        style={{ marginLeft: 4 }}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Date row cell — inline dropdown calendar */}
              <TouchableOpacity
                style={[styles.cardDateCell, calendarOpen && styles.cardDateCellOpen]}
                onPress={() => setCalendarOpen(!calendarOpen)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={colors.textDark}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.dateText}>{getFormattedDate()}</Text>
                <Ionicons
                  name={calendarOpen ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={colors.textDark}
                  style={{ marginLeft: 6 }}
                />
              </TouchableOpacity>

              {calendarOpen && (
                <View style={styles.calendarDropdown}>
                  {/* Month/Year Header */}
                  <View style={styles.calMonthRow}>
                    <TouchableOpacity
                      onPress={() => cycleCalMonth(-1)}
                      disabled={!canGoBack}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name="chevron-back"
                        size={20}
                        color={canGoBack ? '#000000' : colors.offline}
                      />
                    </TouchableOpacity>
                    <Text style={styles.calMonthText}>
                      {MONTHS_FULL[calMonth]} {calYear}
                    </Text>
                    <TouchableOpacity
                      onPress={() => cycleCalMonth(1)}
                      disabled={!canGoForward}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color={canGoForward ? '#000000' : colors.offline}
                      />
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
                      const isToday =
                        day === todayDate.getDate() &&
                        calMonth === todayDate.getMonth() &&
                        calYear === todayDate.getFullYear()
                      const inRange = isDayInRange(day)
                      const isSelected =
                        day === selectedDay &&
                        calMonth === selectedMonth &&
                        calYear === selectedYear
                      return (
                        <TouchableOpacity
                          key={day}
                          style={[styles.calDayCell, !inRange && { opacity: 0.25 }]}
                          onPress={() => handleSelectDay(day)}
                          disabled={!inRange}
                        >
                          {isSelected ? (
                            <View style={styles.calDayCellSelectedOuter}>
                              <LinearGradient
                                colors={['#cafb6c', '#71f200', '#23ff0d']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.calDayCellSelected}
                              >
                                <LinearGradient
                                  colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']}
                                  style={styles.calDayCellSelectedHighlight}
                                />
                                <Text style={[styles.calDayText, styles.calDayTextSelected]}>
                                  {day}
                                </Text>
                              </LinearGradient>
                            </View>
                          ) : (
                            <View
                              style={[
                                styles.calDayInner,
                                isToday && styles.calDayCellToday,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.calDayText,
                                  isToday && styles.calDayTextToday,
                                ]}
                              >
                                {day}
                              </Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      )
                    })}
                  </View>

                  {/* Bottom Row: Reset + Done */}
                  <View style={styles.calBottomRow}>
                    <TouchableOpacity style={styles.resetButton} onPress={handleResetDate}>
                      <Text style={styles.resetButtonText}>Reset</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.showResultsButton}
                      onPress={() => setCalendarOpen(false)}
                    >
                      <Text style={styles.showResultsButtonText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Image Upload cell */}
              <TouchableOpacity style={styles.cardImageCell} onPress={handlePickImage}>
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.cardImage} />
                ) : selectedPlaceholder ? (
                  <Image
                    source={EVENT_THUMBNAILS.find((t) => t.id === selectedPlaceholder)?.source}
                    style={styles.cardImage}
                  />
                ) : (
                  <View style={styles.uploadPlaceholder}>
                    <Ionicons name="image-outline" size={32} color={colors.offline} />
                    <Text style={styles.uploadText}>upload a photo</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Placeholder image picker */}
              <TouchableOpacity
                style={styles.placeholderPickerTrigger}
                onPress={() => setPlaceholderPickerOpen(!placeholderPickerOpen)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="images-outline"
                  size={14}
                  color={selectedPlaceholder ? colors.primary : colors.offline}
                />
                <Text style={styles.placeholderPickerLabel}>
                  {selectedPlaceholder
                    ? EVENT_THUMBNAILS.find((t) => t.id === selectedPlaceholder)?.label
                    : 'choose a placeholder image'}
                </Text>
                <Ionicons
                  name={placeholderPickerOpen ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={colors.offline}
                />
              </TouchableOpacity>
              {placeholderPickerOpen && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.placeholderScrollStrip}
                  contentContainerStyle={styles.placeholderScrollContent}
                >
                  {EVENT_THUMBNAILS.map((thumb) => (
                    <TouchableOpacity
                      key={thumb.id}
                      style={[
                        styles.placeholderThumbWrap,
                        selectedPlaceholder === thumb.id && styles.placeholderThumbWrapSelected,
                      ]}
                      onPress={() => {
                        setSelectedPlaceholder(selectedPlaceholder === thumb.id ? null : thumb.id)
                        setImageUri(null)
                        setImageMeta(null)
                      }}
                      activeOpacity={0.7}
                    >
                      <Image source={thumb.source} style={styles.placeholderThumbImage} />
                      <Text
                        style={[
                          styles.placeholderThumbLabel,
                          selectedPlaceholder === thumb.id && styles.placeholderThumbLabelSelected,
                        ]}
                      >
                        {thumb.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {/* Description cell */}
              <View style={styles.cardDescriptionCell}>
                <TextInput
                  style={styles.descriptionInput}
                  value={description}
                  onChangeText={handleDescriptionChange}
                  placeholder="Enter event details"
                  placeholderTextColor={colors.offline}
                  multiline
                  textAlignVertical="top"
                />
                <Text style={styles.wordCount}>
                  {descriptionWordCount}/{MAX_DESCRIPTION_WORDS} words
                </Text>
              </View>

              {/* Link cell */}
              <TouchableOpacity
                style={styles.cardLinkCell}
                onPress={() => {
                  setTempLinkLabel(linkLabel)
                  setTempLink(link)
                  setShowLinkModal(true)
                }}
                activeOpacity={0.7}
              >
                {linkLabel ? (
                  <Text style={styles.linkDisplayText}>{linkLabel}</Text>
                ) : (
                  <Text style={styles.linkPlaceholder}>+ Add link</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* City / Global */}
            <View style={{ marginTop: 2, zIndex: 10 }}>
              {!isGlobal && (
                <CityAutocomplete
                  value={city}
                  onCitySelect={(selectedCity) => {
                    setCity(selectedCity)
                    if (selectedCity) setIsGlobal(false)
                  }}
                  placeholder="Filter by city (required)..."
                  inputBorderRadius={0}
                />
              )}
              <View style={styles.globalToggleRow}>
                <TouchableOpacity
                  style={[styles.globalCheckbox, isGlobal && styles.globalCheckboxActive]}
                  onPress={() => {
                    setIsGlobal(!isGlobal)
                    if (!isGlobal) setCity('')
                  }}
                >
                  {isGlobal && <Ionicons name="checkmark" size={12} color="#ffffff" />}
                </TouchableOpacity>
                <Ionicons
                  name="globe-outline"
                  size={14}
                  color={colors.textDark}
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.globalToggleLabel}>Global / Digital</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ==================== TIME PICKER MODAL ==================== */}
      <Modal
        visible={showTimePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTimePicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowTimePicker(false)}
        >
          <View style={styles.timePickerContainer}>
            <Text style={styles.timePickerTitle}>Select Time</Text>
            <FlatList
              data={TIME_OPTIONS}
              keyExtractor={(item) => item}
              style={styles.timeList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.timeOption, time === item && styles.timeOptionSelectedOuter]}
                  onPress={() => {
                    setTime(item)
                    setShowTimePicker(false)
                  }}
                >
                  {time === item ? (
                    <LinearGradient
                      colors={['#cafb6c', '#71f200', '#23ff0d']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.timeOptionSelected}
                    >
                      <LinearGradient
                        colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']}
                        style={styles.timeOptionSelectedHighlight}
                      />
                      <Text style={[styles.timeOptionText, styles.timeOptionTextSelected]}>
                        {item}
                      </Text>
                    </LinearGradient>
                  ) : (
                    <Text style={styles.timeOptionText}>{item}</Text>
                  )}
                </TouchableOpacity>
              )}
              getItemLayout={(data, index) => ({ length: 44, offset: 44 * index, index })}
              initialScrollIndex={time ? TIME_OPTIONS.indexOf(time) : 16}
            />
          </View>
        </TouchableOpacity>
      </Modal>

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
              placeholder="Label (e.g. RSVP Here)"
              placeholderTextColor={colors.offline}
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
    borderColor: '#000000',
    padding: 16,
  },

  // Header — simple row, no banner
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.textDark,
    marginLeft: 8,
  },

  // Publish Row
  publishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  publishNotice: {
    fontSize: 10,
    fontFamily: fonts.italic,
    color: colors.offline,
    flex: 1,
    marginRight: 12,
  },
  publishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000000',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  publishButtonText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: '#ffffff',
  },

  // Grid Card Container
  cardContainer: {
    backgroundColor: '#ffffff',
    marginBottom: 20,
  },

  // Author row cell
  cardAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#000000',
    padding: 10,
  },
  cardAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 8,
  },
  cardAvatarImage: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  cardAuthorName: {
    flex: 1,
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textDark,
  },

  // Title cell
  cardTitleCell: {
    borderWidth: 1,
    borderColor: '#000000',
    borderTopWidth: 0,
    padding: 10,
  },
  titleInput: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: '#000000',
    padding: 0,
  },

  // Location & Time details cell
  cardDetailsCell: {
    borderWidth: 1,
    borderColor: '#000000',
    borderTopWidth: 0,
    padding: 10,
  },
  detailsInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  locationSection: {
    flex: 1,
    marginRight: 16,
  },
  detailLabel: {
    fontSize: 12,
    fontFamily: fonts.mono,
    color: colors.textDark,
    marginBottom: 2,
  },
  detailInput: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textDark,
    lineHeight: 18,
    padding: 0,
  },
  timeSection: {
    alignItems: 'flex-end',
  },
  timeDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeValue: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: colors.textDark,
  },

  // Date cell — inline dropdown toggle
  cardDateCell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#000000',
    borderTopWidth: 0,
    padding: 10,
  },
  cardDateCellOpen: {
    borderBottomWidth: 0,
  },
  dateText: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.bold,
    color: '#000000',
  },

  // Image cell
  cardImageCell: {
    borderWidth: 1,
    borderColor: '#000000',
    borderTopWidth: 0,
    aspectRatio: 2,
    overflow: 'hidden',
  },
  cardImage: {
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
    fontFamily: fonts.italic,
    color: colors.offline,
    marginTop: 6,
  },

  // Placeholder image picker
  placeholderPickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#000000',
    borderTopWidth: 0,
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 8,
  },
  placeholderPickerLabel: {
    flex: 1,
    fontSize: 12,
    fontFamily: fonts.italic,
    color: colors.offline,
  },
  placeholderScrollStrip: {
    borderWidth: 1,
    borderColor: '#000000',
    borderTopWidth: 0,
    paddingVertical: 8,
  },
  placeholderScrollContent: {
    gap: 10,
    paddingHorizontal: 14,
  },
  placeholderThumbWrap: {
    alignItems: 'center',
    width: 64,
    borderRadius: 8,
    padding: 3,
  },
  placeholderThumbWrapSelected: {
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    borderWidth: 1,
    borderColor: '#000000',
  },
  placeholderThumbImage: {
    width: 56,
    height: 38,
    borderRadius: 4,
    backgroundColor: '#e0e0e0',
  },
  placeholderThumbLabel: {
    fontSize: 8,
    fontFamily: fonts.regular,
    color: colors.textDark,
    marginTop: 3,
    textAlign: 'center',
  },
  placeholderThumbLabelSelected: {
    fontFamily: fonts.bold,
  },

  // Description cell
  cardDescriptionCell: {
    borderWidth: 1,
    borderColor: '#000000',
    borderTopWidth: 0,
    padding: 10,
  },
  descriptionInput: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textDark,
    lineHeight: 18,
    minHeight: 60,
    padding: 0,
    textAlignVertical: 'top',
  },
  wordCount: {
    fontSize: 10,
    fontFamily: fonts.mono,
    color: colors.offline,
    textAlign: 'right',
    marginTop: 4,
  },

  // Link cell
  cardLinkCell: {
    borderWidth: 1,
    borderColor: '#000000',
    borderTopWidth: 0,
    padding: 10,
  },
  linkDisplayText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.textDark,
    textDecorationLine: 'underline',
  },
  linkPlaceholder: {
    fontSize: 12,
    fontFamily: fonts.italic,
    color: colors.offline,
  },

  // Link Modal
  linkModalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    width: '95%',
    borderWidth: 1,
    borderColor: '#000000',
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
    borderColor: '#000000',
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
    backgroundColor: '#000000',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 16,
  },
  linkModalSaveText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: '#ffffff',
  },

  // ==================== MODAL SHARED ====================
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ==================== TIME PICKER MODAL ====================
  timePickerContainer: {
    width: '70%',
    maxHeight: '60%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
  },
  timePickerTitle: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.textDark,
    marginBottom: 12,
  },
  timeList: {
    width: '100%',
  },
  timeOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  timeOptionSelectedOuter: {
    paddingVertical: 0,
    paddingHorizontal: 0,
    borderRadius: 10,
    shadowColor: '#23ff0d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  timeOptionSelected: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
    borderLeftColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    borderRightColor: 'rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
  },
  timeOptionSelectedHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  timeOptionText: {
    fontSize: 16,
    fontFamily: fonts.mono,
    color: colors.textDark,
  },
  timeOptionTextSelected: {
    fontFamily: fonts.bold,
  },

  // ==================== INLINE CALENDAR DROPDOWN ====================
  calendarDropdown: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#000000',
    borderTopWidth: 0,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  calMonthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  calMonthText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: '#000000',
  },
  calDayLabelsRow: {
    flexDirection: 'row',
    marginBottom: 6,
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
  calDayInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calDayCellToday: {
    backgroundColor: '#000000',
  },
  calDayCellSelectedOuter: {
    borderRadius: 16,
    shadowColor: '#23ff0d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  calDayCellSelected: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
    borderLeftColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    borderRightColor: 'rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
  },
  calDayCellSelectedHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  calDayText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: '#000000',
  },
  calDayTextToday: {
    fontFamily: fonts.bold,
    color: '#ffffff',
  },
  calDayTextSelected: {
    fontFamily: fonts.bold,
    color: '#000000',
  },
  calBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  resetButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#000000',
  },
  resetButtonText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: '#000000',
  },
  showResultsButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#000000',
  },
  showResultsButtonText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: '#ffffff',
  },

  // City / Global toggle
  globalToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  globalCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  globalCheckboxActive: {
    backgroundColor: '#000000',
  },
  globalToggleLabel: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textDark,
  },
})

export default EventCreateScreen
