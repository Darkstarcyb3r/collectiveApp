# Open Source Readiness Review: Collective App (v2)

**Date:** March 1, 2026

---

## VERDICT: NEARLY READY

You've knocked out most of the critical blockers from the first review. Firebase config is now env-based, Cloudinary cloud name is env-based, Helvetica fonts are removed, LICENSE and ATTRIBUTION files are in place, the README is professionally formatted, secrets.txt is gone, and audio licensing is documented. One major item remains: cleaning the git history before going public.

---

## Resolved Since v1 Review

- **Firebase config moved to env vars** — `src/config/firebase.js` now reads all values from `process.env.EXPO_PUBLIC_*`. No hardcoded credentials in source.
- **Cloudinary cloud name moved to env** — `functions/index.js` now reads from `process.env.CLOUDINARY_CLOUD_NAME`.
- **Helvetica Neue fonts fully removed** — All 32 proprietary font files deleted from both `assets/` and `src/assets/`, removed from git tracking, and `.gitignore` updated with `**/helvetica-neue*/`.
- **LICENSE file added** — Standard MIT License with proper copyright notice.
- **ATTRIBUTION.md added** — Individual credits with artist names and links for every Pixabay audio track and Unsplash image. This is above-and-beyond for open source.
- **Audio licensing confirmed** — All tracks from Pixabay under the Pixabay Content License. Files replaced with lightweight stubs (~132 bytes each, down from ~95MB total).
- **README completely rewritten** — Proper markdown fencing, accurate project structure, env var documentation matches .env.example, professional tone throughout.
- **secrets.txt deleted** — No longer exists on disk.
- **.env.example files updated** — Both root and `functions/.env.example` list all required variables with placeholder values.
- **Duplicate asset paths consolidated** — `App.js` now references `./src/assets/fonts/` consistently.
- **.firebaserc gitignore entry fixed** — Leading space removed; entry is now properly commented out.

---

## Remaining Items

### 1. Rewrite Git History Before Publishing (Critical)

The current working tree is clean, but **the git history from earlier commits still contains:**

- Hardcoded Firebase API key in `src/config/firebase.js` (since initial commit)
- Hardcoded Cloudinary cloud name `"dvnslqkuw"` in `functions/index.js`
- 32 Helvetica Neue font files (copyrighted)
- Original 95MB audio files (large binaries bloating clone size)

This is the single biggest remaining blocker. Anyone who clones the repo gets the full history, including all old secrets and copyrighted files.

**Recommended fix — choose one:**

- **Option A (cleanest):** Squash into a fresh initial commit:
  ```bash
  git checkout --orphan clean-main
  git add -A
  git commit -m "Initial open source release"
  git branch -D main
  git branch -m main
  ```

- **Option B (preserves some history):** Use [BFG Repo Cleaner](https://rtyley.github.io/bfg-repo-cleaner/) to strip specific files:
  ```bash
  bfg --delete-files '*.otf' --delete-files '*.mp3'
  bfg --replace-text passwords.txt  # file containing strings to redact
  git reflog expire --expire=now --all && git gc --prune=now --aggressive
  ```

**After either approach:** Rotate all API keys (Firebase, Google Places, Cloudinary) since they existed in the old history.

### 2. .firebaserc Still Tracked

`.firebaserc` remains tracked and contains your project ID (`collective-a8c1d`). This is low-risk since it's just a project name, but for a fully clean fork experience, consider either untracking it or replacing the value with a placeholder before the public push.

### 3. Minor: Version Badges in README

The README badges show Expo 51.0 and React Native 0.74, but `package.json` has Expo 54 and React Native 0.81.5. Quick badge update to match.

---

## What Looks Good

All the strengths from v1 still stand, plus your improvements:

- **Firestore security rules** — Thorough auth checks, owner validation, field-level write restrictions, server-only rate limit counters, private push token subcollection
- **27 Cloud Functions** — Clean separation, consistent rate limiting, server-signed Cloudinary uploads, proper Admin SDK usage
- **All credentials loaded from environment** — Firebase, Google Places, and Cloudinary configs all read from env vars with `.env.example` templates
- **MIT License** — Proper file in project root
- **ATTRIBUTION.md** — Individual credits for every audio track and image
- **Professional README** — Clean formatting, accurate project structure, clear setup instructions
- **Clean .gitignore** — Covers env files, secrets, proprietary fonts, build artifacts, platform files
- **App Check** — Using App Attest (iOS) and Play Integrity (Android)

---

## Final Pre-Release Checklist

1. **Rewrite git history** — Squash to clean commit or use BFG (the one remaining hard requirement)
2. **Rotate all API keys** — Firebase, Google Places, Cloudinary (after history cleanup)
3. **Optionally untrack .firebaserc** — Or replace project ID with placeholder
4. **Update version badges** — Match Expo 54 / React Native 0.81.5
5. **Final verification** — Clone the public repo in a fresh directory, confirm no secrets, no copyrighted files, and reasonable repo size
