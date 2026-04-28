import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VenueModerationService } from '../venue/venue-moderation.service';
import { VenueFunnelService } from '../venue/venue-funnel.service';

export type ChallengePerkGrantResult =
  | { ok: true; redemptionId: string; grantId: string }
  | {
      ok: false;
      reason: 'already_issued' | 'not_found' | 'perk_inactive' | 'sold_out' | 'requires_membership';
    };

@Injectable()
export class PlayerRewardGrantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: VenueModerationService,
    private readonly funnel: VenueFunnelService,
  ) {}

  challengePerkIdempotencyKey(params: {
    challengeId: string;
    playerId: string;
    resetsWeekly: boolean;
    weekKey?: string;
  }): string {
    const { challengeId, playerId, resetsWeekly, weekKey } = params;
    if (resetsWeekly && weekKey) {
      return `challenge_perk:${challengeId}:${playerId}:week:${weekKey}`;
    }
    return `challenge_perk:${challengeId}:${playerId}`;
  }

  /**
   * Idempotent orchestrated perk grant for challenge completion.
   * Creates `PlayerRewardGrant` + linked `VenuePerkRedemption` (staff QR unchanged).
   */
  async tryIssueChallengePerkGrant(params: {
    playerId: string;
    venueId: string;
    challengeId: string;
    perkId: string;
    resetsWeekly: boolean;
    weekKey?: string;
  }): Promise<ChallengePerkGrantResult> {
    const { playerId, venueId, challengeId, perkId, resetsWeekly, weekKey } = params;
    const idempotencyKey = this.challengePerkIdempotencyKey({
      challengeId,
      playerId,
      resetsWeekly,
      weekKey,
    });

    const existing = await this.prisma.playerRewardGrant.findUnique({
      where: { idempotencyKey },
      include: { redemption: { select: { id: true } } },
    });
    if (existing?.redemption) {
      return { ok: true, redemptionId: existing.redemption.id, grantId: existing.id };
    }
    if (existing && !existing.redemption) {
      // Orphan grant without redemption — treat as incomplete; could repair; skip duplicate issuance
      return { ok: false, reason: 'already_issued' };
    }

    await this.moderation.assertNotBanned(venueId, playerId);

    const perk = await this.prisma.venuePerk.findFirst({
      where: { id: perkId, venueId },
    });
    if (!perk) return { ok: false, reason: 'not_found' };

    const now = new Date();
    if (perk.activeFrom && now < perk.activeFrom) return { ok: false, reason: 'perk_inactive' };
    if (perk.activeTo && now > perk.activeTo) return { ok: false, reason: 'perk_inactive' };
    if (perk.maxRedemptions != null && perk.redemptionCount >= perk.maxRedemptions) {
      return { ok: false, reason: 'sold_out' };
    }

    if (perk.requiresQrUnlock) {
      const hasQr = await this.prisma.playerVenue.findUnique({
        where: {
          playerId_venueId: { playerId, venueId },
        },
      });
      if (!hasQr) return { ok: false, reason: 'requires_membership' };
    }

    try {
      const out = await this.prisma.$transaction(async (tx) => {
        const dup = await tx.playerRewardGrant.findUnique({
          where: { idempotencyKey },
          include: { redemption: { select: { id: true } } },
        });
        if (dup?.redemption) {
          return { grantId: dup.id, redemptionId: dup.redemption.id };
        }

        const refreshed = await tx.venuePerk.findUnique({ where: { id: perk.id } });
        if (!refreshed) throw new Error('perk_missing');
        if (
          refreshed.maxRedemptions != null &&
          refreshed.redemptionCount >= refreshed.maxRedemptions
        ) {
          throw new Error('sold_out');
        }

        const grant = await tx.playerRewardGrant.create({
          data: {
            playerId,
            venueId,
            kind: 'PERK',
            perkId: perk.id,
            sourceType: 'CHALLENGE',
            sourceId: challengeId,
            idempotencyKey,
            status: 'ACTIVE',
          },
        });

        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const redemption = await tx.venuePerkRedemption.create({
          data: {
            perkId: perk.id,
            playerId,
            venueId,
            status: 'REDEEMABLE',
            expiresAt,
            playerRewardGrantId: grant.id,
          },
        });

        await tx.venuePerk.update({
          where: { id: perk.id },
          data: { redemptionCount: { increment: 1 } },
        });

        return { grantId: grant.id, redemptionId: redemption.id };
      });

      this.funnel.safeLog({
        venueId,
        playerId,
        kind: 'redeem',
      });

      return { ok: true, redemptionId: out.redemptionId, grantId: out.grantId };
    } catch (e) {
      if (e instanceof Error && e.message === 'sold_out') {
        return { ok: false, reason: 'sold_out' };
      }
      const again = await this.prisma.playerRewardGrant.findUnique({
        where: { idempotencyKey },
        include: { redemption: { select: { id: true } } },
      });
      if (again?.redemption) {
        return { ok: true, redemptionId: again.redemption.id, grantId: again.id };
      }
      return { ok: false, reason: 'already_issued' };
    }
  }
}
