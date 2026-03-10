export default {
  expo: {
    name: 'Cafe Social',
    slug: 'cafe-social',
    version: '0.1.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    scheme: 'cafesocial',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.cafesocial.app',
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
      package: 'com.cafesocial.app',
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/favicon.png',
    },
    plugins: [],
    runtimeVersion: {
      policy: 'appVersion',
    },
    updates: {
      checkAutomatically: 'ON_LOAD',
    },
    extra: {
      eas: {
        projectId: '00000000-0000-0000-0000-000000000000',
      },
    },
  },
};

