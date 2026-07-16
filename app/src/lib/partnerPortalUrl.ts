/**
 * Partner (admin) portal base URL for manager/owner deep links.
 * Prefer `EXPO_PUBLIC_PARTNER_PORTAL_URL`; otherwise derive from privacy-policy origin.
 */
export function getPartnerPortalBaseUrl(): string {
  const explicit = (process.env.EXPO_PUBLIC_PARTNER_PORTAL_URL as string | undefined)?.trim();
  if (explicit) return explicit.replace(/\/$/, '');

  const privacy = (process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL as string | undefined)?.trim();
  if (!privacy) return '';
  try {
    const url = new URL(privacy);
    return `${url.protocol}//${url.host}`;
  } catch {
    return '';
  }
}

export function getPartnerPortalUrl(path = '/owner'): string {
  const base = getPartnerPortalBaseUrl();
  if (!base) return '';
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}`;
}
