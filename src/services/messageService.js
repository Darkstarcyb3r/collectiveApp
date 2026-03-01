// Message Service - Using Firebase Compat mode
// Handles conversations and messaging operations

import { db, firebase } from '../config/firebase'
import { validateText } from '../utils/validation'

// Helper: generate deterministic conversation ID from two user IDs
const getConversationId = (uid1, uid2) => {
  return [uid1, uid2].sort().join('_')
}

// Send a chat request to another user (does NOT open the chat)
// Creates a pending conversation doc that the recipient must accept first
export const sendChatRequest = async (
  currentUserId,
  otherUserId,
  currentUserProfile,
  otherUserProfile
) => {
  try {
    // Check if either user has blocked the other
    const otherUserDoc = await db.collection('users').doc(otherUserId).get()
    if (otherUserDoc.exists) {
      const otherData = otherUserDoc.data()
      if ((otherData.blockedUsers || []).includes(currentUserId)) {
        return { success: false, error: 'This action is unavailable.' }
      }
    }

    const conversationId = getConversationId(currentUserId, otherUserId)
    const conversationRef = db.collection('conversations').doc(conversationId)

    // Check if conversation already exists
    // Wrap in try/catch — Firestore rules may deny .get() on non-existent docs
    // when the read rule references resource.data
    let existingDoc = null
    try {
      const doc = await conversationRef.get()
      if (doc.exists) {
        existingDoc = doc.data()
      }
    } catch (_getErr) {
      // Permission denied means doc doesn't exist (rules can't evaluate resource.data)
      // Safe to proceed with creation
    }

    if (existingDoc) {
      // Already accepted — no request needed, go straight to chat
      if (existingDoc.status === 'accepted') {
        // If this user previously deleted the conversation, un-delete it
        if (existingDoc[`deleted_${currentUserId}`]) {
          await conversationRef.update({
            [`deleted_${currentUserId}`]: firebase.firestore.FieldValue.delete(),
          })
        }
        return { success: true, conversationId, status: 'accepted' }
      }
      // Already pending — don't create a duplicate
      return { success: true, conversationId, status: 'pending', alreadySent: true }
    }

    // Fetch FRESH profile data from Firestore to avoid stale snapshots
    // This ensures new accounts or recently updated photos are always current
    let freshCurrentProfile = currentUserProfile
    let freshOtherProfile = otherUserProfile
    try {
      const currentUserDoc = await db.collection('users').doc(currentUserId).get()
      if (currentUserDoc.exists) {
        const data = currentUserDoc.data()
        freshCurrentProfile = {
          ...currentUserProfile,
          name: data.name || currentUserProfile?.name || '',
          profilePhoto: data.profilePhoto || currentUserProfile?.profilePhoto || null,
        }
      }
    } catch (_err) {}
    try {
      // We already fetched otherUserDoc above for the block check
      if (otherUserDoc.exists) {
        const data = otherUserDoc.data()
        freshOtherProfile = {
          ...otherUserProfile,
          name: data.name || otherUserProfile?.name || '',
          profilePhoto: data.profilePhoto || otherUserProfile?.profilePhoto || null,
        }
      }
    } catch (_err) {}

    // Create new conversation as PENDING — always requires acceptance
    await conversationRef.set({
      participants: [currentUserId, otherUserId],
      participantProfiles: {
        [currentUserId]: {
          name: freshCurrentProfile?.name || '',
          profilePhoto: freshCurrentProfile?.profilePhoto || null,
        },
        [otherUserId]: {
          name: freshOtherProfile?.name || '',
          profilePhoto: freshOtherProfile?.profilePhoto || null,
        },
      },
      lastMessage: null,
      lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'pending',
      initiatedBy: currentUserId,
    })

    // Notification handled server-side by onConversationCreate Cloud Function

    return { success: true, conversationId, status: 'pending' }
  } catch (error) {
    console.log('🔴 sendChatRequest error:', error.message)
    return { success: false, error: error.message }
  }
}

