import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { PartnerOrgAccessService } from './partner-org-access.service';
import { PORTAL_VENUE_CONTEXT_HEADER } from './portal-context.constants';

/**
 * After {@link JwtAuthGuard} + {@link VenueStaffGuard}: blocks partner writes when
 * the venue is locked or org trial expired without payment.
 * Super admin bypasses unless `X-Portal-Venue-Context` matches the route `venueId`
 * (partner acting mode for that venue).
 */
@Injectable()
export class PartnerVenueWriteGuard implements CanActivate {
  constructor(private readonly partnerOrgAccess: PartnerOrgAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      params?: { venueId?: string };
      user?: unknown;
      headers: Record<string, string | string[] | undefined>;
    }>();
    const venueId = req.params?.venueId?.trim();
    if (!venueId) {
      return true;
    }
    const raw = req.headers[PORTAL_VENUE_CONTEXT_HEADER];
    const portalVenueContextHeader =
      typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : undefined;
    await this.partnerOrgAccess.assertPartnerMayMutateVenue(venueId, req.user, {
      portalVenueContextHeader,
    });
    return true;
  }
}
