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

Some Keycloak clients pin redirect URIs, so `keycloakClientId` is per-context and editable; `app/login.tsx` detects the failure and explains the admin fix.

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

## Notes

- `.npmrc` sets `legacy-peer-deps=true`; installs fail without it (a transitive `react-dom` peer wants a newer React than Expo pins).
- `jest-expo` is built on jest 29 internals — do not upgrade jest to 30 in isolation.
- `@testing-library/react-native` v14 is async: `await render(...)` and `await fireEvent...`, and it has no global `screen` export.
