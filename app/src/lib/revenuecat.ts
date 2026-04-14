import Constants from 'expo-constants';
import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, PACKAGE_TYPE, type PurchasesPackage } from 'react-native-purchases';

const isExpoGo =
  // `executionEnvironment === "storeClient"` is Expo Go. `appOwnership === "expo"` covers older SDKs.
  (Constants as any)?.executionEnvironment === 'storeClient' || Constants.appOwnership === 'expo';

const iosKey =
  (process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY as string | undefined)?.trim() ||
  (Constants.expoConfig?.extra as { revenueCatIosApiKey?: string } | undefined)?.revenueCatIosApiKey ||
  '';

const androidKey =
  (process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY as string | undefined)?.trim() ||
  (Constants.expoConfig?.extra as { revenueCatAndroidApiKey?: string } | undefined)?.revenueCatAndroidApiKey ||
  '';

/**
 * RevenueCat "Test Store" keys work in Expo Go; native store keys do not.
 * If these are unset and we're in Expo Go, we intentionally no-op purchases.
 */
const iosTestKey = (process.env.EXPO_PUBLIC_REVENUECAT_TEST_IOS_API_KEY as string | undefined)?.trim() || '';
const androidTestKey =
  (process.env.EXPO_PUBLIC_REVENUECAT_TEST_ANDROID_API_KEY as string | undefined)?.trim() || '';

let configuredApiKey: string | null = null;

export const REVENUECAT_ENTITLEMENT_ID =
  (process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID as string | undefined)?.trim() || 'premium';

function nativeApiKey(): string {
  if (isExpoGo) {
    if (Platform.OS === 'ios') return iosTestKey;
    if (Platform.OS === 'android') return androidTestKey;
    return '';
  }
  if (Platform.OS === 'ios') return iosKey;
  if (Platform.OS === 'android') return androidKey;
  return '';
}

export function isRevenueCatNativeConfigured(): boolean {
  if (Platform.OS === 'web') return false;
  return nativeApiKey().length > 0;
}

export async function signOutRevenueCat(): Promise<void> {
  if (!isRevenueCatNativeConfigured()) return;
  try {
    await Purchases.logOut();
  } catch {
    // Anonymous / already logged out
  }
}

/**
 * Configure Purchases once per API key, then bind the RC customer to our `Player.id`
 * so webhooks and the REST API use the same id.
 */
export async function ensureRevenueCatForPlayer(playerId: string): Promise<void> {
  const key = nativeApiKey();
  if (!key) {
    if (__DEV__ && isExpoGo) {
      console.warn(
        '[RevenueCat] Skipping configuration in Expo Go (missing Test Store API key). ' +
          'Set EXPO_PUBLIC_REVENUECAT_TEST_IOS_API_KEY / EXPO_PUBLIC_REVENUECAT_TEST_ANDROID_API_KEY.',
      );
    }
    return;
  }

  try {
    if (configuredApiKey !== key) {
      if (__DEV__) {
        Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      }
      Purchases.configure({ apiKey: key });
      configuredApiKey = key;
    }

    await Purchases.logIn(playerId);
  } catch (e) {
    if (__DEV__) {
      console.warn('[RevenueCat] ensureRevenueCatForPlayer failed (dev only)', e);
      return;
    }
    throw e;
  }
}

/** Set `EXPO_PUBLIC_REVENUECAT_PREFERRED_PACKAGE` to `annual` or `yearly` to prefer annual; default monthly-first. */
export type PreferredPackageOrder = 'monthly_first' | 'annual_first';

export function getPreferredPackageOrder(): PreferredPackageOrder {
  const raw =
    (process.env.EXPO_PUBLIC_REVENUECAT_PREFERRED_PACKAGE as string | undefined)?.trim().toLowerCase() ?? '';
  if (raw === 'annual' || raw === 'yearly' || raw === 'year') return 'annual_first';
  return 'monthly_first';
}

export function pickPrimaryPackage(
  packages: PurchasesPackage[],
  order: PreferredPackageOrder = getPreferredPackageOrder(),
): PurchasesPackage | null {
  if (packages.length === 0) return null;
  const monthly = packages.find((p) => p.packageType === PACKAGE_TYPE.MONTHLY);
  const annual = packages.find((p) => p.packageType === PACKAGE_TYPE.ANNUAL);
  if (order === 'annual_first') {
    if (annual) return annual;
    if (monthly) return monthly;
  } else {
    if (monthly) return monthly;
    if (annual) return annual;
  }
  return packages[0] ?? null;
}
