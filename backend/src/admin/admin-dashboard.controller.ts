import { Controller, Get, UseGuards } from '@nestjs/common';
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
    const [
      organizationCount,
      venueCount,
      lockedVenueCount,
      pastDueOrUnpaidOrgCount,
      canceledBillingOrgCount,
    ] = await Promise.all([
      this.prisma.venueOrganization.count(),
      this.prisma.venue.count(),
      this.prisma.venue.count({ where: { locked: true } }),
      this.prisma.venueOrganization.count({
        where: {
          platformBillingStatus: { in: ['PAST_DUE', 'UNPAID'] },
        },
      }),
      this.prisma.venueOrganization.count({
        where: { platformBillingStatus: 'CANCELED' },
      }),
    ]);

    return {
      organizationCount,
      venueCount,
      lockedVenueCount,
      /** Stripe / franchise billing needs attention */
      pastDueOrUnpaidOrgCount,
      canceledBillingOrgCount,
    };
  }
}
