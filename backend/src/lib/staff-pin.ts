import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'crypto';

const ITERATIONS = 120_000;
const KEYLEN = 32;
const DIGEST = 'sha256';

/** Format: pbkdf2$<saltHex>$<iterations>$<hashHex> */
export function hashStaffPortalPin(plainPin: string): string {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(
    plainPin,
    salt,
    ITERATIONS,
    KEYLEN,
    DIGEST,
  );
  return `pbkdf2$${salt.toString('hex')}$${ITERATIONS}$${hash.toString('hex')}`;
}

export function verifyStaffPortalPin(plainPin: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const [, saltHex, iterRaw, expectedHex] = parts;
  const iterations = Number.parseInt(iterRaw, 10);
  if (!Number.isFinite(iterations) || iterations < 1) return false;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex, 'hex');
    expected = Buffer.from(expectedHex, 'hex');
  } catch {
    return false;
  }
  const actual = pbkdf2Sync(plainPin, salt, iterations, expected.length, DIGEST);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
