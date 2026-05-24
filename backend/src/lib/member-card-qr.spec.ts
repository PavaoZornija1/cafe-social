import {
  buildMemberCardQrPayload,
  parseMemberTokenFromQr,
} from './member-card-qr';

describe('member-card-qr', () => {
  const token = 'abc123XYZ_token_sample_12';

  it('round-trips JSON payload', () => {
    const json = buildMemberCardQrPayload(token);
    expect(parseMemberTokenFromQr(json)).toBe(token);
  });

  it('parses deep link', () => {
    expect(parseMemberTokenFromQr(`loyaltysocial://member?t=${token}`)).toBe(token);
  });
});
