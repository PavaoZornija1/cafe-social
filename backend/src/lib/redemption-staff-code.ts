/** Last 8 hex chars of UUID (no dashes), uppercase — shown to guest & staff list for quick match. */
export function staffVerificationCodeFromRedemptionId(redemptionId: string): string {
  const hex = redemptionId.replace(/-/g, '');
  return hex.slice(-8).toUpperCase();
}
