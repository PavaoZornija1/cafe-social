import { createHash } from 'crypto';

/** Stable integer in [0, modulo) from a string seed. */
export function deterministicIndex(seed: string, modulo: number): number {
  if (modulo <= 0) return 0;
  const h = createHash('sha256').update(seed, 'utf8').digest();
  const n = h.readUInt32BE(0) % modulo;
  return n;
}
