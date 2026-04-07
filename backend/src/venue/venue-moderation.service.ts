import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VenueModerationService {
  constructor(private readonly prisma: PrismaService) {}

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
      throw new BadRequestException('You already reported this player at this venue recently');
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
  }

  async removeBan(venueId: string, playerId: string): Promise<void> {
    try {
      await this.prisma.venuePlayerBan.delete({
        where: { venueId_playerId: { venueId, playerId } },
      });
    } catch {
      throw new NotFoundException('Ban not found');
    }
  }

  async dismissReport(reportId: string, venueId: string): Promise<void> {
    const r = await this.prisma.venuePlayerReport.findFirst({
      where: { id: reportId, venueId },
    });
    if (!r) throw new NotFoundException('Report not found');
    await this.prisma.venuePlayerReport.update({
      where: { id: reportId },
      data: { status: 'dismissed', dismissedAt: new Date() },
    });
  }
}
