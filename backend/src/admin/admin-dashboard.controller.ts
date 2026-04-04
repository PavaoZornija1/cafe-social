import { Controller, Get, UseGuards } from '@nestjs/common';
import { VenueOrganizationKind } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformSuperAdminGuard } from '../auth/platform-super-admin.guard';
import { PrismaService } from '../prisma/prisma.service';

/**
 * High-level platform metrics for the internal admin dashboard.
 */
@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, PlatformSuperAdminGuard)
export class AdminDashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('metrics')
  async metrics() {
    const pastDueStatuses = ['PAST_DUE', 'UNPAID'];

    const [
      organizationCount,
      singleLocationOrganizationCount,
      multiLocationOrganizationCount,
      venueCount,
      venuesInSingleLocationOrganizations,
      venuesInMultiLocationOrganizations,
      venuesWithoutOrganization,
      lockedVenueCount,
      lockedVenuesInSingleLocationOrganizations,
      lockedVenuesInMultiLocationOrganizations,
      lockedVenuesWithoutOrganization,
      pastDueOrUnpaidOrgCount,
      pastDueOrUnpaidSingleLocationOrgCount,
      pastDueOrUnpaidMultiLocationOrgCount,
      canceledBillingOrgCount,
      canceledBillingSingleLocationOrgCount,
      canceledBillingMultiLocationOrgCount,
    ] = await Promise.all([
      this.prisma.venueOrganization.count(),
      this.prisma.venueOrganization.count({
        where: { locationKind: VenueOrganizationKind.SINGLE_LOCATION },
      }),
      this.prisma.venueOrganization.count({
        where: { locationKind: VenueOrganizationKind.MULTI_LOCATION },
      }),
      this.prisma.venue.count(),
      this.prisma.venue.count({
        where: { organization: { locationKind: VenueOrganizationKind.SINGLE_LOCATION } },
      }),
      this.prisma.venue.count({
        where: { organization: { locationKind: VenueOrganizationKind.MULTI_LOCATION } },
      }),
      this.prisma.venue.count({ where: { organizationId: null } }),
      this.prisma.venue.count({ where: { locked: true } }),
      this.prisma.venue.count({
        where: {
          locked: true,
          organization: { locationKind: VenueOrganizationKind.SINGLE_LOCATION },
        },
      }),
      this.prisma.venue.count({
        where: {
          locked: true,
          organization: { locationKind: VenueOrganizationKind.MULTI_LOCATION },
        },
      }),
      this.prisma.venue.count({ where: { locked: true, organizationId: null } }),
      this.prisma.venueOrganization.count({
        where: { platformBillingStatus: { in: pastDueStatuses } },
      }),
      this.prisma.venueOrganization.count({
        where: {
          platformBillingStatus: { in: pastDueStatuses },
          locationKind: VenueOrganizationKind.SINGLE_LOCATION,
        },
      }),
      this.prisma.venueOrganization.count({
        where: {
          platformBillingStatus: { in: pastDueStatuses },
          locationKind: VenueOrganizationKind.MULTI_LOCATION,
        },
      }),
      this.prisma.venueOrganization.count({
        where: { platformBillingStatus: 'CANCELED' },
      }),
      this.prisma.venueOrganization.count({
        where: {
          platformBillingStatus: 'CANCELED',
          locationKind: VenueOrganizationKind.SINGLE_LOCATION,
        },
      }),
      this.prisma.venueOrganization.count({
        where: {
          platformBillingStatus: 'CANCELED',
          locationKind: VenueOrganizationKind.MULTI_LOCATION,
        },
      }),
    ]);

    return {
      organizationCount,
      singleLocationOrganizationCount,
      multiLocationOrganizationCount,
      venueCount,
      venuesInSingleLocationOrganizations,
      venuesInMultiLocationOrganizations,
      venuesWithoutOrganization,
      lockedVenueCount,
      lockedVenuesInSingleLocationOrganizations,
      lockedVenuesInMultiLocationOrganizations,
      lockedVenuesWithoutOrganization,
      pastDueOrUnpaidOrgCount,
      pastDueOrUnpaidSingleLocationOrgCount,
      pastDueOrUnpaidMultiLocationOrgCount,
      canceledBillingOrgCount,
      canceledBillingSingleLocationOrgCount,
      canceledBillingMultiLocationOrgCount,
    };
  }
}
