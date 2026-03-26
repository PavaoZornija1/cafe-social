import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { VenueFeedService } from './venue-feed.service';

@Module({
  imports: [PrismaModule],
  providers: [VenueFeedService],
  exports: [VenueFeedService],
})
export class VenueFeedModule {}
