import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Player } from '@prisma/client';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { UpdateMeSettingsDto } from './dto/update-me-settings.dto';
import { PlayerRepository } from './player.repository';
import { PlayerVenueStatsRepository } from '../stats/player-venue-stats.repository';
import { PrismaService } from '../prisma/prisma.service';
import { utcDayKeyDaysAgo, utcWeekDayKeyRange } from '../lib/engagement-dates';

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
    completedChallenges: number;
    venuesUnlocked: number;
    discoverable: boolean;
    totalPrivacy: boolean;
    partnerMarketingPush: boolean;
    matchActivityPush: boolean;
  }> {
    const player = await this.findOrCreateByEmail(email);
    const { completedChallenges, venuesUnlocked } =
      await this.players.getSummary(player.id);

    const venueXpSum = await this.venueStats.sumVenueXpForPlayer(player.id);
    const tier = this.tierFromXp(venueXpSum);

    return {
      playerId: player.id,
      xp: venueXpSum,
      tier,
      completedChallenges,
      venuesUnlocked,
      discoverable: player.discoverable,
      totalPrivacy: player.totalPrivacy,
      partnerMarketingPush: player.partnerMarketingPush,
      matchActivityPush: player.matchActivityPush,
    };
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
    return this.prisma.venuePerkRedemption.findMany({
      where: { playerId: player.id },
      orderBy: { redeemedAt: 'desc' },
      include: {
        perk: { select: { title: true, subtitle: true, code: true } },
      },
      take: 50,
    });
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

  private tierFromXp(xp: number): string {
    if (xp >= 2000) return 'Gold';
    if (xp >= 800) return 'Silver';
    return 'Bronze';
  }
}

