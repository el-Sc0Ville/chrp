# Chrp — Dev Environment Setup

## Requirements

- **Node**: v22 (tested on v22.22.2)
- **Expo SDK**: 54

## Install dependencies

Always use `--legacy-peer-deps`. Never run plain `npm install`.

```bash
npm install --legacy-peer-deps
```

An `.npmrc` file at the project root sets this as the default, so bare `npm install` also works correctly in this repo.

## Start the dev server

```bash
npx expo start --clear
```

The `--clear` flag flushes the Metro bundle cache. Use it after any dependency changes or if the app crashes with a stale bundle.

## After `git reset --hard` or any branch switch

Verify the Expo version is still SDK 54:

```bash
grep '"expo"' package.json
# Expected: "expo": "~54.0.0"
```

If it shows `~52.0.0` or anything other than `~54.0.0`, the wrong baseline was checked out. Do not proceed — find the correct commit.

## If `expo-asset` (or any Expo package) goes missing

```bash
npm install expo-asset --legacy-peer-deps
```

Use the same flag for any individual package install.

## Firebase config

The Firebase config is **hardcoded** in `src/firebase/config.ts` for Expo Go development. The `.env` / `EXPO_PUBLIC_*` approach does not work reliably in Expo Go.

**Do not switch to environment variables** until preparing an App Store / Play Store production build. The hardcoded values are intentional and tracked in git for the dev phase.

## Key files

| File | Purpose |
|---|---|
| `src/firebase/config.ts` | Hardcoded Firebase config (Firestore + Auth) |
| `src/firebase/auth.ts` | Magic link auth helpers |
| `src/firebase/index.ts` | Re-exports `db` and `auth` |
| `src/screens/AuthScreen.tsx` | Sign-in screen (magic link + invite code) |
| `src/navigation/index.tsx` | Auth gate — shows `AuthScreen` until signed in |
