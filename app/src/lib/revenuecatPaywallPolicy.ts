/** Pure paywall helpers (no RevenueCat / RN imports) for unit tests + Settings UI. */

export type PreferredPackageOrder = 'monthly_first' | 'annual_first';

export type PaywallPackageKind = 'MONTHLY' | 'ANNUAL' | 'OTHER';

export type PaywallPackageLike = {
  identifier: string;
  kind: PaywallPackageKind;
  priceString: string;
  subscriptionPeriod?: string | null;
};

export function preferredPackageOrderFromEnv(raw: string | undefined): PreferredPackageOrder {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === 'annual' || v === 'yearly' || v === 'year') return 'annual_first';
  return 'monthly_first';
}

export function pickPrimaryPaywallPackage(
  packages: PaywallPackageLike[],
  order: PreferredPackageOrder = 'monthly_first',
): PaywallPackageLike | null {
  if (packages.length === 0) return null;
  const monthly = packages.find((p) => p.kind === 'MONTHLY');
  const annual = packages.find((p) => p.kind === 'ANNUAL');
  if (order === 'annual_first') {
    if (annual) return annual;
    if (monthly) return monthly;
  } else {
    if (monthly) return monthly;
    if (annual) return annual;
  }
  return packages[0] ?? null;
}

export function listPaywallPackagesOrdered(
  packages: PaywallPackageLike[],
  order: PreferredPackageOrder = 'monthly_first',
): PaywallPackageLike[] {
  if (packages.length === 0) return [];
  const primary = pickPrimaryPaywallPackage(packages, order);
  if (!primary) return packages;
  const rest = packages.filter((p) => p.identifier !== primary.identifier);
  const monthly = rest.find((p) => p.kind === 'MONTHLY');
  const annual = rest.find((p) => p.kind === 'ANNUAL');
  const secondary = order === 'annual_first' ? monthly ?? annual : annual ?? monthly;
  const out: PaywallPackageLike[] = [primary];
  if (secondary) out.push(secondary);
  for (const p of rest) {
    if (out.some((x) => x.identifier === p.identifier)) continue;
    out.push(p);
  }
  return out;
}

export function periodLabelKeyForPackage(pkg: PaywallPackageLike): 'month' | 'year' | 'other' {
  if (pkg.kind === 'MONTHLY') return 'month';
  if (pkg.kind === 'ANNUAL') return 'year';
  const period = (pkg.subscriptionPeriod ?? '').toLowerCase();
  if (period.includes('year') || period.includes('p1y')) return 'year';
  if (period.includes('month') || period.includes('p1m')) return 'month';
  return 'other';
}
