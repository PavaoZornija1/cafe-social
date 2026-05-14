import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { staffVerificationCodeFromRedemptionId } from '../lib/redemption-staff-code';

@Injectable()
export class OwnerRedemptionActionsService {
  constructor(private readonly prisma: PrismaService) {}

  async acknowledge(params: {
    venueId: string;
    redemptionId: string;
    staffPlayerId: string;
  }) {
    const row = await this.prisma.venuePerkRedemption.findFirst({
      where: {
        id: params.redemptionId,
        venueId: params.venueId,
        voidedAt: null,
      },
    });
    if (!row) throw new NotFoundException('Redemption not found');
    if (row.status === 'LOCKED') {
      throw new BadRequestException('Reward is locked pending review');
    }
    if (row.status === 'VOIDED') {
      throw new BadRequestException('Reward is voided');
    }
    if (row.expiresAt.getTime() <= Date.now()) {
      await this.prisma.venuePerkRedemption.update({
        where: { id: row.id },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('Reward has expired');
    }
    if (row.status === 'REDEEMED' || row.redeemedAt) {
      throw new BadRequestException('Already redeemed');
    }
    return this.prisma.venuePerkRedemption.update({
      where: { id: row.id },
      data: {
        status: 'REDEEMED',
        redeemedAt: new Date(),
        redeemedByPlayerId: params.staffPlayerId,
      },
    });
  }

  async acknowledgeByStaffCode(params: {
    venueId: string;
    code: string;
    staffPlayerId: string;
  }) {
    const normalized = params.code.trim().toUpperCase().replace(/\s+/g, '');
    if (!/^[0-9A-F]{8}$/.test(normalized)) {
      throw new BadRequestException('Invalid staff verification code');
    }
    const rows = await this.prisma.venuePerkRedemption.findMany({
      where: { venueId: params.venueId },
      select: { id: true, issuedAt: true },
      orderBy: { issuedAt: 'desc' },
      take: 500,
    });
    const match = rows.find(
      (r) => staffVerificationCodeFromRedemptionId(r.id) === normalized,
    );
    if (!match) {
      throw new NotFoundException('Reward claim not found for code');
    }
    return this.acknowledge({
      venueId: params.venueId,
      redemptionId: match.id,
      staffPlayerId: params.staffPlayerId,
    });
  }

  async voidRedemption(params: {
    venueId: string;
    redemptionId: string;
    staffPlayerId: string;
    reason: string;
  }) {
    const reason = params.reason?.trim();
    if (!reason) throw new BadRequestException('reason is required');

    const row = await this.prisma.venuePerkRedemption.findFirst({
      where: { id: params.redemptionId, venueId: params.venueId },
    });
    if (!row) throw new NotFoundException('Redemption not found');
    if (row.voidedAt) throw new BadRequestException('Already voided');

    return this.prisma.venuePerkRedemption.update({
      where: { id: row.id },
      data: {
        status: 'VOIDED',
        voidedAt: new Date(),
        voidReason: reason.slice(0, 500),
        voidedByPlayerId: params.staffPlayerId,
      },
    });
  }

  async lockRedemption(params: {
    venueId: string;
    redemptionId: string;
    staffPlayerId: string;
    reason: string;
  }) {
    const reason = params.reason?.trim();
    if (!reason) throw new BadRequestException('reason is required');
    const row = await this.prisma.venuePerkRedemption.findFirst({
      where: { id: params.redemptionId, venueId: params.venueId },
    });
    if (!row) throw new NotFoundException('Redemption not found');
    if (row.status === 'REDEEMED') {
      throw new BadRequestException('Already redeemed');
    }
    if (row.status === 'VOIDED') {
      throw new BadRequestException('Already voided');
    }
    return this.prisma.venuePerkRedemption.update({
      where: { id: row.id },
      data: {
        status: 'LOCKED',
        voidReason: reason.slice(0, 500),
        voidedByPlayerId: params.staffPlayerId,
      },
    });
  }

  async unlockRedemption(params: {
    venueId: string;
    redemptionId: string;
  }) {
    const row = await this.prisma.venuePerkRedemption.findFirst({
      where: { id: params.redemptionId, venueId: params.venueId },
    });
    if (!row) throw new NotFoundException('Redemption not found');
    if (row.status !== 'LOCKED') {
      throw new BadRequestException('Reward is not locked');
    }
    return this.prisma.venuePerkRedemption.update({
      where: { id: row.id },
      data: { status: 'REDEEMABLE' },
    });
  }
}
