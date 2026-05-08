import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { WordModule } from '../word/word.module';
import { BrawlerModule } from '../brawler/brawler.module';
import { QueueBotFillService } from './queue-bot-fill.service';
import { WordMatchBotDriver } from './word-match-bot.driver';

@Module({
  imports: [ScheduleModule, PrismaModule, WordModule, BrawlerModule],
  providers: [QueueBotFillService, WordMatchBotDriver],
})
export class QueueBotModule {}
