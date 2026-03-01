// User Service - Using Firebase Compat mode
// Handles user profile operations

import { db, firebase } from '../config/firebase'
import { signedUpload } from '../utils/cloudinaryUpload'

// Get user profile by ID
export const getUserProfile = async (userId) => {
  try {
    const userDoc = await db.collection('users').doc(userId).get()
    if (userDoc.exists) {
      return { success: true, data: userDoc.data() }
    }
    return { success: false, error: 'User not found' }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Update user profile
export const updateUserProfile = async (userId, updates) => {
  try {
    await db
      .collection('users')
      .doc(userId)
      .update({
        ...updates,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Setup initial profile (after signup)
export const setupProfile = async (
  userId,
  name,
  phoneNumber,
  profilePhotoUri,
  isPrivate = false,
  photoMeta = {}
) => {
  try {
    let profilePhoto = null

    // Upload profile photo if provided
    if (profilePhotoUri) {
      const uploadResult = await uploadProfilePhoto(userId, profilePhotoUri, photoMeta)
      if (uploadResult.success) {
        profilePhoto = uploadResult.url
      }
    }

    const updateData = {
      name: name,
      profilePhoto: profilePhoto,
      profileSetup: true,
      isPrivate: isPrivate,
      everyoneNetworkEnabled: true,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }

    // Only update phoneNumber if explicitly provided (preserves the one from signup)
    if (phoneNumber) {
      updateData.phoneNumber = phoneNumber
    }

    await db.collection('users').doc(userId).update(updateData)

    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Upload profile photo to Cloudinary (signed)
export const uploadProfilePhoto = async (userId, photoUri, metadata = {}) => {
  return signedUpload(photoUri, `collective/users/${userId}`, `profile_${userId}`, metadata)
}

// Update quip (status)
export const updateQuip = async (userId, quip) => {
  try {
    await db.collection('users').doc(userId).update({
      quip: quip,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Follow a user
export const followUser = async (currentUserId, targetUserId, _followerName) => {
  try {
    await db
      .collection('users')
      .doc(currentUserId)
      .update({
        subscribedUsers: firebase.firestore.FieldValue.arrayUnion(targetUserId),
      })

    // Notification handled server-side by onFollowChange Cloud Function

    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Unfollow a user — also clean up notification preferences
export const unfollowUser = async (currentUserId, targetUserId) => {
  try {
    await db
      .collection('users')
      .doc(currentUserId)
      .update({
        subscribedUsers: firebase.firestore.FieldValue.arrayRemove(targetUserId),
        [`subscriptionPreferences.${targetUserId}`]: firebase.firestore.FieldValue.delete(),
      })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Update subscription notification preferences for a specific user
export const updateSubscriptionPreferences = async (currentUserId, targetUserId, preferences) => {
  try {
    await db
      .collection('users')
      .doc(currentUserId)
      .update({
        [`subscriptionPreferences.${targetUserId}`]: preferences,
      })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Hide user
export const hideUser = async (currentUserId, targetUserId) => {
  try {
    await db
      .collection('users')
      .doc(currentUserId)
      .update({
        hiddenUsers: firebase.firestore.FieldValue.arrayUnion(targetUserId),
      })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Unhide user
export const unhideUser = async (currentUserId, targetUserId) => {
  try {
    await db
      .collection('users')
      .doc(currentUserId)
      .update({
        hiddenUsers: firebase.firestore.FieldValue.arrayRemove(targetUserId),
      })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Block user — two-way: severs all follow/following connections both directions
export const blockUser = async (currentUserId, targetUserId) => {
  try {
    const batch = db.batch()

    // Update the blocking user's document
    const currentUserRef = db.collection('users').doc(currentUserId)
    batch.update(currentUserRef, {
      blockedUsers: firebase.firestore.FieldValue.arrayUnion(targetUserId),
      subscribedUsers: firebase.firestore.FieldValue.arrayRemove(targetUserId),
      hiddenUsers: firebase.firestore.FieldValue.arrayRemove(targetUserId),
    })

    // Update the blocked user's document — mark as blockedBy and remove follows both ways
    const targetUserRef = db.collection('users').doc(targetUserId)
    batch.update(targetUserRef, {
      blockedBy: firebase.firestore.FieldValue.arrayUnion(currentUserId),
      subscribedUsers: firebase.firestore.FieldValue.arrayRemove(currentUserId),
    })

    await batch.commit()

    // Clean up follow preferences for the current user (own doc — always allowed)
    try {
      await currentUserRef.update({
        [`subscriptionPreferences.${targetUserId}`]: firebase.firestore.FieldValue.delete(),
      })
    } catch (_e) {
      /* preferences field may not exist yet */
    }
    // Note: target user's subscriptionPreferences are left as-is
    // (stale data is harmless, and cross-user writes are restricted to blockedBy/subscribedUsers/groups)

    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Unblock user — removes from both directions
export const unblockUser = async (currentUserId, targetUserId) => {
  try {
    const batch = db.batch()

    const currentUserRef = db.collection('users').doc(currentUserId)
    batch.update(currentUserRef, {
      blockedUsers: firebase.firestore.FieldValue.arrayRemove(targetUserId),
    })

    const targetUserRef = db.collection('users').doc(targetUserId)
    batch.update(targetUserRef, {
      blockedBy: firebase.firestore.FieldValue.arrayRemove(currentUserId),
    })

    await batch.commit()
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Get users you are following
export const getFollowingUsers = async (userId) => {
  try {
    const userDoc = await db.collection('users').doc(userId).get()
    if (userDoc.exists) {
      const followingIds = userDoc.data().subscribedUsers || []
      if (followingIds.length === 0) return { success: true, data: [] }

      const users = await Promise.all(
        followingIds.map(async (id) => {
          const userProfile = await db.collection('users').doc(id).get()
          return userProfile.exists ? { id, ...userProfile.data() } : null
        })
      )

      return { success: true, data: users.filter(Boolean) }
    }
    return { success: false, error: 'User not found' }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Get hidden users
export const getHiddenUsers = async (userId) => {
  try {
    const userDoc = await db.collection('users').doc(userId).get()
    if (userDoc.exists) {
      const hiddenIds = userDoc.data().hiddenUsers || []
      if (hiddenIds.length === 0) return { success: true, data: [] }

      const users = await Promise.all(
        hiddenIds.map(async (id) => {
          const userProfile = await db.collection('users').doc(id).get()
          return userProfile.exists ? { id, ...userProfile.data() } : null
        })
      )

      return { success: true, data: users.filter(Boolean) }
    }
    return { success: false, error: 'User not found' }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Get blocked users
export const getBlockedUsers = async (userId) => {
  try {
    const userDoc = await db.collection('users').doc(userId).get()
    if (userDoc.exists) {
      const blockedIds = userDoc.data().blockedUsers || []
      if (blockedIds.length === 0) return { success: true, data: [] }

      const users = await Promise.all(
        blockedIds.map(async (id) => {
          const userProfile = await db.collection('users').doc(id).get()
          return userProfile.exists ? { id, ...userProfile.data() } : null
        })
      )

      return { success: true, data: users.filter(Boolean) }
    }
    return { success: false, error: 'User not found' }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Get users who follow you (your followers)
export const getFollowers = async (userId) => {
  try {
    const querySnapshot = await db
      .collection('users')
      .where('subscribedUsers', 'array-contains', userId)
      .get()

    const users = []
    querySnapshot.forEach((doc) => {
      if (doc.id !== userId) {
        users.push({ id: doc.id, ...doc.data() })
      }
    })

    return { success: true, data: users }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Remove a follower (remove your userId from their subscribedUsers)
export const removeFollower = async (currentUserId, followerUserId) => {
  try {
    // Only update subscribedUsers — security rules only allow non-owners
    // to modify blockedBy, subscribedUsers, and groups on another user's doc
    await db
      .collection('users')
      .doc(followerUserId)
      .update({
        subscribedUsers: firebase.firestore.FieldValue.arrayRemove(currentUserId),
      })
    return { success: true }
  } catch (error) {
    console.error('removeFollower error:', error)
    return { success: false, error: error.message }
  }
}

// Search users by name
export const searchUsers = async (searchQuery, currentUserId) => {
  try {
    const currentUserDoc = await db.collection('users').doc(currentUserId).get()
    const currentUserData = currentUserDoc.exists ? currentUserDoc.data() : {}
    const blockedUsers = currentUserData.blockedUsers || []
    const blockedBy = currentUserData.blockedBy || []
    const excludedUsers = [...new Set([...blockedUsers, ...blockedBy])]

    // Try with orderBy first (requires composite index: profileSetup + name)
    let querySnapshot
    try {
      querySnapshot = await db
        .collection('users')
        .where('profileSetup', '==', true)
        .orderBy('name')
        .limit(50)
        .get()
    } catch (_indexError) {
      // Composite index missing — fallback to query without orderBy
      querySnapshot = await db.collection('users').where('profileSetup', '==', true).limit(50).get()
    }

    const queryLower = searchQuery.toLowerCase()
    const queryDigits = searchQuery.replace(/\D/g, '')
    const users = []
    querySnapshot.forEach((doc) => {
      const userData = doc.data()
      if (
        doc.id !== currentUserId &&
        !excludedUsers.includes(doc.id) &&
        ((userData.name && userData.name.toLowerCase().includes(queryLower)) ||
          (queryDigits.length >= 3 &&
            userData.phoneNumber &&
            userData.phoneNumber.includes(queryDigits)))
      ) {
        users.push({ id: doc.id, ...userData })
      }
    })

    // Sort alphabetically by name (client-side)
    users.sort((a, b) => (a.name || '').localeCompare(b.name || ''))

    return { success: true, data: users }
  } catch (error) {
    console.log('🔴 searchUsers error:', error.message)
    return { success: false, error: error.message }
  }
}

// Normalize a phone number to 10 digits (strips country code, spaces, dashes, etc.)
const normalizePhone = (phone) => {
  let digits = phone.replace(/\D/g, '')
  // If 11 digits and starts with 1 (US country code), strip it
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1)
  }
  return digits
}

// Search for a user by phone number
export const searchUserByPhone = async (phoneNumber) => {
  try {
    const normalized = normalizePhone(phoneNumber)
    if (!normalized) {
      return { success: false, error: 'No phone number provided' }
    }

    // Try exact match first (10-digit format)
    let querySnapshot = await db
      .collection('users')
      .where('phoneNumber', '==', normalized)
      .limit(1)
      .get()

    // If no match, try with country code in case DB stored it that way
    if (querySnapshot.empty) {
      querySnapshot = await db
        .collection('users')
        .where('phoneNumber', '==', '1' + normalized)
        .limit(1)
        .get()
    }

    if (querySnapshot.empty) {
      return { success: true, data: null }
    }

    const doc = querySnapshot.docs[0]
    return { success: true, data: { id: doc.id, ...doc.data() } }
  } catch (error) {
    console.log('🔴 searchUserByPhone error:', error.message)
    return { success: false, error: error.message }
  }
}

// Get total user count
export const getTotalUserCount = async () => {
  try {
    const querySnapshot = await db.collection('users').where('profileSetup', '==', true).get()
    return { success: true, count: querySnapshot.size }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Toggle everyone network participation
export const toggleEveryoneNetwork = async (userId, enabled) => {
  try {
    await db.collection('users').doc(userId).update({
      everyoneNetworkEnabled: enabled,
    })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Report/flag a user
export const reportUser = async (reporterId, reportedUserId, reason, details = '') => {
  try {
    await db.collection('reports').add({
      reporterId,
      reportedUserId,
      reason,
      details,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'pending',
    })
    return { success: true }
  } catch (error) {
    console.log('🔴 reportUser error:', error.message)
    return { success: false, error: error.message }
  }
}

// Check if a pending report already exists from this reporter for this user
// Resolved reports (status !== 'pending') don't block new reports
export const checkExistingReport = async (reporterId, reportedUserId) => {
  try {
    const snapshot = await db
      .collection('reports')
      .where('reporterId', '==', reporterId)
      .where('reportedUserId', '==', reportedUserId)
      .where('status', '==', 'pending')
      .limit(1)
      .get()
    return { success: true, exists: !snapshot.empty }
  } catch (error) {
    console.log('🔴 checkExistingReport error:', error.message)
    return { success: false, exists: false }
  }
}

// Register admin push token in the adminTokens collection
// Called on login if the user has isAdmin: true on their Firestore doc
// Set the user's active screen (suppresses notifications for that chat/room)
// screenType: 'conversation' | 'cyberlounge' | null
// screenId: conversationId or roomId
export const setActiveScreen = async (userId, screenType, screenId) => {
  try {
    if (!userId) return
    await db
      .collection('users')
      .doc(userId)
      .update({
        activeScreen: { type: screenType, id: screenId },
      })
  } catch (error) {
    console.log('🔴 setActiveScreen error:', error.message)
  }
}

// Clear the user's active screen (re-enables notifications)
export const clearActiveScreen = async (userId) => {
  try {
    if (!userId) return
    await db.collection('users').doc(userId).update({
      activeScreen: firebase.firestore.FieldValue.delete(),
    })
  } catch (error) {
    console.log('🔴 clearActiveScreen error:', error.message)
  }
}

export const registerAdminToken = async (userId, pushToken) => {
  try {
    if (!userId || !pushToken) return
    await db.collection('adminTokens').doc(userId).set(
      {
        userId,
        pushToken,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
  } catch (error) {
    console.log('🔴 registerAdminToken error:', error.message)
  }
}

export default {
  getUserProfile,
  updateUserProfile,
  setupProfile,
  uploadProfilePhoto,
  updateQuip,
  followUser,
  unfollowUser,
  hideUser,
  unhideUser,
  blockUser,
  unblockUser,
  getFollowingUsers,
  getFollowers,
  getHiddenUsers,
  getBlockedUsers,
  searchUsers,
  searchUserByPhone,
  getTotalUserCount,
  toggleEveryoneNetwork,
  reportUser,
  checkExistingReport,
  registerAdminToken,
  setActiveScreen,
  clearActiveScreen,
}
