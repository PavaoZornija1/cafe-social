import {
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { FriendshipStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionRepository } from '../venue/subscription.repository';

const PRESENCE_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class DiscoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subs: SubscriptionRepository,
  ) {}

  async setPresence(playerId: string, venueId: string | null) {
    await this.prisma.player.update({
      where: { id: playerId },
      data: {
        lastPresenceVenueId: venueId,
        lastPresenceAt: venueId ? new Date() : null,
      },
    });
  }

  private async friendIdsOf(playerId: string): Promise<Set<string>> {
    const rows = await this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [{ playerLowId: playerId }, { playerHighId: playerId }],
      },
    });
    const ids = new Set<string>();
    for (const r of rows) {
      ids.add(r.playerLowId === playerId ? r.playerHighId : r.playerLowId);
    }
    return ids;
  }

  /** Strangers + friends at venue per discoverability rules. */
  async peopleHere(viewerId: string, venueId: string) {
    const since = new Date(Date.now() - PRESENCE_TTL_MS);
    const candidates = await this.prisma.player.findMany({
      where: {
        id: { not: viewerId },
        lastPresenceVenueId: venueId,
        lastPresenceAt: { gte: since },
        totalPrivacy: false,
      },
      select: { id: true, username: true, discoverable: true },
    });

    const friends = await this.friendIdsOf(viewerId);
    return candidates
      .filter((c) => {
        if (friends.has(c.id)) return true;
        return c.discoverable;
      })
      .map((c) => ({
        id: c.id,
        username: c.username,
        relationship: friends.has(c.id) ? ('friend' as const) : ('stranger' as const),
        profileLevel: friends.has(c.id) ? ('stub' as const) : ('public' as const),
      }));
  }

  /** Subscribers who are discoverable; viewer must be subscriber too. Remote / at-home layer. */
  async listSubscriberDiscoverable(viewerId: string) {
    const viewerSub = await this.subs.isActiveSubscriber(viewerId);
    if (!viewerSub) {
      throw new ForbiddenException('Subscription required');
    }
    const now = new Date();
    return this.prisma.player.findMany({
      where: {
        id: { not: viewerId },
        discoverable: true,
        totalPrivacy: false,
        subscriptions: {
          some: {
            active: true,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
        },
      },
      select: {
        id: true,
        username: true,
      },
      take: 100,
      orderBy: { username: 'asc' },
    });
  }
}
