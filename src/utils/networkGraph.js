// networkGraph.js - Shared utility for building 2-degree connection graph
// Used across Everyone Network screens to determine which users are visible
// Based on depth-limited BFS: shows direct connections + their direct connections

/**
 * Build a Set of user IDs within 2 degrees of the current user.
 * A connection exists if EITHER user follows the other (one-way is enough).
 *
 * @param {string} myUid - Current user's ID
 * @param {Array} allNetworkUsers - All network-enabled users from Firestore
 * @param {Array} excludedUsers - User IDs to exclude (hidden/blocked/blockedBy)
 * @param {Array} myFollowingFallback - Fallback following list from userProfile
 * @returns {Set} Set of connected user IDs (always includes myUid)
 */
export const buildConnectedUserIds = (
  myUid,
  allNetworkUsers,
  excludedUsers,
  myFollowingFallback
) => {
  // Filter eligible users (exclude hidden/blocked/self/deleted)
  const allEligibleUsers = allNetworkUsers
    .filter((u) => !excludedUsers.includes(u.id))
    .filter((u) => u.id !== myUid && u.name)

  const connectedUserIds = new Set()
  if (!myUid || allEligibleUsers.length === 0) {
    if (myUid) connectedUserIds.add(myUid)
    return connectedUserIds
  }

  // Map of userId -> following list for quick lookup
  const followMap = {}
  allEligibleUsers.forEach((u) => {
    followMap[u.id] = u.subscribedUsers || []
  })
  // Ensure current user is in the map even if not in allEligibleUsers
  const myUser = allNetworkUsers.find((u) => u.id === myUid)
  if (!followMap[myUid]) {
    followMap[myUid] = myUser?.subscribedUsers || myFollowingFallback || []
  }

  connectedUserIds.add(myUid)

  // Depth-limited BFS: max 2 degrees from current user
  // queue entries are [userId, depth]
  const queue = [[myUid, 0]]

  while (queue.length > 0) {
    const [current, depth] = queue.shift()
    if (depth >= 2) continue // Stop at 2 degrees

    const currentFollowing = followMap[current] || []

    for (const other of allEligibleUsers) {
      if (connectedUserIds.has(other.id)) continue
      const otherFollowing = followMap[other.id] || []

      // Connected if either follows the other (one-way sufficient)
      if (currentFollowing.includes(other.id) || otherFollowing.includes(current)) {
        connectedUserIds.add(other.id)
        queue.push([other.id, depth + 1])
      }
    }
  }

  return connectedUserIds
}
