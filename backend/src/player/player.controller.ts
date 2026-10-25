import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { normalizeUserEmail } from '../auth/user-email.util';
import { PlayerService } from './player.service';
import { UpdateMeSettingsDto } from './dto/update-me-settings.dto';
import { UpdateMeOnboardingDto } from './dto/update-me-onboarding.dto';
import { RegisterExpoPushTokenDto } from './dto/register-expo-push-token.dto';
import { CreateBanAppealDto } from './dto/create-ban-appeal.dto';
import { PushService } from '../push/push.service';
import { VenueModerationService } from '../venue/venue-moderation.service';
import { BackgroundTokenService } from '../auth/background-token.service';

@Controller('players')
@UseGuards(JwtAuthGuard)
export class PlayerController {
  constructor(
    private readonly playerService: PlayerService,
    private readonly pushService: PushService,
    private readonly venueModeration: VenueModerationService,
    private readonly backgroundTokens: BackgroundTokenService,
  ) {}

  private normalizeEmail(user: unknown): string | null {
    return normalizeUserEmail(user);
  }

  @Get('me/member-card')
  meMemberCard(@CurrentUser() user: unknown) {
    const email = this.normalizeEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    return this.playerService.getMeMemberCard(email);
  }

  @Get('me/summary')
  meSummary(@CurrentUser() user: unknown) {
    const email = this.normalizeEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    return this.playerService.getMeSummary(email);
  }

  @Get('me/engagement')
  meEngagement(
    @CurrentUser() user: unknown,
    @Query('venueId') venueId?: string,
  ) {
    const email = this.normalizeEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    return this.playerService.getMeEngagement(email, venueId?.trim() || undefined);
  }

  @Get('me/perk-redemptions')
  mePerkRedemptions(@CurrentUser() user: unknown) {
    const email = this.normalizeEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    return this.playerService.listMyPerkRedemptions(email);
  }

  @Get('me/reward-claims')
  meRewardClaims(@CurrentUser() user: unknown) {
    const email = this.normalizeEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    return this.playerService.listMyRewardClaimsHub(email);
  }

  @Patch('me/settings')
  meSettings(@CurrentUser() user: unknown, @Body() dto: UpdateMeSettingsDto) {
    const email = this.normalizeEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    return this.playerService.updateMeSettings(email, dto);
  }

  @Patch('me/onboarding')
  meOnboarding(@CurrentUser() user: unknown, @Body() dto: UpdateMeOnboardingDto) {
    const email = this.normalizeEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    return this.playerService.updateMeOnboarding(email, {
      playerComplete: dto.playerComplete,
      staffComplete: dto.staffComplete,
    });
  }

  @Post('me/push-token')
  async registerExpoPushToken(
    @CurrentUser() user: unknown,
    @Body() dto: RegisterExpoPushTokenDto,
  ) {
    const email = this.normalizeEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    const p = await this.playerService.findOrCreateByEmail(email);
    await this.pushService.registerPlayerToken(p.id, dto.expoPushToken);
    return { ok: true };
  }

  @Get('me/ban-appeals')
  async listMyBanAppeals(@CurrentUser() user: unknown) {
    const email = this.normalizeEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    const player = await this.playerService.findOrCreateByEmail(email);
    return this.playerService.listMyBanAppeals(player.id);
  }

  @Post('me/ban-appeals')
  async createMyBanAppeal(
    @CurrentUser() user: unknown,
    @Body() dto: CreateBanAppealDto,
  ) {
    const email = this.normalizeEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    const player = await this.playerService.findOrCreateByEmail(email);
    return this.venueModeration.createBanAppeal(player.id, dto.venueId, dto.message);
  }

  @Get('me/venue-reports')
  async listMyVenueReports(@CurrentUser() user: unknown) {
    const email = this.normalizeEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    const player = await this.playerService.findOrCreateByEmail(email);
    return this.playerService.listMyFiledVenueReports(player.id);
  }

  @Get('me/blocks')
  async listMyBlocks(@CurrentUser() user: unknown) {
    const email = this.normalizeEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    const player = await this.playerService.findOrCreateByEmail(email);
    return this.playerService.listBlockedPlayers(player.id);
  }

  @Post('me/blocks/:blockedPlayerId')
  async addMyBlock(
    @CurrentUser() user: unknown,
    @Param('blockedPlayerId', new ParseUUIDPipe()) blockedPlayerId: string,
  ) {
    const email = this.normalizeEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    const player = await this.playerService.findOrCreateByEmail(email);
    await this.playerService.addPlayerBlock(player.id, blockedPlayerId);
    return { ok: true as const };
  }

  @Delete('me/blocks/:blockedPlayerId')
  async removeMyBlock(
    @CurrentUser() user: unknown,
    @Param('blockedPlayerId', new ParseUUIDPipe()) blockedPlayerId: string,
  ) {
    const email = this.normalizeEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    const player = await this.playerService.findOrCreateByEmail(email);
    await this.playerService.removePlayerBlock(player.id, blockedPlayerId);
    return { ok: true as const };
  }

  @Delete('me/push-token')
  async removeExpoPushToken(
    @CurrentUser() user: unknown,
    @Query('expoPushToken') expoPushToken?: string,
  ) {
    const token = expoPushToken?.trim();
    if (!token) {
      throw new BadRequestException('Query param expoPushToken is required');
    }
    const email = this.normalizeEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    const p = await this.playerService.findOrCreateByEmail(email);
    await this.pushService.removeToken(p.id, token);
    return { ok: true };
  }

  /**
   * Long-lived token for OS geofence callbacks while the app is backgrounded/killed.
   * Replaces any previous background token for this player.
   */
  @Post('me/background-token')
  async issueBackgroundToken(@CurrentUser() user: unknown) {
    const email = this.normalizeEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    const p = await this.playerService.findOrCreateByEmail(email);
    return this.backgroundTokens.issueForPlayer(p.id);
  }

  @Delete('me/background-token')
  async revokeBackgroundToken(@CurrentUser() user: unknown) {
    const email = this.normalizeEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    const p = await this.playerService.findOrCreateByEmail(email);
    await this.backgroundTokens.revokeForPlayer(p.id);
    return { ok: true as const };
  }

  /** Permanently delete the signed-in player profile and Clerk auth user. */
  @Delete('me')
  async deleteMe(@CurrentUser() user: unknown) {
    const email = this.normalizeEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    const u = user as { externalId?: string; claims?: { sub?: string } };
    const clerkUserId = u.externalId ?? u.claims?.sub;
    if (!clerkUserId || typeof clerkUserId !== 'string') {
      throw new UnauthorizedException('Missing user id');
    }
    return this.playerService.deleteMyAccount(email, clerkUserId);
  }

}
