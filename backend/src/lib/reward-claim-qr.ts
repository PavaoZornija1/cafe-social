import { staffVerificationCodeFromRedemptionId } from './redemption-staff-code';

/** JSON string for staff QR scanners (`reward_claim`). */
export function buildStaffRewardQrPayload(redemptionId: string): string {
  return JSON.stringify({
    kind: 'reward_claim',
    redemptionId,
    staffVerificationCode: staffVerificationCodeFromRedemptionId(redemptionId),
  });
}
