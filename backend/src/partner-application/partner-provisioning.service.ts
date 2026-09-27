import { BadRequestException, Injectable } from '@nestjs/common';
import {
  PlatformRole,
  Prisma,
  VenueOrganizationKind,
  VenueStaffRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  assertPinInsidePolygon,
  parseVenueGeofencePolygonInput,
} from '../venue/geofence';
import {
  PARTNER_TRIAL_DAYS,
} from '../owner/partner-access.constants';

export type PartnerProvisionInput = {
  locationKind: VenueOrganizationKind;
  organizationName: string;
  venueName: string;
  latitude: number;
  longitude: number;
  geofencePolygon: Record<string, unknown>;
  address?: string;
  city?: string;
  country?: string;
  analyticsTimeZone?: string;
};

@Injectable()
export class PartnerProvisioningService {
  constructor(private readonly prisma: PrismaService) {}

  async provisionPartnerOrgAndVenue(
    playerId: string,
    dto: PartnerProvisionInput,
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

    const polygon = parseVenueGeofencePolygonInput(dto.geofencePolygon);
    assertPinInsidePolygon(dto.latitude, dto.longitude, polygon);

    const now = new Date();
    const trialEndsAt = new Date(
      now.getTime() + PARTNER_TRIAL_DAYS * 24 * 60 * 60 * 1000,
    );

    return this.prisma.$transaction(async (tx) => {
      const org = await tx.venueOrganization.create({
        data: {
          name: dto.organizationName.trim(),
          locationKind: dto.locationKind,
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
          ...(dto.address !== undefined && {
            address: dto.address.trim() || null,
          }),
          ...(dto.city !== undefined && { city: dto.city.trim() || null }),
          ...(dto.country !== undefined && {
            country: dto.country.trim() || null,
          }),
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
