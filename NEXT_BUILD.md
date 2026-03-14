# Next Build — Pending App Store Submission

## Changes

- Removed Confluence post monthly limit (was 10/month) to encourage content during early growth
- Fixed public groups not showing for non-members (missing Firestore composite index — now sorts client-side)
- Increased groups container height to show 4.5 groups (was 2.5), fixed scrolling in both public and private sections
- Increased Confluence preview to show up to 4 posts (2x2 grid), trimmed image height by 20%
- Replaced group pinning with true drag-and-drop reorder (react-native-draggable-flatlist + Reanimated): long press a group → it lifts and wiggles, drag to new position, release to drop — order auto-saves to Firestore (groupOrder / publicGroupOrder)
- Group post notifications now sent to all group members (not just comment authors) — backend only, no rebuild needed

### Cyber Lounge Bot Enhancements
- Bot chatroom avatar now persists on dashboard (always shows bot avatar regardless of participants)
- Bot name changed to "Collective Bot"
- Chatroom titles now max 75 characters, casual tone, 2-line display on detail screen (fontSize 13)
- Topic rotation: News, Community, Tech, Pop Culture (cycles through each category)
- Push + in-app notifications sent to connected users when bot creates a new chatroom
- Notification batching: Expo push chunked at 100, Firestore writes chunked at 500

### Phone Number Search on Add Friends
- Added phone number input field to Add Friends screen (step 1)
- Auto-searches when 10 digits entered (formatted as (XXX) XXX-XXXX)
- Shows user result with follow button inline

### Private Profiles & Follow Requests
- New "Private Profile" toggle on profile screen (lock icon, aligned with Public Collective toggle)
- Private profiles require follow request approval before someone can follow
- Follow button shows 3 states: "follow?" → "requested" → "following"
- New FollowRequestsScreen with Accept (green gradient) / Decline (grey) buttons
- "requests (N)" button appears on profile when private or pending requests exist (real-time badge)
- Cloud Functions: follow request create/delete triggers for push + in-app notifications
- "New Follower" notification skipped for private users (accept flow handles it)
- Follow requests cleaned up on block and account deletion
- Firestore rules for followRequests collection (read/create/delete with proper auth)
- Notification icons + routing for follow_request and follow_request_accepted types
- Default notification preferences auto-initialized when follow request is accepted
- Follow requests list updates in real-time (no manual refresh needed)
- Follow request state refreshes on screen focus (no stale "requested" button)

### Bug Fixes
- Fixed phone number search not showing avatar and name on Add Friends screen
