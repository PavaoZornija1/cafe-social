import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  ParseUUIDPipe,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { normalizeUserEmail } from '../auth/user-email.util';
import { PlayerService } from '../player/player.service';
import { VenuePerkService } from './venue-perk.service';

@Controller('venue-context')
@UseGuards(JwtAuthGuard)
export class VenuePerkController {
  constructor(
    private readonly perks: VenuePerkService,
    private readonly players: PlayerService,
  ) {}

  private email(user: unknown): string {
    const e = normalizeUserEmail(user);
    if (!e) throw new UnauthorizedException('Missing user email');
    return e;
  }

  @Get(':venueId/perks')
  async listTeasers(
    @CurrentUser() user: unknown,
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
  ) {
    const player = await this.players.findOrCreateByEmail(this.email(user));
    return this.perks.listPublicTeasersForVenue(venueId, player.id);
  }

  @Post(':venueId/perks/redeem')
  async redeem(
    @CurrentUser() user: unknown,
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Body() body: { code?: string; latitude?: number; longitude?: number },
  ) {
    const player = await this.players.findOrCreateByEmail(this.email(user));
    return this.perks.redeem({
      playerId: player.id,
      venueId,
      code: body?.code ?? '',
      latitude: body?.latitude,
      longitude: body?.longitude,
    });
  }
}
