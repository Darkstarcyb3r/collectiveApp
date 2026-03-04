// Onboarding Screen
// Swipe carousel introducing each section of the app
// Accessible from the dashboard logo button

import React, { useState, useRef, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  Modal,
  ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { Video, ResizeMode } from 'expo-av'
import { colors } from '../../theme'
import { fonts } from '../../theme/typography'
import { useAuth } from '../../contexts/AuthContext'
import { updateUserProfile } from '../../services/userService'
import { playClick } from '../../services/soundService'
import LightTabBar from '../../components/navigation/LightTabBar'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

const slides = [
  {
    title: 'Welcome to\nCollective Network',
    body: '',
    zone: 'intro',
    isIntro: true,
  },
  {
    title: 'private groups',
    body: 'Create or join interest-based groups. Post updates, share links, and have threaded conversations with your people. Only members can see what\'s inside. Posts last for 90 days for digital hygiene.',
    zone: 'groups',
  },
  {
    title: 'the public collective',
    body: 'Your public collective is your full network + 2nd degree connections, for an organic finite experience. You can opt out of the public network on your profile page and block or hide users from their profile page.',
    zone: 'collective',
  },
  {
    title: 'cyber lounge',
    body: 'Go full internet 2005 and create a live chatroom transient space. The only chatroom notification is when someone starts one. The host is the vibe setter: music & backgrounds.',
    zone: 'cyber',
  },
  {
    title: 'confluence',
    body: 'This is a permanent anonymous archive of culture and art within your network. Add a movie, artist, strange scene in the wild, or whatever you think is of canon to the creative confluence. You get 10 posts a month.',
    zone: 'confluence',
  },
  {
    title: 'mutual aid',
    body: 'Mutual aid is the heart of this app. It is critical to share resources with your collective network for distribution and exchange. This can be bartering in the market to tech activism skills. Add/vet groups, the list is permanent.',
    zone: 'mutual',
  },
  {
    title: 'events',
    body: 'Create and discover community events. Add comments, share details, and encourage the virtual --> IRL loop. Posted events are up to 6 wks out and are deleted after the event date passes.',
    zone: 'events',
  },
  {
    title: 'messages',
    body: 'Direct message with anyone in your collective. Messages auto-delete after 90 days for digital hygiene.',
    zone: 'messages',
  },
]

// Mini-dashboard zone row
const ZoneRow = ({ label, isActive, isDimmed, indent }) => (
  <View
    style={[
      miniStyles.zoneRow,
      indent && { marginLeft: 12 },
      isActive && miniStyles.zoneRowActive,
      isDimmed && { opacity: 0.2 },
    ]}
  >
    <Text style={[miniStyles.zoneLabel, isActive && { color: colors.primary }]}>
      {label}
    </Text>
    {isActive && (
      <View style={miniStyles.hereTag}>
        <Text style={miniStyles.hereTagText}>you are here</Text>
      </View>
    )}
  </View>
)

// Mini-dashboard visualization highlighting the active zone
const MiniDashboard = ({ zone }) => {
  const isActive = (z) => zone === z
  const isDimmed = (z) => zone !== z
  const collectiveChildren = ['cyber', 'confluence', 'mutual', 'events']
  const isCollectiveArea = zone === 'collective' || collectiveChildren.includes(zone)

  // Messages zone: show a conversation-list mockup instead of the dashboard
  if (zone === 'messages') {
    return (
      <View style={miniStyles.container}>
        {/* Green-bordered container like the real messages screen */}
        <View style={miniStyles.messagesContainer}>
          {/* Back arrow + logo */}
          <View style={miniStyles.messagesTopRow}>
            <Ionicons name="chevron-back" size={10} color={colors.primary} />
            <View style={miniStyles.messagesLogoPlaceholder} />
          </View>

          {/* Retention notice */}
          <Text style={miniStyles.messagesRetention}>
            Messages auto-delete after 90 days.
          </Text>

          {/* Title */}
          <Text style={miniStyles.messagesTitle}>Messages</Text>

          {/* Conversation rows */}
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={miniStyles.convoRow}>
              <View style={miniStyles.convoAvatar} />
              <View style={{ flex: 1, gap: 3 }}>
                <View style={[miniStyles.convoNameBar, i === 1 && { width: '55%' }]} />
                <View style={[miniStyles.convoMsgBar, i === 1 && { width: '80%' }]} />
              </View>
              <View style={miniStyles.convoTime} />
            </View>
          ))}
        </View>
      </View>
    )
  }

  return (
    <View style={miniStyles.container}>
      {/* Header bar mockup */}
      <View style={miniStyles.headerBar}>
        <View style={miniStyles.headerAvatar} />
        <View style={{ flex: 1 }} />
        <View style={miniStyles.headerLogo} />
      </View>

      {/* Private Groups */}
      <View
        style={[
          miniStyles.section,
          isActive('groups') && miniStyles.sectionActive,
          isDimmed('groups') && !isCollectiveArea && { opacity: 0.2 },
        ]}
      >
        <View style={miniStyles.sectionHeader}>
          <Text style={[miniStyles.sectionLabel, isActive('groups') && { color: colors.primary }]}>
            My Private Groups
          </Text>
          {isActive('groups') && (
            <View style={miniStyles.hereTag}>
              <Text style={miniStyles.hereTagText}>you are here</Text>
            </View>
          )}
        </View>
        {[1, 2, 3].map((i) => (
          <View key={i} style={miniStyles.groupRow}>
            <View style={miniStyles.groupDot} />
            <View style={miniStyles.groupBar} />
          </View>
        ))}
      </View>

      {/* Public Collective */}
      <View
        style={[
          miniStyles.section,
          isActive('collective') && miniStyles.sectionActive,
          !isCollectiveArea && isDimmed('collective') && { opacity: 0.2 },
        ]}
      >
        <View style={miniStyles.sectionHeader}>
          <Text style={[miniStyles.sectionLabel, isActive('collective') && { color: colors.primary }]}>
            My Public Collective
          </Text>
          {isActive('collective') && (
            <View style={miniStyles.hereTag}>
              <Text style={miniStyles.hereTagText}>you are here</Text>
            </View>
          )}
        </View>

        <ZoneRow
          label="Cyber Lounge >"
          isActive={isActive('cyber')}
          isDimmed={isDimmed('cyber') && zone !== 'collective'}
          indent
        />
        <ZoneRow
          label="Confluence >"
          isActive={isActive('confluence')}
          isDimmed={isDimmed('confluence') && zone !== 'collective'}
          indent
        />
        <ZoneRow
          label="Mutual Aid & Resources >"
          isActive={isActive('mutual')}
          isDimmed={isDimmed('mutual') && zone !== 'collective'}
          indent
        />
        <ZoneRow
          label="Events >"
          isActive={isActive('events')}
          isDimmed={isDimmed('events') && zone !== 'collective'}
          indent
        />
      </View>

      {/* Tab bar mockup */}
      <View style={miniStyles.tabBar}>
        {[
          { icon: '⌂', z: null },
          { icon: '○', z: null },
          { icon: 'mail-outline', z: 'messages', isIcon: true },
          { icon: '◎', z: null },
        ].map((tab, i) => (
          tab.isIcon ? (
            <Ionicons
              key={i}
              name={tab.icon}
              size={12}
              color={isActive('messages') && tab.z === 'messages' ? colors.primary : 'rgba(255,255,255,0.35)'}
            />
          ) : (
            <Text
              key={i}
              style={[
                miniStyles.tabIcon,
                isActive('messages') && tab.z === 'messages' && { color: colors.primary },
              ]}
            >
              {tab.icon}
            </Text>
          )
        ))}
      </View>
      {isActive('messages') && (
        <Text style={miniStyles.messagesHere}>you are here ↑</Text>
      )}
    </View>
  )
}

