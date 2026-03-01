/**
 * Groups a flat array of comments into threaded display order:
 * Top-level comments in createdAt asc order, with their replies
 * immediately following (also in createdAt asc order).
 *
 * Each comment gets an `isReply` boolean flag for rendering.
 * Backward-compatible: comments without parentCommentId are top-level.
 */
export const groupCommentsWithReplies = (comments) => {
  const topLevel = []
  const repliesByParent = {}

  for (const comment of comments) {
    if (!comment.parentCommentId) {
      topLevel.push(comment)
    } else {
      if (!repliesByParent[comment.parentCommentId]) {
        repliesByParent[comment.parentCommentId] = []
      }
      repliesByParent[comment.parentCommentId].push(comment)
    }
  }

  // Comments already sorted by createdAt asc from Firestore query
  const result = []
  const allParentIds = new Set(topLevel.map((c) => c.id))

  for (const parent of topLevel) {
    result.push({ ...parent, isReply: false })
    const replies = repliesByParent[parent.id] || []
    for (const reply of replies) {
      result.push({ ...reply, isReply: true })
    }
  }

  // Handle orphaned replies (parent was deleted) — append at end
  for (const [parentId, replies] of Object.entries(repliesByParent)) {
    if (!allParentIds.has(parentId)) {
      for (const reply of replies) {
        result.push({ ...reply, isReply: true })
      }
    }
  }

  return result
}
