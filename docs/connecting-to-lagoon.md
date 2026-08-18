---
layout: default
title: Connecting to a Lagoon Instance
nav_order: 2
render_with_liquid: false
---

# Connecting to a Lagoon Instance

On first launch the app goes straight to **Add context**. Give it a name (e.g. `Acme`) and the instance's GraphQL endpoint (e.g. `https://api.example.com/graphql` — a bare host works too, `/graphql` is appended). Keycloak and UI URLs are derived as `keycloak.<host>` and `ui.<host>`, both editable if the instance differs. Save, then sign in.

Add more contexts from the same screen; the header shows the current one and taps through to switch.

OIDC login uses the instance's Keycloak `lagoon` realm with the `lagoon-ui` public client by default, redirecting back to `lagoonmobile://auth`.

## The redirect-URI failure mode

If login fails with **"Invalid parameter: redirect_uri"**, that instance's Keycloak does not allow the app's redirect URI.

> {: .note }
> Keycloak renders that error on its own page and never redirects back, so the app sees a plain "dismiss" — indistinguishable from the user closing the browser. There is no way to tell the two apart from the app side.

The app tries one thing automatically before showing guidance: on a context whose **Keycloak client ID** is still the default `lagoon-ui`, a redirect-URI rejection triggers one silent retry against a `lagoon-mobile` client before falling back to a manual guidance panel with the exact redirect URI (tap-to-copy). This is bounded to exactly one extra browser attempt, so a genuine cancel on a stock instance reopens the browser once more before giving up.

**Recommended fix:** register a dedicated public client per instance:

- Client ID: `lagoon-mobile`
- Standard Flow: enabled
- Access Type: public (no secret)
- Valid Redirect URIs: `lagoonmobile://*`

Then set **Keycloak client ID** to that value on the context in-app. No app rebuild is needed, and the web dashboard's `lagoon-ui` client is untouched.

Both **Keycloak client ID** and **Redirect URI** are per-context fields, editable at any time.

## Static-token fallback

As a fallback, a context can use a pasted API token (e.g. from `lagoon get token`) instead of OIDC — toggle **Use a pasted token** when adding or editing a context. This skips browser login entirely and has no refresh, so the token needs to be replaced when it expires.
