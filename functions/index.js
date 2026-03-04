/**
 * Collective App — Cloud Functions (Firebase Functions v2)
 *
 * Function 1:  getCloudinarySignature   — Signed Cloudinary uploads (+ daily upload limit)
 * Function 2:  cleanupExpiredPosts      — Scheduled daily post cleanup + rate limit resets
 * Function 3:  onPostCreate             — Post creation validation (10/month limit)
 * Function 4:  onMessageCreate          — Server-side push notifications (+ daily message limit)
 * Function 5:  deleteUserAccount        — User cleanup + account deletion (callable)
 * Function 6:  onReportCreate           — Notify admins when a user is reported
 * Function 7:  onGroupCommentCreate     — Comment rate limiting + notify post author (group posts)
 * Function 8:  onEventCommentCreate     — Comment rate limiting + notify event author (events)
 * Function 9:  onMutualAidCommentCreate — Comment rate limiting + notify group author (mutual aid)
 * Function 10: onChatroomMessageCreate  — Chatroom message rate limiting + subscriber notifications
 * Function 11: onBarterPostCreate       — Barter market post rate limiting + notify followers
 * Function 12: onMutualAidGroupCreate   — Mutual aid group creation rate limiting
 * Function 13: onEventCreate            — Event creation rate limiting
 * Function 14: onUserBlockUpdate        — Clean up stale subscriptionPreferences on block
 * Function 15: cleanupExpiredMessages   — Scheduled daily cleanup of messages older than 90 days
 * Function 16: onCyberLoungeRoomCreate  — Notify subscribers when host creates a Cyberlounge room
 * Function 17: onUserProfileUpdate      — Sync profile photo/name across all collections (conversations, events, mutual aid, barter, cyberlounge)
 * Function 18: onConversationCreate     — Chat request notification (push + history, server-side)
 * Function 19: onConversationStatusChange — Chat accept/decline notification (push + history, server-side)
 * Function 20: onFollowChange           — Follower notification + subscriptionPreferences cleanup on unfollow/removal
 * Function 21: onGroupMembershipChange — Sync user.groups array when group.members changes (admin SDK)
 * Function 22: onGroupDelete           — Remove groupId from all members' groups arrays on group deletion
 * Function 23: onGroupCreate           — Add groupId to initial members' groups arrays on group creation
 * Function 24: onEventCommentReaction  — Notify comment author when someone reacts to their event comment
 * Function 25: onGroupCommentReaction  — Notify comment author when someone reacts to their group post comment
 * Function 26: onMutualAidCommentReaction — Notify comment author when someone reacts to their mutual aid comment
 * Function 27: requestCategoryChat       — "Request another category" creates a DM request to the app creator (callable)
 */

const { setGlobalOptions } = require("firebase-functions/v2");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentDeleted,
} = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const logger = require("firebase-functions/logger");

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

// Global options for cost control + quota management
// memory: "256MiB" and cpu: 1 reduce per-function resource allocation
// to stay within Cloud Run's per-project CPU quota (27 functions)
setGlobalOptions({
  maxInstances: 5,
  region: "us-central1",
  memory: "256MiB",
  cpu: 1,
});

// Cloudinary credentials (loaded from functions/.env)
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;

// =============================================================
// RATE LIMIT HELPER
// =============================================================
/**
 * Atomically check and increment a rate limit counter.
 * Uses a Firestore transaction on rateLimits/{userId}.
 *
 * @param {string} userId
 * @param {string} counterField - e.g. "dailyComments", "monthlyBarterPosts"
 * @param {number} limit - max allowed in the period
 * @param {"daily"|"monthly"} resetPeriod
 * @returns {Promise<{allowed: boolean, count: number}>}
 *
 * Fails open — if the transaction errors, returns allowed: true
 * so legitimate users aren't blocked by infrastructure issues.
 */
async function checkRateLimit(userId, counterField, limit, resetPeriod) {
  const ref = db.collection("rateLimits").doc(userId);

  try {
    const result = await db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      const data = doc.exists ? doc.data() : {};
      const now = new Date();

      // Determine if counters need resetting
      let needsDailyReset = false;
      let needsMonthlyReset = false;

      if (resetPeriod === "daily") {
        const lastReset = data.lastDailyReset ? data.lastDailyReset.toDate() : new Date(0);
        needsDailyReset =
          lastReset.getFullYear() !== now.getFullYear() ||
          lastReset.getMonth() !== now.getMonth() ||
          lastReset.getDate() !== now.getDate();
      } else {
        const lastReset = data.lastMonthlyReset ? data.lastMonthlyReset.toDate() : new Date(0);
        needsMonthlyReset =
          lastReset.getFullYear() !== now.getFullYear() ||
          lastReset.getMonth() !== now.getMonth();
      }

      let currentCount = data[counterField] || 0;

      // Reset stale counters
      const updates = {};
      if (needsDailyReset) {
        updates.dailyComments = 0;
        updates.dailyMessages = 0;
        updates.dailyUploads = 0;
        updates.lastDailyReset = Timestamp.now();
        if (resetPeriod === "daily") currentCount = 0;
      }
      if (needsMonthlyReset) {
        updates.monthlyBarterPosts = 0;
        updates.monthlyMutualAidGroups = 0;
        updates.monthlyEvents = 0;
        updates.lastMonthlyReset = Timestamp.now();
        if (resetPeriod === "monthly") currentCount = 0;
      }

      // Check limit
      if (currentCount >= limit) {
        return { allowed: false, count: currentCount };
      }

      // Increment
      updates[counterField] = currentCount + 1;

      if (doc.exists) {
        tx.update(ref, updates);
      } else {
        tx.set(ref, {
          dailyComments: 0,
          dailyMessages: 0,
          dailyUploads: 0,
          monthlyBarterPosts: 0,
          monthlyMutualAidGroups: 0,
          monthlyEvents: 0,
          lastDailyReset: Timestamp.now(),
          lastMonthlyReset: Timestamp.now(),
          ...updates,
        });
      }

      return { allowed: true, count: currentCount + 1 };
    });

    return result;
  } catch (error) {
    // Fail open — don't block legit users on infra errors
    logger.error(`checkRateLimit error for ${userId}/${counterField}:`, error);
    return { allowed: true, count: -1 };
  }
}

// =============================================================
// BADGE COUNT HELPER
// =============================================================
/**
 * Get the total badge count for a user's iOS app icon.
 * Combines: unread notification history + unread DM conversations.
 * Uses Firestore count() aggregation (lightweight — doesn't download docs).
 */
async function getUnreadNotificationCount(userId, useCache = false) {
  // Optional simple in-memory cache to avoid hitting Firestore too often
  if (useCache && badgeCache[userId] && Date.now() - badgeCache[userId].timestamp < 5000) {
    return badgeCache[userId].count;
  }

  try {
    // Badge = unread notification bell items + unread DM conversations.
    // Client clears badge to 0 on app foreground so it won't appear "stuck".
    const [notifSnapshot, convosSnapshot] = await Promise.all([
      db.collection("users").doc(userId)
        .collection("notifications").where("read", "==", false).count().get(),
      db.collection("conversations")
        .where("participants", "array-contains", userId)
        .where(`unread_${userId}`, "==", true).count().get(),
    ]);

    const count = notifSnapshot.data().count + convosSnapshot.data().count;

    // Cache the result
    if (useCache) {
      badgeCache[userId] = { count, timestamp: Date.now() };
    }

    return count;
  } catch (error) {
    logger.error(`getUnreadNotificationCount error for ${userId}:`, error);
    return 0;
  }
}

// =============================================================
// FUNCTION 1: Signed Cloudinary Uploads (+ daily upload limit)
// =============================================================
exports.getCloudinarySignature = onCall(async (request) => {
  // Verify caller is authenticated
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in to upload images.");
  }

  // Check daily upload limit (50/day)
  const uploadCheck = await checkRateLimit(request.auth.uid, "dailyUploads", 50, "daily");
  if (!uploadCheck.allowed) {
    throw new HttpsError("resource-exhausted", "Daily upload limit reached. Try again tomorrow.");
  }

  const { folder, filenamePrefix, fileSize, mimeType } = request.data;
  if (!folder || typeof folder !== "string") {
    throw new HttpsError("invalid-argument", "folder is required.");
  }

  // ── Server-side file validation (10 MB limit, format whitelist) ──
  const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
  const ALLOWED_MIMES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

  if (fileSize != null) {
    if (typeof fileSize !== "number" || fileSize <= 0) {
      throw new HttpsError("invalid-argument", "Invalid file size.");
    }
    if (fileSize > MAX_SIZE) {
      throw new HttpsError("invalid-argument", "File too large. Maximum size is 10 MB.");
    }
  }

  if (mimeType != null) {
    if (typeof mimeType !== "string" || !ALLOWED_MIMES.includes(mimeType.toLowerCase())) {
      throw new HttpsError("invalid-argument", "Unsupported file format. Use JPG, PNG, or WebP.");
    }
  }

  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new HttpsError("internal", "Cloudinary credentials not configured.");
  }

  const cloudinary = require("cloudinary").v2;
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: apiKey,
    api_secret: apiSecret,
  });

  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = {
    timestamp,
    folder,
  };

  const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

  return {
    signature,
    timestamp,
    apiKey,
    cloudName: CLOUDINARY_CLOUD_NAME,
    folder,
  };
});

// =============================================================
// FUNCTION 2: Scheduled Post Cleanup (runs daily)
// =============================================================
exports.cleanupExpiredPosts = onSchedule(
  { schedule: "every 24 hours", timeZone: "America/New_York" },
  async () => {
    const now = Timestamp.now();
    let totalDeleted = 0;

    try {
      // Get all groups
      const groupsSnapshot = await db.collection("groups").get();

      for (const groupDoc of groupsSnapshot.docs) {
        const groupId = groupDoc.id;

        // Query expired posts in this group
        const expiredPosts = await db
          .collection("groups")
          .doc(groupId)
          .collection("posts")
          .where("expiresAt", "<", now)
          .get();

        if (expiredPosts.empty) continue;

        const batch = db.batch();
        let deletedInGroup = 0;

        for (const postDoc of expiredPosts.docs) {
          // Delete all comments in this post
          const commentsSnapshot = await db
            .collection("groups")
            .doc(groupId)
            .collection("posts")
            .doc(postDoc.id)
            .collection("comments")
            .get();

          for (const commentDoc of commentsSnapshot.docs) {
            batch.delete(commentDoc.ref);
          }

          // Delete the post
          batch.delete(postDoc.ref);
          deletedInGroup++;
        }

        // Update group postCount
        const currentCount = groupDoc.data().postCount || 0;
        batch.update(groupDoc.ref, {
          postCount: Math.max(0, currentCount - deletedInGroup),
        });

        await batch.commit();
        totalDeleted += deletedInGroup;

        logger.info(`Cleaned ${deletedInGroup} expired posts from group ${groupId}`);
      }

      logger.info(`Total expired posts cleaned: ${totalDeleted}`);
    } catch (error) {
      logger.error("cleanupExpiredPosts error:", error);
    }

    // Phase 2: Reset stale rate limit counters
    try {
      const today = new Date();
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const todayTimestamp = Timestamp.fromDate(startOfToday);
      const isFirstOfMonth = today.getDate() === 1;

      // Process in batches of 500
      let lastDoc = null;
      let totalReset = 0;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        let query = db.collection("rateLimits")
          .where("lastDailyReset", "<", todayTimestamp)
          .limit(500);

        if (lastDoc) {
          query = query.startAfter(lastDoc);
        }

        const snapshot = await query.get();
        if (snapshot.empty) break;

        const batch = db.batch();
        for (const doc of snapshot.docs) {
          const updates = {
            dailyComments: 0,
            dailyMessages: 0,
            dailyUploads: 0,
            lastDailyReset: Timestamp.now(),
          };

          if (isFirstOfMonth) {
            updates.monthlyBarterPosts = 0;
            updates.monthlyMutualAidGroups = 0;
            updates.monthlyEvents = 0;
            updates.lastMonthlyReset = Timestamp.now();
          }

          batch.update(doc.ref, updates);
        }

        await batch.commit();
        totalReset += snapshot.size;
        lastDoc = snapshot.docs[snapshot.docs.length - 1];

        if (snapshot.size < 500) break;
      }

      if (totalReset > 0) {
        logger.info(`Reset rate limit counters for ${totalReset} users`);
      }
    } catch (error) {
      logger.error("Rate limit cleanup error:", error);
    }
  }
);

