import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VenueService } from '../venue/venue.service';
import { staffVerificationCodeFromRedemptionId } from '../lib/redemption-staff-code';

@Injectable()
export class VenuePerkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly venues: VenueService,
  ) {}

  normalizeCode(raw: string): string {
    return raw.trim().toUpperCase().replace(/\s+/g, '');
  }

  async redeem(params: {
    playerId: string;
    venueId: string;
    code: string;
    latitude?: number;
    longitude?: number;
  }) {
    const code = this.normalizeCode(params.code);
    if (!code) throw new BadRequestException('code is required');

    const hasCoords =
      typeof params.latitude === 'number' &&
      typeof params.longitude === 'number' &&
      Number.isFinite(params.latitude) &&
      Number.isFinite(params.longitude);
    if (!hasCoords) {
      throw new BadRequestException('Location (lat/lng) is required to redeem at this venue');
    }
    const at = await this.venues.findVenueAtCoordinates(params.latitude!, params.longitude!);
    if (!at || at.id !== params.venueId) {
      throw new BadRequestException('You must be at this venue to redeem this perk');
    }

    const perk = await this.prisma.venuePerk.findFirst({
      where: { code, venueId: params.venueId },
    });
    if (!perk) throw new NotFoundException('Perk code not found for this venue');

    const now = new Date();
    if (perk.activeFrom && now < perk.activeFrom) {
      throw new BadRequestException('This perk is not active yet');
    }
    if (perk.activeTo && now > perk.activeTo) {
      throw new BadRequestException('This perk has expired');
    }
    if (perk.maxRedemptions != null && perk.redemptionCount >= perk.maxRedemptions) {
      throw new BadRequestException('This perk is fully redeemed');
    }

    if (perk.requiresQrUnlock) {
      const hasQr = await this.prisma.playerVenue.findUnique({
        where: {
          playerId_venueId: { playerId: params.playerId, venueId: params.venueId },
        },
      });
      if (!hasQr) {
        throw new BadRequestException(
          'This perk requires you to have linked this venue first (e.g. invite or venue check-in)',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.venuePerkRedemption.findUnique({
        where: {
          perkId_playerId: { perkId: perk.id, playerId: params.playerId },
        },
      });
      if (existing) {
        throw new ConflictException('You already redeemed this perk');
      }

      const refreshed = await tx.venuePerk.findUnique({ where: { id: perk.id } });
      if (!refreshed) throw new NotFoundException('Perk not found');
      if (
        refreshed.maxRedemptions != null &&
        refreshed.redemptionCount >= refreshed.maxRedemptions
      ) {
        throw new BadRequestException('This perk is fully redeemed');
      }

      const redemption = await tx.venuePerkRedemption.create({
        data: {
          perkId: perk.id,
          playerId: params.playerId,
          venueId: params.venueId,
        },
      });

      await tx.venuePerk.update({
        where: { id: perk.id },
        data: { redemptionCount: { increment: 1 } },
      });

      return {
        redemptionId: redemption.id,
        staffVerificationCode: staffVerificationCodeFromRedemptionId(redemption.id),
        title: perk.title,
        subtitle: perk.subtitle,
        body: perk.body,
        redeemedAt: redemption.redeemedAt.toISOString(),
      };
    });
  }
}
