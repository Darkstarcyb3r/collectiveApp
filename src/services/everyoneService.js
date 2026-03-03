// Everyone Service
// Firestore operations for the Everyone section: active users, cyber lounge, events, mutual aid, confluence


import { db, firebase } from '../config/firebase';
import { validateText } from '../utils/validation';

// ==================== ACTIVE USERS ====================

// Get all currently online users (only those in the Everyone network)
export const getActiveUsers = async () => {
  try {
    const snapshot = await db.collection('users')
      .where('isOnline', '==', true)
      .where('profileSetup', '==', true)
      .where('everyoneNetworkEnabled', '==', true)
      .limit(100)
      .get();

    const users = [];
    snapshot.forEach((doc) => {
      users.push({ id: doc.id, ...doc.data() });
    });

    return { success: true, data: users };
  } catch (error) {
    console.log('Error fetching active users:', error.message);
    return { success: false, error: error.message };
  }
};

// Subscribe to active users in real-time (only those in the Everyone network)
export const subscribeToActiveUsers = (callback) => {
  return db.collection('users')
    .where('isOnline', '==', true)
    .where('profileSetup', '==', true)
    .where('everyoneNetworkEnabled', '==', true)
    .limit(100)
    .onSnapshot((snapshot) => {
      const users = [];
      snapshot.forEach((doc) => {
        users.push({ id: doc.id, ...doc.data() });
      });
      callback(users);
    }, (error) => {
      console.log('Error subscribing to active users:', error.message);
      callback([]);
    });
};

// Subscribe to ALL users with everyoneNetworkEnabled (regardless of online status)
// Used to build the full network graph via follow connections
export const subscribeToNetworkUsers = (callback) => {
  
  return db.collection('users')
    .where('profileSetup', '==', true)
    .where('everyoneNetworkEnabled', '==', true)
    .limit(500)
    .onSnapshot((snapshot) => {
      console.log('SNAPSHOT - total docs:', snapshot.size);
      
      // THIS IS THE KEY - watch for removals
      snapshot.docChanges().forEach(change => {
        console.log(`${change.type.toUpperCase()}:`, change.doc.id);
      });
      
      const users = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.accountDeleted) {
          console.log('Skipping soft-deleted user:', doc.id);
          return;
        }
        users.push({ id: doc.id, ...data });
      });
      
      callback(users);
    }, (error) => {
      console.log('Listener error:', error.message);
      callback([]);
    });
};

// ==================== CYBER LOUNGE ====================

const MAX_CHATROOMS = 500;
const MAX_PARTICIPANTS = 50;
const MAX_HOST_ROOMS = 2;
const CHATROOM_DURATION_HOURS = 4;

// Get the number of active rooms hosted by a specific user
export const getHostRoomCount = async (hostId) => {
  try {
    const snapshot = await db.collection('cyberLoungeRooms')
      .where('hostId', '==', hostId)
      .where('isActive', '==', true)
      .get();
    return snapshot.size;
  } catch (_error) {
    return 0;
  }
};

// Create a new chatroom
export const createChatroom = async (hostId, hostName, hostPhoto, roomName, vibe = 'none', stickers = [], background = 'none') => {
  try {
    // Check active room count
    const activeRooms = await db.collection('cyberLoungeRooms')
      .where('isActive', '==', true)
      .get();

    if (activeRooms.size >= MAX_CHATROOMS) {
      return { success: false, error: 'max_rooms', message: 'Sorry, chatrooms are at a max. Try joining an existing one!' };
    }

    // Check per-host limit
    const hostRoomCount = await getHostRoomCount(hostId);
    if (hostRoomCount >= MAX_HOST_ROOMS) {
      return { success: false, error: 'max_host_rooms', message: 'You can only host up to 2 chatrooms at a time.' };
    }

    // Fetch fresh host profile from Firestore to avoid stale photos
    let freshHostName = hostName;
    let freshHostPhoto = hostPhoto;
    try {
      const hostDoc = await db.collection('users').doc(hostId).get();
      if (hostDoc.exists) {
        const data = hostDoc.data();
        freshHostName = data.name || hostName;
        freshHostPhoto = data.profilePhoto || hostPhoto;
      }
    } catch (_err) {
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + CHATROOM_DURATION_HOURS * 60 * 60 * 1000);

    const docRef = await db.collection('cyberLoungeRooms').add({
      name: validateText(roomName, 'chatroomName'),
      hostId,
      hostName: freshHostName,
      hostPhoto: freshHostPhoto,
      createdAt: firebase.firestore.Timestamp.fromDate(now),
      expiresAt: firebase.firestore.Timestamp.fromDate(expiresAt),
      participants: [hostId],
      participantCount: 1,
      isActive: true,
      vibe: vibe,
      stickers: stickers,
      background: background,
    });

    return { success: true, roomId: docRef.id };
  } catch (error) {
    console.log('Error creating chatroom:', error.message);
    return { success: false, error: error.message };
  }
};

