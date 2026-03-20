import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Player } from '@prisma/client';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { UpdateMeSettingsDto } from './dto/update-me-settings.dto';
import { PlayerRepository } from './player.repository';
import { PlayerVenueStatsRepository } from '../stats/player-venue-stats.repository';

@Injectable()
export class PlayerService {
  constructor(
    private readonly players: PlayerRepository,
    private readonly venueStats: PlayerVenueStatsRepository,
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
    };
  }

  async updateMeSettings(email: string, dto: UpdateMeSettingsDto): Promise<Player> {
    const p = await this.findOrCreateByEmail(email);
    return this.players.update(p.id, {
      ...(dto.discoverable !== undefined && { discoverable: dto.discoverable }),
      ...(dto.totalPrivacy !== undefined && { totalPrivacy: dto.totalPrivacy }),
    });
  }

  private tierFromXp(xp: number): string {
    if (xp >= 2000) return 'Gold';
    if (xp >= 800) return 'Silver';
    return 'Bronze';
  }
}

