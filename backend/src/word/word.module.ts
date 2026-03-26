import { Module } from '@nestjs/common';
import { WordController } from './word.controller';
import { WordService } from './word.service';
import { WordRepository } from './word.repository';
import { WordMatchController } from './word-match.controller';
import { WordMatchService } from './word-match.service';
import { WordMatchGateway } from './word-match.gateway';
import { DailyWordController } from './daily-word.controller';
import { DailyWordService } from './daily-word.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PlayerModule } from '../player/player.module';
import { AuthModule } from '../auth/auth.module';
import { PushModule } from '../push/push.module';
import { VenueFeedModule } from '../venue-feed/venue-feed.module';

@Module({
  imports: [PrismaModule, PlayerModule, AuthModule, PushModule, VenueFeedModule],
  controllers: [WordController, WordMatchController, DailyWordController],
  providers: [WordService, WordRepository, WordMatchService, WordMatchGateway, DailyWordService],
})
export class WordModule {}

