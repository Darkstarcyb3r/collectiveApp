// Group Service - Using @react-native-firebase
// Handles group and post operations
//
// NOTE: user.groups array syncing is handled server-side by Cloud Functions
// (onGroupCreate, onGroupMembershipChange, onGroupDelete) using admin SDK.
// Client-side code only modifies groups/{groupId}.members — the Cloud Function
// automatically keeps each user's groups array in sync.

import { firestore } from '../config/firebase'
import { signedUpload } from '../utils/cloudinaryUpload'
import { validateText } from '../utils/validation'

// Upload group banner image to Cloudinary (signed)
const uploadGroupBanner = async (groupId, imageUri, metadata = {}) => {
  return signedUpload(imageUri, `collective/groups/${groupId}`, 'banner', metadata)
}

// Create a new group
export const createGroup = async (creatorId, groupData) => {
  try {
    let bannerUrl = null

    const groupRef = await firestore().collection('groups').add({
      name: validateText(groupData.name, 'groupName'),
      description: validateText(groupData.description, 'groupDescription'),
      bannerUrl: null,
      creatorId: creatorId,
      members: [creatorId],
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
      postCount: 0,
    })

    // Upload banner image if provided
    let bannerFailed = false
    if (groupData.bannerUri) {
      const uploadResult = await uploadGroupBanner(
        groupRef.id,
        groupData.bannerUri,
        groupData.bannerMeta || {}
      )
      if (uploadResult.success) {
        bannerUrl = uploadResult.url
        await firestore().collection('groups').doc(groupRef.id).update({ bannerUrl })
      } else {
        bannerFailed = true
        console.warn('[groupService] Banner upload failed during create:', uploadResult.error)
      }
    }

    // user.groups sync handled by onGroupCreate Cloud Function

    return { success: true, groupId: groupRef.id, bannerFailed }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Update group banner image
export const updateGroupBanner = async (groupId, imageUri, metadata = {}) => {
  try {
    const uploadResult = await uploadGroupBanner(groupId, imageUri, metadata)
    if (uploadResult.success) {
      await firestore().collection('groups').doc(groupId).update({
        bannerUrl: uploadResult.url,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      })
      return { success: true, url: uploadResult.url }
    }
    return { success: false, error: 'Upload failed' }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Get group by ID
export const getGroup = async (groupId) => {
  try {
    const groupDoc = await firestore().collection('groups').doc(groupId).get()
    if (groupDoc.exists) {
      return { success: true, data: { id: groupId, ...groupDoc.data() } }
    }
    return { success: false, error: 'Group not found' }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Update group
export const updateGroup = async (groupId, updates) => {
  try {
    await firestore()
      .collection('groups')
      .doc(groupId)
      .update({
        ...updates,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Delete group
// user.groups cleanup handled by onGroupDelete Cloud Function
export const deleteGroup = async (groupId, _creatorId) => {
  try {
    const groupDoc = await firestore().collection('groups').doc(groupId).get()
    if (groupDoc.exists) {
      // Delete all posts in the group
      const postsSnapshot = await firestore().collection('groups').doc(groupId).collection('posts').get()
      await Promise.all(postsSnapshot.docs.map((postDoc) => postDoc.ref.delete()))

      // Delete the group — onGroupDelete Cloud Function removes groupId
      // from all members' user.groups arrays
      await firestore().collection('groups').doc(groupId).delete()
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Join group
// user.groups sync handled by onGroupMembershipChange Cloud Function
export const joinGroup = async (groupId, userId) => {
  try {
    await firestore()
      .collection('groups')
      .doc(groupId)
      .update({
        members: firestore.FieldValue.arrayUnion(userId),
      })

    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Remove member from group (creator only)
// user.groups sync handled by onGroupMembershipChange Cloud Function
export const removeMember = async (groupId, userId) => {
  try {
    await firestore()
      .collection('groups')
      .doc(groupId)
      .update({
        members: firestore.FieldValue.arrayRemove(userId),
      })

    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Leave group
// user.groups sync handled by onGroupMembershipChange Cloud Function
export const leaveGroup = async (groupId, userId) => {
  try {
    await firestore()
      .collection('groups')
      .doc(groupId)
      .update({
        members: firestore.FieldValue.arrayRemove(userId),
      })

    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Get user's groups — merges user.groups array with groups where user is a member
export const getUserGroups = async (userId) => {
  try {
    const groupMap = {}

    // Source 1: user's own groups array
    const userDoc = await firestore().collection('users').doc(userId).get()
    if (userDoc.exists) {
      const groupIds = userDoc.data().groups || []
      const userGroups = await Promise.all(
        groupIds.map(async (id) => {
          const groupDoc = await firestore().collection('groups').doc(id).get()
          return groupDoc.exists ? { id, ...groupDoc.data() } : null
        })
      )
      userGroups.filter(Boolean).forEach((g) => {
        groupMap[g.id] = g
      })
    }

    // Source 2: groups where user is in the members array (catches out-of-sync cases)
    const memberQuery = await firestore()
      .collection('groups')
      .where('members', 'array-contains', userId)
      .get()
    memberQuery.docs.forEach((doc) => {
      if (!groupMap[doc.id]) {
        groupMap[doc.id] = { id: doc.id, ...doc.data() }
      }
    })

    // Sync is now handled server-side by onGroupMembershipChange Cloud Function.
    // Source 2 catches any out-of-sync cases for display purposes.

    return { success: true, data: Object.values(groupMap) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Get all public groups
export const getAllGroups = async () => {
  try {
    const querySnapshot = await firestore().collection('groups').orderBy('createdAt', 'desc').limit(50).get()

    const groups = []
    querySnapshot.forEach((doc) => {
      groups.push({ id: doc.id, ...doc.data() })
    })

    return { success: true, data: groups }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Search groups
export const searchGroups = async (searchQuery) => {
  try {
    const querySnapshot = await firestore().collection('groups').orderBy('name').limit(50).get()

    const groups = []
    querySnapshot.forEach((doc) => {
      const groupData = doc.data()
      if (groupData.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        groups.push({ id: doc.id, ...groupData })
      }
    })

    return { success: true, data: groups }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Get ALL member profiles for a group
export const getGroupMembers = async (groupId) => {
  try {
    const groupDoc = await firestore().collection('groups').doc(groupId).get()
    if (!groupDoc.exists) return { success: false, error: 'Group not found' }

    const memberIds = groupDoc.data().members || []
    if (memberIds.length === 0) return { success: true, data: [] }

    const profiles = await Promise.all(
      memberIds.map(async (id) => {
        const userDoc = await firestore().collection('users').doc(id).get()
        if (userDoc.exists) {
          const data = userDoc.data()
          return { id, name: data.name, profilePhoto: data.profilePhoto }
        }
        return null
      })
    )
    return { success: true, data: profiles.filter(Boolean) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Get member profiles for avatar banner (first N members)
export const getMemberProfiles = async (memberIds, limit = 4) => {
  try {
    const idsToFetch = memberIds.slice(0, limit)
    const profiles = await Promise.all(
      idsToFetch.map(async (id) => {
        const userDoc = await firestore().collection('users').doc(id).get()
        if (userDoc.exists) {
          const data = userDoc.data()
          return { id, name: data.name, profilePhoto: data.profilePhoto }
        }
        return null
      })
    )
    return { success: true, data: profiles.filter(Boolean) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Invite user to group (add them directly)
// user.groups sync handled by onGroupMembershipChange Cloud Function
export const inviteToGroup = async (groupId, userId) => {
  try {
    await firestore()
      .collection('groups')
      .doc(groupId)
      .update({
        members: firestore.FieldValue.arrayUnion(userId),
      })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ==================== POSTS ====================

// Create a post in a group
export const createPost = async (groupId, userId, postData) => {
  try {
    let imageUrl = null

    // Upload post image if provided
    if (postData.imageUri) {
      const uploadResult = await uploadPostImage(
        groupId,
        postData.imageUri,
        postData.imageMeta || {}
      )
      if (uploadResult.success) {
        imageUrl = uploadResult.url
      }
    }

    // Calculate expiry date (90 days from now)
    const expiryDate = new Date()
    expiryDate.setDate(expiryDate.getDate() + 90)

    const postRef = await firestore()
      .collection('groups')
      .doc(groupId)
      .collection('posts')
      .add({
        title: validateText(postData.title, 'postTitle'),
        content: validateText(postData.content, 'postContent'),
        imageUrl: imageUrl,
        authorId: userId,
        groupId: groupId,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
        expiresAt: firestore.Timestamp.fromDate(expiryDate),
        commentCount: 0,
      })

    // Update group post count
    const groupDoc = await firestore().collection('groups').doc(groupId).get()
    await firestore()
      .collection('groups')
      .doc(groupId)
      .update({
        postCount: (groupDoc.data().postCount || 0) + 1,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      })

    return { success: true, postId: postRef.id }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Upload post image to Cloudinary (signed)
export const uploadPostImage = async (groupId, imageUri, metadata = {}) => {
  return signedUpload(imageUri, `collective/groups/${groupId}/posts`, 'post', metadata)
}

// Get posts in a group (expired posts are permanently deleted)
export const getGroupPosts = async (groupId) => {
  try {
    const querySnapshot = await firestore()
      .collection('groups')
      .doc(groupId)
      .collection('posts')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get()

    const posts = []
    const expiredIds = []
    const now = new Date()

    for (const docSnapshot of querySnapshot.docs) {
      const postData = docSnapshot.data()

      // Collect expired posts for deletion
      if (postData.expiresAt && postData.expiresAt.toDate() < now) {
        expiredIds.push(docSnapshot.id)
        continue
      }

      // Get author info
      const authorDoc = await firestore().collection('users').doc(postData.authorId).get()
      const authorData = authorDoc.exists ? authorDoc.data() : null

      posts.push({
        id: docSnapshot.id,
        ...postData,
        author: authorData
          ? {
              id: postData.authorId,
              name: authorData.name,
              profilePhoto: authorData.profilePhoto,
            }
          : null,
      })
    }

    // Permanently delete expired posts in background (fire-and-forget)
    if (expiredIds.length > 0) {
      Promise.all(
        expiredIds.map(async (postId) => {
          try {
            // Delete comments subcollection first
            const commentsSnap = await firestore()
              .collection('groups')
              .doc(groupId)
              .collection('posts')
              .doc(postId)
              .collection('comments')
              .get()
            await Promise.all(commentsSnap.docs.map((c) => c.ref.delete()))

            // Delete the post
            await firestore().collection('groups').doc(groupId).collection('posts').doc(postId).delete()
          } catch (e) {
            console.warn(`[groupService] Failed to delete expired post ${postId}:`, e.message)
          }
        })
      )
        .then(() => {
          // Update post count
          firestore().collection('groups')
            .doc(groupId)
            .get()
            .then((groupDoc) => {
              if (groupDoc.exists) {
                const currentCount = groupDoc.data().postCount || 0
                firestore().collection('groups')
                  .doc(groupId)
                  .update({
                    postCount: Math.max(0, currentCount - expiredIds.length),
                  })
              }
            })
        })
        .catch(() => {})
    }

    return { success: true, data: posts }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Get single post
export const getPost = async (groupId, postId) => {
  try {
    const postDoc = await firestore().collection('groups').doc(groupId).collection('posts').doc(postId).get()
    if (postDoc.exists) {
      const postData = postDoc.data()

      // Get author info
      const authorDoc = await firestore().collection('users').doc(postData.authorId).get()
      const authorData = authorDoc.exists ? authorDoc.data() : null

      return {
        success: true,
        data: {
          id: postId,
          ...postData,
          author: authorData
            ? {
                id: postData.authorId,
                name: authorData.name,
                profilePhoto: authorData.profilePhoto,
              }
            : null,
        },
      }
    }
    return { success: false, error: 'Post not found' }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Update post
export const updatePost = async (groupId, postId, updates) => {
  try {
    await firestore()
      .collection('groups')
      .doc(groupId)
      .collection('posts')
      .doc(postId)
      .update({
        ...updates,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Delete post
export const deletePost = async (groupId, postId) => {
  try {
    const postDoc = await firestore().collection('groups').doc(groupId).collection('posts').doc(postId).get()
    if (postDoc.exists) {
      // Note: Cloudinary images are not deleted client-side (requires API secret)
      // They can be cleaned up via Cloudinary dashboard or server-side if needed

      // Delete the post
      await firestore().collection('groups').doc(groupId).collection('posts').doc(postId).delete()

      // Update group post count
      const groupDoc = await firestore().collection('groups').doc(groupId).get()
      if (groupDoc.exists) {
        const currentCount = groupDoc.data().postCount || 0
        await firestore()
          .collection('groups')
          .doc(groupId)
          .update({
            postCount: Math.max(0, currentCount - 1),
          })
      }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ==================== POST SUBSCRIPTIONS ====================

// Subscribe to post notifications (get notified on new comments)
export const subscribeToPost = async (groupId, postId, userId) => {
  try {
    await firestore()
      .collection('groups')
      .doc(groupId)
      .collection('posts')
      .doc(postId)
      .set(
        {
          subscribers: firestore.FieldValue.arrayUnion(userId),
        },
        { merge: true }
      )
    return { success: true }
  } catch (error) {
    console.log('🔴 subscribeToPost error:', error.message)
    return { success: false, error: error.message }
  }
}

// Unsubscribe from post notifications
export const unsubscribeFromPost = async (groupId, postId, userId) => {
  try {
    await firestore()
      .collection('groups')
      .doc(groupId)
      .collection('posts')
      .doc(postId)
      .set(
        {
          subscribers: firestore.FieldValue.arrayRemove(userId),
        },
        { merge: true }
      )
    return { success: true }
  } catch (error) {
    console.log('🔴 unsubscribeFromPost error:', error.message)
    return { success: false, error: error.message }
  }
}

// ==================== COMMENTS ====================

// Add comment to post
export const addComment = async (groupId, postId, userId, content, parentCommentId = null) => {
  try {
    const commentRef = await firestore()
      .collection('groups')
      .doc(groupId)
      .collection('posts')
      .doc(postId)
      .collection('comments')
      .add({
        content: validateText(content, 'comment'),
        authorId: userId,
        createdAt: firestore.FieldValue.serverTimestamp(),
        parentCommentId: parentCommentId || null,
      })

    // Update post comment count
    const postDoc = await firestore().collection('groups').doc(groupId).collection('posts').doc(postId).get()
    if (postDoc.exists) {
      await firestore()
        .collection('groups')
        .doc(groupId)
        .collection('posts')
        .doc(postId)
        .update({
          commentCount: (postDoc.data().commentCount || 0) + 1,
        })

      // Notification handled server-side by onGroupCommentCreate Cloud Function
    }

    return { success: true, commentId: commentRef.id }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Get comments for a post
export const getPostComments = async (groupId, postId) => {
  try {
    const querySnapshot = await firestore()
      .collection('groups')
      .doc(groupId)
      .collection('posts')
      .doc(postId)
      .collection('comments')
      .orderBy('createdAt', 'asc')
      .get()

    const comments = []

    for (const docSnapshot of querySnapshot.docs) {
      const commentData = docSnapshot.data()

      // Get author info
      const authorDoc = await firestore().collection('users').doc(commentData.authorId).get()
      const authorData = authorDoc.exists ? authorDoc.data() : null

      comments.push({
        id: docSnapshot.id,
        ...commentData,
        author: authorData
          ? {
              id: commentData.authorId,
              name: authorData.name,
              profilePhoto: authorData.profilePhoto,
            }
          : null,
      })
    }

    return { success: true, data: comments }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Toggle an emoji reaction on a group post comment (add or remove)
export const toggleGroupCommentReaction = async (groupId, postId, commentId, userId, emoji) => {
  try {
    const commentRef = firestore()
      .collection('groups')
      .doc(groupId)
      .collection('posts')
      .doc(postId)
      .collection('comments')
      .doc(commentId)

    const commentDoc = await commentRef.get()
    if (!commentDoc.exists) return { success: false, error: 'Comment not found' }

    const reactions = commentDoc.data().reactions || {}
    const emojiReactions = reactions[emoji] || []
    const newReactions = { ...reactions }

    if (emojiReactions.includes(userId)) {
      const updated = emojiReactions.filter((id) => id !== userId)
      if (updated.length === 0) {
        delete newReactions[emoji]
      } else {
        newReactions[emoji] = updated
      }
    } else {
      newReactions[emoji] = [...emojiReactions, userId]
    }

    await commentRef.update({ reactions: newReactions })
    return { success: true }
  } catch (error) {
    console.log('🔴 toggleGroupCommentReaction error:', error.message)
    return { success: false, error: error.message }
  }
}

// Delete comment
export const deleteComment = async (groupId, postId, commentId) => {
  try {
    await firestore()
      .collection('groups')
      .doc(groupId)
      .collection('posts')
      .doc(postId)
      .collection('comments')
      .doc(commentId)
      .delete()

    // Update post comment count
    const postDoc = await firestore().collection('groups').doc(groupId).collection('posts').doc(postId).get()
    if (postDoc.exists) {
      const currentCount = postDoc.data().commentCount || 0
      await firestore()
        .collection('groups')
        .doc(groupId)
        .collection('posts')
        .doc(postId)
        .update({
          commentCount: Math.max(0, currentCount - 1),
        })
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export default {
  createGroup,
  getGroup,
  updateGroup,
  updateGroupBanner,
  deleteGroup,
  joinGroup,
  removeMember,
  leaveGroup,
  getUserGroups,
  getAllGroups,
  searchGroups,
  getGroupMembers,
  getMemberProfiles,
  inviteToGroup,
  createPost,
  getGroupPosts,
  getPost,
  updatePost,
  deletePost,
  addComment,
  getPostComments,
  toggleGroupCommentReaction,
  deleteComment,
  subscribeToPost,
  unsubscribeFromPost,
}
