import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { staffVerificationCodeFromRedemptionId } from '../lib/redemption-staff-code';

@Injectable()
export class VenuePerkService {
  constructor(private readonly prisma: PrismaService) {}

  normalizeCode(raw: string): string {
    return raw.trim().toUpperCase().replace(/\s+/g, '');
  }

  async redeem(params: {
    playerId: string;
    venueId: string;
    code: string;
    detectedVenueId?: string | null;
  }) {
    const code = this.normalizeCode(params.code);
    if (!code) throw new BadRequestException('code is required');

    const presenceVenueId =
      params.detectedVenueId ??
      (
        await this.prisma.venue.findFirst({
          where: { isPremium: false },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        })
      )?.id ??
      null;

    if (!presenceVenueId || presenceVenueId !== params.venueId) {
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
        throw new BadRequestException('Scan the venue QR to unlock this perk');
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
