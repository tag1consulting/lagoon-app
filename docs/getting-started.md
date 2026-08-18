---
layout: default
title: Getting Started
nav_order: 1
render_with_liquid: false
---

# Getting Started

## Stack

- [Expo](https://expo.dev) (managed workflow + dev client), [expo-router](https://docs.expo.dev/router/introduction/), TypeScript (strict)
- Apollo Client + `graphql-ws` against Lagoon's GraphQL API (`https://api.<host>/graphql`)
- Keycloak OIDC Authorization Code + PKCE via the system browser (`expo-auth-session`), refresh tokens in `expo-secure-store`; static-token paste as fallback
- Zustand for the on-device context registry

## Development

This app requires a development build (`expo-dev-client`). It will **not** work in Expo Go — the OAuth custom-scheme redirect (`lagoonmobile://`) needs a real build.

```bash
npm install
npm run android        # build & launch dev client on Android (needs Android SDK)
# or: eas build --profile development --platform android
npm start              # Metro only, once a dev client is installed
```

## Checks

```bash
npm run compat:check    # ungated GraphQL operations must work on Lagoon 2.8
npm run lint
npm run typecheck
npm test
npm run bundle          # Metro/Hermes export — catches what tsc can't
```

CI runs `codegen:check`, `compat:check`, `lint`, `typecheck`, `test`, and `bundle` on every push. None of these exercise native modules — only a real Gradle/Xcode build does. See [Verification Status](verification-status) for what has actually been confirmed on a device.

## GraphQL schema

`graphql/schema.graphql` is a vendored snapshot of the Lagoon API schema. To refresh it, copy the `gql` template literal's contents from [`services/api/src/typeDefs.js`](https://github.com/uselagoon/lagoon/blob/main/services/api/src/typeDefs.js) at `uselagoon/lagoon` `main` into `graphql/schema.graphql`, then run:

```bash
npm run codegen
```

Typed documents live in `src/graphql/documents/*.graphql`; generated output is committed and CI fails if it drifts (`npm run codegen:check`). See [Architecture](architecture) for how query selections stay compatible with older Lagoon instances.
