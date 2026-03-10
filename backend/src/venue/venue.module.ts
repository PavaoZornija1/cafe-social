import { Module } from '@nestjs/common';
import { VenueController } from './venue.controller';
import { VenueService } from './venue.service';
import { VenueRepository } from './venue.repository';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [VenueController],
  providers: [VenueService, VenueRepository],
  exports: [VenueService],
})
export class VenueModule {}

