import { Injectable } from '@nestjs/common';
import { InboxKind, InboxStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FriendshipService } from './friendship.service';

@Injectable()
export class SocialInboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly friendships: FriendshipService,
  ) {}

  async getInbox(playerId: string) {
    const [pendingItems, friendRequestsOutgoing] = await Promise.all([
      this.prisma.playerInboxItem.findMany({
        where: { recipientId: playerId, status: InboxStatus.PENDING },
        include: {
          friendship: {
            include: {
              playerLow: { select: { id: true, username: true } },
              playerHigh: { select: { id: true, username: true } },
            },
          },
          partyInvite: {
            include: {
              party: {
                select: {
                  id: true,
                  name: true,
                  maxMembers: true,
                  _count: { select: { members: true } },
                },
              },
              invitedBy: { select: { id: true, username: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 80,
      }),
      this.friendships.listOutgoingPending(playerId),
    ]);

    const friendRequestsIncoming = pendingItems
      .filter((i) => i.kind === InboxKind.FRIEND_REQUEST && i.friendship)
      .map((i) => i.friendship!);

    const partyInvitesIncoming = pendingItems
      .filter((i) => i.kind === InboxKind.PARTY_INVITE && i.partyInvite)
      .map((i) => {
        const row = i.partyInvite!;
        return {
          id: row.id,
          partyId: row.partyId,
          partyName: row.party.name,
          memberCount: row.party._count.members,
          maxMembers: row.party.maxMembers,
          invitedBy: row.invitedBy,
          createdAt: row.createdAt.toISOString(),
        };
      });

    return {
      friendRequestsIncoming,
      friendRequestsOutgoing,
      partyInvitesIncoming,
      /** Same rows as above, stable shape for new clients / future kinds. */
      unifiedPending: pendingItems.map((i) => ({
        inboxItemId: i.id,
        kind: i.kind,
        createdAt: i.createdAt.toISOString(),
        actorId: i.actorId,
        externalRefId: i.externalRefId,
        friendshipId: i.friendshipId,
        partyInviteId: i.partyInviteId,
      })),
    };
  }
}
