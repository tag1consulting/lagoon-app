import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useContextsStore } from '@/contexts/store';
import { useTheme } from '@/theme';

/** Wait for the persisted context registry to rehydrate before routing. */
function useStoreHydrated(): boolean {
  const [hydrated, setHydrated] = useState(useContextsStore.persist.hasHydrated());
  useEffect(() => {
    const unsub = useContextsStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);
  return hydrated;
}

export default function Index() {
  const theme = useTheme();
  const hydrated = useStoreHydrated();
  const hasContexts = useContextsStore((s) => s.contexts.length > 0);

  if (!hydrated) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (!hasContexts) {
    return <Redirect href="/contexts/add" />;
  }

  return <Redirect href="/(main)/projects" />;
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
});
