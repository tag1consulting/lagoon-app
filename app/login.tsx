import * as Clipboard from 'expo-clipboard';
import { Link, Stack, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  LoginRedirectError,
  loginWithOidc,
  loginWithStaticToken,
} from '@/auth/authManager';
import { jwtExpiryMs } from '@/auth/jwt';
import { redirectUriFor } from '@/auth/pkce';
import { Button, Card, EmptyState, Field } from '@/components/ui';
import { useActiveContext } from '@/contexts/store';
import { spacing, useTheme } from '@/theme';

function RedirectHelp({ clientId, redirectUri }: { clientId: string; redirectUri: string }) {
  const theme = useTheme();
  const copyRedirectUri = async () => {
    await Clipboard.setStringAsync(redirectUri);
  };

  return (
    <Card>
      <Text style={[styles.helpTitle, { color: theme.text }]}>
        Keycloak may be rejecting this app&apos;s redirect URI
      </Text>
      <Text style={{ color: theme.textMuted, marginTop: spacing.xs }}>
        This app asks Keycloak to redirect back to:
      </Text>
      <Pressable onPress={() => void copyRedirectUri()} accessibilityRole="button">
        <Text selectable style={[styles.redirectUri, { color: theme.text, borderColor: theme.border }]}>
          {redirectUri}
        </Text>
        <Text style={{ color: theme.primary, fontSize: 12 }}>Tap to copy</Text>
      </Pressable>
      <Text style={{ color: theme.textMuted, marginTop: spacing.sm }}>
        An administrator of this Lagoon instance can allow it by either:
        {'\n\n'}1. Adding that URI (or {`“lagoonmobile://*”`}) to Valid Redirect URIs on the{' '}
        {`“${clientId}”`} client in the {'“lagoon”'} Keycloak realm, or
        {'\n\n'}2. Creating a dedicated public client for this app — Standard Flow enabled,
        Valid Redirect URIs {`“lagoonmobile://*”`} — and setting its ID in this context&apos;s
        settings.
        {'\n\n'}To get going right now without an admin, switch this context to
        {' “Use a pasted token”'} in its settings.
      </Text>
    </Card>
  );
}

export default function LoginScreen() {
  const theme = useTheme();
  const context = useActiveContext();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRedirectHelp, setShowRedirectHelp] = useState(false);
  const [pastedToken, setPastedToken] = useState('');

  if (!context) {
    return <EmptyState title="No active context" body="Add a Lagoon context first." />;
  }

  const handleOidcLogin = async () => {
    setBusy(true);
    setError(null);
    try {
      await loginWithOidc(context);
      router.replace('/');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Login failed.';
      setError(message);
      if (e instanceof LoginRedirectError && e.likelyRedirectUriProblem) {
        setShowRedirectHelp(true);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleTokenLogin = async () => {
    const expiry = jwtExpiryMs(pastedToken.trim());
    if (expiry !== null && expiry < Date.now()) {
      setError('That token is already expired — generate a fresh one.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await loginWithStaticToken(context, pastedToken);
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not store the token.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: `Sign in to ${context.name}` }} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {context.authMode === 'oidc' ? (
          <>
            <Text style={{ color: theme.textMuted }}>
              Sign in with your Lagoon account via {context.keycloakBaseUrl} (client{' '}
              {context.keycloakClientId}).
            </Text>
            <Button title="Sign in with browser" onPress={handleOidcLogin} loading={busy} />
            {showRedirectHelp ? (
              <RedirectHelp
                clientId={context.keycloakClientId}
                redirectUri={redirectUriFor(context)}
              />
            ) : null}
          </>
        ) : (
          <>
            <Text style={{ color: theme.textMuted }}>
              This context uses a pasted API token. Generate one with{' '}
              <Text style={{ fontWeight: '600' }}>lagoon get token</Text> (lagoon-cli) and paste it
              here.
            </Text>
            <Field
              label="API token"
              placeholder="eyJhbGciOi..."
              multiline
              value={pastedToken}
              onChangeText={setPastedToken}
            />
            <Button
              title="Save token"
              onPress={handleTokenLogin}
              loading={busy}
              disabled={!pastedToken.trim()}
            />
          </>
        )}

        {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}

        <View style={styles.footer}>
          <Link href="/contexts">
            <Text style={{ color: theme.primary }}>Switch context</Text>
          </Link>
          <Link
            href={{ pathname: '/contexts/[contextId]/edit', params: { contextId: context.id } }}
          >
            <Text style={{ color: theme.primary }}>Context settings</Text>
          </Link>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    padding: spacing.md,
  },
  helpTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  redirectUri: {
    borderRadius: 6,
    borderWidth: 1,
    fontFamily: 'monospace',
    fontSize: 13,
    marginVertical: spacing.xs,
    padding: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.lg,
    justifyContent: 'center',
    marginTop: spacing.md,
  },
});
