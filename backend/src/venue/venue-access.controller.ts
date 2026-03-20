import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VenueAccessService } from './venue-access.service';

@Controller('venue-context')
export class VenueAccessController {
  constructor(private readonly access: VenueAccessService) {}

  private normalizeEmail(user: any): string | null {
    const email: string | undefined =
      user?.email ?? user?.claims?.email ?? user?.claims?.identifier;

    if (email && typeof email === 'string' && email.includes('@')) return email;

    const externalId: string | undefined = user?.externalId ?? user?.claims?.sub;
    if (externalId && typeof externalId === 'string') {
      return `${externalId}@clerk.local`;
    }

    return null;
  }

  @Get('detect')
  detect(@Query('lat') latRaw?: string, @Query('lng') lngRaw?: string) {
    const lat = latRaw !== undefined && latRaw !== '' ? Number(latRaw) : NaN;
    const lng = lngRaw !== undefined && lngRaw !== '' ? Number(lngRaw) : NaN;
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
    return this.access.detectVenue(
      hasCoords ? lat : undefined,
      hasCoords ? lng : undefined,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':venueId/access')
  getAccess(@Param('venueId') venueId: string, @CurrentUser() user: any) {
    return this.access.getVenueAccess(venueId, this.normalizeEmail(user));
  }

  @UseGuards(JwtAuthGuard)
  @Post(':venueId/register')
  registerWithQr(
    @Param('venueId') venueId: string,
    @CurrentUser() user: any,
  ) {
    return this.access.registerVenueWithQr(
      venueId,
      this.normalizeEmail(user),
    );
  }
}

