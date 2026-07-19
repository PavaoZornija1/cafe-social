const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID || '';

// Google Sign-In iOS: URL scheme is the "reversed" client ID (required for OAuth redirect)
const googleIosClientId = process.env.EXPO_PUBLIC_CLERK_GOOGLE_IOS_CLIENT_ID || '';
const googleIosUrlScheme = googleIosClientId
  ? `com.googleusercontent.apps.${googleIosClientId.split('.apps.googleusercontent.com')[0]}`
  : null;

/** EAS sets APP_ENV per profile (see eas.json). */
const appEnv = (process.env.APP_ENV || 'development').trim().toLowerCase();
const bundleIdentifier =
  appEnv === 'production'
    ? 'com.cafesocial.app'
    : appEnv === 'preview' || appEnv === 'staging'
      ? 'com.cafesocial.app.dev'
      : 'com.pavaozornija.cafesocial.devclient';

export default {
  expo: {
    name: 'Cafe Social',
    slug: 'cafe-social',
    version: '0.1.0',
    // Allow rotation so Brawler can lock landscape via expo-screen-orientation
    orientation: 'default',
    scheme: 'cafesocial',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
      supportsTablet: false,
      // Optional: set EXPO_APPLE_TEAM_ID=XXXXXXXXXX for `expo prebuild` / EAS; matches your Apple Developer team.
      ...(process.env.EXPO_APPLE_TEAM_ID && {
        appleTeamId: process.env.EXPO_APPLE_TEAM_ID,
      }),
      bundleIdentifier,
      usesAppleSignIn: false,
      infoPlist: {
        NSCameraUsageDescription:
          'Cafe Social uses the camera to scan venue QR codes to unlock games and partner offers at that location.',
        NSPhotoLibraryUsageDescription:
          'Cafe Social can attach a receipt photo when a venue asks for purchase proof.',
        NSLocationWhenInUseUsageDescription:
          'Cafe Social uses your approximate location only to detect when you are inside a partner café’s geofence, so venue games, challenges, and (if you allow them in Settings) partner notifications can apply. Location is not used for continuous tracking in the background for advertising.',
        NSLocationAlwaysAndWhenInUseUsageDescription:
          'If you allow “Always”, Cafe Social can notify you when you are near a partner café with an active offer, and record approximate venue enter/exit for visit analytics — without continuous GPS tracking for unrelated ads.',
        UIBackgroundModes: ['location'],
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
        backgroundColor: '#FAF7F2',
      },
      edgeToEdgeEnabled: true,
      package: bundleIdentifier,
      permissions: [
        'ACCESS_COARSE_LOCATION',
        'ACCESS_FINE_LOCATION',
        'ACCESS_BACKGROUND_LOCATION',
        'CAMERA',
      ],
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
      'expo-localization',
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'Cafe Social uses your approximate location to detect when you are inside a partner café’s geofence, so venue games, challenges, and (if you allow them in Settings) partner notifications can apply.',
          locationAlwaysAndWhenInUsePermission:
            'If you allow “Always”, Cafe Social can notify you when you are near a partner café with an active offer, and record approximate venue enter/exit for visit analytics — without continuous GPS tracking for unrelated ads.',
          isIosBackgroundLocationEnabled: true,
          isAndroidBackgroundLocationEnabled: true,
        },
      ],
      [
        'expo-camera',
        {
          cameraPermission:
            'Allow Cafe Social to use the camera to scan venue QR codes for access.',
        },
      ],
      [
        'expo-notifications',
        {
          sounds: [],
        },
      ],
      'expo-screen-orientation',
      [
        'expo-image-picker',
        {
          photosPermission: 'Allow Cafe Social to choose a receipt image to send to the venue.',
        },
      ],
    ],
    extra: {
      eas: easProjectId ? { projectId: easProjectId } : {},
      receiptSubmissionsEnabled:
        process.env.EXPO_PUBLIC_RECEIPT_SUBMISSIONS_ENABLED === 'true' ||
        process.env.EXPO_PUBLIC_RECEIPT_SUBMISSIONS_ENABLED === '1',
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    updates: {
      checkAutomatically: 'ON_LOAD',
    },
  },
};
