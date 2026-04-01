import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PlatformRole, VenueStaffRole } from '@prisma/client';
import { normalizeUserEmail } from '../auth/user-email.util';
import { PrismaService } from '../prisma/prisma.service';
import { VenueStaffService } from './venue-staff.service';

@Injectable()
export class OrganizationStaffGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly venueStaff: VenueStaffService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      user?: unknown;
      params: Record<string, string | undefined>;
    }>();
    const organizationId = req.params.organizationId?.trim();
    if (!organizationId) {
      throw new BadRequestException('organizationId is required');
    }

    const email = normalizeUserEmail(req.user);
    if (!email) throw new UnauthorizedException('Missing user email');

    const org = await this.prisma.venueOrganization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const player = await this.prisma.player.findFirst({
      where: { email: { equals: email.trim(), mode: 'insensitive' } },
      select: { id: true, platformRole: true },
    });

    if (player?.platformRole === PlatformRole.SUPER_ADMIN) {
      return true;
    }

    if (!player) {
      throw new ForbiddenException('You do not have access to this organization');
    }

    const venues = await this.prisma.venue.findMany({
      where: { organizationId },
      select: { id: true },
    });
    if (venues.length === 0) {
      throw new NotFoundException('This organization has no venues yet');
    }

    for (const v of venues) {
      const m = await this.venueStaff.findMembership(player.id, v.id);
      if (
        m &&
        VenueStaffService.roleAtLeast(m.role, VenueStaffRole.MANAGER)
      ) {
        return true;
      }
    }

    throw new ForbiddenException('You do not have access to this organization');
  }
}
