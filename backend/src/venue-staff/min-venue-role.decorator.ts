import { SetMetadata } from '@nestjs/common';
import { VenueStaffRole } from '@prisma/client';

export const MIN_VENUE_ROLE_KEY = 'minVenueRole';

/** Minimum role required on `VenueStaff` for the route (must use with VenueStaffGuard + :venueId param). */
export const MinVenueRole = (role: VenueStaffRole) =>
  SetMetadata(MIN_VENUE_ROLE_KEY, role);
