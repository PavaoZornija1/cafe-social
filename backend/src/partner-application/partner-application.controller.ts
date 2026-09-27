import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { normalizeUserEmail } from '../auth/user-email.util';
import { PlayerService } from '../player/player.service';
import { CreatePartnerApplicationDto } from './dto/create-partner-application.dto';
import { PartnerApplicationService } from './partner-application.service';
import { PartnerApplicationThrottlerFilter } from './partner-application-throttle.filter';

@Controller('partner-applications')
export class PartnerApplicationController {
  constructor(
    private readonly applications: PartnerApplicationService,
    private readonly players: PlayerService,
  ) {}

  @Post()
  @UseFilters(PartnerApplicationThrottlerFilter)
  @UseGuards(ThrottlerGuard)
  @Throttle({ onboarding: { limit: 8, ttl: 60000 } })
  async submit(@Body() body: CreatePartnerApplicationDto) {
    return this.applications.createPublicApplication(body);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: unknown) {
    const email = normalizeUserEmail(user);
    if (!email) {
      throw new ForbiddenException('Missing user email');
    }
    const latest = await this.applications.getLatestForEmail(email);
    if (!latest) {
      return { application: null };
    }
    return { application: latest };
  }
}
