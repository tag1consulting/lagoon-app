import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { registerAuthCleanup } from '@/auth/authManager';
import { useTheme } from '@/theme';

export default function RootLayout() {
  const theme = useTheme();

  // Purge secure-store tokens whenever a context is deleted.
  useEffect(() => registerAuthCleanup(), []);

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