// Get or create a conversation between two users (only used for already-accepted chats)
export const getOrCreateConversation = async (
  currentUserId,
  otherUserId,
  currentUserProfile,
  otherUserProfile
) => {
  try {
    const conversationId = getConversationId(currentUserId, otherUserId)
    const conversationRef = db.collection('conversations').doc(conversationId)

    let docExists = false
    let existingStatus = null
    try {
      const doc = await conversationRef.get()
      if (doc.exists) {
        docExists = true
        existingStatus = doc.data()?.status
        // If this user previously deleted the conversation, un-delete it so it shows in the list again
        if (doc.data()?.[`deleted_${currentUserId}`]) {
          await conversationRef.update({
            [`deleted_${currentUserId}`]: firebase.firestore.FieldValue.delete(),
          })
        }
      }
    } catch (_getErr) {
      // Permission denied means doc doesn't exist — safe to create
    }

    if (!docExists) {
      // Fetch FRESH profile data from Firestore to avoid stale snapshots
      // This ensures new accounts or recently updated photos are always current
      let freshCurrentProfile = currentUserProfile
      let freshOtherProfile = otherUserProfile
      try {
        const currentUserDoc = await db.collection('users').doc(currentUserId).get()
        if (currentUserDoc.exists) {
          const data = currentUserDoc.data()
          freshCurrentProfile = {
            ...currentUserProfile,
            name: data.name || currentUserProfile?.name || '',
            profilePhoto: data.profilePhoto || currentUserProfile?.profilePhoto || null,
          }
        }
      } catch (_err) {}
      try {
        const otherUserDoc = await db.collection('users').doc(otherUserId).get()
        if (otherUserDoc.exists) {
          const data = otherUserDoc.data()
          freshOtherProfile = {
            ...otherUserProfile,
            name: data.name || otherUserProfile?.name || '',
            profilePhoto: data.profilePhoto || otherUserProfile?.profilePhoto || null,
          }
        }
      } catch (_err) {}

      // Create new conversation as accepted (used when accepting a request)
      await conversationRef.set({
        participants: [currentUserId, otherUserId],
        participantProfiles: {
          [currentUserId]: {
            name: freshCurrentProfile?.name || '',
            profilePhoto: freshCurrentProfile?.profilePhoto || null,
          },
          [otherUserId]: {
            name: freshOtherProfile?.name || '',
            profilePhoto: freshOtherProfile?.profilePhoto || null,
          },
        },
        lastMessage: null,
        lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'accepted',
        initiatedBy: currentUserId,
      })

      return { success: true, conversationId, status: 'accepted' }
    }

    return { success: true, conversationId, status: existingStatus || 'accepted' }
  } catch (error) {
    console.log('🔴 getOrCreateConversation error:', error.message)
    return { success: false, error: error.message }
  }
}

// Subscribe to all conversations for a user (real-time)
export const subscribeToConversations = (userId, onUpdate) => {
  // Helper to filter out deleted conversations
  const filterDeleted = (conversations) => {
    return conversations.filter((c) => !c[`deleted_${userId}`])
  }

  return db
    .collection('conversations')
    .where('participants', 'array-contains', userId)
    .orderBy('lastMessageAt', 'desc')
    .onSnapshot(
      (snapshot) => {
        const conversations = []
        snapshot.forEach((doc) => {
          conversations.push({ id: doc.id, ...doc.data() })
        })
        onUpdate(filterDeleted(conversations))
      },
      (error) => {
        console.log('🔴 subscribeToConversations error:', error.message)
        // If error is about missing index, try without ordering as fallback
        if (error.message?.includes('index')) {
          console.log(
            '🔗 The error above usually includes a link to create the index — check the full error in your console.'
          )
          db.collection('conversations')
            .where('participants', 'array-contains', userId)
            .onSnapshot(
              (fallbackSnapshot) => {
                const conversations = []
                fallbackSnapshot.forEach((doc) => {
                  conversations.push({ id: doc.id, ...doc.data() })
                })
                // Sort client-side as fallback
                conversations.sort((a, b) => {
                  const aTime = a.lastMessageAt?.toDate?.() || new Date(0)
                  const bTime = b.lastMessageAt?.toDate?.() || new Date(0)
                  return bTime - aTime
                })
                onUpdate(filterDeleted(conversations))
              },
              (fallbackError) => {
                console.log('🔴 Fallback subscribeToConversations error:', fallbackError.message)
                onUpdate([])
              }
            )
        } else {
          onUpdate([])
        }
      }
    )
}