// =============================================================
// FUNCTION 3: Post Creation Validation (10 posts/month limit)
// =============================================================
exports.onPostCreate = onDocumentCreated(
  "groups/{groupId}/posts/{postId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const postData = snapshot.data();
    const { groupId } = event.params;
    const authorId = postData.authorId;

    if (!authorId) {
      logger.warn("Post created without authorId, deleting:", snapshot.ref.path);
      await snapshot.ref.delete();
      return;
    }

    // Verify author is a member of the group (defense in depth)
    try {
      const groupDoc = await db.collection("groups").doc(groupId).get();
      if (!groupDoc.exists) {
        logger.warn("Post created in non-existent group, deleting:", snapshot.ref.path);
        await snapshot.ref.delete();
        return;
      }

      const members = groupDoc.data().members || [];
      if (!members.includes(authorId)) {
        logger.warn(`Author ${authorId} not a member of group ${groupId}, deleting post`);
        await snapshot.ref.delete();
        // Decrement postCount since createPost increments it client-side
        await db.collection("groups").doc(groupId).update({
          postCount: FieldValue.increment(-1),
        });
        return;
      }
    } catch (error) {
      logger.error("Membership check error:", error);
    }

    // Check 10-post monthly limit across all groups
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startTimestamp = Timestamp.fromDate(startOfMonth);

      // Query all groups the author is in
      const userGroupsSnapshot = await db
        .collection("groups")
        .where("members", "array-contains", authorId)
        .get();

      let monthlyPostCount = 0;

      for (const gDoc of userGroupsSnapshot.docs) {
        const postsSnapshot = await db
          .collection("groups")
          .doc(gDoc.id)
          .collection("posts")
          .where("authorId", "==", authorId)
          .where("createdAt", ">=", startTimestamp)
          .get();

        monthlyPostCount += postsSnapshot.size;
      }

      // The post that triggered this function is already counted in the query
      if (monthlyPostCount > 10) {
        logger.warn(
          `Author ${authorId} exceeded monthly post limit (${monthlyPostCount}), deleting post`
        );
        await snapshot.ref.delete();
        // Decrement postCount
        await db.collection("groups").doc(groupId).update({
          postCount: FieldValue.increment(-1),
        });
      }
    } catch (error) {
      logger.error("Monthly limit check error:", error);
    }
  }
);

// =============================================================
// FUNCTION 4: Server-Side Push Notifications on New Message
// =============================================================

exports.resetBadgeCount = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in.");
  }
  
  const userId = request.auth.uid;
  
  // Reuse your existing getUnreadNotificationCount function
  const badgeCount = await getUnreadNotificationCount(userId);
  
  return { badgeCount };
});


exports.onMessageCreate = onDocumentCreated(
  "conversations/{conversationId}/messages/{messageId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const messageData = snapshot.data();
    const { conversationId } = event.params;
    const senderId = messageData.senderId;

    if (!senderId) return;

    // Check daily message rate limit (500/day shared with chatroom messages)
    const msgCheck = await checkRateLimit(senderId, "dailyMessages", 500, "daily");
    if (!msgCheck.allowed) {
      logger.warn(`User ${senderId} exceeded daily message limit, deleting message`);
      await snapshot.ref.delete();
      return;
    }

    try {
      // Get conversation to find recipient
      const conversationDoc = await db
        .collection("conversations")
        .doc(conversationId)
        .get();

      if (!conversationDoc.exists) return;

      const conversationData = conversationDoc.data();
      const participants = conversationData.participants || [];
      const recipientId = participants.find((id) => id !== senderId);

      if (!recipientId) return;

      // Get recipient's user doc
      const recipientDoc = await db.collection("users").doc(recipientId).get();
      if (!recipientDoc.exists) return;

      const recipientData = recipientDoc.data();

      // Look up sender name from their user doc (don't trust client-provided name)
      const senderDoc = await db.collection("users").doc(senderId).get();
      const senderName = senderDoc.exists ? (senderDoc.data().name || "Someone") : "Someone";
      let notifBody;

      if (messageData.type === "group_invite") {
        notifBody = `${senderName} invited you to join "${messageData.groupName || "a group"}"`;
      } else if (messageData.type === "chatroom_invite") {
        notifBody = `${senderName} invited you to "${messageData.roomName || "a chat room"}"`;
      } else if (messageData.type === "image" || messageData.imageUrl) {
        notifBody = messageData.text
          ? `${senderName}: ${messageData.text}`
          : `${senderName} sent a photo`;
      } else {
        notifBody = `${senderName}: ${messageData.text || "New message"}`;
      }

      // Chatroom invites navigate directly to the room; all others go to the DM chat
      let notifData = { type: "message", conversationId, senderId };
      if (messageData.type === "chatroom_invite" && messageData.roomId) {
        notifData = { type: "chatroom_invite", roomId: messageData.roomId, senderId };
      }

      // Store to Firestore notification history (for in-app bell + badge)
      // Skip regular DM messages — they have their own unread indicators
      // Keep chatroom invites and group invites in history since they're actionable
      if (notifData.type !== "message") {
        await db.collection("users").doc(recipientId)
          .collection("notifications").add({
            title: senderName,
            body: notifBody,
            type: notifData.type,
            data: notifData,
            read: false,
            createdAt: FieldValue.serverTimestamp(),
          });
      }

      // Suppress push if recipient is actively viewing this conversation
      const activeScreen = recipientData.activeScreen;
      if (
        activeScreen &&
        activeScreen.type === "conversation" &&
        activeScreen.id === conversationId
      ) {
        logger.info(`Suppressed push — recipient ${recipientId} is in conversation ${conversationId}`);
        return;
      }

      // Send push notification via Expo push API (read token from private subcollection)
      const tokenDoc = await db.collection("users").doc(recipientId)
        .collection("private").doc("tokens").get();
      const pushToken = tokenDoc.exists ? tokenDoc.data().pushToken : null;
      if (!pushToken) return;

      const fetch = require("node-fetch");
      const badgeCount = await getUnreadNotificationCount(recipientId);
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: pushToken,
          sound: "default",
          title: senderName,
          body: notifBody,
          data: notifData,
          badge: badgeCount,
        }),
      });

      const result = await response.json();
      logger.info("Push notification sent:", result);
    } catch (error) {
      logger.error("onMessageCreate push notification error:", error);
    }
  }
);

