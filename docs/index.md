---
layout: home
title: Home
nav_exclude: true
permalink: /
render_with_liquid: false
hero_title: Lagoon Mobile
hero_tagline: "A mobile client for the Lagoon application delivery platform. Browse projects and environments, watch deployments and tasks with their build logs, trigger deploys, retrieve backups, and manage variables — across multiple Lagoon instances."
---

<div class="features">
  <div class="feature">
    <h3><span class="feature-icon">&#9670;</span> Multi-Instance Contexts</h3>
    <p>Everything is scoped to a context (one Lagoon instance). Switch between instances with a quick context switcher, mirroring <code>lagoon-cli</code>'s context model.</p>
  </div>
  <div class="feature">
    <h3><span class="feature-icon">&#9670;</span> Keycloak OIDC + PKCE</h3>
    <p>Authorization Code + PKCE through the system browser against each instance's Keycloak realm, with refresh tokens held in secure storage. A pasted static-token fallback covers instances that pin redirect URIs.</p>
  </div>
  <div class="feature">
    <h3><span class="feature-icon">&#9670;</span> Live Deployments &amp; Tasks</h3>
    <p>Watch deployments and tasks with their build logs. Subscriptions enhance the experience where available; polling keeps everything working when an ingress blocks WebSockets.</p>
  </div>
  <div class="feature">
    <h3><span class="feature-icon">&#9670;</span> Version-Gated GraphQL</h3>
    <p>Query selections stay conservative so older Lagoon instances keep working. Newer API surface is gated by a semver check against the instance's reported version, and fails closed on anything unknown.</p>
  </div>
</div>

## What it does

Lagoon Mobile is a monitor-and-operate client for [Lagoon](https://github.com/uselagoon/lagoon): browse projects and environments, watch deployments and tasks with their build logs, trigger `deployEnvironmentLatest`, `cancelDeployment`, `invokeRegisteredTask`, and raw `addTask`, browse backups and trigger a retrieval, and manage project- and environment-scoped variables — all scoped to whichever Lagoon instance you're currently connected to. Android-first, with iOS builds from the same codebase.

## Quick start

**1. Get a build.** Download the latest release APK from [GitHub Releases](https://github.com/tag1consulting/lagoon-app/releases), transfer it to an Android phone, and install it (Android will ask you to allow installs from that source).

**2. Add your Lagoon instance.** On first launch the app goes straight to **Add context**. Give it a name and the instance's GraphQL endpoint (a bare host works too — `/graphql` is appended). Keycloak and UI URLs are derived automatically and are editable if the instance differs.

**3. Sign in.** OIDC login opens the system browser against the instance's Keycloak `lagoon` realm. See [Connecting to a Lagoon Instance](connecting-to-lagoon) if login fails with an `Invalid parameter: redirect_uri` error.

See [Verification Status](verification-status) for what has been confirmed against a real Lagoon instance so far.
