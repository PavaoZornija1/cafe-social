import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  PlatformRole,
  Prisma,
  VenueOrganizationKind,
  VenueStaffRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PartnerOnboardingDto } from './dto/partner-onboarding.dto';
import {
  assertPinInsidePolygon,
  parseVenueGeofencePolygonInput,
} from '../venue/geofence';
import {
  MAX_SELF_SERVE_ORGS_PER_24H,
  PARTNER_TRIAL_DAYS,
} from './partner-access.constants';

@Injectable()
export class PartnerOnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async bootstrapSelfServeOrgAndVenue(
    playerId: string,
    dto: PartnerOnboardingDto,
  ) {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      select: {
        id: true,
        platformRole: true,
        venueStaff: { select: { id: true }, take: 1 },
      },
    });
    if (!player) {
      throw new BadRequestException('Player not found');
    }
    if (player.platformRole === PlatformRole.SUPER_ADMIN) {
      throw new BadRequestException(
        'Super admins use the CMS to create organizations and venues.',
      );
    }
    if (player.venueStaff.length > 0) {
      throw new BadRequestException(
        'You already have venue access. Open your dashboard instead.',
      );
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCount = await this.prisma.venueOrganization.count({
      where: {
        selfServeCreatedByPlayerId: playerId,
        createdAt: { gte: since },
      },
    });
    if (recentCount >= MAX_SELF_SERVE_ORGS_PER_24H) {
      throw new ForbiddenException(
        'Too many organizations created recently. Try again tomorrow or contact sales.',
      );
    }

    const now = new Date();
    const trialEndsAt = new Date(
      now.getTime() + PARTNER_TRIAL_DAYS * 24 * 60 * 60 * 1000,
    );

    const polygon = parseVenueGeofencePolygonInput(dto.geofencePolygon);
    assertPinInsidePolygon(dto.latitude, dto.longitude, polygon);

    return this.prisma.$transaction(async (tx) => {
      const org = await tx.venueOrganization.create({
        data: {
          name: dto.organizationName.trim(),
          locationKind: dto.locationKind as VenueOrganizationKind,
          trialStartedAt: now,
          trialEndsAt,
          selfServeCreatedByPlayerId: playerId,
          platformBillingStatus: 'NONE',
        },
      });

      const venue = await tx.venue.create({
        data: {
          name: dto.venueName.trim(),
          latitude: dto.latitude,
          longitude: dto.longitude,
          geofencePolygon: polygon as unknown as Prisma.InputJsonValue,
          organizationId: org.id,
          ...(dto.address !== undefined && { address: dto.address.trim() || null }),
          ...(dto.city !== undefined && { city: dto.city.trim() || null }),
          ...(dto.country !== undefined && { country: dto.country.trim() || null }),
          ...(dto.analyticsTimeZone !== undefined && {
            analyticsTimeZone: dto.analyticsTimeZone?.trim() || null,
          }),
        },
      });

      await tx.venueStaff.create({
        data: {
          venueId: venue.id,
          playerId,
          role: VenueStaffRole.OWNER,
        },
      });

      return {
        organizationId: org.id,
        venueId: venue.id,
        trialEndsAt: trialEndsAt.toISOString(),
        locationKind: org.locationKind,
      };
    });
  }
}
