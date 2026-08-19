---
layout: default
title: Architecture
nav_order: 4
render_with_liquid: false
---

# Architecture

## Contexts are the organizing principle

Everything is scoped to a **context** (one Lagoon instance). A persisted registry holds every context the user has added; one is always active. Every feature is expected to work against any context, and data never leaks between them.

Two subsystems are keyed by context id and stay in sync with the registry:

- An Apollo Client per context, each with its own cache. It's torn down when a context is deleted or when its connection settings change.
- In-memory access tokens per context, with refresh/static tokens held in secure storage under one key per context.

## Auth

Keycloak OIDC Authorization Code + PKCE through the system browser, against each instance's `lagoon` realm.

- Refresh is single-flight per context — concurrent callers share one promise rather than racing separate refreshes.
- Login retries without the `offline_access` scope if the realm rejects it.
- On an auth rejection, the app forces one token refresh and retries the failed request once before surfacing the error.
- A context can instead use a pasted static token (no refresh) — see [Connecting to a Lagoon Instance](connecting-to-lagoon).

See [Connecting to a Lagoon Instance](connecting-to-lagoon) for the redirect-URI failure mode and its fix.

## GraphQL and version compatibility

Lagoon rejects an entire query when it names one field the server's schema version doesn't have — a newer field doesn't degrade gracefully, it blanks the whole screen. To keep older instances working, query selections stay conservative, and newer API surface is gated by a semver check against the instance's reported `lagoonVersion`, **failing closed** on unknown versions.

Where a screen benefits from newer fields, two versions of the query exist: a base operation valid on the oldest supported Lagoon release, and a "detailed" twin that requests the newer fields. The client picks between them based on the instance's detected version, and the extra fields are modeled as optional so the UI simply omits them when absent.

## Live updates and logs

Two rules shape most of the deployment/task code:

1. **Subscriptions are an enhancement, never load-bearing.** GraphQL subscriptions (over `graphql-ws`) report status changes on deployments and tasks, but an instance's ingress may block WebSockets, so every consumer also polls while a deployment/task is non-terminal. Subscription errors are logged, not surfaced to the user.
2. **Logs are fetched, not streamed.** Build and task logs can reach multiple megabytes, so they live in dedicated queries and are never selected alongside list queries. A status change triggers a log refetch rather than a live log stream.

Log rendering handles the size deliberately: text is tokenized off the interaction path, only the newest slice of lines is rendered at a time, and ANSI color codes are interpreted by a small hand-rolled parser rather than a general-purpose terminal emulator.

## Backups, restore, and environment variables

Backups are browse-and-restore only: `addBackup`/`updateRestore` exist in Lagoon's schema, but they're for the backup agent to register that a backup already happened, not a "trigger a backup now" action, so the app never creates backups. Restoring overwrites live environment data, so it goes through the same `ConfirmSheet` destructive-confirmation pattern as every other mutating action. Deleting a backup record and (on Lagoon ≥2.29) downloading a backup's file link are the other two actions on each row.

Environment variables are two genuinely separate lists in Lagoon's API (`Project.envVariables` and `Environment.envVariables`, not merged), so the app has two screens: a project-level one reached from a header link, and an environment-level tab. Values are returned in plaintext by the API — `EnvKeyValue.value` is a normal queryable field, not write-only — so the app masks them client-side (dots, tap to reveal) since they hold secrets in practice even though the API doesn't enforce that. Writes prefer the modern `addOrUpdateEnvVariableByName`/`deleteEnvVariableByName` mutations (Lagoon ≥2.11), falling back to the deprecated by-id `addEnvVariable`/`deleteEnvVariable` pair on 2.8-2.10, where the by-name API doesn't exist yet.

## Scope

V1 is deliberately "monitor + operate": browse projects/environments, watch deployments and tasks with logs, deploy the latest build, cancel a deployment, invoke a registered task, run a raw task, browse backups and trigger restores, and manage project/environment variables. Insights, problems, fact search, idle/unidle, per-service stop/start, project cloning, and organization/user/group administration are all intentionally out of scope for now.
