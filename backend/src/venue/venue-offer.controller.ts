import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { normalizeUserEmail } from '../auth/user-email.util';
import { PlayerService } from '../player/player.service';
import { VenueOfferService } from './venue-offer.service';

@Controller('venue-context')
@UseGuards(JwtAuthGuard)
export class VenueOfferController {
  constructor(
    private readonly offers: VenueOfferService,
    private readonly players: PlayerService,
  ) {}

  private email(user: unknown): string {
    const e = normalizeUserEmail(user);
    if (!e) throw new UnauthorizedException('Missing user email');
    return e;
  }

  @Post(':venueId/offers/:offerId/redeem')
  async redeem(
    @CurrentUser() user: unknown,
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Param('offerId', new ParseUUIDPipe()) offerId: string,
    @Body() body: { latitude?: number; longitude?: number },
  ) {
    const player = await this.players.findOrCreateByEmail(this.email(user));
    return this.offers.redeem({
      playerId: player.id,
      venueId,
      offerId,
      latitude: body?.latitude,
      longitude: body?.longitude,
    });
  }
}
