import Purchases, { PURCHASE_TYPE, type CustomerInfo, type PurchasesStoreProduct } from 'react-native-purchases';
import { apiPost } from './api';
import { fetchDetectedVenue } from './venueDetectClient';

function pickLatestStoreTransaction(
  customerInfo: CustomerInfo,
  productId: string,
): { storeTransactionId: string } | null {
  const txs = customerInfo.nonSubscriptionTransactions.filter(
    (t) => t.productIdentifier === productId,
  );
  if (txs.length === 0) return null;
  txs.sort((a, b) => (a.purchaseDate < b.purchaseDate ? 1 : -1));
  const top = txs[0]!;
  const id = top.transactionIdentifier?.trim();
  if (!id) return null;
  return { storeTransactionId: id };
}

export type VenuePlayBudgetClaimResponse = {
  grantedSeconds: number;
  remainingActiveSeconds: number;
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

/** Preload store metadata for paywall labels (prices). */
export async function loadVenuePlayBudgetStoreProducts(
  productIds: string[],
): Promise<PurchasesStoreProduct[]> {
  if (productIds.length === 0) return [];
  return Purchases.getProducts(productIds, PURCHASE_TYPE.INAPP);
}
