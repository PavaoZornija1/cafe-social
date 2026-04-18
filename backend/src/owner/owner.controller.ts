import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  PlatformRole,
  ReceiptSubmissionStatus,
  VenueStaff,
  VenueStaffInviteStatus,
  VenueStaffRole,
} from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { normalizeUserEmail } from '../auth/user-email.util';
import { PrismaService } from '../prisma/prisma.service';
import { MinVenueRole } from '../venue-staff/min-venue-role.decorator';
import { VenueStaffGuard } from '../venue-staff/venue-staff.guard';
import { OrganizationStaffGuard } from '../venue-staff/organization-staff.guard';
import { VenueStaffService } from '../venue-staff/venue-staff.service';
import { VenueStaffInviteService } from '../venue-staff/venue-staff-invite.service';
import { CreateStaffInviteDto } from '../venue-staff/dto/create-staff-invite.dto';
import { AcceptStaffInviteDto } from '../venue-staff/dto/accept-staff-invite.dto';
import { OwnerAnalyticsService } from './owner-analytics.service';
import { StaffRedemptionsService } from '../staff/staff-redemptions.service';
import { OwnerCampaignService } from './owner-campaign.service';
import { OwnerRedemptionActionsService } from './owner-redemption-actions.service';
import { PlayerService } from '../player/player.service';
import { VenueReceiptService } from '../receipt/venue-receipt.service';
import { CreateOwnerCampaignDto } from './dto/create-owner-campaign.dto';
import { ReviewReceiptDto } from './dto/review-receipt.dto';
import { VoidRedemptionDto } from './dto/void-redemption.dto';
import { PartnerOnboardingDto } from './dto/partner-onboarding.dto';
import { PartnerOrgAccessService } from './partner-org-access.service';
import { PartnerOnboardingService } from './partner-onboarding.service';
import { OwnerOrganizationVenueService } from './owner-organization-venue.service';
import { CreateVenueDto } from '../venue/dto/create-venue.dto';
import { PartnerVenueWriteGuard } from './partner-venue-write.guard';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { PartnerOnboardingThrottlerFilter } from './partner-onboarding-throttle.filter';
import { PORTAL_VENUE_CONTEXT_HEADER } from './portal-context.constants';
import { VenueModerationService } from '../venue/venue-moderation.service';
import { BanPlayerDto } from './dto/ban-player.dto';
import { ResolveBanAppealDto } from './dto/resolve-ban-appeal.dto';
import { DismissModerationReportDto } from './dto/dismiss-moderation-report.dto';
import { parseYmdUtc } from './analytics-period.util';

