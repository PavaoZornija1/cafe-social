import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StaffRedemptionsController } from './staff-redemptions.controller';
import { StaffRedemptionsService } from './staff-redemptions.service';

@Module({
  imports: [PrismaModule],
  controllers: [StaffRedemptionsController],
  providers: [StaffRedemptionsService],
  exports: [StaffRedemptionsService],
})
export class StaffModule {}
