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

## Scope

V1 is deliberately "monitor + operate": browse projects/environments, watch deployments and tasks with logs, deploy the latest build, cancel a deployment, invoke a registered task, and run a raw task. Backups/restores, environment variable management, insights, problems, fact search, idle/unidle, per-service stop/start, project cloning, and organization/user/group administration are all intentionally out of scope for now.
