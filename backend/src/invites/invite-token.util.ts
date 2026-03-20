import { createHash, randomBytes } from 'crypto';

export function newInviteToken(): string {
  return randomBytes(24).toString('base64url');
}

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
