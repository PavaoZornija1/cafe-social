import { staffVerificationCodeFromRedemptionId } from './redemption-staff-code';

describe('staffVerificationCodeFromRedemptionId', () => {
  it('returns last 8 hex chars uppercase without dashes', () => {
    const id = 'aaaaaaaa-bbbb-cccc-dddd-1234567890ab';
    expect(staffVerificationCodeFromRedemptionId(id)).toBe('567890AB');
  });

  it('uses last 8 hex chars when id has no dashes', () => {
    expect(staffVerificationCodeFromRedemptionId('00112233445566778899aabb')).toBe('8899AABB');
  });
});
