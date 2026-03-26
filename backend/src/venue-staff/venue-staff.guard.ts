import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { VenueStaffRole } from '@prisma/client';
import { normalizeUserEmail } from '../auth/user-email.util';
import { MIN_VENUE_ROLE_KEY } from './min-venue-role.decorator';
import { VenueStaffService } from './venue-staff.service';

@Injectable()
export class VenueStaffGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly venueStaff: VenueStaffService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const minRole = this.reflector.getAllAndOverride<VenueStaffRole>(
      MIN_VENUE_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (minRole === undefined) {
      throw new InternalServerErrorException(
        'VenueStaffGuard requires @MinVenueRole() on the route handler',
      );
    }

    const req = context.switchToHttp().getRequest<{
      user?: unknown;
      params: Record<string, string | undefined>;
    }>();
    const email = normalizeUserEmail(req.user);
    if (!email) throw new UnauthorizedException('Missing user email');

    const venueId = req.params.venueId;
    if (!venueId?.trim()) {
      throw new BadRequestException('venueId route param is required');
    }

    const membership = await this.venueStaff.findMembershipForEmail(
      email,
      venueId,
    );
    if (!membership) {
      throw new ForbiddenException('You do not have access to this venue');
    }
    if (!VenueStaffService.roleAtLeast(membership.role, minRole)) {
      throw new ForbiddenException('Insufficient permissions for this venue');
    }

    (req as unknown as { venueStaffMembership: typeof membership }).venueStaffMembership =
      membership;
    return true;
  }
}
