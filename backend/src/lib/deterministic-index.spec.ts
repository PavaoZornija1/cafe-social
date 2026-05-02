import { deterministicIndex } from './deterministic-index';

describe('deterministicIndex', () => {
  it('returns 0 when modulo <= 0', () => {
    expect(deterministicIndex('a', 0)).toBe(0);
    expect(deterministicIndex('a', -1)).toBe(0);
  });

  it('returns value in [0, modulo) for positive modulo', () => {
    const m = 100;
    const v = deterministicIndex('seed-1', m);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(m);
  });

  it('is stable for the same seed and modulo', () => {
    expect(deterministicIndex('same', 17)).toBe(deterministicIndex('same', 17));
  });

  it('differs for different seeds (almost always)', () => {
    const a = deterministicIndex('alpha', 1000);
    const b = deterministicIndex('beta', 1000);
    expect(a).not.toBe(b);
  });
});
