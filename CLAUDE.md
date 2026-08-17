# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A mobile client (Expo / React Native, Android-first) for the [Lagoon](https://github.com/uselagoon/lagoon) application delivery platform. It browses projects and environments, watches deployments and tasks with their build logs, and triggers deploys/tasks — across **multiple Lagoon instances**, mirroring `lagoon-cli`'s context model.

## Commands

```bash
npm run lint                      # eslint
npm run typecheck                 # tsc --noEmit
npm test                          # jest
npm test -- ansi                  # single suite by filename pattern
npm test -- -t "single flight"    # single test by name
npm run codegen                   # regenerate src/graphql/generated from documents
npm run codegen:check             # CI gate: regenerate and fail if output drifts
npm run bundle                    # Metro/Hermes export — catches what tsc can't
```

`codegen:check` stages `src/graphql/generated` before diffing (so newly generated files count as drift) — running it locally leaves those files in the git index.

CI (`.github/workflows/ci.yml`) runs `codegen:check`, `lint`, `typecheck`, `test`, `bundle` on every push. `bundle` is the only check that exercises module resolution and the Hermes compiler, so it catches broken imports and unsupported syntax that typecheck passes over. It does **not** verify native modules — only a real Gradle/Xcode build does.

**Running the app requires a development build — Expo Go will not work**, because the OAuth flow uses the `lagoonmobile://` custom scheme. Use `npm run android` (needs a local Android SDK) or `eas build --profile development`. Once a dev client is installed, `npm start` is enough for iteration.

## Getting a build onto a phone

`.github/workflows/android-build.yml` runs on every PR and uploads an `app-release-apk` artifact. Facts learned the hard way:

- It builds **release**, not debug, on purpose. A debug APK boots the `expo-dev-client` launcher ("Development Build", asking for a dev-server URL) and is useless without Metro on the same network. Release embeds the JS bundle and runs standalone.
- Release is signed with the **debug keystore** (Expo/RN template default), so no secrets are needed. Fine for internal testing, not for Play Store.
- Debug and release share the package name but not the signature — **uninstall any previous build first** or Android refuses the install.
- The build takes ~25 min and a warm Gradle cache does not help (measured: 25m41s cold vs 25m38s warm — it is compilation-bound). Job timeout is 45 min.

### What each check actually proves

`lint`/`typecheck`/`test` → `bundle` → native build, in increasing strength. `bundle` catches unresolvable imports and Hermes-unsupported syntax; only the native build exercises Gradle, autolinking, and the native modules behind `expo-secure-store`/`expo-auth-session`/`expo-crypto`. **None of them prove the app works at runtime** — that needs a device and a reachable Lagoon.

## Architecture

### Contexts are the organizing principle

Everything is scoped to a **context** (one Lagoon instance). `src/contexts/store.ts` is a persisted Zustand registry; `activeContextId` selects the current one. When adding a feature, assume it must work against any context and never leak data between them.

Two subsystems are keyed by context id and must stay in sync with the registry:

- `src/api/clientFactory.ts` — one `ApolloClient` per context, each with its own `InMemoryCache`. Evicted when a context is deleted *or* when its connection settings change (`registerClientCleanup`).
- `src/auth/authManager.ts` — in-memory access tokens per context; refresh/static tokens in `expo-secure-store`, one key per context (`registerAuthCleanup` purges on delete).

Both cleanup subscriptions are registered once in `app/_layout.tsx`.

`app/(main)/_layout.tsx` is where contexts, auth, and Apollo meet: it guards the authed routes, attempts silent session restore before redirecting to `/login`, eagerly refreshes on app foreground, and mounts `<ApolloProvider>` keyed by context id so switching contexts remounts the whole authed subtree.

### Auth

Keycloak OIDC Authorization Code + PKCE through the system browser, against each instance's `lagoon` realm. Notable behaviors encoded in `authManager.ts`:

- Refresh is **single-flight** per context — concurrent callers share one promise.
- Login retries without the `offline_access` scope if the realm rejects it.
- `getValidAccessToken` is the only token entry point; `src/api/links.ts` calls it per operation and, on an auth rejection, forces one refresh and retries once before surfacing the error.
- Contexts can instead use `authMode: 'static-token'` (a pasted JWT, no refresh) — a fallback for instances whose Keycloak pins redirect URIs. Preserve this path when touching auth.

Some Keycloak clients pin redirect URIs, so `keycloakClientId` is per-context and editable; `app/login.tsx` explains the admin fix.

#### The redirect-URI failure mode (observed against a real instance)

The app sends exactly `lagoonmobile://auth` (from `makeRedirectUri` in `src/auth/pkce.ts`). If the instance's Keycloak client does not allow it, login fails with **"Invalid parameter: redirect_uri"**.

The subtlety that shaped the code: **Keycloak renders that error on its own page and never redirects back**, so `promptAsync` returns a plain `dismiss` — indistinguishable from the user closing the browser. There is no `error` result to detect. `loginWithOidc` therefore treats *any* dismissal as a possible redirect-URI problem and surfaces the guidance panel, which prints the exact redirect URI with tap-to-copy. Do not "fix" that by hiding the panel on cancel; a genuine cancel simply ignores it.

Fixes, in preference order:
1. Register a dedicated public client (e.g. `lagoon-mobile`: standard flow on, public, valid redirect URIs `lagoonmobile://*`) and set it as the context's client ID — no rebuild needed, and it leaves the web dashboard's client alone.
2. Append `lagoonmobile://*` to the existing `lagoon-ui` client. Append, never replace: dropping an existing entry breaks dashboard login.

