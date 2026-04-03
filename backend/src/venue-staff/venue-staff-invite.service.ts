import { randomBytes } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { VenueStaffInviteStatus, VenueStaffRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlayerService } from '../player/player.service';
import { VenueStaffService } from './venue-staff.service';
import { ClerkPartnerInviteService } from '../auth/clerk-partner-invite.service';

const INVITE_TTL_DAYS = 14;

@Injectable()
export class VenueStaffInviteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly venueStaff: VenueStaffService,
    private readonly players: PlayerService,
    private readonly clerkInvites: ClerkPartnerInviteService,
  ) {}

  assertInviteRoleAllowed(
    inviterRole: VenueStaffRole,
    targetRole: VenueStaffRole,
  ): void {
    if (targetRole === VenueStaffRole.OWNER) {
      throw new BadRequestException(
        'Venue owners cannot be invited via link — use the admin staff tool.',
      );
    }
    if (inviterRole === VenueStaffRole.MANAGER) {
      if (targetRole !== VenueStaffRole.EMPLOYEE) {
        throw new ForbiddenException('Managers may only invite employees.');
      }
      return;
    }
    if (inviterRole === VenueStaffRole.OWNER) {
      if (
        targetRole === VenueStaffRole.EMPLOYEE ||
        targetRole === VenueStaffRole.MANAGER
      ) {
        return;
      }
    }
    throw new ForbiddenException('You cannot send this invite.');
  }

  async createInvite(params: {
    venueId: string;
    email: string;
    role: VenueStaffRole;
    invitedByPlayerId: string;
    inviterVenueRole: VenueStaffRole;
  }) {
    this.assertInviteRoleAllowed(
      params.inviterVenueRole,
      params.role,
    );

    const normEmail = params.email.trim().toLowerCase();
    if (!normEmail.includes('@')) {
      throw new BadRequestException('Invalid email');
    }

    const existingStaff = await this.prisma.venueStaff.findFirst({
      where: {
        venueId: params.venueId,
        player: { email: { equals: normEmail, mode: 'insensitive' } },
      },
      select: { id: true },
    });
    if (existingStaff) {
      throw new BadRequestException('This person is already on the team.');
    }

    const duplicatePending = await this.prisma.venueStaffInvite.findFirst({
      where: {
        venueId: params.venueId,
        email: normEmail,
        status: VenueStaffInviteStatus.PENDING,
      },
    });
    if (duplicatePending) {
      throw new BadRequestException(
        'An active invite already exists for this email.',
      );
    }

    const expiresAt = new Date();
    expiresAt.setUTCDate(expiresAt.getUTCDate() + INVITE_TTL_DAYS);

    const token = randomBytes(24).toString('hex');

    const row = await this.prisma.venueStaffInvite.create({
      data: {
        venueId: params.venueId,
        email: normEmail,
        role: params.role,
        token,
        invitedById: params.invitedByPlayerId,
        expiresAt,
      },
      include: {
        venue: { select: { id: true, name: true } },
      },
    });

    const clerk = await this.clerkInvites.sendStaffPortalInvitation({
      email: row.email,
      staffInviteToken: row.token,
    });

    return {
      ...row,
      clerkInvitationSent: clerk.sent,
      ...(clerk.clerkError ? { clerkInvitationError: clerk.clerkError } : {}),
    };
  }

  listForVenue(venueId: string) {
    return this.prisma.venueStaffInvite.findMany({
      where: { venueId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        acceptedAt: true,
        createdAt: true,
        invitedBy: { select: { id: true, email: true, username: true } },
      },
    });
  }

  async cancelInvite(params: {
    venueId: string;
    inviteId: string;
    actorRole: VenueStaffRole;
  }) {
    if (
      !VenueStaffService.roleAtLeast(params.actorRole, VenueStaffRole.MANAGER)
    ) {
      throw new ForbiddenException('Insufficient permissions');
    }
    const inv = await this.prisma.venueStaffInvite.findFirst({
      where: { id: params.inviteId, venueId: params.venueId },
    });
    if (!inv) throw new NotFoundException('Invite not found');
    if (inv.status !== VenueStaffInviteStatus.PENDING) {
      throw new BadRequestException('Invite is no longer pending');
    }
    return this.prisma.venueStaffInvite.update({
      where: { id: inv.id },
      data: { status: VenueStaffInviteStatus.CANCELLED },
    });
  }

  async acceptInvite(token: string, signedInEmail: string) {
    const email = signedInEmail.trim().toLowerCase();
    const inv = await this.prisma.venueStaffInvite.findUnique({
      where: { token },
      include: { venue: { select: { id: true, name: true } } },
    });
    if (!inv) throw new NotFoundException('Invalid invite');

    if (inv.status !== VenueStaffInviteStatus.PENDING) {
      throw new BadRequestException('This invite is no longer valid.');
    }

    if (inv.expiresAt.getTime() < Date.now()) {
      await this.prisma.venueStaffInvite.update({
        where: { id: inv.id },
        data: { status: VenueStaffInviteStatus.EXPIRED },
      });
      throw new GoneException('This invite has expired.');
    }

    if (inv.email.toLowerCase() !== email) {
      throw new ForbiddenException(
        'Sign in with the email address that received the invite.',
      );
    }

    const player = await this.players.findOrCreateByEmail(email);

    await this.venueStaff.upsertMember({
      venueId: inv.venueId,
      playerId: player.id,
      role: inv.role,
    });

    await this.prisma.venueStaffInvite.update({
      where: { id: inv.id },
      data: {
        status: VenueStaffInviteStatus.ACCEPTED,
        acceptedAt: new Date(),
      },
    });

    return {
      venueId: inv.venueId,
      venueName: inv.venue.name,
      role: inv.role,
    };
  }
}
