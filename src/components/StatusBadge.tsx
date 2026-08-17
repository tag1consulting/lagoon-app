import { StyleSheet, Text, View } from 'react-native';

import { statusColor } from '@/theme/status';

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const color = statusColor(status);
  return (
    <View style={[styles.badge, { backgroundColor: `${color}22`, borderColor: color }]}>
      <Text style={[styles.text, { color }]}>{status ?? 'unknown'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
