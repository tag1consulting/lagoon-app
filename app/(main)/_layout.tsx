import { Link, Redirect, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Text, View } from 'react-native';

import { getValidAccessToken, useSessionStatus } from '@/auth/authManager';
import { useActiveContext } from '@/contexts/store';
import { useTheme } from '@/theme';

function ContextSwitcherLink({ name }: { name: string }) {
  const theme = useTheme();
  return (
    <Link href="/contexts">
      <Text style={{ color: theme.primary, fontWeight: '600' }}>{name} ▾</Text>
    </Link>
  );
}

export default function MainLayout() {
  const theme = useTheme();
  const context = useActiveContext();
  const status = useSessionStatus(context?.id ?? null);
  // Silent session restore (secure-store token / refresh grant) must get a
  // chance to run before we bounce to the login screen. Tracked per context
  // id so switching contexts restores again without a synchronous reset.
  const [restoredIds, setRestoredIds] = useState<ReadonlySet<string>>(new Set());
  const restoreDone = context ? restoredIds.has(context.id) : false;

  useEffect(() => {
    if (!context) return;
    let cancelled = false;
    void getValidAccessToken(context).finally(() => {
      if (!cancelled) setRestoredIds((prev) => new Set(prev).add(context.id));
    });
    const sub = AppState.addEventListener('change', (state) => {
      // Eager refresh on foreground so the first tap doesn't hit a 401.
      if (state === 'active') void getValidAccessToken(context);
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
    // Re-run only when the active context changes identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context?.id]);

  if (!context) return <Redirect href="/contexts/add" />;

  if (status !== 'signed-in') {
    if (!restoreDone) {
      return (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.background,
          }}
        >
          <ActivityIndicator color={theme.primary} />
        </View>
      );
    }
    return <Redirect href="/login" />;
  }

  return (
    <Stack
      key={context.id}
      screenOptions={{
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.text,
        contentStyle: { backgroundColor: theme.background },
        headerRight: () => <ContextSwitcherLink name={context.name} />,
      }}
    />
  );
}
