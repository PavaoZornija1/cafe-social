import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Player, Prisma } from '@prisma/client';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { UpdateMeSettingsDto } from './dto/update-me-settings.dto';
import { PlayerRepository } from './player.repository';
import { PlayerVenueStatsRepository } from '../stats/player-venue-stats.repository';
import { PrismaService } from '../prisma/prisma.service';
import { computeTierProgress } from '../lib/xp-tier.util';
import { utcDayKeyDaysAgo, utcWeekDayKeyRange } from '../lib/engagement-dates';
import { orderedPlayerPair } from '../common/player-pair';
import { staffVerificationCodeFromRedemptionId } from '../lib/redemption-staff-code';
import { buildStaffRewardQrPayload } from '../lib/reward-claim-qr';

@Injectable()
export class PlayerService {
  constructor(
    private readonly players: PlayerRepository,
    private readonly venueStats: PlayerVenueStatsRepository,
    private readonly prisma: PrismaService,
  ) {}

  async create(dto: CreatePlayerDto): Promise<Player> {
    const existing = await this.players.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Player with this email already exists');
    }
    return this.players.create({
      email: dto.email,
      username: dto.username,
    });
  }

  async findOrCreateByEmail(email: string): Promise<Player> {
    const existing = await this.players.findByEmail(email);
    if (existing) return existing;

    // Simple default username for new accounts.
    // Can be expanded later once we store more user profile data.
    const username = email.split('@')[0] || 'player';
    return this.players.create({
      email,
      username,
    });
  }

  findAll(): Promise<Player[]> {
    return this.players.findAll();
  }

  async findOne(id: string): Promise<Player> {
    const player = await this.players.findById(id);
    if (!player) {
      throw new NotFoundException(`Player ${id} not found`);
    }
    return player;
  }

  /** Resolve a player by display username (case-insensitive). */
  async findByUsernameInsensitive(username: string): Promise<Player | null> {
    return this.players.findByUsernameInsensitive(username);
  }

  async update(id: string, dto: UpdatePlayerDto): Promise<Player> {
    await this.findOne(id);
    return this.players.update(id, {
      ...(dto.email !== undefined && { email: dto.email }),
      ...(dto.username !== undefined && { username: dto.username }),
    });
  }

  /**
   * Lightweight profile stats for the home screen (MVP).
   */
  async getMeSummary(email: string): Promise<{
    playerId: string;
    xp: number;
    tier: string;
    nextTierXpThreshold: number | null;
    nextTierName: string | null;
    completedChallenges: number;
    venuesUnlocked: number;
    discoverable: boolean;
    totalPrivacy: boolean;
    partnerMarketingPush: boolean;
    matchActivityPush: boolean;
    subscriptionActive: boolean;
    onboardingPlayerCompletedAt: string | null;
    onboardingStaffCompletedAt: string | null;
  }> {
    const player = await this.findOrCreateByEmail(email);
    const { completedChallenges, venuesUnlocked } =
      await this.players.getSummary(player.id);

    const venueXpSum = await this.venueStats.sumVenueXpForPlayer(player.id);
    const totalXp = venueXpSum + player.bonusXp;
    const { tierLabel, nextTierXpThreshold, nextTierName } =
      computeTierProgress(totalXp);

    const subscription = await this.prisma.subscription.findUnique({
      where: { playerId: player.id },
    });
    const subscriptionActive = this.computeSubscriptionRowActive(subscription);

    return {
      playerId: player.id,
      xp: totalXp,
      tier: tierLabel,
      nextTierXpThreshold,
      nextTierName,
      completedChallenges,
      venuesUnlocked,
      discoverable: player.discoverable,
      totalPrivacy: player.totalPrivacy,
      partnerMarketingPush: player.partnerMarketingPush,
      matchActivityPush: player.matchActivityPush,
      subscriptionActive,
      onboardingPlayerCompletedAt: player.onboardingPlayerCompletedAt?.toISOString() ?? null,
      onboardingStaffCompletedAt: player.onboardingStaffCompletedAt?.toISOString() ?? null,
    };
  }

  private computeSubscriptionRowActive(
    subscription: { active: boolean; expiresAt: Date | null } | null,
  ): boolean {
    if (!subscription) return false;
    if (!subscription.active) return false;
    if (subscription.expiresAt && subscription.expiresAt.getTime() <= Date.now()) return false;
    return true;
  }

  async updateMeOnboarding(
    email: string,
    patch: { playerComplete?: boolean; staffComplete?: boolean },
  ): Promise<Player> {
    const p = await this.findOrCreateByEmail(email);
    const now = new Date();
    const data: Prisma.PlayerUpdateInput = {};
    if (patch.playerComplete === true && !p.onboardingPlayerCompletedAt) {
      data.onboardingPlayerCompletedAt = now;
    }
    if (patch.staffComplete === true) {
      if (!p.onboardingStaffCompletedAt) data.onboardingStaffCompletedAt = now;
      if (!p.onboardingPlayerCompletedAt) data.onboardingPlayerCompletedAt = now;
    }
    if (Object.keys(data).length === 0) return p;
    return this.players.update(p.id, data);
  }

  /** Visits & lightweight badges from `PlayerVenueVisitDay`. */
  async getMeEngagement(email: string): Promise<{
    visitsThisWeek: number;
    distinctVenuesVisitedLast30Days: number;
    badges: string[];
  }> {
    const player = await this.findOrCreateByEmail(email);
    const { start, end } = utcWeekDayKeyRange();
    const sinceMonth = utcDayKeyDaysAgo(30);

    const visitsThisWeek = await this.prisma.playerVenueVisitDay.count({
      where: {
        playerId: player.id,
        dayKey: { gte: start, lte: end },
      },
    });

    const venueGroups = await this.prisma.playerVenueVisitDay.groupBy({
      by: ['venueId'],
      where: { playerId: player.id, dayKey: { gte: sinceMonth } },
    });
    const distinctVenuesVisitedLast30Days = venueGroups.length;

    const badges: string[] = [];
    if (visitsThisWeek >= 3) badges.push('regular_this_week');
    if (distinctVenuesVisitedLast30Days >= 2) badges.push('venue_explorer');

    return { visitsThisWeek, distinctVenuesVisitedLast30Days, badges };
  }

  async listMyPerkRedemptions(email: string) {
    const player = await this.findOrCreateByEmail(email);
    const now = new Date();
    const horizon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.venuePerkRedemption.findMany({
      where: { playerId: player.id },
      orderBy: { issuedAt: 'desc' },
      include: {
        perk: {
          select: {
            title: true,
            subtitle: true,
            code: true,
            activeFrom: true,
            activeTo: true,
          },
        },
        venue: { select: { id: true, name: true } },
      },
      take: 80,
    });

    const items = rows.map((r) => {
      const voided = r.voidedAt != null;
      const perkActiveTo = r.expiresAt;
      const msToExpiry =
        !voided && perkActiveTo && perkActiveTo.getTime() > now.getTime()
          ? perkActiveTo.getTime() - now.getTime()
          : null;
      const daysUntilExpiry =
        msToExpiry != null ? Math.ceil(msToExpiry / (24 * 60 * 60 * 1000)) : null;
      const expiringSoon =
        !voided &&
        perkActiveTo != null &&
        perkActiveTo > now &&
        perkActiveTo <= horizon;
      const expired =
        !voided && perkActiveTo != null && perkActiveTo.getTime() <= now.getTime();
      return {
        id: r.id,
        redeemedAt: (r.redeemedAt ?? r.issuedAt).toISOString(),
        voided,
        venueId: r.venueId,
        venueName: r.venue.name,
        perkCode: r.perk.code,
        perkTitle: r.perk.title,
        perkSubtitle: r.perk.subtitle,
        perkActiveTo: perkActiveTo?.toISOString() ?? null,
        daysUntilExpiry,
        expiringSoon,
        expired,
      };
    });

    const activeWalletCount = items.filter((i) => !i.voided && !i.expired).length;

    return {
      wallet: {
        activeRedemptions: activeWalletCount,
      },
      expiringSoon: items.filter((i) => i.expiringSoon),
      items,
    };
  }

  /** Cross-venue staff QR claims (same shape as per-venue my-rewards + venue labels). */
  async listMyRewardClaimsHub(email: string) {
    const player = await this.findOrCreateByEmail(email);
    const nowMs = Date.now();
    const rows = await this.prisma.venuePerkRedemption.findMany({
      where: { playerId: player.id },
      orderBy: { issuedAt: 'desc' },
      take: 200,
      include: {
        perk: { select: { id: true, code: true, title: true, subtitle: true } },
        venue: { select: { id: true, name: true } },
      },
    });

    const items = rows.map((r) => {
      const voided = r.voidedAt != null;
      const computedStatus = voided
        ? 'VOIDED'
        : r.status === 'REDEEMABLE' && r.expiresAt.getTime() <= nowMs
          ? 'EXPIRED'
          : r.status;
      return {
        redemptionId: r.id,
        venueId: r.venueId,
        venueName: r.venue.name,
        perkId: r.perk.id,
        perkCode: r.perk.code,
        perkTitle: r.perk.title,
        perkSubtitle: r.perk.subtitle,
        status: computedStatus,
        issuedAt: r.issuedAt.toISOString(),
        redeemedAt: r.redeemedAt?.toISOString() ?? null,
        expiresAt: r.expiresAt.toISOString(),
        staffVerificationCode: staffVerificationCodeFromRedemptionId(r.id),
        qrPayload: buildStaffRewardQrPayload(r.id),
      };
    });

    const activeRedeemable = items.filter((i) => i.status === 'REDEEMABLE').length;

    return { wallet: { activeRedeemable }, items };
  }

  async updateMeSettings(email: string, dto: UpdateMeSettingsDto): Promise<Player> {
    const p = await this.findOrCreateByEmail(email);
    return this.players.update(p.id, {
      ...(dto.discoverable !== undefined && { discoverable: dto.discoverable }),
      ...(dto.totalPrivacy !== undefined && { totalPrivacy: dto.totalPrivacy }),
      ...(dto.partnerMarketingPush !== undefined && {
        partnerMarketingPush: dto.partnerMarketingPush,
      }),
      ...(dto.matchActivityPush !== undefined && {
        matchActivityPush: dto.matchActivityPush,
      }),
    });
  }

  /** Player-visible ban appeal history for Settings / notifications UX. */
  listMyBanAppeals(playerId: string) {
    return this.prisma.venueBanAppeal.findMany({
      where: { playerId },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        id: true,
        venueId: true,
        message: true,
        status: true,
        createdAt: true,
        resolvedAt: true,
        staffMessageToPlayer: true,
        venue: { select: { name: true } },
      },
    });
  }

  /** Reports this player filed (status + optional note from staff). */
  listMyFiledVenueReports(playerId: string) {
    return this.prisma.venuePlayerReport.findMany({
      where: { reporterId: playerId },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        id: true,
        venueId: true,
        status: true,
        reason: true,
        createdAt: true,
        dismissedAt: true,
        dismissalNoteToReporter: true,
        venue: { select: { name: true } },
      },
    });
  }

  async addPlayerBlock(blockerId: string, blockedId: string): Promise<void> {
    if (blockerId === blockedId) {
      throw new BadRequestException('Cannot block yourself');
    }
    await this.prisma.playerBlock.upsert({
      where: {
        blockerId_blockedId: { blockerId, blockedId },
      },
      create: { blockerId, blockedId },
      update: {},
    });
    const { low, high } = orderedPlayerPair(blockerId, blockedId);
    await this.prisma.friendship.deleteMany({
      where: { playerLowId: low, playerHighId: high },
    });
  }

  async removePlayerBlock(blockerId: string, blockedId: string): Promise<void> {
    await this.prisma.playerBlock.deleteMany({
      where: { blockerId, blockedId },
    });
  }

  listBlockedPlayers(blockerId: string) {
    return this.prisma.playerBlock.findMany({
      where: { blockerId },
      select: {
        blockedId: true,
        createdAt: true,
        blocked: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

}

