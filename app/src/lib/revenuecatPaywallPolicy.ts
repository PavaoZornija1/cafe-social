/** Pure paywall helpers (no RevenueCat / RN imports) for unit tests + Settings UI. */

export type PreferredPackageOrder = 'monthly_first' | 'annual_first' | 'lifetime_first';

export type PaywallPackageKind = 'MONTHLY' | 'ANNUAL' | 'LIFETIME' | 'OTHER';

export type PaywallPackageLike = {
  identifier: string;
  kind: PaywallPackageKind;
  priceString: string;
  subscriptionPeriod?: string | null;
};

export function preferredPackageOrderFromEnv(raw: string | undefined): PreferredPackageOrder {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === 'lifetime' || v === 'life') return 'lifetime_first';
  if (v === 'annual' || v === 'yearly' || v === 'year') return 'annual_first';
  return 'monthly_first';
}

function findByKind(
  packages: PaywallPackageLike[],
  kind: PaywallPackageKind,
): PaywallPackageLike | undefined {
  return packages.find((p) => p.kind === kind);
}

/** Preferred package order for Cafe Social Pro: monthly / yearly / lifetime. */
export function pickPrimaryPaywallPackage(
  packages: PaywallPackageLike[],
  order: PreferredPackageOrder = 'monthly_first',
): PaywallPackageLike | null {
  if (packages.length === 0) return null;
  const monthly = findByKind(packages, 'MONTHLY');
  const annual = findByKind(packages, 'ANNUAL');
  const lifetime = findByKind(packages, 'LIFETIME');
  if (order === 'lifetime_first') {
    return lifetime ?? annual ?? monthly ?? packages[0] ?? null;
  }
  if (order === 'annual_first') {
    return annual ?? monthly ?? lifetime ?? packages[0] ?? null;
  }
  return monthly ?? annual ?? lifetime ?? packages[0] ?? null;
}

export function listPaywallPackagesOrdered(
  packages: PaywallPackageLike[],
  order: PreferredPackageOrder = 'monthly_first',
): PaywallPackageLike[] {
  if (packages.length === 0) return [];
  const byKind: PaywallPackageKind[] =
    order === 'lifetime_first'
      ? ['LIFETIME', 'ANNUAL', 'MONTHLY']
      : order === 'annual_first'
        ? ['ANNUAL', 'MONTHLY', 'LIFETIME']
        : ['MONTHLY', 'ANNUAL', 'LIFETIME'];

  const out: PaywallPackageLike[] = [];
  for (const kind of byKind) {
    const hit = findByKind(packages, kind);
    if (hit) out.push(hit);
  }
  for (const p of packages) {
    if (out.some((x) => x.identifier === p.identifier)) continue;
    out.push(p);
  }
  return out;
}

export function periodLabelKeyForPackage(
  pkg: PaywallPackageLike,
): 'month' | 'year' | 'lifetime' | 'other' {
  if (pkg.kind === 'MONTHLY') return 'month';
  if (pkg.kind === 'ANNUAL') return 'year';
  if (pkg.kind === 'LIFETIME') return 'lifetime';
  const id = pkg.identifier.toLowerCase();
  if (id.includes('lifetime') || id.includes('life')) return 'lifetime';
  const period = (pkg.subscriptionPeriod ?? '').toLowerCase();
  if (period.includes('year') || period.includes('p1y')) return 'year';
  if (period.includes('month') || period.includes('p1m')) return 'month';
  return 'other';
}

export function customerHasEntitlement(
  activeEntitlementIds: readonly string[],
  entitlementId: string,
): boolean {
  const want = entitlementId.trim();
  if (!want) return false;
  return activeEntitlementIds.some((id) => id === want);
}
