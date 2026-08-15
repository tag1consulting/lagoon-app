import { StyleSheet, Text, View } from 'react-native';

import { spacing, useTheme } from '@/theme';

export default function Index() {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>Lagoon Mobile</Text>
      <Text style={{ color: theme.textMuted }}>Scaffold ready — contexts coming next.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
});
