import { Body, Controller, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { ClerkOrBackgroundAuthGuard } from '../auth/clerk-or-background-auth.guard';
import { normalizeUserEmail } from '../auth/user-email.util';
import { PlayerService } from '../player/player.service';
import { GeofenceEventDto } from './dto/geofence-event.dto';
import { GeofenceService } from './geofence.service';

/**
 * OS geofence enter/exit — must accept long-lived background tokens (app killed).
 * Kept separate from {@link SocialController} so other social routes stay Clerk-only.
 */
@Controller('social')
@UseGuards(ClerkOrBackgroundAuthGuard)
export class SocialGeofenceController {
  constructor(
    private readonly players: PlayerService,
    private readonly geofence: GeofenceService,
  ) {}

  @Post('me/geofence-event')
  async recordGeofenceEvent(
    @CurrentUser() user: unknown,
    @Body() dto: GeofenceEventDto,
  ) {
    const email = normalizeUserEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    const p = await this.players.findOrCreateByEmail(email);
    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : undefined;
    return this.geofence.recordEvent({
      playerId: p.id,
      venueId: dto.venueId,
      kind: dto.kind,
      occurredAt,
      clientDedupeKey: dto.clientDedupeKey,
    });
  }
}
