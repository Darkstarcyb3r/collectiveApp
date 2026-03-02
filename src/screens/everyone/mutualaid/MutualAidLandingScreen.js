// Mutual Aid Landing Screen
// Static list of sub-categories with arrow navigation

import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { colors } from '../../../theme'
import { fonts } from '../../../theme/typography'
import { useAuth } from '../../../contexts/AuthContext'
import { functions } from '../../../config/firebase'
import LightTabBar from '../../../components/navigation/LightTabBar'

const CATEGORIES = [
  {
    number: '000',
    label: 'Barter Market',
    category: 'barter_market',
    title: 'Barter Market',
    isBarter: true,
    bold: true,
  },
  { number: '001', label: 'Basic Needs', category: 'basic_needs', title: 'Basic Needs' },
  { number: '002', label: 'Action & Art', category: 'action_art', title: 'Action & Art' },
  { number: '003', label: 'Technology', category: 'technology', title: 'Technology' },
  { number: '004', label: 'LGBTQ+', category: 'lgbtq', title: 'LGBTQ+ Support' },
  {
    number: '005',
    label: 'Health Resources',
    category: 'health_resources',
    title: 'Health Resources',
  },
  { number: '006', label: 'Legal Support', category: 'legal_support', title: 'Legal Support' },
  {
    number: '007',
    label: 'Emergency Response',
    category: 'emergency_response',
    title: 'Emergency Response',
  },
]

const MutualAidLandingScreen = ({ navigation }) => {
  const { userProfile } = useAuth()
  const lightTabRef = useRef(null)
  const lastScrollY = useRef(0)
  const [requestingChat, setRequestingChat] = useState(false)

  useEffect(() => {
    if (!userProfile?.everyoneNetworkEnabled) {
      navigation.goBack()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRequestCategory = async () => {
    if (requestingChat) return
    setRequestingChat(true)
    try {
      const requestCategoryChat = functions.httpsCallable('requestCategoryChat')
      const result = await requestCategoryChat()
      const { conversationId, status, creatorUid, alreadySent } = result.data

      if (status === 'accepted') {
        navigation.navigate('Chat', {
          conversationId,
          otherUserId: creatorUid,
        })
      } else if (status === 'pending' && alreadySent) {
        Alert.alert(
          'Request Sent',
          'Your chat request has already been sent. You will be notified when it is accepted.'
        )
      } else {
        Alert.alert(
          'Request Sent',
          'Your chat request has been sent! You will be notified when it is accepted.'
        )
      }
    } catch (error) {
      if (error.code === 'functions/failed-precondition') {
        // User is the app creator
        Alert.alert('', "You're the app creator!")
      } else {
        console.log('🔴 requestCategoryChat error:', error.message)
        Alert.alert('Error', 'Could not send request. Please try again.')
      }
    } finally {
      setRequestingChat(false)
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

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        scrollEventThrottle={16}
      >
        <View style={styles.mainContainer}>
          {/* Header */}
          <View style={styles.headerOuter}>
            <LinearGradient
              colors={['#d8f434', '#b3f425', '#93f478']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.headerRow}
            >
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']}
                style={styles.headerHighlight}
              />
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
              <Text style={styles.title}>Mutual Aid</Text>
            </LinearGradient>
          </View>

          {/* Description */}
          <Text style={styles.emphasis}>Permanent Resources</Text>

          <Text style={styles.description}>
            The archive stays; posts are only manually deleted. Mutual Aid is a community
            self-support and resource distribution method. Contributors post groups or resource
            links.
          </Text>

          {/* Category List */}
          <View style={styles.listContainer}>
            {CATEGORIES.map((cat) => (
              <View
                key={cat.number}
                style={[styles.categoryRow, cat.bold && styles.categoryRowHighlight]}
              >
                <Text style={[styles.categoryNumber, cat.bold && styles.categoryTextLight]}>
                  {cat.number}
                </Text>
                <Text
                  style={[
                    styles.categoryLabel,
                    cat.bold && styles.categoryLabelBold,
                    cat.bold && styles.categoryTextLight,
                  ]}
                >
                  {cat.label}
                </Text>
                {cat.bold ? (
                  <TouchableOpacity
                    style={styles.arrowButtonDark}
                    onPress={() => {
                      navigation.navigate('BarterMarketLanding')
                    }}
                  >
                    <Ionicons name="arrow-forward" size={20} color="#ffffff" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.arrowButtonOuter}
                    onPress={() => {
                      navigation.navigate('MutualAidCategory', {
                        category: cat.category,
                        title: cat.title,
                      })
                    }}
                  >
                    <LinearGradient
                      colors={['#d8f434', '#b3f425', '#93f478']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.arrowButton}
                    >
                      <LinearGradient
                        colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']}
                        style={styles.arrowButtonHighlight}
                      />
                      <Ionicons name="arrow-forward" size={20} color={colors.textDark} />
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>

          {/* Request Category Button */}
          <TouchableOpacity
            style={[styles.requestButton, requestingChat && { opacity: 0.5 }]}
            onPress={handleRequestCategory}
            activeOpacity={0.7}
            disabled={requestingChat}
          >
            <Ionicons name="chatbubble-outline" size={14} color={colors.textDark} />
            <Text style={styles.requestButtonText}>
              {requestingChat ? 'Sending...' : 'Request another category'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  headerOuter: {
    borderRadius: 10,
    marginBottom: 12,
    shadowColor: '#b3f425',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
    borderLeftColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    borderRightColor: 'rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
  },
  headerHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  title: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.textDark,
    marginLeft: 35,
  },
  emphasis: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.textDark,
    alignText: 'flex-start',
  },
  description: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textDark,
    lineHeight: 18,
    marginBottom: 20,
  },

  // List
  listContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  categoryNumber: {
    fontSize: 13,
    fontFamily: fonts.mono,
    color: colors.textDark,
    marginRight: 12,
    minWidth: 30,
  },
  categoryLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textDark,
  },
  categoryLabelBold: {
    fontFamily: fonts.bold,
  },
  categoryRowHighlight: {
    backgroundColor: '#000000',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginHorizontal: -12,
  },
  categoryTextLight: {
    color: '#ffffff',
  },
  arrowButtonDark: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  arrowButtonOuter: {
    borderRadius: 20,
    marginLeft: 8,
    shadowColor: '#b3f425',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  arrowButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  arrowButtonHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },

  // Request Category
  requestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  requestButtonText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textDark,
  },
})

export default MutualAidLandingScreen
