// Google Sign-In iOS: URL scheme is the "reversed" client ID (required for OAuth redirect)
const googleIosClientId = process.env.EXPO_PUBLIC_CLERK_GOOGLE_IOS_CLIENT_ID || '';
const googleIosUrlScheme = googleIosClientId
  ? `com.googleusercontent.apps.${googleIosClientId.split('.apps.googleusercontent.com')[0]}`
  : null;

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
      // Must be a unique identifier registered to your development team.
      bundleIdentifier: 'com.pavaozornija.cafesocial.app',
      usesAppleSignIn: false,
      ...(googleIosUrlScheme && {
        infoPlist: {
          CFBundleURLTypes: [
            {
              CFBundleURLSchemes: [googleIosUrlScheme],
              CFBundleURLName: 'Google Sign-In',
            },
          ],
        },
      }),
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
    // plugins: ['@clerk/expo', 'expo-secure-store', 'expo-web-browser', 'expo-apple-authentication'],
    plugins: [
      '@clerk/expo',
      'expo-secure-store',
      'expo-web-browser',
      'expo-barcode-scanner',
    ],
    runtimeVersion: {
      policy: 'appVersion',
    },
    updates: {
      checkAutomatically: 'ON_LOAD',
    },
  },
};