// Subscribe to messages in a conversation (real-time)
export const subscribeToMessages = (conversationId, onUpdate, messageLimit = 50) => {
  return db
    .collection('conversations')
    .doc(conversationId)
    .collection('messages')
    .orderBy('createdAt', 'asc')
    .limitToLast(messageLimit)
    .onSnapshot(
      (snapshot) => {
        const messages = []
        snapshot.forEach((doc) => {
          const data = doc.data()
          messages.push({
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
          })
        })
        onUpdate(messages)
      },
      (error) => {
        console.log('🔴 subscribeToMessages error:', error.message)
        onUpdate([])
      }
    )
}

// Send a message (batch write: add message + update conversation)
export const sendMessage = async (
  conversationId,
  senderId,
  senderName,
  senderPhoto,
  text,
  imageUrl = null,
  imageDimensions = null
) => {
  try {
    const batch = db.batch()
    const now = firebase.firestore.FieldValue.serverTimestamp()

    // Fetch fresh sender profile from Firestore to avoid stale photos
    let freshSenderName = senderName
    let freshSenderPhoto = senderPhoto
    try {
      const senderDoc = await db.collection('users').doc(senderId).get()
      if (senderDoc.exists) {
        const data = senderDoc.data()
        freshSenderName = data.name || senderName || ''
        freshSenderPhoto = data.profilePhoto || senderPhoto || null
      }
    } catch (_err) {}

    // Add message to subcollection
    const messageRef = db
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .doc()

    const messageData = {
      text: validateText(text, 'message'),
      senderId,
      senderName: freshSenderName || '',
      senderPhoto: freshSenderPhoto || null,
      createdAt: now,
    }

    if (imageUrl) {
      messageData.imageUrl = imageUrl
      messageData.type = 'image'
      if (imageDimensions) {
        messageData.imageWidth = imageDimensions.width
        messageData.imageHeight = imageDimensions.height
      }
    }

    batch.set(messageRef, messageData)

    // Get the conversation to find the recipient
    const convoDoc = await db.collection('conversations').doc(conversationId).get()
    const participants = convoDoc.exists ? convoDoc.data()?.participants || [] : []
    const recipientId = participants.find((id) => id !== senderId)

    // Update conversation with last message + mark unread for recipient
    const conversationRef = db.collection('conversations').doc(conversationId)
    const lastMessageText = imageUrl ? text?.trim() || '📷 Photo' : text.trim()
    const updateData = {
      lastMessage: {
        text: lastMessageText,
        senderId,
        createdAt: now,
      },
      lastMessageAt: now,
      updatedAt: now,
    }

    // Mark as unread for the recipient
    if (recipientId) {
      updateData[`unread_${recipientId}`] = true
    }

    batch.update(conversationRef, updateData)

    await batch.commit()

    // Push notification is now handled server-side by the onMessageCreate Cloud Function

    return { success: true }
  } catch (error) {
    console.log('🔴 sendMessage error:', error.message)
    return { success: false, error: error.message }
  }
}

// Mark conversation as read for a user
export const markConversationAsRead = async (conversationId, userId) => {
  try {
    await db
      .collection('conversations')
      .doc(conversationId)
      .update({
        [`unread_${userId}`]: false,
      })
  } catch (error) {
    console.log('🔴 markConversationAsRead error:', error.message)
  }
}

// Load earlier messages (pagination)
export const loadEarlierMessages = async (conversationId, beforeTimestamp, limit = 20) => {
  try {
    const snapshot = await db
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .orderBy('createdAt', 'desc')
      .startAfter(beforeTimestamp)
      .limit(limit)
      .get()

    const messages = []
    snapshot.forEach((doc) => {
      const data = doc.data()
      messages.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
      })
    })

    // Reverse to get ascending order
    messages.reverse()
    return { success: true, data: messages }
  } catch (error) {
    console.log('🔴 loadEarlierMessages error:', error.message)
    return { success: false, error: error.message }
  }
}

