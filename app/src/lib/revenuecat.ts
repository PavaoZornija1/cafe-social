import Constants from 'expo-constants';
import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  PACKAGE_TYPE,
  type CustomerInfo,
  type PurchasesPackage,
} from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import {
  customerHasEntitlement,
  listPaywallPackagesOrdered,
  periodLabelKeyForPackage,
  pickPrimaryPaywallPackage,
  preferredPackageOrderFromEnv,
  type PaywallPackageKind,
  type PaywallPackageLike,
  type PreferredPackageOrder,
} from './revenuecatPaywallPolicy';

export type { PreferredPackageOrder };
export { PAYWALL_RESULT };

const isExpoGo =
  (Constants as any)?.executionEnvironment === 'storeClient' || Constants.appOwnership === 'expo';

const sharedKey =
  (process.env.EXPO_PUBLIC_REVENUECAT_API_KEY as string | undefined)?.trim() || '';

const iosKey =
  (process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY as string | undefined)?.trim() ||
  (Constants.expoConfig?.extra as { revenueCatIosApiKey?: string } | undefined)?.revenueCatIosApiKey ||
  '';

const androidKey =
  (process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY as string | undefined)?.trim() ||
  (Constants.expoConfig?.extra as { revenueCatAndroidApiKey?: string } | undefined)?.revenueCatAndroidApiKey ||
  '';

const iosTestKey = (process.env.EXPO_PUBLIC_REVENUECAT_TEST_IOS_API_KEY as string | undefined)?.trim() || '';
const androidTestKey =
  (process.env.EXPO_PUBLIC_REVENUECAT_TEST_ANDROID_API_KEY as string | undefined)?.trim() || '';

let configuredApiKey: string | null = null;

/** Must match the entitlement identifier in the RevenueCat dashboard. */
export const REVENUECAT_ENTITLEMENT_ID =
  (process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID as string | undefined)?.trim() ||
  'Cafe Social Pro';

function nativeApiKey(): string {
  if (sharedKey) return sharedKey;
  if (isExpoGo) {
    if (Platform.OS === 'ios') return iosTestKey;
    if (Platform.OS === 'android') return androidTestKey;
    return '';
  }
  if (Platform.OS === 'ios') return iosKey || iosTestKey;
  if (Platform.OS === 'android') return androidKey || androidTestKey;
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
    if (__DEV__) {
      console.warn(
        '[RevenueCat] Missing API key. Set EXPO_PUBLIC_REVENUECAT_API_KEY (Test Store) ' +
          'or platform keys EXPO_PUBLIC_REVENUECAT_IOS_API_KEY / ANDROID.',
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
    case PACKAGE_TYPE.LIFETIME:
      return 'LIFETIME';
    default: {
      const id = pkg.identifier.toLowerCase();
      if (id.includes('lifetime') || id === 'lifetime' || id.includes('$rc_lifetime')) {
        return 'LIFETIME';
      }
      if (id.includes('annual') || id.includes('yearly') || id === 'yearly') return 'ANNUAL';
      if (id.includes('month') || id === 'monthly') return 'MONTHLY';
      return 'OTHER';
    }
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

export function listPaywallPackages(
  packages: PurchasesPackage[],
  order: PreferredPackageOrder = getPreferredPackageOrder(),
): PurchasesPackage[] {
  const ordered = listPaywallPackagesOrdered(packages.map(toPaywallLike), order);
  const byId = new Map(packages.map((p) => [p.identifier, p]));
  return ordered.map((o) => byId.get(o.identifier)).filter((p): p is PurchasesPackage => !!p);
}

export function packagePeriodLabelKey(
  pkg: PurchasesPackage,
): 'month' | 'year' | 'lifetime' | 'other' {
  return periodLabelKeyForPackage(toPaywallLike(pkg));
}

export function hasCafeSocialPro(customerInfo: CustomerInfo): boolean {
  return customerHasEntitlement(
    Object.keys(customerInfo.entitlements.active),
    REVENUECAT_ENTITLEMENT_ID,
  );
}

export async function getRevenueCatCustomerInfo(): Promise<CustomerInfo> {
  return Purchases.getCustomerInfo();
}

export async function refreshCafeSocialProEntitlement(): Promise<boolean> {
  const info = await Purchases.getCustomerInfo();
  return hasCafeSocialPro(info);
}

/**
 * Present the dashboard-designed RevenueCat Paywall when Cafe Social Pro is inactive.
 * Returns true if the user purchased or restored access.
 */
export async function presentCafeSocialProPaywall(): Promise<boolean> {
  if (!isRevenueCatNativeConfigured()) return false;
  const result = await RevenueCatUI.presentPaywallIfNeeded({
    requiredEntitlementIdentifier: REVENUECAT_ENTITLEMENT_ID,
  });
  return result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED;
}

/** Customer Center for restore / cancel / manage (subscribers and past purchasers). */
export async function presentCafeSocialCustomerCenter(): Promise<void> {
  if (!isRevenueCatNativeConfigured()) return;
  await RevenueCatUI.presentCustomerCenter();
}
