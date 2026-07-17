import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BrawlerService } from './brawler.service';

@Injectable()
export class BrawlerCleanupService {
  private readonly log = new Logger(BrawlerCleanupService.name);

  constructor(private readonly brawler: BrawlerService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async expireStaleQueueEntries(): Promise<void> {
    try {
      const n = await this.brawler.expireStaleBrawlerQueueEntries();
      if (n > 0) {
        this.log.log(`Cancelled ${n} stale WAITING brawler queue entr${n === 1 ? 'y' : 'ies'}`);
      }
    } catch (e) {
      this.log.warn(`expireStaleBrawlerQueueEntries: ${(e as Error).message}`);
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async reapStaleActiveSessions(): Promise<void> {
    try {
      const n = await this.brawler.reapStaleActiveBrawlerSessions();
      if (n > 0) {
        this.log.log(`Cancelled ${n} stale ACTIVE brawler session(s)`);
      }
    } catch (e) {
      this.log.warn(`reapStaleActiveBrawlerSessions: ${(e as Error).message}`);
    }
  }
}
