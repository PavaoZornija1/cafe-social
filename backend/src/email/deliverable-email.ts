/**
 * Player rows often use synthetic `user_…@clerk.local` when the JWT has no email.
 * Never send Resend mail to those addresses.
 */
export function isDeliverableEmail(email: string | null | undefined): boolean {
  const e = email?.trim().toLowerCase() ?? '';
  if (!e.includes('@')) return false;
  if (e.endsWith('@clerk.local')) return false;
  if (e.endsWith('.local')) return false;
  return true;
}
