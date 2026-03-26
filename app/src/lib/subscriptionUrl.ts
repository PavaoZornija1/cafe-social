/** Optional marketing / checkout URL for subscriptions (Clerk Billing, Stripe portal, etc.). */
export const SUBSCRIPTION_MANAGE_URL =
  (process.env.EXPO_PUBLIC_SUBSCRIPTION_URL as string | undefined)?.trim() || '';
