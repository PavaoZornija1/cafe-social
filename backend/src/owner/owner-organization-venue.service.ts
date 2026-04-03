import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  VenueOrganizationKind,
  VenueStaffRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVenueDto } from '../venue/dto/create-venue.dto';
import { isPayingPartnerOrg } from './partner-access.constants';

@Injectable()
export class OwnerOrganizationVenueService {
  constructor(private readonly prisma: PrismaService) {}

  async createVenueUnderOrganization(
    organizationId: string,
    playerId: string,
    dto: CreateVenueDto,
  ) {
    const org = await this.prisma.venueOrganization.findUnique({
      where: { id: organizationId },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const ownerOk = await this.prisma.venueStaff.findFirst({
      where: {
        playerId,
        role: VenueStaffRole.OWNER,
        venue: { organizationId },
      },
      select: { id: true },
    });
    if (!ownerOk) {
      throw new ForbiddenException(
        'Only an owner of this organization can add venues.',
      );
    }

    const venueCount = await this.prisma.venue.count({
      where: { organizationId },
    });

    const paying = isPayingPartnerOrg(org.platformBillingStatus);
    const trialEnd = org.trialEndsAt;
    const trialExpired =
      trialEnd !== null && trialEnd.getTime() <= Date.now() && !paying;

    if (trialExpired) {
      throw new ForbiddenException(
        'Trial has ended. Subscribe to add locations and restore access.',
      );
    }

    const inTrial =
      trialEnd !== null && trialEnd.getTime() > Date.now() && !paying;
    if (inTrial && venueCount >= 1) {
      throw new BadRequestException(
        'During your trial you can have one location. Upgrade to add more.',
      );
    }

    if (
      org.locationKind === VenueOrganizationKind.SINGLE_LOCATION &&
      venueCount >= 1
    ) {
      throw new BadRequestException(
        'This organization is limited to one location. Contact sales to switch to multi-location.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const venue = await tx.venue.create({
        data: {
          name: dto.name,
          address: dto.address,
          latitude: dto.latitude,
          longitude: dto.longitude,
          radiusMeters: dto.radiusMeters,
          organizationId,
          ...(dto.city !== undefined && { city: dto.city }),
          ...(dto.country !== undefined && { country: dto.country }),
          ...(dto.region !== undefined && { region: dto.region }),
          ...(dto.isPremium !== undefined && { isPremium: dto.isPremium }),
          ...(dto.menuUrl !== undefined && { menuUrl: dto.menuUrl }),
          ...(dto.orderingUrl !== undefined && { orderingUrl: dto.orderingUrl }),
          ...(dto.orderNudgeTitle !== undefined && {
            orderNudgeTitle: dto.orderNudgeTitle,
          }),
          ...(dto.orderNudgeBody !== undefined && {
            orderNudgeBody: dto.orderNudgeBody,
          }),
          ...(dto.featuredOfferTitle !== undefined && {
            featuredOfferTitle: dto.featuredOfferTitle,
          }),
          ...(dto.featuredOfferBody !== undefined && {
            featuredOfferBody: dto.featuredOfferBody,
          }),
          ...(dto.featuredOfferEndsAt !== undefined && {
            featuredOfferEndsAt: dto.featuredOfferEndsAt
              ? new Date(dto.featuredOfferEndsAt)
              : null,
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

      return venue;
    });
  }
}
