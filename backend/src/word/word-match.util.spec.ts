import { normalizeGuess } from './word-match.util';

describe('normalizeGuess', () => {
  it('lowercases and trims', () => {
    expect(normalizeGuess('  Hello  ')).toBe('hello');
  });

  it('strips diacritics', () => {
    expect(normalizeGuess('Café')).toBe('cafe');
    expect(normalizeGuess('šank')).toBe('sank');
  });

  it('collapses whitespace', () => {
    expect(normalizeGuess('ice   coffee')).toBe('ice coffee');
  });
});