// =============================================================
// FUNCTION 5: User Cleanup + Account Deletion (callable)
// =============================================================
exports.deleteUserAccount = onCall({ timeoutSeconds: 300 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in to delete account.");
  }

  const userId = request.auth.uid;
  logger.info(`deleteUserAccount called for user: ${userId}`);

  // Helper: delete all docs in a query
  const deleteQueryDocs = async (query, label) => {
    const snapshot = await query.get();
    for (const doc of snapshot.docs) {
      await doc.ref.delete();
    }
    return snapshot.size;
  };

  // Step 0: Soft-delete — immediately hide from all queries
  try {
    await db.collection("users").doc(userId).update({
      profileSetup: false,
      everyoneNetworkEnabled: false,
      accountDeleted: true,
    });
    logger.info("Step 0 done: soft-deleted user (hidden from queries)");
  } catch (err) {
    logger.warn("Step 0 error (soft-delete):", err.message);
    // Continue — we'll still try to hard delete
  }

  // STEP 0.5: HARD DELETE THE USER DOCUMENT NOW (CRITICAL)
  // This ensures the document is gone even if subsequent steps fail
  try {
    const userDocRef = db.collection("users").doc(userId);
    const userDoc = await userDocRef.get();
    if (userDoc.exists) {
      await userDocRef.delete();
      logger.info(`Step 0.5 done: HARD DELETED user document for ${userId}`);
    } else {
      logger.info(`Step 0.5: no user document found for ${userId}`);
    }
  } catch (err) {
    logger.error(`Step 0.5 failed (user doc hard delete):`, err);
    // Don't throw - continue with cleanup, but log aggressively
  }

  // Step 1: Remove user from all group member arrays
  try {
    const groupsSnapshot = await db
      .collection("groups")
      .where("members", "array-contains", userId)
      .get();
    for (const groupDoc of groupsSnapshot.docs) {
      await groupDoc.ref.update({
        members: FieldValue.arrayRemove(userId),
      });
    }
    logger.info(`Step 1 done: removed from ${groupsSnapshot.size} groups`);
  } catch (err) {
    logger.error(`Step 1 failed (groups cleanup):`, err);
  }

  // Step 2: Clean up conversations and ALL messages
  // Uses batched writes (max 500 ops per batch) for atomic, reliable deletion.
  try {
    const conversationsSnapshot = await db
      .collection("conversations")
      .where("participants", "array-contains", userId)
      .get();

    logger.info(`Step 2: found ${conversationsSnapshot.size} conversations for user ${userId}`);

    let messagesDeleted = 0;
    let conversationsDeleted = 0;

    for (const convoDoc of conversationsSnapshot.docs) {
      const convoData = convoDoc.data();
      const participants = convoData.participants || [];

      logger.info(`Step 2: processing conversation ${convoDoc.id} (${participants.length} participants)`);

      if (participants.length <= 2) {
        // 1-on-1 conversation: delete ALL messages and the conversation itself
        const messagesSnapshot = await convoDoc.ref.collection("messages").get();
        logger.info(`Step 2: conversation ${convoDoc.id} has ${messagesSnapshot.size} messages to delete`);

        // Batch delete in chunks of 490 (leave room for the conversation doc)
        const msgDocs = messagesSnapshot.docs;
        for (let i = 0; i < msgDocs.length; i += 490) {
          const batch = db.batch();
          const chunk = msgDocs.slice(i, i + 490);
          for (const msgDoc of chunk) {
            batch.delete(msgDoc.ref);
          }
          // Include conversation doc delete in the last batch
          if (i + 490 >= msgDocs.length) {
            batch.delete(convoDoc.ref);
          }
          await batch.commit();
          messagesDeleted += chunk.length;
        }

        // If no messages, still delete the conversation doc
        if (msgDocs.length === 0) {
          await convoDoc.ref.delete();
        }
        conversationsDeleted++;
      } else {
        // Group conversation (3+ participants) — remove user, delete their messages
        await convoDoc.ref.update({
          participants: FieldValue.arrayRemove(userId),
          [`deleted_${userId}`]: true,
        });

        const userMessagesSnapshot = await convoDoc.ref
          .collection("messages")
          .where("senderId", "==", userId)
          .get();

        const userMsgDocs = userMessagesSnapshot.docs;
        for (let i = 0; i < userMsgDocs.length; i += 500) {
          const batch = db.batch();
          const chunk = userMsgDocs.slice(i, i + 500);
          for (const msgDoc of chunk) {
            batch.delete(msgDoc.ref);
          }
          await batch.commit();
          messagesDeleted += chunk.length;
        }
      }
    }

    logger.info(`Step 2 done: deleted ${conversationsDeleted} conversations, ${messagesDeleted} messages`);
  } catch (err) {
    logger.error(`Step 2 failed (conversations cleanup):`, err);
  }

  // Step 2b: Delete any remaining messages by this user (safety net)
  // Requires collectionGroup index on messages.senderId — see firestore.indexes.json
  try {
    const orphanedMessages = await db
      .collectionGroup("messages")
      .where("senderId", "==", userId)
      .get();

    logger.info(`Step 2b: found ${orphanedMessages.size} orphaned messages`);

    const orphanDocs = orphanedMessages.docs;
    for (let i = 0; i < orphanDocs.length; i += 500) {
      const batch = db.batch();
      const chunk = orphanDocs.slice(i, i + 500);
      for (const msgDoc of chunk) {
        batch.delete(msgDoc.ref);
      }
      await batch.commit();
    }

    logger.info(`Step 2b done: deleted ${orphanedMessages.size} orphaned messages`);
  } catch (err) {
    logger.error(`Step 2b failed (orphaned messages — may need collectionGroup index):`, err);
  }



  // Step 3: Remove user from other users' subscribedUsers, hiddenUsers, blockedUsers, blockedBy
  try {
    const arrayFields = ["subscribedUsers", "hiddenUsers", "blockedUsers", "blockedBy"];
    let totalCleaned = 0;
    for (const field of arrayFields) {
      const snapshot = await db
        .collection("users")
        .where(field, "array-contains", userId)
        .get();
      for (const doc of snapshot.docs) {
        await doc.ref.update({
          [field]: FieldValue.arrayRemove(userId),
        });
      }
      totalCleaned += snapshot.size;
    }
    logger.info(`Step 3 done: cleaned ${totalCleaned} user references`);
  } catch (err) {
    logger.error(`Step 3 failed (user references cleanup):`, err);
  }

  // Step 4: Delete user's notifications and private subcollections
  try {
    const notifCount = await deleteQueryDocs(
      db.collection("users").doc(userId).collection("notifications"),
      "notifications"
    );
    const privateCount = await deleteQueryDocs(
      db.collection("users").doc(userId).collection("private"),
      "private"
    );
    logger.info(`Step 4 done: deleted ${notifCount} notifications, ${privateCount} private docs`);
  } catch (err) {
    logger.error(`Step 4 failed (subcollections cleanup):`, err);
  }

  // Step 5: Delete user-created groups and their subcollections (posts + comments)
  try {
    const userGroups = await db
      .collection("groups")
      .where("creatorId", "==", userId)
      .get();
    let postsDeleted = 0;
    let commentsDeleted = 0;
    for (const groupDoc of userGroups.docs) {
      // Delete all comments in all posts of this group
      const posts = await groupDoc.ref.collection("posts").get();
      for (const postDoc of posts.docs) {
        const comments = await postDoc.ref.collection("comments").get();
        for (const commentDoc of comments.docs) {
          await commentDoc.ref.delete();
          commentsDeleted++;
        }
        await postDoc.ref.delete();
        postsDeleted++;
      }
      await groupDoc.ref.delete();
    }
    logger.info(`Step 5 done: deleted ${userGroups.size} groups, ${postsDeleted} posts, ${commentsDeleted} comments`);
  } catch (err) {
    logger.error(`Step 5 failed (user groups cleanup):`, err);
  }

  // Step 6: Delete user's posts in OTHER groups (collectionGroup query)
  // Requires collectionGroup index on posts.authorId — see firestore.indexes.json
  try {
    const userPosts = await db
      .collectionGroup("posts")
      .where("authorId", "==", userId)
      .get();
    logger.info(`Step 6: found ${userPosts.size} posts by user in other groups`);
    let commentsDeleted = 0;
    for (const postDoc of userPosts.docs) {
      // Delete comments on this post
      const comments = await postDoc.ref.collection("comments").get();
      const batch = db.batch();
      for (const commentDoc of comments.docs) {
        batch.delete(commentDoc.ref);
        commentsDeleted++;
      }
      batch.delete(postDoc.ref);
      await batch.commit();
    }
    logger.info(`Step 6 done: deleted ${userPosts.size} posts, ${commentsDeleted} comments`);
  } catch (err) {
    logger.error(`Step 6 failed (user posts cleanup — may need collectionGroup index):`, err);
  }

  // Step 7: Delete user's comments across all collections (collectionGroup)
  // Requires collectionGroup index on comments.authorId — see firestore.indexes.json
  try {
    const userComments = await db
      .collectionGroup("comments")
      .where("authorId", "==", userId)
      .get();
    logger.info(`Step 7: found ${userComments.size} comments by user`);
    const commentDocs = userComments.docs;
    for (let i = 0; i < commentDocs.length; i += 500) {
      const batch = db.batch();
      const chunk = commentDocs.slice(i, i + 500);
      for (const commentDoc of chunk) {
        batch.delete(commentDoc.ref);
      }
      await batch.commit();
    }
    logger.info(`Step 7 done: deleted ${userComments.size} comments`);
  } catch (err) {
    logger.error(`Step 7 failed (user comments cleanup — may need collectionGroup index):`, err);
  }

  // Step 8: Delete user's events
  try {
    const count = await deleteQueryDocs(
      db.collection("events").where("authorId", "==", userId),
      "events"
    );
    logger.info(`Step 8 done: deleted ${count} events`);
  } catch (err) {
    logger.error(`Step 8 failed (events cleanup):`, err);
  }

  // Step 9: Delete user's mutual aid groups
  try {
    const userMutualAid = await db
      .collection("mutualAidGroups")
      .where("authorId", "==", userId)
      .get();
    for (const doc of userMutualAid.docs) {
      // Delete comments subcollection first
      const comments = await doc.ref.collection("comments").get();
      for (const commentDoc of comments.docs) {
        await commentDoc.ref.delete();
      }
      await doc.ref.delete();
    }
    logger.info(`Step 9 done: deleted ${userMutualAid.size} mutual aid groups`);
  } catch (err) {
    logger.error(`Step 9 failed (mutual aid cleanup):`, err);
  }

  // Step 10: Delete user's barter market posts
  try {
    const count = await deleteQueryDocs(
      db.collection("barterMarketPosts").where("authorId", "==", userId),
      "barterMarketPosts"
    );
    logger.info(`Step 10 done: deleted ${count} barter posts`);
  } catch (err) {
    logger.error(`Step 10 failed (barter posts cleanup):`, err);
  }

  // Step 11: Delete user's confluence posts
  try {
    const count = await deleteQueryDocs(
      db.collection("confluencePosts").where("authorId", "==", userId),
      "confluencePosts"
    );
    logger.info(`Step 11 done: deleted ${count} confluence posts`);
  } catch (err) {
    logger.error(`Step 11 failed (confluence posts cleanup):`, err);
  }

  // Step 12: Delete user's cyber lounge messages (collectionGroup)
  // Requires collectionGroup index on messages.senderId — see firestore.indexes.json
  // Note: Step 2b already handles this as a safety net. This step catches any that
  // were created between Step 2b and now (shouldn't happen, but just in case).
  try {
    const userMessages = await db
      .collectionGroup("messages")
      .where("senderId", "==", userId)
      .get();
    logger.info(`Step 12: found ${userMessages.size} remaining messages by user`);
    const msgDocs = userMessages.docs;
    for (let i = 0; i < msgDocs.length; i += 500) {
      const batch = db.batch();
      const chunk = msgDocs.slice(i, i + 500);
      for (const msgDoc of chunk) {
        batch.delete(msgDoc.ref);
      }
      await batch.commit();
    }
    logger.info(`Step 12 done: deleted ${userMessages.size} lounge/chat messages`);
  } catch (err) {
    logger.error(`Step 12 failed (messages cleanup — may need collectionGroup index):`, err);
  }

  // Step 12b: Delete user's Cyberlounge rooms (and their messages subcollections)
  try {
    const userRooms = await db.collection("cyberLoungeRooms")
      .where("hostId", "==", userId)
      .get();
    let roomMsgsDeleted = 0;
    for (const roomDoc of userRooms.docs) {
      const msgs = await roomDoc.ref.collection("messages").get();
      for (const msg of msgs.docs) {
        await msg.ref.delete();
        roomMsgsDeleted++;
      }
      await roomDoc.ref.delete();
    }
    logger.info(`Step 12b done: deleted ${userRooms.size} cyberlounge rooms, ${roomMsgsDeleted} room messages`);
  } catch (err) {
    logger.error(`Step 12b failed (cyberlounge rooms cleanup):`, err);
  }

  // Step 13: Delete user's rate limits document
  try {
    const rateLimitRef = db.collection("rateLimits").doc(userId);
    const rateLimitDoc = await rateLimitRef.get();
    if (rateLimitDoc.exists) {
      await rateLimitRef.delete();
    }
    logger.info(`Step 13 done: deleted rate limits`);
  } catch (err) {
    logger.error(`Step 13 failed (rate limits cleanup):`, err);
  }

  // Step 14: Delete user's reports
  try {
    const count = await deleteQueryDocs(
      db.collection("reports").where("reporterId", "==", userId),
      "reports"
    );
    logger.info(`Step 14 done: deleted ${count} reports`);
  } catch (err) {
    logger.error(`Step 14 failed (reports cleanup):`, err);
  }

  // Note: Step 15 (original user doc delete) is now handled in Step 0.5
  // Keeping this as a safety net in case Step 0.5 failed
  try {
    const userDocRef = db.collection("users").doc(userId);
    const userDoc = await userDocRef.get();
    if (userDoc.exists) {
      await userDocRef.delete();
      logger.info(`Step 15 safety net: deleted user document for ${userId}`);
    }
  } catch (err) {
    logger.error(`Step 15 safety net failed (user doc delete):`, err);
  }

  // Step 16: Delete the Firebase Auth account (critical)
  try {
    await getAuth().deleteUser(userId);
    logger.info(`Step 16 done: deleted auth account for ${userId}`);
  } catch (err) {
    logger.error(`Step 16 failed (auth delete):`, err);
    throw new HttpsError("internal", `Failed to delete auth account: ${err.message}`);
  }

  return { success: true };
});

// =============================================================
// FUNCTION 6: Notify Admins on User Report
// =============================================================
exports.onReportCreate = onDocumentCreated(
  "reports/{reportId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const reportData = snapshot.data();
    const { reportId } = event.params;

    const reporterId = reportData.reporterId || "Unknown";
    const reportedUserId = reportData.reportedUserId || "Unknown";
    const reason = reportData.reason || "No reason provided";
    const details = reportData.details || "";

    try {
      // Look up reporter and reported user names for a readable notification
      let reporterName = reporterId;
      let reportedName = reportedUserId;

      try {
        const reporterDoc = await db.collection("users").doc(reporterId).get();
        if (reporterDoc.exists) {
          reporterName = reporterDoc.data().name || reporterId;
        }
        const reportedDoc = await db.collection("users").doc(reportedUserId).get();
        if (reportedDoc.exists) {
          reportedName = reportedDoc.data().name || reportedUserId;
        }
      } catch (nameErr) {
        logger.warn("Could not fetch user names for report:", nameErr.message);
      }

      // Get all admin push tokens
      const adminTokensSnapshot = await db.collection("adminTokens").get();

      if (adminTokensSnapshot.empty) {
        logger.warn("No admin tokens found — no one to notify about report", reportId);
        return;
      }

      const tokens = [];
      adminTokensSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.pushToken) {
          tokens.push(data.pushToken);
        }
      });

      if (tokens.length === 0) {
        logger.warn("Admin tokens collection exists but no valid tokens found");
        return;
      }

      // Build notification body
      const contentType = reportData.contentType || null;
      let notifTitle, notifBody;

      if (contentType === "confluence_post") {
        notifTitle = "Content Reported";
        notifBody = details
          ? `${reporterName} reported a confluence post by ${reportedName} for: ${reason} — "${details}"`
          : `${reporterName} reported a confluence post by ${reportedName} for: ${reason}`;
      } else {
        notifTitle = "User Reported";
        notifBody = details
          ? `${reporterName} reported ${reportedName} for: ${reason} — "${details}"`
          : `${reporterName} reported ${reportedName} for: ${reason}`;
      }

      // Send push notification to all admin devices via Expo Push API
      const fetch = require("node-fetch");
      const messages = tokens.map((token) => ({
        to: token,
        sound: "default",
        title: notifTitle,
        body: notifBody,
        data: {
          type: "user_report",
          reportId,
          reporterId,
          reportedUserId,
          reason,
        },
      }));

      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
      });

      const result = await response.json();
      logger.info(`Admin report notification sent to ${tokens.length} admin(s):`, result);

      // Store to notification history for each admin (for in-app bell + badge)
      for (const adminDoc of adminTokensSnapshot.docs) {
        await db.collection("users").doc(adminDoc.id)
          .collection("notifications").add({
            title: notifTitle,
            body: notifBody,
            type: "user_report",
            data: { type: "user_report", reportId, reporterId, reportedUserId, reason },
            read: false,
            createdAt: FieldValue.serverTimestamp(),
          });
      }
    } catch (error) {
      logger.error("onReportCreate error:", error);
    }
  }
);

