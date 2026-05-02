import { normalizeUserEmail } from './user-email.util';

describe('normalizeUserEmail', () => {
  it('reads email from user.email', () => {
    expect(normalizeUserEmail({ email: 'a@b.com' })).toBe('a@b.com');
  });

  it('reads email from claims.email', () => {
    expect(normalizeUserEmail({ claims: { email: 'c@d.org' } })).toBe('c@d.org');
  });

  it('reads identifier from claims when it looks like email', () => {
    expect(normalizeUserEmail({ claims: { identifier: 'e@f.io' } })).toBe('e@f.io');
  });

  it('builds clerk.local address from externalId', () => {
    expect(normalizeUserEmail({ externalId: 'user_abc' })).toBe('user_abc@clerk.local');
  });

  it('builds from claims.sub when no @ in prior fields', () => {
    expect(normalizeUserEmail({ claims: { sub: 'sub_xyz' } })).toBe('sub_xyz@clerk.local');
  });

  it('returns null when nothing usable', () => {
    expect(normalizeUserEmail(undefined)).toBeNull();
    expect(normalizeUserEmail(null)).toBeNull();
    expect(normalizeUserEmail({})).toBeNull();
    expect(normalizeUserEmail({ email: 'not-an-email' })).toBeNull();
  });
});
