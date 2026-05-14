import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { utcDayKey } from '../lib/day-key';
import { VenueService } from './venue.service';
import { SubscriptionRepository } from './subscription.repository';
import type { BeginVenueActivePlayDto } from './dto/begin-venue-active-play.dto';
import type { ClaimVenuePlayBudgetIapDto } from './dto/claim-venue-play-budget-iap.dto';

const RC_SUBSCRIBERS_URL = 'https://api.revenuecat.com/v1/subscribers';

/** Do not credit more than this many seconds per tick (client clock skew / abuse). */
const MAX_TICK_SECONDS = 45;
const STALE_SESSION_MS = 15 * 60 * 1000;

type RcNonSubscriptionPurchase = {
  id?: string;
  purchase_date?: string;
};

type RcSubscriberPayload = {
  subscriber?: {
    non_subscriptions?: Record<string, RcNonSubscriptionPurchase[] | null>;
  };
};

@Injectable()
export class VenuePlayBudgetService {
  private readonly log = new Logger(VenuePlayBudgetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly venues: VenueService,
    private readonly subscriptions: SubscriptionRepository,
    private readonly config: ConfigService,
  ) {}

  private platformFreeAllowanceSeconds(): number {
    const raw = this.config.get<string>('VENUE_FREE_ACTIVE_PLAY_SECONDS')?.trim();
    const n = raw != null && raw !== '' ? Number(raw) : 30 * 60;
    return Math.max(60, Number.isFinite(n) ? Math.floor(n) : 30 * 60);
  }

  /** `productId:grantSeconds` pairs, comma-separated (e.g. `venue_play_30m:1800`). */
  private parseIapProductGrantSeconds(): Map<string, number> {
    const raw = this.config.get<string>('VENUE_PLAY_BUDGET_IAP_PRODUCTS')?.trim();
    const map = new Map<string, number>();
    if (!raw) return map;
    for (const part of raw.split(',')) {
      const seg = part.trim();
      if (!seg) continue;
      const colon = seg.indexOf(':');
      if (colon <= 0) continue;
      const pid = seg.slice(0, colon).trim();
      const sec = Number(seg.slice(colon + 1).trim());
      if (!pid || !Number.isFinite(sec) || sec <= 0) continue;
      map.set(pid, Math.floor(sec));
    }
    return map;
  }