// Subscribe to active chatrooms
// Uses only .where('isActive') to avoid requiring a composite index
// Sorts client-side by createdAt descending
// Filters out expired rooms and auto-deletes them from Firestore
export const subscribeToActiveRooms = (callback) => {
  return db.collection('cyberLoungeRooms')
    .where('isActive', '==', true)
    .onSnapshot((snapshot) => {
      const now = new Date();
      const rooms = [];
      const expiredRoomIds = [];

      snapshot.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() };

        // Check if room has expired
        let expiresAt = null;
        if (data.expiresAt?.toDate && typeof data.expiresAt.toDate === 'function') {
          expiresAt = data.expiresAt.toDate();
        } else if (data.expiresAt instanceof Date) {
          expiresAt = data.expiresAt;
        } else if (data.expiresAt?.seconds) {
          expiresAt = new Date(data.expiresAt.seconds * 1000);
        }

        if (expiresAt && expiresAt <= now) {
          // Room has expired — queue for cleanup, don't show on landing page
          expiredRoomIds.push(doc.id);
        } else {
          rooms.push(data);
        }
      });

      // Auto-delete expired rooms from Firestore in the background
      expiredRoomIds.forEach((roomId) => {
        deleteChatroom(roomId).catch(() => {});
      });

      // Sort client-side: newest first
      rooms.sort((a, b) => {
        const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
        return bTime - aTime;
      });
      callback(rooms);
    }, (error) => {
      console.log('Error subscribing to rooms:', error.message);
      callback([]);
    });
};

// Get active room count
export const getActiveRoomCount = async () => {
  try {
    const snapshot = await db.collection('cyberLoungeRooms')
      .where('isActive', '==', true)
      .get();
    return snapshot.size;
  } catch (_error) {
    return 0;
  }
};

// Join a chatroom
export const joinChatroom = async (roomId, userId) => {
  try {
    const roomRef = db.collection('cyberLoungeRooms').doc(roomId);
    const roomDoc = await roomRef.get();

    if (!roomDoc.exists || !roomDoc.data().isActive) {
      return { success: false, error: 'Room no longer exists.' };
    }

    const participants = roomDoc.data().participants || [];
    if (participants.length >= MAX_PARTICIPANTS) {
      return { success: false, error: 'Room is full (50/50 participants).' };
    }

    if (!participants.includes(userId)) {
      await roomRef.update({
        participants: [...participants, userId],
        participantCount: participants.length + 1,
        [`heartbeats.${userId}`]: firebase.firestore.Timestamp.now(),
      });
    } else {
      // Already a participant — just refresh heartbeat
      await roomRef.update({
        [`heartbeats.${userId}`]: firebase.firestore.Timestamp.now(),
      });
    }

    return { success: true };
  } catch (error) {
    console.log('Error joining chatroom:', error.message);
    return { success: false, error: error.message };
  }
};

