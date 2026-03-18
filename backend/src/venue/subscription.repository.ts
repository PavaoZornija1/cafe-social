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
}