// Send a group invitation message to a user
export const sendGroupInvitation = async (
  currentUserId,
  currentUserProfile,
  targetUserId,
  targetUserProfile,
  groupId,
  groupName
) => {
  try {
    // Get or create conversation with the target user
    const convoResult = await getOrCreateConversation(
      currentUserId,
      targetUserId,
      currentUserProfile,
      targetUserProfile
    )

    if (!convoResult.success) {
      return { success: false, error: 'Could not create conversation' }
    }

    // Fetch fresh sender profile to avoid stale photos on invite messages
    let freshName = currentUserProfile?.name || ''
    let freshPhoto = currentUserProfile?.profilePhoto || null
    try {
      const senderDoc = await db.collection('users').doc(currentUserId).get()
      if (senderDoc.exists) {
        const data = senderDoc.data()
        freshName = data.name || freshName
        freshPhoto = data.profilePhoto || freshPhoto
      }
    } catch (_err) {}

    const conversationId = convoResult.conversationId
    const batch = db.batch()
    const now = firebase.firestore.FieldValue.serverTimestamp()

    // Add invitation message to subcollection
    const messageRef = db
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .doc()

    const inviteText = `You've been invited to join "${groupName}"!`

    batch.set(messageRef, {
      text: inviteText,
      senderId: currentUserId,
      senderName: freshName,
      senderPhoto: freshPhoto,
      createdAt: now,
      // Special fields for group invitation
      type: 'group_invite',
      groupId: groupId,
      groupName: groupName,
    })

    // Update conversation with last message + mark unread
    const conversationRef = db.collection('conversations').doc(conversationId)
    batch.update(conversationRef, {
      lastMessage: {
        text: inviteText,
        senderId: currentUserId,
        createdAt: now,
      },
      lastMessageAt: now,
      updatedAt: now,
      [`unread_${targetUserId}`]: true,
    })

    await batch.commit()

    // Push notification + history handled server-side by onMessageCreate Cloud Function

    return { success: true, conversationId }
  } catch (error) {
    console.log('🔴 sendGroupInvitation error:', error.message)
    return { success: false, error: error.message }
  }
}

// Send a chatroom invitation message to a user
export const sendChatroomInvitation = async (
  currentUserId,
  currentUserProfile,
  targetUserId,
  targetUserProfile,
  roomId,
  roomName
) => {
  try {
    // Get or create conversation with the target user
    const convoResult = await getOrCreateConversation(
      currentUserId,
      targetUserId,
      currentUserProfile,
      targetUserProfile
    )

    if (!convoResult.success) {
      return { success: false, error: 'Could not create conversation' }
    }

    // Fetch fresh sender profile to avoid stale photos on invite messages
    let freshName = currentUserProfile?.name || ''
    let freshPhoto = currentUserProfile?.profilePhoto || null
    try {
      const senderDoc = await db.collection('users').doc(currentUserId).get()
      if (senderDoc.exists) {
        const data = senderDoc.data()
        freshName = data.name || freshName
        freshPhoto = data.profilePhoto || freshPhoto
      }
    } catch (_err) {}

    const conversationId = convoResult.conversationId
    const batch = db.batch()
    const now = firebase.firestore.FieldValue.serverTimestamp()

    // Add invitation message to subcollection
    const messageRef = db
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .doc()

    const inviteText = `You've been invited to join "${roomName}" in the Cyber Lounge!`

    batch.set(messageRef, {
      text: inviteText,
      senderId: currentUserId,
      senderName: freshName,
      senderPhoto: freshPhoto,
      createdAt: now,
      // Special fields for chatroom invitation
      type: 'chatroom_invite',
      roomId: roomId,
      roomName: roomName,
    })

    // Update conversation with last message + mark unread
    const conversationRef = db.collection('conversations').doc(conversationId)
    batch.update(conversationRef, {
      lastMessage: {
        text: inviteText,
        senderId: currentUserId,
        createdAt: now,
      },
      lastMessageAt: now,
      updatedAt: now,
      [`unread_${targetUserId}`]: true,
    })

    await batch.commit()

    // Push notification + history handled server-side by onMessageCreate Cloud Function

    return { success: true, conversationId }
  } catch (error) {
    console.log('🔴 sendChatroomInvitation error:', error.message)
    return { success: false, error: error.message }
  }
}

