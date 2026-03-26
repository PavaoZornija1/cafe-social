import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { VenueStaff, VenueStaffRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const ROLE_RANK: Record<VenueStaffRole, number> = {
  EMPLOYEE: 1,
  MANAGER: 2,
  OWNER: 3,
};

@Injectable()
export class VenueStaffService {
  constructor(private readonly prisma: PrismaService) {}

  static roleAtLeast(subject: VenueStaffRole, min: VenueStaffRole): boolean {
    return ROLE_RANK[subject] >= ROLE_RANK[min];
  }

  async findMembership(
    playerId: string,
    venueId: string,
  ): Promise<VenueStaff | null> {
    return this.prisma.venueStaff.findUnique({
      where: {
        venueId_playerId: { venueId, playerId },
      },
    });
  }

  async findMembershipForEmail(
    email: string,
    venueId: string,
  ): Promise<(VenueStaff & { playerId: string }) | null> {
    const player = await this.prisma.player.findFirst({
      where: {
        email: { equals: email.trim(), mode: 'insensitive' },
      },
    });
    if (!player) return null;
    const row = await this.findMembership(player.id, venueId);
    return row;
  }

  async listVenuesForPlayer(playerId: string) {
    return this.prisma.venueStaff.findMany({
      where: { playerId },
      include: {
        venue: {
          select: {
            id: true,
            name: true,
            city: true,
            country: true,
            address: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async listStaffForVenue(venueId: string) {
    await this.assertVenueExists(venueId);
    return this.prisma.venueStaff.findMany({
      where: { venueId },
      include: {
        player: {
          select: { id: true, email: true, username: true },
        },
      },
      orderBy: [{ role: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async upsertMember(params: {
    venueId: string;
    playerId: string;
    role: VenueStaffRole;
  }): Promise<VenueStaff> {
    await this.assertVenueExists(params.venueId);
    await this.assertPlayerExists(params.playerId);

    return this.prisma.venueStaff.upsert({
      where: {
        venueId_playerId: {
          venueId: params.venueId,
          playerId: params.playerId,
        },
      },
      create: {
        venueId: params.venueId,
        playerId: params.playerId,
        role: params.role,
      },
      update: { role: params.role },
    });
  }

  async removeMember(venueId: string, playerId: string): Promise<void> {
    await this.assertVenueExists(venueId);
    const deleted = await this.prisma.venueStaff.deleteMany({
      where: { venueId, playerId },
    });
    if (deleted.count === 0) {
      throw new NotFoundException('Staff member not found for this venue');
    }
  }

  private async assertVenueExists(venueId: string) {
    const v = await this.prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true },
    });
    if (!v) throw new NotFoundException(`Venue ${venueId} not found`);
  }

  private async assertPlayerExists(playerId: string) {
    const p = await this.prisma.player.findUnique({
      where: { id: playerId },
      select: { id: true },
    });
    if (!p) throw new NotFoundException(`Player ${playerId} not found`);
  }

  /** Prevent demoting the last OWNER on a venue (must transfer ownership first). */
  async assertCanRemoveOrDemoteOwner(venueId: string, playerId: string) {
    const row = await this.findMembership(playerId, venueId);
    if (!row || row.role !== VenueStaffRole.OWNER) return;

    const owners = await this.prisma.venueStaff.count({
      where: { venueId, role: VenueStaffRole.OWNER },
    });
    if (owners <= 1) {
      throw new ConflictException(
        'Cannot remove or demote the last OWNER for this venue. Add another OWNER first.',
      );
    }
  }
}
