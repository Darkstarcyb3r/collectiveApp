// Notification Service - Expo Notifications
// Works in both Expo Go and production builds
// Note: setNotificationHandler is configured in App.js to ensure it runs first
//
// SECURITY: All notification sending (push + history) is handled server-side
// by Cloud Functions. This file only handles device registration and listeners.

import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { db, firebase } from '../config/firebase'

// Register for push notifications and save token to Firestore
export const registerForPushNotifications = async (userId) => {
  try {
    // Push tokens only work on physical devices
    if (!Device.isDevice) {
      return null
    }

    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus

    // Request permissions if not granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }

    if (finalStatus !== 'granted') {
      return null
    }

    // Android-specific notification channel (must be set before getting token)
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Messages',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
      })
    }

    // Try to get push token — attempt multiple strategies
    let pushToken = null

    // Strategy 1: Use EAS projectId if available (production builds)
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId

    if (projectId) {
      try {
        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId })
        pushToken = tokenData.data
      } catch (_err) {}
    }

    // Strategy 2: Try without projectId (works in Expo Go with experienceId)
    if (!pushToken) {
      try {
        const tokenData = await Notifications.getExpoPushTokenAsync()
        pushToken = tokenData.data
      } catch (_err) {}
    }

    // Strategy 3: Try with slug-based experienceId for Expo Go
    if (!pushToken) {
      try {
        const slug = Constants.expoConfig?.slug || Constants.manifest?.slug
        const owner = Constants.expoConfig?.owner || Constants.manifest?.owner
        if (slug) {
          const experienceId = owner ? `@${owner}/${slug}` : `@anonymous/${slug}`
          const tokenData = await Notifications.getExpoPushTokenAsync({
            experienceId,
          })
          pushToken = tokenData.data
        }
      } catch (_err) {}
    }

    if (!pushToken) {
      return null
    }

    // Save token to private subcollection (not readable by other users).
    // Cloud Functions read from this subcollection using admin SDK.
    if (userId && pushToken) {
      await db.collection('users').doc(userId).collection('private').doc('tokens').set(
        {
          pushToken: pushToken,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
    }

    return pushToken
  } catch (error) {
    console.log('🔴 Error registering for push notifications:', error.message)
    return null
  }
}

// Add a listener for notification responses (when user taps notification)
export const addNotificationResponseListener = (callback) => {
  return Notifications.addNotificationResponseReceivedListener(callback)
}

// Add a listener for received notifications (foreground)
export const addNotificationReceivedListener = (callback) => {
  return Notifications.addNotificationReceivedListener(callback)
}

export default {
  registerForPushNotifications,
  addNotificationResponseListener,
  addNotificationReceivedListener,
}
