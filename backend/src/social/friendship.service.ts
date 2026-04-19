import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FriendshipStatus, InboxStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { orderedPlayerPair } from '../common/player-pair';
import { hiddenOpponentIdsForViewer, isEitherBlocked } from './hidden-opponents.util';
import { PlayerInboxService } from './player-inbox.service';
import { EmailService } from '../email/email.service';
@Injectable()
export class FriendshipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inbox: PlayerInboxService,
    private readonly email: EmailService,
  ) {}

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

  /** Returns whether a new pending request was created and its friendship id when true. */
  async requestFriendship(
    requesterId: string,
    targetId: string,
  ): Promise<{ created: boolean; friendshipId?: string }> {
    if (requesterId === targetId) throw new BadRequestException('Cannot friend yourself');
    if (await isEitherBlocked(this.prisma, requesterId, targetId)) {
      throw new ForbiddenException('You cannot connect with this player');
    }
    const { low, high } = orderedPlayerPair(requesterId, targetId);
    const existing = await this.prisma.friendship.findUnique({
      where: {
        playerLowId_playerHighId: { playerLowId: low, playerHighId: high },
      },
    });
    if (existing?.status === FriendshipStatus.ACCEPTED) return { created: false };
    if (existing?.status === FriendshipStatus.PENDING) return { created: false };
    if (existing) return { created: false };
    const row = await this.prisma.friendship.create({
      data: {
        playerLowId: low,
        playerHighId: high,
        status: FriendshipStatus.PENDING,
        requestedById: requesterId,
      },
    });
    await this.inbox.upsertFriendRequestInbox({
      friendshipId: row.id,
      recipientId: targetId,
      actorId: requesterId,
    });
    const [actor, target] = await Promise.all([
      this.prisma.player.findUnique({
        where: { id: requesterId },
        select: { username: true },
      }),
      this.prisma.player.findUnique({
        where: { id: targetId },
        select: { email: true },
      }),
    ]);
    if (target?.email && actor) {
      void this.email.notifyFriendRequest({
        toEmail: target.email,
        actorUsername: actor.username,
      });
    }
    return { created: true, friendshipId: row.id };
  }

  /** Decline or cancel an incoming pending request (recipient only). */
  async rejectIncomingRequest(playerId: string, otherId: string): Promise<void> {
    if (await isEitherBlocked(this.prisma, playerId, otherId)) {
      throw new ForbiddenException('You cannot connect with this player');
    }
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
      throw new BadRequestException('Use cancel for outgoing requests');
    }
    await this.prisma.friendship.delete({ where: { id: row.id } });
  }

  async acceptFriendship(playerId: string, otherId: string): Promise<void> {
    if (await isEitherBlocked(this.prisma, playerId, otherId)) {
      throw new ForbiddenException('You cannot connect with this player');
    }
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
    await this.inbox.resolveFriendRequestInbox(row.id, InboxStatus.ACCEPTED);
  }

  async listFriends(playerId: string) {
    const hidden = await hiddenOpponentIdsForViewer(this.prisma, playerId);
    const rows = await this.prisma.friendship.findMany({
      where: {
        OR: [{ playerLowId: playerId }, { playerHighId: playerId }],
        status: FriendshipStatus.ACCEPTED,
      },
    });
    const ids = rows
      .map((r) => (r.playerLowId === playerId ? r.playerHighId : r.playerLowId))
      .filter((id) => !hidden.has(id));
    if (ids.length === 0) return [];
    return this.prisma.player.findMany({
      where: { id: { in: ids } },
      select: { id: true, username: true },
    });
  }

  async listIncomingPending(playerId: string) {
    const hidden = await hiddenOpponentIdsForViewer(this.prisma, playerId);
    const rows = await this.prisma.friendship.findMany({
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
    return rows.filter((r) => {
      const otherId = r.playerLowId === playerId ? r.playerHighId : r.playerLowId;
      return !hidden.has(otherId);
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

  /** Withdraw a pending request you sent. */
  async cancelOutgoingRequest(playerId: string, friendshipId: string): Promise<void> {
    const row = await this.prisma.friendship.findUnique({
      where: { id: friendshipId },
    });
    if (!row) throw new NotFoundException('Friend request not found');
    if (row.status !== FriendshipStatus.PENDING) {
      throw new BadRequestException('Not a pending request');
    }
    if (row.requestedById !== playerId) {
      throw new ForbiddenException('You did not send this request');
    }
    await this.prisma.friendship.delete({ where: { id: friendshipId } });
  }
}
