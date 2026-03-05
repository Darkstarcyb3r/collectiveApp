# CollectiveApp — Open Source Diagnosis Report

**Date:** March 4, 2026
**Version:** 1.2.0
**Verdict:** NEARLY READY — 0 critical blockers, a few recommended improvements

---

## Executive Summary

CollectiveApp is a React Native/Expo community platform with Firebase backend. The project's security posture is solid — secrets are properly gitignored, Cloudinary uploads use server-signed authentication (no client-side secrets), and Firebase config uses the native SDK pattern. With a few polish items addressed, this is ready for open source.

| Area | Status |
|------|--------|
| Security | 0 critical, 2 minor recommendations |
| Code Quality | 0 lint errors, 41 warnings |
| Dependencies | 1 high-severity transitive vulnerability, 32 outdated packages |
| Open-Source Readiness | 0 blockers, 5 recommended additions |

---

## 1. Security Audit

### What's Properly Protected

- **`.env` (root)** — contains Google Places and Firebase keys, correctly gitignored, NOT tracked in git
- **`functions/.env`** — contains Cloudinary credentials, correctly gitignored via `functions/.gitignore`, NOT tracked
- **`.env.example` and `functions/.env.example`** — tracked with placeholder values only. Clean.
- **`.firebaserc`** — tracked but contains only the placeholder `"your-firebase-project-id"`. Clean.
- **`src/config/firebase.js`** — no hardcoded keys; uses `@react-native-firebase` native SDK which reads from the plist at build time
- **`src/utils/cloudinaryUpload.js`** — no hardcoded secrets; gets signed upload credentials from a Cloud Function at runtime. Smart architecture.
- **Firestore rules** — comprehensive security rules in place

### GoogleService-Info.plist (Tracked — Acceptable)

Both `GoogleService-Info.plist` (root) and `ios/Collective/GoogleService-Info.plist` are tracked in git with real Firebase client-side config values. This is **standard practice** for Firebase iOS projects — these are client-side identifiers (not secret keys) and are compiled into every iOS app binary regardless. Firebase security is enforced by Firestore rules, not by keeping the API key secret. Google's own documentation considers these safe to commit.

If you'd prefer extra caution, you could remove them from tracking and provide a `.plist.example` with setup instructions, but this is a preference, not a security requirement.

### MINOR RECOMMENDATIONS

**1.1 — `.claude/` directory tracked in git**
- Files: `launch.json` and a worktree reference
- Contains dev launch configurations — not sensitive, but not useful to contributors
- Recommendation: Add `.claude/` to `.gitignore` and run `git rm --cached -r .claude/`

**1.2 — Console.log statements across 19+ files**
- Not a security risk per se, but could leak debug info in production
- Recommendation: Wrap in `__DEV__` conditionals or strip before release

---

## 2. Code Quality

### Lint Results: 0 Errors, 41 Warnings

No breaking lint errors — the codebase is clean on that front. The 41 warnings break down as:

**Unused imports and variables (across 12 files):**

- `Button.js`: Unused `View` import + 6 unused style definitions
- `MessageBubble.js`: Unused `SafeAreaView`
- `MutualAidCreateScreen.js`: Unused `ActivityIndicator`, unused `handleDelete` function
- `DashboardScreen.js`: Unused `Vibration`, `Haptics`, `unreadDMCount`, `idx`, `activityDot` style
- `ActiveUsersScreen.js`, `VettedMemberScreen.js`: Unused `playClick`
- `GroupDetailScreen.js`: Unused `unseen` variable + `unseenDot` style
- `ConfluenceAddPostScreen.js`: Unused `linkLabelRemaining` + `countText` style

**Missing useEffect dependencies (DashboardScreen.js — 9 hooks):**

- Lines 99, 215, 346, 373, 386, 402, 420, 434, 454
- Risk: Stale closures and unexpected behavior
- Most critical: Line 402 has a complex expression that needs extraction

### Font Loading Issue

`App.js` loads `PressStart2P-Regular` and `FiraCode-Regular` but those font files don't exist in the project. It silently falls back to RobotoMono, which masks the issue. Either add the font files or remove the references.

### Large Files Worth Refactoring

