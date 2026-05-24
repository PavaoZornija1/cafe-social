import { randomBytes } from 'crypto';

/** URL-safe opaque token for member QR codes. */
export function generateMemberQrToken(): string {
  return randomBytes(24).toString('base64url');
}
