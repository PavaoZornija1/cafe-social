import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { VenueStaffService } from './venue-staff.service';

/**
 * Cycle-safe home for {@link VenueStaffService} (Prisma-only dependency).
 * Modules that only need staff-membership lookups (e.g. StatsModule) import
 * this instead of {@link VenueStaffModule}, whose AuthModule/PlayerModule
 * imports would create player -> stats -> venue-staff -> player cycles.
 */
@Module({
  imports: [PrismaModule],
  providers: [VenueStaffService],
  exports: [VenueStaffService],
})
export class VenueStaffCoreModule {}
