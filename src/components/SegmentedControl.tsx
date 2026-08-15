import { Pressable, StyleSheet, Text, View } from 'react-native';

import { spacing, useTheme } from '@/theme';

export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
}: {
  segments: readonly T[];
  value: T;
  onChange: (segment: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {segments.map((segment) => {
        const active = segment === value;
        return (
          <Pressable
            key={segment}
            accessibilityRole="button"
            onPress={() => onChange(segment)}
            style={[styles.segment, active && { backgroundColor: theme.primary }]}
          >
            <Text
              style={{
                color: active ? '#ffffff' : theme.textMuted,
                fontWeight: '600',
                fontSize: 14,
              }}
            >
              {segment}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  segment: {
    alignItems: 'center',
    borderRadius: 9,
    flex: 1,
    paddingVertical: spacing.sm,
  },
});