// Leave a chatroom
export const leaveChatroom = async (roomId, userId) => {
  try {
    const roomRef = db.collection('cyberLoungeRooms').doc(roomId);
    const roomDoc = await roomRef.get();

    if (!roomDoc.exists) return { success: false };

    const participants = roomDoc.data().participants || [];
    const updated = participants.filter((id) => id !== userId);

    await roomRef.update({
      participants: updated,
      participantCount: updated.length,
      [`heartbeats.${userId}`]: firebase.firestore.FieldValue.delete(),
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Send heartbeat for active presence tracking + prune stale participants
export const sendHeartbeat = async (roomId, userId) => {
  try {
    const roomRef = db.collection('cyberLoungeRooms').doc(roomId);

    // Write this user's heartbeat
    await roomRef.update({
      [`heartbeats.${userId}`]: firebase.firestore.Timestamp.now(),
    });

    // Prune stale participants
    const roomDoc = await roomRef.get();
    if (!roomDoc.exists) return;
    const data = roomDoc.data();
    const heartbeats = data.heartbeats || {};
    const participants = data.participants || [];
    const hostId = data.hostId;
    const now = Date.now();
    const STALE_MS = 5 * 60 * 1000; // 5 minutes

    const activeParticipants = participants.filter((uid) => {
      if (uid === hostId) return true; // Host always stays
      const hb = heartbeats[uid];
      if (!hb) return false; // No heartbeat = stale
      return (now - hb.toMillis()) < STALE_MS;
    });

    if (activeParticipants.length !== participants.length) {
      // Clean up stale heartbeat entries too
      const cleanedHeartbeats = {};
      activeParticipants.forEach((uid) => {
        if (heartbeats[uid]) cleanedHeartbeats[uid] = heartbeats[uid];
      });

      await roomRef.update({
        participants: activeParticipants,
        participantCount: activeParticipants.length,
        heartbeats: cleanedHeartbeats,
      });
    }
  } catch (error) {
    console.log('Heartbeat error:', error.message);
  }
};

// Update the vibe (background music track) for a chatroom — host only
export const updateRoomVibe = async (roomId, vibeId) => {
  try {
    const roomRef = db.collection('cyberLoungeRooms').doc(roomId);
    await roomRef.update({ vibe: vibeId });
    return { success: true };
  } catch (error) {
    console.log('Error updating room vibe:', error.message);
    return { success: false, error: error.message };
  }
};

// Update the background for a chatroom — host only
export const updateRoomBackground = async (roomId, backgroundId) => {
  try {
    const roomRef = db.collection('cyberLoungeRooms').doc(roomId);
    await roomRef.update({ background: backgroundId });
    return { success: true };
  } catch (error) {
    console.log('Error updating room background:', error.message);
    return { success: false, error: error.message };
  }
};

// Update the stickers for a chatroom — host only
export const updateRoomStickers = async (roomId, stickers) => {
  try {
    const roomRef = db.collection('cyberLoungeRooms').doc(roomId);
    await roomRef.update({ stickers: stickers });
    return { success: true };
  } catch (error) {
    console.log('Error updating room stickers:', error.message);
    return { success: false, error: error.message };
  }
};

// End a chatroom (host only) — permanently deletes room and messages from Firestore
export const endChatroom = async (roomId, hostId) => {
  try {
    const roomRef = db.collection('cyberLoungeRooms').doc(roomId);
    const roomDoc = await roomRef.get();

    if (!roomDoc.exists) return { success: false, error: 'Room not found.' };
    if (roomDoc.data().hostId !== hostId) return { success: false, error: 'Only the host can end the chat.' };

    // Delete all messages in the subcollection first
    const messagesSnapshot = await roomRef.collection('messages').get();
    const batch = db.batch();
    messagesSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });
    // Delete the room document itself
    batch.delete(roomRef);
    await batch.commit();

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Delete an expired chatroom (any user can trigger when timer is up)
export const deleteChatroom = async (roomId) => {
  try {
    const roomRef = db.collection('cyberLoungeRooms').doc(roomId);
    const roomDoc = await roomRef.get();
    if (!roomDoc.exists) return { success: true };

    const messagesSnapshot = await roomRef.collection('messages').get();
    const batch = db.batch();
    messagesSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });
    batch.delete(roomRef);
    await batch.commit();

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Subscribe to chatroom data (single room)
export const subscribeToChatroom = (roomId, callback) => {
  return db.collection('cyberLoungeRooms').doc(roomId)
    .onSnapshot((doc) => {
      if (doc.exists) {
        callback({ id: doc.id, ...doc.data() });
      } else {
        callback(null);
      }
    }, (error) => {
      console.log('Error subscribing to chatroom:', error.message);
      callback(null);
    });
};

// Send a message in a chatroom (supports text and/or image)
export const sendChatroomMessage = async (roomId, senderId, senderName, senderPhoto, text, imageUrl = null, imageDimensions = null) => {
  try {
    const messageData = {
      senderId,
      senderName,
      senderPhoto,
      text: text || '',
      createdAt: firebase.firestore.Timestamp.fromDate(new Date()),
    };

    if (imageUrl) {
      messageData.imageUrl = imageUrl;
      messageData.type = 'image';
      if (imageDimensions) {
        messageData.imageWidth = imageDimensions.width;
        messageData.imageHeight = imageDimensions.height;
      }
    }

    await db.collection('cyberLoungeRooms').doc(roomId)
      .collection('messages').add(messageData);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Toggle an emoji reaction on a chatroom message (add or remove)
// Writes the full reactions map to avoid Firestore dot-notation issues with emoji keys
export const toggleChatroomReaction = async (roomId, messageId, userId, emoji) => {
  try {
    const messageRef = db.collection('cyberLoungeRooms')
      .doc(roomId)
      .collection('messages')
      .doc(messageId);

    const messageDoc = await messageRef.get();
    if (!messageDoc.exists) return { success: false, error: 'Message not found' };

    const reactions = messageDoc.data().reactions || {};
    const emojiReactions = reactions[emoji] || [];
    const newReactions = { ...reactions };

    if (emojiReactions.includes(userId)) {
      // Remove reaction
      const updated = emojiReactions.filter((id) => id !== userId);
      if (updated.length === 0) {
        delete newReactions[emoji];
      } else {
        newReactions[emoji] = updated;
      }
    } else {
      // Add reaction
      newReactions[emoji] = [...emojiReactions, userId];
    }

    await messageRef.update({ reactions: newReactions });

    return { success: true };
  } catch (error) {
    console.log('🔴 toggleChatroomReaction error:', error.message);
    return { success: false, error: error.message };
  }
};

// Delete a chatroom message (sender or host only — enforced by Firestore rules)
export const deleteChatroomMessage = async (roomId, messageId) => {
  try {
    await db.collection('cyberLoungeRooms')
      .doc(roomId)
      .collection('messages')
      .doc(messageId)
      .delete();
    return { success: true };
  } catch (error) {
    console.log('🔴 deleteChatroomMessage error:', error.message);
    return { success: false, error: error.message };
  }
};

// Subscribe to chatroom messages
export const subscribeToChatroomMessages = (roomId, callback) => {
  return db.collection('cyberLoungeRooms').doc(roomId)
    .collection('messages')
    .orderBy('createdAt', 'asc')
    .onSnapshot((snapshot) => {
      const messages = [];
      snapshot.forEach((doc) => {
        messages.push({ id: doc.id, ...doc.data() });
      });
      callback(messages);
    }, (error) => {
      console.log('Error subscribing to chatroom messages:', error.message);
      callback([]);
    });
};

// ==================== EVENTS ====================

const MAX_EVENTS_PER_MONTH = 20;

// Get persistent monthly event creation count from rateLimits/{userId}
// This counter increments on every event creation and does NOT decrease on deletion.
// Resets to 0 on the 1st of each month (handled by cloud function + scheduled cleanup).
export const getUserMonthlyEventCount = async (userId) => {
  try {
    const doc = await db.collection('rateLimits').doc(userId).get();
    if (!doc.exists) {
      return { success: true, count: 0 };
    }

    const data = doc.data();

    // Check if the counter needs a monthly reset (in case cloud function hasn't run yet)
    const now = new Date();
    const lastReset = data.lastMonthlyReset?.toDate ? data.lastMonthlyReset.toDate() : new Date(0);
    const needsReset = lastReset.getFullYear() !== now.getFullYear() || lastReset.getMonth() !== now.getMonth();

    if (needsReset) {
      return { success: true, count: 0 };
    }

    return { success: true, count: data.monthlyEvents || 0 };
  } catch (error) {
    console.log('Error getting monthly event count:', error.message);
    return { success: true, count: 0 };
  }
};

// Create an event (with per-user monthly limit)
// Counter is incremented server-side by the onEventCreate cloud function (tamper-proof).
// Returns the pre-creation count so the UI can optimistically display count + 1.
export const createEvent = async (eventData) => {
  try {
    // Check monthly limit from persistent counter
    const countResult = await getUserMonthlyEventCount(eventData.authorId);
    if (countResult.count >= MAX_EVENTS_PER_MONTH) {
      return { success: false, error: 'max_monthly_events', message: `You've reached the limit of ${MAX_EVENTS_PER_MONTH} event posts this month. Your limit resets on the 1st.` };
    }

    // Validate text fields
    eventData.title = validateText(eventData.title, 'eventTitle');
    eventData.description = validateText(eventData.description, 'eventDescription');
    eventData.location = validateText(eventData.location, 'eventLocation');

    // Fetch fresh author profile from Firestore to avoid stale photos
    let freshData = { ...eventData };
    try {
      const authorDoc = await db.collection('users').doc(eventData.authorId).get();
      if (authorDoc.exists) {
        const data = authorDoc.data();
        freshData.authorName = data.name || eventData.authorName || '';
        freshData.authorPhoto = data.profilePhoto || eventData.authorPhoto || null;
      }
    } catch (_err) {
    }

    const docRef = await db.collection('events').add({
      ...freshData,
      createdAt: new Date(),
    });

    // Return the pre-creation count so the caller can optimistically show count + 1
    return { success: true, eventId: docRef.id, newCount: countResult.count + 1 };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Subscribe to events (today through 6 weeks out, ordered by event date ascending)
export const subscribeToEvents = (callback) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // start of today
  const sixWeeksOut = new Date(today);
  sixWeeksOut.setDate(sixWeeksOut.getDate() + 42);

  return db.collection('events')
    .where('date', '>=', today)
    .where('date', '<=', sixWeeksOut)
    .orderBy('date', 'asc')
    .onSnapshot((snapshot) => {
      const events = [];
      snapshot.forEach((doc) => {
        events.push({ id: doc.id, ...doc.data() });
      });
      callback(events);
    }, (error) => {
      console.log('Error subscribing to events:', error.message);
      callback([]);
    });
};

// Get a single event
export const getEvent = async (eventId) => {
  try {
    const doc = await db.collection('events').doc(eventId).get();
    if (doc.exists) {
      return { success: true, data: { id: doc.id, ...doc.data() } };
    }
    return { success: false, error: 'Event not found.' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Update an event
export const updateEvent = async (eventId, updates) => {
  try {
    await db.collection('events').doc(eventId).update(updates);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Delete an event
export const deleteEvent = async (eventId) => {
  try {
    await db.collection('events').doc(eventId).delete();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Delete expired events (event date has fully passed — deleted the day after)
export const deleteExpiredEvents = async () => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // start of today

    const snapshot = await db.collection('events')
      .where('date', '<', today)
      .get();

    const batch = db.batch();
    snapshot.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    return { success: true, deleted: snapshot.size };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ==================== EVENT COMMENTS ====================

// Add a comment to an event
export const addEventComment = async (eventId, userId, content, parentCommentId = null) => {
  try {
    const commentRef = await db.collection('events').doc(eventId)
      .collection('comments').add({
        content: validateText(content, 'comment'),
        authorId: userId,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        parentCommentId: parentCommentId || null,
      });

    // Update event comment count
    const eventDoc = await db.collection('events').doc(eventId).get();
    if (eventDoc.exists) {
      await db.collection('events').doc(eventId).update({
        commentCount: (eventDoc.data().commentCount || 0) + 1,
      });

      // Notification handled server-side by onEventCommentCreate Cloud Function
    }

    return { success: true, commentId: commentRef.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Get comments for an event (with author info)
export const getEventComments = async (eventId) => {
  try {
    const querySnapshot = await db.collection('events').doc(eventId)
      .collection('comments')
      .orderBy('createdAt', 'asc')
      .get();

    const comments = [];

    for (const docSnapshot of querySnapshot.docs) {
      const commentData = docSnapshot.data();

      // Get author info
      const authorDoc = await db.collection('users').doc(commentData.authorId).get();
      const authorData = authorDoc.exists ? authorDoc.data() : null;

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
      });
    }

    return { success: true, data: comments };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Toggle an emoji reaction on an event comment (add or remove)
export const toggleEventCommentReaction = async (eventId, commentId, userId, emoji) => {
  try {
    const commentRef = db.collection('events').doc(eventId)
      .collection('comments').doc(commentId);

    const commentDoc = await commentRef.get();
    if (!commentDoc.exists) return { success: false, error: 'Comment not found' };

    const reactions = commentDoc.data().reactions || {};
    const emojiReactions = reactions[emoji] || [];
    const newReactions = { ...reactions };

    if (emojiReactions.includes(userId)) {
      const updated = emojiReactions.filter((id) => id !== userId);
      if (updated.length === 0) {
        delete newReactions[emoji];
      } else {
        newReactions[emoji] = updated;
      }
    } else {
      newReactions[emoji] = [...emojiReactions, userId];
    }

    await commentRef.update({ reactions: newReactions });
    return { success: true };
  } catch (error) {
    console.log('🔴 toggleEventCommentReaction error:', error.message);
    return { success: false, error: error.message };
  }
};

// Delete a comment from an event
export const deleteEventComment = async (eventId, commentId) => {
  try {
    await db.collection('events').doc(eventId)
      .collection('comments').doc(commentId)
      .delete();

    const eventDoc = await db.collection('events').doc(eventId).get();
    if (eventDoc.exists) {
      const currentCount = eventDoc.data().commentCount || 0;
      await db.collection('events').doc(eventId).update({
        commentCount: Math.max(0, currentCount - 1),
      });
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ==================== MUTUAL AID ====================

// Create a mutual aid group
export const createMutualAidGroup = async (groupData) => {
  try {
    // Validate text fields
    groupData.name = validateText(groupData.name, 'mutualAidName');
    groupData.description = validateText(groupData.description, 'mutualAidDescription');
    groupData.link = validateText(groupData.link, 'mutualAidLink');

    // Fetch fresh author profile from Firestore to avoid stale photos
    let freshData = { ...groupData };
    try {
      const authorDoc = await db.collection('users').doc(groupData.authorId).get();
      if (authorDoc.exists) {
        const data = authorDoc.data();
        freshData.authorName = data.name || groupData.authorName || '';
        freshData.authorPhoto = data.profilePhoto || groupData.authorPhoto || null;
      }
    } catch (_err) {
    }

    // If the author opted to vet, seed vettedBy with their ID
    const initialVettedBy = freshData.vetByAuthor ? [freshData.authorId] : [];

    // Remove the UI-only flag before writing to Firestore
    const { vetByAuthor: _vetByAuthor, ...dataToStore } = freshData;

    const docRef = await db.collection('mutualAidGroups').add({
      ...dataToStore,
      vettedBy: initialVettedBy,
      createdAt: new Date(),
    });
    return { success: true, groupId: docRef.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Get mutual aid groups by category (one-time fetch, client-side sort to avoid index requirement)
export const getMutualAidGroupsByCategory = async (category) => {
  try {
    const snapshot = await db.collection('mutualAidGroups')
      .where('category', '==', category)
      .get();

    const groups = [];
    snapshot.forEach((doc) => {
      groups.push({ id: doc.id, ...doc.data() });
    });

    // Sort client-side by createdAt descending
    groups.sort((a, b) => {
      const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt instanceof Date ? a.createdAt.getTime() : 0);
      const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt instanceof Date ? b.createdAt.getTime() : 0);
      return bTime - aTime;
    });

    return { success: true, data: groups };
  } catch (error) {
    console.log('Error fetching mutual aid groups:', error.message);
    return { success: false, error: error.message };
  }
};

// Subscribe to mutual aid groups by category
export const subscribeToMutualAidGroups = (category, callback) => {
  return db.collection('mutualAidGroups')
    .where('category', '==', category)
    .orderBy('createdAt', 'desc')
    .onSnapshot((snapshot) => {
      const groups = [];
      snapshot.forEach((doc) => {
        groups.push({ id: doc.id, ...doc.data() });
      });
      callback(groups);
    }, (error) => {
      console.log('Error subscribing to mutual aid groups:', error.message);
      callback([]);
    });
};

// Get a single mutual aid group
export const getMutualAidGroup = async (groupId) => {
  try {
    const doc = await db.collection('mutualAidGroups').doc(groupId).get();
    if (doc.exists) {
      return { success: true, data: { id: doc.id, ...doc.data() } };
    }
    return { success: false, error: 'Group not found.' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Update a mutual aid group
export const updateMutualAidGroup = async (groupId, updates) => {
  try {
    await db.collection('mutualAidGroups').doc(groupId).update(updates);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Delete a mutual aid group
export const deleteMutualAidGroup = async (groupId) => {
  try {
    await db.collection('mutualAidGroups').doc(groupId).delete();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Toggle vet status for a mutual aid group
export const toggleVet = async (groupId, userId) => {
  try {
    const docRef = db.collection('mutualAidGroups').doc(groupId);
    const doc = await docRef.get();

    if (!doc.exists) return { success: false, error: 'Group not found.' };

    const vettedBy = doc.data().vettedBy || [];
    const isVetted = vettedBy.includes(userId);

    if (isVetted) {
      await docRef.update({
        vettedBy: vettedBy.filter((id) => id !== userId),
      });
    } else {
      await docRef.update({
        vettedBy: [...vettedBy, userId],
      });
    }

    return { success: true, isVetted: !isVetted };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Get vetted members for a group
export const getVettedMembers = async (groupId) => {
  try {
    const doc = await db.collection('mutualAidGroups').doc(groupId).get();
    if (!doc.exists) return { success: false, error: 'Group not found.' };

    const vettedBy = doc.data().vettedBy || [];
    const members = [];

    // Fetch user profiles for each vetted userId
    for (const uid of vettedBy) {
      const userDoc = await db.collection('users').doc(uid).get();
      if (userDoc.exists) {
        members.push({ id: userDoc.id, ...userDoc.data() });
      }
    }

    return { success: true, data: members };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Add a comment to a mutual aid group
export const addMutualAidComment = async (groupId, userId, content, parentCommentId = null) => {
  try {
    const commentRef = await db.collection('mutualAidGroups').doc(groupId)
      .collection('comments').add({
        content: validateText(content, 'comment'),
        authorId: userId,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        parentCommentId: parentCommentId || null,
      });

    const groupDoc = await db.collection('mutualAidGroups').doc(groupId).get();
    if (groupDoc.exists) {
      await db.collection('mutualAidGroups').doc(groupId).update({
        commentCount: (groupDoc.data().commentCount || 0) + 1,
      });

      // Notification handled server-side by onMutualAidCommentCreate Cloud Function
    }

    return { success: true, commentId: commentRef.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Get comments for a mutual aid group (with author info)
export const getMutualAidComments = async (groupId) => {
  try {
    const querySnapshot = await db.collection('mutualAidGroups').doc(groupId)
      .collection('comments')
      .orderBy('createdAt', 'asc')
      .get();

    const comments = [];

    for (const docSnapshot of querySnapshot.docs) {
      const commentData = docSnapshot.data();

      const authorDoc = await db.collection('users').doc(commentData.authorId).get();
      const authorData = authorDoc.exists ? authorDoc.data() : null;

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
      });
    }

    return { success: true, data: comments };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Toggle an emoji reaction on a mutual aid comment (add or remove)
export const toggleMutualAidCommentReaction = async (groupId, commentId, userId, emoji) => {
  try {
    const commentRef = db.collection('mutualAidGroups').doc(groupId)
      .collection('comments').doc(commentId);

    const commentDoc = await commentRef.get();
    if (!commentDoc.exists) return { success: false, error: 'Comment not found' };

    const reactions = commentDoc.data().reactions || {};
    const emojiReactions = reactions[emoji] || [];
    const newReactions = { ...reactions };

    if (emojiReactions.includes(userId)) {
      const updated = emojiReactions.filter((id) => id !== userId);
      if (updated.length === 0) {
        delete newReactions[emoji];
      } else {
        newReactions[emoji] = updated;
      }
    } else {
      newReactions[emoji] = [...emojiReactions, userId];
    }

    await commentRef.update({ reactions: newReactions });
    return { success: true };
  } catch (error) {
    console.log('🔴 toggleMutualAidCommentReaction error:', error.message);
    return { success: false, error: error.message };
  }
};

// Delete a comment from a mutual aid group
export const deleteMutualAidComment = async (groupId, commentId) => {
  try {
    await db.collection('mutualAidGroups').doc(groupId)
      .collection('comments').doc(commentId)
      .delete();

    const groupDoc = await db.collection('mutualAidGroups').doc(groupId).get();
    if (groupDoc.exists) {
      const currentCount = groupDoc.data().commentCount || 0;
      await db.collection('mutualAidGroups').doc(groupId).update({
        commentCount: Math.max(0, currentCount - 1),
      });
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ==================== BARTER MARKET ====================

// Create a barter market post and notify followers
export const createBarterPost = async (postData) => {
  try {
    // Validate text fields
    postData.title = validateText(postData.title, 'barterTitle');
    postData.description = validateText(postData.description, 'barterDescription');

    // Fetch fresh author profile from Firestore to avoid stale photos
    let freshData = { ...postData };
    try {
      const authorDoc = await db.collection('users').doc(postData.authorId).get();
      if (authorDoc.exists) {
        const data = authorDoc.data();
        freshData.authorName = data.name || postData.authorName || '';
        freshData.authorPhoto = data.profilePhoto || postData.authorPhoto || null;
      }
    } catch (_err) {
    }

    // Compute expiresAt: 60 days from the selected date, or 60 days from now
    const postDate = freshData.date ? new Date(freshData.date) : new Date();
    const expiresAt = new Date(postDate.getTime() + 60 * 24 * 60 * 60 * 1000);

    const docRef = await db.collection('barterMarketPosts').add({
      ...freshData,
      date: postDate,
      expiresAt,
      createdAt: new Date(),
    });

    // Follower notifications handled server-side by onBarterPostCreate Cloud Function

    return { success: true, postId: docRef.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Subscribe to barter market posts
export const subscribeToBarterPosts = (callback) => {
  return db.collection('barterMarketPosts')
    .orderBy('createdAt', 'desc')
    .onSnapshot((snapshot) => {
      const posts = [];
      snapshot.forEach((doc) => {
        posts.push({ id: doc.id, ...doc.data() });
      });
      callback(posts);
    }, (error) => {
      console.log('Error subscribing to barter posts:', error.message);
      callback([]);
    });
};

// Get all barter posts (one-time fetch, client-side sort)
export const getBarterPosts = async () => {
  try {
    const snapshot = await db.collection('barterMarketPosts')
      .get();

    const posts = [];
    snapshot.forEach((doc) => {
      posts.push({ id: doc.id, ...doc.data() });
    });

    // Sort client-side by createdAt descending
    posts.sort((a, b) => {
      const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt instanceof Date ? a.createdAt.getTime() : 0);
      const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt instanceof Date ? b.createdAt.getTime() : 0);
      return bTime - aTime;
    });

    return { success: true, data: posts };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Get a single barter post
export const getBarterPost = async (postId) => {
  try {
    const doc = await db.collection('barterMarketPosts').doc(postId).get();
    if (doc.exists) {
      return { success: true, data: { id: doc.id, ...doc.data() } };
    }
    return { success: false, error: 'Post not found.' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Update a barter post
export const updateBarterPost = async (postId, updates) => {
  try {
    // Recalculate expiresAt if date changed
    if (updates.date) {
      const postDate = new Date(updates.date);
      updates.date = postDate;
      updates.expiresAt = new Date(postDate.getTime() + 60 * 24 * 60 * 60 * 1000);
    }
    await db.collection('barterMarketPosts').doc(postId).update(updates);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Delete a barter post
export const deleteBarterPost = async (postId) => {
  try {
    await db.collection('barterMarketPosts').doc(postId).delete();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ==================== CONFLUENCE ====================

// Create a confluence post
export const createConfluencePost = async (postData) => {
  try {

    // Check monthly post count — single-field query, filter by date client-side
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const allUserPosts = await db.collection('confluencePosts')
      .where('authorId', '==', postData.authorId)
      .get();

    let monthlyCount = 0;
    allUserPosts.forEach((doc) => {
      const data = doc.data();
      const postDate = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
      if (postDate >= startOfMonth) {
        monthlyCount++;
      }
    });


    if (monthlyCount >= 10) {
      return { success: false, error: 'You have reached your 10 confluence contributions for this month.' };
    }

    // Validate text fields
    postData.caption = validateText(postData.caption, 'confluenceCaption');

    const docRef = await db.collection('confluencePosts').add({
      ...postData,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });


    // Increment lifetime confluence count on user document
    await db.collection('users').doc(postData.authorId).update({
      confluenceCount: firebase.firestore.FieldValue.increment(1),
    });

    return { success: true, postId: docRef.id };
  } catch (error) {
    console.log('🔴 createConfluencePost error:', error.message);
    return { success: false, error: error.message };
  }
};

// Subscribe to confluence posts
export const subscribeToConfluencePosts = (callback) => {
  return db.collection('confluencePosts')
    .orderBy('createdAt', 'desc')
    .onSnapshot((snapshot) => {
      const posts = [];
      snapshot.forEach((doc) => {
        posts.push({ id: doc.id, ...doc.data() });
      });
      callback(posts);
    }, (error) => {
      console.log('Error subscribing to confluence posts:', error.message);
      callback([]);
    });
};

// Get monthly post count for a user — single-field query, filter by date client-side
export const getMonthlyConfluenceCount = async (userId) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const snapshot = await db.collection('confluencePosts')
      .where('authorId', '==', userId)
      .get();

    let count = 0;
    snapshot.forEach((doc) => {
      const data = doc.data();
      const postDate = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
      if (postDate >= startOfMonth) {
        count++;
      }
    });

    return { success: true, count };
  } catch (error) {
    console.log('🔴 getMonthlyConfluenceCount error:', error.message);
    return { success: false, count: 0 };
  }
};

// Report/flag a confluence post (stores a content snapshot for admin review)
export const reportConfluencePost = async (reporterId, postId, authorId, reason, details = '', contentSnapshot = {}) => {
  try {
    await db.collection('reports').add({
      reporterId,
      reportedUserId: authorId,
      contentType: 'confluence_post',
      contentId: postId,
      reason,
      details,
      contentSnapshot: {
        imageUrl: contentSnapshot.imageUrl || null,
        caption: contentSnapshot.caption || null,
        authorId: contentSnapshot.authorId || authorId,
        postedAt: contentSnapshot.postedAt || null,
      },
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'pending',
    });
    return { success: true };
  } catch (error) {
    console.log('🔴 reportConfluencePost error:', error.message);
    return { success: false, error: error.message };
  }
};

// Check if a pending report already exists from this reporter for this confluence post
// Resolved reports (status !== 'pending') don't block new reports
export const checkExistingConfluenceReport = async (reporterId, postId) => {
  try {
    const snapshot = await db.collection('reports')
      .where('reporterId', '==', reporterId)
      .where('contentId', '==', postId)
      .where('status', '==', 'pending')
      .limit(1)
      .get();
    return { success: true, exists: !snapshot.empty };
  } catch (error) {
    console.log('🔴 checkExistingConfluenceReport error:', error.message);
    return { success: false, exists: false };
  }
};

