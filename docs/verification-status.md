---
layout: default
title: Verification Status
nav_order: 5
render_with_liquid: false
---

# Verification Status

## About this project

This app was built through AI-assisted development with [Claude Code](https://claude.ai/code), Anthropic's coding agent, under human direction and review: a human developer set the architecture, reviewed the implementation, and directed testing, while Claude Code wrote and iterated on most of the code.

## What's confirmed

The app has been tested end-to-end against a live Lagoon instance from a physical Android device, covering:

- OIDC login
- Browsing projects and environments
- Triggering and cancelling deployments
- Running tasks
- Viewing build/task logs

CI is green and a release APK installs and runs on real hardware.

## What's not yet confirmed

- **iOS** — all testing so far is Android.
- **The static-token auth fallback** — the OIDC path has been exercised live; the pasted-token path has not.
- **Backups, restore, and environment variables** — implemented but not yet exercised against a live instance from a device. Treat as unverified until confirmed the same way login/deployments/tasks were.
- **Anything outside V1 scope** — insights, problems, fact search, idle/unidle, per-service stop/start, project cloning, and organization/user/group administration are not implemented, so there's nothing to verify there yet. See [Architecture](architecture#scope).

CI's `lint`/`typecheck`/`test`/`bundle` checks don't exercise native modules — only a real Gradle/Xcode build does, and that build doesn't run the app. Treat any claim that a specific screen or flow "works" as tied to the coverage listed above, not a blanket guarantee.
