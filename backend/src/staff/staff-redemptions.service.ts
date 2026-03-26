import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { verifyStaffPortalPin } from '../lib/staff-pin';
import { staffVerificationCodeFromRedemptionId } from '../lib/redemption-staff-code';

function utcDayBounds(dateYmd: string): { start: Date; end: Date } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateYmd.trim());
  if (!m) {
    throw new BadRequestException('date must be YYYY-MM-DD (UTC)');
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const start = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, mo - 1, d, 23, 59, 59, 999));
  return { start, end };
}

@Injectable()
export class StaffRedemptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listRedemptions(params: { venueId: string; pin: string; dateYmd: string }) {
    const pin = params.pin.trim();
    if (!pin) {
      throw new UnauthorizedException('Missing or empty PIN');
    }
    const venue = await this.prisma.venue.findUnique({
      where: { id: params.venueId },
      select: {
        id: true,
        name: true,
        staffPortalPinHash: true,
      },
    });
    if (!venue) {
      throw new NotFoundException('Venue not found');
    }
    if (!venue.staffPortalPinHash) {
      throw new ForbiddenException(
        'Staff portal is not configured for this venue (set a PIN in the partner CMS).',
      );
    }
    if (!verifyStaffPortalPin(pin, venue.staffPortalPinHash)) {
      throw new UnauthorizedException('Invalid PIN');
    }

    return this.listRedemptionsPayload(params.venueId, params.dateYmd);
  }

  /** JWT staff / owner: already authorized by VenueStaffGuard. */
  listRedemptionsForStaffUser(venueId: string, dateYmd: string) {
    return this.listRedemptionsPayload(venueId, dateYmd);
  }

  private async listRedemptionsPayload(venueId: string, dateYmd: string) {
    const venue = await this.prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true, name: true },
    });
    if (!venue) {
      throw new NotFoundException('Venue not found');
    }

    const { start, end } = utcDayBounds(dateYmd);
    const rows = await this.prisma.venuePerkRedemption.findMany({
      where: {
        venueId,
        redeemedAt: { gte: start, lte: end },
      },
      orderBy: { redeemedAt: 'desc' },
      include: {
        perk: { select: { code: true, title: true } },
      },
    });

    return {
      venueId: venue.id,
      venueName: venue.name,
      date: dateYmd,
      redemptions: rows.map((r) => ({
        redemptionId: r.id,
        staffVerificationCode: staffVerificationCodeFromRedemptionId(r.id),
        redeemedAt: r.redeemedAt.toISOString(),
        perkCode: r.perk.code,
        perkTitle: r.perk.title,
        voidedAt: r.voidedAt?.toISOString() ?? null,
        voidReason: r.voidReason ?? null,
        staffAcknowledgedAt: r.staffAcknowledgedAt?.toISOString() ?? null,
      })),
    };
  }
}
