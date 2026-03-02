# Collective App — Open Source Readiness Review v4

**Date:** March 2, 2026
**Reviewer:** Claude
**Commit range:** `bfbb32c` → `7e10753` (5 commits)

---

## Verdict: NOT YET READY — 3 blockers remain

---

## BLOCKER 1: GoogleService-Info.plist committed with real Firebase credentials

Both `GoogleService-Info.plist` (root) and `ios/Collective/GoogleService-Info.plist` are **tracked in git** and contain real Firebase credentials:

- `API_KEY: AIzaSyDRoyikbIZRPu4lJ078MXFurIUHomAjvrg`
- `PROJECT_ID: collective-a8c1d`
- `GCM_SENDER_ID: 71514544405`
- `GOOGLE_APP_ID: 1:71514544405:ios:8e76eacf8d8f3e26f8711c`

The `.gitignore` has `GoogleService-Info.plist` **commented out** (line 83), so git is tracking these files.

**Fix:**
1. Uncomment line 83 in `.gitignore` so it reads `GoogleService-Info.plist` (no `#`)
2. Run `git rm --cached GoogleService-Info.plist ios/Collective/GoogleService-Info.plist`
3. Add a `GoogleService-Info.plist.example` with placeholder values
4. Since git history already contains these keys, either squash history again or rotate the exposed iOS API key after release
5. Document in README that contributors must supply their own `GoogleService-Info.plist`

---

## BLOCKER 2: Video file (45 MB) stored as actual binary, not LFS pointer

`src/assets/videos/collective-promo.mp4` is **45.3 MB** of raw binary tracked in git, despite `.gitattributes` having `*.mp4` LFS rules. The LFS filter wasn't applied to this file.

The audio files (`src/audio/*.mp3`) are correctly stored as LFS pointers — this is just the video that slipped through.

**Fix:**
1. `git rm --cached src/assets/videos/collective-promo.mp4`
2. `git add src/assets/videos/collective-promo.mp4` (LFS filter will engage)
3. Commit — verify it becomes a ~130-byte pointer file

---

## BLOCKER 3: `.firebaserc` is tracked with placeholder value but `.gitignore` has a leading space

Line 18 of `.gitignore` reads ` .firebaserc` (with a leading space). Git's ignore parser treats leading spaces literally on some systems, which means this rule may not consistently work. The file IS currently tracked in git with the placeholder value `"your-firebase-project-id"`, which is fine for the public repo — but the ignore rule needs to be reliable so contributors don't accidentally commit their real project ID.

**Fix:** Remove the leading space on line 18 of `.gitignore` so it reads `.firebaserc` flush left.

---

## WARNINGS (non-blocking but recommended)

### W1: `eas.json` is tracked — should it be?

`eas.json` contains EAS Build configuration and is currently tracked in git, even though `.gitignore` has `eas.json` on line 109. Like `.firebaserc`, the gitignore entry may have a space issue, or the file was committed before the rule was added. The current content is generic (no secrets), but contributors might commit their own EAS config.

**Recommendation:** Run `git rm --cached eas.json` if you want it ignored going forward.

### W2: Duplicate screenshot — `Mutual aid.png` vs `MutualAid.png`

Git shows `MutualAid.png` as deleted (D) and `Mutual aid.png` as the current file. Commit the deletion to clean this up.

### W3: Missing `package.json` metadata

Root `package.json` is missing `"license"`, `"description"`, and `"repository"` fields. These aren't critical but they're standard for open source:

```json
"license": "MIT",
"description": "A privacy-first community platform for groups, mutual aid, events, and ephemeral audio rooms",
"repository": {
  "type": "git",
  "url": "https://github.com/YOUR_USERNAME/CollectiveApp"
}
```

### W4: No CONTRIBUTING.md or CODE_OF_CONDUCT.md

README has basic contributing guidance, but dedicated files are standard for open source projects. GitHub uses these to surface contributor guidelines automatically.

### W5: Background PNGs are full binaries (~38 MB total)

The 12 PNG files in `src/assets/backgrounds/` are tracked as actual binaries (largest: 4.2 MB). Not a blocker, but adding `*.png` to `.gitattributes` for LFS would reduce clone size significantly.

### W6: `.claude/launch.json` is tracked

This is a Claude Code configuration file. It contains no secrets (just Expo/Firebase emulator launch configs), but it's tool-specific and might confuse contributors who don't use Claude Code. Consider adding `.claude/` to `.gitignore`.

---

## PASSED CHECKS

| Check | Status |
|-------|--------|
| `src/config/firebase.js` uses env vars | PASS |
| `functions/index.js` Cloudinary uses env vars | PASS |
| `.env` and `functions/.env` not tracked | PASS |
| `.env.example` files present with placeholders | PASS |
| No Helvetica or copyrighted fonts | PASS |
| Audio files stored as LFS pointers | PASS |
| No `.DS_Store` files tracked | PASS |
| No `node_modules` tracked | PASS |
| MIT License present and complete | PASS |
| ATTRIBUTION.md credits all third-party assets | PASS |
| README has setup instructions and env var docs | PASS |
| No `secrets.txt` or `.secret` files | PASS |
| Firestore rules present | PASS |
| Git history squashed (no old secrets in history) | PASS |
| `.firebaserc` has placeholder project ID | PASS |
| `src/config/googlePlaces.js` uses env var | PASS |
| OnboardingScreen.js — new feature, no secrets | PASS |

---

## Action checklist

- [ ] **Uncomment** `GoogleService-Info.plist` in `.gitignore` (remove `#` from line 83)
- [ ] **Remove from git:** `git rm --cached GoogleService-Info.plist ios/Collective/GoogleService-Info.plist`
- [ ] **Add** `GoogleService-Info.plist.example` with placeholder values
- [ ] **Fix** leading space on `.firebaserc` in `.gitignore` (line 18)
- [ ] **Re-track video through LFS:** `git rm --cached src/assets/videos/collective-promo.mp4 && git add src/assets/videos/collective-promo.mp4`
- [ ] **Commit** `MutualAid.png` deletion
- [ ] **Optional:** Add `"license": "MIT"` and `"description"` to `package.json`
- [ ] **Optional:** Create `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md`
- [ ] **Optional:** Add `*.png` to `.gitattributes` for LFS
- [ ] **Optional:** Add `.claude/` to `.gitignore`
- [ ] **Squash or rewrite** history one more time after fixes (to remove plist keys from prior commits)
