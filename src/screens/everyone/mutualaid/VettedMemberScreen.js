// Vetted Member Screen
// Grid of users who have vetted a mutual aid group
// Same layout as ActiveUsersScreen but light background

import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../../theme'
import { fonts } from '../../../theme/typography'
import { useAuth } from '../../../contexts/AuthContext'
import { getVettedMembers } from '../../../services/everyoneService'
import LightTabBar from '../../../components/navigation/LightTabBar'
import { playClick } from '../../../services/soundService'

const VettedMemberScreen = ({ route, navigation }) => {
  const { groupId } = route.params
  const { userProfile } = useAuth()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const lightTabRef = useRef(null)
  const lastScrollY = useRef(0)

  // Build excluded user list from hidden/blocked
  const hiddenUsers = userProfile?.hiddenUsers || []
  const blockedUsers = userProfile?.blockedUsers || []
  const blockedBy = userProfile?.blockedBy || []
  const excludedUsers = [...new Set([...hiddenUsers, ...blockedUsers, ...blockedBy])]

  useEffect(() => {
    const fetchMembers = async () => {
      const result = await getVettedMembers(groupId)
      if (result.success) {
        setMembers(result.data.filter((m) => !excludedUsers.includes(m.id)))
      }
      setLoading(false)
    }
    fetchMembers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId])

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
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ padding: 4 }}
            >
              <Ionicons name="chevron-back" size={24} color={colors.textDark} />
            </TouchableOpacity>
            <Text style={styles.title}>Vetted by...</Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Avatar Grid */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : members.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No one has vetted this group yet.</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {members.map((member) => (
                <TouchableOpacity
                  key={member.id}
                  style={styles.avatarContainer}
                  onPress={() => navigation.navigate('UserProfile', { userId: member.id })}
                >
                  {member.profilePhoto ? (
                    <Image
                      source={{ uri: member.profilePhoto, cache: 'reload' }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Ionicons name="person" size={28} color="#666" />
                    </View>
                  )}
                  <Text style={styles.memberName} numberOfLines={1}>
                    {member.name || 'User'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    backgroundColor: colors.secondary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
  },
  title: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.textDark,
  },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  avatarContainer: {
    width: '25%',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginBottom: 6,
  },
  avatarPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#a3a3a3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  memberName: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textDark,
    textAlign: 'center',
    maxWidth: 90,
  },

  // Loading / Empty
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    fontFamily: fonts.italic,
    color: colors.offline,
  },
})

export default VettedMemberScreen
