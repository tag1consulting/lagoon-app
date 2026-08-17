import Constants from 'expo-constants';
import { Stack, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text } from 'react-native';

import { logout } from '@/auth/authManager';
import { Button, Card } from '@/components/ui';
import { useActiveContext, useContextsStore } from '@/contexts/store';
import { spacing, useTheme } from '@/theme';

export default function SettingsScreen() {
  const theme = useTheme();
  const context = useActiveContext();
  const contexts = useContextsStore((s) => s.contexts);
  const removeContext = useContextsStore((s) => s.removeContext);
  const [busy, setBusy] = useState(false);

  const handleSignOut = async () => {
    if (!context) return;
    setBusy(true);
    try {
      await logout(context.id);
      router.replace('/login');
    } finally {
      setBusy(false);
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear all data?',
      'Removes every Lagoon context and all saved logins from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear everything',
          style: 'destructive',
          onPress: () => {
            // removeContext triggers token + client cleanup per context.
            for (const c of [...contexts]) removeContext(c.id);
            router.replace('/');
          },
        },
      ],
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Settings' }} />
      <ScrollView contentContainerStyle={styles.container}>
        <Image
          source={require('../assets/lagoon-mark.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="Lagoon logo"
        />
        {context ? (
          <Card>
            <Text style={{ color: theme.text, fontWeight: '600' }}>{context.name}</Text>
            <Text style={{ color: theme.textMuted, fontSize: 12 }}>{context.graphqlUrl}</Text>
            {context.lagoonVersion ? (
              <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                Lagoon {context.lagoonVersion}
              </Text>
            ) : null}
            <Text style={{ color: theme.textMuted, fontSize: 12 }}>
              Sign-in: {context.authMode === 'oidc' ? 'Keycloak (browser)' : 'pasted token'}
            </Text>
          </Card>
        ) : null}

        {context?.uiUrl ? (
          <Button
            title="Open web UI"
            variant="secondary"
            onPress={() => void WebBrowser.openBrowserAsync(context.uiUrl!)}
          />
        ) : null}
        {context ? (
          <Button
            title={`Sign out of ${context.name}`}
            variant="secondary"
            onPress={() => void handleSignOut()}
            loading={busy}
          />
        ) : null}
        <Button title="Clear all data" variant="danger" onPress={handleClearAll} />

        <Text style={{ color: theme.textMuted, fontSize: 12, textAlign: 'center' }}>
          Lagoon Mobile {Constants.expoConfig?.version ?? ''}
        </Text>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    padding: spacing.md,
  },
  logo: {
    alignSelf: 'center',
    height: 72,
    marginTop: spacing.sm,
    width: 72,
  },
});
