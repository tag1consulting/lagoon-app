# Lagoon Mobile

A mobile client for the [Lagoon](https://github.com/uselagoon/lagoon) application delivery platform. Browse projects and environments, watch deployments and tasks (with build logs), and trigger deployments/tasks — across multiple Lagoon instances with a quick context switcher, mirroring `lagoon-cli`'s context model.

Android-first; iOS builds from the same codebase.

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
# or: eas build --profile development --platform android
npm start              # Metro only, once a dev client is installed
```

Checks:

```bash
npm run lint
npm run typecheck
npm test
```

## GraphQL schema

`graphql/schema.graphql` is a vendored snapshot of the Lagoon API schema, extracted from the `gql` template in [`services/api/src/typeDefs.js`](https://github.com/uselagoon/lagoon/blob/main/services/api/src/typeDefs.js) at `uselagoon/lagoon` `main`. To refresh it, copy the template literal's contents from that file into `graphql/schema.graphql` (or introspect a live instance: `npx get-graphql-schema https://api.<host>/graphql -h "Authorization=Bearer $TOKEN"`), then run:

```bash
npm run codegen
```

Typed documents live in `src/graphql/documents/*.graphql`; generated output is committed and CI fails if it drifts (`npm run codegen:check`). Query selections stay conservative so older Lagoon instances keep working; newer API surface is gated by `src/api/versionGate.ts` using the instance's `lagoonVersion`.

## Builds

EAS profiles in `eas.json`:

- `development` — dev client, internal distribution
- `preview` — release APK for internal hand-off: `eas build --profile preview --platform android`
- `production` — AAB (Play Store), auto-incrementing version

iOS: `eas build --profile preview --platform ios` once Apple credentials are configured in EAS. There is no iOS-specific code — the URL scheme and auth-session browser behavior come from the shared Expo config.

A manual GitHub Actions workflow (`EAS Build`) triggers cloud builds; it needs an `EXPO_TOKEN` repository secret (create one at https://expo.dev/settings/access-tokens).

## Connecting to a Lagoon instance

Add a context in-app with a name and the instance's GraphQL endpoint (e.g. `https://api.example.com/graphql`). Keycloak and UI URLs are derived (`keycloak.<host>`, `ui.<host>`) but editable.

OIDC login uses the instance's Keycloak `lagoon` realm with the `lagoon-ui` public client by default. If the instance pins that client's redirect URIs, an admin must either:

1. add `lagoonmobile://*` to the `lagoon-ui` client's Valid Redirect URIs, or
2. create a dedicated public client (e.g. `lagoon-mobile`, Standard Flow enabled, redirect URI `lagoonmobile://*`) and set that client ID on the context in-app.

As a fallback, a context can use a pasted API token (e.g. from `lagoon get token`) instead of OIDC.