// =============================================================
// FUNCTION 7: Group Comment Rate Limiting (50/day) + Notify Post Author
// =============================================================
exports.onGroupCommentCreate = onDocumentCreated(
  "groups/{groupId}/posts/{postId}/comments/{commentId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const commentData = snapshot.data();
    const authorId = commentData.authorId;
    if (!authorId) return;

    const { groupId, postId } = event.params;

    const check = await checkRateLimit(authorId, "dailyComments", 50, "daily");
    if (!check.allowed) {
      logger.warn(`User ${authorId} exceeded daily comment limit, deleting comment`);
      await snapshot.ref.delete();
      try {
        await db.collection("groups").doc(groupId)
          .collection("posts").doc(postId)
          .update({ commentCount: FieldValue.increment(-1) });
      } catch (e) {
        logger.error("Failed to decrement commentCount:", e);
      }
      return;
    }

    // Update group updatedAt to trigger activity dot on dashboard
    try {
      await db.collection("groups").doc(groupId)
        .update({ updatedAt: FieldValue.serverTimestamp() });
    } catch (e) {
      logger.error("Failed to update group updatedAt on comment:", e);
    }

    // Notify post author for top-level comments only
    if (!commentData.parentCommentId) {
      try {
        const postDoc = await db.collection("groups").doc(groupId)
          .collection("posts").doc(postId).get();
        if (!postDoc.exists) return;

        const postAuthorId = postDoc.data().authorId;
        if (!postAuthorId || postAuthorId === authorId) return;

        const authorDoc = await db.collection("users").doc(postAuthorId).get();
        if (!authorDoc.exists) return;
        if (authorDoc.data().commentNotifications === false) return;

        const commenterDoc = await db.collection("users").doc(authorId).get();
        const commenterName = commenterDoc.exists ? commenterDoc.data().name : "Someone";
        const postTitle = postDoc.data().title || "your post";

        await db.collection("users").doc(postAuthorId)
          .collection("notifications").add({
            title: "New Comment",
            body: `${commenterName} commented on "${postTitle}"`,
            type: "groupPostComment",
            data: { type: "groupPostComment", groupId, postId },
            read: false,
            createdAt: FieldValue.serverTimestamp(),
          });

        // Push notification
        const isMuted = authorDoc.data().notificationsMuted === true;
        logger.info(`Group comment push: postAuthorId=${postAuthorId}, muted=${isMuted}`);
        if (!isMuted) {
          const tokenDoc = await db.collection("users").doc(postAuthorId)
            .collection("private").doc("tokens").get();
          const pushToken = tokenDoc.exists ? tokenDoc.data().pushToken : null;
          logger.info(`Group comment push: tokenExists=${tokenDoc.exists}, pushToken=${pushToken ? "yes" : "null"}`);
          if (pushToken) {
            const fetch = require("node-fetch");
            const badgeCount = await getUnreadNotificationCount(postAuthorId);
            const pushResponse = await fetch("https://exp.host/--/api/v2/push/send", {
              method: "POST",
              headers: {
                Accept: "application/json",
                "Accept-Encoding": "gzip, deflate",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                to: pushToken,
                sound: "default",
                title: "New Comment",
                body: `${commenterName} commented on "${postTitle}"`,
                data: { type: "groupPostComment", groupId, postId },
                badge: badgeCount,
              }),
            });
            const pushResult = await pushResponse.json();
            logger.info("Group comment push result:", pushResult);
          } else {
            logger.warn(`Group comment push: NO push token for user ${postAuthorId}`);
          }
        } else {
          logger.info(`Group comment push: skipped — user ${postAuthorId} has notifications muted`);
        }
      } catch (error) {
        logger.error("Group comment notification error:", error);
      }
    }

    // Notify parent comment author for replies
    if (commentData.parentCommentId) {
      try {
        const parentCommentDoc = await db.collection("groups").doc(groupId)
          .collection("posts").doc(postId)
          .collection("comments").doc(commentData.parentCommentId).get();

        if (parentCommentDoc.exists) {
          const parentAuthorId = parentCommentDoc.data().authorId;
          if (parentAuthorId && parentAuthorId !== authorId) {
            const commenterDoc = await db.collection("users").doc(authorId).get();
            const commenterName = commenterDoc.exists ? commenterDoc.data().name : "Someone";

            // In-app notification
            await db.collection("users").doc(parentAuthorId)
              .collection("notifications").add({
                title: "New Reply",
                body: `${commenterName} replied to your comment`,
                type: "groupPostCommentReply",
                data: { type: "groupPostCommentReply", groupId, postId },
                read: false,
                createdAt: FieldValue.serverTimestamp(),
              });

            // Push notification
            const parentAuthorDoc = await db.collection("users").doc(parentAuthorId).get();
            if (parentAuthorDoc.exists && parentAuthorDoc.data().notificationsMuted !== true) {
              const tokenDoc = await db.collection("users").doc(parentAuthorId)
                .collection("private").doc("tokens").get();
              const pushToken = tokenDoc.exists ? tokenDoc.data().pushToken : null;
              if (pushToken) {
                const fetch = require("node-fetch");
                const badgeCount = await getUnreadNotificationCount(parentAuthorId);
                await fetch("https://exp.host/--/api/v2/push/send", {
                  method: "POST",
                  headers: {
                    Accept: "application/json",
                    "Accept-Encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    to: pushToken,
                    sound: "default",
                    title: "New Reply",
                    body: `${commenterName} replied to your comment`,
                    data: { type: "groupPostCommentReply", groupId, postId },
                    badge: badgeCount,
                  }),
                });
              }
            }
          }
        }
      } catch (error) {
        logger.error("Group comment reply notification error:", error);
      }
    }

    // Notify post subscribers (users who opted in via the bell icon)
    try {
      const postDoc = await db.collection("groups").doc(groupId)
        .collection("posts").doc(postId).get();
      if (postDoc.exists) {
        const subscribers = postDoc.data().subscribers || [];
        const postAuthorId = postDoc.data().authorId;
        const parentCommentAuthorId = commentData.parentCommentId
          ? await (async () => {
              const pDoc = await db.collection("groups").doc(groupId)
                .collection("posts").doc(postId)
                .collection("comments").doc(commentData.parentCommentId).get();
              return pDoc.exists ? pDoc.data().authorId : null;
            })()
          : null;

        if (subscribers.length > 0) {
          const commenterDoc = await db.collection("users").doc(authorId).get();
          const commenterName = commenterDoc.exists ? commenterDoc.data().name : "Someone";
          const postTitle = postDoc.data().title || "a post";

          for (const subscriberId of subscribers) {
            // Skip the commenter, post author (already notified), and reply parent author (already notified)
            if (subscriberId === authorId) continue;
            if (subscriberId === postAuthorId) continue;
            if (subscriberId === parentCommentAuthorId) continue;

            await db.collection("users").doc(subscriberId)
              .collection("notifications").add({
                title: "Post Activity",
                body: `${commenterName} commented on "${postTitle}"`,
                type: "groupPostSubscription",
                data: { type: "groupPostSubscription", groupId, postId },
                read: false,
                createdAt: FieldValue.serverTimestamp(),
              });
          }
        }
      }
    } catch (error) {
      logger.error("Post subscriber notification error:", error);
    }
  }
);

// =============================================================
// FUNCTION 8: Event Comment Rate Limiting (50/day shared) + Notify Event Author
// =============================================================
exports.onEventCommentCreate = onDocumentCreated(
  "events/{eventId}/comments/{commentId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const commentData = snapshot.data();
    const authorId = commentData.authorId;
    if (!authorId) return;

    const { eventId } = event.params;

    const check = await checkRateLimit(authorId, "dailyComments", 50, "daily");
    if (!check.allowed) {
      logger.warn(`User ${authorId} exceeded daily comment limit (event), deleting comment`);
      await snapshot.ref.delete();
      try {
        await db.collection("events").doc(eventId)
          .update({ commentCount: FieldValue.increment(-1) });
      } catch (e) {
        logger.error("Failed to decrement event commentCount:", e);
      }
      return;
    }

    // Update event updatedAt to trigger activity dot on dashboard
    try {
      await db.collection("events").doc(eventId)
        .update({ updatedAt: FieldValue.serverTimestamp() });
    } catch (e) {
      logger.error("Failed to update event updatedAt on comment:", e);
    }

    // Notify event author for top-level comments only
    if (!commentData.parentCommentId) {
      try {
        const eventDoc = await db.collection("events").doc(eventId).get();
        if (!eventDoc.exists) return;

        const eventAuthorId = eventDoc.data().authorId;
        if (!eventAuthorId || eventAuthorId === authorId) return;

        const eventAuthorDoc = await db.collection("users").doc(eventAuthorId).get();
        if (!eventAuthorDoc.exists) return;
        if (eventAuthorDoc.data().commentNotifications === false) return;

        const commenterDoc = await db.collection("users").doc(authorId).get();
        const commenterName = commenterDoc.exists ? commenterDoc.data().name : "Someone";
        const eventTitle = eventDoc.data().title || "your event";

        await db.collection("users").doc(eventAuthorId)
          .collection("notifications").add({
            title: "New Comment",
            body: `${commenterName} commented on "${eventTitle}"`,
            type: "eventComment",
            data: { type: "eventComment", eventId },
            read: false,
            createdAt: FieldValue.serverTimestamp(),
          });

        // Push notification
        if (eventAuthorDoc.data().notificationsMuted !== true) {
          const tokenDoc = await db.collection("users").doc(eventAuthorId)
            .collection("private").doc("tokens").get();
          const pushToken = tokenDoc.exists ? tokenDoc.data().pushToken : null;
          if (pushToken) {
            const fetch = require("node-fetch");
            const badgeCount = await getUnreadNotificationCount(eventAuthorId);
            await fetch("https://exp.host/--/api/v2/push/send", {
              method: "POST",
              headers: {
                Accept: "application/json",
                "Accept-Encoding": "gzip, deflate",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                to: pushToken,
                sound: "default",
                title: "New Comment",
                body: `${commenterName} commented on "${eventTitle}"`,
                data: { type: "eventComment", eventId },
                badge: badgeCount,
              }),
            });
          }
        }
      } catch (error) {
        logger.error("Event comment notification error:", error);
      }
    }

    // Notify parent comment author for replies
    if (commentData.parentCommentId) {
      try {
        const parentCommentDoc = await db.collection("events").doc(eventId)
          .collection("comments").doc(commentData.parentCommentId).get();

        if (parentCommentDoc.exists) {
          const parentAuthorId = parentCommentDoc.data().authorId;
          if (parentAuthorId && parentAuthorId !== authorId) {
            const commenterDoc = await db.collection("users").doc(authorId).get();
            const commenterName = commenterDoc.exists ? commenterDoc.data().name : "Someone";

            // In-app notification
            await db.collection("users").doc(parentAuthorId)
              .collection("notifications").add({
                title: "New Reply",
                body: `${commenterName} replied to your comment`,
                type: "eventCommentReply",
                data: { type: "eventCommentReply", eventId },
                read: false,
                createdAt: FieldValue.serverTimestamp(),
              });

            // Push notification
            const parentAuthorDoc = await db.collection("users").doc(parentAuthorId).get();
            if (parentAuthorDoc.exists && parentAuthorDoc.data().notificationsMuted !== true) {
              const tokenDoc = await db.collection("users").doc(parentAuthorId)
                .collection("private").doc("tokens").get();
              const pushToken = tokenDoc.exists ? tokenDoc.data().pushToken : null;
              if (pushToken) {
                const fetch = require("node-fetch");
                const badgeCount = await getUnreadNotificationCount(parentAuthorId);
                await fetch("https://exp.host/--/api/v2/push/send", {
                  method: "POST",
                  headers: {
                    Accept: "application/json",
                    "Accept-Encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    to: pushToken,
                    sound: "default",
                    title: "New Reply",
                    body: `${commenterName} replied to your comment`,
                    data: { type: "eventCommentReply", eventId },
                    badge: badgeCount,
                  }),
                });
              }
            }
          }
        }
      } catch (error) {
        logger.error("Event comment reply notification error:", error);
      }
    }
  }
);

