import { FlashList, FlashListRef } from '@shopify/flash-list';
import * as Clipboard from 'expo-clipboard';
import { memo, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useLogLines } from '@/components/LogViewer/useLogLines';
import { spacing, Theme, useTheme } from '@/theme';
import { AnsiLine, stripAnsi } from '@/utils/ansi';

/** Only the newest lines render by default; older chunks load on demand. */
const TAIL_WINDOW = 10_000;
const EARLIER_CHUNK = 5_000;
/** Within this many px of the bottom counts as "following the tail". */
const FOLLOW_THRESHOLD = 80;

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

const LogLine = memo(function LogLine({ line, theme }: { line: AnsiLine; theme: Theme }) {
  return (
    <Text style={[styles.line, { color: theme.text }]}>
      {line.spans.length === 0 ? ' ' : null}
      {line.spans.map((span, i) => (
        <Text
          key={i}
          style={{
            // Uncolored spans (the common case) fall back to the theme's
            // text color rather than React Native's default black, which is
            // unreadable on the dark theme.
            color: span.color ?? theme.text,
            backgroundColor: span.backgroundColor,
            fontWeight: span.bold ? '700' : '400',
            fontFamily: MONO,
          }}
        >
          {span.text}
        </Text>
      ))}
    </Text>
  );
});

export function LogViewer({ log, running }: { log: string | null | undefined; running: boolean }) {
  const theme = useTheme();
  const { lines, parsing } = useLogLines(log);
  const [windowSize, setWindowSize] = useState(TAIL_WINDOW);
  const [nearBottom, setNearBottom] = useState(true);
  const listRef = useRef<FlashListRef<AnsiLine>>(null);

  const visible = useMemo(
    () => lines.slice(Math.max(0, lines.length - windowSize)),
    [lines, windowSize],
  );
  const hasEarlier = lines.length > windowSize;

  const copyAll = async () => {
    if (log) await Clipboard.setStringAsync(stripAnsi(log));
  };

  if (!log && !parsing) {
    return (
      <View style={styles.emptyBox}>
        <Text style={{ color: theme.textMuted }}>
          {running ? 'No log output yet — check back in a moment.' : 'No log available.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { borderColor: theme.border }]}>
      <View style={[styles.toolbar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={{ color: theme.textMuted, fontSize: 12 }}>
          {parsing ? 'Rendering log…' : `${lines.length.toLocaleString()} lines`}
        </Text>
        <Pressable accessibilityRole="button" onPress={() => void copyAll()}>
          <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '600' }}>Copy log</Text>
        </Pressable>
      </View>

      <FlashList
        ref={listRef}
        data={visible}
        keyExtractor={(line) => String(line.key)}
        renderItem={({ item }) => <LogLine line={item} theme={theme} />}
        contentContainerStyle={styles.listContent}
        // Chat-style tail behavior: start at the bottom and stick to it while
        // new log content arrives, unless the user scrolled away.
        maintainVisibleContentPosition={{
          startRenderingFromBottom: true,
          autoscrollToBottomThreshold: 0.15,
          animateAutoScrollToBottom: false,
        }}
        onScroll={(event) => {
          const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
          const fromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
          setNearBottom(fromBottom < FOLLOW_THRESHOLD);
        }}
        scrollEventThrottle={100}
        ListHeaderComponent={
          hasEarlier ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setWindowSize((s) => s + EARLIER_CHUNK)}
              style={[styles.earlierButton, { borderColor: theme.border }]}
            >
              <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '600' }}>
                Show {Math.min(EARLIER_CHUNK, lines.length - windowSize).toLocaleString()} earlier
                lines
              </Text>
            </Pressable>
          ) : null
        }
      />

      {!nearBottom ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => listRef.current?.scrollToEnd({ animated: true })}
          style={[styles.jumpPill, { backgroundColor: theme.primary }]}
        >
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>↓ Latest</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    overflow: 'hidden',
  },
  toolbar: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  listContent: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  line: {
    fontFamily: MONO,
    fontSize: 11,
    lineHeight: 16,
  },
  emptyBox: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  earlierButton: {
    alignItems: 'center',
    borderBottomWidth: 1,
    padding: spacing.sm,
  },
  jumpPill: {
    borderRadius: 16,
    bottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    position: 'absolute',
    right: spacing.md,
  },
});
