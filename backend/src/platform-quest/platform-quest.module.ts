import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { RewardModule } from '../reward/reward.module';
import { PlatformQuestController } from './platform-quest.controller';
import { PlatformQuestService } from './platform-quest.service';

@Module({
  imports: [PrismaModule, AuthModule, forwardRef(() => RewardModule)],
  controllers: [PlatformQuestController],
  providers: [PlatformQuestService],
  exports: [PlatformQuestService],
})
export class PlatformQuestModule {}
