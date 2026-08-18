---
layout: default
title: Builds & Installing on a Phone
nav_order: 3
render_with_liquid: false
---

# Builds & Installing on a Phone

## Getting a build onto a phone

The Android build workflow runs once per merge to `main` (not on every PR push — a full native build is too expensive to run on every commit under review) and uploads an `app-release-apk` artifact from the workflow run page. Unzip it, transfer `app-release.apk` to the phone, and install it (Android will ask you to allow installs from that source). Artifacts from that trigger expire after 14 days.

For a durable copy, every [GitHub release](https://github.com/tag1consulting/lagoon-app/releases) has the same APK attached directly to the release page, built fresh from the tagged commit — that copy doesn't expire. This is the recommended way to get a build.

That APK is standalone — the JS bundle is embedded, so it launches straight into the app.

> {: .warning }
> A **debug** build behaves differently: because `expo-dev-client` is installed, it boots a "Development Build" launcher asking for a dev server URL, and needs `npx expo start` running on the same network. Use the release artifact unless you specifically want live reload. Debug and release also share the package name but not the signature, so **uninstall any previous build first** or Android will refuse the install.

## Building locally

All builds are native (Gradle / Xcode) — there's no cloud build service involved. `android/` and `ios/` aren't committed (continuous native generation via `expo prebuild`), so they're regenerated from `app.config.ts` before every build.

### Android

```bash
npx expo prebuild --platform android --no-install
cd android && ./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```

This is exactly what `android-build.yml` runs in CI. Play Store distribution needs an AAB instead (`./gradlew bundleRelease`) and a real signing key.

### iOS

Needs a Mac with Xcode and the Command Line Tools installed. There is no iOS-specific app code — the URL scheme and auth-session browser behavior come from the shared Expo config in `app.config.ts`.

```bash
npm install
npm run ios              # Debug dev-client build, runs on the first booted simulator
npm run ios -- -d        # prompts to pick a physical device instead
```

For a Release build without installing (build-only, unsigned):

```bash
npx expo run:ios --configuration Release --device generic --output ./build
```

An installable, signed build (a real device beyond your own, TestFlight, or the App Store) needs Xcode's own signing flow: run `npx expo prebuild --platform ios`, open `ios/*.xcworkspace` in Xcode, set your Apple Developer team under **Signing & Capabilities**, then **Product → Archive** and distribute from the Organizer. A physical-device install for personal testing works with a free Apple ID; TestFlight/App Store distribution needs a paid Apple Developer Program membership ($99/year) — that requirement comes from Apple, not from any build tooling choice.

## iOS in CI (simulator only, manual trigger)

`.github/workflows/ios-build.yml` builds the native Xcode project on a GitHub-hosted macOS runner and uploads the resulting `.app` as a workflow artifact, the same validation `android-build.yml` gives Android — it just proves the native build compiles. It's `workflow_dispatch`-only (run it manually from the Actions tab) and produces an unsigned Simulator build only: no install on a real device, no distribution.

> {: .note }
> GitHub-hosted macOS runners cost roughly 10x a Linux runner's per-minute rate, and consume a Team plan's shared monthly included-minutes pool at that same 10x rate. That's why this doesn't run automatically on push or release yet, and why there's no code signing wired up for an installable/distributable build — both are separate follow-up decisions.

## Signing

Release builds from the GitHub Actions workflow are signed with the **debug keystore** (the Expo/RN template default), so no secrets are needed to produce them. That's fine for internal testing, but not for a Play Store submission — a production release needs a real signing key.
