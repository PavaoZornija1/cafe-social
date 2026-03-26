import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ReceiptSubmissionStatus, VenueStaffRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { normalizeUserEmail } from '../auth/user-email.util';
import { PrismaService } from '../prisma/prisma.service';
import { MinVenueRole } from '../venue-staff/min-venue-role.decorator';
import { VenueStaffGuard } from '../venue-staff/venue-staff.guard';
import { VenueStaffService } from '../venue-staff/venue-staff.service';
import { OwnerAnalyticsService } from './owner-analytics.service';
import { StaffRedemptionsService } from '../staff/staff-redemptions.service';
import { OwnerCampaignService } from './owner-campaign.service';
import { OwnerRedemptionActionsService } from './owner-redemption-actions.service';
import { PlayerService } from '../player/player.service';
import { VenueReceiptService } from '../receipt/venue-receipt.service';
import { CreateOwnerCampaignDto } from './dto/create-owner-campaign.dto';
import { ReviewReceiptDto } from './dto/review-receipt.dto';
import { VoidRedemptionDto } from './dto/void-redemption.dto';

function utcTodayYmd(): string {
  const n = new Date();
  const y = n.getUTCFullYear();
  const m = String(n.getUTCMonth() + 1).padStart(2, '0');
  const d = String(n.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

@Controller('owner')
@UseGuards(JwtAuthGuard)
export class OwnerController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly players: PlayerService,
    private readonly venueStaff: VenueStaffService,
    private readonly analytics: OwnerAnalyticsService,
    private readonly staffRedemptions: StaffRedemptionsService,
    private readonly campaigns: OwnerCampaignService,
    private readonly redemptionActions: OwnerRedemptionActionsService,
    private readonly receipts: VenueReceiptService,
  ) {}

  private async staffPlayerId(user: unknown): Promise<string> {
    const email = normalizeUserEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    const p = await this.prisma.player.findFirst({
      where: { email: { equals: email.trim(), mode: 'insensitive' } },
      select: { id: true },
    });
    if (!p) throw new UnauthorizedException('Player not found');
    return p.id;
  }

  @Get('venues')
  async myVenues(@CurrentUser() user: unknown) {
    const email = normalizeUserEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');

    const player = await this.players.findOrCreateByEmail(email.trim());
    const rows = await this.venueStaff.listVenuesForPlayer(player.id);
    return {
      venues: rows.map((r) => ({
        role: r.role,
        venue: r.venue,
      })),
    };
  }

  @Get('venues/:venueId/analytics')
  @UseGuards(VenueStaffGuard)
  @MinVenueRole(VenueStaffRole.MANAGER)
  venueAnalytics(
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Query('days') daysRaw: string | undefined,
  ) {
    const days =
      daysRaw !== undefined && daysRaw !== ''
        ? Number.parseInt(daysRaw, 10)
        : 30;
    const safe = Number.isFinite(days) ? days : 30;
    return this.analytics.getVenueSummary(venueId, safe);
  }

  @Get('venues/:venueId/analytics/export.csv')
  @UseGuards(VenueStaffGuard)
  @MinVenueRole(VenueStaffRole.MANAGER)
  async analyticsExportCsv(
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Query('days') daysRaw: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const days =
      daysRaw !== undefined && daysRaw !== ''
        ? Number.parseInt(daysRaw, 10)
        : 30;
    const safe = Number.isFinite(days) ? days : 30;
    const csv = await this.analytics.buildRedemptionsCsv(venueId, safe);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="cafe-social-redemptions.csv"',
    );
    return csv;
  }

  @Get('venues/:venueId/redemptions')
  @UseGuards(VenueStaffGuard)
  @MinVenueRole(VenueStaffRole.EMPLOYEE)
  venueRedemptions(
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Query('date') dateRaw: string | undefined,
  ) {
    const dateYmd =
      dateRaw && dateRaw.trim() !== '' ? dateRaw.trim() : utcTodayYmd();
    return this.staffRedemptions.listRedemptionsForStaffUser(venueId, dateYmd);
  }

  @Post('venues/:venueId/redemptions/:redemptionId/acknowledge')
  @UseGuards(VenueStaffGuard)
  @MinVenueRole(VenueStaffRole.EMPLOYEE)
  async acknowledgeRedemption(
    @CurrentUser() user: unknown,
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Param('redemptionId', new ParseUUIDPipe()) redemptionId: string,
  ) {
    const staffId = await this.staffPlayerId(user);
    await this.redemptionActions.acknowledge({
      venueId,
      redemptionId,
      staffPlayerId: staffId,
    });
    return { ok: true };
  }

  @Post('venues/:venueId/redemptions/:redemptionId/void')
  @UseGuards(VenueStaffGuard)
  @MinVenueRole(VenueStaffRole.MANAGER)
  async voidRedemption(
    @CurrentUser() user: unknown,
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Param('redemptionId', new ParseUUIDPipe()) redemptionId: string,
    @Body() body: VoidRedemptionDto,
  ) {
    const staffId = await this.staffPlayerId(user);
    await this.redemptionActions.voidRedemption({
      venueId,
      redemptionId,
      staffPlayerId: staffId,
      reason: body.reason,
    });
    return { ok: true };
  }

  @Get('venues/:venueId/campaigns')
  @UseGuards(VenueStaffGuard)
  @MinVenueRole(VenueStaffRole.MANAGER)
  listCampaigns(@Param('venueId', new ParseUUIDPipe()) venueId: string) {
    return this.campaigns.list(venueId);
  }

  @Post('venues/:venueId/campaigns')
  @UseGuards(VenueStaffGuard)
  @MinVenueRole(VenueStaffRole.MANAGER)
  createCampaign(
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Body() body: CreateOwnerCampaignDto,
  ) {
    return this.campaigns.create({
      venueId,
      name: body.name,
      title: body.title,
      body: body.body,
      segmentDays: body.segmentDays ?? 30,
    });
  }

  @Post('venues/:venueId/campaigns/:campaignId/send')
  @UseGuards(VenueStaffGuard)
  @MinVenueRole(VenueStaffRole.MANAGER)
  sendCampaign(
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Param('campaignId', new ParseUUIDPipe()) campaignId: string,
  ) {
    return this.campaigns.send(venueId, campaignId);
  }

  @Get('venues/:venueId/receipts')
  @UseGuards(VenueStaffGuard)
  @MinVenueRole(VenueStaffRole.MANAGER)
  listReceipts(@Param('venueId', new ParseUUIDPipe()) venueId: string) {
    return this.receipts.listSummaryForVenue(venueId);
  }

  @Get('venues/:venueId/receipts/:submissionId')
  @UseGuards(VenueStaffGuard)
  @MinVenueRole(VenueStaffRole.MANAGER)
  receiptDetail(
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Param('submissionId', new ParseUUIDPipe()) submissionId: string,
  ) {
    return this.receipts.getDetailForVenueStaff(venueId, submissionId);
  }

  @Post('venues/:venueId/receipts/:submissionId/review')
  @UseGuards(VenueStaffGuard)
  @MinVenueRole(VenueStaffRole.MANAGER)
  async reviewReceipt(
    @CurrentUser() user: unknown,
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Param('submissionId', new ParseUUIDPipe()) submissionId: string,
    @Body() body: ReviewReceiptDto,
  ) {
    const reviewerId = await this.staffPlayerId(user);
    const st =
      body.status === 'APPROVED'
        ? ReceiptSubmissionStatus.APPROVED
        : ReceiptSubmissionStatus.REJECTED;
    return this.receipts.review({
      venueId,
      submissionId,
      reviewerPlayerId: reviewerId,
      status: st,
      staffNote: body.staffNote,
      abuseFlag: body.abuseFlag,
    });
  }
}
