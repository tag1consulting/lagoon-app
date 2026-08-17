import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { registerClientCleanup } from '@/api/clientFactory';
import { registerAuthCleanup } from '@/auth/authManager';
import { useTheme } from '@/theme';

export default function RootLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

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
          // Edge-to-edge on Android draws content behind the system nav bar
          // (most visible with 3-button navigation), so every screen needs
          // this bottom inset or its lowest content/controls get clipped.
          contentStyle: { backgroundColor: theme.background, paddingBottom: insets.bottom },
        }}
      >
        {/*
          (main) hosts its own Stack with its own per-screen headers
          (app/(main)/_layout.tsx). Without this, the root Stack rendered a
          second header above it showing the route segment name "(main)".
        */}
        <Stack.Screen name="(main)" options={{ headerShown: false }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
