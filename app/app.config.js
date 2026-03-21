const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID || '';

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
      infoPlist: {
        NSCameraUsageDescription:
          'Cafe Social uses the camera to scan venue QR codes for unlocking.',
        NSLocationWhenInUseUsageDescription:
          'Cafe Social uses your location to detect when you are at a partner café.',
        ...(googleIosUrlScheme && {
          CFBundleURLTypes: [
            {
              CFBundleURLSchemes: [googleIosUrlScheme],
              CFBundleURLName: 'Google Sign-In',
            },
          ],
        }),
      },
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
      package: 'com.cafesocial.app',
      permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION', 'CAMERA'],
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
      'expo-location',
      [
        'expo-camera',
        {
          cameraPermission: 'Allow Cafe Social to scan venue QR codes.',
        },
      ],
      [
        'expo-notifications',
        {
          sounds: [],
        },
      ],
    ],
    extra: {
      eas: easProjectId ? { projectId: easProjectId } : {},
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    updates: {
      checkAutomatically: 'ON_LOAD',
    },
  },
};