Upstream ships `lagoon-ui` with `redirectUris: ["*"]`, overridable via `KEYCLOAK_LAGOON_UI_CLIENT_REDIRECT_URIS`. Where an install manages Keycloak through IaC, change it there — and check whether it reconciles an **existing** realm, since Lagoon's Keycloak bootstrap guards many steps with "skip if already configured".

Until an instance is fixed, `authMode: 'static-token'` is the working path.

### GraphQL

`graphql/schema.graphql` is a **vendored snapshot** extracted from the `gql` template in `uselagoon/lagoon`'s `services/api/src/typeDefs.js` (refresh process documented in README). Write queries in `src/graphql/documents/*.graphql`, then run `npm run codegen`; generated output is committed and CI fails on drift.

Keep field selections conservative so older Lagoon instances keep working. Newer API surface goes behind `src/api/versionGate.ts`, which semver-checks the instance's cached `lagoonVersion` and **fails closed** on unknown versions.

### Live updates and logs

Two rules that shape most of the deployment/task code:

1. **Subscriptions are an enhancement, never load-bearing.** `src/api/liveUpdates.ts` wraps `deploymentChanged`/`taskChanged` over graphql-ws (Lagoon ≥ 2.27, split out in `links.ts`), but an instance's ingress may block WebSockets, so every consumer also polls (10s) while a deployment/task is non-terminal. Subscription errors are logged, not surfaced.
2. **Logs are fetched, not streamed.** `Deployment.buildLog` and `Task.logs` are plain String fields that can reach multiple MB, so they live in *dedicated* queries (`DeploymentWithLog`, `TaskWithLog`) and must never be selected in list queries. Subscription payloads carry status only; a status change triggers a log refetch.

`src/components/LogViewer/` handles the size: `useLogLines.ts` tokenizes in 2k-line slices off the interaction path, rendering is windowed to the newest 10k lines via FlashList with chat-style stick-to-bottom, and `src/utils/ansi.ts` is a hand-rolled SGR tokenizer (colors/bold; everything else stripped) that carries color state across lines.

### Implemented scope

V1 is deliberately "monitor + operate": browse projects/environments, watch deployments and tasks with logs, `deployEnvironmentLatest`, `cancelDeployment`, `invokeRegisteredTask`, and raw `addTask`. `src/graphql/documents/` is the complete list of operations the app issues.

Large parts of the Lagoon API are intentionally unused so far — backups/restores, environment variable management, insights, problems, fact search, idle/unidle, per-service stop/start, project cloning, and all organization/user/group administration. The vendored schema already covers them, so adding one is a matter of writing the document and screen; check `versionGate.ts` first for anything added after Lagoon 2.27.

### Runtime gotcha

**Do not assume web globals exist.** Expo's tsconfig includes the DOM lib, so browser APIs type-check but may not exist on Hermes. `atob` is polyfilled by neither React Native nor Expo — `src/auth/jwt.ts` decodes base64url by hand for this reason. `TextDecoder` *is* installed (Expo's winter runtime). Verify against `node_modules` before relying on a global; `tsc` will not catch it.

### Conventions

- `app/` is expo-router routes and should stay composition-only — logic belongs in `src/` so it is testable without navigation.
- `@/` maps to `src/`.
- All mutating actions (deploy, cancel, run task) go through `ConfirmSheet`.
- Status colors and the active/cancellable predicates live only in `src/theme/status.ts`.
- Diagnostic logs pass variables as separate `console.warn` arguments rather than interpolating them, keeping the format string literal.

## Verification status

The app has **never been exercised end-to-end against a live Lagoon**. CI is green and a release APK installs and runs, but browsing, deploys, tasks, and log streaming are all unverified against a real API. Treat any claim that a screen "works" as unproven until someone confirms it on a device.

Known-good so far: context add/edit persists, and the PKCE flow reaches a real Keycloak (it got as far as being rejected for its redirect URI).

## Working in the Claude Code web/remote sandbox

If you are running in the hosted remote environment, these are hard limits, not things to retry:

- `dl.google.com` and `api.expo.dev` are **blocked by the egress network policy** (403 at the gateway). That means no Android SDK download, no Google Maven (so no local Gradle build), and no EAS login or builds. Maven Central and `services.gradle.org` *are* reachable, which is not sufficient on its own.
- There is no `/dev/kvm` and no virtualization CPU flags, so **the Android emulator cannot run** — this one is hardware, not policy.
- Consequence: native verification has to happen in CI (`android-build.yml`), and nothing here can run the app. Don't burn time trying to install the SDK.
- `npm run bundle` *does* work locally and is the strongest local check available.

## Notes

- `.npmrc` sets `legacy-peer-deps=true`; installs fail without it (a transitive `react-dom` peer wants a newer React than Expo pins).
- `jest-expo` is built on jest 29 internals — do not upgrade jest to 30 in isolation.
- `@testing-library/react-native` v14 is async: `await render(...)` and `await fireEvent...`, and it has no global `screen` export.
- `.github/workflows/ai-pr-review.yml` runs an AI reviewer on PRs; it needs an `AI_REVIEW_API_KEY` (or `ANTHROPIC_API_KEY`) repository secret, and its slash commands stay dormant until the workflow is on the default branch.
- Workflow action references carry `# nosemgrep:` suppressions for the mutable-action-tag rule, with the rule named so other findings still surface. Keep that form if you add steps.
