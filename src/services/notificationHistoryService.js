// Notification History Service
// Persists notifications to Firestore subcollection: users/{userId}/notifications
// Provides real-time subscription, mark-as-read, and delete functionality

import { firestore } from '../config/firebase'

// Subscribe to real-time notifications for a user
// Returns unsubscribe function
export const subscribeToNotifications = (userId, callback) => {
  if (!userId) {
    callback([])
    return () => {}
  }

  return firestore()
    .collection('users')
    .doc(userId)
    .collection('notifications')
    .orderBy('createdAt', 'desc')
    .limit(50)
    .onSnapshot(
      (snapshot) => {
        const notifications = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        callback(notifications)
      },
      (error) => {
        console.log('📋 Notification subscription error:', error.message)
        callback([])
      }
    )
}

// Mark all unread notifications as read (batch write)
export const markAllNotificationsRead = async (userId) => {
  try {
    if (!userId) return

    const snapshot = await firestore()
      .collection('users')
      .doc(userId)
      .collection('notifications')
      .where('read', '==', false)
      .get()

    if (snapshot.empty) return

    const batch = firestore().batch()
    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { read: true })
    })
    await batch.commit()
  } catch (error) {
    console.log('📋 Mark notifications read error:', error.message)
  }
}

// Delete a single notification
export const deleteNotification = async (userId, notificationId) => {
  try {
    if (!userId || !notificationId) return { success: false }

    await firestore()
      .collection('users')
      .doc(userId)
      .collection('notifications')
      .doc(notificationId)
      .delete()
    return { success: true }
  } catch (error) {
    console.log('📋 Delete notification error:', error.message)
    return { success: false, error: error.message }
  }
}
