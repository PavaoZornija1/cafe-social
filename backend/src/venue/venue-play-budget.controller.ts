import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { normalizeUserEmail } from '../auth/user-email.util';
import { PrismaService } from '../prisma/prisma.service';
import { VenuePlayBudgetService } from './venue-play-budget.service';
import { BeginVenueActivePlayDto } from './dto/begin-venue-active-play.dto';
import { TickVenueActivePlayDto } from './dto/tick-venue-active-play.dto';
import { EndVenueActivePlayDto } from './dto/end-venue-active-play.dto';
import { ClaimVenuePlayBudgetIapDto } from './dto/claim-venue-play-budget-iap.dto';

@Controller('venue-play-budget')
@UseGuards(JwtAuthGuard)
export class VenuePlayBudgetController {
  constructor(
    private readonly budget: VenuePlayBudgetService,
    private readonly prisma: PrismaService,
  ) {}

  private async playerIdFromUser(user: unknown): Promise<string> {
    const email = normalizeUserEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    const p = await this.prisma.player.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!p) throw new UnauthorizedException('Player not found');
    return p.id;
  }

  @Get('me')
  async me(
    @CurrentUser() user: unknown,
    @Query('venueId') venueId: string,
    @Query('lat') latRaw?: string,
    @Query('lng') lngRaw?: string,
  ) {
    if (!venueId?.trim()) {
      throw new BadRequestException('venueId is required');
    }
    const playerId = await this.playerIdFromUser(user);
    const lat = latRaw !== undefined && latRaw !== '' ? Number(latRaw) : NaN;
    const lng = lngRaw !== undefined && lngRaw !== '' ? Number(lngRaw) : NaN;
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
    return this.budget.getMeVenueBudget({
      playerId,
      venueId: venueId.trim(),
      latitude: hasCoords ? lat : undefined,
      longitude: hasCoords ? lng : undefined,
    });
  }

  @Post('active-play/begin')
  async begin(@CurrentUser() user: unknown, @Body() dto: BeginVenueActivePlayDto) {
    const playerId = await this.playerIdFromUser(user);
    return this.budget.beginActivePlaySession(playerId, dto);
  }

  @Post('active-play/tick')
  async tick(@CurrentUser() user: unknown, @Body() dto: TickVenueActivePlayDto) {
    const playerId = await this.playerIdFromUser(user);
    return this.budget.tickActivePlaySession(
      playerId,
      dto.sessionId,
      dto.latitude,
      dto.longitude,
    );
  }

  @Post('active-play/end')
  async end(@CurrentUser() user: unknown, @Body() dto: EndVenueActivePlayDto) {
    const playerId = await this.playerIdFromUser(user);
    await this.budget.endActivePlaySession(playerId, dto.sessionId);
    return { ok: true as const };
  }

  @Post('iap/claim')
  async claimIap(@CurrentUser() user: unknown, @Body() dto: ClaimVenuePlayBudgetIapDto) {
    const playerId = await this.playerIdFromUser(user);
    return this.budget.claimIapGrant(playerId, dto);
  }
}