function utcTodayYmd(): string {
  const n = new Date();
  const y = n.getUTCFullYear();
  const m = String(n.getUTCMonth() + 1).padStart(2, '0');
  const d = String(n.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Partner portal API. Venue mutations use `PartnerVenueWriteGuard` + `PartnerOrgAccessService`
 * (trial / lock). `POST organizations/:id/venues` calls `assertPartnerMayMutateOrganization`.
 * Super admins: send `X-Portal-Venue-Context: <venueId>` to load one venue as partner context;
 * partner write bypass applies only when that header does not match the route `venueId`.
 */
@Controller('owner')
@UseGuards(JwtAuthGuard)
export class OwnerController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly players: PlayerService,
    private readonly venueStaff: VenueStaffService,
    private readonly staffInvites: VenueStaffInviteService,
    private readonly analytics: OwnerAnalyticsService,
    private readonly staffRedemptions: StaffRedemptionsService,
    private readonly campaigns: OwnerCampaignService,
    private readonly redemptionActions: OwnerRedemptionActionsService,
    private readonly receipts: VenueReceiptService,
    private readonly partnerOrgAccess: PartnerOrgAccessService,
    private readonly partnerOnboarding: PartnerOnboardingService,
    private readonly ownerOrgVenues: OwnerOrganizationVenueService,
    private readonly venueModeration: VenueModerationService,
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

  private static isUuidSegment(v: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v.trim(),
    );
  }

  /** Resolved venue id when a super admin sends {@link PORTAL_VENUE_CONTEXT_HEADER}. */
  private async resolvePortalVenueContext(
    req: Request,
    user: unknown,
  ): Promise<string | null> {
    const raw = req.headers[PORTAL_VENUE_CONTEXT_HEADER];
    const val =
      typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : undefined;
    const id = typeof val === 'string' ? val.trim() : '';
    if (!id || !OwnerController.isUuidSegment(id)) {
      return null;
    }
    const email = normalizeUserEmail(user);
    if (!email) return null;
    const p = await this.prisma.player.findFirst({
      where: { email: { equals: email.trim(), mode: 'insensitive' } },
      select: { platformRole: true },
    });
    if (p?.platformRole !== PlatformRole.SUPER_ADMIN) {
      return null;
    }
    const v = await this.prisma.venue.findUnique({
      where: { id },
      select: { id: true },
    });
    return v ? id : null;
  }

  /**
   * Shared venue list for portal: super admins get no venues until they pick one
   * via `X-Portal-Venue-Context`; others see `VenueStaff` memberships only.
   */
  private async buildPortalVenuesForUser(
    user: unknown,
    actingPartnerVenueId: string | null,
  ): Promise<{
    platformRole: PlatformRole;
    playerId: string;
    email: string;
    username: string;
    venues: {
      role: VenueStaffRole;
      venue: {
        id: string;
        name: string;
        city: string | null;
        country: string | null;
        address: string | null;
        organizationId: string | null;
        locked: boolean;
        lockReason: string | null;
        organization: {
          id: string;
          name: string;
          slug: string | null;
          locationKind: string;
          trialStartedAt: Date | null;
          trialEndsAt: Date | null;
          platformBillingPlan: string | null;
          platformBillingStatus: string;
          platformBillingRenewsAt: Date | null;
          platformBillingSyncedAt: Date | null;
          billingPortalUrl: string | null;
        } | null;
      };
    }[];
  }> {
    const email = normalizeUserEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');

    const player = await this.players.findOrCreateByEmail(email.trim());
    const row = await this.prisma.player.findUnique({
      where: { id: player.id },
      select: {
        id: true,
        email: true,
        username: true,
        platformRole: true,
      },
    });
    if (!row) throw new UnauthorizedException('Player not found');

    const venueSelect = {
      id: true,
      name: true,
      city: true,
      country: true,
      address: true,
      organizationId: true,
      locked: true,
      lockReason: true,
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          locationKind: true,
          trialStartedAt: true,
          trialEndsAt: true,
          platformBillingPlan: true,
          platformBillingStatus: true,
          platformBillingRenewsAt: true,
          platformBillingSyncedAt: true,
          billingPortalUrl: true,
        },
      },
    } as const;

    if (row.platformRole === PlatformRole.SUPER_ADMIN) {
      if (!actingPartnerVenueId) {
        return {
          platformRole: row.platformRole,
          playerId: row.id,
          email: row.email,
          username: row.username,
          venues: [],
        };
      }
      const venue = await this.prisma.venue.findUnique({
        where: { id: actingPartnerVenueId },
        select: venueSelect,
      });
      if (!venue) {
        return {
          platformRole: row.platformRole,
          playerId: row.id,
          email: row.email,
          username: row.username,
          venues: [],
        };
      }
      return {
        platformRole: row.platformRole,
        playerId: row.id,
        email: row.email,
        username: row.username,
        venues: [{ role: VenueStaffRole.OWNER, venue }],
      };
    }

    const staffRows = await this.venueStaff.listVenuesForPlayer(row.id);
    return {
      platformRole: row.platformRole,
      playerId: row.id,
      email: row.email,
      username: row.username,
      venues: staffRows.map((r) => ({ role: r.role, venue: r.venue })),
    };
  }

  private collectOrgIdsFromPortalVenues(
    venues: { venue: { organizationId: string | null } }[],
  ): string[] {
    return [
      ...new Set(
        venues
          .map((v) => v.venue.organizationId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    ];
  }

  @Get('super-admin/venue-picker')
  async superAdminVenuePicker(@CurrentUser() user: unknown) {
    const email = normalizeUserEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    const p = await this.prisma.player.findFirst({
      where: { email: { equals: email.trim(), mode: 'insensitive' } },
      select: { platformRole: true },
    });
    if (p?.platformRole !== PlatformRole.SUPER_ADMIN) {
      throw new ForbiddenException('Super admin only');
    }
    return this.prisma.venue.findMany({
      select: {
        id: true,
        name: true,
        city: true,
        country: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  @Get('me')
  async portalMe(@CurrentUser() user: unknown, @Req() req: Request) {
    const actingPartnerVenueId = await this.resolvePortalVenueContext(req, user);
    let ctx = await this.buildPortalVenuesForUser(user, actingPartnerVenueId);
    await this.partnerOrgAccess.syncVenueLocksForOrganizations(
      this.collectOrgIdsFromPortalVenues(ctx.venues),
    );
    ctx = await this.buildPortalVenuesForUser(user, actingPartnerVenueId);
    let needsPartnerOnboarding =
      ctx.platformRole !== PlatformRole.SUPER_ADMIN && ctx.venues.length === 0;
    if (needsPartnerOnboarding) {
      const pendingInvites = await this.prisma.venueStaffInvite.count({
        where: {
          email: { equals: ctx.email.trim(), mode: 'insensitive' },
          status: VenueStaffInviteStatus.PENDING,
        },
      });
      if (pendingInvites > 0) {
        needsPartnerOnboarding = false;
      }
    }
    return {
      platformRole: ctx.platformRole,
      playerId: ctx.playerId,
      email: ctx.email,
      username: ctx.username,
      venues: ctx.venues,
      needsPartnerOnboarding,
      actingPartnerVenueId,
    };
  }

  @Get('venues')
  async myVenues(@CurrentUser() user: unknown, @Req() req: Request) {
    const actingPartnerVenueId = await this.resolvePortalVenueContext(req, user);
    let ctx = await this.buildPortalVenuesForUser(user, actingPartnerVenueId);
    await this.partnerOrgAccess.syncVenueLocksForOrganizations(
      this.collectOrgIdsFromPortalVenues(ctx.venues),
    );
    ctx = await this.buildPortalVenuesForUser(user, actingPartnerVenueId);
    return {
      platformRole: ctx.platformRole,
      venues: ctx.venues,
      actingPartnerVenueId,
    };
  }

  @Post('onboarding/bootstrap')
  @UseFilters(PartnerOnboardingThrottlerFilter)
  @UseGuards(ThrottlerGuard)
  @Throttle({ onboarding: { limit: 8, ttl: 60000 } })
  async partnerOnboardingBootstrap(
    @CurrentUser() user: unknown,
    @Body() body: PartnerOnboardingDto,
  ) {
    const email = normalizeUserEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    const player = await this.players.findOrCreateByEmail(email.trim());
    return this.partnerOnboarding.bootstrapSelfServeOrgAndVenue(player.id, body);
  }

  @Post('organizations/:organizationId/venues')
  async createVenueForOrganization(
    @CurrentUser() user: unknown,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() body: CreateVenueDto,
  ) {
    const email = normalizeUserEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    const player = await this.players.findOrCreateByEmail(email.trim());
    if (player.platformRole === PlatformRole.SUPER_ADMIN) {
      throw new BadRequestException(
        'Super admins add venues via /api/admin/venues (CMS).',
      );
    }
    await this.partnerOrgAccess.assertPartnerMayMutateOrganization(
      organizationId,
      user,
    );
    return this.ownerOrgVenues.createVenueUnderOrganization(
      organizationId,
      player.id,
      body,
    );
  }

  @Post('accept-staff-invite')
  async acceptStaffInvite(
    @CurrentUser() user: unknown,
    @Body() body: AcceptStaffInviteDto,
  ) {
    const email = normalizeUserEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    return this.staffInvites.acceptInvite(body.token, email);
  }

  @Get('organizations/:organizationId/analytics')
  @UseGuards(OrganizationStaffGuard)
  orgAnalytics(
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Query('days') daysRaw: string | undefined,
    @Query('from') fromYmd?: string,
    @Query('to') toYmd?: string,
  ) {
    const days =
      daysRaw !== undefined && daysRaw !== ''
        ? Number.parseInt(daysRaw, 10)
        : 30;
    const safe = Number.isFinite(days) ? days : 30;
    return this.analytics.getOrganizationSummary(organizationId, {
      days: safe,
      from: fromYmd?.trim() || undefined,
      to: toYmd?.trim() || undefined,
    });
  }

  @Get('organizations/:organizationId/analytics/export.csv')
  @UseGuards(OrganizationStaffGuard)
  async orgAnalyticsExportCsv(
    @Res({ passthrough: true }) res: Response,
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Query('days') daysRaw: string | undefined,
    @Query('from') fromYmd?: string,
    @Query('to') toYmd?: string,
  ) {
    const days =
      daysRaw !== undefined && daysRaw !== ''
        ? Number.parseInt(daysRaw, 10)
        : 30;
    const safe = Number.isFinite(days) ? days : 30;
    const csv = await this.analytics.buildOrganizationRedemptionsCsv(organizationId, {
      days: safe,
      from: fromYmd?.trim() || undefined,
      to: toYmd?.trim() || undefined,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="cafe-social-org-redemptions.csv"',
    );
    return csv;
  }

  @Get('organizations/:organizationId/analytics/funnel-export.csv')
  @UseGuards(OrganizationStaffGuard)
  async orgFunnelExportCsv(
    @Res({ passthrough: true }) res: Response,
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Query('days') daysRaw: string | undefined,
    @Query('from') fromYmd?: string,
    @Query('to') toYmd?: string,
  ) {
    const days =
      daysRaw !== undefined && daysRaw !== ''
        ? Number.parseInt(daysRaw, 10)
        : 30;
    const safe = Number.isFinite(days) ? days : 30;
    const csv = await this.analytics.buildOrganizationFunnelEventsCsv(organizationId, {
      days: safe,
      from: fromYmd?.trim() || undefined,
      to: toYmd?.trim() || undefined,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="cafe-social-org-funnel-events.csv"',
    );
    return csv;
  }

  @Get('venues/:venueId/analytics')
  @UseGuards(VenueStaffGuard)
  @MinVenueRole(VenueStaffRole.MANAGER)
  venueAnalytics(
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Query('days') daysRaw: string | undefined,
    @Query('from') fromYmd?: string,
    @Query('to') toYmd?: string,
  ) {
    const days =
      daysRaw !== undefined && daysRaw !== ''
        ? Number.parseInt(daysRaw, 10)
        : 30;
    const safe = Number.isFinite(days) ? days : 30;
    return this.analytics.getVenueSummary(venueId, {
      days: safe,
      from: fromYmd?.trim() || undefined,
      to: toYmd?.trim() || undefined,
    });
  }

  @Get('venues/:venueId/analytics/export.csv')
  @UseGuards(VenueStaffGuard)
  @MinVenueRole(VenueStaffRole.MANAGER)
  async analyticsExportCsv(
    @Res({ passthrough: true }) res: Response,
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Query('days') daysRaw: string | undefined,
    @Query('from') fromYmd?: string,
    @Query('to') toYmd?: string,
  ) {
    const days =
      daysRaw !== undefined && daysRaw !== ''
        ? Number.parseInt(daysRaw, 10)
        : 30;
    const safe = Number.isFinite(days) ? days : 30;
    const csv = await this.analytics.buildRedemptionsCsv(venueId, {
      days: safe,
      from: fromYmd?.trim() || undefined,
      to: toYmd?.trim() || undefined,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="cafe-social-redemptions.csv"',
    );
    return csv;
  }

  @Get('venues/:venueId/analytics/funnel-export.csv')
  @UseGuards(VenueStaffGuard)
  @MinVenueRole(VenueStaffRole.MANAGER)
  async funnelExportCsv(
    @Res({ passthrough: true }) res: Response,
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Query('days') daysRaw: string | undefined,
    @Query('from') fromYmd?: string,
    @Query('to') toYmd?: string,
  ) {
    const days =
      daysRaw !== undefined && daysRaw !== ''
        ? Number.parseInt(daysRaw, 10)
        : 30;
    const safe = Number.isFinite(days) ? days : 30;
    const csv = await this.analytics.buildFunnelEventsCsv(venueId, {
      days: safe,
      from: fromYmd?.trim() || undefined,
      to: toYmd?.trim() || undefined,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="cafe-social-funnel-events.csv"',
    );
    return csv;
  }

  @Get('venues/:venueId/analytics/geofence-dwell')
  @UseGuards(VenueStaffGuard)
  @MinVenueRole(VenueStaffRole.MANAGER)
  venueGeofenceDwell(
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Query('days') daysRaw: string | undefined,
    @Query('from') fromYmd?: string,
    @Query('to') toYmd?: string,
  ) {
    const days =
      daysRaw !== undefined && daysRaw !== ''
        ? Number.parseInt(daysRaw, 10)
        : 30;
    const safe = Number.isFinite(days) ? days : 30;
    return this.analytics.getVenueGeofenceDwellSummary(venueId, {
      days: safe,
      from: fromYmd?.trim() || undefined,
      to: toYmd?.trim() || undefined,
    });
  }

  @Get('venues/:venueId/analytics/geofence-events.csv')
  @UseGuards(VenueStaffGuard)
  @MinVenueRole(VenueStaffRole.MANAGER)
  async geofenceEventsExportCsv(
    @Res({ passthrough: true }) res: Response,
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Query('days') daysRaw: string | undefined,
    @Query('from') fromYmd?: string,
    @Query('to') toYmd?: string,
  ) {
    const days =
      daysRaw !== undefined && daysRaw !== ''
        ? Number.parseInt(daysRaw, 10)
        : 30;
    const safe = Number.isFinite(days) ? days : 30;
    const csv = await this.analytics.buildGeofenceEventsCsv(venueId, {
      days: safe,
      from: fromYmd?.trim() || undefined,
      to: toYmd?.trim() || undefined,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="cafe-social-geofence-events.csv"',
    );
    return csv;
  }

  @Get('venues/:venueId/moderation/staff-summary')
  @UseGuards(VenueStaffGuard)
  @MinVenueRole(VenueStaffRole.EMPLOYEE)
  staffModerationSummary(@Param('venueId', new ParseUUIDPipe()) venueId: string) {
    return this.venueModeration.staffSummaryForVenue(venueId);
  }

  @Get('venues/:venueId/moderation/ban-appeals')
  @UseGuards(VenueStaffGuard)
  @MinVenueRole(VenueStaffRole.EMPLOYEE)
  listBanAppeals(
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Query('includeResolved') includeResolvedRaw?: string,
    @Query('status') statusRaw?: string,
    @Query('from') fromYmd?: string,
    @Query('to') toYmd?: string,
  ) {
    const includeResolved =
      includeResolvedRaw === '1' || includeResolvedRaw?.toLowerCase() === 'true';
    const statusAll =
      includeResolved ||
      statusRaw?.toLowerCase() === 'all' ||
      statusRaw?.toLowerCase() === 'history';
    let createdFrom: Date | undefined;
    let createdTo: Date | undefined;
    if (fromYmd?.trim()) {
      const d = parseYmdUtc(fromYmd.trim());
      if (d) createdFrom = d;
    }
    if (toYmd?.trim()) {
      const d = parseYmdUtc(toYmd.trim());
      if (d) {
        createdTo = new Date(d);
        createdTo.setUTCHours(23, 59, 59, 999);
      }
    }
    return this.venueModeration.listBanAppealsForVenue(venueId, {
      includeResolved: statusAll,
      status: statusAll ? 'all' : 'open',
      createdFrom,
      createdTo,
    });
  }

  @Get('venues/:venueId/moderation/audit-log')
  @UseGuards(VenueStaffGuard)
  @MinVenueRole(VenueStaffRole.MANAGER)
  moderationAuditLog(
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Query('limit') limitRaw?: string,
  ) {
    const n =
      limitRaw !== undefined && limitRaw !== ''
        ? Number.parseInt(limitRaw, 10)
        : 80;
    const safe = Number.isFinite(n) ? n : 80;
    return this.venueModeration.listModerationAudit(venueId, safe);
  }

  @Post('venues/:venueId/moderation/ban-appeals/:appealId/dismiss')
  @UseGuards(VenueStaffGuard, PartnerVenueWriteGuard)
  @MinVenueRole(VenueStaffRole.MANAGER)
  async dismissBanAppeal(
    @CurrentUser() user: unknown,
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Param('appealId', new ParseUUIDPipe()) appealId: string,
  ) {
    const staffId = await this.staffPlayerId(user);
    await this.venueModeration.dismissBanAppeal(appealId, venueId, staffId);
    return { ok: true as const };
  }

  @Post('venues/:venueId/moderation/ban-appeals/:appealId/resolve')
  @UseGuards(VenueStaffGuard, PartnerVenueWriteGuard)
  @MinVenueRole(VenueStaffRole.MANAGER)
  async resolveBanAppeal(
    @CurrentUser() user: unknown,
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Param('appealId', new ParseUUIDPipe()) appealId: string,
    @Body() body: ResolveBanAppealDto,
  ) {
    const staffId = await this.staffPlayerId(user);
    await this.venueModeration.resolveBanAppeal({
      appealId,
      venueId,
      staffPlayerId: staffId,
      outcome: body.outcome,
      staffNote: body.staffNote,
      staffMessageToPlayer: body.staffMessageToPlayer,
      notifyPlayer: body.notifyPlayer,
    });
    return { ok: true as const };
  }

  @Get('venues/:venueId/moderation/reports')
  @UseGuards(VenueStaffGuard)
  @MinVenueRole(VenueStaffRole.EMPLOYEE)
  listPlayerReports(@Param('venueId', new ParseUUIDPipe()) venueId: string) {
    return this.venueModeration.listReportsForVenue(venueId);
  }

  @Get('venues/:venueId/moderation/bans')
  @UseGuards(VenueStaffGuard)
  @MinVenueRole(VenueStaffRole.EMPLOYEE)
  listVenueBans(@Param('venueId', new ParseUUIDPipe()) venueId: string) {
    return this.venueModeration.listBansForVenue(venueId);
  }

  @Post('venues/:venueId/moderation/bans')
  @UseGuards(VenueStaffGuard, PartnerVenueWriteGuard)
  @MinVenueRole(VenueStaffRole.MANAGER)
  async createVenueBan(
    @CurrentUser() user: unknown,
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Body() body: BanPlayerDto,
  ) {
    const staffId = await this.staffPlayerId(user);
    await this.venueModeration.banPlayer({
      venueId,
      targetPlayerId: body.playerId,
      staffPlayerId: staffId,
      reason: body.reason,
    });
    return { ok: true as const };
  }

  @Delete('venues/:venueId/moderation/bans/:playerId')
  @UseGuards(VenueStaffGuard, PartnerVenueWriteGuard)
  @MinVenueRole(VenueStaffRole.MANAGER)
  async removeVenueBan(
    @CurrentUser() user: unknown,
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Param('playerId', new ParseUUIDPipe()) playerId: string,
  ) {
    const staffId = await this.staffPlayerId(user);
    await this.venueModeration.removeBan(venueId, playerId, staffId);
    return { ok: true as const };
  }

  @Post('venues/:venueId/moderation/reports/:reportId/dismiss')
  @UseGuards(VenueStaffGuard, PartnerVenueWriteGuard)
  @MinVenueRole(VenueStaffRole.MANAGER)
  async dismissPlayerReport(
    @CurrentUser() user: unknown,
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Param('reportId', new ParseUUIDPipe()) reportId: string,
    @Body() body: DismissModerationReportDto,
  ) {
    const staffId = await this.staffPlayerId(user);
    await this.venueModeration.dismissReport(reportId, venueId, {
      staffPlayerId: staffId,
      dismissalNoteToReporter: body.dismissalNoteToReporter,
    });
    return { ok: true as const };
  }

  @Get('venues/:venueId/staff-invites')
  @UseGuards(VenueStaffGuard)
  @MinVenueRole(VenueStaffRole.MANAGER)
  listStaffInvites(@Param('venueId', new ParseUUIDPipe()) venueId: string) {
    return this.staffInvites.listForVenue(venueId);
  }

  @Post('venues/:venueId/staff-invites')
  @UseGuards(VenueStaffGuard, PartnerVenueWriteGuard)
  @MinVenueRole(VenueStaffRole.MANAGER)
  async createStaffInvite(
    @CurrentUser() user: unknown,
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Body() body: CreateStaffInviteDto,
    @Req() req: Request & { venueStaffMembership?: VenueStaff },
  ) {
    const membership = req.venueStaffMembership;
    if (!membership) {
      throw new UnauthorizedException('Staff context missing');
    }
    const playerId = await this.staffPlayerId(user);
    return this.staffInvites.createInvite({
      venueId,
      email: body.email,
      role: body.role,
      invitedByPlayerId: playerId,
      inviterVenueRole: membership.role,
    });
  }

  @Post('venues/:venueId/staff-invites/:inviteId/cancel')
  @UseGuards(VenueStaffGuard, PartnerVenueWriteGuard)
  @MinVenueRole(VenueStaffRole.MANAGER)
  async cancelStaffInvite(
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Param('inviteId', new ParseUUIDPipe()) inviteId: string,
    @Req() req: Request & { venueStaffMembership?: VenueStaff },
  ) {
    const membership = req.venueStaffMembership;
    if (!membership) {
      throw new UnauthorizedException('Staff context missing');
    }
    await this.staffInvites.cancelInvite({
      venueId,
      inviteId,
      actorRole: membership.role,
    });
    return { ok: true };
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
  @UseGuards(VenueStaffGuard, PartnerVenueWriteGuard)
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
  @UseGuards(VenueStaffGuard, PartnerVenueWriteGuard)
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
  @UseGuards(VenueStaffGuard, PartnerVenueWriteGuard)
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
  @UseGuards(VenueStaffGuard, PartnerVenueWriteGuard)
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
  @UseGuards(VenueStaffGuard, PartnerVenueWriteGuard)
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
