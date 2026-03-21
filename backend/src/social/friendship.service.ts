import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FriendshipStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { orderedPlayerPair } from '../common/player-pair';

@Injectable()
export class FriendshipService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertAcceptedFriendship(
    aId: string,
    bId: string,
    requestedById: string,
  ): Promise<void> {
    const { low, high } = orderedPlayerPair(aId, bId);
    if (requestedById !== low && requestedById !== high) {
      throw new BadRequestException('requestedById must be one of the pair');
    }
    await this.prisma.friendship.upsert({
      where: {
        playerLowId_playerHighId: { playerLowId: low, playerHighId: high },
      },
      create: {
        playerLowId: low,
        playerHighId: high,
        status: FriendshipStatus.ACCEPTED,
        requestedById,
      },
      update: {
        status: FriendshipStatus.ACCEPTED,
        requestedById,
      },
    });
  }

  async areFriends(aId: string, bId: string): Promise<boolean> {
    const { low, high } = orderedPlayerPair(aId, bId);
    const row = await this.prisma.friendship.findUnique({
      where: {
        playerLowId_playerHighId: { playerLowId: low, playerHighId: high },
      },
    });
    return row?.status === FriendshipStatus.ACCEPTED;
  }

  /** Returns true if a new pending request was created. */
  async requestFriendship(
    requesterId: string,
    targetId: string,
  ): Promise<boolean> {
    if (requesterId === targetId) throw new BadRequestException('Cannot friend yourself');
    const { low, high } = orderedPlayerPair(requesterId, targetId);
    const existing = await this.prisma.friendship.findUnique({
      where: {
        playerLowId_playerHighId: { playerLowId: low, playerHighId: high },
      },
    });
    if (existing?.status === FriendshipStatus.ACCEPTED) return false;
    if (existing?.status === FriendshipStatus.PENDING) return false;
    if (existing) return false;
    await this.prisma.friendship.create({
      data: {
        playerLowId: low,
        playerHighId: high,
        status: FriendshipStatus.PENDING,
        requestedById: requesterId,
      },
    });
    return true;
  }

  async acceptFriendship(playerId: string, otherId: string): Promise<void> {
    const { low, high } = orderedPlayerPair(playerId, otherId);
    const row = await this.prisma.friendship.findUnique({
      where: {
        playerLowId_playerHighId: { playerLowId: low, playerHighId: high },
      },
    });
    if (!row) throw new NotFoundException('No pending request');
    if (row.status !== FriendshipStatus.PENDING) {
      throw new BadRequestException('Not pending');
    }
    if (row.requestedById === playerId) {
      throw new BadRequestException('Cannot accept your own outgoing request');
    }
    await this.prisma.friendship.update({
      where: { id: row.id },
      data: { status: FriendshipStatus.ACCEPTED },
    });
  }

  async listFriends(playerId: string) {
    const rows = await this.prisma.friendship.findMany({
      where: {
        OR: [{ playerLowId: playerId }, { playerHighId: playerId }],
        status: FriendshipStatus.ACCEPTED,
      },
    });
    const ids = rows.map((r) =>
      r.playerLowId === playerId ? r.playerHighId : r.playerLowId,
    );
    if (ids.length === 0) return [];
    return this.prisma.player.findMany({
      where: { id: { in: ids } },
      select: { id: true, username: true },
    });
  }

  async listIncomingPending(playerId: string) {
    return this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.PENDING,
        requestedById: { not: playerId },
        OR: [{ playerLowId: playerId }, { playerHighId: playerId }],
      },
      include: {
        playerLow: { select: { id: true, username: true } },
        playerHigh: { select: { id: true, username: true } },
      },
    });
  }

  /** Pending requests you sent (waiting for the other person to accept). */
  async listOutgoingPending(playerId: string) {
    const rows = await this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.PENDING,
        requestedById: playerId,
      },
      include: {
        playerLow: { select: { id: true, username: true } },
        playerHigh: { select: { id: true, username: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      target:
        r.playerLowId === playerId
          ? r.playerHigh
          : r.playerLow,
    }));
  }
}