// Delete a conversation (removes from user's view)
export const deleteConversation = async (conversationId, userId) => {
  try {
    // Mark as deleted for this user + record when they cleared the thread
    // The other user can still see the conversation
    await db
      .collection('conversations')
      .doc(conversationId)
      .update({
        [`deleted_${userId}`]: true,
        [`clearedAt_${userId}`]: firebase.firestore.FieldValue.serverTimestamp(),
      })

    return { success: true }
  } catch (error) {
    console.log('🔴 deleteConversation error:', error.message)
    return { success: false, error: error.message }
  }
}

// Accept a message request — changes status from 'pending' to 'accepted'
export const acceptMessageRequest = async (conversationId) => {
  try {
    await db.collection('conversations').doc(conversationId).update({
      status: 'accepted',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    })

    // Notification handled server-side by onConversationStatusChange Cloud Function

    return { success: true }
  } catch (error) {
    console.log('🔴 acceptMessageRequest error:', error.message)
    return { success: false, error: error.message }
  }
}

// Decline a message request — marks as declined (triggers server-side notification), then deletes
export const declineMessageRequest = async (conversationId) => {
  try {
    const conversationRef = db.collection('conversations').doc(conversationId)

    // Set status to 'declined' — triggers Cloud Function 19 for notification
    await conversationRef.update({
      status: 'declined',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    })

    // Brief delay so the Cloud Function can read the doc before deletion
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // Delete all messages in subcollection
    const messagesSnapshot = await conversationRef.collection('messages').get()
    const batch = db.batch()
    messagesSnapshot.forEach((doc) => {
      batch.delete(doc.ref)
    })
    // Delete the conversation document
    batch.delete(conversationRef)
    await batch.commit()

    return { success: true }
  } catch (error) {
    console.log('🔴 declineMessageRequest error:', error.message)
    return { success: false, error: error.message }
  }
}

// Toggle an emoji reaction on a message (add or remove)
export const toggleReaction = async (conversationId, messageId, userId, emoji) => {
  try {
    const messageRef = db
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .doc(messageId)

    const messageDoc = await messageRef.get()
    if (!messageDoc.exists) return { success: false, error: 'Message not found' }

    const reactions = messageDoc.data().reactions || {}
    const emojiReactions = reactions[emoji] || []

    if (emojiReactions.includes(userId)) {
      // Remove reaction
      const updated = emojiReactions.filter((id) => id !== userId)
      if (updated.length === 0) {
        // Remove the emoji key entirely
        const newReactions = { ...reactions }
        delete newReactions[emoji]
        await messageRef.update({ reactions: newReactions })
      } else {
        await messageRef.update({ [`reactions.${emoji}`]: updated })
      }
    } else {
      // Add reaction
      await messageRef.update({
        [`reactions.${emoji}`]: [...emojiReactions, userId],
      })
    }

    return { success: true }
  } catch (error) {
    console.log('🔴 toggleReaction error:', error.message)
    return { success: false, error: error.message }
  }
}

// Delete a single message from a conversation
export const deleteMessage = async (conversationId, messageId) => {
  try {
    await db
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .doc(messageId)
      .delete()
    return { success: true }
  } catch (error) {
    console.log('🔴 deleteMessage error:', error.message)
    return { success: false, error: error.message }
  }
}

export { getConversationId }

export default {
  getConversationId,
  sendChatRequest,
  getOrCreateConversation,
  subscribeToConversations,
  subscribeToMessages,
  sendMessage,
  markConversationAsRead,
  loadEarlierMessages,
  sendGroupInvitation,
  deleteConversation,
  deleteMessage,
  acceptMessageRequest,
  declineMessageRequest,
  toggleReaction,
}