const OnboardingScreen = ({ navigation }) => {
  const { user } = useAuth()
  const [activeIndex, setActiveIndex] = useState(0)
  const [showMission, setShowMission] = useState(false)
  const flatListRef = useRef(null)
  const lightTabRef = useRef(null)
  const hideTimer = useRef(null)
  const isLast = activeIndex === slides.length - 1

  // Show tab bar on drag, auto-hide after idle
  const handleScrollBeginDrag = () => {
    lightTabRef.current?.show()
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      lightTabRef.current?.hide()
    }, 2500)
  }

  const handleScrollEndDrag = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      lightTabRef.current?.hide()
    }, 2500)
  }

  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index)
    }
  }, [])

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current

  const goToIndex = (index) => {
    flatListRef.current?.scrollToIndex({ index, animated: true })
  }

  const handleNext = async () => {
    playClick()
    if (isLast) {
      // Mark onboarding as complete on the user's Firestore profile
      // This persists across devices and app reinstalls
      if (user?.uid) {
        await updateUserProfile(user.uid, { onboardingComplete: true })
      }
      navigation.goBack()
    } else {
      goToIndex(activeIndex + 1)
    }
  }

  const handleBack = () => {
    playClick()
    if (activeIndex > 0) goToIndex(activeIndex - 1)
  }

  const renderSlide = ({ item }) => {
    if (item.isIntro) {
      return (
        <View style={styles.slide}>
          {/* Welcome title */}
          <View style={styles.introTextSection}>
            <Text style={styles.introTitle}>{item.title}</Text>
          </View>

          {/* Promo video */}
          <View style={styles.introVideoWrapper}>
            <Video
              source={require('../../assets/videos/collective-promo.mp4')}
              style={styles.introVideo}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
              isLooping
              isMuted
            />
          </View>
        </View>
      )
    }

    return (
      <View style={styles.slide}>
        {/* Title + body */}
        <View style={styles.textSection}>
          <Text style={styles.slideTitle}>{item.title}</Text>
          <Text style={styles.slideBody}>{item.body}</Text>
        </View>

        {/* Mini dashboard */}
        <View style={styles.dashboardWrapper}>
          <View style={styles.dashboardCard}>
            <Text style={styles.findItLabel}>find it here</Text>
            <MiniDashboard zone={item.zone} />
          </View>
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header with back arrow, mission button, and logo */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ padding: 4 }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => { playClick(); setShowMission(true); }} style={styles.missionButtonOuter}>
            <LinearGradient
              colors={['#cafb6c', '#71f200', '#23ff0d']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.missionButton}
            >
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']}
                style={styles.missionButtonHighlight}
              />
              <View style={styles.missionButtonContent}>
                <Text style={styles.missionButtonText}>mission</Text>
                <Ionicons name="chevron-down" size={12} color={colors.textDark} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
          <Image
            source={require('../../assets/images/green-logo.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
        </View>
      </View>

      {/* Carousel */}
      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        style={styles.carousel}
      />

      {/* Pagination dots */}
      <View style={styles.dotsRow}>
        {slides.map((_, i) => (
          <TouchableOpacity key={i} onPress={() => { playClick(); goToIndex(i); }}>
            <View
              style={[
                styles.dot,
                i === activeIndex && styles.dotActive,
              ]}
            />
          </TouchableOpacity>
        ))}
      </View>

      {/* Bottom buttons */}
      <View style={styles.bottomButtons}>
        {activeIndex > 0 && (
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.nextButtonOuter} onPress={handleNext}>
          <LinearGradient colors={['#cafb6c', '#71f200', '#23ff0d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.nextButton}>
            <LinearGradient colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']} style={styles.nextButtonHighlight} />
            <Text style={styles.nextButtonText}>{isLast ? 'get started' : 'next'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <LightTabBar ref={lightTabRef} dark />

      {/* Mission Statement Overlay */}
      <Modal
        visible={showMission}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMission(false)}
      >
        <View style={styles.missionOverlay}>
          <View style={styles.missionCard}>
            {/* Close button */}
            <TouchableOpacity
              style={styles.missionClose}
              onPress={() => { playClick(); setShowMission(false); }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.missionHeading}>our mission</Text>
              <Text style={styles.missionText}>
                Collective Network is built on the belief that technology should serve community — not extract from it.
              </Text>
              <Text style={styles.missionText}>
                We are a platform for intentional connection: a place to organize with your people, share resources through mutual aid, and build culture together.
              </Text>
              <Text style={styles.missionText}>
                No algorithms. No ads. No data harvesting. Just real people in real networks, supporting each other.
              </Text>
              <Text style={styles.missionText}>
                Digital hygiene is core to our design — posts and messages auto-delete, keeping your space clean and present. We believe in the ephemeral internet: what matters is what's happening now.
              </Text>
              <Text style={styles.missionText}>
                This is tech for the people. Built with care, powered by solidarity.
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

// ── Mini-dashboard styles ──
const miniStyles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 6,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    opacity: 0.4,
  },
  headerAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.border,
  },
  headerLogo: {
    width: 48,
    height: 12,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  section: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 8,
    paddingHorizontal: 10,
  },
  sectionActive: {
    borderColor: colors.primary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionLabel: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.textPrimary,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 3,
  },
  groupDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  groupBar: {
    height: 5,
    flex: 1,
    backgroundColor: colors.border,
    borderRadius: 3,
  },
  zoneRow: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  zoneRowActive: {
    borderColor: colors.primary,
    backgroundColor: '#111',
  },
  zoneLabel: {
    fontFamily: fonts.regular,
    fontSize: 9,
    color: colors.offline,
  },
  hereTag: {
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  hereTagText: {
    fontFamily: fonts.regular,
    fontSize: 7,
    color: colors.background,
    letterSpacing: 0.5,
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 4,
  },
  tabIcon: {
    fontSize: 14,
    color: colors.offline,
  },
  messagesHere: {
    fontFamily: fonts.regular,
    fontSize: 7,
    color: colors.primary,
    textAlign: 'center',
    marginTop: -2,
  },
  // Messages screen mockup styles
  messagesContainer: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    padding: 10,
  },
  messagesTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  messagesLogoPlaceholder: {
    width: 28,
    height: 7,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  messagesRetention: {
    fontFamily: fonts.italic,
    fontSize: 5,
    color: colors.primary,
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 6,
  },
  messagesTitle: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.primary,
    marginBottom: 8,
  },
  convoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  convoAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.border,
  },
  convoNameBar: {
    width: '45%',
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  convoMsgBar: {
    width: '70%',
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  convoTime: {
    width: 16,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
})

// ── Screen styles ──
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerLogo: {
    width: 55,
    height: 55,
    opacity: 1,
  },
  missionButtonOuter: {
    borderRadius: 14,
    shadowColor: '#23ff0d',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  missionButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
    borderLeftColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    borderRightColor: 'rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
  },
  missionButtonHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  missionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  missionButtonText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textDark,
    textTransform: 'lowercase',
    letterSpacing: 0.5,
  },
  // Mission overlay
  missionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  missionCard: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: 'rgba(26, 26, 26, 0.75)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 16,
    // Glass effect via border highlights
    borderTopColor: 'rgba(255, 255, 255, 0.18)',
    borderLeftColor: 'rgba(255, 255, 255, 0.14)',
  },
  missionClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missionHeading: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.primary,
    letterSpacing: 1,
    textTransform: 'lowercase',
    marginBottom: 20,
  },
  missionText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.tertiary,
    lineHeight: 22,
    marginBottom: 16,
  },
  carousel: {
    flex: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    paddingHorizontal: 28,
  },
  // Intro slide styles
  introTextSection: {
    paddingTop: 24,
    alignItems: 'flex-start',
  },
  introTitle: {
    fontFamily: fonts.bold,
    fontSize: 26,
    color: colors.primary,
    letterSpacing: 1,
    textAlign: 'left',
    lineHeight: 34,
  },
  introVideoWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 20,
    paddingBottom: 8,
  },
  introVideo: {
    width: '100%',
    flex: 1,
    borderRadius: 16,
  },
  textSection: {
    paddingTop: 16,
    alignItems: 'flex-start',
  },
  slideTitle: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.primary,
    letterSpacing: 1,
    textTransform: 'lowercase',
    marginBottom: 10,
    textAlign: 'left',
  },
  slideBody: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.tertiary,
    lineHeight: 20,
    textAlign: 'left',
    minHeight: 60,
  },
  dashboardWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 16,
    paddingBottom: 0,
  },
  dashboardCard: {
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 18,
    width: '100%',
  },
  findItLabel: {
    fontFamily: fonts.regular,
    fontSize: 8,
    color: colors.offline,
    textAlign: 'center',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 26,
    marginBottom: 10,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 20,
    backgroundColor: colors.primary,
  },
  bottomButtons: {
    flexDirection: 'row',
    paddingHorizontal: 28,
    gap: 10,
    marginTop: 28,
    marginBottom: 80,
  },
  backButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  backButtonText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.primary,
    letterSpacing: 1,
    textTransform: 'lowercase',
  },
  nextButtonOuter: {
    flex: 1,
    borderRadius: 8,
    shadowColor: '#23ff0d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  nextButton: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
    borderLeftColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    borderRightColor: 'rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
  },
  nextButtonHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  nextButtonText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.background,
    letterSpacing: 1,
    textTransform: 'lowercase',
  },
})

export default OnboardingScreen
