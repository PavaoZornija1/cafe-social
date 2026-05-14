import { Injectable } from '@nestjs/common';
import { $Enums, InboxKind, type InboxStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlayerInboxService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertFriendRequestInbox(params: {
    friendshipId: string;
    recipientId: string;
    actorId: string;
  }): Promise<void> {
    await this.prisma.playerInboxItem.upsert({
      where: { friendshipId: params.friendshipId },
      create: {
        recipientId: params.recipientId,
        actorId: params.actorId,
        kind: InboxKind.FRIEND_REQUEST,
        status: $Enums.InboxStatus.PENDING,
        friendshipId: params.friendshipId,
      },
      update: {
        recipientId: params.recipientId,
        actorId: params.actorId,
        status: $Enums.InboxStatus.PENDING,
        resolvedAt: null,
      },
    });
  }

  async resolveFriendRequestInbox(
    friendshipId: string,
    status: Extract<InboxStatus, 'ACCEPTED' | 'DECLINED' | 'CANCELLED'>,
  ): Promise<void> {
    await this.prisma.playerInboxItem.updateMany({
      where: { friendshipId },
      data: { status, resolvedAt: new Date() },
    });
  }

  async upsertPartyInviteInbox(params: {
    partyInviteId: string;
    recipientId: string;
    actorId: string;
  }): Promise<void> {
    await this.prisma.playerInboxItem.upsert({
      where: { partyInviteId: params.partyInviteId },
      create: {
        recipientId: params.recipientId,
        actorId: params.actorId,
        kind: InboxKind.PARTY_INVITE,
        status: $Enums.InboxStatus.PENDING,
        partyInviteId: params.partyInviteId,
      },
      update: {
        recipientId: params.recipientId,
        actorId: params.actorId,
        status: $Enums.InboxStatus.PENDING,
        resolvedAt: null,
      },
    });
  }

  async resolvePartyInviteInbox(
    partyInviteId: string,
    status: Extract<InboxStatus, 'ACCEPTED' | 'DECLINED'>,
  ): Promise<void> {
    await this.prisma.playerInboxItem.updateMany({
      where: { partyInviteId },
      data: { status, resolvedAt: new Date() },
    });
  }
}
