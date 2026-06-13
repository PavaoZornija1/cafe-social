import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { normalizeUserEmail } from '../auth/user-email.util';
import type { QuestPeriod } from './platform-quest.definitions';
import { PlatformQuestService } from './platform-quest.service';

function parsePeriod(raw?: string): QuestPeriod {
  return raw === 'weekly' ? 'weekly' : 'daily';
}

@Controller('players/me/platform-quests')
@UseGuards(JwtAuthGuard)
export class PlatformQuestController {
  constructor(private readonly quests: PlatformQuestService) {}

  private email(user: unknown): string {
    const email = normalizeUserEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    return email;
  }

  @Get()
  hub(@CurrentUser() user: unknown, @Query('period') periodRaw?: string) {
    return this.quests.getHub(this.email(user), parsePeriod(periodRaw));
  }

  @Post(':questKey/claim')
  claim(
    @CurrentUser() user: unknown,
    @Param('questKey') questKey: string,
    @Query('period') periodRaw?: string,
  ) {
    return this.quests.claimQuest(this.email(user), parsePeriod(periodRaw), questKey);
  }
}
