import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StaffRedemptionsService } from './staff-redemptions.service';

@Module({
  imports: [PrismaModule],
  providers: [StaffRedemptionsService],
  exports: [StaffRedemptionsService],
})
export class StaffModule {}
