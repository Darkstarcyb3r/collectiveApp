// Root Navigator
// Handles switching between Auth and Main navigators

import React, { useRef, useEffect } from 'react'
import { NavigationContainer, DarkTheme } from '@react-navigation/native'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { useAuth } from '../contexts/AuthContext'
import AuthNavigator from './AuthNavigator'
import MainNavigator from './MainNavigator'
import { colors } from '../theme'
import { TabBarProvider } from '../contexts/TabBarContext'
import {
  addNotificationResponseListener,
  addNotificationReceivedListener,
} from '../services/notificationService'

const RootNavigator = () => {
  const { user, loading, isProfileSetup, isEmailVerified, isAddFriendsComplete } = useAuth()
  const navigationRef = useRef(null)
  const notificationListener = useRef()
  const responseListener = useRef()

  // Handle notification taps — navigate to Chat screen
  useEffect(() => {
    // Listen for notifications received while app is in foreground
    notificationListener.current = addNotificationReceivedListener((_notification) => {})

    // Listen for notification taps (user tapped on the notification)
    responseListener.current = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data

      if (data?.type === 'message' && data?.conversationId && navigationRef.current) {
        // Navigate to the chat screen
        navigationRef.current.navigate('Chat', {
          conversationId: data.conversationId,
          otherUserId: data.senderId,
        })
      } else if (data?.type === 'group_invite' && data?.conversationId && navigationRef.current) {
        // Navigate to the chat screen where the group invitation message lives
        navigationRef.current.navigate('Chat', {
          conversationId: data.conversationId,
          otherUserId: data.senderId,
        })
      } else if (
        data?.type === 'chatroom_invite' &&
        data?.conversationId &&
        navigationRef.current
      ) {
        // Navigate to the chat screen where the chatroom invitation message lives
        navigationRef.current.navigate('Chat', {
          conversationId: data.conversationId,
          otherUserId: data.senderId,
        })
      } else if (data?.type === 'cyberlounge_room' && data?.roomId && navigationRef.current) {
        // Navigate to the Cyberlounge room when tapping "X started a chatroom!" notification
        navigationRef.current.navigate('CyberLoungeDetail', {
          roomId: data.roomId,
        })
      } else if (data?.type === 'follower' && data?.followerId && navigationRef.current) {
        // Navigate to the follower's profile
        navigationRef.current.navigate('UserProfile', {
          userId: data.followerId,
        })
      } else if (data?.type === 'subscriber' && data?.subscriberId && navigationRef.current) {
        // Legacy: Navigate to the subscriber's profile
        navigationRef.current.navigate('UserProfile', {
          userId: data.subscriberId,
        })
      } else if (data?.type === 'mutualAidGroup' && data?.groupId && navigationRef.current) {
        // Navigate to the mutual aid post when tapping notification
        navigationRef.current.navigate('MutualAidPost', {
          groupId: data.groupId,
        })
      } else if (data?.type === 'follow_request' && navigationRef.current) {
        // Navigate to follow requests screen
        navigationRef.current.navigate('FollowRequests')
      } else if (data?.type === 'follow_request_accepted' && data?.accepterId && navigationRef.current) {
        // Navigate to the user who accepted the follow request
        navigationRef.current.navigate('UserProfile', {
          userId: data.accepterId,
        })
      }
    })

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove()
      }
      if (responseListener.current) {
        responseListener.current.remove()
      }
    }
  }, [])

  // Show loading screen while checking auth state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <NavigationContainer ref={navigationRef} theme={DarkTheme}>
      {user ? (
        isEmailVerified && isProfileSetup && isAddFriendsComplete ? (
          <TabBarProvider>
            <MainNavigator />
          </TabBarProvider>
        ) : (
          // User is logged in but hasn't completed all setup steps
          <AuthNavigator />
        )
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

export default RootNavigator
