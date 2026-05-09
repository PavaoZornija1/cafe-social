import {
  Body,
  Controller,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { normalizeUserEmail } from '../auth/user-email.util';
import { InviteService } from './invite.service';
import { RedeemInviteDto } from './dto/redeem-invite.dto';

@Controller('invites')
@UseGuards(JwtAuthGuard)
export class InvitesController {
  constructor(private readonly invites: InviteService) {}

  private email(user: unknown): string {
    const e = normalizeUserEmail(user);
    if (!e) throw new UnauthorizedException('Missing user email');
    return e;
  }

  @Post('redeem')
  @UseGuards(ThrottlerGuard)
  @Throttle({ redeem: { limit: 20, ttl: 60000 } })
  redeem(@CurrentUser() user: unknown, @Body() dto: RedeemInviteDto) {
    return this.invites.redeemToken(this.email(user), dto.token);
  }

  @Post('friend-link')
  @UseGuards(ThrottlerGuard)
  @Throttle({ friend: { limit: 20, ttl: 60000 } })
  createFriendLink(@CurrentUser() user: unknown) {
    return this.invites.createFriendInvite(this.email(user));
  }
}
