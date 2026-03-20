export function normalizeUserEmail(user: unknown): string | null {
  const u = user as Record<string, unknown> | null | undefined;
  const emailRaw =
    u?.email ?? (u?.claims as Record<string, unknown> | undefined)?.email ??
    (u?.claims as Record<string, unknown> | undefined)?.identifier;
  if (emailRaw && typeof emailRaw === 'string' && emailRaw.includes('@')) {
    return emailRaw;
  }
  const externalId =
    (u?.externalId as string | undefined) ??
    ((u?.claims as Record<string, unknown> | undefined)?.sub as string | undefined);
  if (externalId && typeof externalId === 'string') {
    return `${externalId}@clerk.local`;
  }
  return null;
}
