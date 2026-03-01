// My Groups Screen — matches Figma "MyGroupsLanding"
// Numbered list with green sidebar indicators, arrow buttons, COLLECTIVE logo header

import React, { useState, useCallback, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Image,
  RefreshControl,
  ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { colors } from '../../theme'
import { fonts } from '../../theme/typography'
import { useAuth } from '../../contexts/AuthContext'
import { useTabBar } from '../../contexts/TabBarContext'
import { getUserGroups } from '../../services/groupService'

const MAX_GROUPS = 50

const MyGroupsScreen = ({ navigation }) => {
  const { user, userProfile } = useAuth()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { showTabBar, hideTabBar, resetTimer } = useTabBar()
  const lastScrollY = useRef(0)

  // Build excluded user list from blocked (both directions)
  const blockedUsers = userProfile?.blockedUsers || []
  const blockedBy = userProfile?.blockedBy || []
  const blockedSet = [...new Set([...blockedUsers, ...blockedBy])]

  const fetchGroups = async () => {
    if (!user?.uid) return
    setLoading(true)
    const result = await getUserGroups(user.uid)
    if (result.success) {
      // Filter out groups created by blocked users
      const visibleGroups = result.data.filter((g) => !blockedSet.includes(g.creatorId))
      setGroups(visibleGroups)
    }
    setLoading(false)
  }

  useFocusEffect(
    useCallback(() => {
      fetchGroups()
      // Reset tab bar timer when screen is focused
      resetTimer()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  )

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchGroups()
    setRefreshing(false)
  }

  const handleScroll = (event) => {
    const currentScrollY = event.nativeEvent.contentOffset.y
    const contentHeight = event.nativeEvent.contentSize.height
    const layoutHeight = event.nativeEvent.layoutMeasurement.height
    const scrollDirection = currentScrollY > lastScrollY.current ? 'down' : 'up'

    const scrollableHeight = contentHeight - layoutHeight
    const scrollPercent = scrollableHeight > 0 ? currentScrollY / scrollableHeight : 0

    if (scrollDirection === 'down' && scrollPercent > 0.5) {
      hideTabBar()
    } else if (scrollDirection === 'up') {
      showTabBar()
    }

    lastScrollY.current = currentScrollY
  }

  const handleScrollBeginDrag = () => {
    showTabBar()
  }

  const formatGroupNumber = (index) => {
    return index.toString().padStart(2, '0')
  }

  const renderGroup = ({ item, index }) => (
    <View style={styles.groupRow}>
      {/* Green sidebar indicator */}
      <View style={styles.groupIndicator} />

      {/* Group content row */}
      <View style={styles.groupContent}>
        {/* Number */}
        <Text style={styles.groupNumber}>{formatGroupNumber(index)}</Text>

        {/* Name bar */}
        <View style={styles.groupNameBar}>
          <Text style={styles.groupName} numberOfLines={1}>
            {item.name || '------'}
          </Text>
        </View>

        {/* Arrow button */}
        <TouchableOpacity
          style={styles.arrowButton}
          onPress={() => {
            const parentNav = navigation.getParent() || navigation
            parentNav.navigate('GroupDetail', { groupId: item.id })
          }}
        >
          <Ionicons name="arrow-forward" size={20} color={colors.textDark} />
        </TouchableOpacity>
      </View>
    </View>
  )

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Main Container with green border */}
        <View style={styles.mainContainer}>
          {/* Logo inside container */}
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/images/green-logo.png')}
              style={styles.logoImage}
            />
          </View>

          {/* Back Arrow */}
          <TouchableOpacity
            style={styles.backArrowContainer}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="chevron-back" size={30} color={colors.textGreen} />
          </TouchableOpacity>

          {/* Title Row: "my groups" + "+Group" button */}
          <View style={styles.titleRow}>
            <Text style={styles.title}>my groups</Text>
            <TouchableOpacity
              style={[
                styles.newGroupButton,
                groups.length >= MAX_GROUPS && styles.newGroupButtonDisabled,
              ]}
              onPress={() => {
                if (groups.length >= MAX_GROUPS) {
                  return
                }
                const parentNav = navigation.getParent() || navigation
                parentNav.navigate('CreateGroup')
              }}
              disabled={groups.length >= MAX_GROUPS}
            >
              <Ionicons name="add" size={18} color={colors.textDark} />
              <Text style={styles.newGroupText}>Group</Text>
            </TouchableOpacity>
          </View>

          {/* Group Count */}
          <Text style={styles.groupCount}>
            {groups.length}/{MAX_GROUPS} groups
          </Text>

          {/* Groups List */}
          {loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Loading...</Text>
            </View>
          ) : groups.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No groups yet. Create one!</Text>
            </View>
          ) : (
            groups.map((item, index) => <View key={item.id}>{renderGroup({ item, index })}</View>)
          )}
        </View>
      </ScrollView>
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
    borderColor: colors.primary,
    padding: 16,
    minHeight: '90%',
  },

  // Back Arrow (matches ProfileScreen)
  backArrowContainer: {
    marginBottom: 16,
  },

  // Title Row
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
  },
  newGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.tertiary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    borderTopColor: '#B0ABAB',
    borderLeftColor: '#B0ABAB',
    borderBottomColor: '#EFEFEF',
    borderRightColor: '#EFEFEF',
  },
  newGroupText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textDark,
    marginLeft: 4,
  },
  newGroupButtonDisabled: {
    opacity: 0.4,
  },
  groupCount: {
    fontSize: 12,
    fontFamily: fonts.mono,
    color: colors.textSecondary,
    textAlign: 'right',
    marginBottom: 16,
    marginTop: -10,
  },

  // Group Row
  groupRow: {
    flexDirection: 'row',
    marginBottom: 14,
    alignItems: 'stretch',
  },
  groupIndicator: {
    width: 6,
    backgroundColor: colors.primary,
    borderRadius: 3,
    marginRight: 10,
  },
  groupContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupNumber: {
    fontSize: 13,
    fontFamily: fonts.mono,
    color: colors.primary,
    marginRight: 10,
    minWidth: 22,
  },
  groupNameBar: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
  },
  groupName: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textDark,
  },
  arrowButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },

  // Logo inside container
  logoContainer: {
    alignItems: 'flex-end',
    marginTop: 24,
  },
  logoImage: {
    width: 250,
    height: 250,
  },
})

export default MyGroupsScreen
