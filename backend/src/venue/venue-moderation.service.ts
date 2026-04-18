import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';

@Injectable()
export class VenueModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  async isBanned(venueId: string, playerId: string): Promise<boolean> {
    const row = await this.prisma.venuePlayerBan.findUnique({
      where: {
        venueId_playerId: { venueId, playerId },
      },
    });
    return !!row;
  }

  async assertNotBanned(venueId: string, playerId: string): Promise<void> {
    if (await this.isBanned(venueId, playerId)) {
      throw new ForbiddenException('You are restricted from this venue. Contact staff if this is a mistake.');
    }
  }

  /** Caps spam: max reports one reporter can file at a single venue per rolling day. */
  private static readonly MAX_REPORTS_PER_VENUE_PER_DAY_PER_REPORTER = 20;
  /** Additional cap: reports across all venues per reporter per rolling day. */
  private static readonly MAX_REPORTS_GLOBAL_PER_DAY_PER_REPORTER = 50;

  private async writeAudit(params: {
    venueId: string;
    actorPlayerId: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Prisma.InputJsonValue;
  }): Promise<void> {
    await this.prisma.venueModerationAuditLog.create({
      data: {
        venueId: params.venueId,
        actorPlayerId: params.actorPlayerId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        metadata: params.metadata,
      },
    });
  }

  async createReport(params: {
    venueId: string;
    reporterId: string;
    reportedPlayerId: string;
    reason: string;
    note: string | null;
  }): Promise<{ id: string }> {
    if (params.reporterId === params.reportedPlayerId) {
      throw new BadRequestException('Cannot report yourself');
    }
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dup = await this.prisma.venuePlayerReport.findFirst({
      where: {
        venueId: params.venueId,
        reporterId: params.reporterId,
        reportedPlayerId: params.reportedPlayerId,
        createdAt: { gte: since },
      },
    });
    if (dup) {
      throw new BadRequestException(
        'You already reported this player at this venue in the last 24 hours',
      );
    }
    const recentCount = await this.prisma.venuePlayerReport.count({
      where: {
        venueId: params.venueId,
        reporterId: params.reporterId,
        createdAt: { gte: since },
      },
    });
    if (recentCount >= VenueModerationService.MAX_REPORTS_PER_VENUE_PER_DAY_PER_REPORTER) {
      throw new BadRequestException(
        'Report limit reached for this venue today. Contact venue staff if you need help.',
      );
    }
    const globalRecent = await this.prisma.venuePlayerReport.count({
      where: {
        reporterId: params.reporterId,
        createdAt: { gte: since },
      },
    });
    if (globalRecent >= VenueModerationService.MAX_REPORTS_GLOBAL_PER_DAY_PER_REPORTER) {
      throw new BadRequestException(
        'Daily report limit reached. Try again tomorrow or contact support if this is urgent.',
      );
    }
    const row = await this.prisma.venuePlayerReport.create({
      data: {
        venueId: params.venueId,
        reporterId: params.reporterId,
        reportedPlayerId: params.reportedPlayerId,
        reason: params.reason.trim().slice(0, 256),
        note: params.note?.trim().slice(0, 2000) || null,
      },
    });
    return { id: row.id };
  }

  listReportsForVenue(venueId: string, limit = 100) {
    return this.prisma.venuePlayerReport.findMany({
      where: { venueId, status: 'open' },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
      include: {
        reporter: { select: { id: true, username: true, email: true } },
        reportedPlayer: { select: { id: true, username: true, email: true } },
      },
    });
  }

  listBansForVenue(venueId: string, limit = 100) {
    return this.prisma.venuePlayerBan.findMany({
      where: { venueId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
      include: {
        player: { select: { id: true, username: true, email: true } },
        createdBy: { select: { id: true, username: true, email: true } },
      },
    });
  }

  async banPlayer(params: {
    venueId: string;
    targetPlayerId: string;
    staffPlayerId: string;
    reason?: string | null;
  }): Promise<void> {
    await this.prisma.venuePlayerBan.upsert({
      where: {
        venueId_playerId: { venueId: params.venueId, playerId: params.targetPlayerId },
      },
      create: {
        venueId: params.venueId,
        playerId: params.targetPlayerId,
        reason: params.reason?.trim() || null,
        createdByStaffPlayerId: params.staffPlayerId,
      },
      update: {
        reason: params.reason?.trim() || null,
        createdByStaffPlayerId: params.staffPlayerId,
      },
    });
    await this.writeAudit({
      venueId: params.venueId,
      actorPlayerId: params.staffPlayerId,
      action: 'ban_upserted',
      entityType: 'venue_ban',
      entityId: `${params.venueId}:${params.targetPlayerId}`,
      metadata: { targetPlayerId: params.targetPlayerId },
    });
  }

  async removeBan(
    venueId: string,
    playerId: string,
    actorPlayerId: string | null = null,
  ): Promise<void> {
    try {
      await this.prisma.venuePlayerBan.delete({
        where: { venueId_playerId: { venueId, playerId } },
      });
    } catch {
      throw new NotFoundException('Ban not found');
    }
    const closed = await this.prisma.venueBanAppeal.updateMany({
      where: { venueId, playerId, status: 'open' },
      data: {
        status: 'lifted',
        resolvedAt: new Date(),
        staffNote: 'Restriction removed by staff.',
      },
    });
    await this.writeAudit({
      venueId,
      actorPlayerId,
      action: 'ban_removed',
      entityType: 'venue_ban',
      entityId: `${venueId}:${playerId}`,
      metadata: { targetPlayerId: playerId, appealsClosed: closed.count },
    });
  }

  async dismissReport(
    reportId: string,
    venueId: string,
    opts?: {
      staffPlayerId?: string | null;
      dismissalNoteToReporter?: string | null;
    },
  ): Promise<void> {
    const r = await this.prisma.venuePlayerReport.findFirst({
      where: { id: reportId, venueId },
    });
    if (!r) throw new NotFoundException('Report not found');
    const note = opts?.dismissalNoteToReporter?.trim().slice(0, 500) || null;
    await this.prisma.venuePlayerReport.update({
      where: { id: reportId },
      data: {
        status: 'dismissed',
        dismissedAt: new Date(),
        dismissalNoteToReporter: note,
      },
    });
    await this.writeAudit({
      venueId,
      actorPlayerId: opts?.staffPlayerId ?? null,
      action: 'report_dismissed',
      entityType: 'venue_report',
      entityId: reportId,
      metadata: { reporterId: r.reporterId, reportedPlayerId: r.reportedPlayerId },
    });
  }

  listModerationAudit(venueId: string, limit = 80) {
    return this.prisma.venueModerationAuditLog.findMany({
      where: { venueId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
      include: {
        actor: { select: { id: true, username: true, email: true } },
      },
    });
  }

  /** Lightweight panel for on-site staff apps (any venue staff role). */
  staffSummaryForVenue(venueId: string) {
    return Promise.all([
      this.prisma.venuePlayerReport.count({
        where: { venueId, status: 'open' },
      }),
      this.prisma.venuePlayerBan.count({ where: { venueId } }),
      this.prisma.venueBanAppeal.count({
        where: { venueId, status: 'open' },
      }),
      this.prisma.venuePlayerReport.findMany({
        where: { venueId, status: 'open' },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          createdAt: true,
          reason: true,
          reportedPlayer: { select: { username: true } },
        },
      }),
    ]).then(([openReportsCount, activeBansCount, openAppealsCount, recentOpenReports]) => ({
      openReportsCount,
      activeBansCount,
      openAppealsCount,
      recentOpenReports: recentOpenReports.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        reasonPreview:
          r.reason.length > 100 ? `${r.reason.slice(0, 100)}…` : r.reason,
        reportedUsername: r.reportedPlayer.username,
      })),
    }));
  }

  async createBanAppeal(playerId: string, venueId: string, message: string) {
    const trimmed = message.trim();
    if (trimmed.length < 8) {
      throw new BadRequestException('Appeal message must be at least 8 characters');
    }
    if (!(await this.isBanned(venueId, playerId))) {
      throw new BadRequestException(
        'There is no active venue restriction on your account to appeal',
      );
    }
    const open = await this.prisma.venueBanAppeal.findFirst({
      where: { playerId, venueId, status: 'open' },
    });
    if (open) {
      throw new BadRequestException('You already have an open appeal for this venue');
    }
    const row = await this.prisma.venueBanAppeal.create({
      data: {
        venueId,
        playerId,
        message: trimmed.slice(0, 2000),
      },
    });
    return { id: row.id };
  }

  listBanAppealsForVenue(
    venueId: string,
    opts?: {
      includeResolved?: boolean;
      status?: 'open' | 'all';
      createdFrom?: Date;
      createdTo?: Date;
      limit?: number;
    },
  ) {
    const limit = Math.min(opts?.limit ?? 50, 100);
    const wantAll = opts?.includeResolved === true || opts?.status === 'all';
    const statusFilter = wantAll ? {} : { status: 'open' as const };
    return this.prisma.venueBanAppeal.findMany({
      where: {
        venueId,
        ...statusFilter,
        ...(opts?.createdFrom || opts?.createdTo
          ? {
              createdAt: {
                ...(opts.createdFrom ? { gte: opts.createdFrom } : {}),
                ...(opts.createdTo ? { lte: opts.createdTo } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        player: { select: { id: true, username: true, email: true } },
        resolvedBy: { select: { id: true, username: true, email: true } },
      },
    });
  }

  /** @deprecated Prefer {@link resolveBanAppeal} with outcome dismissed. */
  async dismissBanAppeal(appealId: string, venueId: string, staffPlayerId?: string): Promise<void> {
    await this.resolveBanAppeal({
      appealId,
      venueId,
      staffPlayerId: staffPlayerId ?? null,
      outcome: 'dismissed',
      staffNote: null,
      staffMessageToPlayer: null,
      notifyPlayer: false,
    });
  }

  async resolveBanAppeal(params: {
    appealId: string;
    venueId: string;
    staffPlayerId: string | null;
    outcome: 'dismissed' | 'upheld' | 'lifted';
    staffNote: string | null | undefined;
    staffMessageToPlayer: string | null | undefined;
    notifyPlayer: boolean | undefined;
  }): Promise<void> {
    const a = await this.prisma.venueBanAppeal.findFirst({
      where: { id: params.appealId, venueId: params.venueId },
      include: {
        venue: { select: { name: true } },
        player: { select: { id: true, totalPrivacy: true } },
      },
    });
    if (!a) throw new NotFoundException('Appeal not found');
    if (a.status !== 'open') {
      throw new BadRequestException('This appeal is already closed');
    }

    const now = new Date();
    const status =
      params.outcome === 'lifted'
        ? 'lifted'
        : params.outcome === 'upheld'
          ? 'upheld'
          : 'dismissed';
    const note = params.staffNote?.trim() || null;
    const msgToPlayer = params.staffMessageToPlayer?.trim() || null;

    await this.prisma.$transaction(async (tx) => {
      if (params.outcome === 'lifted') {
        await tx.venuePlayerBan
          .delete({
            where: { venueId_playerId: { venueId: params.venueId, playerId: a.playerId } },
          })
          .catch(() => {
            /* no ban row — still close appeal */
          });
      }

      await tx.venueBanAppeal.update({
        where: { id: params.appealId },
        data: {
          status,
          staffNote: note,
          staffMessageToPlayer: msgToPlayer,
          resolvedAt: now,
          resolvedByStaffPlayerId: params.staffPlayerId,
        },
      });
    });

    if (params.notifyPlayer && !a.player.totalPrivacy) {
      const venueName = a.venue.name;
      const defaultBody =
        params.outcome === 'lifted'
          ? `Your appeal at ${venueName} was granted. You may be able to use venue features again — open the app for details.`
          : params.outcome === 'upheld'
            ? `Your appeal at ${venueName} was reviewed. The venue restriction remains in place.`
            : `Your appeal at ${venueName} was reviewed and closed.`;
      const body = msgToPlayer || defaultBody;
      await this.sendAppealOutcomePush(
        a.playerId,
        venueName,
        body,
        params.appealId,
        params.venueId,
        status,
      );
      await this.prisma.venueBanAppeal.update({
        where: { id: params.appealId },
        data: { playerNotifiedAt: new Date() },
      });
    }

    await this.writeAudit({
      venueId: params.venueId,
      actorPlayerId: params.staffPlayerId,
      action: `appeal_${status}`,
      entityType: 'ban_appeal',
      entityId: params.appealId,
      metadata: {
        outcome: params.outcome,
        notifyPlayer: Boolean(params.notifyPlayer),
        playerId: a.playerId,
      },
    });
  }

  private async sendAppealOutcomePush(
    playerId: string,
    venueName: string,
    body: string,
    appealId: string,
    venueId: string,
    outcomeStatus: string,
  ): Promise<void> {
    const tokens = await this.prisma.playerExpoPushToken.findMany({
      where: { playerId },
      select: { token: true },
    });
    if (tokens.length === 0) return;
    await this.push.sendExpo([...new Set(tokens.map((t) => t.token))], {
      title: 'Venue restriction update',
      body,
      data: {
        kind: 'ban_appeal_resolved',
        appealId,
        venueId,
        venueName,
        outcome: outcomeStatus,
      },
    });
  }
}
