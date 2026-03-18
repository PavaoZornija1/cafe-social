import { Module } from '@nestjs/common';
import { ChallengeController } from './challenge.controller';
import { ChallengeRepository } from './challenge.repository';
import { ChallengeService } from './challenge.service';
import { PlayerModule } from '../player/player.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, PlayerModule, AuthModule],
  controllers: [ChallengeController],
  providers: [ChallengeRepository, ChallengeService],
})
export class ChallengeModule {}

