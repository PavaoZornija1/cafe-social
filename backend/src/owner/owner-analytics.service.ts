import { Injectable } from '@nestjs/common';
import { VenueFeedEventKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { hourInTimeZone } from '../lib/hour-in-timezone';
import { staffVerificationCodeFromRedemptionId } from '../lib/redemption-staff-code';

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

@Injectable()
export class OwnerAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getVenueSummary(venueId: string, days: number) {
    const safeDays = Math.min(Math.max(days, 1), 90);
    const end = new Date();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (safeDays - 1));
    start.setUTCHours(0, 0, 0, 0);
    const endDay = utcDayKey(end);
    const startDay = utcDayKey(start);

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

    return {
      venueId,
      analyticsTimeZone: tz,
      period: { days: safeDays, startDay, endDay },
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
      feedEvents: {
        total: feedEvents.length,
        byKind: feedByKind,
      },
    };
  }

  /** Roll up analytics across every venue in an organization (multi-location). */
  async getOrganizationSummary(organizationId: string, days: number) {
    const safeDays = Math.min(Math.max(days, 1), 90);
    const end = new Date();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (safeDays - 1));
    start.setUTCHours(0, 0, 0, 0);
    const endDay = utcDayKey(end);
    const startDay = utcDayKey(start);

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
        period: { days: safeDays, startDay, endDay },
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
          byDay: [] as { day: string; count: number }[],
        },
        funnel: {
          uniqueVisitors: 0,
          uniqueRedeemers: 0,
          totalRedemptions: 0,
          visitToRedeemPercent: 0,
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
        select: { dayKey: true, playerId: true },
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

    return {
      organizationId,
      venueCount: venues.length,
      venues: venues.map((v) => ({ id: v.id, name: v.name })),
      analyticsTimeZone: tz,
      period: { days: safeDays, startDay, endDay },
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
      feedEvents: {
        total: feedEvents.length,
        byKind: feedByKind,
      },
    };
  }

  async buildRedemptionsCsv(venueId: string, days: number): Promise<string> {
    const safeDays = Math.min(Math.max(days, 1), 90);
    const end = new Date();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (safeDays - 1));
    start.setUTCHours(0, 0, 0, 0);

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

  async buildOrganizationRedemptionsCsv(
    organizationId: string,
    days: number,
  ): Promise<string> {
    const safeDays = Math.min(Math.max(days, 1), 90);
    const end = new Date();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (safeDays - 1));
    start.setUTCHours(0, 0, 0, 0);

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
