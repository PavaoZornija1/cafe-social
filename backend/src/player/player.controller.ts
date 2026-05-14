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
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { UpdateMeSettingsDto } from './dto/update-me-settings.dto';
import { UpdateMeOnboardingDto } from './dto/update-me-onboarding.dto';
import { RegisterExpoPushTokenDto } from './dto/register-expo-push-token.dto';
import { CreateBanAppealDto } from './dto/create-ban-appeal.dto';
import { PushService } from '../push/push.service';
import { VenueModerationService } from '../venue/venue-moderation.service';

@Controller('players')
export class PlayerController {
  constructor(
    private readonly playerService: PlayerService,
    private readonly pushService: PushService,
    private readonly venueModeration: VenueModerationService,
  ) {}

  private normalizeEmail(user: unknown): string | null {
    return normalizeUserEmail(user);
  }

  @Post()
  create(@Body() dto: CreatePlayerDto) {
    return this.playerService.create(dto);
  }

  @Get()
  findAll() {
    return this.playerService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/summary')
  meSummary(@CurrentUser() user: unknown) {
    const email = this.normalizeEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    return this.playerService.getMeSummary(email);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/engagement')
  meEngagement(@CurrentUser() user: unknown) {
    const email = this.normalizeEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    return this.playerService.getMeEngagement(email);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/perk-redemptions')
  mePerkRedemptions(@CurrentUser() user: unknown) {
    const email = this.normalizeEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    return this.playerService.listMyPerkRedemptions(email);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/reward-claims')
  meRewardClaims(@CurrentUser() user: unknown) {
    const email = this.normalizeEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    return this.playerService.listMyRewardClaimsHub(email);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/settings')
  meSettings(@CurrentUser() user: unknown, @Body() dto: UpdateMeSettingsDto) {
    const email = this.normalizeEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    return this.playerService.updateMeSettings(email, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/onboarding')
  meOnboarding(@CurrentUser() user: unknown, @Body() dto: UpdateMeOnboardingDto) {
    const email = this.normalizeEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    return this.playerService.updateMeOnboarding(email, {
      playerComplete: dto.playerComplete,
      staffComplete: dto.staffComplete,
    });
  }

  @UseGuards(JwtAuthGuard)
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

  @UseGuards(JwtAuthGuard)
  @Get('me/ban-appeals')
  async listMyBanAppeals(@CurrentUser() user: unknown) {
    const email = this.normalizeEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    const player = await this.playerService.findOrCreateByEmail(email);
    return this.playerService.listMyBanAppeals(player.id);
  }

  @UseGuards(JwtAuthGuard)
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

  @UseGuards(JwtAuthGuard)
  @Get('me/venue-reports')
  async listMyVenueReports(@CurrentUser() user: unknown) {
    const email = this.normalizeEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    const player = await this.playerService.findOrCreateByEmail(email);
    return this.playerService.listMyFiledVenueReports(player.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/blocks')
  async listMyBlocks(@CurrentUser() user: unknown) {
    const email = this.normalizeEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    const player = await this.playerService.findOrCreateByEmail(email);
    return this.playerService.listBlockedPlayers(player.id);
  }

  @UseGuards(JwtAuthGuard)
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

  @UseGuards(JwtAuthGuard)
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

  @UseGuards(JwtAuthGuard)
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

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.playerService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePlayerDto) {
    return this.playerService.update(id, dto);
  }
}

