import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
    if (row.staffAcknowledgedAt) {
      throw new BadRequestException('Already acknowledged');
    }
    return this.prisma.venuePerkRedemption.update({
      where: { id: row.id },
      data: {
        staffAcknowledgedAt: new Date(),
        staffAcknowledgedByPlayerId: params.staffPlayerId,
      },
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
        voidedAt: new Date(),
        voidReason: reason.slice(0, 500),
        voidedByPlayerId: params.staffPlayerId,
      },
    });
  }
}
