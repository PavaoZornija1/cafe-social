import { buildStaffRewardQrPayload } from './reward-claim-qr';

describe('buildStaffRewardQrPayload', () => {
  it('serializes reward_claim JSON with verification code', () => {
    const id = 'aaaaaaaa-bbbb-cccc-dddd-1234567890ab';
    const raw = buildStaffRewardQrPayload(id);
    expect(JSON.parse(raw)).toEqual({
      kind: 'reward_claim',
      redemptionId: id,
      staffVerificationCode: '567890AB',
    });
  });
});
