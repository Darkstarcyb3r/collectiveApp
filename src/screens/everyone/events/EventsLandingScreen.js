// Events Landing Screen
// Chronological feed of user-posted events
// Events visible up to 6 weeks out, deleted day after event date passes
// + Event button, edit post for author

import React, { useState, useEffect, useCallback, useRef } from 'react'
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
  Animated,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useFocusEffect } from '@react-navigation/native'
import Swipeable from 'react-native-gesture-handler/Swipeable'
import { colors } from '../../../theme'
import { fonts } from '../../../theme/typography'
import { useAuth } from '../../../contexts/AuthContext'
import {
  subscribeToEvents,
  deleteExpiredEvents,
  getUserMonthlyEventCount,
  deleteEvent,
  subscribeToNetworkUsers,
} from '../../../services/everyoneService'
import { buildConnectedUserIds } from '../../../utils/networkGraph'
import LightTabBar from '../../../components/navigation/LightTabBar'
import { ConfirmModal } from '../../../components/common'
import CityAutocomplete from '../../../components/common/CityAutocomplete'

const MAX_EVENTS_PER_MONTH = 20
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

const EVENT_THUMBNAILS = [
  require('../../../assets/event-thumbnails/Galaxy.png'),
  require('../../../assets/event-thumbnails/Green.png'),
  require('../../../assets/event-thumbnails/Lavendar.png'),
  require('../../../assets/event-thumbnails/Orange.png'),
  require('../../../assets/event-thumbnails/Red.png'),
]
const PLACEHOLDER_MAP = {
  thumb1: require('../../../assets/event-thumbnails/Galaxy.png'),
  thumb2: require('../../../assets/event-thumbnails/Green.png'),
  thumb3: require('../../../assets/event-thumbnails/Lavendar.png'),
  thumb4: require('../../../assets/event-thumbnails/Orange.png'),
  thumb5: require('../../../assets/event-thumbnails/Red.png'),
}
const getEventThumbnail = (eventId) => {
  let hash = 0
  for (let i = 0; i < eventId.length; i++) {
    hash = (hash << 5) - hash + eventId.charCodeAt(i)
    hash |= 0
  }
  return EVENT_THUMBNAILS[Math.abs(hash) % EVENT_THUMBNAILS.length]
}
const getEventImageSource = (imageUrl, eventId) => {
  if (imageUrl && imageUrl.startsWith('placeholder:')) {
    const thumbId = imageUrl.replace('placeholder:', '')
    return PLACEHOLDER_MAP[thumbId] || getEventThumbnail(eventId)
  }
  if (imageUrl) return { uri: imageUrl }
  return getEventThumbnail(eventId)
}

