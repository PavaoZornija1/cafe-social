/** Host your real documents on the web and set these in `.env` for store / in-app links. */
export const PRIVACY_POLICY_URL =
  (process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL as string | undefined)?.trim() ?? '';

export const TERMS_OF_SERVICE_URL =
  (process.env.EXPO_PUBLIC_TERMS_OF_SERVICE_URL as string | undefined)?.trim() ?? '';
