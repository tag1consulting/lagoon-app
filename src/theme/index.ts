import { useColorScheme } from 'react-native';

export const palette = {
  light: {
    background: '#f6f8fa',
    surface: '#ffffff',
    text: '#1c2733',
    textMuted: '#5b6b7b',
    border: '#dde3ea',
    primary: '#2563eb',
    danger: '#dc2626',
  },
  dark: {
    background: '#0f1720',
    surface: '#1a2432',
    text: '#e8eef5',
    textMuted: '#93a3b5',
    border: '#2b3949',
    primary: '#60a5fa',
    danger: '#f87171',
  },
};

export type Theme = typeof palette.light;

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? palette.dark : palette.light;
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;
