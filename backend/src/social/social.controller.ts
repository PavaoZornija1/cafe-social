import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { normalizeUserEmail } from '../auth/user-email.util';
import { PlayerService } from '../player/player.service';
import { FriendshipService } from './friendship.service';
import { DiscoveryService } from './discovery.service';
import { VenueFeedService } from '../venue-feed/venue-feed.service';
import { FriendRequestDto } from './dto/friend-request.dto';
import { FriendRequestByUsernameDto } from './dto/friend-request-by-username.dto';
import { FriendAcceptDto } from './dto/friend-accept.dto';
import { UpdatePresenceDto } from '../player/dto/update-presence.dto';
import { utcDayKeyDaysAgo } from '../lib/engagement-dates';

@Controller('social')
@UseGuards(JwtAuthGuard)
export class SocialController {
  constructor(
    private readonly players: PlayerService,
    private readonly friendships: FriendshipService,
    private readonly discovery: DiscoveryService,
    private readonly venueFeedService: VenueFeedService,
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

  /**
   * Count of **accepted friends** with at least one visit day at this venue in the last 30 UTC days
   * (`PlayerVenueVisitDay`). Privacy-safe aggregate.
   */
  @Get('venues/:venueId/friends-visit-summary')
  async friendsVisitSummary(
    @CurrentUser() user: unknown,
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
  ) {
    const p = await this.players.findOrCreateByEmail(this.email(user));
    const sinceDayKey = utcDayKeyDaysAgo(30);
    const friendsWithVisits = await this.discovery.countFriendsWithVisitsSince(
      p.id,
      venueId,
      sinceDayKey,
    );
    return { friendsWithVisitsLast30Days: friendsWithVisits, sinceDayKey };
  }

  @Get('venues/:venueId/feed')
  async venueFeed(
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Query('limit') limitRaw?: string,
  ) {
    let limit = 30;
    if (limitRaw !== undefined && limitRaw !== '') {
      const n = Number.parseInt(limitRaw, 10);
      if (!Number.isNaN(n)) limit = n;
    }
    return this.venueFeedService.listForVenue(venueId, limit);
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

  @Delete('friends/outgoing/:friendshipId')
  async cancelOutgoing(
    @CurrentUser() user: unknown,
    @Param('friendshipId', new ParseUUIDPipe()) friendshipId: string,
  ) {
    const p = await this.players.findOrCreateByEmail(this.email(user));
    await this.friendships.cancelOutgoingRequest(p.id, friendshipId);
    return { ok: true as const };
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

  @Post('friends/request-by-username')
  async requestByUsername(
    @CurrentUser() user: unknown,
    @Body() dto: FriendRequestByUsernameDto,
  ) {
    const p = await this.players.findOrCreateByEmail(this.email(user));
    const target = await this.players.findByUsernameInsensitive(dto.username);
    if (!target) {
      throw new NotFoundException('No player with that username');
    }
    if (target.id === p.id) {
      throw new BadRequestException('Cannot friend yourself');
    }
    const created = await this.friendships.requestFriendship(p.id, target.id);
    return { created, targetPlayerId: target.id, targetUsername: target.username };
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
