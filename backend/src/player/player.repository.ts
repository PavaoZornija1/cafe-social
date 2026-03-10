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

  update(id: string, data: Prisma.PlayerUpdateInput): Promise<Player> {
    return this.prisma.player.update({ where: { id }, data });
  }
}

