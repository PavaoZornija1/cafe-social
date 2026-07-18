import Purchases, { PURCHASE_TYPE, type CustomerInfo, type PurchasesStoreProduct } from 'react-native-purchases';
import { apiPost } from './api';
import { fetchDetectedVenue } from './venueDetectClient';
import { getVenuePlayBudgetIapCatalog } from './venuePlayBudgetCatalog';

function listStoreTransactionsNewestFirst(
  customerInfo: CustomerInfo,
  productId: string,
): Array<{ storeTransactionId: string }> {
  const txs = customerInfo.nonSubscriptionTransactions.filter(
    (t) => t.productIdentifier === productId,
  );
  txs.sort((a, b) => (a.purchaseDate < b.purchaseDate ? 1 : -1));
  const out: Array<{ storeTransactionId: string }> = [];
  for (const t of txs) {
    const id = t.transactionIdentifier?.trim();
    if (id) out.push({ storeTransactionId: id });
  }
  return out;
}

function pickLatestStoreTransaction(
  customerInfo: CustomerInfo,
  productId: string,
): { storeTransactionId: string } | null {
  return listStoreTransactionsNewestFirst(customerInfo, productId)[0] ?? null;
}

export type VenuePlayBudgetClaimResponse = {
  grantedSeconds: number;
  remainingActiveSeconds: number;
  alreadyClaimed?: boolean;
};

/**
 * Purchases a non-subscription SKU via RevenueCat, then credits server time with
 * `POST /venue-play-budget/iap/claim` (requires GPS inside the venue geofence).
 */
export async function purchaseAndClaimVenuePlayBudget(params: {
  productId: string;
  getToken: () => Promise<string | null>;
}): Promise<VenuePlayBudgetClaimResponse> {
  const { venue, coords } = await fetchDetectedVenue({ locationAccuracy: 'high' });
  if (!venue?.id || !coords) {
    throw new Error('VENUE_PLAY_NEED_LOCATION');
  }

  const products: PurchasesStoreProduct[] = await Purchases.getProducts(
    [params.productId],
    PURCHASE_TYPE.INAPP,
  );
  const product = products.find((p) => p.identifier === params.productId);
  if (!product) {
    throw new Error('VENUE_PLAY_PRODUCT_NOT_FOUND');
  }

  const purchaseResult = await Purchases.purchaseStoreProduct(product);
  let tx = pickLatestStoreTransaction(purchaseResult.customerInfo, params.productId);
  if (!tx) {
    const synced = await Purchases.syncPurchasesForResult();
    tx = pickLatestStoreTransaction(synced.customerInfo, params.productId);
  }
  if (!tx) {
    throw new Error('VENUE_PLAY_NO_TRANSACTION_ID');
  }

  const token = await params.getToken();
  if (!token) {
    throw new Error('VENUE_PLAY_NOT_AUTHENTICATED');
  }

  return apiPost<VenuePlayBudgetClaimResponse>(
    '/venue-play-budget/iap/claim',
    {
      venueId: venue.id,
      productId: params.productId,
      storeTransactionId: tx.storeTransactionId,
      latitude: coords.lat,
      longitude: coords.lng,
    },
    token,
  );
}

/**
 * After a charge where server credit failed: sync RevenueCat and claim any
 * unclaimed catalog transactions while inside the venue geofence.
 */
export async function claimPendingVenuePlayBudget(params: {
  getToken: () => Promise<string | null>;
}): Promise<VenuePlayBudgetClaimResponse> {
  const catalog = getVenuePlayBudgetIapCatalog();
  if (catalog.length === 0) {
    throw new Error('VENUE_PLAY_NO_PRODUCTS');
  }

  const { venue, coords } = await fetchDetectedVenue({ locationAccuracy: 'high' });
  if (!venue?.id || !coords) {
    throw new Error('VENUE_PLAY_NEED_LOCATION');
  }

  const token = await params.getToken();
  if (!token) {
    throw new Error('VENUE_PLAY_NOT_AUTHENTICATED');
  }

  let customerInfo = (await Purchases.syncPurchasesForResult()).customerInfo;
  if (!customerInfo) {
    customerInfo = await Purchases.getCustomerInfo();
  }

  let lastAlreadyClaimed: VenuePlayBudgetClaimResponse | null = null;

  for (const item of catalog) {
    const txs = listStoreTransactionsNewestFirst(customerInfo, item.productId);
    for (const tx of txs) {
      const res = await apiPost<VenuePlayBudgetClaimResponse>(
        '/venue-play-budget/iap/claim',
        {
          venueId: venue.id,
          productId: item.productId,
          storeTransactionId: tx.storeTransactionId,
          latitude: coords.lat,
          longitude: coords.lng,
        },
        token,
      );
      if (!res.alreadyClaimed) {
        return res;
      }
      lastAlreadyClaimed = res;
    }
  }

  if (lastAlreadyClaimed) {
    return { ...lastAlreadyClaimed, alreadyClaimed: true };
  }
  throw new Error('VENUE_PLAY_NOTHING_TO_CLAIM');
}

/** Preload store metadata for paywall labels (prices). */
export async function loadVenuePlayBudgetStoreProducts(
  productIds: string[],
): Promise<PurchasesStoreProduct[]> {
  if (productIds.length === 0) return [];
  return Purchases.getProducts(productIds, PURCHASE_TYPE.INAPP);
}
