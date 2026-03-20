import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InviteLinkKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlayerService } from '../player/player.service';
import { SubscriptionRepository } from '../venue/subscription.repository';
import { FriendshipService } from '../social/friendship.service';
import { InviteService } from '../invites/invite.service';
import { newInviteToken, hashInviteToken } from '../invites/invite-token.util';
import {
  FREE_MAX_PARTIES_CREATED,
  FREE_MAX_PARTY_MEMBERS,
  SUB_MAX_PARTY_MEMBERS,
  INVITE_LINK_TTL_MS,
} from './party.constants';

@Injectable()
export class PartyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly players: PlayerService,
    private readonly subs: SubscriptionRepository,
    private readonly friendships: FriendshipService,
    private readonly invites: InviteService,
  ) {}

  async createParty(email: string, name?: string | null) {
    const player = await this.players.findOrCreateByEmail(email);
    const sub = await this.subs.isActiveSubscriber(player.id);
    if (!sub) {
      const created = await this.prisma.party.count({
        where: { creatorId: player.id },
      });
      if (created >= FREE_MAX_PARTIES_CREATED) {
        throw new ForbiddenException(
          'Free tier: maximum 2 parties you can create',
        );
      }
    }
    const maxMembers = sub ? SUB_MAX_PARTY_MEMBERS : FREE_MAX_PARTY_MEMBERS;
    return this.prisma.party.create({
      data: {
        name: name ?? null,
        creatorId: player.id,
        leaderId: player.id,
        maxMembers,
        members: { create: { playerId: player.id } },
      },
      include: {
        members: { include: { player: { select: { id: true, username: true } } } },
      },
    });
  }

  async listMyParties(email: string) {
    const player = await this.players.findOrCreateByEmail(email);
    return this.prisma.party.findMany({
      where: { members: { some: { playerId: player.id } } },
      orderBy: { updatedAt: 'desc' },
      include: {
        members: {
          include: { player: { select: { id: true, username: true } } },
        },
      },
    });
  }

  async getParty(partyId: string, viewerEmail: string) {
    const viewer = await this.players.findOrCreateByEmail(viewerEmail);
    const party = await this.prisma.party.findUnique({
      where: { id: partyId },
      include: {
        members: {
          include: { player: { select: { id: true, username: true } } },
        },
      },
    });
    if (!party) throw new NotFoundException('Party not found');
    const isMember = party.members.some((m) => m.playerId === viewer.id);
    if (!isMember) throw new ForbiddenException('Not a party member');
    return party;
  }

  async leaveParty(partyId: string, email: string) {
    const player = await this.players.findOrCreateByEmail(email);
    const party = await this.prisma.party.findUnique({
      where: { id: partyId },
      include: { members: true },
    });
    if (!party) throw new NotFoundException('Party not found');
    const isMember = party.members.some((m) => m.playerId === player.id);
    if (!isMember) throw new ForbiddenException('Not a party member');

    await this.prisma.partyMember.delete({
      where: { partyId_playerId: { partyId, playerId: player.id } },
    });

    const remaining = party.members.filter((m) => m.playerId !== player.id);
    if (remaining.length === 0) {
      await this.prisma.party.delete({ where: { id: partyId } });
      return { dissolved: true as const };
    }

    if (party.leaderId === player.id) {
      const pick = remaining[Math.floor(Math.random() * remaining.length)];
      await this.prisma.party.update({
        where: { id: partyId },
        data: { leaderId: pick.playerId },
      });
    }
    return { dissolved: false as const };
  }

  async transferLeadership(
    partyId: string,
    email: string,
    newLeaderId: string,
  ) {
    const leader = await this.players.findOrCreateByEmail(email);
    const party = await this.prisma.party.findUnique({
      where: { id: partyId },
      include: { members: true },
    });
    if (!party) throw new NotFoundException('Party not found');
    if (party.leaderId !== leader.id) {
      throw new ForbiddenException('Only leader can transfer leadership');
    }
    const ok = party.members.some((m) => m.playerId === newLeaderId);
    if (!ok) throw new BadRequestException('New leader must be a member');
    await this.prisma.party.update({
      where: { id: partyId },
      data: { leaderId: newLeaderId },
    });
    return { leaderId: newLeaderId };
  }

  async kickMember(partyId: string, email: string, targetPlayerId: string) {
    const leader = await this.players.findOrCreateByEmail(email);
    const party = await this.prisma.party.findUnique({
      where: { id: partyId },
      include: { members: true },
    });
    if (!party) throw new NotFoundException('Party not found');
    if (party.leaderId !== leader.id) {
      throw new ForbiddenException('Only leader can kick members');
    }
    if (targetPlayerId === leader.id) {
      throw new BadRequestException('Cannot kick yourself');
    }
    const ok = party.members.some((m) => m.playerId === targetPlayerId);
    if (!ok) throw new BadRequestException('Player is not in this party');

    await this.prisma.partyMember.delete({
      where: {
        partyId_playerId: { partyId, playerId: targetPlayerId },
      },
    });

    const remaining = party.members.filter((m) => m.playerId !== targetPlayerId);
    const stillLeader = remaining.some((m) => m.playerId === party.leaderId);
    if (!stillLeader && remaining.length > 0) {
      const pick = remaining[Math.floor(Math.random() * remaining.length)];
      await this.prisma.party.update({
        where: { id: partyId },
        data: { leaderId: pick.playerId },
      });
    }
    if (remaining.length === 0) {
      await this.prisma.party.delete({ where: { id: partyId } });
      return { dissolved: true as const };
    }
    return { dissolved: false as const };
  }

  async createPartyInviteLink(partyId: string, email: string) {
    const player = await this.players.findOrCreateByEmail(email);
    const party = await this.prisma.party.findUnique({
      where: { id: partyId },
      include: { members: true },
    });
    if (!party) throw new NotFoundException('Party not found');
    if (party.leaderId !== player.id) {
      throw new ForbiddenException('Only leader can create party invite links');
    }

    const sub = await this.subs.isActiveSubscriber(player.id);
    await this.invites.assertDailyLinkBudget(player.id, sub);

    const maxUses = party.maxMembers;
    const token = newInviteToken();
    const tokenHash = hashInviteToken(token);
    const row = await this.prisma.inviteLink.create({
      data: {
        kind: InviteLinkKind.PARTY,
        tokenHash,
        partyId: party.id,
        createdById: player.id,
        expiresAt: new Date(Date.now() + INVITE_LINK_TTL_MS),
        maxUses,
      },
    });
    return {
      token,
      inviteId: row.id,
      expiresAt: row.expiresAt,
      maxUses: row.maxUses,
    };
  }

  async revokePartyInviteLink(partyId: string, email: string, linkId: string) {
    const player = await this.players.findOrCreateByEmail(email);
    const party = await this.prisma.party.findUnique({ where: { id: partyId } });
    if (!party) throw new NotFoundException('Party not found');
    if (party.leaderId !== player.id) {
      throw new ForbiddenException('Only leader can revoke links');
    }
    const link = await this.prisma.inviteLink.findFirst({
      where: { id: linkId, partyId },
    });
    if (!link) throw new NotFoundException('Link not found');
    await this.prisma.inviteLink.update({
      where: { id: link.id },
      data: { revokedAt: new Date() },
    });
    return { revoked: true as const };
  }

  async inviteFriendToParty(
    partyId: string,
    email: string,
    friendPlayerId: string,
  ) {
    const inviter = await this.players.findOrCreateByEmail(email);
    const party = await this.prisma.party.findUnique({
      where: { id: partyId },
      include: { members: true },
    });
    if (!party) throw new NotFoundException('Party not found');
    if (!party.members.some((m) => m.playerId === inviter.id)) {
      throw new ForbiddenException('Not a party member');
    }
    if (inviter.id === friendPlayerId) {
      throw new BadRequestException('Cannot invite yourself');
    }
    const friends = await this.friendships.areFriends(inviter.id, friendPlayerId);
    if (!friends) {
      throw new ForbiddenException('You can only invite friends to the party');
    }
    if (party.members.some((m) => m.playerId === friendPlayerId)) {
      return { alreadyMember: true as const };
    }
    if (party.members.length >= party.maxMembers) {
      throw new BadRequestException('Party is full');
    }
    await this.prisma.partyMember.create({
      data: { partyId, playerId: friendPlayerId },
    });
    return { joined: true as const };
  }

  async meshFriendRequests(partyId: string, email: string) {
    const player = await this.players.findOrCreateByEmail(email);
    const party = await this.prisma.party.findUnique({
      where: { id: partyId },
      include: { members: true },
    });
    if (!party) throw new NotFoundException('Party not found');
    if (!party.members.some((m) => m.playerId === player.id)) {
      throw new ForbiddenException('Not a party member');
    }
    let sent = 0;
    for (const m of party.members) {
      if (m.playerId === player.id) continue;
      const created = await this.friendships.requestFriendship(
        player.id,
        m.playerId,
      );
      if (created) sent += 1;
    }
    return { requestsSent: sent };
  }
}
