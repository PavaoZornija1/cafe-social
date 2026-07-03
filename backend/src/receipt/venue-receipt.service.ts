import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ReceiptSubmissionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VenueService } from '../venue/venue.service';
import { PlayerNotificationService } from '../notification/player-notification.service';
import { VenueStaffNotificationService } from '../notification/venue-staff-notification.service';
import { OwnerRedemptionActionsService } from '../owner/owner-redemption-actions.service';

const MAX_IMAGE_BYTES = 2_500_000;

function estimateBase64Bytes(s: string): number {
  return Math.floor((s.length * 3) / 4);
}

@Injectable()
export class VenueReceiptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly venues: VenueService,
    private readonly playerNotify: PlayerNotificationService,
    private readonly staffNotify: VenueStaffNotificationService,
    private readonly redemptionActions: OwnerRedemptionActionsService,
  ) {}

  async submit(params: {
    venueId: string;
    playerId: string;
    imageData: string;
    mimeType?: string;
    notePlayer?: string;
    latitude?: number;
    longitude?: number;
    linkedRedemptionId?: string;
  }) {
    const hasCoords =
      typeof params.latitude === 'number' &&
      typeof params.longitude === 'number' &&
      Number.isFinite(params.latitude) &&
      Number.isFinite(params.longitude);
    if (!hasCoords) {
      throw new BadRequestException('Location (lat/lng) is required to submit a receipt here');
    }
    await this.venues.assertCoordinatesAllowedForGuestVenue(
      params.venueId,
      params.latitude!,
      params.longitude!,
    );

    const raw = params.imageData.trim();
    if (!raw) throw new BadRequestException('imageData is required');
    if (estimateBase64Bytes(raw) > MAX_IMAGE_BYTES) {
      throw new BadRequestException('Image too large (max ~2MB)');
    }

    const linkedRedemptionId = params.linkedRedemptionId?.trim() || null;
    if (linkedRedemptionId) {
      const claim = await this.prisma.venuePerkRedemption.findFirst({
        where: {
          id: linkedRedemptionId,
          venueId: params.venueId,
          playerId: params.playerId,
          voidedAt: null,
        },
      });
      if (!claim) {
        throw new BadRequestException('Linked reward claim not found for this venue');
      }
      if (claim.status !== 'REDEEMABLE') {
        throw new BadRequestException('Only ready-to-redeem rewards can be linked to a receipt');
      }
    }

    const retention = new Date();
    retention.setUTCDate(retention.getUTCDate() + 90);

    const row = await this.prisma.venueReceiptSubmission.create({
      data: {
        venueId: params.venueId,
        playerId: params.playerId,
        imageData: raw,
        mimeType: params.mimeType?.trim().slice(0, 64) || 'image/jpeg',
        notePlayer: params.notePlayer?.trim()?.slice(0, 2000),
        retentionUntil: retention,
        status: ReceiptSubmissionStatus.PENDING,
        linkedRedemptionId,
      },
    });

    if (linkedRedemptionId) {
      await this.redemptionActions.lockRedemption({
        venueId: params.venueId,
        redemptionId: linkedRedemptionId,
        staffPlayerId: params.playerId,
        reason: 'Receipt submitted for staff review',
      });
    }

    void this.staffNotify.notifyReceiptSubmitted({
      venueId: params.venueId,
      submissionId: row.id,
      playerId: params.playerId,
    });
    return {
      id: row.id,
      status: row.status,
      linkedRedemptionId: row.linkedRedemptionId,
      createdAt: row.createdAt.toISOString(),
      retentionUntil: row.retentionUntil?.toISOString() ?? null,
    };
  }

  listSummaryForVenue(venueId: string, status?: ReceiptSubmissionStatus) {
    return this.prisma.venueReceiptSubmission.findMany({
      where: {
        venueId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        venueId: true,
        playerId: true,
        mimeType: true,
        notePlayer: true,
        status: true,
        staffNote: true,
        abuseFlag: true,
        retentionUntil: true,
        reviewedAt: true,
        reviewedByPlayerId: true,
        linkedRedemptionId: true,
        createdAt: true,
        player: { select: { id: true, username: true, email: true } },
      },
    });
  }

  async getDetailForVenueStaff(venueId: string, id: string) {
    const row = await this.prisma.venueReceiptSubmission.findFirst({
      where: { id, venueId },
      include: {
        player: { select: { id: true, username: true, email: true } },
      },
    });
    if (!row) throw new NotFoundException('Submission not found');
    return row;
  }

  async review(params: {
    venueId: string;
    submissionId: string;
    reviewerPlayerId: string;
    status: 'APPROVED' | 'REJECTED';
    staffNote?: string;
    abuseFlag?: boolean;
  }) {
    const row = await this.prisma.venueReceiptSubmission.findFirst({
      where: { id: params.submissionId, venueId: params.venueId },
    });
    if (!row) throw new NotFoundException('Submission not found');
    if (row.status !== ReceiptSubmissionStatus.PENDING) {
      throw new BadRequestException('Already reviewed');
    }

    const updated = await this.prisma.venueReceiptSubmission.update({
      where: { id: row.id },
      data: {
        status: params.status as ReceiptSubmissionStatus,
        staffNote: params.staffNote?.trim()?.slice(0, 2000),
        abuseFlag: params.abuseFlag ?? false,
        reviewedAt: new Date(),
        reviewedByPlayerId: params.reviewerPlayerId,
      },
    });

    if (row.linkedRedemptionId) {
      if (params.status === 'APPROVED') {
        await this.redemptionActions.unlockRedemption({
          venueId: params.venueId,
          redemptionId: row.linkedRedemptionId,
        });
      } else if (params.abuseFlag) {
        await this.redemptionActions.voidRedemption({
          venueId: params.venueId,
          redemptionId: row.linkedRedemptionId,
          staffPlayerId: params.reviewerPlayerId,
          reason: params.staffNote?.trim() || 'Receipt rejected (abuse flagged)',
        });
      } else {
        await this.redemptionActions.unlockRedemption({
          venueId: params.venueId,
          redemptionId: row.linkedRedemptionId,
        });
      }
    }

    void this.playerNotify.notifyReceiptReviewed({
      playerId: row.playerId,
      venueId: params.venueId,
      submissionId: row.id,
      status: params.status,
    });
    return updated;
  }
}
