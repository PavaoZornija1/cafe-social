import { Injectable } from '@nestjs/common';
import type { Player, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlayerRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.PlayerCreateInput): Promise<Player> {
    return this.prisma.player.create({ data });
  }

  findAll(): Promise<Player[]> {
    return this.prisma.player.findMany({ orderBy: { createdAt: 'desc' } });
  }

  findById(id: string): Promise<Player | null> {
    return this.prisma.player.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<Player | null> {
    return this.prisma.player.findUnique({ where: { email } });
  }

  /** Case-insensitive match (PostgreSQL). */
  findByUsernameInsensitive(username: string): Promise<Player | null> {
    const u = username.trim();
    if (!u) return Promise.resolve(null);
    return this.prisma.player.findFirst({
      where: { username: { equals: u, mode: 'insensitive' } },
    });
  }

  update(id: string, data: Prisma.PlayerUpdateInput): Promise<Player> {
    return this.prisma.player.update({ where: { id }, data });
  }

  async getSummary(playerId: string): Promise<{
    completedChallenges: number;
    venuesUnlocked: number;
  }> {
    const [completedChallenges, venuesUnlocked] = await Promise.all([
      this.prisma.challengeProgress.count({
        where: { playerId, completedAt: { not: null } },
      }),
      this.prisma.playerVenue.count({ where: { playerId } }),
    ]);
    return { completedChallenges, venuesUnlocked };
  }
}

