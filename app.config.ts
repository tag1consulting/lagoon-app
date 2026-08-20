import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Lagoon Mobile',
  slug: 'lagoon-mobile',
  version: '0.2.0',
  scheme: 'lagoonmobile',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'io.tag1.lagoonmobile',
  },
  android: {
    package: 'io.tag1.lagoonmobile',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: ['expo-router', 'expo-secure-store', 'expo-web-browser'],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
