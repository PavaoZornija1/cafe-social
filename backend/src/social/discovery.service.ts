import {
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FriendshipStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionRepository } from '../venue/subscription.repository';
import { PushService } from '../push/push.service';
import {
  applyVenueNudgePlaceholders,
  VenueOrderNudgeCopyService,
} from '../venue/venue-order-nudge-copy.service';
import { utcDayKey } from '../lib/day-key';

const PRESENCE_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class DiscoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subs: SubscriptionRepository,
    private readonly config: ConfigService,
    private readonly push: PushService,
    private readonly venueOrderNudgeCopy: VenueOrderNudgeCopyService,
  ) {}

  /**
   * Updates “I’m at this venue” presence for social surfaces.
   *
   * **Venue order nudge (optional push):** Not tied to games or matches. The visit clock starts on the
   * **first** `venueId` we record for this physical stay (user detected at the venue and the app posts
   * presence — any screen, any activity). While they keep reporting the **same** `venueId`, we accumulate
   * **wall‑clock dwell** from that start; after `VENUE_ORDER_NUDGE_AFTER_MINUTES` we send **one** push per
   * visit. Leaving the geofence (`venueId: null`) or switching venue ends the visit and resets the clock
   * for the next arrival.
   *
   * Also records **PlayerVenueVisitDay** for engagement stats (one row per UTC day per venue).
   */
  async setPresence(playerId: string, venueId: string | null) {
    const now = new Date();

    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      select: {
        venueNudgeSessionVenueId: true,
        venueNudgeSessionStartedAt: true,
        venueNudgeLastSentAt: true,
        totalPrivacy: true,
        partnerMarketingPush: true,
      },
    });

    let sessionVenueId: string | null = venueId;
    let sessionStartedAt: Date | null = player?.venueNudgeSessionStartedAt ?? null;
    const lastSentAt: Date | null = player?.venueNudgeLastSentAt ?? null;

    if (!venueId) {
      sessionVenueId = null;
      sessionStartedAt = null;
    } else if (player?.venueNudgeSessionVenueId !== venueId) {
      sessionStartedAt = now;
    } else if (!sessionStartedAt) {
      sessionStartedAt = now;
    }

    await this.prisma.player.update({
      where: { id: playerId },
      data: {
        lastPresenceVenueId: venueId,
        lastPresenceAt: venueId ? now : null,
        venueNudgeSessionVenueId: sessionVenueId,
        venueNudgeSessionStartedAt: sessionStartedAt,
      },
    });

    if (venueId) {
      const dayKey = utcDayKey(now);
      await this.prisma.playerVenueVisitDay.upsert({
        where: {
          playerId_venueId_dayKey: { playerId, venueId, dayKey },
        },
        create: { playerId, venueId, dayKey },
        update: {},
      });
    }

    if (
      venueId &&
      sessionStartedAt &&
      !player?.totalPrivacy &&
      player?.partnerMarketingPush
    ) {
      void this.maybeSendVenueOrderNudge({
        playerId,
        venueId,
        sessionStartedAt,
        lastSentAt,
      });
    }
  }

  private async maybeSendVenueOrderNudge(params: {
    playerId: string;
    venueId: string;
    sessionStartedAt: Date;
    lastSentAt: Date | null;
  }) {
    const { playerId, venueId, sessionStartedAt, lastSentAt } = params;

    const enabled = this.config.get<string>('VENUE_ORDER_NUDGE_ENABLED')?.trim() !== 'false';
    if (!enabled) return;

    const globalDelayMin = Number(this.config.get<string>('VENUE_ORDER_NUDGE_AFTER_MINUTES') ?? 30);
    const globalDelay = Math.max(1, Number.isFinite(globalDelayMin) ? globalDelayMin : 30);
    const perVenueMin = await this.venueOrderNudgeCopy.getEffectiveAfterMinutes(venueId);
    const delayMin = perVenueMin != null && Number.isFinite(perVenueMin) && perVenueMin > 0 ? perVenueMin : globalDelay;
    const delayMs = delayMin * 60 * 1000;

    const now = new Date();
    if (now.getTime() - sessionStartedAt.getTime() < delayMs) return;
    if (lastSentAt && lastSentAt.getTime() >= sessionStartedAt.getTime()) return;

    const defaultTitle =
      this.config.get<string>('VENUE_ORDER_NUDGE_TITLE')?.trim() || 'Still here?';
    const defaultBody =
      this.config.get<string>('VENUE_ORDER_NUDGE_BODY')?.trim() ||
      'Thirsty? Treat yourself to something from the menu at {{venueName}}.';

    const resolved = await this.venueOrderNudgeCopy.resolveForPush(venueId, {
      title: defaultTitle,
      body: defaultBody,
    });
    if (!resolved) return;

    const title = applyVenueNudgePlaceholders(resolved.titleRaw, resolved.venueName);
    const body = applyVenueNudgePlaceholders(resolved.bodyRaw, resolved.venueName);

    const orderingUrl = resolved.orderingUrl;
    const menuUrl = resolved.menuUrl;

    await this.push.sendToPlayers(
      [playerId],
      undefined,
      {
        title,
        body,
        data: {
          type: 'venue_order_nudge',
          venueId,
          pushCategory: 'partner_marketing',
          orderingUrl,
          menuUrl,
        },
        sound: 'default',
      },
      { channel: 'partner_marketing' },
    );

    await this.prisma.player.update({
      where: { id: playerId },
      data: { venueNudgeLastSentAt: now },
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

  /**
   * Count of **accepted friends** who have at least one `PlayerVenueVisitDay` at `venueId`
   * with `dayKey >= sinceDayKey` (UTC `YYYY-MM-DD`). Privacy-safe aggregate for “friends have been here”.
   */
  async countFriendsWithVisitsSince(
    viewerId: string,
    venueId: string,
    sinceDayKey: string,
  ): Promise<number> {
    const friends = await this.friendIdsOf(viewerId);
    if (friends.size === 0) return 0;
    const grouped = await this.prisma.playerVenueVisitDay.groupBy({
      by: ['playerId'],
      where: {
        venueId,
        dayKey: { gte: sinceDayKey },
        playerId: { in: [...friends] },
      },
    });
    return grouped.length;
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
