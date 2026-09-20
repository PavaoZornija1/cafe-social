// EAS project id is a public identifier, not a secret — `eas init` normally writes
// it into app.json. It must be literal here: EAS CLI does not read .env when
// evaluating this config, and .env is gitignored so it never reaches a cloud build.
const easProjectId =
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID || '34bc0f30-19bd-4ae3-b14b-ae67a13f65f7';

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

// Sign in with Apple needs a paid Apple Developer team to provision the
// entitlement. Local device builds use the personal-team bundle id, which
// cannot, so enable it only for the store-bound profiles. Apple guideline 4.8
// requires it wherever third-party sign-in (Google) is offered.
const appleSignInEnabled =
  appEnv === 'production' || appEnv === 'preview' || appEnv === 'staging';

export default {
  expo: {
    name: 'Cafe Social',
    slug: 'cafe-social',
    version: '1.0.0',
    // Allow rotation so Brawler can lock landscape via expo-screen-orientation
    orientation: 'default',
    scheme: 'cafesocial',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    icon: './assets/brand/icon.png',
    ios: {
      supportsTablet: false,
      // Optional: set EXPO_APPLE_TEAM_ID=XXXXXXXXXX for `expo prebuild` / EAS; matches your Apple Developer team.
      ...(process.env.EXPO_APPLE_TEAM_ID && {
        appleTeamId: process.env.EXPO_APPLE_TEAM_ID,
      }),
      bundleIdentifier,
      usesAppleSignIn: appleSignInEnabled,
      infoPlist: {
        // Declares we use only exempt encryption (HTTPS). Without this, App Store
        // Connect asks the export-compliance question on every single submission.
        ITSAppUsesNonExemptEncryption: false,
        NSCameraUsageDescription:
          'Cafe Social uses the camera to scan venue QR codes to unlock games and partner offers at that location.',
        NSPhotoLibraryUsageDescription:
          'Cafe Social can attach a receipt photo when a venue asks for purchase proof.',
        NSLocationWhenInUseUsageDescription:
          'Cafe Social uses your approximate location only to detect when you are inside a partner café’s geofence, so venue games, challenges, and (if you allow them in Settings) partner notifications can apply. Location is not used for continuous tracking in the background for advertising.',
        NSLocationAlwaysAndWhenInUseUsageDescription:
          'If you allow “Always”, Cafe Social can notify you when you are near a partner café with an active offer, and record approximate venue enter/exit for visit analytics — without continuous GPS tracking for unrelated ads.',
        UIBackgroundModes: ['location'],
        // Setting CFBundleURLTypes makes Expo ignore the top-level `scheme`, so the
        // app's own deep links must be re-declared here or `cafesocial://` invites,
        // QR unlocks and notification taps stop resolving on iOS.
        ...(googleIosUrlScheme && {
          CFBundleURLTypes: [
            {
              CFBundleURLSchemes: ['cafesocial', bundleIdentifier],
              CFBundleURLName: 'App Scheme',
            },
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
        foregroundImage: './assets/brand/icon.png',
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
    plugins: [
      // Registered BEFORE @clerk/expo on purpose: Expo runs mods in reverse
      // registration order, so this executes after Clerk's and can strip the
      // Sign in with Apple entitlement Clerk adds unconditionally. A personal
      // Apple team cannot provision it, so dev builds would fail to sign.
      ...(appleSignInEnabled ? [] : ['./plugins/withAppleSignInGate']),
      '@clerk/expo',
      ...(appleSignInEnabled ? ['expo-apple-authentication'] : []),
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
      appleSignInEnabled,
      receiptSubmissionsEnabled:
        process.env.EXPO_PUBLIC_RECEIPT_SUBMISSIONS_ENABLED === 'true' ||
        process.env.EXPO_PUBLIC_RECEIPT_SUBMISSIONS_ENABLED === '1',
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    updates: {
      // EAS Update endpoint for this project. `eas update:configure` cannot write
      // a dynamic config, so it is set here. Pairs with the `channel` on each
      // eas.json build profile and the appVersion runtimeVersion policy above.
      url: 'https://u.expo.dev/34bc0f30-19bd-4ae3-b14b-ae67a13f65f7',
      checkAutomatically: 'ON_LOAD',
    },
  },
};
