import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PlatformRole, VenueStaffRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeUserEmail } from '../auth/user-email.util';

export type AdminCmsScope =
  | { kind: 'super_admin' }
  | { kind: 'partner'; playerId: string; managedVenueIds: string[] };

@Injectable()
export class AdminCmsAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveScope(req: { user?: unknown }): Promise<AdminCmsScope> {
    const email = normalizeUserEmail(req.user);
    if (!email) {
      throw new UnauthorizedException('Missing user email');
    }

    const player = await this.prisma.player.findFirst({
      where: { email: { equals: email.trim(), mode: 'insensitive' } },
      select: { id: true, platformRole: true },
    });
    if (!player) {
      throw new ForbiddenException('No player record for this account');
    }

    if (player.platformRole === PlatformRole.SUPER_ADMIN) {
      return { kind: 'super_admin' };
    }

    const memberships = await this.prisma.venueStaff.findMany({
      where: {
        playerId: player.id,
        role: { in: [VenueStaffRole.OWNER, VenueStaffRole.MANAGER] },
      },
      select: { venueId: true },
    });
    const managedVenueIds = [...new Set(memberships.map((m) => m.venueId))];
    if (managedVenueIds.length === 0) {
      throw new ForbiddenException('Partner CMS access requires owner or manager role');
    }

    return { kind: 'partner', playerId: player.id, managedVenueIds };
  }

  assertSuperAdmin(scope: AdminCmsScope): void {
    if (scope.kind !== 'super_admin') {
      throw new ForbiddenException('Super admin only');
    }
  }

  assertVenueInScope(scope: AdminCmsScope, venueId: string): void {
    if (scope.kind === 'super_admin') return;
    if (!scope.managedVenueIds.includes(venueId)) {
      throw new ForbiddenException('Not allowed for this venue');
    }
  }
}