// =============================================================
// FUNCTION 9: Mutual Aid Comment Rate Limiting (50/day shared) + Notify Group Author
// =============================================================
exports.onMutualAidCommentCreate = onDocumentCreated(
  "mutualAidGroups/{groupId}/comments/{commentId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const commentData = snapshot.data();
    const authorId = commentData.authorId;
    if (!authorId) return;

    const { groupId } = event.params;

    const check = await checkRateLimit(authorId, "dailyComments", 50, "daily");
    if (!check.allowed) {
      logger.warn(`User ${authorId} exceeded daily comment limit (mutual aid), deleting comment`);
      await snapshot.ref.delete();
      try {
        await db.collection("mutualAidGroups").doc(groupId)
          .update({ commentCount: FieldValue.increment(-1) });
      } catch (e) {
        logger.error("Failed to decrement mutual aid commentCount:", e);
      }
      return;
    }

    // Update mutual aid group updatedAt to trigger activity dot on dashboard
    try {
      await db.collection("mutualAidGroups").doc(groupId)
        .update({ updatedAt: FieldValue.serverTimestamp() });
    } catch (e) {
      logger.error("Failed to update mutual aid group updatedAt on comment:", e);
    }

    // Notify group author for top-level comments only
    if (!commentData.parentCommentId) {
      try {
        const groupDoc = await db.collection("mutualAidGroups").doc(groupId).get();
        if (!groupDoc.exists) return;

        const groupAuthorId = groupDoc.data().authorId;
        if (!groupAuthorId || groupAuthorId === authorId) return;

        const groupAuthorDoc = await db.collection("users").doc(groupAuthorId).get();
        if (!groupAuthorDoc.exists) return;
        if (groupAuthorDoc.data().commentNotifications === false) return;

        const commenterDoc = await db.collection("users").doc(authorId).get();
        const commenterName = commenterDoc.exists ? commenterDoc.data().name : "Someone";
        const groupName = groupDoc.data().name || "your mutual aid group";

        await db.collection("users").doc(groupAuthorId)
          .collection("notifications").add({
            title: "New Comment",
            body: `${commenterName} commented on "${groupName}"`,
            type: "mutualAidComment",
            data: { type: "mutualAidComment", groupId },
            read: false,
            createdAt: FieldValue.serverTimestamp(),
          });

        // Push notification
        if (groupAuthorDoc.data().notificationsMuted !== true) {
          const tokenDoc = await db.collection("users").doc(groupAuthorId)
            .collection("private").doc("tokens").get();
          const pushToken = tokenDoc.exists ? tokenDoc.data().pushToken : null;
          if (pushToken) {
            const fetch = require("node-fetch");
            const badgeCount = await getUnreadNotificationCount(groupAuthorId);
            await fetch("https://exp.host/--/api/v2/push/send", {
              method: "POST",
              headers: {
                Accept: "application/json",
                "Accept-Encoding": "gzip, deflate",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                to: pushToken,
                sound: "default",
                title: "New Comment",
                body: `${commenterName} commented on "${groupName}"`,
                data: { type: "mutualAidComment", groupId },
                badge: badgeCount,
              }),
            });
          }
        }
      } catch (error) {
        logger.error("Mutual aid comment notification error:", error);
      }
    }

    // Notify parent comment author for replies
    if (commentData.parentCommentId) {
      try {
        const parentCommentDoc = await db.collection("mutualAidGroups").doc(groupId)
          .collection("comments").doc(commentData.parentCommentId).get();

        if (parentCommentDoc.exists) {
          const parentAuthorId = parentCommentDoc.data().authorId;
          if (parentAuthorId && parentAuthorId !== authorId) {
            const commenterDoc = await db.collection("users").doc(authorId).get();
            const commenterName = commenterDoc.exists ? commenterDoc.data().name : "Someone";

            // In-app notification
            await db.collection("users").doc(parentAuthorId)
              .collection("notifications").add({
                title: "New Reply",
                body: `${commenterName} replied to your comment`,
                type: "mutualAidCommentReply",
                data: { type: "mutualAidCommentReply", groupId },
                read: false,
                createdAt: FieldValue.serverTimestamp(),
              });

            // Push notification
            const parentAuthorDoc = await db.collection("users").doc(parentAuthorId).get();
            if (parentAuthorDoc.exists && parentAuthorDoc.data().notificationsMuted !== true) {
              const tokenDoc = await db.collection("users").doc(parentAuthorId)
                .collection("private").doc("tokens").get();
              const pushToken = tokenDoc.exists ? tokenDoc.data().pushToken : null;
              if (pushToken) {
                const fetch = require("node-fetch");
                const badgeCount = await getUnreadNotificationCount(parentAuthorId);
                await fetch("https://exp.host/--/api/v2/push/send", {
                  method: "POST",
                  headers: {
                    Accept: "application/json",
                    "Accept-Encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    to: pushToken,
                    sound: "default",
                    title: "New Reply",
                    body: `${commenterName} replied to your comment`,
                    data: { type: "mutualAidCommentReply", groupId },
                    badge: badgeCount,
                  }),
                });
              }
            }
          }
        }
      } catch (error) {
        logger.error("Mutual aid comment reply notification error:", error);
      }
    }
  }
);

// =============================================================
// FUNCTION 10: Chatroom Message Rate Limiting + Subscriber Notifs
// =============================================================
exports.onChatroomMessageCreate = onDocumentCreated(
  "cyberLoungeRooms/{roomId}/messages/{messageId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const messageData = snapshot.data();
    const senderId = messageData.senderId;
    if (!senderId) return;

    // Rate limiting (500/day)
    const check = await checkRateLimit(senderId, "dailyMessages", 500, "daily");
    if (!check.allowed) {
      logger.warn(`User ${senderId} exceeded daily message limit (chatroom), deleting message`);
      await snapshot.ref.delete();
      return;
    }

    // No notifications — users must be in the room to see messages.
    // Initial room creation notification (Function 16) handles the invitation to join.
  }
);

// =============================================================
// FUNCTION 11: Barter Market Post Rate Limiting (15/month) + Notify Followers
// =============================================================
exports.onBarterPostCreate = onDocumentCreated(
  "barterMarketPosts/{postId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const postData = snapshot.data();
    const authorId = postData.authorId || postData.userId;
    if (!authorId) return;

    const { postId } = event.params;

    const check = await checkRateLimit(authorId, "monthlyBarterPosts", 15, "monthly");
    if (!check.allowed) {
      logger.warn(`User ${authorId} exceeded monthly barter post limit, deleting`);
      await snapshot.ref.delete();
      return;
    }

    // Notify followers who have barterMarketPosts notifications enabled
    try {
      const followersSnapshot = await db.collection("users")
        .where("subscribedUsers", "array-contains", authorId)
        .get();

      if (followersSnapshot.empty) return;

      // Get author name
      const authorDoc = await db.collection("users").doc(authorId).get();
      const authorName = authorDoc.exists ? authorDoc.data().name : "Someone";
      const postTitle = postData.title || "a new barter";

      for (const followerDoc of followersSnapshot.docs) {
        if (followerDoc.id === authorId) continue;

        const followerData = followerDoc.data();
        const prefs = followerData.subscriptionPreferences?.[authorId];
        if (prefs && prefs.barterMarketPosts === false) continue;

        // In-app notification
        await db.collection("users").doc(followerDoc.id)
          .collection("notifications").add({
            title: "New Barter Post",
            body: `${authorName} posted "${postTitle}" on the Barter Market`,
            type: "barterMarketPost",
            data: { type: "barterMarketPost", postId, authorId },
            read: false,
            createdAt: FieldValue.serverTimestamp(),
          });

        // Push notification
        if (followerData.notificationsMuted !== true) {
          const tokenDoc = await db.collection("users").doc(followerDoc.id)
            .collection("private").doc("tokens").get();
          const pushToken = tokenDoc.exists ? tokenDoc.data().pushToken : null;
          if (pushToken) {
            const fetch = require("node-fetch");
            const badgeCount = await getUnreadNotificationCount(followerDoc.id);
            await fetch("https://exp.host/--/api/v2/push/send", {
              method: "POST",
              headers: {
                Accept: "application/json",
                "Accept-Encoding": "gzip, deflate",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                to: pushToken,
                sound: "default",
                title: "New Barter Post",
                body: `${authorName} posted "${postTitle}" on the Barter Market`,
                data: { type: "barterMarketPost", postId, authorId },
                badge: badgeCount,
              }),
            });
          }
        }
      }
    } catch (error) {
      logger.error("Barter post follower notification error:", error);
    }
  }
);

// =============================================================
// FUNCTION 12: Mutual Aid Group Creation Rate Limiting (10/month) + Notify Followers
// =============================================================
exports.onMutualAidGroupCreate = onDocumentCreated(
  "mutualAidGroups/{groupId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const postData = snapshot.data();
    const authorId = postData.authorId;
    if (!authorId) return;

    const { groupId } = event.params;

    const check = await checkRateLimit(authorId, "monthlyMutualAidGroups", 10, "monthly");
    if (!check.allowed) {
      logger.warn(`User ${authorId} exceeded monthly mutual aid group limit, deleting`);
      await snapshot.ref.delete();
      return;
    }

    // Notify followers who have mutualAidPosts notifications enabled
    try {
      const followersSnapshot = await db.collection("users")
        .where("subscribedUsers", "array-contains", authorId)
        .get();

      if (followersSnapshot.empty) return;

      // Get author name from their user doc (don't trust client-provided name)
      const authorDoc = await db.collection("users").doc(authorId).get();
      const authorName = authorDoc.exists ? (authorDoc.data().name || "Someone") : "Someone";
      const groupName = postData.name || "a new mutual aid group";

      const fetch = require("node-fetch");
      const pushMessages = [];
      const notifTitle = "New Mutual Aid Post";
      const notifBody = `${authorName} posted "${groupName}" in Mutual Aid`;
      const notifData = { type: "mutualAidGroup", groupId, authorId };

      for (const followerDoc of followersSnapshot.docs) {
        if (followerDoc.id === authorId) continue;

        const followerData = followerDoc.data();
        const prefs = followerData.subscriptionPreferences?.[authorId];
        if (prefs && prefs.mutualAidPosts === false) continue;

        // Store to Firestore notification history (for in-app bell + badge)
        await db.collection("users").doc(followerDoc.id)
          .collection("notifications").add({
            title: notifTitle,
            body: notifBody,
            type: "mutualAidGroup",
            data: notifData,
            read: false,
            createdAt: FieldValue.serverTimestamp(),
          });

        // Send push notification (read token from private subcollection)
        const tokenDoc = await db.collection("users").doc(followerDoc.id)
          .collection("private").doc("tokens").get();
        const pushToken = tokenDoc.exists ? tokenDoc.data().pushToken : null;
        if (pushToken) {
          const badgeCount = await getUnreadNotificationCount(followerDoc.id);
          pushMessages.push({
            to: pushToken,
            sound: "default",
            title: notifTitle,
            body: notifBody,
            data: notifData,
            badge: badgeCount,
          });
        }
      }

      if (pushMessages.length > 0) {
        await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Accept-Encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(pushMessages),
        });
        logger.info(`Sent ${pushMessages.length} mutual aid group push notifications for author ${authorId}`);
      }
    } catch (error) {
      logger.error("Mutual aid group follower notification error:", error);
    }
  }
);

