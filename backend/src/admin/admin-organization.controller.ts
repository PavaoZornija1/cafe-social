import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { VenueStaffRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformSuperAdminGuard } from '../auth/platform-super-admin.guard';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVenueOrganizationDto } from './dto/create-venue-organization.dto';
import { Prisma } from '@prisma/client';
import {
  assertPinInsidePolygon,
  parseVenueGeofencePolygonInput,
} from '../venue/geofence';
import { CreateVenueUnderOrgDto } from './dto/create-venue-under-org.dto';
import { PatchVenueOrganizationDto } from './dto/patch-venue-organization.dto';
import { OrgVenueMembershipDto } from './dto/org-venue-membership.dto';
import { StripePartnerCheckoutDto } from './dto/stripe-partner-checkout.dto';
import { StripePartnerBillingService } from '../stripe/stripe-partner-billing.service';

/**
 * Platform CMS for organization billing and structure — super-admin JWT only.
 * Not subject to partner self-serve trial/venue-lock guards on `/owner/*`.
 */
@Controller('admin/organizations')
@UseGuards(JwtAuthGuard, PlatformSuperAdminGuard)
export class AdminOrganizationController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripePartner: StripePartnerBillingService,
  ) {}

  @Get()
  list() {
    return this.prisma.venueOrganization.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { venues: true } },
      },
    });
  }

  /**
   * Searchable, paginated org list for CMS dropdowns (super-admin).
   */
  @Get('picker')
  async picker(
    @Query('search') search?: string,
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const page = Math.max(1, parseInt(pageRaw ?? '1', 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(limitRaw ?? '20', 10) || 20));
    const q = search?.trim() ?? '';
    const where: Prisma.VenueOrganizationWhereInput = q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { slug: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {};

    const [total, items] = await Promise.all([
      this.prisma.venueOrganization.count({ where }),
      this.prisma.venueOrganization.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        select: { id: true, name: true },
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      hasMore: page * limit < total,
    };
  }

  @Get(':id')
  async get(@Param('id', new ParseUUIDPipe()) id: string) {
    const row = await this.prisma.venueOrganization.findUnique({
      where: { id },
      include: {
        venues: {
          select: {
            id: true,
            name: true,
            locked: true,
            city: true,
            country: true,
            address: true,
          },
          orderBy: { name: 'asc' },
        },
        selfServeCreatedBy: {
          select: { id: true, email: true, username: true },
        },
      },
    });
    if (!row) throw new NotFoundException('Organization not found');

    const venueIds = row.venues.map((v) => v.id);
    const lockedVenueCount = row.venues.filter((v) => v.locked).length;

    let perksCount = 0;
    let totalRedemptions = 0;
    if (venueIds.length > 0) {
      [perksCount, totalRedemptions] = await Promise.all([
        this.prisma.venuePerk.count({ where: { venueId: { in: venueIds } } }),
        this.prisma.venuePerkRedemption.count({
          where: { perk: { venueId: { in: venueIds } } },
        }),
      ]);
    }

    const ownerRows =
      venueIds.length > 0
        ? await this.prisma.venueStaff.findMany({
            where: {
              venueId: { in: venueIds },
              role: VenueStaffRole.OWNER,
            },
            select: {
              playerId: true,
              player: { select: { email: true, username: true } },
            },
          })
        : [];

    const seenOwner = new Set<string>();
    const ownerContacts = [];
    for (const s of ownerRows) {
      if (seenOwner.has(s.playerId)) continue;
      seenOwner.add(s.playerId);
      ownerContacts.push({
        playerId: s.playerId,
        email: s.player.email,
        username: s.player.username,
      });
    }

    const { selfServeCreatedBy, ...rest } = row;

    return {
      ...rest,
      stats: {
        venueCount: row.venues.length,
        lockedVenueCount,
        perksCount,
        totalRedemptions,
      },
      ownerContacts,
      selfServeCreatedBy,
    };
  }

  @Post(':id/venues')
  async createVenueForOrg(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: CreateVenueUnderOrgDto,
  ) {
    await this.prisma.venueOrganization.findUniqueOrThrow({ where: { id } });
    const polygon = parseVenueGeofencePolygonInput(body.geofencePolygon);
    assertPinInsidePolygon(body.latitude, body.longitude, polygon);

    return this.prisma.venue.create({
      data: {
        name: body.name.trim(),
        latitude: body.latitude,
        longitude: body.longitude,
        geofencePolygon: polygon as unknown as Prisma.InputJsonValue,
        organizationId: id,
        ...(body.address?.trim() && { address: body.address.trim() }),
        ...(body.city?.trim() && { city: body.city.trim() }),
        ...(body.country?.trim() && { country: body.country.trim() }),
      },
    });
  }

  @Post()
  create(@Body() body: CreateVenueOrganizationDto) {
    return this.prisma.venueOrganization.create({
      data: {
        name: body.name.trim(),
        ...(body.locationKind !== undefined && {
          locationKind: body.locationKind,
        }),
        slug: body.slug?.trim() || null,
        platformBillingPlan: body.platformBillingPlan?.trim() || null,
        platformBillingStatus: body.platformBillingStatus?.trim() || 'NONE',
        platformBillingRenewsAt: body.platformBillingRenewsAt
          ? new Date(body.platformBillingRenewsAt)
          : null,
        stripeCustomerId: body.stripeCustomerId?.trim() || null,
        billingPortalUrl: body.billingPortalUrl?.trim() || null,
      },
    });
  }

  @Post(':id/stripe/checkout-session')
  stripeCheckout(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: StripePartnerCheckoutDto,
  ) {
    return this.stripePartner.createPartnerCheckoutSession(id, body.priceId);
  }

  @Post(':id/stripe/billing-portal')
  stripeBillingPortal(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.stripePartner.createPartnerBillingPortalSession(id);
  }

  @Patch(':id/venues')
  async patchVenueMembership(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: OrgVenueMembershipDto,
  ) {
    await this.prisma.venueOrganization.findUniqueOrThrow({ where: { id } });
    const attach = body.attachVenueIds ?? [];
    const detach = body.detachVenueIds ?? [];
    await this.prisma.$transaction(async (tx) => {
      if (attach.length > 0) {
        await tx.venue.updateMany({
          where: { id: { in: attach } },
          data: { organizationId: id },
        });
      }
      if (detach.length > 0) {
        await tx.venue.updateMany({
          where: { id: { in: detach }, organizationId: id },
          data: { organizationId: null },
        });
      }
    });
    return this.prisma.venueOrganization.findUnique({
      where: { id },
      include: {
        venues: {
          select: {
            id: true,
            name: true,
            locked: true,
            city: true,
            country: true,
            address: true,
          },
          orderBy: { name: 'asc' },
        },
      },
    });
  }

  @Patch(':id')
  async patch(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: PatchVenueOrganizationDto,
  ) {
    await this.prisma.venueOrganization.findUniqueOrThrow({ where: { id } });
    return this.prisma.venueOrganization.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.slug !== undefined && { slug: body.slug?.trim() || null }),
        ...(body.platformBillingPlan !== undefined && {
          platformBillingPlan: body.platformBillingPlan?.trim() || null,
        }),
        ...(body.platformBillingStatus !== undefined && {
          platformBillingStatus: body.platformBillingStatus?.trim() || undefined,
        }),
        ...(body.platformBillingRenewsAt !== undefined && {
          platformBillingRenewsAt: body.platformBillingRenewsAt
            ? new Date(body.platformBillingRenewsAt)
            : null,
        }),
        ...(body.stripeCustomerId !== undefined && {
          stripeCustomerId: body.stripeCustomerId?.trim() || null,
        }),
        ...(body.billingPortalUrl !== undefined && {
          billingPortalUrl: body.billingPortalUrl?.trim() || null,
        }),
      },
    });
  }

  @Delete(':id')
  async remove(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.prisma.venueOrganization.delete({ where: { id } });
    return { ok: true };
  }
}
