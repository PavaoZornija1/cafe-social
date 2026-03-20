import { Injectable } from '@nestjs/common';
import type { Subscription } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubscriptionRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByPlayerId(playerId: string): Promise<Subscription | null> {
    return this.prisma.subscription.findUnique({
      where: { playerId },
    });
  }

  /** Active subscription with optional unexpired `expiresAt`. */
  async isActiveSubscriber(playerId: string): Promise<boolean> {
    const s = await this.findByPlayerId(playerId);
    if (!s?.active) return false;
    if (s.expiresAt != null && s.expiresAt < new Date()) return false;
    return true;
  }
}

