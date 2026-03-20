import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InviteLinkKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlayerService } from '../player/player.service';
import { SubscriptionRepository } from '../venue/subscription.repository';
import { FriendshipService } from '../social/friendship.service';
import { hashInviteToken, newInviteToken } from './invite-token.util';
import {
  FREE_INVITE_LINKS_PER_UTC_DAY,
  FREE_MAX_PARTY_MEMBERS,
  SUB_INVITE_LINKS_PER_UTC_DAY,
  SUB_MAX_PARTY_MEMBERS,
  INVITE_LINK_TTL_MS,
} from '../party/party.constants';

@Injectable()
export class InviteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly players: PlayerService,
    private readonly subs: SubscriptionRepository,
    private readonly friendships: FriendshipService,
  ) {}

  private startOfUtcDay(): Date {
    const d = new Date();
    return new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    );
  }

  async assertDailyLinkBudget(createdById: string, isSubscriber: boolean) {
    const start = this.startOfUtcDay();
    const count = await this.prisma.inviteLink.count({
      where: { createdById, createdAt: { gte: start } },
    });
    const cap = isSubscriber
      ? SUB_INVITE_LINKS_PER_UTC_DAY
      : FREE_INVITE_LINKS_PER_UTC_DAY;
    if (count >= cap) {
      throw new BadRequestException(
        `Daily invite link limit reached (${cap} per UTC day)`,
      );
    }
  }

  async createFriendInvite(email: string): Promise<{
    token: string;
    expiresAt: Date;
    maxUses: number;
  }> {
    const player = await this.players.findOrCreateByEmail(email);
    const sub = await this.subs.isActiveSubscriber(player.id);
    await this.assertDailyLinkBudget(player.id, sub);
    const maxUses = sub ? SUB_MAX_PARTY_MEMBERS : FREE_MAX_PARTY_MEMBERS;
    const token = newInviteToken();
    const tokenHash = hashInviteToken(token);
    const row = await this.prisma.inviteLink.create({
      data: {
        kind: InviteLinkKind.FRIEND,
        tokenHash,
        createdById: player.id,
        expiresAt: new Date(Date.now() + INVITE_LINK_TTL_MS),
        maxUses,
      },
    });
    return { token, expiresAt: row.expiresAt, maxUses: row.maxUses };
  }

  async redeemToken(
    email: string,
    rawToken: string,
  ): Promise<{
    kind: 'PARTY' | 'FRIEND';
    partyId?: string;
    joinedParty?: boolean;
  }> {
    if (!rawToken?.trim()) throw new BadRequestException('token required');
    const player = await this.players.findOrCreateByEmail(email);
    const tokenHash = hashInviteToken(rawToken.trim());
    const link = await this.prisma.inviteLink.findUnique({
      where: { tokenHash },
      include: { party: { include: { members: true } } },
    });
    if (!link) throw new NotFoundException('Invalid or unknown invite');
    if (link.revokedAt) throw new BadRequestException('Invite revoked');
    if (link.expiresAt < new Date()) throw new BadRequestException('Invite expired');
    if (link.useCount >= link.maxUses) {
      throw new BadRequestException('Invite uses exhausted');
    }

    if (link.kind === InviteLinkKind.FRIEND) {
      const wereFriends = await this.friendships.areFriends(
        player.id,
        link.createdById,
      );
      await this.friendships.upsertAcceptedFriendship(
        player.id,
        link.createdById,
        link.createdById,
      );
      if (!wereFriends) {
        await this.prisma.inviteLink.update({
          where: { id: link.id },
          data: { useCount: { increment: 1 } },
        });
      }
      return { kind: 'FRIEND' };
    }

    const party = link.party;
    if (!party) throw new BadRequestException('Broken party invite');

    const memberCount = party.members.length;
    if (memberCount >= party.maxMembers) {
      throw new BadRequestException('Party is full');
    }

    const already = party.members.some((m) => m.playerId === player.id);
    if (!already) {
      await this.prisma.partyMember.create({
        data: { partyId: party.id, playerId: player.id },
      });
    }

    await this.friendships.upsertAcceptedFriendship(
      player.id,
      party.creatorId,
      party.creatorId,
    );

    if (!already) {
      await this.prisma.inviteLink.update({
        where: { id: link.id },
        data: { useCount: { increment: 1 } },
      });
    }

    return {
      kind: 'PARTY',
      partyId: party.id,
      joinedParty: !already,
    };
  }
}
