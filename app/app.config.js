export default {
  expo: {
    name: 'Cafe Social',
    slug: 'cafe-social',
    version: '0.1.0',
    orientation: 'portrait',
    scheme: 'cafesocial',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.cafesocial.app',
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
      package: 'com.cafesocial.app',
    },
    web: {
      bundler: 'metro',
      output: 'single',
    },
    plugins: [],
    runtimeVersion: {
      policy: 'appVersion',
    },
    updates: {
      checkAutomatically: 'ON_LOAD',
    },
  },
};

