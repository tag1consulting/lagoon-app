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

## EAS build profiles

- `development` — dev client, internal distribution
- `preview` — release APK for internal hand-off: `eas build --profile preview --platform android`
- `production` — AAB (Play Store), auto-incrementing version

iOS: `eas build --profile preview --platform ios` once Apple credentials are configured in EAS. There is no iOS-specific code — the URL scheme and auth-session browser behavior come from the shared Expo config.

## Signing

Release builds from the GitHub Actions workflow are signed with the **debug keystore** (the Expo/RN template default), so no secrets are needed to produce them. That's fine for internal testing, but not for a Play Store submission — a production release needs a real signing key configured in EAS.
