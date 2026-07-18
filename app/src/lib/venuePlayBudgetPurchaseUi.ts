import { Alert } from 'react-native';
import { getVenuePlayBudgetIapCatalog } from './venuePlayBudgetCatalog';
import {
  claimPendingVenuePlayBudget,
  loadVenuePlayBudgetStoreProducts,
  purchaseAndClaimVenuePlayBudget,
} from './venuePlayBudgetIap';

export async function promptVenuePlayTimePurchaseDialog(opts: {
  t: (k: string, o?: Record<string, string | number>) => string;
  getToken: () => Promise<string | null>;
}): Promise<void> {
  const catalog = getVenuePlayBudgetIapCatalog();
  if (catalog.length === 0) {
    Alert.alert(opts.t('settings.venuePlayBudgetNoProductsTitle'), opts.t('settings.venuePlayBudgetNoProductsBody'));
    return;
  }

  let storeProducts: Awaited<ReturnType<typeof loadVenuePlayBudgetStoreProducts>> = [];
  try {
    storeProducts = await loadVenuePlayBudgetStoreProducts(catalog.map((c) => c.productId));
  } catch {
    /* price labels optional */
  }
  const byId = new Map(storeProducts.map((p) => [p.identifier, p]));

  const purchaseOne = async (productId: string) => {
    try {
      const res = await purchaseAndClaimVenuePlayBudget({ productId, getToken: opts.getToken });
      const m = Math.max(1, Math.round(res.grantedSeconds / 60));
      Alert.alert(
        opts.t('settings.venuePlayBudgetSuccessTitle'),
        opts.t('settings.venuePlayBudgetSuccessBody', {
          minutes: m,
          remaining: Math.max(0, Math.round(res.remainingActiveSeconds / 60)),
        }),
      );
    } catch (e) {
      const code = (e as Error).message;
      if (code === 'VENUE_PLAY_NEED_LOCATION') {
        Alert.alert(
          opts.t('settings.venuePlayBudgetNeedVenueTitle'),
          opts.t('settings.venuePlayBudgetNeedVenueBody'),
        );
        return;
      }
      if (code === 'VENUE_PLAY_PRODUCT_NOT_FOUND') {
        Alert.alert(opts.t('common.error'), opts.t('settings.venuePlayBudgetProductMissing'));
        return;
      }
      Alert.alert(
        opts.t('common.error'),
        (e as Error).message || opts.t('settings.venuePlayBudgetPurchaseError'),
        [
          {
            text: opts.t('settings.venuePlayBudgetClaimPending'),
            onPress: () => void claimPendingVenuePlayBudgetDialog(opts),
          },
          { text: opts.t('common.cancel'), style: 'cancel' },
        ],
      );
    }
  };

  Alert.alert(
    opts.t('settings.venuePlayBudgetPickTitle'),
    opts.t('settings.venuePlayBudgetPickBody'),
    [
      ...catalog.map((c) => ({
        text: `${Math.max(1, Math.round(c.grantSeconds / 60))} min — ${byId.get(c.productId)?.priceString ?? c.productId}`,
        onPress: () => void purchaseOne(c.productId),
      })),
      { text: opts.t('common.cancel'), style: 'cancel' as const },
    ],
  );
}

export async function claimPendingVenuePlayBudgetDialog(opts: {
  t: (k: string, o?: Record<string, string | number>) => string;
  getToken: () => Promise<string | null>;
}): Promise<void> {
  try {
    const res = await claimPendingVenuePlayBudget({ getToken: opts.getToken });
    const m = Math.max(1, Math.round(res.grantedSeconds / 60));
    if (res.alreadyClaimed) {
      Alert.alert(
        opts.t('settings.venuePlayBudgetAlreadyClaimedTitle'),
        opts.t('settings.venuePlayBudgetAlreadyClaimedBody', {
          remaining: Math.max(0, Math.round(res.remainingActiveSeconds / 60)),
        }),
      );
      return;
    }
    Alert.alert(
      opts.t('settings.venuePlayBudgetSuccessTitle'),
      opts.t('settings.venuePlayBudgetSuccessBody', {
        minutes: m,
        remaining: Math.max(0, Math.round(res.remainingActiveSeconds / 60)),
      }),
    );
  } catch (e) {
    const code = (e as Error).message;
    if (code === 'VENUE_PLAY_NEED_LOCATION') {
      Alert.alert(
        opts.t('settings.venuePlayBudgetNeedVenueTitle'),
        opts.t('settings.venuePlayBudgetNeedVenueBody'),
      );
      return;
    }
    if (code === 'VENUE_PLAY_NO_PRODUCTS') {
      Alert.alert(opts.t('settings.venuePlayBudgetNoProductsTitle'), opts.t('settings.venuePlayBudgetNoProductsBody'));
      return;
    }
    if (code === 'VENUE_PLAY_NOTHING_TO_CLAIM') {
      Alert.alert(
        opts.t('settings.venuePlayBudgetNothingToClaimTitle'),
        opts.t('settings.venuePlayBudgetNothingToClaimBody'),
      );
      return;
    }
    Alert.alert(opts.t('common.error'), (e as Error).message || opts.t('settings.venuePlayBudgetPurchaseError'));
  }
}
