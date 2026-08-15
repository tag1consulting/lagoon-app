import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { registerClientCleanup } from '@/api/clientFactory';
import { registerAuthCleanup } from '@/auth/authManager';
import { useTheme } from '@/theme';

export default function RootLayout() {
  const theme = useTheme();

  // Purge secure-store tokens and Apollo clients when contexts are deleted
  // or their connection settings change.
  useEffect(() => {
    const unsubAuth = registerAuthCleanup();
    const unsubClients = registerClientCleanup();
    return () => {
      unsubAuth();
      unsubClients();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.surface },
          headerTintColor: theme.text,
          contentStyle: { backgroundColor: theme.background },
        }}
      />
    </GestureHandlerRootView>
  );
}
