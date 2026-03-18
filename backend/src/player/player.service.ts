import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Player } from '@prisma/client';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { PlayerRepository } from './player.repository';

@Injectable()
export class PlayerService {
  constructor(private readonly players: PlayerRepository) {}

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
}

