import { createHash, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const TOKEN_PREFIX = 'bg_';
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type BackgroundTokenPlayer = {
  id: string;
  email: string;
};

/**
 * Opaque long-lived tokens for background geofence POSTs (app killed / no Clerk refresh).
 * Clerk session JWTs expire in minutes; OS geofence events may fire hours later.
 */
@Injectable()
export class BackgroundTokenService {
  constructor(private readonly prisma: PrismaService) {}

  async issueForPlayer(playerId: string): Promise<{ token: string; expiresAt: string }> {
    const token = `${TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
    const expiresAt = new Date(Date.now() + DEFAULT_TTL_MS);
    await this.prisma.player.update({
      where: { id: playerId },
      data: {
        backgroundTokenHash: this.hash(token),
        backgroundTokenExpiresAt: expiresAt,
      },
    });
    return { token, expiresAt: expiresAt.toISOString() };
  }

  async revokeForPlayer(playerId: string): Promise<void> {
    await this.prisma.player.update({
      where: { id: playerId },
      data: {
        backgroundTokenHash: null,
        backgroundTokenExpiresAt: null,
      },
    });
  }

  async resolvePlayer(token: string): Promise<BackgroundTokenPlayer | null> {
    const raw = token.trim();
    if (!raw.startsWith(TOKEN_PREFIX)) return null;
    const row = await this.prisma.player.findUnique({
      where: { backgroundTokenHash: this.hash(raw) },
      select: {
        id: true,
        email: true,
        backgroundTokenExpiresAt: true,
      },
    });
    if (!row?.backgroundTokenExpiresAt) return null;
    if (row.backgroundTokenExpiresAt.getTime() <= Date.now()) return null;
    return { id: row.id, email: row.email };
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