// =============================================================
// FUNCTION 13: Event Creation Rate Limiting (20/month)
// =============================================================
// Counter is incremented server-side only (via checkRateLimit) to prevent
// client-side tampering. The client reads the counter for display but cannot write it.
exports.onEventCreate = onDocumentCreated(
  "events/{eventId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const authorId = snapshot.data().authorId;
    if (!authorId) return;

    const check = await checkRateLimit(authorId, "monthlyEvents", 20, "monthly");
    if (!check.allowed) {
      logger.warn(`User ${authorId} exceeded monthly event limit, deleting`);
      await snapshot.ref.delete();
    }
  }
);

// =============================================================
// FUNCTION 14: Block Cleanup — Remove stale subscriptionPreferences
// =============================================================
// When a user's blockedBy array gains a new UID, the blocker's
// subscriptionPreferences entry for the blocked user was already
// cleaned client-side (own doc). But the BLOCKED user's
// subscriptionPreferences.{blockerId} can only be cleaned
// server-side because Firestore rules restrict cross-user writes
// to blockedBy/subscribedUsers/groups fields only.
exports.onUserBlockUpdate = onDocumentUpdated(
  "users/{userId}",
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();

    const oldBlockedBy = before.blockedBy || [];
    const newBlockedBy = after.blockedBy || [];

    // Find newly added blockers
    const addedBlockers = newBlockedBy.filter((uid) => !oldBlockedBy.includes(uid));
    if (addedBlockers.length === 0) return;

    const blockedUserId = event.params.userId;

    // For each new blocker, remove their entry from this user's subscriptionPreferences
    const updates = {};
    for (const blockerId of addedBlockers) {
      updates[`subscriptionPreferences.${blockerId}`] = FieldValue.delete();
    }

    try {
      await db.collection("users").doc(blockedUserId).update(updates);
      logger.info(
        `Cleaned subscriptionPreferences for user ${blockedUserId}: removed ${addedBlockers.join(", ")}`
      );
    } catch (error) {
      // subscriptionPreferences field may not exist — that's fine
      if (error.code !== 5) {
        logger.error("onUserBlockUpdate error:", error);
      }
    }
  }
);

// =============================================================
// FUNCTION 15: Scheduled Message Cleanup (90-day retention)
// =============================================================
// Runs daily — deletes all private messages and chatroom messages
// older than 90 days. Conversations themselves are preserved.
exports.cleanupExpiredMessages = onSchedule(
  { schedule: "every 24 hours", timeZone: "America/New_York" },
  async () => {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const cutoffTimestamp = Timestamp.fromDate(cutoff);
    let totalDeleted = 0;

    // Phase 1: Private conversation messages
    try {
      const conversationsSnapshot = await db.collection("conversations").get();

      for (const convoDoc of conversationsSnapshot.docs) {
        const oldMessages = await convoDoc.ref
          .collection("messages")
          .where("createdAt", "<", cutoffTimestamp)
          .limit(500)
          .get();

        if (oldMessages.empty) continue;

        const batch = db.batch();
        let count = 0;
        for (const msgDoc of oldMessages.docs) {
          batch.delete(msgDoc.ref);
          count++;
        }
        await batch.commit();
        totalDeleted += count;

        if (count > 0) {
          logger.info(
            `Deleted ${count} expired messages from conversation ${convoDoc.id}`
          );
        }
      }
    } catch (error) {
      logger.error("cleanupExpiredMessages (conversations) error:", error);
    }

    // Phase 2: Cyber Lounge chatroom messages
    try {
      const roomsSnapshot = await db.collection("cyberLoungeRooms").get();

      for (const roomDoc of roomsSnapshot.docs) {
        const oldMessages = await roomDoc.ref
          .collection("messages")
          .where("createdAt", "<", cutoffTimestamp)
          .limit(500)
          .get();

        if (oldMessages.empty) continue;

        const batch = db.batch();
        let count = 0;
        for (const msgDoc of oldMessages.docs) {
          batch.delete(msgDoc.ref);
          count++;
        }
        await batch.commit();
        totalDeleted += count;

        if (count > 0) {
          logger.info(
            `Deleted ${count} expired messages from chatroom ${roomDoc.id}`
          );
        }
      }
    } catch (error) {
      logger.error("cleanupExpiredMessages (chatrooms) error:", error);
    }

    logger.info(`Total expired messages cleaned: ${totalDeleted}`);
  }
);

// =============================================================
// FUNCTION 15b: One-time cleanup — delete orphaned conversations
// =============================================================
// Finds all conversations where at least one participant's user
// document no longer exists (deleted account) and deletes the
// entire conversation + all messages. Callable by admins only.
exports.cleanupOrphanedConversations = onCall({ timeoutSeconds: 300 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in.");
  }

  // Verify caller is admin
  const callerDoc = await db.collection("users").doc(request.auth.uid).get();
  if (!callerDoc.exists || !callerDoc.data().isAdmin) {
    throw new HttpsError("permission-denied", "Admin access required.");
  }

  const conversationsSnapshot = await db.collection("conversations").get();
  let conversationsDeleted = 0;
  let messagesDeleted = 0;

  for (const convoDoc of conversationsSnapshot.docs) {
    const convoData = convoDoc.data();
    const participants = convoData.participants || [];

    // Check if any participant's user document is missing
    let hasOrphan = false;
    for (const participantId of participants) {
      const userDoc = await db.collection("users").doc(participantId).get();
      if (!userDoc.exists) {
        hasOrphan = true;
        break;
      }
    }

    if (hasOrphan) {
      // Delete all messages in this conversation
      const messagesSnapshot = await convoDoc.ref.collection("messages").get();
      for (const msgDoc of messagesSnapshot.docs) {
        await msgDoc.ref.delete();
        messagesDeleted++;
      }
      // Delete the conversation document
      await convoDoc.ref.delete();
      conversationsDeleted++;
      logger.info(`Deleted orphaned conversation ${convoDoc.id} (${messagesSnapshot.size} messages)`);
    }
  }

  logger.info(`Orphan cleanup complete: ${conversationsDeleted} conversations, ${messagesDeleted} messages deleted`);
  return { conversationsDeleted, messagesDeleted };
});

// =============================================================
// FUNCTION 16: Scheduled Barter Post Cleanup (60-day retention)
// =============================================================
// Runs daily — deletes all barter market posts whose expiresAt
// timestamp has passed. Posts without expiresAt are skipped.
exports.cleanupExpiredBarterPosts = onSchedule(
  { schedule: "every 24 hours", timeZone: "America/New_York" },
  async () => {
    const now = Timestamp.now();
    let totalDeleted = 0;

    try {
      const expiredSnapshot = await db
        .collection("barterMarketPosts")
        .where("expiresAt", "<", now)
        .get();

      if (expiredSnapshot.empty) {
        logger.info("No expired barter posts to clean up.");
        return;
      }

      const batch = db.batch();
      let count = 0;

      for (const doc of expiredSnapshot.docs) {
        batch.delete(doc.ref);
        count++;

        // Firestore batch limit is 500
        if (count === 500) {
          await batch.commit();
          totalDeleted += count;
          count = 0;
        }
      }

      if (count > 0) {
        await batch.commit();
        totalDeleted += count;
      }

      logger.info(`Cleaned up ${totalDeleted} expired barter posts.`);
    } catch (error) {
      logger.error("cleanupExpiredBarterPosts error:", error);
    }
  }
);

// =============================================================
// FUNCTION 17: Notify Subscribers on Cyberlounge Room Creation
// =============================================================
// When a host creates a new Cyberlounge room, notify all their
// subscribers who have hostedChats notifications enabled.
exports.onCyberLoungeRoomCreate = onDocumentCreated(
  "cyberLoungeRooms/{roomId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const roomData = snapshot.data();
    const hostId = roomData.hostId;
    const roomName = roomData.name || "a new room";
    const { roomId } = event.params;

    if (!hostId) return;

    // Look up host name from their user doc (don't trust client-provided name)
    const hostDoc = await db.collection("users").doc(hostId).get();
    const hostName = hostDoc.exists ? (hostDoc.data().name || "Someone") : "Someone";

    try {
      // Find all subscribers of this host
      const subscribersSnapshot = await db.collection("users")
        .where("subscribedUsers", "array-contains", hostId)
        .get();

      if (subscribersSnapshot.empty) return;

      const fetch = require("node-fetch");
      const pushMessages = [];
      const notifTitle = `${hostName} has started a chatroom!`;
      const notifBody = `Tap to join "${roomName}" in the Cyberlounge`;
      const notifData = { type: "cyberlounge_room", roomId, hostId };

      for (const subDoc of subscribersSnapshot.docs) {
        const subData = subDoc.data();
        const prefs = subData.subscriptionPreferences?.[hostId];

        // Skip if subscriber disabled hostedChats notifications
        if (prefs && prefs.hostedChats === false) continue;

        // Skip if subscriber is the host themselves
        if (subDoc.id === hostId) continue;

        // Store to Firestore notification history (for in-app bell + badge)
        await db.collection("users").doc(subDoc.id)
          .collection("notifications").add({
            title: notifTitle,
            body: notifBody,
            type: "cyberlounge_room",
            data: notifData,
            read: false,
            createdAt: FieldValue.serverTimestamp(),
          });

        // Send push notification (read token from private subcollection)
        const tokenDoc = await db.collection("users").doc(subDoc.id)
          .collection("private").doc("tokens").get();
        const subPushToken = tokenDoc.exists ? tokenDoc.data().pushToken : null;
        if (subPushToken) {
          const badgeCount = await getUnreadNotificationCount(subDoc.id);
          pushMessages.push({
            to: subPushToken,
            sound: "default",
            title: notifTitle,
            body: notifBody,
            data: notifData,
            badge: badgeCount,
          });
        }
      }

      if (pushMessages.length > 0) {
        await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Accept-Encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(pushMessages),
        });
        logger.info(`Sent ${pushMessages.length} cyberlounge room creation push notifications for host ${hostId}`);
      }
    } catch (error) {
      logger.error("onCyberLoungeRoomCreate notification error:", error);
    }
  }
);

