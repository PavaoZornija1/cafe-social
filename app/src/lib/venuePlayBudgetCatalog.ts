import Constants from 'expo-constants';

/**
 * Same format as backend `VENUE_PLAY_BUDGET_IAP_PRODUCTS`:
 * comma-separated `storeProductId:grantSeconds` (e.g. `cafe_venue_play_30m:1800`).
 */
export function getVenuePlayBudgetIapCatalog(): Array<{ productId: string; grantSeconds: number }> {
  const raw =
    (process.env.EXPO_PUBLIC_VENUE_PLAY_BUDGET_IAP_PRODUCTS as string | undefined)?.trim() ||
    (
      Constants.expoConfig?.extra as
        | { venuePlayBudgetIapProducts?: string }
        | undefined
    )?.venuePlayBudgetIapProducts?.trim() ||
    '';
  const out: Array<{ productId: string; grantSeconds: number }> = [];
  if (!raw) return out;
  for (const part of raw.split(',')) {
    const seg = part.trim();
    if (!seg) continue;
    const colon = seg.indexOf(':');
    if (colon <= 0) continue;
    const productId = seg.slice(0, colon).trim();
    const sec = Number(seg.slice(colon + 1).trim());
    if (!productId || !Number.isFinite(sec) || sec <= 0) continue;
    out.push({ productId, grantSeconds: Math.floor(sec) });
  }
  return out;
}

export function formatGrantMinutes(grantSeconds: number): number {
  return Math.max(1, Math.round(grantSeconds / 60));
}
