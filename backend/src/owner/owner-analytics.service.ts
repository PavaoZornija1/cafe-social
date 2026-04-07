import { Injectable } from '@nestjs/common';
import { VenueFeedEventKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { hourInTimeZone } from '../lib/hour-in-timezone';
import { staffVerificationCodeFromRedemptionId } from '../lib/redemption-staff-code';
import { resolveAnalyticsPeriod } from './analytics-period.util';

function utcDayKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function csvEscape(s: string): string {
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Repeat visits: players with 2+ distinct calendar days at the same venue. */
function loyaltyMetricsSingleVenue(visitRows: { dayKey: string; playerId: string }[]) {
  const daysByPlayer = new Map<string, Set<string>>();
  for (const v of visitRows) {
    if (!daysByPlayer.has(v.playerId)) daysByPlayer.set(v.playerId, new Set());
    daysByPlayer.get(v.playerId)!.add(v.dayKey);
  }
  let repeatVisitPlayers = 0;
  for (const days of daysByPlayer.values()) {
    if (days.size >= 2) repeatVisitPlayers += 1;
  }
  const uniquePlayers = daysByPlayer.size;
  const avgVisitDaysPerPlayer =
    uniquePlayers === 0
      ? 0
      : Math.round((visitRows.length / uniquePlayers) * 10) / 10;
  const shareRepeatVisitorsPercent =
    uniquePlayers === 0
      ? 0
      : Math.round((repeatVisitPlayers / uniquePlayers) * 1000) / 10;
  return {
    repeatVisitPlayers,
    avgVisitDaysPerPlayer,
    shareRepeatVisitorsPercent,
  };
}

/** Org roll-up: a player counts if they have 2+ visit days at any one venue in the set. */
function loyaltyMetricsOrg(
  visitRows: { dayKey: string; playerId: string; venueId: string }[],
) {
  const byVenuePlayer = new Map<string, Set<string>>();
  for (const v of visitRows) {
    const k = `${v.venueId}\t${v.playerId}`;
    if (!byVenuePlayer.has(k)) byVenuePlayer.set(k, new Set());
    byVenuePlayer.get(k)!.add(v.dayKey);
  }
  const repeatPlayers = new Set<string>();
  for (const [key, days] of byVenuePlayer) {
    if (days.size >= 2) repeatPlayers.add(key.split('\t')[1]!);
  }
  const uniquePlayers = new Set(visitRows.map((r) => r.playerId)).size;
  const avgVisitDaysPerPlayer =
    uniquePlayers === 0
      ? 0
      : Math.round((visitRows.length / uniquePlayers) * 10) / 10;
  const shareRepeatVisitorsPercent =
    uniquePlayers === 0
      ? 0
      : Math.round((repeatPlayers.size / uniquePlayers) * 1000) / 10;
  return {
    repeatVisitPlayers: repeatPlayers.size,
    avgVisitDaysPerPlayer,
    shareRepeatVisitorsPercent,
  };
}

export type AnalyticsQueryOpts = {
  days?: number;
  from?: string;
  to?: string;
};

@Injectable()
export class OwnerAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private async funnelMetrics(venueIds: string[], start: Date, end: Date) {
    if (venueIds.length === 0) {
      return {
        detectImpressions: 0,
        uniqueEntered: 0,
        uniquePlayed: 0,
        uniqueRedeemed: 0,
        enterToPlayPercent: 0,
        playToRedeemPercent: 0,
        enteredToRedeemPercent: 0,
      };
    }
    const rows = await this.prisma.venueFunnelEvent.findMany({
      where: {
        venueId: { in: venueIds },
        createdAt: { gte: start, lte: end },
      },
      select: { playerId: true, kind: true },
    });
    const detectImpressions = rows.filter((r) => r.kind === 'detect').length;
    const enterIds = new Set(
      rows.filter((r) => r.kind === 'enter' && r.playerId).map((r) => r.playerId!),
    );
    const playIds = new Set(
      rows.filter((r) => r.kind === 'play' && r.playerId).map((r) => r.playerId!),
    );
    const redeemIds = new Set(
      rows.filter((r) => r.kind === 'redeem' && r.playerId).map((r) => r.playerId!),
    );
    const uniqueEntered = enterIds.size;
    const uniquePlayed = playIds.size;
    const uniqueRedeemed = redeemIds.size;
    const enterToPlayPercent =
      uniqueEntered === 0
        ? 0
        : Math.round((uniquePlayed / uniqueEntered) * 1000) / 10;
    const playToRedeemPercent =
      uniquePlayed === 0
        ? 0
        : Math.round((uniqueRedeemed / uniquePlayed) * 1000) / 10;
    const enteredToRedeemPercent =
      uniqueEntered === 0
        ? 0
        : Math.round((uniqueRedeemed / uniqueEntered) * 1000) / 10;
    return {
      detectImpressions,
      uniqueEntered,
      uniquePlayed,
      uniqueRedeemed,
      enterToPlayPercent,
      playToRedeemPercent,
      enteredToRedeemPercent,
    };
  }

  async getVenueSummary(venueId: string, opts: AnalyticsQueryOpts) {
    const { start, end, startDay, endDay } = resolveAnalyticsPeriod(
      opts.days,
      opts.from,
      opts.to,
    );

    const venue = await this.prisma.venue.findUnique({
      where: { id: venueId },
      select: { analyticsTimeZone: true },
    });
    const tz = venue?.analyticsTimeZone?.trim() || null;

    const [
      redemptionsAll,
      visitRows,
      feedEvents,
      voidedCountRow,
      perkGroups,
    ] = await Promise.all([
      this.prisma.venuePerkRedemption.findMany({
        where: {
          venueId,
          redeemedAt: { gte: start, lte: end },
        },
        select: {
          redeemedAt: true,
          playerId: true,
          voidedAt: true,
          perkId: true,
          perk: { select: { title: true, code: true } },
        },
      }),
      this.prisma.playerVenueVisitDay.findMany({
        where: {
          venueId,
          dayKey: { gte: startDay, lte: endDay },
        },
        select: { dayKey: true, playerId: true },
      }),
      this.prisma.venueFeedEvent.findMany({
        where: {
          venueId,
          createdAt: { gte: start, lte: end },
        },
        select: { kind: true, createdAt: true },
      }),
      this.prisma.venuePerkRedemption.count({
        where: {
          venueId,
          redeemedAt: { gte: start, lte: end },
          voidedAt: { not: null },
        },
      }),
      this.prisma.venuePerkRedemption.groupBy({
        by: ['perkId'],
        where: {
          venueId,
          redeemedAt: { gte: start, lte: end },
          voidedAt: null,
        },
        _count: { id: true },
      }),
    ]);

    const activeRedemptions = redemptionsAll.filter((r) => !r.voidedAt);

    const redemptionsByDay = this.countByIsoDay(activeRedemptions.map((r) => r.redeemedAt));
    const visitsByDay = new Map<string, number>();
    const uniqueVisitors = new Set<string>();
    for (const v of visitRows) {
      uniqueVisitors.add(v.playerId);
      visitsByDay.set(v.dayKey, (visitsByDay.get(v.dayKey) ?? 0) + 1);
    }

    const redeemers = new Set(activeRedemptions.map((r) => r.playerId));
    const conversionPercent =
      uniqueVisitors.size === 0
        ? 0
        : Math.round((redeemers.size / uniqueVisitors.size) * 1000) / 10;

    const feedByKind: Partial<Record<VenueFeedEventKind, number>> = {};
    for (const e of feedEvents) {
      feedByKind[e.kind] = (feedByKind[e.kind] ?? 0) + 1;
    }

    const timelineDays = this.buildDayList(startDay, endDay);

    const byHourUtc = new Array(24).fill(0) as number[];
    const byHourVenue = tz ? (new Array(24).fill(0) as number[]) : null;
    for (const r of activeRedemptions) {
      const h = r.redeemedAt.getUTCHours();
      byHourUtc[h] += 1;
      if (byHourVenue && tz) {
        const hv = hourInTimeZone(r.redeemedAt, tz);
        byHourVenue[hv] += 1;
      }
    }

    const perkMeta = await this.prisma.venuePerk.findMany({
      where: { id: { in: perkGroups.map((g) => g.perkId) } },
      select: { id: true, title: true, code: true },
    });
    const perkMap = new Map(perkMeta.map((p) => [p.id, p]));
    const perPerk = perkGroups
      .map((g) => {
        const p = perkMap.get(g.perkId);
        return {
          perkId: g.perkId,
          code: p?.code ?? '—',
          title: p?.title ?? '—',
          count: g._count.id,
        };
      })
      .sort((a, b) => b.count - a.count);

    const funnelJourney = await this.funnelMetrics([venueId], start, end);
    const visitLoyalty = loyaltyMetricsSingleVenue(visitRows);

    return {
      venueId,
      analyticsTimeZone: tz,
      period: {
        startDay,
        endDay,
        presetDays: opts.from || opts.to ? undefined : opts.days ?? 30,
      },
      redemptions: {
        total: activeRedemptions.length,
        voided: voidedCountRow,
        byDay: timelineDays.map((day) => ({
          day,
          count: redemptionsByDay.get(day) ?? 0,
        })),
        byHourUtc: byHourUtc.map((count, hour) => ({ hour, count })),
        byHourVenue: byHourVenue
          ? byHourVenue.map((count, hour) => ({ hour, count }))
          : null,
        perPerk,
      },
      visits: {
        uniquePlayers: uniqueVisitors.size,
        totalVisitDays: visitRows.length,
        loyalty: visitLoyalty,
        byDay: timelineDays.map((day) => ({
          day,
          count: visitsByDay.get(day) ?? 0,
        })),
      },
      funnel: {
        uniqueVisitors: uniqueVisitors.size,
        uniqueRedeemers: redeemers.size,
        totalRedemptions: activeRedemptions.length,
        visitToRedeemPercent: conversionPercent,
      },
      funnelJourney,
      feedEvents: {
        total: feedEvents.length,
        byKind: feedByKind,
      },
    };
  }

  /** Roll up analytics across every venue in an organization (multi-location). */
  async getOrganizationSummary(organizationId: string, opts: AnalyticsQueryOpts) {
    const { start, end, startDay, endDay } = resolveAnalyticsPeriod(
      opts.days,
      opts.from,
      opts.to,
    );

    const venues = await this.prisma.venue.findMany({
      where: { organizationId },
      select: { id: true, name: true, analyticsTimeZone: true },
      orderBy: { name: 'asc' },
    });
    if (venues.length === 0) {
      return {
        organizationId,
        venueCount: 0,
        venues: [],
        analyticsTimeZone: null as string | null,
        period: {
          startDay,
          endDay,
          presetDays: opts.from || opts.to ? undefined : opts.days ?? 30,
        },
        redemptions: {
          total: 0,
          voided: 0,
          byDay: [] as { day: string; count: number }[],
          byHourUtc: Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 })),
          byHourVenue: null as { hour: number; count: number }[] | null,
          perPerk: [] as { perkId: string; code: string; title: string; count: number }[],
        },
        visits: {
          uniquePlayers: 0,
          totalVisitDays: 0,
          uniquePlayerDays: 0,
          loyalty: {
            repeatVisitPlayers: 0,
            avgVisitDaysPerPlayer: 0,
            shareRepeatVisitorsPercent: 0,
          },
          byDay: [] as { day: string; count: number }[],
        },
        funnel: {
          uniqueVisitors: 0,
          uniqueRedeemers: 0,
          totalRedemptions: 0,
          visitToRedeemPercent: 0,
        },
        funnelJourney: {
          detectImpressions: 0,
          uniqueEntered: 0,
          uniquePlayed: 0,
          uniqueRedeemed: 0,
          enterToPlayPercent: 0,
          playToRedeemPercent: 0,
          enteredToRedeemPercent: 0,
        },
        feedEvents: { total: 0, byKind: {} as Partial<Record<VenueFeedEventKind, number>> },
      };
    }

    const venueIds = venues.map((v) => v.id);
    const tz =
      venues.map((v) => v.analyticsTimeZone?.trim()).find((t) => !!t) || null;

    const [
      redemptionsAll,
      visitRows,
      feedEvents,
      voidedCountRow,
      perkGroups,
    ] = await Promise.all([
      this.prisma.venuePerkRedemption.findMany({
        where: {
          venueId: { in: venueIds },
          redeemedAt: { gte: start, lte: end },
        },
        select: {
          redeemedAt: true,
          playerId: true,
          voidedAt: true,
          perkId: true,
          perk: { select: { title: true, code: true } },
        },
      }),
      this.prisma.playerVenueVisitDay.findMany({
        where: {
          venueId: { in: venueIds },
          dayKey: { gte: startDay, lte: endDay },
        },
        select: { dayKey: true, playerId: true, venueId: true },
      }),
      this.prisma.venueFeedEvent.findMany({
        where: {
          venueId: { in: venueIds },
          createdAt: { gte: start, lte: end },
        },
        select: { kind: true, createdAt: true },
      }),
      this.prisma.venuePerkRedemption.count({
        where: {
          venueId: { in: venueIds },
          redeemedAt: { gte: start, lte: end },
          voidedAt: { not: null },
        },
      }),
      this.prisma.venuePerkRedemption.groupBy({
        by: ['perkId'],
        where: {
          venueId: { in: venueIds },
          redeemedAt: { gte: start, lte: end },
          voidedAt: null,
        },
        _count: { id: true },
      }),
    ]);

    const activeRedemptions = redemptionsAll.filter((r) => !r.voidedAt);
    const redemptionsByDay = this.countByIsoDay(activeRedemptions.map((r) => r.redeemedAt));
    const timelineDays = this.buildDayList(startDay, endDay);

    const uniqueVisitors = new Set(visitRows.map((v) => v.playerId));
    const visitsByDayUnique = new Map<string, Set<string>>();
    for (const v of visitRows) {
      if (!visitsByDayUnique.has(v.dayKey)) visitsByDayUnique.set(v.dayKey, new Set());
      visitsByDayUnique.get(v.dayKey)!.add(v.playerId);
    }
    const playerDayKeys = new Set(visitRows.map((v) => `${v.playerId}:${v.dayKey}`));

    const redeemers = new Set(activeRedemptions.map((r) => r.playerId));
    const conversionPercent =
      uniqueVisitors.size === 0
        ? 0
        : Math.round((redeemers.size / uniqueVisitors.size) * 1000) / 10;

    const feedByKind: Partial<Record<VenueFeedEventKind, number>> = {};
    for (const e of feedEvents) {
      feedByKind[e.kind] = (feedByKind[e.kind] ?? 0) + 1;
    }

    const byHourUtc = new Array(24).fill(0) as number[];
    const byHourVenue = tz ? (new Array(24).fill(0) as number[]) : null;
    for (const r of activeRedemptions) {
      const h = r.redeemedAt.getUTCHours();
      byHourUtc[h] += 1;
      if (byHourVenue && tz) {
        const hv = hourInTimeZone(r.redeemedAt, tz);
        byHourVenue[hv] += 1;
      }
    }

    const perkMeta = await this.prisma.venuePerk.findMany({
      where: { id: { in: perkGroups.map((g) => g.perkId) } },
      select: { id: true, title: true, code: true },
    });
    const perkMap = new Map(perkMeta.map((p) => [p.id, p]));
    const perPerk = perkGroups
      .map((g) => {
        const p = perkMap.get(g.perkId);
        return {
          perkId: g.perkId,
          code: p?.code ?? '—',
          title: p?.title ?? '—',
          count: g._count.id,
        };
      })
      .sort((a, b) => b.count - a.count);

    const funnelJourney = await this.funnelMetrics(venueIds, start, end);
    const visitLoyalty = loyaltyMetricsOrg(visitRows);

    return {
      organizationId,
      venueCount: venues.length,
      venues: venues.map((v) => ({ id: v.id, name: v.name })),
      analyticsTimeZone: tz,
      period: {
        startDay,
        endDay,
        presetDays: opts.from || opts.to ? undefined : opts.days ?? 30,
      },
      redemptions: {
        total: activeRedemptions.length,
        voided: voidedCountRow,
        byDay: timelineDays.map((day) => ({
          day,
          count: redemptionsByDay.get(day) ?? 0,
        })),
        byHourUtc: byHourUtc.map((count, hour) => ({ hour, count })),
        byHourVenue: byHourVenue
          ? byHourVenue.map((count, hour) => ({ hour, count }))
          : null,
        perPerk,
      },
      visits: {
        uniquePlayers: uniqueVisitors.size,
        totalVisitDays: visitRows.length,
        uniquePlayerDays: playerDayKeys.size,
        loyalty: visitLoyalty,
        byDay: timelineDays.map((day) => ({
          day,
          count: visitsByDayUnique.get(day)?.size ?? 0,
        })),
      },
      funnel: {
        uniqueVisitors: uniqueVisitors.size,
        uniqueRedeemers: redeemers.size,
        totalRedemptions: activeRedemptions.length,
        visitToRedeemPercent: conversionPercent,
      },
      funnelJourney,
      feedEvents: {
        total: feedEvents.length,
        byKind: feedByKind,
      },
    };
  }

  async buildRedemptionsCsv(venueId: string, opts: AnalyticsQueryOpts): Promise<string> {
    const { start, end } = resolveAnalyticsPeriod(opts.days, opts.from, opts.to);

    const rows = await this.prisma.venuePerkRedemption.findMany({
      where: {
        venueId,
        redeemedAt: { gte: start, lte: end },
      },
      orderBy: { redeemedAt: 'asc' },
      include: {
        perk: { select: { code: true, title: true } },
      },
    });

    const header = [
      'redemption_id',
      'staff_code',
      'redeemed_at_utc',
      'perk_code',
      'perk_title',
      'player_id',
      'voided',
      'void_reason',
      'acknowledged_utc',
    ].join(',');

    const lines = rows.map((r) =>
      [
        r.id,
        staffVerificationCodeFromRedemptionId(r.id),
        r.redeemedAt.toISOString(),
        csvEscape(r.perk.code),
        csvEscape(r.perk.title),
        r.playerId,
        r.voidedAt ? 'yes' : 'no',
        r.voidReason ? csvEscape(r.voidReason) : '',
        r.staffAcknowledgedAt?.toISOString() ?? '',
      ].join(','),
    );

    return [header, ...lines].join('\n');
  }

  async buildFunnelEventsCsv(venueId: string, opts: AnalyticsQueryOpts): Promise<string> {
    const { start, end } = resolveAnalyticsPeriod(opts.days, opts.from, opts.to);
    const rows = await this.prisma.venueFunnelEvent.findMany({
      where: { venueId, createdAt: { gte: start, lte: end } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        kind: true,
        playerId: true,
        createdAt: true,
      },
    });
    const header = ['event_id', 'venue_id', 'kind', 'player_id', 'created_at_utc'].join(',');
    const lines = rows.map((r) =>
      [
        r.id,
        venueId,
        r.kind,
        r.playerId ?? '',
        r.createdAt.toISOString(),
      ].join(','),
    );
    return [header, ...lines].join('\n');
  }

  async buildOrganizationRedemptionsCsv(
    organizationId: string,
    opts: AnalyticsQueryOpts,
  ): Promise<string> {
    const { start, end } = resolveAnalyticsPeriod(opts.days, opts.from, opts.to);

    const venueRows = await this.prisma.venue.findMany({
      where: { organizationId },
      select: { id: true, name: true },
    });
    const venueIds = venueRows.map((v) => v.id);
    const nameById = new Map(venueRows.map((v) => [v.id, v.name]));

    const rows = await this.prisma.venuePerkRedemption.findMany({
      where: {
        venueId: { in: venueIds },
        redeemedAt: { gte: start, lte: end },
      },
      orderBy: { redeemedAt: 'asc' },
      include: {
        perk: { select: { code: true, title: true } },
      },
    });

    const header = [
      'venue_id',
      'venue_name',
      'redemption_id',
      'staff_code',
      'redeemed_at_utc',
      'perk_code',
      'perk_title',
      'player_id',
      'voided',
      'void_reason',
      'acknowledged_utc',
    ].join(',');

    const lines = rows.map((r) =>
      [
        r.venueId,
        csvEscape(nameById.get(r.venueId) ?? ''),
        r.id,
        staffVerificationCodeFromRedemptionId(r.id),
        r.redeemedAt.toISOString(),
        csvEscape(r.perk.code),
        csvEscape(r.perk.title),
        r.playerId,
        r.voidedAt ? 'yes' : 'no',
        r.voidReason ? csvEscape(r.voidReason) : '',
        r.staffAcknowledgedAt?.toISOString() ?? '',
      ].join(','),
    );

    return [header, ...lines].join('\n');
  }

  async buildOrganizationFunnelEventsCsv(
    organizationId: string,
    opts: AnalyticsQueryOpts,
  ): Promise<string> {
    const { start, end } = resolveAnalyticsPeriod(opts.days, opts.from, opts.to);
    const venueRows = await this.prisma.venue.findMany({
      where: { organizationId },
      select: { id: true },
    });
    const venueIds = venueRows.map((v) => v.id);
    if (venueIds.length === 0) {
      return ['event_id', 'venue_id', 'kind', 'player_id', 'created_at_utc'].join('\n');
    }
    const rows = await this.prisma.venueFunnelEvent.findMany({
      where: { venueId: { in: venueIds }, createdAt: { gte: start, lte: end } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, venueId: true, kind: true, playerId: true, createdAt: true },
    });
    const header = ['event_id', 'venue_id', 'kind', 'player_id', 'created_at_utc'].join(',');
    const lines = rows.map((r) =>
      [
        r.id,
        r.venueId,
        r.kind,
        r.playerId ?? '',
        r.createdAt.toISOString(),
      ].join(','),
    );
    return [header, ...lines].join('\n');
  }

  private countByIsoDay(dates: Date[]): Map<string, number> {
    const m = new Map<string, number>();
    for (const d of dates) {
      const day = utcDayKey(d);
      m.set(day, (m.get(day) ?? 0) + 1);
    }
    return m;
  }

  private buildDayList(startDay: string, endDay: string): string[] {
    const out: string[] = [];
    const cur = new Date(`${startDay}T00:00:00.000Z`);
    const end = new Date(`${endDay}T00:00:00.000Z`);
    while (cur <= end) {
      out.push(utcDayKey(cur));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return out;
  }
}