| File | Lines | Concern |
|------|-------|---------|
| DashboardScreen.js | 1,993 | 16 lint warnings, manages too many concerns |
| CyberLoungeDetailScreen.js | 1,911 | 9 console.logs, high complexity |
| EventEditScreen.js | 1,437 | Large single-file screen |
| UserProfileScreen.js | 1,379 | Could benefit from component extraction |
| EventCreateScreen.js | 1,370 | Similar to EventEditScreen |

---

## 3. Dependency Health

### Vulnerability: 1 High Severity (Transitive)

**minimatch — ReDoS (Regular Expression Denial of Service)**

- Affects 7 locations in the dependency tree (transitive via Expo/glob)
- This is a dev/build-time dependency, not a runtime risk to your users
- Fix: Run `npm audit fix`

### Outdated Packages: 32

Notable major version updates available:

| Package | Current | Latest | Impact |
|---------|---------|--------|--------|
| Expo SDK | 54.0.x | 55.0.x | Major — requires testing |
| React Navigation | 6.x | 7.x | Major — API changes |
| async-storage | 2.2.0 | 3.0.1 | Major |
| uuid | 9.0.1 | 13.0.0 | Major |
| react | 19.1.0 | 19.2.4 | Minor |
| react-native | 0.81.5 | 0.84.1 | Minor |

None of these are blockers for open-sourcing — they're normal maintenance items.

### Potentially Unused Dependencies

- `react-dom` (v19.1.0) — no direct imports in src/; peer dependency for react-native-web
- `react-native-web` (^0.21.0) — no direct imports in src/; only needed if targeting web
- `uuid` (^9.0.0) — not directly imported in src/; may be used internally

### Missing package.json Metadata

- No `"license"` field (should be `"MIT"` to match your LICENSE file)
- No `"description"` field
- No `"repository"` field (should point to your GitHub URL)
- No `"engines"` field (project works on Node 22)

---

## 4. Open-Source Readiness

### What's Already In Great Shape

- **LICENSE**: Proper MIT license, correctly attributed to Darkstarcyb3r (2025)
- **README.md**: Setup instructions, feature list, screenshots, project structure, contributing guidelines
- **ATTRIBUTION.md**: Comprehensive credits for 17 audio tracks (Pixabay) and placeholder images (Unsplash) — all permissive licenses
- **.env.example files**: Both root and functions have clean placeholder examples for contributors
- **app.json**: Proper metadata, permissions documented, EAS configured
- **Git LFS**: Video (44 MB) and audio files properly stored as LFS pointers
- **No PII in code**: Only public contact info (collective.app@proton.me)
- **Cloudinary architecture**: Server-signed uploads via Cloud Functions — no client-side secrets
- **Firestore rules**: Comprehensive security rules in place
- **.gitignore**: All sensitive files (`.env`, `functions/.env`) properly ignored

### Recommended Additions

| File | Status | Priority |
|------|--------|----------|
| CONTRIBUTING.md | Missing | High — GitHub surfaces this automatically to new contributors |
| CODE_OF_CONDUCT.md | Missing | High — standard for community-oriented projects |
| SECURITY.md | Missing | Medium — tells people how to report vulnerabilities responsibly |
| CHANGELOG.md | Missing | Low — helpful but not required |

### package.json Polish

- Add `"license": "MIT"`
- Add `"description"` with a meaningful summary
- Add `"repository": { "type": "git", "url": "https://github.com/..." }`
- Add `"engines": { "node": ">=18.0.0" }`
- Consider removing `"private": true` (prevents npm publish — irrelevant but signals "not open source")

---

## Action Plan

### Before You Announce (Recommended)

1. Add `CONTRIBUTING.md` with fork/branch/PR workflow
2. Add `CODE_OF_CONDUCT.md` (Contributor Covenant is standard)
3. Add `SECURITY.md` with responsible disclosure instructions
4. Update `package.json` metadata (license, description, repository, engines)
5. Add `.claude/` to .gitignore and untrack it
6. Remove or `__DEV__`-wrap console.log statements

### When You Have Time (Nice to Have)

7. Clean up 41 lint warnings (unused imports/styles)
8. Fix missing useEffect dependencies in DashboardScreen.js
9. Remove phantom font references in App.js (PressStart2P, FiraCode)
10. Run `npm audit fix` for minimatch vulnerability
11. Consider refactoring files over 1,500 lines
12. Evaluate whether react-dom and react-native-web are needed
13. Add CHANGELOG.md
14. Consider LFS-tracking large PNG backgrounds (38 MB total)

---

*Generated by Claude — March 4, 2026*
