# Next Build — Pending App Store Submission

## Changes

- Removed Confluence post monthly limit (was 10/month) to encourage content during early growth
- Fixed public groups not showing for non-members (missing Firestore composite index — now sorts client-side)
- Increased groups container height to show 4.5 groups (was 2.5), fixed scrolling in both public and private sections
- Increased Confluence preview to show up to 4 posts (2x2 grid), trimmed image height by 20%
- Replaced group pinning with true drag-and-drop reorder (react-native-draggable-flatlist + Reanimated): long press a group → it lifts and wiggles, drag to new position, release to drop — order auto-saves to Firestore (groupOrder / publicGroupOrder)
- Group post notifications now sent to all group members (not just comment authors) — backend only, no rebuild needed
