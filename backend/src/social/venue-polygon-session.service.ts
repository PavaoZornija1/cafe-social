import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { utcDayKey } from '../lib/day-key';
import { VenueFunnelService } from '../venue/venue-funnel.service';
import { loadVenueAttributionConfig } from './venue-attribution.config';
import { StripePartnerPpvBillingService } from '../stripe/stripe-partner-ppv-billing.service';

@Injectable()
export class VenuePolygonSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly funnel: VenueFunnelService,
    private readonly ppvBilling: StripePartnerPpvBillingService,
  ) {}

  /**
   * Called when polygon presence changes (client-detected play geofence only).
   * Opens/closes {@link PlayerVenuePolygonSession} rows and evaluates attribution on exit.
   */
  async onPolygonPresenceChange(
    playerId: string,
    previousVenueId: string | null,
    nextVenueId: string | null,
  ): Promise<void> {
    const now = new Date();

    if (previousVenueId && previousVenueId !== nextVenueId) {
      await this.closeOpenSession(playerId, previousVenueId, now);
    }

    if (nextVenueId && nextVenueId !== previousVenueId) {
      await this.openSession(playerId, nextVenueId, now);
    }
  }

  private async openSession(
    playerId: string,
    venueId: string,
    enteredAt: Date,
  ): Promise<void> {
    const open = await this.prisma.playerVenuePolygonSession.findFirst({
      where: { playerId, venueId, exitedAt: null },
      select: { id: true },
    });
    if (open) return;

    const dayKey = utcDayKey(enteredAt);
    await this.prisma.playerVenuePolygonSession.create({
      data: { playerId, venueId, dayKey, enteredAt },
    });
    this.funnel.safeLog({
      venueId,
      playerId,
      kind: 'polygon_enter',
    });
  }

  private async closeOpenSession(
    playerId: string,
    venueId: string,
    exitedAt: Date,
  ): Promise<void> {
    const session = await this.prisma.playerVenuePolygonSession.findFirst({
      where: { playerId, venueId, exitedAt: null },
      orderBy: { enteredAt: 'desc' },
    });
    if (!session) return;

    const dwellSeconds = Math.max(
      0,
      Math.floor((exitedAt.getTime() - session.enteredAt.getTime()) / 1000),
    );
    const cfg = loadVenueAttributionConfig(this.config);
    const minDwellSeconds = cfg.minDwellMinutes * 60;
    const dwellQualified = dwellSeconds >= minDwellSeconds;

    const nudge = await this.findAttributableNudge({
      playerId,
      venueId,
      enteredAt: session.enteredAt,
      enterWindowMinutes: cfg.enterWindowMinutes,
    });
    const attributionMet = nudge != null;

    let billableAt: Date | null = null;
    let nudgeLogId: string | null = null;
    if (attributionMet && dwellQualified && nudge) {
      billableAt = exitedAt;
      nudgeLogId = nudge.id;
    }

    await this.prisma.playerVenuePolygonSession.update({
      where: { id: session.id },
      data: {
        exitedAt,
        dwellSeconds,
        dwellQualified,
        attributionMet,
        billableAt,
        nudgeLogId,
      },
    });

    this.funnel.safeLog({ venueId, playerId, kind: 'polygon_exit' });
    if (dwellQualified) {
      this.funnel.safeLog({ venueId, playerId, kind: 'polygon_dwell_qualified' });
    }
    if (attributionMet && dwellQualified) {
      this.funnel.safeLog({ venueId, playerId, kind: 'attributed_visit' });
      this.funnel.safeLog({ venueId, playerId, kind: 'billable_visit' });
      void this.ppvBilling.reportBillableVisit(session.id);
    }
  }

  /** Most recent unattributed nudge within the enter window before polygon entry. */
  private async findAttributableNudge(params: {
    playerId: string;
    venueId: string;
    enteredAt: Date;
    enterWindowMinutes: number;
  }) {
    const windowMs = params.enterWindowMinutes * 60 * 1000;
    const earliest = new Date(params.enteredAt.getTime() - windowMs);

    return this.prisma.proximityArrivalPushLog.findFirst({
      where: {
        playerId: params.playerId,
        venueId: params.venueId,
        sentAt: { gte: earliest, lte: params.enteredAt },
        attributedSession: null,
      },
      orderBy: { sentAt: 'desc' },
      select: { id: true },
    });
  }

  /** True when player has an open polygon session at this venue. */
  async hasOpenSession(playerId: string, venueId: string): Promise<boolean> {
    const row = await this.prisma.playerVenuePolygonSession.findFirst({
      where: { playerId, venueId, exitedAt: null },
      select: { id: true },
    });
    return row != null;
  }

  /** Last polygon exit at this venue (for nudge cooldown after leaving). */
  async lastPolygonExitAt(
    playerId: string,
    venueId: string,
  ): Promise<Date | null> {
    const row = await this.prisma.playerVenuePolygonSession.findFirst({
      where: { playerId, venueId, exitedAt: { not: null } },
      orderBy: { exitedAt: 'desc' },
      select: { exitedAt: true },
    });
    return row?.exitedAt ?? null;
  }
}
