import {
  Body,
  Controller,
  Get,
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
import { FriendshipService } from './friendship.service';
import { DiscoveryService } from './discovery.service';
import { FriendRequestDto } from './dto/friend-request.dto';
import { FriendAcceptDto } from './dto/friend-accept.dto';
import { UpdatePresenceDto } from '../player/dto/update-presence.dto';

@Controller('social')
@UseGuards(JwtAuthGuard)
export class SocialController {
  constructor(
    private readonly players: PlayerService,
    private readonly friendships: FriendshipService,
    private readonly discovery: DiscoveryService,
  ) {}

  private email(user: unknown): string {
    const e = normalizeUserEmail(user);
    if (!e) throw new UnauthorizedException('Missing user email');
    return e;
  }

  @Post('me/presence')
  async setPresence(
    @CurrentUser() user: unknown,
    @Body() dto: UpdatePresenceDto,
  ) {
    const p = await this.players.findOrCreateByEmail(this.email(user));
    if (dto.venueId !== undefined) {
      await this.discovery.setPresence(p.id, dto.venueId ?? null);
    }
    return { ok: true as const };
  }

  @Get('venues/:venueId/people-here')
  async peopleHere(
    @CurrentUser() user: unknown,
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
  ) {
    const p = await this.players.findOrCreateByEmail(this.email(user));
    return this.discovery.peopleHere(p.id, venueId);
  }

  @Get('discover/subscribers')
  async subscriberDiscover(@CurrentUser() user: unknown) {
    const p = await this.players.findOrCreateByEmail(this.email(user));
    return this.discovery.listSubscriberDiscoverable(p.id);
  }

  @Get('friends')
  async friends(@CurrentUser() user: unknown) {
    const p = await this.players.findOrCreateByEmail(this.email(user));
    return this.friendships.listFriends(p.id);
  }

  @Get('friends/incoming')
  async incoming(@CurrentUser() user: unknown) {
    const p = await this.players.findOrCreateByEmail(this.email(user));
    return this.friendships.listIncomingPending(p.id);
  }

  @Get('friends/outgoing')
  async outgoing(@CurrentUser() user: unknown) {
    const p = await this.players.findOrCreateByEmail(this.email(user));
    return this.friendships.listOutgoingPending(p.id);
  }

  @Post('friends/request')
  async request(
    @CurrentUser() user: unknown,
    @Body() dto: FriendRequestDto,
  ) {
    const p = await this.players.findOrCreateByEmail(this.email(user));
    const created = await this.friendships.requestFriendship(
      p.id,
      dto.targetPlayerId,
    );
    return { created };
  }

  @Post('friends/accept')
  async accept(
    @CurrentUser() user: unknown,
    @Body() dto: FriendAcceptDto,
  ) {
    const p = await this.players.findOrCreateByEmail(this.email(user));
    await this.friendships.acceptFriendship(p.id, dto.otherPlayerId);
    return { ok: true as const };
  }
}
