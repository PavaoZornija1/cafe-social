import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { VenueStaffService } from './venue-staff.service';
import { VenueStaffGuard } from './venue-staff.guard';

@Module({
  imports: [PrismaModule],
  providers: [VenueStaffService, VenueStaffGuard],
  exports: [VenueStaffService, VenueStaffGuard],
})
export class VenueStaffModule {}
