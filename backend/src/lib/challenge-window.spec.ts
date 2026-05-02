import { isChallengeActiveWindow } from './challenge-window';

describe('isChallengeActiveWindow', () => {
  const noon = new Date('2026-06-15T12:00:00.000Z');

  it('returns true when both bounds are null', () => {
    expect(isChallengeActiveWindow(null, null, noon)).toBe(true);
  });

  it('returns false before activeFrom', () => {
    const from = new Date('2026-06-16T00:00:00.000Z');
    expect(isChallengeActiveWindow(from, null, noon)).toBe(false);
  });

  it('returns false after activeTo', () => {
    const to = new Date('2026-06-14T00:00:00.000Z');
    expect(isChallengeActiveWindow(null, to, noon)).toBe(false);
  });

  it('returns true when now is inside [from, to]', () => {
    const from = new Date('2026-06-15T00:00:00.000Z');
    const to = new Date('2026-06-15T23:59:59.000Z');
    expect(isChallengeActiveWindow(from, to, noon)).toBe(true);
  });
});
