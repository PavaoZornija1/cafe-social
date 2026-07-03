import Constants from 'expo-constants';

function truthy(raw: string | undefined): boolean {
  const v = raw?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/** Guest receipt photo → staff review. Off unless EXPO_PUBLIC_RECEIPT_SUBMISSIONS_ENABLED is set. */
export function isReceiptSubmissionsEnabled(): boolean {
  const extra = Constants.expoConfig?.extra?.receiptSubmissionsEnabled;
  if (typeof extra === 'boolean') return extra;
  if (typeof extra === 'string') return truthy(extra);
  return truthy(process.env.EXPO_PUBLIC_RECEIPT_SUBMISSIONS_ENABLED);
}
