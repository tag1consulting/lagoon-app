# Lagoon Mobile

A mobile client for the [Lagoon](https://github.com/uselagoon/lagoon) application delivery platform. Browse projects and environments, watch deployments and tasks (with build logs), trigger deployments/tasks, browse backups and restore them, and manage project/environment variables — across multiple Lagoon instances with a quick context switcher, mirroring `lagoon-cli`'s context model.

Android-first; iOS builds from the same codebase.

Full documentation: **[tag1consulting.github.io/lagoon-app](https://tag1consulting.github.io/lagoon-app/)**

## About this project

This app was built through AI-assisted development with [Claude Code](https://claude.ai/code), Anthropic's coding agent, under human direction and review: a human developer set the architecture, reviewed the implementation, and directed testing, while Claude Code wrote and iterated on most of the code. It has been tested end-to-end against a live Lagoon instance from a physical Android device, covering login, browsing projects/environments, triggering and cancelling deployments, running tasks, and viewing build/task logs.

## Stack

- [Expo](https://expo.dev) (managed workflow + dev client), [expo-router](https://docs.expo.dev/router/introduction/), TypeScript (strict)
- Apollo Client + `graphql-ws` against Lagoon's GraphQL API (`https://api.<host>/graphql`)
- Keycloak OIDC Authorization Code + PKCE via the system browser (`expo-auth-session`), refresh tokens in `expo-secure-store`; static-token paste as fallback
- Zustand for the on-device context registry

## Development

> **Note:** this app requires a development build (`expo-dev-client`). It will **not** work in Expo Go — the OAuth custom-scheme redirect (`lagoonmobile://`) needs a real build.

```bash
npm install
npm run android        # build & launch dev client on Android (needs Android SDK)
npm run ios            # build & launch dev client on iOS (needs a Mac with Xcode)
npm start              # Metro only, once a dev client is installed
```

Checks:

```bash
npm run codegen:check   # regenerate src/graphql/generated and fail on drift
npm run compat:check    # ungated GraphQL operations must work on Lagoon 2.8
npm run lint
npm run typecheck
npm test
npm run bundle          # Metro/Hermes export — catches what tsc can't
```

CI runs all six on every push (see [CLAUDE.md](CLAUDE.md) for what each one actually proves).

## GraphQL schema

`graphql/schema.graphql` is a vendored snapshot of the Lagoon API schema, extracted from the `gql` template in [`services/api/src/typeDefs.js`](https://github.com/uselagoon/lagoon/blob/main/services/api/src/typeDefs.js) at `uselagoon/lagoon` `main`. To refresh it, copy the template literal's contents from that file into `graphql/schema.graphql` (or introspect a live instance: `npx get-graphql-schema https://api.<host>/graphql -h "Authorization=Bearer $TOKEN"`), then run:

```bash
npm run codegen
```

Typed documents live in `src/graphql/documents/*.graphql`; generated output is committed and CI fails if it drifts (`npm run codegen:check`). Query selections stay conservative so older Lagoon instances keep working; newer API surface is gated by `src/api/versionGate.ts` using the instance's `lagoonVersion`.

## Builds

All builds are native (Gradle / Xcode) — there's no cloud build service involved. `android/` and `ios/` aren't committed (continuous native generation via `expo prebuild`), so they're regenerated from `app.config.ts` before every build.

### Android

```bash
npx expo prebuild --platform android --no-install
cd android && ./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```

This is exactly what `.github/workflows/android-build.yml` runs in CI. Play Store distribution needs an AAB instead (`./gradlew bundleRelease`) and a real signing key — CI's debug-keystore signature is fine for sideloading, not for the Play Store.

### iOS

Needs a Mac with Xcode and the Command Line Tools installed.

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

There is no iOS-specific app code — the URL scheme and auth-session browser behavior come from the shared Expo config in `app.config.ts`.

A manual-only (`workflow_dispatch`) `iOS build (simulator, unsigned)` workflow builds the native Xcode project on a GitHub-hosted macOS runner and uploads the resulting `.app` as a workflow artifact — it validates the native build compiles, same as `android-build.yml` does for Android, but produces a Simulator-only binary that isn't installable on a real device or distributable anywhere. It does not run automatically on push or release (macOS runner minutes cost roughly 10x Linux and share the org's Actions-minutes pool), and there's no code signing set up yet for anything beyond that.

## Installing a build on a phone

The **Android build** workflow (`.github/workflows/android-build.yml`) runs once per merge to `main` (not on every PR push — a ~25 min native build on every commit under review is expensive) and attaches an `app-release-apk` artifact — download it from the workflow run page, unzip, transfer `app-release.apk` to the phone, and install it (Android will ask you to allow installs from that source). Artifacts from that trigger expire after 14 days. It's also available via `workflow_dispatch` if you need a build from a branch that hasn't merged yet.

For a durable copy, every [GitHub release](https://github.com/tag1consulting/lagoon-app/releases) has the same APK attached directly to the release page, built fresh from the tagged commit (the `release: [published]` trigger on the same workflow) — that copy doesn't expire. Publishing a release (`gh release create vX.Y.Z ...` or via the GitHub UI) triggers the build and attaches the APK automatically; nothing extra to run.

That APK is standalone — the JS bundle is embedded, so it launches straight into the app.

> A **debug** APK behaves differently: because `expo-dev-client` is installed, it boots a "Development Build" launcher asking for a dev server URL, and needs `npx expo start` running on the same network. Use the release artifact unless you specifically want live reload.

## Connecting to a Lagoon instance

On first launch the app goes straight to **Add context**. Give it a name (e.g. `Acme`) and the instance's GraphQL endpoint (e.g. `https://api.example.com/graphql` — a bare host works too, `/graphql` is appended). Keycloak and UI URLs are derived as `keycloak.<host>` and `ui.<host>`, both editable if the instance differs. Save, then sign in.

Add more contexts from the same screen; the header shows the current one and taps through to switch.

OIDC login uses the instance's Keycloak `lagoon` realm with the `lagoon-ui` public client by default, redirecting back to `lagoonmobile://auth`.

If login fails with **"Invalid parameter: redirect_uri"**, that instance's Keycloak does not allow the app's redirect URI. The recommended fix is a dedicated public client — `lagoon-mobile`, Standard Flow enabled, public (no secret), Valid Redirect URIs `lagoonmobile://*` — after which you set **Keycloak client ID** on the context in-app. That leaves the web dashboard's `lagoon-ui` client alone.

Both **Keycloak client ID** and **Redirect URI** are per-context fields, so an app rebuild is never needed to match whatever an instance registers.

As a fallback, a context can use a pasted API token (e.g. from `lagoon get token`) instead of OIDC.

## Branding

App icons and the in-app mark (`assets/icon.png`, `assets/android-icon-*.png`, `assets/favicon.png`, `assets/splash-icon.png`, `assets/lagoon-mark.png`) are cropped from the official Lagoon hexagon mark, vectored from [`uselagoon/lagoon-website`](https://github.com/uselagoon/lagoon-website)'s `static/images/Lagoon-Stacked-Logo-Full-Colour.svg`, licensed Apache-2.0 by the Lagoon project (not Tag1-authored).
