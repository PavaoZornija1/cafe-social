import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VenueService } from '../venue/venue.service';
import { VenueModerationService } from '../venue/venue-moderation.service';
import { VenueFunnelService } from '../venue/venue-funnel.service';
import { staffVerificationCodeFromRedemptionId } from '../lib/redemption-staff-code';

export type VenuePerkPublicTeaserDto = {
  id: string;
  title: string;
  subtitle: string | null;
  body: string | null;
  requiresQrUnlock: boolean;
  fullyRedeemed: boolean;
  redeemedByYou: boolean;
};

export type VenueRedeemableRewardDto = {
  redemptionId: string;
  perkId: string;
  perkCode: string;
  perkTitle: string;
  perkSubtitle: string | null;
  status: string;
  issuedAt: string;
  redeemedAt: string | null;
  expiresAt: string;
  staffVerificationCode: string;
  qrPayload: string;
};

@Injectable()
export class VenuePerkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly venues: VenueService,
    private readonly moderation: VenueModerationService,
    private readonly funnel: VenueFunnelService,
  ) {}

  /** Active perks for a venue (no secret codes). Used by the guest app. */
  async listPublicTeasersForVenue(
    venueId: string,
    playerId: string,
  ): Promise<VenuePerkPublicTeaserDto[]> {
    const venueMeta = await this.venues.findOne(venueId);
    if (venueMeta.locked) return [];

    const now = new Date();
    const rows = await this.prisma.venuePerk.findMany({
      where: { venueId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        subtitle: true,
        body: true,
        requiresQrUnlock: true,
        activeFrom: true,
        activeTo: true,
        maxRedemptions: true,
        redemptionCount: true,
        redemptions: {
          where: { playerId },
          select: { id: true },
          take: 1,
        },
      },
    });

    return rows
      .filter((p) => {
        if (p.activeFrom && now < p.activeFrom) return false;
        if (p.activeTo && now > p.activeTo) return false;
        return true;
      })
      .map((p) => ({
        id: p.id,
        title: p.title,
        subtitle: p.subtitle,
        body: p.body,
        requiresQrUnlock: p.requiresQrUnlock,
        fullyRedeemed:
          p.maxRedemptions != null && p.redemptionCount >= p.maxRedemptions,
        redeemedByYou: p.redemptions.length > 0,
      }));
  }

  normalizeCode(raw: string): string {
    return raw.trim().toUpperCase().replace(/\s+/g, '');
  }

  private buildStaffQrPayload(redemptionId: string) {
    return JSON.stringify({
      kind: 'reward_claim',
      redemptionId,
      staffVerificationCode: staffVerificationCodeFromRedemptionId(redemptionId),
    });
  }

  async listMyRewardsForVenue(
    venueId: string,
    playerId: string,
  ): Promise<VenueRedeemableRewardDto[]> {
    const rows = await this.prisma.venuePerkRedemption.findMany({
      where: { venueId, playerId },
      include: {
        perk: { select: { id: true, code: true, title: true, subtitle: true } },
      },
      orderBy: { redeemedAt: 'desc' },
      take: 200,
    });
    const nowMs = Date.now();
    return rows.map((r) => {
      const computedStatus =
        r.status === 'REDEEMABLE' && r.expiresAt.getTime() <= nowMs
          ? 'EXPIRED'
          : r.status;
      return {
      redemptionId: r.id,
      perkId: r.perk.id,
      perkCode: r.perk.code,
      perkTitle: r.perk.title,
      perkSubtitle: r.perk.subtitle,
      status: computedStatus,
      issuedAt: r.redeemedAt.toISOString(),
      redeemedAt: r.staffAcknowledgedAt?.toISOString() ?? null,
      expiresAt: r.expiresAt.toISOString(),
      staffVerificationCode: staffVerificationCodeFromRedemptionId(r.id),
      qrPayload: this.buildStaffQrPayload(r.id),
      };
    });
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
    await this.venues.assertCoordinatesAllowedForGuestVenue(
      params.venueId,
      params.latitude!,
      params.longitude!,
    );

    await this.moderation.assertNotBanned(params.venueId, params.playerId);

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
          status: 'REDEEMABLE',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      await tx.venuePerk.update({
        where: { id: perk.id },
        data: { redemptionCount: { increment: 1 } },
      });

      const out = {
        redemptionId: redemption.id,
        staffVerificationCode: staffVerificationCodeFromRedemptionId(redemption.id),
        title: perk.title,
        subtitle: perk.subtitle,
        body: perk.body,
        issuedAt: redemption.issuedAt.toISOString(),
        redeemedAt: null,
        expiresAt: redemption.expiresAt.toISOString(),
        status: redemption.status,
        qrPayload: this.buildStaffQrPayload(redemption.id),
      };
      return out;
    }).then((out) => {
      this.funnel.safeLog({
        venueId: params.venueId,
        playerId: params.playerId,
        kind: 'redeem',
      });
      return out;
    });
  }
}