  private async fetchRevenueCatSubscriber(playerId: string): Promise<RcSubscriberPayload | null> {
    const secret = this.config.get<string>('REVENUECAT_SECRET_API_KEY')?.trim();
    if (!secret) {
      this.log.warn('REVENUECAT_SECRET_API_KEY not set; cannot verify IAP grants');
      return null;
    }
    const url = `${RC_SUBSCRIBERS_URL}/${encodeURIComponent(playerId)}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(`RevenueCat REST ${res.status}: ${text.slice(0, 200)}`);
    }
    return (await res.json()) as RcSubscriberPayload;
  }

  private transactionExistsInRc(
    rc: RcSubscriberPayload,
    productId: string,
    storeTransactionId: string,
  ): boolean {
    const list = rc.subscriber?.non_subscriptions?.[productId];
    if (!Array.isArray(list)) return false;
    return list.some((p) => p?.id === storeTransactionId);
  }

  private totalAllowanceSeconds(row: { iapBonusSecondsRemaining: number }): number {
    return this.platformFreeAllowanceSeconds() + row.iapBonusSecondsRemaining;
  }

  private remainingSeconds(row: {
    consumedActiveSeconds: number;
    iapBonusSecondsRemaining: number;
  }): number {
    return Math.max(0, this.totalAllowanceSeconds(row) - row.consumedActiveSeconds);
  }

  async getMeVenueBudget(params: {
    playerId: string;
    venueId: string;
    latitude?: number;
    longitude?: number;
  }): Promise<{
    unlimited: boolean;
    venueId: string;
    dayKey: string;
    remainingActiveSeconds: number;
    consumedActiveSeconds: number;
    freeAllowanceSeconds: number;
    iapBonusSecondsRemaining: number;
    inGeofence: boolean | null;
  }> {
    const unlimited = await this.subscriptions.isActiveSubscriber(params.playerId);
    const dayKey = utcDayKey();
    if (unlimited) {
      return {
        unlimited: true,
        venueId: params.venueId,
        dayKey,
        remainingActiveSeconds: 0,
        consumedActiveSeconds: 0,
        freeAllowanceSeconds: this.platformFreeAllowanceSeconds(),
        iapBonusSecondsRemaining: 0,
        inGeofence: null,
      };
    }

    const row = await this.prisma.playerVenueActivePlayBudgetDay.upsert({
      where: {
        playerId_venueId_dayKey: {
          playerId: params.playerId,
          venueId: params.venueId,
          dayKey,
        },
      },
      create: {
        playerId: params.playerId,
        venueId: params.venueId,
        dayKey,
      },
      update: {},
    });

    let inGeofence: boolean | null = null;
    if (
      typeof params.latitude === 'number' &&
      typeof params.longitude === 'number' &&
      Number.isFinite(params.latitude) &&
      Number.isFinite(params.longitude)
    ) {
      const inside = await this.venues.findVenueAtCoordinatesIncludingLocked(
        params.latitude,
        params.longitude,
      );
      inGeofence = inside?.id === params.venueId && !inside.locked;
    }

    return {
      unlimited: false,
      venueId: params.venueId,
      dayKey,
      remainingActiveSeconds: this.remainingSeconds(row),
      consumedActiveSeconds: row.consumedActiveSeconds,
      freeAllowanceSeconds: this.platformFreeAllowanceSeconds(),
      iapBonusSecondsRemaining: row.iapBonusSecondsRemaining,
      inGeofence,
    };
  }

  /** No geofence check — for queue activation where coords are unavailable. */
  async assertHasRemainingVenuePlayBudget(playerId: string, venueId: string): Promise<void> {
    if (await this.subscriptions.isActiveSubscriber(playerId)) return;
    const dayKey = utcDayKey();
    const row = await this.prisma.playerVenueActivePlayBudgetDay.findUnique({
      where: {
        playerId_venueId_dayKey: { playerId, venueId, dayKey },
      },
    });
    const consumed = row?.consumedActiveSeconds ?? 0;
    const bonus = row?.iapBonusSecondsRemaining ?? 0;
    const allowance = this.platformFreeAllowanceSeconds() + bonus;
    if (consumed >= allowance) {
      throw new ForbiddenException(
        'Daily active play time at this venue is used up. Extend with an in-app purchase or try again tomorrow (UTC).',
      );
    }
  }

  async assertCanStartVenuePlayAtVenueWithCoords(
    playerId: string,
    venueId: string,
    latitude: number,
    longitude: number,
  ): Promise<void> {
    if (await this.subscriptions.isActiveSubscriber(playerId)) return;
    await this.venues.assertCoordinatesAllowedForGuestVenue(venueId, latitude, longitude);
    await this.assertHasRemainingVenuePlayBudget(playerId, venueId);
  }

  async beginActivePlaySession(
    playerId: string,
    dto: BeginVenueActivePlayDto,
  ): Promise<{ sessionId: string | null; skipped: boolean }> {
    if (await this.subscriptions.isActiveSubscriber(playerId)) {
      return { sessionId: null, skipped: true };
    }

    await this.venues.assertCoordinatesAllowedForGuestVenue(
      dto.venueId,
      dto.latitude,
      dto.longitude,
    );
    await this.assertHasRemainingVenuePlayBudget(playerId, dto.venueId);

    const now = new Date();
    const dayKey = utcDayKey(now);

    await this.prisma.playerVenueActivePlaySession.updateMany({
      where: {
        playerId,
        endedAt: null,
        lastTickAt: { lt: new Date(now.getTime() - STALE_SESSION_MS) },
      },
      data: { endedAt: now },
    });

    const row = await this.prisma.playerVenueActivePlaySession.create({
      data: {
        playerId,
        venueId: dto.venueId,
        dayKey,
        kind: dto.kind,
        gameSessionId: dto.gameSessionId ?? null,
        soloWordSessionId: dto.soloWordSessionId ?? null,
        lastTickAt: now,
      },
    });

    return { sessionId: row.id, skipped: false };
  }

  async tickActivePlaySession(
    playerId: string,
    sessionId: string,
    latitude: number,
    longitude: number,
  ): Promise<{ remainingActiveSeconds: number; creditedSeconds: number }> {
    if (await this.subscriptions.isActiveSubscriber(playerId)) {
      return { remainingActiveSeconds: 999999, creditedSeconds: 0 };
    }

    const session = await this.prisma.playerVenueActivePlaySession.findFirst({
      where: { id: sessionId, playerId, endedAt: null },
    });
    if (!session) throw new NotFoundException('active play session not found');

    await this.venues.assertCoordinatesAllowedForGuestVenue(
      session.venueId,
      latitude,
      longitude,
    );

    const now = new Date();
    const deltaMs = now.getTime() - session.lastTickAt.getTime();
    let deltaSec = Math.max(0, Math.floor(deltaMs / 1000));
    deltaSec = Math.min(deltaSec, MAX_TICK_SECONDS);

    if (deltaSec === 0) {
      const row = await this.ensureBudgetRow(playerId, session.venueId, session.dayKey);
      return {
        remainingActiveSeconds: this.remainingSeconds(row),
        creditedSeconds: 0,
      };
    }

    return await this.prisma.$transaction(async (tx) => {
      const s = await tx.playerVenueActivePlaySession.findFirst({
        where: { id: sessionId, playerId, endedAt: null },
      });
      if (!s) throw new NotFoundException('active play session not found');

      const budget = await tx.playerVenueActivePlayBudgetDay.upsert({
        where: {
          playerId_venueId_dayKey: {
            playerId,
            venueId: s.venueId,
            dayKey: s.dayKey,
          },
        },
        create: {
          playerId,
          venueId: s.venueId,
          dayKey: s.dayKey,
        },
        update: {},
      });

      const remainingBefore = this.remainingSeconds(budget);
      if (remainingBefore <= 0) {
        throw new ForbiddenException(
          'Daily active play time at this venue is used up. Extend with an in-app purchase or try again tomorrow (UTC).',
        );
      }

      const apply = Math.min(deltaSec, remainingBefore);
      const newConsumed = budget.consumedActiveSeconds + apply;

      await tx.playerVenueActivePlayBudgetDay.update({
        where: {
          playerId_venueId_dayKey: {
            playerId,
            venueId: s.venueId,
            dayKey: s.dayKey,
          },
        },
        data: { consumedActiveSeconds: newConsumed },
      });

      await tx.playerVenueActivePlaySession.update({
        where: { id: sessionId },
        data: { lastTickAt: now },
      });

      const remainingAfter = Math.max(0, this.totalAllowanceSeconds(budget) - newConsumed);

      if (apply < deltaSec && remainingAfter === 0) {
        // exhausted
      }

      return { remainingActiveSeconds: remainingAfter, creditedSeconds: apply };
    });
  }

  async endActivePlaySession(playerId: string, sessionId: string): Promise<void> {
    const now = new Date();
    await this.prisma.playerVenueActivePlaySession.updateMany({
      where: { id: sessionId, playerId, endedAt: null },
      data: { endedAt: now },
    });
  }

  private async ensureBudgetRow(playerId: string, venueId: string, dayKey: string) {
    return this.prisma.playerVenueActivePlayBudgetDay.upsert({
      where: { playerId_venueId_dayKey: { playerId, venueId, dayKey } },
      create: { playerId, venueId, dayKey },
      update: {},
    });
  }

  async claimIapGrant(playerId: string, dto: ClaimVenuePlayBudgetIapDto): Promise<{
    grantedSeconds: number;
    remainingActiveSeconds: number;
  }> {
    if (await this.subscriptions.isActiveSubscriber(playerId)) {
      throw new BadRequestException('Subscribers have unlimited venue play; purchase not needed.');
    }

    const productMap = this.parseIapProductGrantSeconds();
    const grantSeconds = productMap.get(dto.productId.trim());
    if (grantSeconds == null) {
      throw new BadRequestException('Unknown or disabled play-time product.');
    }

    await this.venues.assertCoordinatesAllowedForGuestVenue(
      dto.venueId,
      dto.latitude,
      dto.longitude,
    );

    const existing = await this.prisma.venuePlayBudgetIapGrant.findUnique({
      where: { storeTransactionId: dto.storeTransactionId.trim() },
    });
    if (existing) {
      if (existing.playerId !== playerId) {
        throw new ForbiddenException('This purchase is tied to another account.');
      }
      const row = await this.ensureBudgetRow(playerId, dto.venueId, existing.dayKey);
      return {
        grantedSeconds: existing.grantedSeconds,
        remainingActiveSeconds: this.remainingSeconds(row),
      };
    }

    const rc = await this.fetchRevenueCatSubscriber(playerId);
    if (!rc) {
      throw new BadRequestException('Server cannot verify purchases (RevenueCat not configured).');
    }
    if (!this.transactionExistsInRc(rc, dto.productId.trim(), dto.storeTransactionId.trim())) {
      throw new ForbiddenException(
        'Purchase not found for this player in RevenueCat. Wait for sync or use Restore purchases.',
      );
    }

    const dayKey = utcDayKey();

    const out = await this.prisma.$transaction(async (tx) => {
      await tx.venuePlayBudgetIapGrant.create({
        data: {
          playerId,
          venueId: dto.venueId,
          dayKey,
          productId: dto.productId.trim(),
          storeTransactionId: dto.storeTransactionId.trim(),
          grantedSeconds: grantSeconds,
        },
      });

      const row = await tx.playerVenueActivePlayBudgetDay.upsert({
        where: {
          playerId_venueId_dayKey: { playerId, venueId: dto.venueId, dayKey },
        },
        create: {
          playerId,
          venueId: dto.venueId,
          dayKey,
          iapBonusSecondsRemaining: grantSeconds,
        },
        update: {
          iapBonusSecondsRemaining: { increment: grantSeconds },
        },
      });

      return {
        grantedSeconds: grantSeconds,
        remainingActiveSeconds: this.remainingSeconds(row),
      };
    });

    return out;
  }
}
