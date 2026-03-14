// User Service - Using @react-native-firebase
// Handles user profile operations

import { firestore } from '../config/firebase'
import { signedUpload } from '../utils/cloudinaryUpload'

// Get user profile by ID
export const getUserProfile = async (userId) => {
  try {
    const userDoc = await firestore().collection('users').doc(userId).get()
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
    await firestore()
      .collection('users')
      .doc(userId)
      .update({
        ...updates,
        updatedAt: firestore.FieldValue.serverTimestamp(),
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
      updatedAt: firestore.FieldValue.serverTimestamp(),
    }

    // Only update phoneNumber if explicitly provided (preserves the one from signup)
    if (phoneNumber) {
      updateData.phoneNumber = phoneNumber
    }

    await firestore().collection('users').doc(userId).update(updateData)

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
    await firestore().collection('users').doc(userId).update({
      quip: quip,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Follow a user — checks privacy setting first
export const followUser = async (currentUserId, targetUserId, followerName, followerPhoto) => {
  try {
    // Check if target user has a private profile
    const targetDoc = await firestore().collection('users').doc(targetUserId).get()
    if (targetDoc.exists && targetDoc.data().isPrivate === true) {
      // Private profile — send a follow request instead
      return await sendFollowRequest(currentUserId, targetUserId, followerName, followerPhoto)
    }

    // Public profile — immediate follow
    await firestore()
      .collection('users')
      .doc(currentUserId)
      .update({
        subscribedUsers: firestore.FieldValue.arrayUnion(targetUserId),
      })

    // Notification handled server-side by onFollowChange Cloud Function

    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Send a follow request to a private user
export const sendFollowRequest = async (currentUserId, targetUserId, requesterName, requesterPhoto) => {
  try {
    const requestId = `${currentUserId}_${targetUserId}`
    await firestore()
      .collection('followRequests')
      .doc(requestId)
      .set({
        requesterId: currentUserId,
        targetUserId: targetUserId,
        requesterName: requesterName || 'Someone',
        requesterPhoto: requesterPhoto || null,
        status: 'pending',
        createdAt: firestore.FieldValue.serverTimestamp(),
      })
    return { success: true, requested: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Cancel a pending follow request (requester side)
export const cancelFollowRequest = async (currentUserId, targetUserId) => {
  try {
    const requestId = `${currentUserId}_${targetUserId}`
    await firestore().collection('followRequests').doc(requestId).delete()
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Accept a follow request (target side)
export const acceptFollowRequest = async (currentUserId, requesterId) => {
  try {
    const requestId = `${requesterId}_${currentUserId}`
    // Add currentUserId to requester's subscribedUsers + initialize default notif prefs
    const defaultPrefs = {
      groupPosts: true,
      hostedChats: true,
      events: true,
      barterMarketPosts: true,
      mutualAidPosts: true,
    }
    await firestore()
      .collection('users')
      .doc(requesterId)
      .update({
        subscribedUsers: firestore.FieldValue.arrayUnion(currentUserId),
        [`subscriptionPreferences.${currentUserId}`]: defaultPrefs,
      })
    // Delete the follow request doc
    await firestore().collection('followRequests').doc(requestId).delete()
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Decline a follow request (target side)
export const declineFollowRequest = async (currentUserId, requesterId) => {
  try {
    const requestId = `${requesterId}_${currentUserId}`
    await firestore().collection('followRequests').doc(requestId).delete()
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Check if a pending follow request exists
export const checkPendingFollowRequest = async (currentUserId, targetUserId) => {
  try {
    const requestId = `${currentUserId}_${targetUserId}`
    const doc = await firestore().collection('followRequests').doc(requestId).get()
    return { success: true, pending: doc.exists }
  } catch (error) {
    return { success: false, pending: false }
  }
}

// Get all incoming follow requests
export const getIncomingFollowRequests = async (userId) => {
  try {
    const snapshot = await firestore()
      .collection('followRequests')
      .where('targetUserId', '==', userId)
      .get()
    const requests = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    return { success: true, data: requests }
  } catch (error) {
    return { success: false, data: [], error: error.message }
  }
}

// Real-time listener for incoming follow requests
export const subscribeToFollowRequests = (userId, callback) => {
  if (!userId) {
    callback([])
    return () => {}
  }
  return firestore()
    .collection('followRequests')
    .where('targetUserId', '==', userId)
    .onSnapshot(
      (snapshot) => {
        const requests = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        callback(requests)
      },
      () => callback([])
    )
}

// Toggle private profile setting
export const togglePrivateProfile = async (userId, isPrivate) => {
  try {
    await firestore().collection('users').doc(userId).update({ isPrivate })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Unfollow a user — also clean up notification preferences
export const unfollowUser = async (currentUserId, targetUserId) => {
  try {
    await firestore()
      .collection('users')
      .doc(currentUserId)
      .update({
        subscribedUsers: firestore.FieldValue.arrayRemove(targetUserId),
        [`subscriptionPreferences.${targetUserId}`]: firestore.FieldValue.delete(),
      })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Update subscription notification preferences for a specific user
export const updateSubscriptionPreferences = async (currentUserId, targetUserId, preferences) => {
  try {
    await firestore()
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
    await firestore()
      .collection('users')
      .doc(currentUserId)
      .update({
        hiddenUsers: firestore.FieldValue.arrayUnion(targetUserId),
      })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Unhide user
export const unhideUser = async (currentUserId, targetUserId) => {
  try {
    await firestore()
      .collection('users')
      .doc(currentUserId)
      .update({
        hiddenUsers: firestore.FieldValue.arrayRemove(targetUserId),
      })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Block user — two-way: severs all follow/following connections both directions
export const blockUser = async (currentUserId, targetUserId) => {
  try {
    const batch = firestore().batch()

    // Update the blocking user's document
    const currentUserRef = firestore().collection('users').doc(currentUserId)
    batch.update(currentUserRef, {
      blockedUsers: firestore.FieldValue.arrayUnion(targetUserId),
      subscribedUsers: firestore.FieldValue.arrayRemove(targetUserId),
      hiddenUsers: firestore.FieldValue.arrayRemove(targetUserId),
    })

    // Update the blocked user's document — mark as blockedBy and remove follows both ways
    const targetUserRef = firestore().collection('users').doc(targetUserId)
    batch.update(targetUserRef, {
      blockedBy: firestore.FieldValue.arrayUnion(currentUserId),
      subscribedUsers: firestore.FieldValue.arrayRemove(currentUserId),
    })

    await batch.commit()

    // Clean up follow preferences for the current user (own doc — always allowed)
    try {
      await currentUserRef.update({
        [`subscriptionPreferences.${targetUserId}`]: firestore.FieldValue.delete(),
      })
    } catch (_e) {
      /* preferences field may not exist yet */
    }
    // Note: target user's subscriptionPreferences are left as-is
    // (stale data is harmless, and cross-user writes are restricted to blockedBy/subscribedUsers/groups)

    // Clean up any pending follow requests in both directions
    try {
      await firestore().collection('followRequests').doc(`${currentUserId}_${targetUserId}`).delete()
    } catch (_e) { /* may not exist */ }
    try {
      await firestore().collection('followRequests').doc(`${targetUserId}_${currentUserId}`).delete()
    } catch (_e) { /* may not exist */ }

    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Unblock user — removes from both directions
export const unblockUser = async (currentUserId, targetUserId) => {
  try {
    const batch = firestore().batch()

    const currentUserRef = firestore().collection('users').doc(currentUserId)
    batch.update(currentUserRef, {
      blockedUsers: firestore.FieldValue.arrayRemove(targetUserId),
    })

    const targetUserRef = firestore().collection('users').doc(targetUserId)
    batch.update(targetUserRef, {
      blockedBy: firestore.FieldValue.arrayRemove(currentUserId),
    })

    await batch.commit()
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Helper: fetch user profiles by IDs, auto-clean stale (deleted) IDs from the source array
const fetchAndCleanUserList = async (userId, fieldName) => {
  try {
    const userDoc = await firestore().collection('users').doc(userId).get()
    if (!userDoc.exists) return { success: false, error: 'User not found' }

    const ids = userDoc.data()[fieldName] || []
    if (ids.length === 0) return { success: true, data: [] }

    const results = await Promise.all(
      ids.map(async (id) => {
        const profile = await firestore().collection('users').doc(id).get()
        if (!profile.exists) return { id, _gone: true }
        const data = profile.data()
        if (!data || !data.name) return { id, _hidden: true }
        return { id, ...data }
      })
    )

    const validUsers = results.filter((u) => !u._gone && !u._hidden)
    const goneIds = results.filter((u) => u._gone).map((u) => u.id)

    // Only auto-remove IDs whose Firestore doc is fully deleted — safe cleanup
    if (goneIds.length > 0) {
      firestore().collection('users').doc(userId).update({
        [fieldName]: firestore.FieldValue.arrayRemove(...goneIds),
      }).catch(() => {})

      if (fieldName === 'subscribedUsers') {
        const prefUpdates = {}
        goneIds.forEach((id) => { prefUpdates[`subscriptionPreferences.${id}`] = firestore.FieldValue.delete() })
        firestore().collection('users').doc(userId).update(prefUpdates).catch(() => {})
      }
    }

    return { success: true, data: validUsers }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Get users you are following
export const getFollowingUsers = async (userId) => {
  return fetchAndCleanUserList(userId, 'subscribedUsers')
}

// Get hidden users
export const getHiddenUsers = async (userId) => {
  return fetchAndCleanUserList(userId, 'hiddenUsers')
}

// Get blocked users
export const getBlockedUsers = async (userId) => {
  return fetchAndCleanUserList(userId, 'blockedUsers')
}

// Get users who follow you (your followers)
export const getFollowers = async (userId) => {
  try {
    const querySnapshot = await firestore()
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
    await firestore()
      .collection('users')
      .doc(followerUserId)
      .update({
        subscribedUsers: firestore.FieldValue.arrayRemove(currentUserId),
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
    const currentUserDoc = await firestore().collection('users').doc(currentUserId).get()
    const currentUserData = currentUserDoc.exists ? currentUserDoc.data() : {}
    const blockedUsers = currentUserData.blockedUsers || []
    const blockedBy = currentUserData.blockedBy || []
    const excludedUsers = [...new Set([...blockedUsers, ...blockedBy])]

    // Try with orderBy first (requires composite index: profileSetup + name)
    let querySnapshot
    try {
      querySnapshot = await firestore()
        .collection('users')
        .where('profileSetup', '==', true)
        .orderBy('name')
        .limit(50)
        .get()
    } catch (_indexError) {
      // Composite index missing — fallback to query without orderBy
      querySnapshot = await firestore().collection('users').where('profileSetup', '==', true).limit(50).get()
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
    let querySnapshot = await firestore()
      .collection('users')
      .where('phoneNumber', '==', normalized)
      .limit(1)
      .get()

    // If no match, try with country code in case DB stored it that way
    if (querySnapshot.empty) {
      querySnapshot = await firestore()
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
    const querySnapshot = await firestore().collection('users').where('profileSetup', '==', true).get()
    return { success: true, count: querySnapshot.size }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Toggle everyone network participation
export const toggleEveryoneNetwork = async (userId, enabled) => {
  try {
    await firestore().collection('users').doc(userId).update({
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
    await firestore().collection('reports').add({
      reporterId,
      reportedUserId,
      reason,
      details,
      createdAt: firestore.FieldValue.serverTimestamp(),
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
    const snapshot = await firestore()
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
    await firestore()
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
    await firestore().collection('users').doc(userId).update({
      activeScreen: firestore.FieldValue.delete(),
    })
  } catch (error) {
    console.log('🔴 clearActiveScreen error:', error.message)
  }
}

export const registerAdminToken = async (userId, pushToken) => {
  try {
    if (!userId || !pushToken) return
    await firestore().collection('adminTokens').doc(userId).set(
      {
        userId,
        pushToken,
        updatedAt: firestore.FieldValue.serverTimestamp(),
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
