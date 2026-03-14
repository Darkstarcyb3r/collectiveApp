// FollowRequestsScreen.js - Incoming follow requests with Accept/Decline

import React, { useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useFocusEffect } from '@react-navigation/native'
import { colors } from '../../theme'
import { fonts } from '../../theme/typography'
import { playClick } from '../../services/soundService'
import { useAuth } from '../../contexts/AuthContext'
import { useTabBar } from '../../contexts/TabBarContext'
import DarkTabBar from '../../components/navigation/DarkTabBar'
import {
  subscribeToFollowRequests,
  acceptFollowRequest,
  declineFollowRequest,
} from '../../services/userService'

const FollowRequestsScreen = ({ navigation }) => {
  const { user, refreshUserProfile } = useAuth()
  const { showTabBar, hideTabBar, resetTimer } = useTabBar()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [processingIds, setProcessingIds] = useState(new Set())

  // Real-time listener for incoming follow requests
  useEffect(() => {
    if (!user?.uid) return
    const unsubscribe = subscribeToFollowRequests(user.uid, (data) => {
      setRequests(data)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [user?.uid])

  useFocusEffect(
    useCallback(() => {
      hideTabBar()
      return () => {}
    }, [hideTabBar])
  )

  const handleAccept = async (requesterId) => {
    if (!user?.uid) return
    playClick()
    setProcessingIds((prev) => new Set(prev).add(requesterId))
    const result = await acceptFollowRequest(user.uid, requesterId)
    if (result.success) {
      setRequests((prev) => prev.filter((r) => r.requesterId !== requesterId))
      await refreshUserProfile()
    }
    setProcessingIds((prev) => {
      const next = new Set(prev)
      next.delete(requesterId)
      return next
    })
  }

  const handleDecline = async (requesterId) => {
    if (!user?.uid) return
    playClick()
    setProcessingIds((prev) => new Set(prev).add(requesterId))
    const result = await declineFollowRequest(user.uid, requesterId)
    if (result.success) {
      setRequests((prev) => prev.filter((r) => r.requesterId !== requesterId))
    }
    setProcessingIds((prev) => {
      const next = new Set(prev)
      next.delete(requesterId)
      return next
    })
  }

  const renderRequest = ({ item }) => {
    const isProcessing = processingIds.has(item.requesterId)

    return (
      <View style={styles.requestRow}>
        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => {
            playClick()
            navigation.navigate('UserProfile', { userId: item.requesterId })
          }}
          activeOpacity={0.7}
        >
          {item.requesterPhoto ? (
            <Image
              source={{ uri: item.requesterPhoto, cache: 'reload' }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={22} color={colors.textSecondary} />
            </View>
          )}
          <Text style={styles.userName} numberOfLines={1}>
            {item.requesterName || 'Unknown'}
          </Text>
        </TouchableOpacity>

        <View style={styles.actionButtons}>
          {isProcessing ? (
            <ActivityIndicator size="small" color="#00FF00" />
          ) : (
            <>
              <TouchableOpacity
                style={styles.acceptButtonOuter}
                onPress={() => handleAccept(item.requesterId)}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={['#cafb6c', '#71f200', '#23ff0d']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.acceptButton}
                >
                  <Text style={styles.acceptText}>accept</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.declineButton}
                onPress={() => handleDecline(item.requesterId)}
                activeOpacity={0.7}
              >
                <Text style={styles.declineText}>decline</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => { playClick(); navigation.goBack() }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>follow requests</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={requests}
        renderItem={renderRequest}
        keyExtractor={(item) => item.requesterId}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {loading ? 'Loading...' : 'no pending follow requests'}
            </Text>
          </View>
        }
      />

      <DarkTabBar navigation={navigation} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 100,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#222222',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 9999,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 9999,
    backgroundColor: colors.backgroundCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: '#FFFFFF',
    marginLeft: 12,
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  acceptButtonOuter: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  acceptButton: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 16,
  },
  acceptText: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: colors.textDark,
  },
  declineButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#333333',
  },
  declineText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: '#999999',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: '#666666',
  },
})

export default FollowRequestsScreen
