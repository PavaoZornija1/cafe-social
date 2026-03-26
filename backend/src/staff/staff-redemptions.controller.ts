import {
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { StaffRedemptionsService } from './staff-redemptions.service';

function utcTodayYmd(): string {
  const n = new Date();
  const y = n.getUTCFullYear();
  const m = String(n.getUTCMonth() + 1).padStart(2, '0');
  const d = String(n.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Browser-friendly: venue PIN only (no admin API key). For barista tablet. */
@Controller('staff/venues')
export class StaffRedemptionsController {
  constructor(private readonly staff: StaffRedemptionsService) {}

  @Get(':venueId/redemptions')
  list(
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Query('date') dateRaw: string | undefined,
    @Headers('x-venue-staff-pin') pinHeader: string | undefined,
  ) {
    const pin = pinHeader?.trim() ?? '';
    if (!pin) {
      throw new UnauthorizedException(
        'Send header X-Venue-Staff-Pin with the venue PIN from the partner CMS.',
      );
    }
    const dateYmd =
      dateRaw && dateRaw.trim() !== '' ? dateRaw.trim() : utcTodayYmd();
    return this.staff.listRedemptions({ venueId, pin, dateYmd });
  }
}
