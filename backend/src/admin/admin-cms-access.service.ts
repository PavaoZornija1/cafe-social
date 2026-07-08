import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PlatformRole, VenueStaffRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeUserEmail } from '../auth/user-email.util';
import {
  PARTNER_TRIAL_LOCK_REASON,
  isPayingPartnerOrg,
} from '../owner/partner-access.constants';

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

  /**
   * Blocks partner CMS mutations when the venue is locked or the org trial ended
   * without payment. Super admins bypass. Mirrors {@link PartnerVenueWriteGuard}
   * on `/owner/*` so partner content editing respects the same trial/read-only state.
   * Call after {@link assertVenueInScope} on every partner-reachable write endpoint.
   */
  async assertVenueMutable(
    scope: AdminCmsScope,
    venueId: string,
  ): Promise<void> {
    if (scope.kind === 'super_admin') return;
    const venue = await this.prisma.venue.findUnique({
      where: { id: venueId },
      select: {
        locked: true,
        lockReason: true,
        organization: {
          select: { platformBillingStatus: true, trialEndsAt: true },
        },
      },
    });
    if (!venue) {
      throw new NotFoundException('Venue not found');
    }
    if (venue.locked) {
      const msg =
        venue.lockReason === PARTNER_TRIAL_LOCK_REASON
          ? 'This location is not active on Cafe Social (trial ended or billing required). Renew to make changes.'
          : venue.lockReason?.trim() ||
            'This venue is locked — editing is disabled.';
      throw new ForbiddenException(msg);
    }
    const org = venue.organization;
    if (org?.trialEndsAt) {
      const paying = isPayingPartnerOrg(org.platformBillingStatus);
      if (!paying && org.trialEndsAt.getTime() <= Date.now()) {
        throw new ForbiddenException(
          'Your trial has ended. Subscribe to make changes.',
        );
      }
    }
  }
}
