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
import { VenueReceiptService } from './venue-receipt.service';

@Controller('venue-context')
@UseGuards(JwtAuthGuard)
export class VenueReceiptController {
  constructor(
    private readonly receipts: VenueReceiptService,
    private readonly players: PlayerService,
  ) {}

  private email(user: unknown): string {
    const e = normalizeUserEmail(user);
    if (!e) throw new UnauthorizedException('Missing user email');
    return e;
  }

  @Post(':venueId/receipts')
  async submit(
    @CurrentUser() user: unknown,
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Body()
    body: {
      imageData?: string;
      mimeType?: string;
      notePlayer?: string;
      latitude?: number;
      longitude?: number;
    },
  ) {
    const player = await this.players.findOrCreateByEmail(this.email(user));
    return this.receipts.submit({
      playerId: player.id,
      venueId,
      imageData: body?.imageData ?? '',
      mimeType: body?.mimeType,
      notePlayer: body?.notePlayer,
      latitude: body?.latitude,
      longitude: body?.longitude,
    });
  }
}
