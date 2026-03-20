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
import { PartyService } from './party.service';
import { CreatePartyDto } from './dto/create-party.dto';
import { TransferLeadershipDto } from './dto/transfer-leadership.dto';
import { KickMemberDto } from './dto/kick-member.dto';
import { InviteFriendDto } from './dto/invite-friend.dto';
import { RevokeInviteLinkDto } from './dto/revoke-invite-link.dto';

@Controller('parties')
@UseGuards(JwtAuthGuard)
export class PartyController {
  constructor(private readonly parties: PartyService) {}

  private email(user: unknown): string {
    const e = normalizeUserEmail(user);
    if (!e) throw new UnauthorizedException('Missing user email');
    return e;
  }

  @Post()
  create(@CurrentUser() user: unknown, @Body() dto: CreatePartyDto) {
    return this.parties.createParty(this.email(user), dto.name);
  }

  @Get('mine')
  listMine(@CurrentUser() user: unknown) {
    return this.parties.listMyParties(this.email(user));
  }

  @Get(':partyId')
  getOne(
    @CurrentUser() user: unknown,
    @Param('partyId', new ParseUUIDPipe()) partyId: string,
  ) {
    return this.parties.getParty(partyId, this.email(user));
  }

  @Post(':partyId/leave')
  leave(
    @CurrentUser() user: unknown,
    @Param('partyId', new ParseUUIDPipe()) partyId: string,
  ) {
    return this.parties.leaveParty(partyId, this.email(user));
  }

  @Post(':partyId/transfer-leadership')
  transfer(
    @CurrentUser() user: unknown,
    @Param('partyId', new ParseUUIDPipe()) partyId: string,
    @Body() dto: TransferLeadershipDto,
  ) {
    return this.parties.transferLeadership(
      partyId,
      this.email(user),
      dto.newLeaderId,
    );
  }

  @Post(':partyId/kick')
  kick(
    @CurrentUser() user: unknown,
    @Param('partyId', new ParseUUIDPipe()) partyId: string,
    @Body() dto: KickMemberDto,
  ) {
    return this.parties.kickMember(partyId, this.email(user), dto.targetPlayerId);
  }

  @Post(':partyId/invite-friend')
  inviteFriend(
    @CurrentUser() user: unknown,
    @Param('partyId', new ParseUUIDPipe()) partyId: string,
    @Body() dto: InviteFriendDto,
  ) {
    return this.parties.inviteFriendToParty(
      partyId,
      this.email(user),
      dto.friendPlayerId,
    );
  }

  @Post(':partyId/invite-link')
  createInviteLink(
    @CurrentUser() user: unknown,
    @Param('partyId', new ParseUUIDPipe()) partyId: string,
  ) {
    return this.parties.createPartyInviteLink(partyId, this.email(user));
  }

  @Post(':partyId/revoke-invite-link')
  revokeInviteLink(
    @CurrentUser() user: unknown,
    @Param('partyId', new ParseUUIDPipe()) partyId: string,
    @Body() dto: RevokeInviteLinkDto,
  ) {
    return this.parties.revokePartyInviteLink(
      partyId,
      this.email(user),
      dto.linkId,
    );
  }

  @Post(':partyId/mesh-friend-requests')
  meshFriends(
    @CurrentUser() user: unknown,
    @Param('partyId', new ParseUUIDPipe()) partyId: string,
  ) {
    return this.parties.meshFriendRequests(partyId, this.email(user));
  }
}