const EventsLandingScreen = ({ navigation, route }) => {
  const { user, userProfile } = useAuth()
  const [events, setEvents] = useState([])
  const [myMonthlyCount, setMyMonthlyCount] = useState(0)
  const [allNetworkUsers, setAllNetworkUsers] = useState([])
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [filterDate, setFilterDate] = useState(null)
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [deleteConfirm, setDeleteConfirm] = useState({ visible: false, eventId: null })
  const [cityFilter, setCityFilter] = useState('')
  const [isGlobalFilter, setIsGlobalFilter] = useState(false)
  const lightTabRef = useRef(null)
  const lastScrollY = useRef(0)

  const hiddenUsers = userProfile?.hiddenUsers || []
  const blockedUsers = userProfile?.blockedUsers || []
  const blockedBy = userProfile?.blockedBy || []
  const excludedUsers = [...new Set([...hiddenUsers, ...blockedUsers, ...blockedBy])]
  const myFollowingUsers = userProfile?.subscribedUsers || []

  // Pick up optimistic count passed back from EventCreateScreen
  useEffect(() => {
    if (route.params?.updatedMonthlyCount != null) {
      setMyMonthlyCount(route.params.updatedMonthlyCount)
      // Clear the param so it doesn't re-apply on future focus
      navigation.setParams({ updatedMonthlyCount: undefined })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.updatedMonthlyCount])

  useEffect(() => {
    if (!userProfile?.everyoneNetworkEnabled) {
      navigation.goBack()
      return
    }
    // Clean up expired events on load
    deleteExpiredEvents()

    const unsubscribe = subscribeToEvents((eventList) => {
      setEvents(eventList)
    })

    // Subscribe to network users for 2-degree filtering
    const unsubNetwork = subscribeToNetworkUsers((users) => {
      setAllNetworkUsers(users)
    })

    return () => {
      unsubscribe()
      unsubNetwork()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch the user's monthly event count on focus (with retry for cloud function lag)
  useFocusEffect(
    useCallback(() => {
      if (!user?.uid) return
      let cancelled = false

      const fetchCount = async () => {
        const result = await getUserMonthlyEventCount(user.uid)
        if (!cancelled && result.success) {
          setMyMonthlyCount(result.count)
        }
      }

      // Fetch immediately
      fetchCount()
      // Retry after a delay to catch the cloud function's rate limit counter update
      const timer = setTimeout(fetchCount, 2500)

      return () => {
        cancelled = true
        clearTimeout(timer)
      }
    }, [user?.uid])
  )

  const handleCreateEvent = () => {
    if (myMonthlyCount >= MAX_EVENTS_PER_MONTH) {
      Alert.alert(
        'Monthly Limit Reached',
        `You've reached the maximum of ${MAX_EVENTS_PER_MONTH} event posts this month. Your limit resets on the 1st.`
      )
      return
    }
    navigation.navigate('EventCreate')
  }

  // Calendar helpers
  const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate()
  const getFirstDayOfMonth = (month, year) => new Date(year, month, 1).getDay()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const maxDate = new Date(today)
  maxDate.setDate(maxDate.getDate() + 42) // 6 weeks

  const canGoBack = calMonth !== today.getMonth() || calYear !== today.getFullYear()
  const canGoForward = calMonth !== maxDate.getMonth() || calYear !== maxDate.getFullYear()

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

  const isDayInRange = (day) => {
    const d = new Date(calYear, calMonth, day)
    d.setHours(0, 0, 0, 0)
    return d >= today && d <= maxDate
  }

  const handleSelectDay = (day) => {
    if (!isDayInRange(day)) return
    setFilterDate(new Date(calYear, calMonth, day))
  }

  const handleReset = () => {
    setFilterDate(null)
    setCalMonth(new Date().getMonth())
    setCalYear(new Date().getFullYear())
  }

  const handleShowResults = () => {
    setCalendarOpen(false)
  }

  const getFilterLabel = () => {
    if (!filterDate) return 'Filter by date'
    return `${MONTHS_FULL[filterDate.getMonth()]} ${filterDate.getDate()}, ${filterDate.getFullYear()}`
  }

  // --- Swipe-to-delete (author only) ---
  const handleSwipeDelete = (eventId) => {
    setDeleteConfirm({ visible: true, eventId })
  }

  const handleConfirmDelete = async () => {
    const eid = deleteConfirm.eventId
    setDeleteConfirm({ visible: false, eventId: null })
    await deleteEvent(eid)
  }

  const renderEventDeleteAction = (progress, eventId) => {
    const trans = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [80, 0],
    })
    return (
      <Animated.View style={[styles.eventDeleteAction, { transform: [{ translateX: trans }] }]}>
        <TouchableOpacity
          onPress={() => handleSwipeDelete(eventId)}
          style={styles.eventDeleteButton}
        >
          <Ionicons name="trash-outline" size={18} color={colors.offline} />
        </TouchableOpacity>
      </Animated.View>
    )
  }

  const formatCardDateTime = (dateVal, timeVal) => {
    if (!dateVal) return ''
    const d =
      dateVal instanceof Date ? dateVal : dateVal.toDate ? dateVal.toDate() : new Date(dateVal)
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ]
    let str = `${dayNames[d.getDay()]}, ${monthNames[d.getMonth()]} ${d.getDate()}`
    if (timeVal) {
      // If time already has AM/PM, use it directly
      if (timeVal.includes('AM') || timeVal.includes('PM')) {
        str += `, ${timeVal}`
      } else {
        // Legacy 24h format fallback
        const [h, m] = timeVal.split(':').map(Number)
        const ampm = h >= 12 ? 'PM' : 'AM'
        const hour12 = h % 12 || 12
        str += `, ${hour12}:${m.toString().padStart(2, '0')} ${ampm}`
      }
    }
    return str
  }

  const getTodayString = () => {
    const now = new Date()
    const days = ['Sun', 'Mon', 'Tues', 'Weds', 'Thurs', 'Fri', 'Sat']
    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
    return `Today: ${days[now.getDay()]}, ${months[now.getMonth()]}/${now.getDate().toString().padStart(2, '0')}/${now.getFullYear()}`
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

      {/* Main Container */}
      <View style={styles.mainContainer}>
        {/* Header — no banner, just simple row */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.navigate('MainTabs', { screen: 'HomeTab' })}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ padding: 4 }}
          >
            <Ionicons name="chevron-back" size={24} color={colors.textDark} />
          </TouchableOpacity>
          <Ionicons
            name="globe-outline"
            size={22}
            color={colors.textDark}
            style={{ marginLeft: 4 }}
          />
          <Text style={styles.title}>Events</Text>
        </View>

        {/* Description */}
        <Text style={styles.description}>
          Share upcoming events within the next 6 weeks. Reading club, underground show, whatever.
        </Text>

        {/* Event Button + Today */}
        <View style={styles.actionRow}>
          <View style={styles.dateColumn}>
            <Text style={styles.todayText}>{getTodayString()}</Text>
            <Text style={styles.monthlyCounter}>
              {myMonthlyCount}/{MAX_EVENTS_PER_MONTH} posts this month
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.eventButton,
              myMonthlyCount >= MAX_EVENTS_PER_MONTH && styles.eventButtonDisabled,
            ]}
            onPress={handleCreateEvent}
          >
            <Ionicons name="add" size={16} color="#ffffff" />
            <Text style={styles.eventButtonText}>Event</Text>
          </TouchableOpacity>
        </View>

        {/* Calendar Date Filter */}
        <TouchableOpacity
          style={[styles.calendarToggle, calendarOpen && styles.calendarToggleOpen]}
          onPress={() => setCalendarOpen(!calendarOpen)}
          activeOpacity={0.7}
        >
          <Ionicons name="calendar-outline" size={16} color={colors.textDark} />
          <Text style={styles.calendarToggleText}>{getFilterLabel()}</Text>
          <Ionicons
            name={calendarOpen ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={colors.textDark}
          />
        </TouchableOpacity>

        {calendarOpen && (
          <View style={styles.calendarDropdown}>
            {/* Month/Year Header */}
            <View style={styles.calMonthRow}>
              <TouchableOpacity
                onPress={() => cycleCalMonth(-1)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                disabled={!canGoBack}
              >
                <Ionicons
                  name="chevron-back"
                  size={20}
                  color={canGoBack ? colors.textDark : colors.offline}
                />
              </TouchableOpacity>
              <Text style={styles.calMonthText}>
                {MONTHS_FULL[calMonth]} {calYear}
              </Text>
              <TouchableOpacity
                onPress={() => cycleCalMonth(1)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                disabled={!canGoForward}
              >
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={canGoForward ? colors.textDark : colors.offline}
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
                const now = new Date()
                const isToday =
                  day === now.getDate() &&
                  calMonth === now.getMonth() &&
                  calYear === now.getFullYear()
                const inRange = isDayInRange(day)
                const isSelected =
                  filterDate &&
                  day === filterDate.getDate() &&
                  calMonth === filterDate.getMonth() &&
                  calYear === filterDate.getFullYear()
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

            {/* Bottom Row: Reset + Show Results */}
            <View style={styles.calBottomRow}>
              <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
                <Text style={styles.resetButtonText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.showResultsButton} onPress={handleShowResults}>
                <Text style={styles.showResultsButtonText}>Show results</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* City Filter */}
        <View style={{ marginTop: 6, zIndex: 10 }}>
          <CityAutocomplete
            value={cityFilter}
            onCitySelect={(selectedCity) => {
              setCityFilter(selectedCity)
              if (selectedCity) setIsGlobalFilter(false)
            }}
            placeholder="Filter by city..."
            inputBorderRadius={0}
          />
          <View style={styles.globalFilterRow}>
            <TouchableOpacity
              style={[styles.globalCheckbox, isGlobalFilter && styles.globalCheckboxActive]}
              onPress={() => {
                setIsGlobalFilter(!isGlobalFilter)
                if (!isGlobalFilter) setCityFilter('')
              }}
            >
              {isGlobalFilter && <Ionicons name="checkmark" size={12} color="#ffffff" />}
            </TouchableOpacity>
            <Ionicons
              name="globe-outline"
              size={14}
              color={colors.textDark}
              style={{ marginRight: 4 }}
            />
            <Text style={styles.globalFilterLabel}>Global / Digital</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.headerDivider} />

        {/* Scrollable Events Feed */}
        <ScrollView
          style={styles.eventsScrollContainer}
          contentContainerStyle={styles.eventsScrollContent}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          onScrollBeginDrag={handleScrollBeginDrag}
          scrollEventThrottle={16}
        >
          {(() => {
            const connectedUserIds = buildConnectedUserIds(
              user?.uid,
              allNetworkUsers,
              excludedUsers,
              myFollowingUsers
            )
            const visibleEvents = events.filter((e) => {
              if (excludedUsers.includes(e.authorId) || !connectedUserIds.has(e.authorId))
                return false
              // City filter
              if (isGlobalFilter) {
                if (e.city !== 'Global') return false
              } else if (cityFilter) {
                if (e.city !== cityFilter) return false
              }
              if (filterDate) {
                const eventDate =
                  e.date instanceof Date
                    ? e.date
                    : e.date?.toDate
                      ? e.date.toDate()
                      : new Date(e.date)
                return (
                  eventDate.getFullYear() === filterDate.getFullYear() &&
                  eventDate.getMonth() === filterDate.getMonth() &&
                  eventDate.getDate() === filterDate.getDate()
                )
              }
              return true
            })
            if (visibleEvents.length === 0) {
              return (
                <View style={styles.emptyContainer}>
                  <Ionicons name="calendar-outline" size={48} color={colors.offline} />
                  <Text style={styles.emptyText}>
                    {filterDate ? 'No events on this date.' : 'No events yet. Create one!'}
                  </Text>
                </View>
              )
            }

            return visibleEvents.map((event) => {
              const isAuthor = event.authorId === user?.uid
              return (
                <Swipeable
                  key={event.id}
                  renderRightActions={
                    isAuthor ? (progress) => renderEventDeleteAction(progress, event.id) : undefined
                  }
                  rightThreshold={40}
                  overshootRight={false}
                  enabled={isAuthor}
                >
                  <TouchableOpacity
                    style={styles.eventCard}
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate('EventDetail', { eventId: event.id })}
                  >
                    <View style={styles.cardRow}>
                      {/* Rectangular thumbnail */}
                      <Image
                        source={getEventImageSource(event.imageUrl, event.id)}
                        style={styles.cardThumbnail}
                      />

                      {/* Text details */}
                      <View style={styles.cardDetails}>
                        <Text style={styles.cardDateTime} numberOfLines={1}>
                          {formatCardDateTime(event.date, event.time)}
                        </Text>
                        <Text style={styles.cardTitle} numberOfLines={2}>
                          {event.title}
                        </Text>
                        {event.location ? (
                          <Text style={styles.cardLocation} numberOfLines={1}>
                            {event.location}
                          </Text>
                        ) : null}
                      </View>

                      {/* Author avatar */}
                      <View style={styles.cardAvatar}>
                        {event.authorPhoto ? (
                          <Image
                            source={{ uri: event.authorPhoto }}
                            style={styles.cardAvatarImage}
                          />
                        ) : (
                          <Ionicons name="person" size={12} color="#666" />
                        )}
                      </View>

                      {/* Vertical divider before swipe area */}
                      <View style={styles.cardDivider} />
                    </View>
                  </TouchableOpacity>
                </Swipeable>
              )
            })
          })()}
        </ScrollView>
      </View>
      <LightTabBar ref={lightTabRef} />

      {/* Delete Event Confirm Modal */}
      <ConfirmModal
        visible={deleteConfirm.visible}
        title="Delete Event"
        message="Are you sure you want to delete this event?"
        confirmText="Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirm({ visible: false, eventId: null })}
      />
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
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#000000',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 16,
  },
  eventsScrollContainer: {
    flex: 1,
  },
  eventsScrollContent: {
    paddingBottom: 80,
  },

  // Header — no banner background
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 4,
  },
  headerDivider: {
    height: 1,
    backgroundColor: '#000000',
    marginBottom: 6,
    marginHorizontal: -16,
  },
  title: {
    fontSize: 24,
    fontFamily: fonts.bold,
    color: colors.textDark,
    marginLeft: 60,
  },

  // Description
  description: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.textDark,
    lineHeight: 16,
    marginBottom: 16,
    marginLeft: 10,
  },

  // Action Row
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  eventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000000',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 10,
  },
  eventButtonText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: '#ffffff',
    marginLeft: 4,
  },
  dateColumn: {
    alignItems: 'flex-start',
  },
  todayText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.textDark,
  },
  monthlyCounter: {
    fontSize: 10,
    fontFamily: fonts.mono,
    color: colors.offline,
    marginTop: 2,
  },
  eventButtonDisabled: {
    opacity: 0.4,
  },

  // Calendar Date Filter
  calendarToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#000000',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  calendarToggleOpen: {
    borderBottomWidth: 0,
    marginBottom: 0,
  },
  calendarToggleText: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.bold,
    color: '#000000',
    marginLeft: 8,
  },
  calendarDropdown: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#000000',
    borderTopWidth: 0,
    paddingHorizontal: 14,
    paddingBottom: 14,
    marginBottom: 10,
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
    color: colors.textDark,
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

  // Event Card — clean horizontal listing
  eventCard: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardThumbnail: {
    width: 120,
    height: 80,
    borderRadius: 0,
    backgroundColor: '#e0e0e0',
  },
  cardDetails: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  cardDateTime: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: '#000000',
    marginBottom: 3,
  },
  cardTitle: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textDark,
    marginBottom: 3,
  },
  cardLocation: {
    fontSize: 10,
    fontFamily: fonts.regular,
    color: colors.offline,
  },
  cardAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginLeft: 10,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  cardAvatarImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  cardDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: '#000000',
    marginLeft: 10,
  },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: fonts.italic,
    color: colors.offline,
    marginTop: 8,
  },

  // Swipe delete
  eventDeleteAction: {
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    width: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  eventDeleteButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: 60,
  },

  // City filter
  globalFilterRow: {
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
  globalFilterLabel: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textDark,
  },
})

export default EventsLandingScreen