// =============================================================
// FUNCTION 17: Sync Profile Photo/Name Across All Collections
// =============================================================
// When a user updates their profilePhoto or name, propagate the
// change everywhere their avatar is denormalized:
//   - Conversations (participantProfiles)
//   - Events (authorPhoto / authorName)
//   - Mutual Aid Groups (authorPhoto / authorName)
//   - Barter Market Posts (authorPhoto / authorName)
//   - Cyberlounge Rooms (hostPhoto / hostName)
exports.onUserProfileUpdate = onDocumentUpdated(
  "users/{userId}",
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    const { userId } = event.params;

    // Only run if profilePhoto or name actually changed
    const photoChanged = before.profilePhoto !== after.profilePhoto;
    const nameChanged = before.name !== after.name;

    if (!photoChanged && !nameChanged) return;

    const newPhoto = after.profilePhoto || null;
    const newName = after.name || "";

    logger.info(
      `Profile update for ${userId} — photo changed: ${photoChanged}, name changed: ${nameChanged}`
    );

    // Helper: commit batch when nearing Firestore 500-op limit, then return a fresh batch
    const commitIfNeeded = async (batch, count) => {
      if (count >= 499) {
        await batch.commit();
        logger.info(`Batch committed at ${count} operations`);
        return { batch: db.batch(), count: 0 };
      }
      return { batch, count };
    };

    let batch = db.batch();
    let opCount = 0;

    // --- 1. Conversations (participantProfiles) ---
    try {
      const convos = await db
        .collection("conversations")
        .where("participants", "array-contains", userId)
        .get();

      for (const doc of convos.docs) {
        const updateData = {};
        if (photoChanged) updateData[`participantProfiles.${userId}.profilePhoto`] = newPhoto;
        if (nameChanged) updateData[`participantProfiles.${userId}.name`] = newName;

        batch.update(doc.ref, updateData);
        opCount++;
        ({ batch, count: opCount } = await commitIfNeeded(batch, opCount));
      }

      logger.info(`Queued ${convos.size} conversation updates`);
    } catch (error) {
      logger.error("onUserProfileUpdate conversations error:", error);
    }

    // --- 2. Events (authorPhoto / authorName) ---
    try {
      const events = await db
        .collection("events")
        .where("authorId", "==", userId)
        .get();

      for (const doc of events.docs) {
        const updateData = {};
        if (photoChanged) updateData.authorPhoto = newPhoto;
        if (nameChanged) updateData.authorName = newName;

        batch.update(doc.ref, updateData);
        opCount++;
        ({ batch, count: opCount } = await commitIfNeeded(batch, opCount));
      }

      logger.info(`Queued ${events.size} event updates`);
    } catch (error) {
      logger.error("onUserProfileUpdate events error:", error);
    }

    // --- 3. Mutual Aid Groups (authorPhoto / authorName) ---
    try {
      const mutualAid = await db
        .collection("mutualAidGroups")
        .where("authorId", "==", userId)
        .get();

      for (const doc of mutualAid.docs) {
        const updateData = {};
        if (photoChanged) updateData.authorPhoto = newPhoto;
        if (nameChanged) updateData.authorName = newName;

        batch.update(doc.ref, updateData);
        opCount++;
        ({ batch, count: opCount } = await commitIfNeeded(batch, opCount));
      }

      logger.info(`Queued ${mutualAid.size} mutual aid group updates`);
    } catch (error) {
      logger.error("onUserProfileUpdate mutualAidGroups error:", error);
    }

    // --- 4. Barter Market Posts (authorPhoto / authorName) ---
    try {
      const barter = await db
        .collection("barterMarketPosts")
        .where("authorId", "==", userId)
        .get();

      for (const doc of barter.docs) {
        const updateData = {};
        if (photoChanged) updateData.authorPhoto = newPhoto;
        if (nameChanged) updateData.authorName = newName;

        batch.update(doc.ref, updateData);
        opCount++;
        ({ batch, count: opCount } = await commitIfNeeded(batch, opCount));
      }

      logger.info(`Queued ${barter.size} barter post updates`);
    } catch (error) {
      logger.error("onUserProfileUpdate barterMarketPosts error:", error);
    }

    // --- 5. Cyberlounge Rooms (hostPhoto / hostName) ---
    try {
      const rooms = await db
        .collection("cyberLoungeRooms")
        .where("hostId", "==", userId)
        .get();

      for (const doc of rooms.docs) {
        const updateData = {};
        if (photoChanged) updateData.hostPhoto = newPhoto;
        if (nameChanged) updateData.hostName = newName;

        batch.update(doc.ref, updateData);
        opCount++;
        ({ batch, count: opCount } = await commitIfNeeded(batch, opCount));
      }

      logger.info(`Queued ${rooms.size} cyberlounge room updates`);
    } catch (error) {
      logger.error("onUserProfileUpdate cyberLoungeRooms error:", error);
    }

    // Final commit for any remaining operations
    if (opCount > 0) {
      try {
        await batch.commit();
        logger.info(`Final batch committed (${opCount} operations)`);
      } catch (error) {
        logger.error("onUserProfileUpdate final commit error:", error);
      }
    }

    logger.info(`Profile sync complete for user ${userId}`);
  }
);

// =============================================================
// FUNCTION 18: Chat Request Notification (on conversation create)
// =============================================================
// When a new conversation is created with status: 'pending', notify the
// other participant that someone wants to chat.
exports.onConversationCreate = onDocumentCreated(
  "conversations/{conversationId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const convoData = snapshot.data();
    const { conversationId } = event.params;

    // Only notify for pending chat requests
    if (convoData.status !== "pending") return;

    const initiatorId = convoData.initiatedBy;
    if (!initiatorId) return;

    const participants = convoData.participants || [];
    const recipientId = participants.find((id) => id !== initiatorId);
    if (!recipientId) return;

    try {
      // Look up initiator name from their user doc (don't trust client-provided profiles)
      const initiatorDoc = await db.collection("users").doc(initiatorId).get();
      const initiatorName = initiatorDoc.exists ? (initiatorDoc.data().name || "Someone") : "Someone";

      // Store to notification history (for in-app bell + badge)
      await db.collection("users").doc(recipientId)
        .collection("notifications").add({
          title: initiatorName,
          body: `${initiatorName} wants to start a chat with you`,
          type: "chat_request",
          data: { type: "chat_request", conversationId, senderId: initiatorId },
          read: false,
          createdAt: FieldValue.serverTimestamp(),
        });

      // Send push notification (read token from private subcollection)
      const recipientDoc = await db.collection("users").doc(recipientId).get();
      if (!recipientDoc.exists) return;
      const recipientData = recipientDoc.data();
      if (recipientData.notificationsMuted === true) return;

      const tokenDoc = await db.collection("users").doc(recipientId)
        .collection("private").doc("tokens").get();
      const pushToken = tokenDoc.exists ? tokenDoc.data().pushToken : null;
      if (!pushToken) return;

      const fetch = require("node-fetch");
      const badgeCount = await getUnreadNotificationCount(recipientId);
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: pushToken,
          sound: "default",
          title: initiatorName,
          body: `${initiatorName} wants to start a chat with you`,
          data: { type: "chat_request", conversationId, senderId: initiatorId },
          badge: badgeCount,
        }),
      });

      logger.info(`Chat request notification sent to ${recipientId}`);
    } catch (error) {
      logger.error("onConversationCreate notification error:", error);
    }
  }
);

// =============================================================
// FUNCTION 19: Chat Accept/Decline Notification (on status change)
// =============================================================
// When a conversation status changes from 'pending' to 'accepted' or
// 'declined', notify the requester.
exports.onConversationStatusChange = onDocumentUpdated(
  "conversations/{conversationId}",
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    const { conversationId } = event.params;

    // Only fire when status changes from 'pending'
    if (before.status !== "pending") return;
    if (after.status !== "accepted" && after.status !== "declined") return;

    const requesterId = after.initiatedBy;
    if (!requesterId) return;

    const participants = after.participants || [];
    const responderId = participants.find((id) => id !== requesterId);
    if (!responderId) return;

    // Look up responder name from their user doc (don't trust client-provided profiles)
    const responderDoc = await db.collection("users").doc(responderId).get();
    const responderName = responderDoc.exists ? (responderDoc.data().name || "Someone") : "Someone";
    const isAccepted = after.status === "accepted";

    const notifType = isAccepted ? "chat_accepted" : "chat_declined";
    const notifTitle = responderName;
    const notifBody = isAccepted
      ? `${responderName} accepted your chat request!`
      : "perhaps another time";

    try {
      // Store to notification history (for in-app bell + badge)
      await db.collection("users").doc(requesterId)
        .collection("notifications").add({
          title: notifTitle,
          body: notifBody,
          type: notifType,
          data: { type: notifType, conversationId, senderId: responderId },
          read: false,
          createdAt: FieldValue.serverTimestamp(),
        });

      // Mark conversation as unread for the requester (triggers green dot + badge)
      if (isAccepted) {
        await db.collection("conversations").doc(conversationId)
          .update({ [`unread_${requesterId}`]: true });
      }

      // Send push notification (read token from private subcollection)
      const requesterDoc = await db.collection("users").doc(requesterId).get();
      if (!requesterDoc.exists) return;
      const requesterData = requesterDoc.data();
      if (requesterData.notificationsMuted === true) return;

      const tokenDoc = await db.collection("users").doc(requesterId)
        .collection("private").doc("tokens").get();
      const pushToken = tokenDoc.exists ? tokenDoc.data().pushToken : null;
      if (!pushToken) return;

      const fetch = require("node-fetch");
      const badgeCount = await getUnreadNotificationCount(requesterId);
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: pushToken,
          sound: "default",
          title: notifTitle,
          body: notifBody,
          data: { type: notifType, conversationId },
          badge: badgeCount,
        }),
      });

      logger.info(`Chat ${after.status} notification sent to ${requesterId}`);
    } catch (error) {
      logger.error("onConversationStatusChange notification error:", error);
    }
  }
);

// =============================================================
// FUNCTION 20: Follower Notification (on subscribedUsers change)
// =============================================================
// When a user's subscribedUsers array changes:
//   - Addition: notify the target user that someone followed them
//   - Removal: clean up subscriptionPreferences for the unfollowed user
exports.onFollowChange = onDocumentUpdated(
  "users/{userId}",
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    const { userId } = event.params;

    const beforeSubs = before.subscribedUsers || [];
    const afterSubs = after.subscribedUsers || [];

    // --- Handle new follows (additions) ---
    const beforeSet = new Set(beforeSubs);
    const newFollows = afterSubs.filter((id) => !beforeSet.has(id));

    if (newFollows.length > 0) {
      const followerName = after.name || "Someone";

      for (const targetUserId of newFollows) {
        try {
          // In-app notification
          await db.collection("users").doc(targetUserId)
            .collection("notifications").add({
              title: "New Follower",
              body: `${followerName} is now following you!`,
              type: "follower",
              data: { type: "follower", followerId: userId },
              read: false,
              createdAt: FieldValue.serverTimestamp(),
            });

          // Push notification
          const targetDoc = await db.collection("users").doc(targetUserId).get();
          if (targetDoc.exists && targetDoc.data().notificationsMuted !== true) {
            const tokenDoc = await db.collection("users").doc(targetUserId)
              .collection("private").doc("tokens").get();
            const pushToken = tokenDoc.exists ? tokenDoc.data().pushToken : null;
            if (pushToken) {
              const fetch = require("node-fetch");
              const badgeCount = await getUnreadNotificationCount(targetUserId);
              await fetch("https://exp.host/--/api/v2/push/send", {
                method: "POST",
                headers: {
                  Accept: "application/json",
                  "Accept-Encoding": "gzip, deflate",
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  to: pushToken,
                  sound: "default",
                  title: "New Follower",
                  body: `${followerName} is now following you!`,
                  data: { type: "follower", followerId: userId },
                  badge: badgeCount,
                }),
              });
            }
          }
        } catch (error) {
          logger.error(`Follower notification error for ${targetUserId}:`, error);
        }
      }
    }

    // --- Handle unfollows / removals — clean up subscriptionPreferences ---
    const afterSet = new Set(afterSubs);
    const removedFollows = beforeSubs.filter((id) => !afterSet.has(id));

    if (removedFollows.length > 0) {
      const updates = {};
      for (const removedId of removedFollows) {
        updates[`subscriptionPreferences.${removedId}`] = FieldValue.delete();
      }
      try {
        await db.collection("users").doc(userId).update(updates);
      } catch (error) {
        logger.error(`subscriptionPreferences cleanup error for ${userId}:`, error);
      }
    }
  }
);

