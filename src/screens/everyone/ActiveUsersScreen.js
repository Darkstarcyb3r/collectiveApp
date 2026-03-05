// Everyone Network Screen
// Grid of all users in the connected network (toggle ON)
// Green/gray dot on avatar indicates online/offline status
// Green border container matching ProfileScreen pattern

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import { colors } from '../../theme'
import { fonts } from '../../theme/typography'
import { useAuth } from '../../contexts/AuthContext'
import { subscribeToNetworkUsers } from '../../services/everyoneService'
import { buildConnectedUserIds } from '../../utils/networkGraph'
import DarkTabBar from '../../components/navigation/DarkTabBar'
import { playClick } from '../../services/soundService'


const ActiveUsersScreen = ({ navigation }) => {
  const { user, userProfile } = useAuth()
  const [allNetworkUsers, setAllNetworkUsers] = useState([])
  const [filter, setFilter] = useState('all') // 'all' | 'following' | 'followers'

  // Tab bar ref for scroll-based show/hide
  const tabBarRef = useRef(null)
  const lastScrollY = useRef(0)

  const handleScroll = useCallback((event) => {
    const currentY = event.nativeEvent.contentOffset.y
    if (currentY > lastScrollY.current && currentY > 20) {
      tabBarRef.current?.hide()
    }
    lastScrollY.current = currentY
  }, [])

  const handleScrollBeginDrag = useCallback(() => {
    tabBarRef.current?.show()
  }, [])

  const hiddenUsers = userProfile?.hiddenUsers || []
  const blockedUsers = userProfile?.blockedUsers || []
  const blockedBy = userProfile?.blockedBy || []
  const excludedUsers = [...new Set([...hiddenUsers, ...blockedUsers, ...blockedBy])]
  const myFollowingUsers = userProfile?.subscribedUsers || []
  const myUid = user?.uid

useEffect(() => {

  // Only navigate away if the feature is disabled
  if (userProfile?.everyoneNetworkEnabled === false) {
    navigation.goBack();
    return;
  }
  const unsubNetwork = subscribeToNetworkUsers((users) => {
    setAllNetworkUsers(users);
  });
  


  return () => {
    if (unsubNetwork) unsubNetwork();
  };
}, [userProfile?.everyoneNetworkEnabled, navigation]);

  // Build 2-degree connection graph using shared utility
  const connectedUserIds = buildConnectedUserIds(
    myUid,
    allNetworkUsers,
    excludedUsers,
    myFollowingUsers
  )

  // Show only users within 2 degrees of connection (no fallback to "show everyone")
  const visibleUsers = allNetworkUsers
    .filter((u) => !excludedUsers.includes(u.id))
    .filter((u) => u.id !== myUid && u.name)
    .filter((u) => connectedUserIds.has(u.id))

  // Apply filter
  const displayedUsers = filter === 'following'
    ? visibleUsers.filter((u) => myFollowingUsers.includes(u.id))
    : filter === 'followers'
      ? visibleUsers.filter((u) => (u.subscribedUsers || []).includes(myUid))
      : visibleUsers

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        scrollEventThrottle={16}
      >
        {/* Main Container with green border */}
        <View style={styles.mainContainer}>
          {/* Header Row */}
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ padding: 4 }}
            >
              <Ionicons name="chevron-back" size={28} color={colors.textGreen} />
            </TouchableOpacity>
            <Text style={styles.title}>My Collective Network</Text>
            <View style={{ width: 28 }} />
          </View>

          <Text style={styles.subheader}>
            a network of your personal connections that are up to a 2nd degree of separation from
            you
          </Text>

          {/* User Counter */}
          <View style={styles.userCounterRow}>
            <Text style={styles.userCounterText}>
              {displayedUsers.length.toString().padStart(8, '0')} users
            </Text>
          </View>

          {/* Filter Buttons */}
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={styles.filterButtonWrap}
              onPress={() => { playClick(); setFilter(filter === 'following' ? 'all' : 'following'); }}
            >
              <BlurView intensity={10} tint="dark" style={[styles.filterButton, filter === 'following' && styles.filterButtonActive]}>
                <View style={styles.filterButtonInner}>
                  <Ionicons name="people-outline" size={14} color={filter === 'following' ? colors.primary : '#ffffff'} />
                  <Text style={[styles.filterButtonText, filter === 'following' && styles.filterButtonTextActive]}>following</Text>
                </View>
              </BlurView>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.filterButtonWrap}
              onPress={() => { playClick(); setFilter(filter === 'followers' ? 'all' : 'followers'); }}
            >
              <BlurView intensity={10} tint="dark" style={[styles.filterButton, filter === 'followers' && styles.filterButtonActive]}>
                <View style={styles.filterButtonInner}>
                  <Ionicons name="person-add-outline" size={14} color={filter === 'followers' ? colors.primary : '#ffffff'} />
                  <Text style={[styles.filterButtonText, filter === 'followers' && styles.filterButtonTextActive]}>followers</Text>
                </View>
              </BlurView>
            </TouchableOpacity>
          </View>

          {/* Avatar Grid — 4 columns */}
          {displayedUsers.length === 0 ? (
            <View style={styles.emptyNetworkContainer}>
              <Ionicons name="people-outline" size={48} color="#888" />
              <Text style={styles.emptyNetworkText}>
                search your contacts{'\n'}to start connecting
              </Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {displayedUsers.map((user) => (
                <TouchableOpacity
                  key={user.id}
                  style={styles.avatarContainer}
                  onPress={() => navigation.navigate('UserProfile', { userId: user.id })}
                >
                  <View style={styles.avatarWrapper}>
                    {user.profilePhoto ? (
                      <Image
                        source={{ uri: user.profilePhoto, cache: 'reload' }}
                        style={styles.avatar}
                      />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Ionicons name="person" size={22} color="#666" />
                      </View>
                    )}
                    {/* Online/Offline indicator dot */}
                    <View
                      style={[
                        styles.statusDot,
                        user.isOnline ? styles.statusOnline : styles.statusOffline,
                      ]}
                    />
                  </View>
                  <Text style={styles.userName} numberOfLines={1}>
                    {user.name && user.name.length > 10
                      ? user.name.substring(0, 10) + '...'
                      : user.name || ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Dark Tab Bar with auto-hide */}
      <DarkTabBar ref={tabBarRef} />
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
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 120,
  },

  // Main Container with green border
  mainContainer: {
    backgroundColor: colors.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: 16,
    minHeight: '90%',
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    marginTop: 16,
  },
  title: {
    fontSize: 20,
    fontFamily: fonts.regular,
    color: colors.textGreen,
    textAlign: 'center',
  },

  //subheader
  subheader: {
    fontSize: 10,
    fontFamily: fonts.italic,
    color: colors.textGreen,
    textAlign: 'left',
    marginTop: -20,
    marginBottom: 20,
    marginRight: 15,
    marginLeft: 15,
  },

  // User Counter
  userCounterRow: {
    alignItems: 'center',
    marginBottom: 20,
  },
  userCounterText: {
    fontSize: 13,
    fontFamily: fonts.mono,
    color: colors.primary,
    letterSpacing: 2,
  },

  // Filter Buttons
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 28,
  },
  filterButtonWrap: {
    width: 140,
  },
  filterButton: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
    borderLeftColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomColor: 'rgba(255, 255, 255, 0.15)',
    borderRightColor: 'rgba(255, 255, 255, 0.1)',
  },
  filterButtonActive: {
    borderColor: colors.primary,
    borderTopColor: colors.primary,
    borderLeftColor: colors.primary,
    borderBottomColor: colors.primary,
    borderRightColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  filterButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    paddingVertical: 5,
    paddingHorizontal: 14,
    gap: 6,
  },
  filterButtonText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: '#ffffff',
  },
  filterButtonTextActive: {
    color: colors.primary,
  },

  // Avatar Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    width: '20%',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  avatarPlaceholder: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#a3a3a3',
    alignItems: 'center',
    justifyContent: 'center',
  },

  userName: {
    fontSize: 10,
    fontFamily: fonts.regular,
    color: '#888',
    marginTop: 4,
    textAlign: 'center',
  },

  // Online/Offline status dot
  statusDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.background,
  },
  statusOnline: {
    backgroundColor: '#00FF00',
  },
  statusOffline: {
    backgroundColor: '#666',
  },
  emptyNetworkContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyNetworkText: {
    fontSize: 13,
    fontFamily: fonts.italic,
    color: '#888',
    marginTop: 12,
    textAlign: 'center',
  },
})

export default ActiveUsersScreen