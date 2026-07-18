import Constants from 'expo-constants';
import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, PACKAGE_TYPE, type PurchasesPackage } from 'react-native-purchases';
import {
  listPaywallPackagesOrdered,
  periodLabelKeyForPackage,
  pickPrimaryPaywallPackage,
  preferredPackageOrderFromEnv,
  type PaywallPackageKind,
  type PaywallPackageLike,
  type PreferredPackageOrder,
} from './revenuecatPaywallPolicy';

export type { PreferredPackageOrder };

const isExpoGo =
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
export function getPreferredPackageOrder(): PreferredPackageOrder {
  return preferredPackageOrderFromEnv(
    process.env.EXPO_PUBLIC_REVENUECAT_PREFERRED_PACKAGE as string | undefined,
  );
}

function packageKind(pkg: PurchasesPackage): PaywallPackageKind {
  switch (pkg.packageType) {
    case PACKAGE_TYPE.MONTHLY:
      return 'MONTHLY';
    case PACKAGE_TYPE.ANNUAL:
      return 'ANNUAL';
    default:
      return 'OTHER';
  }
}

function toPaywallLike(pkg: PurchasesPackage): PaywallPackageLike {
  return {
    identifier: pkg.identifier,
    kind: packageKind(pkg),
    priceString: pkg.product.priceString,
    subscriptionPeriod: (pkg.product as { subscriptionPeriod?: string | null }).subscriptionPeriod,
  };
}

export function pickPrimaryPackage(
  packages: PurchasesPackage[],
  order: PreferredPackageOrder = getPreferredPackageOrder(),
): PurchasesPackage | null {
  const primary = pickPrimaryPaywallPackage(packages.map(toPaywallLike), order);
  if (!primary) return null;
  return packages.find((p) => p.identifier === primary.identifier) ?? null;
}

/** Ordered packages for paywall buttons (preferred first, then the other period, then rest). */
export function listPaywallPackages(
  packages: PurchasesPackage[],
  order: PreferredPackageOrder = getPreferredPackageOrder(),
): PurchasesPackage[] {
  const ordered = listPaywallPackagesOrdered(packages.map(toPaywallLike), order);
  const byId = new Map(packages.map((p) => [p.identifier, p]));
  return ordered.map((o) => byId.get(o.identifier)).filter((p): p is PurchasesPackage => !!p);
}

export function packagePeriodLabelKey(pkg: PurchasesPackage): 'month' | 'year' | 'other' {
  return periodLabelKeyForPackage(toPaywallLike(pkg));
}