// =============================================================
// Function 21: onGroupMembershipChange
// =============================================================
// When a group's members array changes, sync each affected user's
// groups array on their user document. This runs with admin SDK
// so it bypasses security rules — no need for client-side cross-user
// writes to the 'groups' field on user documents.
exports.onGroupMembershipChange = onDocumentUpdated(
  "groups/{groupId}",
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    const { groupId } = event.params;

    // Only act on members array changes
    const beforeMembers = before.members || [];
    const afterMembers = after.members || [];

    const beforeSet = new Set(beforeMembers);
    const afterSet = new Set(afterMembers);

    // Users added to the group
    const added = afterMembers.filter((id) => !beforeSet.has(id));
    // Users removed from the group
    const removed = beforeMembers.filter((id) => !afterSet.has(id));

    if (added.length === 0 && removed.length === 0) return;

    // Add groupId to each new member's groups array
    for (const userId of added) {
      try {
        await db.collection("users").doc(userId).update({
          groups: FieldValue.arrayUnion(groupId),
        });
      } catch (error) {
        logger.error(`onGroupMembershipChange: failed to add group ${groupId} to user ${userId}:`, error);
      }
    }

    // Remove groupId from each removed member's groups array
    for (const userId of removed) {
      try {
        await db.collection("users").doc(userId).update({
          groups: FieldValue.arrayRemove(groupId),
        });
      } catch (error) {
        logger.error(`onGroupMembershipChange: failed to remove group ${groupId} from user ${userId}:`, error);
      }
    }

    if (added.length > 0 || removed.length > 0) {
      logger.info(`onGroupMembershipChange: group ${groupId} — added ${added.length}, removed ${removed.length} members`);
    }
  }
);

// =============================================================
// Function 22: onGroupDelete
// =============================================================
// When a group document is deleted, remove the groupId from every
// former member's groups array. This covers the deleteGroup flow
// where the group doc itself is removed.
exports.onGroupDelete = onDocumentDeleted(
  "groups/{groupId}",
  async (event) => {
    const deletedData = event.data.data();
    const { groupId } = event.params;
    const members = deletedData.members || [];

    if (members.length === 0) return;

    for (const userId of members) {
      try {
        await db.collection("users").doc(userId).update({
          groups: FieldValue.arrayRemove(groupId),
        });
      } catch (error) {
        logger.error(`onGroupDelete: failed to remove group ${groupId} from user ${userId}:`, error);
      }
    }

    logger.info(`onGroupDelete: removed group ${groupId} from ${members.length} members' groups arrays`);
  }
);

// =============================================================
// Function 23: onGroupCreate
// =============================================================
// When a new group is created, add the groupId to each initial
// member's groups array. This covers the createGroup flow where
// the creator is added as the first member during document creation.
exports.onGroupCreate = onDocumentCreated(
  "groups/{groupId}",
  async (event) => {
    const data = event.data.data();
    const { groupId } = event.params;
    const members = data.members || [];

    if (members.length === 0) return;

    for (const userId of members) {
      try {
        await db.collection("users").doc(userId).update({
          groups: FieldValue.arrayUnion(groupId),
        });
      } catch (error) {
        logger.error(`onGroupCreate: failed to add group ${groupId} to user ${userId}:`, error);
      }
    }

    logger.info(`onGroupCreate: added group ${groupId} to ${members.length} members' groups arrays`);
  }
);

// =============================================================
// FUNCTION 24: Event Comment Reaction Notification
// =============================================================
// When an event comment's reactions map changes, detect newly added
// reactions and notify the comment author.
exports.onEventCommentReaction = onDocumentUpdated(
  "events/{eventId}/comments/{commentId}",
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();

    const beforeReactions = before.reactions || {};
    const afterReactions = after.reactions || {};

    // Find newly added reactions: user+emoji pairs in after but not before
    const commentAuthorId = after.authorId;
    if (!commentAuthorId) return;

    const { eventId } = event.params;

    for (const emoji of Object.keys(afterReactions)) {
      const beforeUsers = beforeReactions[emoji] || [];
      const afterUsers = afterReactions[emoji] || [];
      const newUsers = afterUsers.filter((uid) => !beforeUsers.includes(uid));

      for (const reactorId of newUsers) {
        // Don't notify for self-reactions
        if (reactorId === commentAuthorId) continue;

        try {
          const reactorDoc = await db.collection("users").doc(reactorId).get();
          const reactorName = reactorDoc.exists ? (reactorDoc.data().name || "Someone") : "Someone";

          await db.collection("users").doc(commentAuthorId)
            .collection("notifications").add({
              title: "Comment Reaction",
              body: `${reactorName} reacted ${emoji} to your comment`,
              type: "eventCommentReaction",
              data: { type: "eventCommentReaction", eventId },
              read: false,
              createdAt: FieldValue.serverTimestamp(),
            });

          // Send push notification
          const authorDoc = await db.collection("users").doc(commentAuthorId).get();
          if (!authorDoc.exists) continue;
          if (authorDoc.data().notificationsMuted === true) continue;

          const tokenDoc = await db.collection("users").doc(commentAuthorId)
            .collection("private").doc("tokens").get();
          const pushToken = tokenDoc.exists ? tokenDoc.data().pushToken : null;
          if (!pushToken) continue;

          const fetch = require("node-fetch");
          const badgeCount = await getUnreadNotificationCount(commentAuthorId);
          await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Accept-Encoding": "gzip, deflate",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              to: pushToken,
              sound: "default",
              title: "Comment Reaction",
              body: `${reactorName} reacted ${emoji} to your comment`,
              data: { type: "eventCommentReaction", eventId },
              badge: badgeCount,
            }),
          });
        } catch (error) {
          logger.error("Event comment reaction notification error:", error);
        }
      }
    }
  }
);

// =============================================================
// FUNCTION 25: Group Post Comment Reaction Notification
// =============================================================
exports.onGroupCommentReaction = onDocumentUpdated(
  "groups/{groupId}/posts/{postId}/comments/{commentId}",
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();

    const beforeReactions = before.reactions || {};
    const afterReactions = after.reactions || {};

    const commentAuthorId = after.authorId;
    if (!commentAuthorId) return;

    const { groupId, postId } = event.params;

    for (const emoji of Object.keys(afterReactions)) {
      const beforeUsers = beforeReactions[emoji] || [];
      const afterUsers = afterReactions[emoji] || [];
      const newUsers = afterUsers.filter((uid) => !beforeUsers.includes(uid));

      for (const reactorId of newUsers) {
        if (reactorId === commentAuthorId) continue;

        try {
          const reactorDoc = await db.collection("users").doc(reactorId).get();
          const reactorName = reactorDoc.exists ? (reactorDoc.data().name || "Someone") : "Someone";

          await db.collection("users").doc(commentAuthorId)
            .collection("notifications").add({
              title: "Comment Reaction",
              body: `${reactorName} reacted ${emoji} to your comment`,
              type: "groupCommentReaction",
              data: { type: "groupCommentReaction", groupId, postId },
              read: false,
              createdAt: FieldValue.serverTimestamp(),
            });

          const authorDoc = await db.collection("users").doc(commentAuthorId).get();
          if (!authorDoc.exists) continue;
          if (authorDoc.data().notificationsMuted === true) continue;

          const tokenDoc = await db.collection("users").doc(commentAuthorId)
            .collection("private").doc("tokens").get();
          const pushToken = tokenDoc.exists ? tokenDoc.data().pushToken : null;
          if (!pushToken) continue;

          const fetch = require("node-fetch");
          const badgeCount = await getUnreadNotificationCount(commentAuthorId);
          await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Accept-Encoding": "gzip, deflate",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              to: pushToken,
              sound: "default",
              title: "Comment Reaction",
              body: `${reactorName} reacted ${emoji} to your comment`,
              data: { type: "groupCommentReaction", groupId, postId },
              badge: badgeCount,
            }),
          });
        } catch (error) {
          logger.error("Group comment reaction notification error:", error);
        }
      }
    }
  }
);

// =============================================================
// FUNCTION 26: Mutual Aid Comment Reaction Notification
// =============================================================
exports.onMutualAidCommentReaction = onDocumentUpdated(
  "mutualAidGroups/{groupId}/comments/{commentId}",
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();

    const beforeReactions = before.reactions || {};
    const afterReactions = after.reactions || {};

    const commentAuthorId = after.authorId;
    if (!commentAuthorId) return;

    const { groupId } = event.params;

    for (const emoji of Object.keys(afterReactions)) {
      const beforeUsers = beforeReactions[emoji] || [];
      const afterUsers = afterReactions[emoji] || [];
      const newUsers = afterUsers.filter((uid) => !beforeUsers.includes(uid));

      for (const reactorId of newUsers) {
        if (reactorId === commentAuthorId) continue;

        try {
          const reactorDoc = await db.collection("users").doc(reactorId).get();
          const reactorName = reactorDoc.exists ? (reactorDoc.data().name || "Someone") : "Someone";

          await db.collection("users").doc(commentAuthorId)
            .collection("notifications").add({
              title: "Comment Reaction",
              body: `${reactorName} reacted ${emoji} to your comment`,
              type: "mutualAidCommentReaction",
              data: { type: "mutualAidCommentReaction", groupId },
              read: false,
              createdAt: FieldValue.serverTimestamp(),
            });

          const authorDoc = await db.collection("users").doc(commentAuthorId).get();
          if (!authorDoc.exists) continue;
          if (authorDoc.data().notificationsMuted === true) continue;

          const tokenDoc = await db.collection("users").doc(commentAuthorId)
            .collection("private").doc("tokens").get();
          const pushToken = tokenDoc.exists ? tokenDoc.data().pushToken : null;
          if (!pushToken) continue;

          const fetch = require("node-fetch");
          const badgeCount = await getUnreadNotificationCount(commentAuthorId);
          await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Accept-Encoding": "gzip, deflate",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              to: pushToken,
              sound: "default",
              title: "Comment Reaction",
              body: `${reactorName} reacted ${emoji} to your comment`,
              data: { type: "mutualAidCommentReaction", groupId },
              badge: badgeCount,
            }),
          });
        } catch (error) {
          logger.error("Mutual aid comment reaction notification error:", error);
        }
      }
    }
  }
);

// =============================================================
// FUNCTION 27: Request Category Chat (callable)
// =============================================================
// "Request another category" — creates a pending DM conversation
// between the calling user and the app creator. UID stays server-side.
const APP_CREATOR_UID = "CBpqZ8ZdDOTryzXbofOkRUosfFh1";

exports.requestCategoryChat = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }

  const callerId = request.auth.uid;

  // Can't DM yourself
  if (callerId === APP_CREATOR_UID) {
    throw new HttpsError("failed-precondition", "You are the app creator.");
  }

  // Deterministic conversation ID (same logic as client)
  const conversationId = [callerId, APP_CREATOR_UID].sort().join("_");
  const conversationRef = db.collection("conversations").doc(conversationId);

  const existingDoc = await conversationRef.get();
  if (existingDoc.exists) {
    const data = existingDoc.data();
    // Already accepted — just return the conversationId
    if (data.status === "accepted") {
      // Un-delete for the caller if needed
      if (data[`deleted_${callerId}`]) {
        await conversationRef.update({
          [`deleted_${callerId}`]: FieldValue.delete(),
        });
      }
      return { conversationId, status: "accepted", creatorUid: APP_CREATOR_UID };
    }
    // Already pending
    return { conversationId, status: "pending", alreadySent: true, creatorUid: APP_CREATOR_UID };
  }

  // Fetch fresh profiles for both users
  const [callerDoc, creatorDoc] = await Promise.all([
    db.collection("users").doc(callerId).get(),
    db.collection("users").doc(APP_CREATOR_UID).get(),
  ]);

  const callerData = callerDoc.exists ? callerDoc.data() : {};
  const creatorData = creatorDoc.exists ? creatorDoc.data() : {};

  // Create pending conversation (triggers onConversationCreate for notification)
  await conversationRef.set({
    participants: [callerId, APP_CREATOR_UID],
    participantProfiles: {
      [callerId]: {
        name: callerData.name || "",
        profilePhoto: callerData.profilePhoto || null,
      },
      [APP_CREATOR_UID]: {
        name: creatorData.name || "",
        profilePhoto: creatorData.profilePhoto || null,
      },
    },
    lastMessage: null,
    lastMessageAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    status: "pending",
    initiatedBy: callerId,
  });

  logger.info(`Category chat request created: ${callerId} -> creator`);
  return { conversationId, status: "pending", creatorUid: APP_CREATOR_UID };
});
