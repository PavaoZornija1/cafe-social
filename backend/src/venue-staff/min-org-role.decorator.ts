import { SetMetadata } from '@nestjs/common';
import { VenueStaffRole } from '@prisma/client';

export const MIN_ORG_ROLE_KEY = 'minOrgRole';

/**
 * Minimum role required on any venue of the organization for the route
 * (use with OrganizationStaffGuard + :organizationId param). Defaults to
 * MANAGER when absent, matching the guard's historical behavior.
 */
export const MinOrgRole = (role: VenueStaffRole) =>
  SetMetadata(MIN_ORG_ROLE_KEY, role);
