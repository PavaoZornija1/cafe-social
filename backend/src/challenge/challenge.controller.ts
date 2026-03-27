import {
  Controller,
  Get,
  Body,
  Param,
  UnauthorizedException,
  UseGuards,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChallengeService } from './challenge.service';

@Controller('venue-context')
export class ChallengeController {
  constructor(private readonly challenges: ChallengeService) {}

  private normalizeEmail(user: any): string | null {
    const email: string | undefined =
      user?.email ?? user?.claims?.email ?? user?.claims?.identifier;

    if (email && typeof email === 'string' && email.includes('@')) return email;

    const externalId: string | undefined = user?.externalId ?? user?.claims?.sub;
    if (externalId && typeof externalId === 'string') {
      return `${externalId}@clerk.local`;
    }

    return null;
  }

  @UseGuards(JwtAuthGuard)
  @Get(':venueId/challenges')
  async getVenueChallenges(
    @Param('venueId') venueId: string,
    @CurrentUser() user: any,
  ) {
    const email = this.normalizeEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');

    return this.challenges.getVenueChallengesForPlayer(venueId, email);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':venueId/challenges/:challengeId/progress')
  async incrementProgress(
    @Param('venueId') venueId: string,
    @Param('challengeId') challengeId: string,
    @Body()
    body: { increment?: number; latitude?: number; longitude?: number },
    @CurrentUser() user: any,
  ) {
    const email = this.normalizeEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');

    return this.challenges.incrementChallengeProgress({
      venueId,
      challengeId,
      email,
      increment: body?.increment ?? 1,
      latitude: body?.latitude,
      longitude: body?.longitude,
    });
  }
}

