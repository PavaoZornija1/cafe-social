import { isPayingPartnerOrg } from './partner-access.constants';

describe('isPayingPartnerOrg', () => {
  it.each(['ACTIVE', 'active', '  ACTIVE  '])('treats %j as paying', (status) => {
    expect(isPayingPartnerOrg(status)).toBe(true);
  });

  it.each(['TRIALING', 'ACTIVE_CANCELING', 'PAST_DUE'])('treats %s as paying', (status) => {
    expect(isPayingPartnerOrg(status)).toBe(true);
  });

  it('treats NONE and empty as not paying', () => {
    expect(isPayingPartnerOrg('NONE')).toBe(false);
    expect(isPayingPartnerOrg('')).toBe(false);
    expect(isPayingPartnerOrg('CANCELED')).toBe(false);
  });
});
