import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GeocodeService } from './geocode.service';

@Controller('geocode')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
export class GeocodeController {
  constructor(private readonly geocode: GeocodeService) {}

  /** Forward geocode for partner portal address search (Mapbox, server-side). */
  @Get('search')
  @Throttle({ geocode: { limit: 40, ttl: 60000 } })
  search(
    @Query('q') q?: string,
    @Query('country') country?: string,
    @Query('proximityLng') proximityLngRaw?: string,
    @Query('proximityLat') proximityLatRaw?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const proximityLng =
      proximityLngRaw !== undefined && proximityLngRaw !== ''
        ? Number.parseFloat(proximityLngRaw)
        : undefined;
    const proximityLat =
      proximityLatRaw !== undefined && proximityLatRaw !== ''
        ? Number.parseFloat(proximityLatRaw)
        : undefined;
    const limit =
      limitRaw !== undefined && limitRaw !== ''
        ? Number.parseInt(limitRaw, 10)
        : undefined;

    return this.geocode.search({
      q: q ?? '',
      country,
      proximityLng: Number.isFinite(proximityLng) ? proximityLng : undefined,
      proximityLat: Number.isFinite(proximityLat) ? proximityLat : undefined,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
  }
}
